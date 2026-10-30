/**
 * dsh-style host half — entity enrichment.
 *
 * Turns a bare name (e.g. "Codex", "Figma") into a *sourced* card. Every string
 * that reaches the UI comes from a response field of one of the adapters below;
 * nothing is generated, paraphrased or inferred from the model. When the sources
 * do not corroborate a name the result says so (`matched: false`, `emptyReason`).
 *
 * Design constraints (learned from Phase 0 measurement on this machine):
 *   - Entities are resolved by racing independent adapters, each with its own
 *     2.5s budget. A slow or dead source must never hold the card back.
 *   - www.wikidata.org / *.wikipedia.org frequently hang here (>8s). Wikidata is
 *     therefore strictly optional: hard 2.5s deadline, and a process-wide
 *     circuit breaker that stops trying for 10 minutes after one failure.
 *   - Results are cached for 30 minutes keyed by `name.toLowerCase()|type` so a
 *     chatty client does not burn the anonymous GitHub quota (60 req/h).
 *
 * Public API:
 *   enrichEntity({ name, type, context, signal }) -> EnrichResult
 *   __clearCache() -> void
 *   __cacheInfo() -> { size, entries }
 *   __wikidataState() -> { open, retryInMs, lastError }
 */

const CACHE_TTL_MS = 30 * 60 * 1000
const DEFAULT_BUDGET_MS = 2500
const WIKIDATA_BUDGET_MS = 2500
const WIKIDATA_COOLDOWN_MS = 10 * 60 * 1000
const GITHUB_PER_PAGE = 5
const NPM_PAGE_SIZE = 5
const HN_HITS = 3
const MAX_CANDIDATES = 5

const USER_AGENT = 'dsh-style-host/0.1 (+https://github.com/deepseek/dsh-style)'

const GITHUB_API = 'https://api.github.com'
const NPM_API = 'https://registry.npmjs.org'
const PYPI_API = 'https://pypi.org'
const HN_API = 'https://hn.algolia.com/api/v1'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

/** Per-source trust weight used in the final score. */
const SOURCE_WEIGHT = { github: 1.0, npm: 0.95, pypi: 0.9, wikidata: 0.85 }

const SOFTWARE_TYPES = new Set([
  'software', 'package', 'library', 'lib', 'repo', 'repository', 'project',
  'tool', 'tech', 'technology', 'framework', 'app', 'application', 'cli',
  'sdk', 'plugin', 'extension', 'language', 'spec', 'devtool', 'service',
])

const PERSON_TYPES = new Set(['person', 'people', 'human', 'author', 'developer', 'maintainer'])

/* ------------------------------------------------------------------ *
 * generic helpers
 * ------------------------------------------------------------------ */

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
const round3 = (n) => Math.round(n * 1000) / 1000

function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Case/diacritic/separator-insensitive form used for all name comparisons. */
function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s\-_.·]+/g, '')
}

function normalizeTypeToken(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function hasCJK(value) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(value ?? ''))
}

/** Only http(s) survives — source fields are untrusted. */
function safeHref(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/** `git+https://github.com/a/b.git` -> `https://github.com/a/b` */
function cleanRepoUrl(value) {
  const href = safeHref(String(value ?? '').replace(/^git\+/, '').replace(/\.git$/, ''))
  return href
}

const firstNonEmpty = (...values) => values.find((v) => typeof v === 'string' && v.trim() !== '') ?? ''

/* ------------------------------------------------------------------ *
 * deadline plumbing
 * ------------------------------------------------------------------ */

class AdapterError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'AdapterError'
    this.code = code
  }
}

/**
 * Composes the caller signal with an independent per-adapter budget.
 * Aborts with an AdapterError so the failure reason survives the AbortSignal.
 */
function makeDeadline(parentSignal, ms) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new AdapterError('timeout', `timed out after ${ms}ms`))
  }, ms)

  const onAbort = () => controller.abort(new AdapterError('aborted', 'caller aborted'))
  if (parentSignal) {
    if (parentSignal.aborted) onAbort()
    else parentSignal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut
    },
    clear() {
      clearTimeout(timer)
      if (parentSignal) parentSignal.removeEventListener('abort', onAbort)
    },
  }
}

function reasonOf(error, signal) {
  if (error instanceof AdapterError) return error
  const reason = signal?.aborted ? signal.reason : null
  if (reason instanceof AdapterError) return reason
  if (signal?.aborted) return new AdapterError('timeout', 'aborted')
  return new AdapterError('network', String(error?.message ?? error))
}

async function readJson(response) {
  try {
    return await response.json()
  } catch (error) {
    throw new AdapterError('bad-json', `invalid JSON payload: ${error?.message ?? error}`)
  }
}

/** One GET returning parsed JSON, with source-appropriate error classification. */
async function httpJson(url, { signal, headers = {} } = {}) {
  let response
  try {
    response = await fetch(url, {
      signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json',
        ...headers,
      },
    })
  } catch (error) {
    throw reasonOf(error, signal)
  }

  if (response.status === 404) {
    try {
      await response.body?.cancel()
    } catch {
      /* body already consumed */
    }
    throw new AdapterError('http-404', 'not found')
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    try {
      await response.body?.cancel()
    } catch {
      /* ignore */
    }
    const code = remaining === '0' ? 'rate-limited' : `http-${response.status}`
    throw new AdapterError(code, `HTTP ${response.status}`)
  }

  if (!response.ok) {
    try {
      await response.body?.cancel()
    } catch {
      /* ignore */
    }
    throw new AdapterError(`http-${response.status}`, `HTTP ${response.status}`)
  }

  const json = await readJson(response)
  return { json, status: response.status, headers: response.headers }
}

/* ------------------------------------------------------------------ *
 * adapters — each returns { hits?, signals? }
 * ------------------------------------------------------------------ */

/**
 * Full-name match score for a query against one candidate string.
 * Ordering per spec: exact > case/separator-normalised exact > prefix > contains.
 */
function nameScore(query, candidate) {
  if (!candidate) return 0
  const q = String(query).trim()
  const c = String(candidate).trim()
  if (!q || !c) return 0
  if (c === q) return 1
  const qn = normalizeName(q)
  const cn = normalizeName(c)
  if (!qn || !cn) return 0
  if (cn === qn) return 0.92
  // Prefix: "react" -> "react-dom"; also raw lowercase prefix.
  if (cn.startsWith(qn) || c.toLowerCase().startsWith(q.toLowerCase())) return 0.78
  if (qn.length >= 3 && cn.includes(qn)) return 0.6
  // Candidate is a prefix of the query ("React Hooks" -> "react").
  if (cn.length >= 3 && qn.startsWith(cn)) return 0.5
  return 0.2
}

/**
 * The name score for a hit considers its own display name, the repo leaf name
 * and (for GitHub) the owner login — an org named exactly after the entity is a
 * strong "this is the project's home" signal, but weaker than the artifact name.
 */
function hitNameScore(query, hit) {
  const primary = nameScore(query, hit.matchName || hit.name)
  const display = nameScore(query, hit.name)
  const ownerScore = hit.ownerName ? nameScore(query, hit.ownerName) : 0
  const score = Math.max(primary, display * 0.97, ownerScore * 0.97)
  // "figma/..." where the org is literally `figma` beats "GLips/Figma-Context-MCP".
  const ownerExact = ownerScore >= 0.92
  return { score, ownerExact }
}

/** A hit must be recognisably *about* the query, otherwise it is noise. */
function isRelevant(query, hit) {
  const { score, ownerExact } = hitNameScore(query, hit)
  return score >= 0.5 || ownerExact
}

async function githubAdapter({ name, signal }) {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(name)}&per_page=${GITHUB_PER_PAGE}`
  const { json } = await httpJson(url, { signal })
  const items = Array.isArray(json?.items) ? json.items : []
  const hits = []

  for (const item of items) {
    const fullName = firstNonEmpty(item?.full_name)
    if (!fullName) continue
    const slash = fullName.indexOf('/')
    const leaf = slash >= 0 ? fullName.slice(slash + 1) : fullName
    const owner = firstNonEmpty(item?.owner?.login)
    const stars = Number(item?.stargazers_count) || 0
    const description = firstNonEmpty(item?.description)

    const links = [{ label: 'GitHub', href: safeHref(item?.html_url) }]
    const homepage = safeHref(item?.homepage)
    if (homepage) links.push({ label: 'Homepage', href: homepage })

    hits.push({
      source: 'github',
      name: fullName,
      matchName: leaf,
      ownerName: owner || null,
      repoFullNames: [fullName.toLowerCase()],
      summary: clip(description, 200),
      description: clip(description, 400),
      imageUrl: safeHref(item?.owner?.avatar_url),
      imageSource: 'github',
      popularity: clamp01(Math.log10(1 + stars) / 5),
      stars,
      links: links.filter((l) => l.href),
      sources: [{ label: 'GitHub', href: safeHref(item?.html_url) }].filter((l) => l.href),
      meta: {
        stars,
        language: firstNonEmpty(item?.language) || null,
        license: firstNonEmpty(item?.license?.spdx_id) || null,
        topics: Array.isArray(item?.topics) ? item.topics.slice(0, 8) : [],
        archived: item?.archived === true,
        ownerType: firstNonEmpty(item?.owner?.type) || null,
        forks: Number(item?.forks_count) || 0,
      },
    })
  }

  return { hits }
}

async function npmAdapter({ name, signal }) {
  const url = `${NPM_API}/-/v1/search?text=${encodeURIComponent(name)}&size=${NPM_PAGE_SIZE}`
  const { json } = await httpJson(url, { signal })
  const objects = Array.isArray(json?.objects) ? json.objects : []
  const hits = []

  for (const entry of objects) {
    const pkg = entry?.package
    const pkgName = firstNonEmpty(pkg?.name)
    if (!pkgName) continue
    const monthly = Number(entry?.downloads?.monthly) || 0
    const description = firstNonEmpty(pkg?.description)
    const npmPage = safeHref(pkg?.links?.npm) || `https://www.npmjs.com/package/${pkgName}`

    const links = [{ label: 'npm', href: npmPage }]
    const repo = cleanRepoUrl(pkg?.links?.repository)
    if (repo) links.push({ label: 'Repository', href: repo })
    const homepage = safeHref(pkg?.links?.homepage)
    if (homepage) links.push({ label: 'Homepage', href: homepage })

    hits.push({
      source: 'npm',
      name: pkgName,
      matchName: pkgName,
      ownerName: firstNonEmpty(pkg?.publisher?.username) || null,
      repoFullNames: [githubRepoFullName(pkg?.links?.repository)].filter(Boolean),
      summary: clip(description, 200),
      description: clip(description, 400),
      imageUrl: null,
      imageSource: null,
      popularity: clamp01(Math.log10(1 + monthly) / 9),
      links,
      sources: [{ label: 'npm', href: npmPage }],
      meta: {
        version: firstNonEmpty(pkg?.version) || null,
        publisher: firstNonEmpty(pkg?.publisher?.username) || null,
        monthlyDownloads: monthly,
        license: firstNonEmpty(pkg?.license) || null,
        date: firstNonEmpty(pkg?.date) || null,
      },
    })
  }

  return { hits }
}

/** PEP 503 normalisation — PyPI resolves names case-insensitively but the path must be clean. */
function normalizePypiName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-_.]+/g, '-')
}

async function pypiAdapter({ name, signal }) {
  const normalized = normalizePypiName(name)
  if (!normalized || !/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    // Not a valid distribution name: skip the request entirely (404 is certain).
    return { hits: [] }
  }
  // Exact-name lookup by contract: a 404 means "no such package", not an error.
  let json
  try {
    ;({ json } = await httpJson(`${PYPI_API}/pypi/${encodeURIComponent(normalized)}/json`, { signal }))
  } catch (error) {
    if (error?.code === 'http-404') return { hits: [] }
    throw error
  }

  const info = json?.info
  const pkgName = firstNonEmpty(info?.name)
  if (!pkgName) return { hits: [] }

  const summary = firstNonEmpty(info?.summary)
  const links = []
  const projectUrl = safeHref(info?.package_url) || `https://pypi.org/project/${pkgName}/`
  const homePage = safeHref(info?.home_page)
  if (homePage) links.push({ label: 'Homepage', href: homePage })
  const repoCandidates = []
  const claimRepo = (value) => {
    const fullName = githubRepoFullName(value)
    if (fullName && !repoCandidates.includes(fullName)) repoCandidates.push(fullName)
  }
  claimRepo(info?.home_page)
  if (info?.project_urls && typeof info.project_urls === 'object') {
    for (const [label, href] of Object.entries(info.project_urls)) {
      const safe = safeHref(href)
      if (safe && !links.some((l) => l.href === safe)) links.push({ label: clip(label, 40) || 'Project', href: safe })
      claimRepo(href)
    }
  }

  return {
    hits: [
      {
        source: 'pypi',
        name: pkgName,
        matchName: pkgName,
        ownerName: null,
        repoFullNames: repoCandidates,
        summary: clip(summary, 200),
        description: clip(summary, 400),
        imageUrl: null,
        imageSource: null,
        // PyPI's JSON carries no download count, so presence alone is neutral.
        popularity: 0.45,
        links: [{ label: 'PyPI', href: projectUrl }, ...links],
        sources: [{ label: 'PyPI', href: projectUrl }],
        meta: {
          version: firstNonEmpty(info?.version) || null,
          requiresPython: firstNonEmpty(info?.requires_python) || null,
          license: firstNonEmpty(info?.license) || null,
        },
      },
    ],
  }
}

/** HN only contributes heat; it never produces a card on its own. */
async function hackerNewsAdapter({ name, signal }) {
  const url = `${HN_API}/search?query=${encodeURIComponent(name)}&hitsPerPage=${HN_HITS}`
  const { json } = await httpJson(url, { signal })
  const rawHits = Array.isArray(json?.hits) ? json.hits : []
  let points = 0
  let comments = 0
  let top = null

  for (const hit of rawHits) {
    const title = firstNonEmpty(hit?.title, hit?.story_title)
    if (!title) continue
    // Only threads whose title actually names the entity count towards heat.
    if (nameScore(name, title) < 0.5) continue
    const p = Number(hit?.points) || 0
    const c = Number(hit?.num_comments) || 0
    points += p
    comments += c
    if (!top || p > (Number(top.points) || 0)) {
      top = {
        title: clip(title, 120),
        points: p,
        comments: c,
        href: safeHref(hit?.url) || `https://news.ycombinator.com/item?id=${hit?.objectID ?? ''}`,
        createdAt: firstNonEmpty(hit?.created_at) || null,
      }
    }
  }

  const matchedThreads = rawHits.filter((h) => nameScore(name, firstNonEmpty(h?.title, h?.story_title)) >= 0.5).length
  return {
    signals: {
      available: matchedThreads > 0,
      matchedThreads,
      points,
      comments,
      top: matchedThreads > 0 ? top : null,
      // Popularity scale: a few thousand points is a genuinely hot topic.
      score: clamp01(Math.log10(1 + points + comments * 2) / 3.5),
    },
  }
}

/* --------------------------- wikidata --------------------------- */

const wikidataState = { disabledUntil: 0, lastError: null, lastFailedAt: 0 }

function wikidataOpen() {
  return Date.now() >= wikidataState.disabledUntil
}

function tripWikidata(error) {
  wikidataState.disabledUntil = Date.now() + WIKIDATA_COOLDOWN_MS
  wikidataState.lastFailedAt = Date.now()
  wikidataState.lastError = error?.code ?? String(error?.message ?? error)
}

function commonsImageUrl(filename, width = 256) {
  if (!filename) return null
  // Special:FilePath redirects to upload.wikimedia.org — both hosts are on the
  // image proxy allow-list, so the two-hop fetch is expected to work.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`
}

async function wikidataAdapter({ name, signal }) {
  if (!wikidataOpen()) {
    throw new AdapterError('circuit-open', `wikidata cooling down for ${Math.ceil((wikidataState.disabledUntil - Date.now()) / 1000)}s`)
  }

  try {
    const search = (language) => {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: name,
        language,
        uselang: language,
        limit: '3',
        format: 'json',
        origin: '*',
      })
      return httpJson(`${WIKIDATA_API}?${params}`, { signal })
    }

    const settled = await Promise.allSettled([search('zh'), search('en')])
    const findings = new Map()

    let anyOk = false
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue
      anyOk = true
      const list = outcome.value.json?.search
      if (!Array.isArray(list)) continue
      for (const item of list) {
        if (!item?.id || findings.has(item.id)) continue
        findings.set(item.id, {
          id: item.id,
          label: firstNonEmpty(item.label, item.match?.text, item.id),
          description: firstNonEmpty(item.description),
          aliases: Array.isArray(item.aliases) ? item.aliases : [],
          url: safeHref(item.concepturi) || `https://www.wikidata.org/wiki/${item.id}`,
        })
      }
    }

    if (!anyOk) {
      // Both language probes failed: this is the flaky path, open the breaker.
      const failure = settled.find((s) => s.status === 'rejected')
      throw failure?.reason ?? new AdapterError('network', 'wikidata search failed')
    }
    if (findings.size === 0) return { hits: [] }

    // Resolve P18 (image) for the top few ids in one request.
    const ids = [...findings.keys()].slice(0, 3)
    let images = new Map()
    try {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: ids.join('|'),
        props: 'claims',
        format: 'json',
        origin: '*',
      })
      const { json } = await httpJson(`${WIKIDATA_API}?${params}`, { signal })
      const entities = json?.entities ?? {}
      for (const [id, entity] of Object.entries(entities)) {
        const claim = entity?.claims?.P18?.[0]
        const filename = claim?.mainsnak?.datavalue?.value
        if (typeof filename === 'string' && filename) {
          images.set(id, commonsImageUrl(filename))
        }
      }
    } catch (error) {
      // An image failure must not discard the label/description facts.
      if (error?.code === 'timeout' || error?.code === 'aborted') throw error
      images = new Map()
    }

    const hits = [...findings.values()].map((item) => {
      const link = [{ label: 'Wikidata', href: item.url }]
      return {
        source: 'wikidata',
        name: item.label,
        matchName: item.label,
        ownerName: null,
        repoFullNames: [],
        summary: clip(item.description, 200),
        description: clip(firstNonEmpty(item.description, item.aliases.join(', ')), 400),
        imageUrl: images.get(item.id) ?? null,
        imageSource: images.has(item.id) ? 'wikidata' : null,
        popularity: 0.35,
        links: link,
        sources: link,
        meta: { qid: item.id, aliases: item.aliases.slice(0, 6) },
      }
    })

    return { hits }
  } catch (error) {
    // "失败即熔断": any wikidata failure parks the adapter for 10 minutes.
    tripWikidata(error)
    throw error
  }
}

/* ------------------------------------------------------------------ *
 * scoring / disambiguation
 * ------------------------------------------------------------------ */

function typeBonusFor(type, source) {
  const token = normalizeTypeToken(type)
  const isSoftwareSource = source === 'github' || source === 'npm' || source === 'pypi'
  if (!token) return 0.7
  if (SOFTWARE_TYPES.has(token)) return isSoftwareSource ? 1 : 0.6
  if (PERSON_TYPES.has(token)) return source === 'wikidata' ? 1 : 0.35
  return isSoftwareSource ? 0.8 : 0.7
}

function contextMatches(context, hit) {
  const text = String(context ?? '').toLowerCase()
  if (!text) return false
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)
  if (tokens.length === 0) return false
  const haystack = `${hit.name} ${hit.summary} ${hit.meta?.topics?.join(' ') ?? ''}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token))
}

function scoreHit(hit, { name, type, context, heat }) {
  const { score: nameScoreValue, ownerExact } = hitNameScore(name, hit)
  const reliability = SOURCE_WEIGHT[hit.source] ?? 0.8
  let score =
    0.6 * nameScoreValue +
    0.22 * (hit.popularity ?? 0) +
    0.1 * reliability +
    0.08 * typeBonusFor(type, hit.source)

  // An org/owner named exactly after the entity is the canonical home of it.
  if (ownerExact) score += 0.05
  // A Chinese-language description is a meaningful "this is the entity you mean"
  // signal for zh-facing users.
  if (hasCJK(hit.summary) || hasCJK(hit.name)) score += 0.02
  // HN threads only amplify already-plausible candidates.
  if (heat?.available && nameScoreValue >= 0.78) score += 0.03
  if (contextMatches(context, hit)) score += 0.04

  return { score: clamp01(score), nameScore: nameScoreValue, ownerExact }
}

/**
 * Extracts `owner/repo` from a GitHub URL. This is the *only* evidence we accept
 * that two records from different registries describe one project: an npm/PyPI
 * record that points at github.com/owner/repo, and a GitHub repo with that exact
 * full name. Matching on the bare name is not enough — PyPI's `codex` is a comic
 * reader while GitHub's `openai/codex` is a coding agent.
 */
function githubRepoFullName(value) {
  const href = safeHref(String(value ?? '').replace(/^git\+/, '').replace(/\.git$/, ''))
  if (!href) return null
  try {
    const url = new URL(href)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return `${parts[0]}/${parts[1]}`.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Groups the scored hits into entities. Hits are merged **only** when a shared
 * `owner/repo` GitHub URL proves they are the same project; same-name records
 * from different registries stay separate and become switchable candidates.
 */
function buildGroups(scored) {
  const parent = scored.map((_, index) => index)

  const find = (index) => {
    let root = index
    while (parent[root] !== root) root = parent[root]
    while (parent[index] !== root) {
      const next = parent[index]
      parent[index] = root
      index = next
    }
    return root
  }

  const union = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  // owner/repo -> indexes of hits that claim it.
  const repoClaims = new Map()
  scored.forEach((item, index) => {
    for (const repo of item.hit.repoFullNames ?? []) {
      if (!repoClaims.has(repo)) repoClaims.set(repo, [])
      repoClaims.get(repo).push(index)
    }
  })
  for (const indexes of repoClaims.values()) {
    for (let i = 1; i < indexes.length; i++) union(indexes[0], indexes[i])
  }

  const buckets = new Map()
  scored.forEach((item, index) => {
    const root = find(index)
    if (!buckets.has(root)) buckets.set(root, [])
    buckets.get(root).push(item)
  })

  return [...buckets.values()].map((items) => {
    const primary = items.reduce((best, item) => (item.score > best.score ? item : best), items[0])
    const links = []
    const sources = []
    for (const item of items) {
      for (const link of item.hit.links ?? []) {
        if (link?.href && !links.some((l) => l.href === link.href)) links.push(link)
      }
      for (const source of item.hit.sources ?? []) {
        if (source?.href && !sources.some((s) => s.href === source.href)) sources.push(source)
      }
    }

    const imageItem = items.find((item) => item.hit.imageUrl) ?? null
    const summaryItem = items.find((item) => item.hit.summary) ?? primary
    const descriptionItem = items.find((item) => item.hit.description) ?? summaryItem
    const stars = Math.max(0, ...items.map((item) => item.hit.stars ?? 0))

    return {
      key: primary.hit.repoFullNames?.[0] ?? `${primary.hit.source}:${normalizeName(primary.hit.name)}`,
      source: primary.hit.source,
      sourcesSeen: [...new Set(items.map((item) => item.hit.source))],
      name: primary.hit.name,
      summary: summaryItem.hit.summary || '',
      description: descriptionItem.hit.description || summaryItem.hit.summary || '',
      imageUrl: imageItem?.hit.imageUrl ?? null,
      imageSource: imageItem?.hit.imageSource ?? null,
      links,
      sources,
      score: primary.score,
      nameScore: primary.nameScore,
      meta: primary.hit.meta ?? null,
      stars,
    }
  })
}

const EMPTY_ENTITY = Object.freeze({
  name: '',
  type: null,
  summary: '',
  description: '',
  imageUrl: null,
  imageSource: null,
  links: [],
  sources: [],
})

function emptyEntity(name, type) {
  return { ...EMPTY_ENTITY, name: String(name ?? '').trim(), type: type ?? null, links: [], sources: [] }
}

/* ------------------------------------------------------------------ *
 * cache
 * ------------------------------------------------------------------ */

const cache = new Map() // key -> { expiresAt, value }

function cacheKey(name, type) {
  return `${String(name ?? '').toLowerCase().trim()}|${String(type ?? '').toLowerCase().trim()}`
}

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function cacheSet(key, value) {
  // Opportunistic sweep so a long-lived host process cannot grow unbounded.
  if (cache.size > 200) {
    const now = Date.now()
    for (const [k, entry] of cache) if (entry.expiresAt <= now) cache.delete(k)
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
}

/** Drops every cached enrichment. */
export function __clearCache() {
  cache.clear()
}

/** Diagnostics for the verification script / a future settings page. */
export function __cacheInfo() {
  return { size: cache.size, ttlMs: CACHE_TTL_MS, keys: [...cache.keys()] }
}

export function __wikidataState() {
  const open = wikidataOpen()
  return {
    open,
    retryInMs: open ? 0 : Math.max(0, wikidataState.disabledUntil - Date.now()),
    lastError: wikidataState.lastError,
    lastFailedAt: wikidataState.lastFailedAt,
  }
}

/* ------------------------------------------------------------------ *
 * public entry point
 * ------------------------------------------------------------------ */

/**
 * @param {object} input
 * @param {string} input.name      Bare entity name, e.g. "Codex".
 * @param {string} [input.type]    Hint: "software" | "package" | "person" | ...
 * @param {string} [input.context] Surrounding message; only ever used as a
 *                                 tie-breaker (+0.04), never as a fact source.
 * @param {AbortSignal} [input.signal]
 * @param {number} [input.timeoutMs]        Override the 2500ms per-source budget.
 * @param {Record<string, number>} [input.adapterTimeoutMs] Per-adapter override.
 * @returns {Promise<object>} EnrichResult
 */
export async function enrichEntity(input = {}) {
  const name = String(input.name ?? '').trim()
  const type = input.type == null || String(input.type).trim() === '' ? null : String(input.type).trim()
  const context = input.context == null ? '' : String(input.context)
  const signal = input.signal

  if (!name) {
    return {
      ok: false,
      matched: false,
      confidence: 0,
      entity: emptyEntity('', type),
      candidates: [],
      adapters: [],
      empty: true,
      emptyReason: 'missing-name',
      error: 'missing-name',
    }
  }

  const key = cacheKey(name, type)
  const cached = cacheGet(key)
  if (cached) return { ...cached, cached: true }

  const baseBudget = Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : DEFAULT_BUDGET_MS
  const budgetFor = (id) => {
    const override = input.adapterTimeoutMs?.[id]
    if (Number(override) > 0) return Number(override)
    return id === 'wikidata' ? Math.min(baseBudget, WIKIDATA_BUDGET_MS) : baseBudget
  }

  const specs = [
    ['github', githubAdapter],
    ['npm', npmAdapter],
    ['pypi', pypiAdapter],
    ['hn', hackerNewsAdapter],
    ['wikidata', wikidataAdapter],
  ]

  const adapters = []
  const hits = []
  let heat = null
  let aborted = false

  const runOne = async ([id, adapter]) => {
    const startedAt = performance.now()
    const budget = budgetFor(id)
    const deadline = makeDeadline(signal, budget)
    const record = { id, ok: false, ms: 0, error: null, count: 0 }
    try {
      const out = await adapter({ name, signal: deadline.signal })
      record.ok = true
      const produced = Array.isArray(out?.hits) ? out.hits : []
      record.count = produced.length
      for (const hit of produced) {
        if (isRelevant(name, hit)) hits.push(hit)
      }
      if (out?.signals) heat = out.signals
      if (out?.signals?.available) record.count = out.signals.matchedThreads ?? 0
    } catch (error) {
      const normalized = reasonOf(error, deadline.signal)
      record.ok = false
      record.error = normalized.code ?? 'network'
      if (record.error === 'aborted') aborted = true
    } finally {
      record.ms = Math.round(performance.now() - startedAt)
      deadline.clear()
      adapters.push(record)
    }
  }

  // Fully parallel: the slowest adapter sets the ceiling, not the sum.
  await Promise.all(specs.map(runOne))
  adapters.sort((a, b) => specs.findIndex(([id]) => id === a.id) - specs.findIndex(([id]) => id === b.id))

  const scoringContext = { name, type, context, heat }
  const scored = hits.map((hit) => {
    const { score, nameScore: ns } = scoreHit(hit, scoringContext)
    return { hit, score: round3(score), nameScore: round3(ns) }
  })

  const merged = buildGroups(scored).sort((a, b) => b.score - a.score)
  const anyAdapterOk = adapters.some((a) => a.ok)

  if (merged.length === 0) {
    const emptyReason = aborted ? 'aborted' : anyAdapterOk ? 'no-hits' : 'no-sources'
    const result = {
      ok: true,
      matched: false,
      confidence: 0,
      entity: emptyEntity(name, type),
      candidates: [],
      adapters,
      empty: true,
      emptyReason,
      heat,
    }
    // Only memoise a genuine "no such entity" answer, never a total network wipeout.
    if (anyAdapterOk && !aborted) cacheSet(key, result)
    return result
  }

  const top = merged[0]
  const runnerUp = merged[1]
  let confidence = top.score

  // Ambiguity: two different entities scored almost identically. Per contract we
  // still answer, but cap confidence so the client offers the switcher.
  const ambiguous = Boolean(runnerUp && top.score - runnerUp.score < 0.05 && runnerUp.key !== top.key)
  if (ambiguous) confidence = Math.min(confidence, 0.74)

  const matched = confidence >= 0.45
  const candidates = matched
    ? merged
        .slice(1, 1 + MAX_CANDIDATES)
        .filter((c) => c.score >= 0.4)
        .map((c) => ({
          name: c.name,
          source: c.source,
          score: round3(c.score),
          summary: c.summary || '',
          imageUrl: c.imageUrl || null,
          links: c.links ?? [],
        }))
    : []

  const entity = {
    name: top.name,
    type: type ?? (top.source === 'wikidata' ? 'entity' : 'software'),
    summary: top.summary || '',
    description: top.description || top.summary || '',
    imageUrl: top.imageUrl || null,
    imageSource: top.imageUrl ? top.imageSource : null,
    links: top.links ?? [],
    sources: top.sources ?? [],
  }

  const result = {
    ok: true,
    matched,
    confidence: round3(confidence),
    entity,
    candidates,
    adapters,
    heat,
    ...(matched ? {} : { empty: true, emptyReason: 'low-confidence' }),
    // Extra diagnostics (ignored by a client that only reads the spec fields).
    meta: {
      sourcesSeen: top.sourcesSeen,
      ambiguity: ambiguous,
      runnerUp: runnerUp ? { name: runnerUp.name, source: runnerUp.source, score: round3(runnerUp.score) } : null,
      stars: top.stars || 0,
      namedScore: top.nameScore,
    },
  }

  if (anyAdapterOk && !aborted) cacheSet(key, result)
  return result
}

export const __internals = {
  nameScore,
  normalizeName,
  normalizePypiName,
  hitNameScore,
  githubRepoFullName,
  buildGroups,
  scoreHit,
  commonsImageUrl,
  CACHE_TTL_MS,
  WIKIDATA_COOLDOWN_MS,
  DEFAULT_BUDGET_MS,
  SOURCE_WEIGHT,
}
