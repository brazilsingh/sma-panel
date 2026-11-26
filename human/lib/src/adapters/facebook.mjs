// Facebook Page connector, built from Meta's Pages API docs (Graph API v26.0, July 2026):
//   Posts       https://developers.facebook.com/docs/pages-api/posts         POST /{page-id}/feed
//   Photos      https://developers.facebook.com/docs/graph-api/reference/page/photos   POST /{page-id}/photos
//   Comments    https://developers.facebook.com/docs/graph-api/reference/object/comments POST /{post-id}/comments
// Token: a Page access token for the Page, from a person who can create content on it.
// Permissions: pages_manage_posts (posts), pages_manage_engagement (first comments), pages_read_engagement.
import { ProviderError } from '../errors.mjs';
import { callProvider } from './http.mjs';

export const FACEBOOK_DEFAULT_VERSION = 'v26.0';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

const graph = account => 'https://graph.facebook.com/' + (/^v\d+\.\d+$/.test(account.apiVersion || '') ? account.apiVersion : FACEBOOK_DEFAULT_VERSION);

export function facebookCapabilities() {
  return {
    text: { maxLength: 63206, unit: 'characters' },
    media: { maxItems: 10, mimeTypes: IMAGE_TYPES, maxBytes: 4 * 1024 * 1024, rules: () => [] },
    comment: { supported: true, maxLength: 8000, unit: 'characters', media: null },
    requiresTextOrMedia: true
  };
}

export function facebookAccountProblems(account) {
  return /^\d{5,25}$/.test(String(account.pageId || '')) ? [] : ['Set the Facebook Page ID (the number in the Page’s About › Page transparency, or from the Graph API) for ' + account.id + '.'];
}

// A Page post ID is "<pageId>_<postId>"; facebook.com/<that id> opens the post.
export const facebookPostUrl = id => 'https://www.facebook.com/' + encodeURIComponent(id);

export function createFacebookAdapter({ fetch: fetchImpl = globalThis.fetch } = {}) {
  const auth = credentials => ({ Authorization: 'Bearer ' + credentials.accessToken });

  async function json(response, what, creates) {
    const body = await response.json().catch(() => ({}));
    const id = body.post_id || body.id;
    if (!id) throw new ProviderError('provider_missing_id', 'Facebook accepted the ' + what + ' but returned no ID.' + (creates ? ' Check the Page before retrying.' : ' Nothing was posted.'), { retry: creates ? 'unsafe' : 'safe', status: response.status });
    return { id, body };
  }

  async function postJson(account, credentials, path, payload, what, creates, signal) {
    const response = await callProvider(fetchImpl, 'Facebook', graph(account) + path, {
      method: 'POST', headers: { ...auth(credentials), 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, { creates, signal });
    return json(response, what, creates);
  }

  // Upload a photo without publishing it, so several can be attached to one post.
  async function stagePhoto(account, credentials, item, signal) {
    const form = new FormData();
    form.append('source', new Blob([item.bytes], { type: item.mimeType }), item.name || 'graphic');
    form.append('published', 'false');
    if (item.altText) form.append('alt_text_custom', item.altText);
    const response = await callProvider(fetchImpl, 'Facebook photo upload', graph(account) + '/' + account.pageId + '/photos', { method: 'POST', headers: auth(credentials), body: form }, { creates: false, signal });
    return (await json(response, 'photo', false)).id;
  }

  async function publishPost({ account, credentials, text, media = [], signal }) {
    const payload = {};
    if (text) payload.message = text;
    if (media.length) {
      const ids = [];
      for (const item of media) ids.push(await stagePhoto(account, credentials, item, signal));
      payload.attached_media = ids.map(media_fbid => ({ media_fbid }));
    }
    const { id } = await postJson(account, credentials, '/' + account.pageId + '/feed', payload, 'post', true, signal);
    return { id, url: facebookPostUrl(id) };
  }

  async function publishComment({ account, credentials, text, parent, signal }) {
    const { id } = await postJson(account, credentials, '/' + encodeURIComponent(parent.id) + '/comments', { message: text }, 'comment', true, signal);
    return { id, url: 'https://www.facebook.com/' + encodeURIComponent(id) };
  }

  return {
    provider: 'facebook',
    label: 'Facebook',
    live: true,
    requiresCredentials: true,
    commentLabel: 'first comment',
    capabilities: facebookCapabilities,
    accountProblems: facebookAccountProblems,
    publishPost,
    publishComment
  };
}
