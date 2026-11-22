import { invalid } from './errors.mjs';

export const PLACEHOLDERS = ['{{permalink}}', '{{article_url}}'];

export function cleanUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return String(value).trim();
  } catch {
    throw invalid('Enter the permalink as a full http:// or https:// address.');
  }
}

const hasPlaceholder = text => PLACEHOLDERS.some(p => text.includes(p));

function place(text, url, wanted) {
  if (hasPlaceholder(text)) return PLACEHOLDERS.reduce((out, p) => out.replaceAll(p, url), text);
  if (!wanted || !url || text.includes(url)) return text;
  return text ? text + '\n\n' + url : url;
}

/**
 * Build exactly what will be sent. The submitted copy is never trimmed or shortened:
 * the permalink is substituted into a placeholder, or appended on its own paragraph
 * when the copy does not already contain it.
 */
export function renderDelivery(job) {
  const url = job.permalink?.url || '';
  const placement = job.permalink?.placement || 'post';
  const postText = job.copy.text || '';
  const commentText = job.firstComment?.text || '';
  const missing = [];
  if (!url && (hasPlaceholder(postText) || hasPlaceholder(commentText))) missing.push('The copy contains a permalink placeholder but no permalink is set.');
  const post = { text: place(postText, url, placement === 'post'), media: job.media || [] };
  let comment = null;
  if (job.firstComment || (url && placement === 'comment')) {
    comment = { text: place(commentText, url, placement === 'comment'), media: job.firstComment?.media || [] };
    if (!comment.text.trim() && !comment.media.length) comment = null;
  }
  return { post, comment, problems: missing };
}
