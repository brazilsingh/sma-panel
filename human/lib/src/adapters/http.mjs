import { ProviderError } from '../errors.mjs';

const NOT_SENT = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'CERT_HAS_EXPIRED', 'UND_ERR_CONNECT_TIMEOUT']);

/**
 * fetch wrapper that classifies failures for the queue.
 * `creates` = true when the request publishes something visible (post, comment, reply).
 * For those, any failure after the request may have reached the provider is 'unsafe'.
 */
export async function callProvider(fetchImpl, label, url, init, { creates, signal }) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal });
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    if (NOT_SENT.has(code)) {
      throw new ProviderError('provider_unreachable', label + ' could not be reached (' + code + '). Nothing was sent.', { retry: 'safe' });
    }
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw new ProviderError('provider_timeout', label + ' did not answer in time.' + (creates ? ' The post may or may not exist; check the account before retrying.' : ''), { retry: creates ? 'unsafe' : 'safe' });
    }
    throw new ProviderError('provider_network', label + ' connection failed: ' + (error?.message || code) + '.', { retry: creates ? 'unsafe' : 'safe' });
  }
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  const detail = summarise(body);
  const status = response.status;
  const base = { status, providerResponse: body };
  if (status === 401) throw new ProviderError('provider_auth', label + ' rejected the access token (401). Reconnect the account.' + detail, { ...base, retry: 'never' });
  if (status === 403) throw new ProviderError('provider_forbidden', label + ' refused the request (403). Check the app permissions and the account role.' + detail, { ...base, retry: 'never' });
  if (status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const reset = Number(response.headers.get('x-rate-limit-reset'));
    const retryAfterMs = retryAfter > 0 ? retryAfter * 1000 : reset > 0 ? Math.max(0, reset * 1000 - Date.now()) : undefined;
    throw new ProviderError('provider_rate_limited', label + ' rate limit reached (429). Nothing was sent.' + detail, { ...base, retry: 'safe', retryAfterMs });
  }
  if (status >= 500) {
    throw new ProviderError('provider_server_error', label + ' returned ' + status + '.' + (creates ? ' The post may or may not exist.' : '') + detail, { ...base, retry: creates ? 'unsafe' : 'safe' });
  }
  throw new ProviderError('provider_rejected', label + ' rejected the request (' + status + ').' + detail, { ...base, retry: 'never' });
}

function summarise(body) {
  if (!body) return '';
  try {
    const json = JSON.parse(body);
    const message = json.message || json.detail || json.title || json.errors?.[0]?.message || json.error_description || json.error;
    return message ? ' ' + String(message).slice(0, 400) : '';
  } catch {
    return ' ' + body.slice(0, 200);
  }
}
