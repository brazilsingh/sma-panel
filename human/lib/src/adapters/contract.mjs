/**
 * Provider adapter contract
 * =========================
 *
 * An adapter connects the queue to one destination (LinkedIn, X, later others).
 * It is a plain object:
 *
 *   {
 *     provider: 'linkedin',            // matches account.provider
 *     label: 'LinkedIn',
 *     live: true,                      // true when it calls a real network API
 *     requiresCredentials: true,
 *     commentLabel: 'first comment',   // how the UI names the follow-up ('first reply' on X)
 *
 *     capabilities(account) -> Capabilities
 *     accountProblems(account) -> string[]          // config gaps, e.g. missing author URN
 *
 *     async publishPost({ account, credentials, text, media, signal })
 *         -> { id, url }                            // provider post ID (required) and public URL
 *     async publishComment({ account, credentials, parent: { id, url }, text, media, signal })
 *         -> { id, url }
 *     async reconcile?({ account, credentials, target: 'post'|'comment', job, parent, signal })
 *         -> { status: 'delivered', id, url } | { status: 'not_delivered' } | { status: 'unknown' }
 *   }
 *
 * `media` items are { name, mimeType, altText, bytes: Buffer, sha256 }.
 *
 * Adapters throw ProviderError (see ../errors.mjs) with retry = 'never' | 'safe' | 'unsafe'.
 * They must never shorten copy or drop media: when something cannot be delivered as
 * submitted, throw a 'capability_missing' error that says what is unsupported.
 *
 * Capabilities:
 *   {
 *     text: { maxLength, count(text) -> number, unit: 'characters' | 'weighted characters' },
 *     media: { maxItems, mimeTypes: [...], maxBytes, rules?: (media) => string[] },
 *     comment: { supported, maxLength, count(text), media: { maxItems, mimeTypes, maxBytes } | null },
 *     requiresTextOrMedia: true
 *   }
 */

const plainCount = text => [...text].length;

/** Returns human-readable problems; empty when the delivery fits the destination. */
export function capabilityProblems(adapter, account, delivery) {
  const caps = adapter.capabilities(account);
  const problems = [];
  const name = (account.channel || adapter.label) + (account.label ? ' (' + account.label + ')' : '');
  checkPart('post', caps.text, caps.media, delivery.post);
  if (delivery.comment) {
    if (!caps.comment?.supported) {
      problems.push(name + ' cannot send a ' + (adapter.commentLabel || 'first comment') + ' from this account. Remove it or choose another destination.');
    } else {
      checkPart(adapter.commentLabel || 'first comment', { maxLength: caps.comment.maxLength, count: caps.comment.count, unit: caps.comment.unit }, caps.comment.media, delivery.comment);
    }
  }
  return problems;

  function checkPart(part, text, media, content) {
    const count = (text.count || plainCount)(content.text);
    if (!content.text.trim() && !content.media.length) problems.push('The ' + part + ' needs copy or a graphic.');
    if (part === 'post' && caps.requiresMedia && !content.media.length) problems.push(name + ' posts need a graphic. Attach one, or choose another destination.');
    if (text.maxLength && count > text.maxLength) {
      problems.push('The ' + part + ' is ' + count + ' ' + (text.unit || 'characters') + '; ' + name + ' allows ' + text.maxLength + '. Shorten it in SMA — nothing is trimmed automatically.');
    }
    if (!content.media.length) return;
    if (!media || !media.maxItems) {
      problems.push(name + ' cannot attach graphics to the ' + part + '. Remove ' + content.media.length + ' graphic(s) or choose another destination.');
      return;
    }
    if (content.media.length > media.maxItems) problems.push('The ' + part + ' has ' + content.media.length + ' graphics; ' + name + ' allows ' + media.maxItems + '.');
    for (const item of content.media) {
      if (!media.mimeTypes.includes(item.mimeType)) problems.push(item.name + ' is ' + item.mimeType + '; ' + name + ' accepts ' + media.mimeTypes.join(', ') + '.');
      if (media.maxBytes && item.size > media.maxBytes) problems.push(item.name + ' is ' + (item.size / 1048576).toFixed(1) + ' MB; ' + name + ' accepts up to ' + (media.maxBytes / 1048576).toFixed(0) + ' MB.');
    }
    if (media.rules) problems.push(...media.rules(content.media));
  }
}

export function assertAdapter(adapter) {
  for (const key of ['provider', 'label', 'capabilities', 'publishPost', 'publishComment']) {
    if (!adapter?.[key]) throw new Error('Adapter is missing ' + key);
  }
  return adapter;
}
