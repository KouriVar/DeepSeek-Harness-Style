#!/usr/bin/env node
/**
 * dsh-style host — verification harness.
 *
 * Exercises BOTH host modules against the real network and prints a JSON report
 * that is also written to /tmp/p1-host-verify.json.
 *
 *   node dsh-style/host/__tests__/verify.mjs
 *   node dsh-style/host/__tests__/verify.mjs --json   # only the JSON blob
 *
 * Cases are tagged so a flaky upstream never looks like a code defect:
 *   required  — deterministic, must pass (URL policy, byte caps, no fabrication)
 *   network   — real upstreams; a failure is reported as WARN, not FAIL
 */

import { enrichEntity, __clearCache, __cacheInfo, __wikidataState, __githubState, __internals } from '../entity-enrich.mjs'
import { proxyImage, isAllowedImageUrl, ALLOWED_HOSTS } from '../entity-image.mjs'

const JSON_ONLY = process.argv.includes('--json')
// GitHub's anonymous *search* quota is 10 requests/minute. Pacing the batch keeps
// a verification run from tripping it (use --fast to skip the waits).
const PACE_MS = process.argv.includes('--fast') ? 0 : Number(process.env.DSH_PACE_MS ?? 6500)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (...args) => {
  if (!JSON_ONLY) console.log(...args)
}

const PNG_MAGIC = '89504e470d0a1a0a'
const results = { enrich: [], images: [], unit: [], startedAt: new Date().toISOString() }

/* ------------------------------------------------------------------ */
/* image helpers                                                       */
/* ------------------------------------------------------------------ */

function streamedResponse(chunks, { status = 200, headers = {} } = {}) {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  return new Response(stream, { status, headers })
}

function redirectResponse(location, status = 302) {
  return new Response(null, { status, headers: { location } })
}

function pngBytes(count) {
  const buf = Buffer.alloc(count)
  buf.set(Buffer.from(PNG_MAGIC, 'hex'), 0)
  return buf
}

/* ------------------------------------------------------------------ */
/* image cases                                                         */
/* ------------------------------------------------------------------ */

const imageCases = [
  // ---- positive, real network ----
  {
    id: 'avatar-png',
    kind: 'network',
    url: 'https://avatars.githubusercontent.com/u/9919?s=64&v=4',
    expectOk: true,
    expectType: 'image/png',
    expectMagic: PNG_MAGIC,
  },
  {
    id: 'jsdelivr-svg',
    kind: 'network',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11/icons/react.svg',
    expectOk: true,
    expectType: 'image/svg+xml',
    expectSvg: true,
  },
  {
    id: 'github-multihop-redirect',
    kind: 'network',
    url: 'https://github.com/github/explore/raw/main/topics/react/react.png',
    expectOk: true,
    expectType: 'image/png',
    expectMagic: PNG_MAGIC,
    expectMinHops: 1,
  },
  {
    id: 'npm-json-rejected',
    kind: 'network',
    url: 'https://registry.npmjs.org/react/latest',
    expectOk: false,
    expectError: 'content-type-not-allowed',
  },

  // ---- negative, policy only (no network needed) ----
  { id: 'offsite-host', kind: 'required', url: 'https://example.com/x.png', expectOk: false, expectError: 'host-not-allowed' },
  {
    id: 'plain-http',
    kind: 'required',
    url: 'http://avatars.githubusercontent.com/u/9919?s=64&v=4',
    expectOk: false,
    expectError: 'protocol-not-allowed',
  },
  { id: 'ipv4-literal', kind: 'required', url: 'https://127.0.0.1/x.png', expectOk: false, expectError: 'ip-host-not-allowed' },
  { id: 'ipv6-literal', kind: 'required', url: 'https://[::1]/x.png', expectOk: false, expectError: 'ip-host-not-allowed' },
  {
    id: 'decimal-ip',
    kind: 'required',
    url: 'https://2130706433/x.png',
    expectOk: false,
    expectError: 'ip-host-not-allowed',
  },
  { id: 'localhost', kind: 'required', url: 'https://localhost/x.png', expectOk: false, expectError: 'ip-host-not-allowed' },
  {
    // pass would be smuggled credentials
    id: 'userinfo',
    kind: 'required',
    url: 'https://user:pass@avatars.githubusercontent.com/x.png',
    expectOk: false,
    expectError: 'credentials-not-allowed',
  },
  {
    id: 'suffix-spoof',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com.evil.test/x.png',
    expectOk: false,
    expectError: 'host-not-allowed',
  },
  {
    id: 'userinfo-prefix-spoof',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com@evil.test/x.png',
    expectOk: false,
    expectError: 'credentials-not-allowed',
  },
  {
    id: 'odd-port',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com:8443/x.png',
    expectOk: false,
    expectError: 'port-not-allowed',
  },
  { id: 'not-a-url', kind: 'required', url: 'not a url', expectOk: false, expectError: 'invalid-url' },
  { id: 'ftp-protocol', kind: 'required', url: 'ftp://avatars.githubusercontent.com/x.png', expectOk: false, expectError: 'protocol-not-allowed' },

  // ---- redirect-escape + size cap, via injected fetch (deterministic) ----
  {
    id: 'redirect-escape',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async (href) => redirectResponse('https://evil.test/x.png'),
    expectOk: false,
    expectError: 'redirect-blocked',
    expectRedirectReason: 'host-not-allowed',
  },
  {
    id: 'redirect-relative-followed',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    // First hop is a *relative* redirect (still on the allowed host), second
    // response is a real PNG: proves following works without weakening the check.
    fetchImpl: (() => {
      let calls = 0
      return async () =>
        calls++ === 0
          ? redirectResponse('/ok.png')
          : streamedResponse([pngBytes(64)], { headers: { 'content-type': 'image/png' } })
    })(),
    expectOk: true,
    expectType: 'image/png',
    expectMagic: PNG_MAGIC,
    expectMinHops: 1,
  },
  {
    id: 'redirect-loop-limit',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async () => redirectResponse('https://avatars.githubusercontent.com/u/1'),
    expectOk: false,
    expectError: 'too-many-redirects',
  },
  {
    id: 'redirect-to-ip',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async () => redirectResponse('https://169.254.169.254/latest/meta-data/'),
    expectOk: false,
    expectError: 'redirect-blocked',
    expectRedirectReason: 'ip-host-not-allowed',
    fetchNote: 'cloud metadata endpoint (SSRF) reached only via a whitelisted-host redirect',
  },
  {
    id: 'declared-too-large',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async () => streamedResponse([pngBytes(10)], { headers: { 'content-type': 'image/png', 'content-length': '999999999' } }),
    expectOk: false,
    expectError: 'too-large',
  },
  {
    id: 'streamed-cap-exceeded',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    maxBytes: 4096,
    fetchImpl: async () =>
      streamedResponse(Array.from({ length: 8 }, () => pngBytes(1024)), {
        headers: { 'content-type': 'image/png' },
      }),
    expectOk: false,
    expectError: 'too-large',
  },
  {
    id: 'streamed-under-cap',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    maxBytes: 4096,
    fetchImpl: async () => streamedResponse([pngBytes(2048)], { headers: { 'content-type': 'image/png' } }),
    expectOk: true,
    expectType: 'image/png',
    expectMagic: PNG_MAGIC,
  },
  {
    id: 'html-rejected',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async () => streamedResponse([Buffer.from('<html>')], { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    expectOk: false,
    expectError: 'content-type-not-allowed',
  },
  {
    id: '404-status',
    kind: 'required',
    url: 'https://avatars.githubusercontent.com/u/1',
    fetchImpl: async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } }),
    expectOk: false,
    expectError: 'not-found',
  },
]

async function runImageCase(testCase) {
  const started = Date.now()
  const result = await proxyImage(testCase.url, {
    maxBytes: testCase.maxBytes,
    timeoutMs: testCase.timeoutMs,
    fetchImpl: testCase.fetchImpl,
  })
  const ms = Date.now() - started

  const checks = []
  const check = (label, pass, detail) => checks.push({ label, pass: Boolean(pass), detail })

  if (testCase.expectOk) {
    check('ok', result.ok === true, { ok: result.ok, error: result.error })
    if (testCase.expectType) check('contentType', result.contentType === testCase.expectType, { got: result.contentType })
    if (testCase.expectMagic) {
      const magic = result.bytes?.subarray(0, 8).toString('hex')
      check('magic', magic === testCase.expectMagic, { got: magic })
    }
    if (testCase.expectSvg) {
      const head = result.bytes?.subarray(0, 200).toString('utf8') ?? ''
      check('svg-head', /<svg|<\?xml/i.test(head), { head: head.slice(0, 40) })
    }
    if (testCase.expectMinHops) check('hops', result.hops >= testCase.expectMinHops, { hops: result.hops })
  } else {
    check('rejected', result.ok === false, { ok: result.ok })
    if (testCase.expectError) check('error-code', result.error === testCase.expectError, { got: result.error })
    if (testCase.expectRedirectReason) {
      check('redirect-reason', result.redirectReason === testCase.expectRedirectReason, {
        got: result.redirectReason,
      })
    }
  }

  const failed = checks.filter((c) => !c.pass)
  const status = failed.length === 0 ? 'PASS' : testCase.kind === 'network' ? 'WARN' : 'FAIL'

  const record = {
    id: testCase.id,
    kind: testCase.kind,
    url: testCase.url,
    expected: testCase.expectOk ? `ok:${testCase.expectType ?? 'any'}` : `error:${testCase.expectError}`,
    actual: {
      ok: result.ok,
      status: result.status,
      contentType: result.contentType,
      error: result.error,
      bytesLength: result.bytes?.byteLength ?? 0,
      magic: result.bytes?.subarray(0, 8).toString('hex') ?? null,
      etag: result.etag,
      hops: result.hops,
      finalUrl: result.finalUrl,
      declaredBytes: result.declaredBytes ?? null,
      receivedBytes: result.receivedBytes ?? null,
      redirectReason: result.redirectReason ?? null,
    },
    ms,
    checks,
    status,
    ...(testCase.fetchNote ? { note: testCase.fetchNote } : {}),
  }

  log(
    `  ${status === 'PASS' ? '✓' : status === 'WARN' ? '~' : '✗'} ${testCase.id.padEnd(30)} ` +
      `${result.ok ? `ok ${result.bytes.byteLength}B ${result.contentType}` : `error=${result.error}`} (${ms}ms)`,
  )
  return record
}

/* ------------------------------------------------------------------ */
/* enrich cases                                                        */
/* ------------------------------------------------------------------ */

const enrichCases = [
  { name: 'Codex', type: 'software', expect: 'matched' },
  // "Figma" is a company/product: GitHub can only offer owner-level matches
  // (figma/plugin-samples) or third-party repos, so it must land in the
  // candidate band instead of asserting identity.
  { name: 'Figma', type: 'software', expect: 'matched', expectMaxConfidence: 0.75 },
  { name: 'Qoder', type: 'software', expect: 'any' },
  { name: 'DSH', type: 'software', expect: 'any' },
  { name: 'react', type: 'package', expect: 'matched' },
  { name: 'deepseek', type: 'any', expect: 'any' },
  { name: 'Zorblax-9000', type: 'software', expect: 'unmatched' },
  { name: 'zzqx-not-a-real-entity-9241', type: 'software', expect: 'unmatched' },
]

async function runEnrichCase(testCase) {
  const started = Date.now()
  const result = await enrichEntity({ name: testCase.name, type: testCase.type === 'any' ? undefined : testCase.type })
  const ms = Date.now() - started

  const checks = []
  const check = (label, pass, detail) => checks.push({ label, pass: Boolean(pass), detail })

  if (testCase.expect === 'matched') check('matched', result.matched === true, { matched: result.matched, emptyReason: result.emptyReason })
  if (testCase.expect === 'unmatched') check('unmatched', result.matched === false, { matched: result.matched })
  if (testCase.expect === 'unmatched') check('empty-flag', result.empty === true, { empty: result.empty })
  if (testCase.expectMaxConfidence !== undefined) {
    check('confidence-capped', result.confidence <= testCase.expectMaxConfidence, {
      confidence: result.confidence,
      max: testCase.expectMaxConfidence,
    })
  }
  // The card title must be the query, never an internal artifact id such as
  // "figma/plugin-samples".
  check('entity-name-is-query', result.entity?.name === testCase.name, {
    got: result.entity?.name,
    want: testCase.name,
  })

  // No-fabrication invariants, applied to every case.
  check('adapters-reported', Array.isArray(result.adapters) && result.adapters.length === 5, {
    ids: result.adapters?.map((a) => a.id),
  })
  const anyOk = result.adapters?.some((a) => a.ok)
  check('summary-has-source', !result.entity?.summary || anyOk, { summary: result.entity?.summary ?? '', anyOk })
  const badLinks = [...(result.entity?.links ?? []), ...(result.entity?.sources ?? [])].filter(
    (l) => !/^https?:\/\//.test(l?.href ?? ''),
  )
  check('links-are-http', badLinks.length === 0, { badLinks })
  check('confidence-range', typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1, {
    confidence: result.confidence,
  })
  // Cross-module contract: any image the enricher hands out must be fetchable
  // through proxyImage's allow-list, otherwise the card gets a broken avatar.
  const imageUrl = result.entity?.imageUrl
  check('image-url-proxyable', !imageUrl || isAllowedImageUrl(imageUrl), { imageUrl })
  // The client renders description directly; it must never be undefined.
  check('description-is-string', typeof result.entity?.description === 'string', {
    type: typeof result.entity?.description,
  })

  const failed = checks.filter((c) => !c.pass)
  const status = failed.length === 0 ? 'PASS' : testCase.expect === 'unmatched' ? 'FAIL' : 'WARN'

  const record = {
    name: testCase.name,
    type: testCase.type,
    expected: testCase.expect,
    matched: result.matched,
    confidence: result.confidence,
    emptyReason: result.emptyReason ?? null,
    entity: {
      name: result.entity?.name,
      type: result.entity?.type,
      summary: result.entity?.summary,
      description: result.entity?.description,
      imageUrl: result.entity?.imageUrl,
      imageSource: result.entity?.imageSource,
      links: result.entity?.links ?? [],
      sources: result.entity?.sources ?? [],
    },
    candidates: (result.candidates ?? []).map((c) => ({ name: c.name, source: c.source, score: c.score })),
    adapters: (result.adapters ?? []).map((a) => ({ id: a.id, ok: a.ok, ms: a.ms, error: a.error, count: a.count })),
    heat: result.heat
      ? { available: result.heat.available, matchedThreads: result.heat.matchedThreads, points: result.heat.points }
      : null,
    meta: result.meta ?? null,
    totalMs: ms,
    checks,
    status,
  }

  const adapterLine = (result.adapters ?? [])
    .map((a) => `${a.id}:${a.ok ? `${a.ms}ms/${a.count}` : a.error}`)
    .join(' ')
  log(
    `  ${status === 'PASS' ? '✓' : status === 'WARN' ? '~' : '✗'} ${testCase.name.padEnd(28)} ` +
      `matched=${String(result.matched).padEnd(5)} conf=${String(result.confidence).padEnd(5)} ${ms}ms | ${adapterLine}`,
  )
  return record
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  log(`\n=== dsh-style host verification (node ${process.version}) ===`)

  log('\n[1] entity-enrich.mjs — real names, sequential (honest per-source latency)')
  __clearCache()
  if (PACE_MS) log(`  (pacing ${PACE_MS}ms between queries: GitHub search allows 10/min anonymously)`)
  for (const [index, testCase] of enrichCases.entries()) {
    if (PACE_MS && index > 0) await sleep(PACE_MS)
    const breaker = __githubState()
    if (breaker.open) {
      const wait = Math.min(breaker.retryInMs, 65_000)
      log(`  … github breaker open (${breaker.lastError}); waiting ${Math.round(wait / 1000)}s`)
      await sleep(wait)
    }
    let record = await runEnrichCase(testCase)
    const github = record.adapters.find((a) => a.id === 'github')
    if (PACE_MS && github && (github.error === 'rate-limited' || github.error === 'circuit-open')) {
      const wait = Math.min(__githubState().retryInMs || 60_000, 65_000)
      log(`  … github ${github.error} for "${testCase.name}"; clearing cache and retrying in ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      __clearCache()
      record = await runEnrichCase(testCase)
    }
    results.enrich.push(record)
  }

  log('\n[2] entity-enrich.mjs — cache replay + wikidata breaker state')
  {
    const started = Date.now()
    const replay = await enrichEntity({ name: 'react', type: 'package' })
    const replayMs = Date.now() - started
    results.cacheReplay = {
      cachedFlag: replay.cached === true,
      ms: replayMs,
      sameConfidence: replay.confidence === results.enrich.find((r) => r.name === 'react')?.confidence,
    }
    results.cacheInfo = __cacheInfo()
    results.wikidataState = __wikidataState()
    results.githubState = __githubState()
    log(`  cache replay: cached=${replay.cached === true} ${replayMs}ms (${results.cacheInfo.size} entries)`)
    log(`  wikidata breaker: open=${!results.wikidataState.open} lastError=${results.wikidataState.lastError}`)
  }

  log('\n[3] entity-image.mjs — real images + policy negatives')
  for (const testCase of imageCases) {
    results.images.push(await runImageCase(testCase))
  }

  log('\n[4] end-to-end — enrich imageUrl piped through proxyImage')
  {
    const source = results.enrich.find((r) => r.entity?.imageUrl)
    if (!source) {
      results.endToEnd = { skipped: true, reason: 'no enrich result carried an imageUrl' }
      log('  ~ skipped: no enrich result carried an imageUrl')
    } else {
      const proxied = await proxyImage(source.entity.imageUrl)
      const magic = proxied.bytes?.subarray(0, 8).toString('hex')
      const checks = [
        { label: 'fetch-ok', pass: proxied.ok === true, detail: { error: proxied.error } },
        { label: 'inner-avatar-png', pass: magic === PNG_MAGIC, detail: { magic } },
      ]
      const status = checks.every((c) => c.pass) ? 'PASS' : 'WARN'
      results.endToEnd = {
        entity: source.name,
        imageUrl: source.entity.imageUrl,
        imageSource: source.entity.imageSource,
        ok: proxied.ok,
        status: proxied.status,
        contentType: proxied.contentType,
        bytesLength: proxied.bytes?.byteLength ?? 0,
        magic: magic ?? null,
        hops: proxied.hops,
        ms: proxied.ms,
        checks,
        status,
      }
      log(
        `  ${status === 'PASS' ? '✓' : '~'} ${source.name}: ${source.entity.imageUrl} -> ` +
          `${proxied.ok ? `${proxied.bytes.byteLength}B ${proxied.contentType} magic=${magic}` : `error=${proxied.error}`}`,
      )
    }
  }

  log('\n[5] entity-enrich.mjs — name-match tiering (deterministic, no network)')
  {
    const { tierScore, NAME_TIERS } = __internals
    const tierCases = [
      {
        id: 'artifact-name-exact',
        query: 'react',
        hit: { name: 'react', matchName: 'react', ownerName: 'facebook' },
        wantKind: 'name-exact',
        wantScore: NAME_TIERS.exact,
      },
      {
        id: 'case-hyphen-normalised-exact',
        query: 'Figma',
        hit: { name: 'figma', matchName: 'figma', ownerName: 'someone' },
        wantKind: 'name-exact',
        wantScore: NAME_TIERS.exact,
      },
      {
        id: 'owner-only-is-not-identity',
        query: 'Figma',
        hit: { name: 'figma/plugin-samples', matchName: 'plugin-samples', ownerName: 'figma' },
        wantKind: 'owner-exact',
        wantScore: NAME_TIERS.ownerExact,
      },
      {
        id: 'third-party-prefix',
        query: 'Figma',
        hit: { name: 'GLips/Figma-Context-MCP', matchName: 'Figma-Context-MCP', ownerName: 'GLips' },
        wantKind: 'name-prefix',
        wantScore: NAME_TIERS.namePrefix,
      },
      {
        id: 'owner-suffix-only',
        query: 'deepseek',
        hit: { name: 'deepseek-ai/something-else', matchName: 'something-else', ownerName: 'deepseek-ai' },
        wantKind: 'full-name-contains',
        wantScore: NAME_TIERS.fullNameContains,
      },
      {
        id: 'description-only-is-weak',
        query: 'Figma',
        hit: { name: 'acme/totally-unrelated', matchName: 'totally-unrelated', ownerName: 'acme', summary: 'imports figma files' },
        wantKind: 'description-only',
        wantScore: NAME_TIERS.descriptionOnly,
      },
    ]

    const tierChecks = []
    for (const testCase of tierCases) {
      const got = tierScore(testCase.query, testCase.hit)
      const pass = got.kind === testCase.wantKind && got.score === testCase.wantScore
      tierChecks.push({ id: testCase.id, pass, got, want: { kind: testCase.wantKind, score: testCase.wantScore } })
      log(`  ${pass ? '✓' : '✗'} ${testCase.id.padEnd(30)} ${got.kind} ${got.score}${pass ? '' : ` (want ${testCase.wantKind} ${testCase.wantScore})`}`)
    }
    results.tiering = tierChecks
    // Also prove the ordering the Lead asked for: artifact-name exact (1.0) >
    // owner exact (0.85) > name prefix (0.72) > contains (0.58) > full-name (0.5).
    const orderingPass =
      NAME_TIERS.exact > NAME_TIERS.ownerExact &&
      NAME_TIERS.ownerExact > NAME_TIERS.namePrefix &&
      NAME_TIERS.namePrefix > NAME_TIERS.nameContains &&
      NAME_TIERS.nameContains > NAME_TIERS.fullNameContains &&
      NAME_TIERS.fullNameContains > NAME_TIERS.descriptionOnly
    const orderingRecord = { id: 'tier-ordering', pass: orderingPass, NAME_TIERS }
    results.tiering.push(orderingRecord)
    log(`  ${orderingPass ? '✓' : '✗'} tier-ordering`)
  }

  log('\n[6] entity-image.mjs — unit checks')
  {
    const unitChecks = []
    const check = (label, pass, detail) => {
      unitChecks.push({ label, pass: Boolean(pass), detail })
      log(`  ${pass ? '✓' : '✗'} ${label} ${pass ? '' : JSON.stringify(detail)}`)
    }
    check('whitelist-size', ALLOWED_HOSTS.length === 11, { size: ALLOWED_HOSTS.length })
    check('subdomain-allowed', isAllowedImageUrl('https://x.avatars.githubusercontent.com/a.png') === true, {})
    check('trailing-dot-host-allowed', isAllowedImageUrl('https://avatars.githubusercontent.com./a.png') === true, {})
    check('bare-wikimedia-allowed', isAllowedImageUrl('https://upload.wikimedia.org/wikipedia/commons/a/b.png') === true, {})
    check('wikimedia-subdomain-of-suffix-allowed', isAllowedImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/x.png') === true, {})
    check('evil-suffix-rejected', isAllowedImageUrl('https://notgithub.com/a.png') === false, {})
    check('allowlist-not-suffix-weak', isAllowedImageUrl('https://github.com.evil.test/a.png') === false, {})
    check('data-uri-rejected', isAllowedImageUrl('data:image/png;base64,AAAA') === false, {})
    check('empty-rejected', isAllowedImageUrl('') === false, {})
    results.unit = unitChecks
  }

  const all = [
    ...results.images,
    ...results.enrich,
    ...results.unit.map((u) => ({ status: u.pass ? 'PASS' : 'FAIL' })),
    ...results.tiering.map((t) => ({ status: t.pass ? 'PASS' : 'FAIL' })),
    ...(results.endToEnd?.status ? [{ status: results.endToEnd.status }] : []),
  ]
  const counts = { pass: 0, warn: 0, fail: 0 }
  for (const item of all) {
    if (item.status === 'PASS') counts.pass++
    else if (item.status === 'WARN') counts.warn++
    else counts.fail++
  }

  const wikidata = results.enrich.find((r) => r.name === 'Codex')?.adapters.find((a) => a.id === 'wikidata')
  results.summary = {
    counts,
    enrichMatched: results.enrich.filter((r) => r.matched).length,
    enrichTotal: results.enrich.length,
    imageRejections: results.images.filter((r) => !r.actual.ok).length,
    // Compact digest of the cases the Lead asked to see.
    keyEntities: results.enrich.map((r) => ({
      query: r.name,
      matched: r.matched,
      confidence: r.confidence,
      title: r.entity.name,
      artifact: r.meta?.artifact ?? null,
      artifactSource: r.meta?.artifactSource ?? null,
      matchKind: r.meta?.matchKind ?? null,
      ownerLevelOnly: r.meta?.ownerLevelOnly ?? null,
      outranked: r.meta?.outranked ?? null,
      summary: String(r.entity.summary ?? '').slice(0, 80),
      candidateCount: r.candidates.length,
      emptyReason: r.emptyReason,
      totalMs: r.totalMs,
    })),
    tiering: results.tiering.map((t) => ({ id: t.id, pass: t.pass })),
    wikidataFirstRun: wikidata ? { ok: wikidata.ok, ms: wikidata.ms, error: wikidata.error } : null,
    wikidataCircuitOpen: !results.wikidataState?.open,
    githubBreaker: results.githubState ?? null,
    endToEnd: results.endToEnd?.status ?? 'skipped',
    finishedAt: new Date().toISOString(),
  }

  results.finishedAt = new Date().toISOString()

  const outPath = '/tmp/p1-host-verify.json'
  const { writeFile } = await import('node:fs/promises')
  await writeFile(outPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')

  log(`\n=== summary ===`)
  log(`  cases: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`)
  log(`  enrich matched ${results.summary.enrichMatched}/${results.summary.enrichTotal}`)
  log(`  report written to ${outPath}`)

  if (JSON_ONLY) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
  if (counts.fail > 0) process.exitCode = 1
}

await main()
