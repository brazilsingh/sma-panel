// Errors the queue returns to callers (HTTP layer maps `status`).
export class PublishingError extends Error {
  constructor(code, message, { status = 400, details } = {}) {
    super(message);
    this.name = 'PublishingError';
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
  toJSON() {
    return { error: this.message, code: this.code, ...(this.details !== undefined ? { details: this.details } : {}) };
  }
}

export const invalid = (message, details) => new PublishingError('invalid_request', message, { status: 400, details });
export const notFound = message => new PublishingError('not_found', message, { status: 404 });
export const forbidden = message => new PublishingError('forbidden', message, { status: 403 });
export const conflict = (code, message, details) => new PublishingError(code, message, { status: 409, details });
export const unsupported = (message, details) => new PublishingError('capability_missing', message, { status: 422, details });

/**
 * Errors thrown by provider adapters.
 *
 * retry:
 *  - 'never'  the provider rejected the request; retrying the same payload will not help.
 *  - 'safe'   the provider did not create anything (for example 429, connection refused,
 *             media upload failed); the queue may retry automatically.
 *  - 'unsafe' the provider may have created the post (timeout, 5xx, connection reset after
 *             sending); the queue must not retry blindly. The job becomes `uncertain`.
 */
export class ProviderError extends Error {
  constructor(code, message, { retry = 'never', status, providerResponse, retryAfterMs } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retry = retry;
    if (status !== undefined) this.status = status;
    if (providerResponse !== undefined) this.providerResponse = providerResponse;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
  }
}

/** Turn any thrown value into a ProviderError. Unknown errors are treated as uncertain. */
export function asProviderError(error) {
  if (error instanceof ProviderError) return error;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new ProviderError('provider_timeout', 'The provider did not answer in time. The post may or may not have been created.', { retry: 'unsafe' });
  }
  return new ProviderError('provider_unexpected', 'Unexpected delivery error: ' + (error?.message || String(error)), { retry: 'unsafe' });
}

/** Serializable error stored on a job. Never includes credentials. */
export function errorRecord(error, at) {
  const e = asProviderError(error);
  return {
    code: e.code,
    message: e.message,
    retry: e.retry,
    ...(e.status !== undefined ? { providerStatus: e.status } : {}),
    ...(e.providerResponse !== undefined ? { providerResponse: truncate(e.providerResponse) } : {}),
    at: new Date(at).toISOString()
  };
}

function truncate(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 2000 ? text.slice(0, 2000) + '…' : text;
}
