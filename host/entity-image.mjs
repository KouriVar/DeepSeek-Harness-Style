/**
 * dsh-style host half — image proxy.
 *
 * The browser cannot fetch third-party avatars/logos directly: the plugin's CSP
 * and CORS both block it, and we do not want the renderer holding a connection to
 * an arbitrary host anyway. So the host fetches the bytes and hands them back.
 *
 * This module is therefore a small, deliberately paranoid HTTP client:
 *
 *   1. Host allow-list (exact host or a real subdomain of it) — checked on the
 *      *initial* URL and again on **every** redirect hop, because a 302 is the
 *      classic way to smuggle a request to an internal service.
 *   2. https only, no credentials in the URL, no IP-literal host, no localhost,
 *      and no non-443 port.
 *   3. Redirects are followed manually (max 3 hops) so nothing bypasses (1).
 *   4. 8s total budget composed with the caller's AbortSignal.
 *   5. Size cap enforced twice: up-front via content-length, then while streaming
 *      the body so a lying/absent content-length cannot exhaust memory.
 *   6. Content-Type must be one of the raster/SVG image types we will render.
 *
 * Public API:
 *   proxyImage(url, { signal, maxBytes, timeoutMs, fetchImpl }) -> ProxyResult
 *   isAllowedImageUrl(url) -> boolean
 *   ALLOWED_HOSTS -> readonly string[]
 */

import { isIP } from 'node:net'

/**
 * Hosts we will ever fetch an image from. GitHub avatars, raw file CDNs,
 * Wikimedia uploads (Wikidata P18 points here) and the package registries.
 */
export const ALLOWED_HOSTS = Object.freeze([
  'avatars.githubusercontent.com',
  'raw.githubusercontent.com',
  'github.com',
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'wikimedia.org',
  'pypi.org',
  'files.pythonhosted.org',
  'registry.npmjs.org',
  'unpkg.com',
  'cdn.jsdelivr.net',
])

export const ALLOWED_CONTENT_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const ALLOWED_TYPE_SET = new Set(ALLOWED_CONTENT_TYPES)
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_BYTES = 5_000_000
const USER_AGENT = 'dsh-style-host/0.1 (+https://github.com/deepseek/dsh-style)'

const IMAGE_ACCEPT = 'image/png, image/jpeg, image/webp, image/gif, image/svg+xml;q=0.9, */*;q=0.1'

/* ------------------------------------------------------------------ *
 * URL policy
 * ------------------------------------------------------------------ */

function stripBrackets(hostname) {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

/** `avatars.githubusercontent.com` matches itself and `x.avatars.githubusercontent.com`. */
function hostIsAllowed(hostname) {
  for (const allowed of ALLOWED_HOSTS) {
    if (hostname === allowed) return true
    if (hostname.endsWith(`.${allowed}`)) return true
  }
  return false
}

/**
 * Validates one URL against the whole policy. Returns `{ url }` on success or
 * `{ error }` with a stable machine-readable code. Order matters: the checks get
 * more specific so the reported reason is the most useful one.
 */
export function inspectImageUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { error: 'invalid-url' }

  let url
  try {
    url = new URL(raw.trim())
  } catch {
    return { error: 'invalid-url' }
  }

  if (url.protocol !== 'https:') return { error: 'protocol-not-allowed' }
  if (url.username || url.password) return { error: 'credentials-not-allowed' }

  // `https://2130706433/` is normalised to 127.0.0.1 by the URL parser, so the
  // decimal/octal IPv4 spellings are covered by the same isIP() check.
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const bare = stripBrackets(hostname)
  if (!bare) return { error: 'host-not-allowed' }
  if (isIP(bare) !== 0) return { error: 'ip-host-not-allowed' }
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.local') || bare.endsWith('.internal')) {
    return { error: 'ip-host-not-allowed' }
  }
  if (url.port && url.port !== '443') return { error: 'port-not-allowed' }
  if (!hostIsAllowed(bare)) return { error: 'host-not-allowed' }

  return { url, hostname: bare }
}

/** Cheap pre-flight so the client can avoid a wasted round-trip. */
export function isAllowedImageUrl(url) {
  return inspectImageUrl(url).error === undefined
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function baseResult(overrides = {}) {
  return {
    ok: false,
    status: 0,
    contentType: null,
    bytes: Buffer.alloc(0),
    etag: null,
    error: null,
    finalUrl: null,
    hops: 0,
    ms: 0,
    ...overrides,
  }
}

function parseContentType(header) {
  if (!header) return null
  const value = String(header).split(';')[0].trim().toLowerCase()
  return value || null
}

async function discard(response) {
  try {
    await response.body?.cancel()
  } catch {
    /* already consumed / no body */
  }
}

/**
 * Reads a web ReadableStream while enforcing a hard byte ceiling. Returns as soon
 * as the ceiling is crossed instead of buffering the whole payload first.
 */
async function readCapped(body, maxBytes) {
  if (!body) return { bytes: Buffer.alloc(0), total: 0, tooLarge: false }

  const reader = body.getReader()
  const chunks = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      total += chunk.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel('byte limit exceeded')
        } catch {
          /* ignore */
        }
        return { bytes: null, total, tooLarge: true }
      }
      chunks.push(chunk)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }

  return { bytes: Buffer.concat(chunks, total), total, tooLarge: false }
}

/* ------------------------------------------------------------------ *
 * public entry point
 * ------------------------------------------------------------------ */

/**
 * @param {string} url  Absolute https URL on an allow-listed host.
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]     Caller cancellation.
 * @param {number} [options.maxBytes=5000000] Hard ceiling on the decoded body.
 * @param {number} [options.timeoutMs=8000]  Total budget for all hops.
 * @param {typeof fetch} [options.fetchImpl] Test seam; defaults to global fetch.
 * @returns {Promise<{ok:boolean,status:number,contentType:string|null,bytes:Buffer,etag:string|null,error:string|null,finalUrl:string|null,hops:number,ms:number}>}
 */
export async function proxyImage(url, options = {}) {
  const {
    signal,
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = options

  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : DEFAULT_MAX_BYTES
  const startedAt = performance.now()
  const elapsed = () => Math.round(performance.now() - startedAt)

  // `AbortSignal.timeout` is the documented budget; `any` fuses it with the caller.
  const timeoutSignal = AbortSignal.timeout(Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS)
  const composed = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  const fail = (error, extra = {}) => baseResult({ ok: false, error, ms: elapsed(), ...extra })

  let currentUrl = typeof url === 'string' ? url.trim() : url
  const visited = []

  /** Every hop is re-validated from scratch — this is the security core. */
  const checkHop = (candidate) => {
    const verdict = inspectImageUrl(candidate)
    if (verdict.error) return { error: verdict.error }
    return verdict
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const verdict = checkHop(currentUrl)
      if (verdict.error) {
        // A hop that fails *after* the first URL is reported distinctly, so the
        // caller can tell "you gave a bad URL" from "the CDN tried to escape the
        // allow-list". `redirectReason` keeps the original policy violation.
        if (hop > 0) {
          return fail('redirect-blocked', {
            hops: hop,
            finalUrl: visited.at(-1) ?? null,
            redirectReason: verdict.error,
          })
        }
        return fail(verdict.error, { hops: hop, finalUrl: visited.at(-1) ?? null })
      }

      visited.push(verdict.url.href)

      let response
      try {
        response = await fetchImpl(verdict.url.href, {
          method: 'GET',
          redirect: 'manual',
          signal: composed,
          headers: { 'user-agent': USER_AGENT, accept: IMAGE_ACCEPT },
        })
      } catch (error) {
        const code = timeoutSignal.aborted ? 'timeout' : signal?.aborted ? 'aborted' : 'fetch-failed'
        return fail(code, { hops: hop, finalUrl: verdict.url.href, status: 0, errorDetail: String(error?.message ?? error) })
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location')
        await discard(response)
        if (!location) return fail('redirect-without-location', { status: response.status, hops: hop, finalUrl: verdict.url.href })
        if (hop === MAX_REDIRECTS) return fail('too-many-redirects', { status: response.status, hops: hop, finalUrl: verdict.url.href })
        try {
          currentUrl = new URL(location, verdict.url).href
        } catch {
          return fail('redirect-invalid-location', { status: response.status, hops: hop, finalUrl: verdict.url.href })
        }
        continue
      }

      const contentType = parseContentType(response.headers.get('content-type'))

      if (response.status !== 200) {
        await discard(response)
        return fail(response.status === 404 ? 'not-found' : `http-${response.status}`, {
          status: response.status,
          contentType,
          hops: hop,
          finalUrl: verdict.url.href,
        })
      }

      if (!contentType || !ALLOWED_TYPE_SET.has(contentType)) {
        await discard(response)
        return fail('content-type-not-allowed', {
          status: response.status,
          contentType,
          hops: hop,
          finalUrl: verdict.url.href,
        })
      }

      // Declared size first: cheapest rejection, and it avoids opening the stream.
      const declaredLength = Number(response.headers.get('content-length'))
      if (Number.isFinite(declaredLength) && declaredLength > limit) {
        await discard(response)
        return fail('too-large', {
          status: response.status,
          contentType,
          hops: hop,
          finalUrl: verdict.url.href,
          declaredBytes: declaredLength,
        })
      }

      // Streamed size second: content-length can be absent (unpkg) or describe the
      // *compressed* payload (jsdelivr), so only the decoded byte count is trusted.
      let read
      try {
        read = await readCapped(response.body, limit)
      } catch (error) {
        const code = timeoutSignal.aborted ? 'timeout' : signal?.aborted ? 'aborted' : 'body-read-failed'
        return fail(code, { status: response.status, contentType, hops: hop, finalUrl: verdict.url.href, errorDetail: String(error?.message ?? error) })
      }

      if (read.tooLarge) {
        return fail('too-large', {
          status: response.status,
          contentType,
          hops: hop,
          finalUrl: verdict.url.href,
          receivedBytes: read.total,
        })
      }

      return {
        ok: true,
        status: response.status,
        contentType,
        bytes: read.bytes,
        etag: response.headers.get('etag') || null,
        error: null,
        finalUrl: verdict.url.href,
        hops: hop,
        redirects: visited.length > 1 ? visited.slice(0, -1) : [],
        bytesLength: read.bytes.byteLength,
        ms: elapsed(),
      }
    }

    return fail('too-many-redirects', { hops: MAX_REDIRECTS })
  } catch (error) {
    const code = timeoutSignal.aborted ? 'timeout' : signal?.aborted ? 'aborted' : 'internal-error'
    return fail(code, { errorDetail: String(error?.message ?? error) })
  }
}

export const __internals = {
  hostIsAllowed,
  readCapped,
  parseContentType,
  ALLOWED_HOSTS,
  ALLOWED_CONTENT_TYPES,
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_REDIRECTS,
}
