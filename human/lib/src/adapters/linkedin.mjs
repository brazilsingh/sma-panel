// LinkedIn connector, built from the official Marketing API docs (li-lms-2026-11):
//   Posts API     https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
//   Images API    https://learn.microsoft.com/linkedin/marketing/community-management/shares/images-api
//   MultiImage    https://learn.microsoft.com/linkedin/marketing/community-management/shares/multiimage-post-api
//   Comments API  https://learn.microsoft.com/linkedin/marketing/community-management/shares/comments-api
import { ProviderError } from '../errors.mjs';
import { callProvider } from './http.mjs';

const API = 'https://api.linkedin.com/rest';
export const LINKEDIN_DEFAULT_VERSION = '202611';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif']; // Images API: JPG, GIF, PNG (no WebP)

// Characters reserved by LinkedIn's "little" text format used in Posts `commentary`.
// They are escaped so the copy appears exactly as written. `#` is left alone so hashtags work.
const LITTLE_RESERVED = /[\\|{}@[\]()<>*_~]/g;
export const escapeLittleText = text => text.replace(LITTLE_RESERVED, ch => '\\' + ch);

export function linkedinCapabilities() {
  return {
    text: { maxLength: 3000, unit: 'characters' },
    media: {
      maxItems: 20,
      mimeTypes: IMAGE_TYPES,
      maxBytes: 8 * 1024 * 1024,
      rules: media => media.some(m => m.mimeType === 'image/gif') && media.length > 1 ? ['LinkedIn multi-image posts take still images only. Send the GIF on its own.'] : []
    },
    // Comment images are documented but also listed as an error case for inline comments,
    // so comment graphics stay disabled until verified on a live account.
    comment: { supported: true, maxLength: 1250, unit: 'characters', media: null },
    requiresTextOrMedia: true
  };
}

export function linkedinAccountProblems(account) {
  const problems = [];
  if (!/^urn:li:(organization|person):[\w-]+$/.test(account.author || '')) problems.push('Set the LinkedIn author URN (urn:li:organization:… or urn:li:person:…) for ' + account.id + '.');
  return problems;
}

export const linkedinPostUrl = urn => 'https://www.linkedin.com/feed/update/' + urn + '/';

export function createLinkedInAdapter({ fetch: fetchImpl = globalThis.fetch } = {}) {
  const headers = (account, credentials, extra = {}) => ({
    Authorization: 'Bearer ' + credentials.accessToken,
    'LinkedIn-Version': account.apiVersion || LINKEDIN_DEFAULT_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra
  });

  async function uploadImage(account, credentials, item, signal) {
    const init = await callProvider(fetchImpl, 'LinkedIn', API + '/images?action=initializeUpload', {
      method: 'POST',
      headers: headers(account, credentials, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ initializeUploadRequest: { owner: account.author } })
    }, { creates: false, signal });
    const value = (await init.json()).value || {};
    if (!value.uploadUrl || !value.image) throw new ProviderError('provider_bad_response', 'LinkedIn did not return an image upload URL. Nothing was posted.', { retry: 'safe' });
    await callProvider(fetchImpl, 'LinkedIn upload', value.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + credentials.accessToken, 'Content-Type': item.mimeType },
      body: item.bytes
    }, { creates: false, signal });
    return value.image;
  }

  return {
    provider: 'linkedin',
    label: 'LinkedIn',
    live: true,
    requiresCredentials: true,
    commentLabel: 'first comment',
    capabilities: linkedinCapabilities,
    accountProblems: linkedinAccountProblems,

    async publishPost({ account, credentials, text, media, signal }) {
      const images = [];
      for (const item of media) images.push({ id: await uploadImage(account, credentials, item, signal), altText: item.altText || '' });
      const body = {
        author: account.author,
        commentary: escapeLittleText(text),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      };
      if (images.length === 1) body.content = { media: { id: images[0].id, ...(images[0].altText ? { altText: images[0].altText } : {}) } };
      if (images.length > 1) body.content = { multiImage: { images: images.map(i => ({ id: i.id, ...(i.altText ? { altText: i.altText } : {}) })) } };
      const response = await callProvider(fetchImpl, 'LinkedIn', API + '/posts', {
        method: 'POST',
        headers: headers(account, credentials, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
      }, { creates: true, signal });
      const id = response.headers.get('x-restli-id');
      if (!id) throw new ProviderError('provider_missing_id', 'LinkedIn accepted the post but did not return its ID (x-restli-id). Check the page before retrying.', { retry: 'unsafe', status: response.status });
      return { id, url: linkedinPostUrl(id) };
    },

    async publishComment({ account, credentials, parent, text, signal }) {
      const response = await callProvider(fetchImpl, 'LinkedIn', API + '/socialActions/' + encodeURIComponent(parent.id) + '/comments', {
        method: 'POST',
        headers: headers(account, credentials, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ actor: account.author, object: parent.id, message: { text } })
      }, { creates: true, signal });
      const raw = await response.text();
      let json = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { /* header is enough */ }
      const id = json.commentUrn || response.headers.get('x-restli-id') || json.id;
      if (!id) throw new ProviderError('provider_missing_id', 'LinkedIn accepted the comment but did not return its ID. Check the post before retrying.', { retry: 'unsafe', status: response.status });
      return { id, url: parent.url };
    }
  };
}
