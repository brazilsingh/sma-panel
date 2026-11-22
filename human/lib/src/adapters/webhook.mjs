import { ProviderError } from '../errors.mjs';
import { callProvider } from './http.mjs';

const graphics = { maxItems:8, maxBytes:8 * 1024 * 1024, mimeTypes:['image/png','image/jpeg','image/webp','image/gif'] };
// Platforms whose posts are built around an image or video: SMA refuses to send them without one.
const MEDIA_FIRST = new Set(['Instagram','TikTok','Pinterest','Snapchat','YouTube','Vimeo','Flickr','Behance','Dribbble']);
export function webhookCapabilities(account) {
  return {
    text:{ maxLength:100000 }, media:graphics,
    requiresMedia:MEDIA_FIRST.has(account.channel),
    comment:{ supported:account.supportsComments === true, maxLength:10000, media:null }
  };
}
function validateEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function createWebhookAdapter({ fetch:fetchImpl = fetch } = {}) {
  const label = 'Webhook';
  async function deliver(kind, { account, credentials, parent, text, media, signal }) {
    const endpoint = validateEndpoint(account.endpoint);
    if (!endpoint) throw new ProviderError('invalid_endpoint','Configure an HTTPS publishing endpoint.',{ retry:'never' });
    const response = await callProvider(fetchImpl,label,endpoint,{
      method:'POST', redirect:'error',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + credentials.accessToken },
      body:JSON.stringify({ kind, accountId:account.id, channel:account.channel || 'Website', text, parent:parent || null,
        media:media.map(item => ({ name:item.name,mimeType:item.mimeType,altText:item.altText,base64:item.bytes.toString('base64') })) })
    },{ creates:true,signal });
    const result = await response.json().catch(() => null);
    if (!result || typeof result.id !== 'string' || !result.id.trim()) {
      throw new ProviderError('delivery_unconfirmed','The destination answered without a published item ID. Check the destination before retrying.',{ retry:'unsafe' });
    }
    return { id:result.id,url:validateEndpoint(result.url) };
  }
  return {
    provider:'webhook',label,live:true,requiresCredentials:true,commentLabel:'first comment',
    capabilities:webhookCapabilities,
    accountProblems:account => validateEndpoint(account.endpoint) ? [] : ['Configure an HTTPS publishing endpoint in accounts.json.'],
    publishPost:args => deliver('post',args),
    publishComment:args => deliver('comment',args)
  };
}
