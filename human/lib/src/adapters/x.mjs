// X connector, built from the official X API v2 docs:
//   Create Post   https://docs.x.com/x-api/posts/create-post      POST https://api.x.com/2/tweets
//   Upload media  https://docs.x.com/x-api/media/upload-media     POST https://api.x.com/2/media/upload
// OAuth 2.0 user token scopes: tweet.write, tweet.read, users.read, media.write.
import { ProviderError } from '../errors.mjs';
import { callProvider } from './http.mjs';

const API = 'https://api.x.com/2';
const STILL = ['image/png', 'image/jpeg', 'image/webp'];
const ALL = [...STILL, 'image/gif'];

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const ONE = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * Weighted length following X's counting rules: URLs count 23, emoji 2, characters
 * outside the Latin/punctuation ranges 2, everything else 1. X stays the authority;
 * a rejection from X is reported as-is.
 */
export function countXText(text) {
  let total = 0;
  const withoutUrls = text.replace(URL_PATTERN, () => { total += 23; return ''; });
  for (const { segment } of segmenter.segment(withoutUrls)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) { total += 2; continue; }
    const cp = segment.codePointAt(0);
    total += ONE.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
  }
  return total;
}

const mediaRules = media => {
  const gifs = media.filter(m => m.mimeType === 'image/gif').length;
  if (gifs && media.length > 1) return ['X allows one GIF per post, with no other graphics.'];
  return [];
};

export function xCapabilities(account = {}) {
  const maxLength = account.longPosts ? 25000 : 280;
  const media = { maxItems: 4, mimeTypes: ALL, maxBytes: 5 * 1024 * 1024, rules: mediaRules };
  return {
    text: { maxLength, count: countXText, unit: 'weighted characters' },
    media,
    // The first reply is a normal post in reply to the parent, so it has the same limits.
    comment: { supported: true, maxLength, count: countXText, unit: 'weighted characters', media },
    requiresTextOrMedia: true
  };
}

export function xAccountProblems(account) {
  return /^\w{1,15}$/.test(account.handle || '') ? [] : ['Set the X handle (without @) for ' + account.id + ' so SMA can build post links.'];
}

export function createXAdapter({ fetch: fetchImpl = globalThis.fetch } = {}) {
  const auth = credentials => ({ Authorization: 'Bearer ' + credentials.accessToken });

  async function upload(credentials, item, signal) {
    const form = new FormData();
    form.append('media', new Blob([item.bytes], { type: item.mimeType }), item.name || 'graphic');
    form.append('media_category', item.mimeType === 'image/gif' ? 'tweet_gif' : 'tweet_image');
    const response = await callProvider(fetchImpl, 'X media upload', API + '/media/upload', { method: 'POST', headers: auth(credentials), body: form }, { creates: false, signal });
    const data = (await response.json()).data || {};
    if (!data.id) throw new ProviderError('provider_bad_response', 'X did not return a media ID for ' + item.name + '. Nothing was posted.', { retry: 'safe' });
    const state = data.processing_info?.state;
    if (state && state !== 'succeeded') {
      throw new ProviderError('provider_media_processing', 'X is still processing ' + item.name + ' (' + state + '). Nothing was posted; SMA will try again.', { retry: 'safe', retryAfterMs: (data.processing_info.check_after_secs || 5) * 1000 });
    }
    return data.id;
  }

  async function create(credentials, body, signal) {
    const response = await callProvider(fetchImpl, 'X', API + '/tweets', {
      method: 'POST',
      headers: { ...auth(credentials), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, { creates: true, signal });
    const json = await response.json().catch(() => ({}));
    if (!json.data?.id) throw new ProviderError('provider_missing_id', 'X accepted the request but did not return a post ID. Check the account before retrying.', { retry: 'unsafe', status: response.status });
    return json.data.id;
  }

  const postUrl = (account, id) => 'https://x.com/' + (account.handle || 'i/web') + '/status/' + id;

  async function send({ account, credentials, text, media, signal }, reply) {
    const mediaIds = [];
    for (const item of media) mediaIds.push(await upload(credentials, item, signal));
    const body = {};
    if (text) body.text = text;
    if (mediaIds.length) body.media = { media_ids: mediaIds };
    if (reply) body.reply = { in_reply_to_tweet_id: reply };
    const id = await create(credentials, body, signal);
    return { id, url: postUrl(account, id) };
  }

  return {
    provider: 'x',
    label: 'X',
    live: true,
    requiresCredentials: true,
    commentLabel: 'first reply',
    capabilities: xCapabilities,
    accountProblems: xAccountProblems,
    publishPost: args => send(args),
    publishComment: args => send(args, args.parent.id)
  };
}
