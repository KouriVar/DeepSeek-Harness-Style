// dsh-style — host half.
//
// 历史：这个宿主入口过去是空壳（插件是纯客户端外观插件）。
// Phase 1 起，它承担「实体详情」的宿主侧能力：
//   GET  /api/style-entity/ping     客户端能力探测
//   POST /api/style-entity/extract  用 ctx.llm 抽取实体（空结果重试 + 原文偏移回填）
//   POST /api/style-entity/enrich   查资料（委托 host/entity-enrich.mjs）
//   GET  /api/style-entity/image    受限图片代理（委托 host/entity-image.mjs）
//
// 约束：
//  · 不改 DSH 主程序；只用公开服务（connection / web / llm）注册路由。
//  · 任一宿主服务缺失时插件仍能加载，只是路由不注册（客户端会优雅降级）。
//  · 路由全部挂在 /api 下，认证由连接层继承（非 owner 自动被拒）。
//  · 外观设置的持久化仍在浏览器 localStorage，未迁移到 host settings。

export const name = 'dsh-style'

const SYSTEM_PROMPT = [
  '你是实体识别器。只输出 JSON，不要解释、不要 markdown 围栏。',
  '格式：{"entities":[{"name":"规范名","type":"类型","quote":"原文逐字片段"}]}',
  '规则：',
  '1. quote 必须是原文中连续、逐字出现的子串；不得改写、不得补空格、不得翻译、不得加引号。',
  '2. 只抽取原文真实出现的实体；没有就返回 {"entities":[]}。',
  '3. type 取 软件/产品/公司/人物/地点/技术项目/其他 之一。',
  '4. 最多 12 个，优先信息量最大的；代码标识符（如 ctx.llm）算技术项目。',
].join('\n')

const CACHE = new Map()
const CACHE_MAX = 400
const CACHE_TTL = 30 * 60 * 1000
let HOST_MODULES = null

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function cacheGet(key) {
  const hit = CACHE.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL) { CACHE.delete(key); return null }
  return hit.value
}
function cacheSet(key, value) {
  CACHE.set(key, { value, at: Date.now() })
  while (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value)
}

// 偏移绝不由模型给出：模型只给 quote，这里在原文里定位并断言切片相等。
// 单位是 UTF-16 code unit（与 JS 字符串索引、DOM Range 一致）。
function backfillOffsets(text, items) {
  const out = []
  const used = []
  for (const item of Array.isArray(items) ? items : []) {
    const quote = String((item && (item.quote || item.name)) || '')
    if (!quote) { out.push({ ...item, ok: false, reason: 'empty-quote' }); continue }
    let from = 0
    let start = -1
    while (from <= text.length) {
      const at = text.indexOf(quote, from)
      if (at < 0) break
      const clash = used.some((u) => at < u.end && at + quote.length > u.start)
      if (!clash) { start = at; break }
      from = at + 1
    }
    if (start < 0) { out.push({ ...item, ok: false, reason: 'quote-not-found' }); continue }
    const end = start + quote.length
    const slice = text.slice(start, end)
    used.push({ start, end })
    out.push({ ...item, ok: slice === quote, start, end, slice })
  }
  return out
}

function stripFence(raw) {
  let s = String(raw || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s
}

function parseJson(raw) {
  try { return { ok: true, value: JSON.parse(stripFence(raw)) } }
  catch (error) { return { ok: false, reason: String((error && error.message) || error) } }
}

// 一次流式调用。注意：DSH 的 chunk 判别字段是 `type`（Phase 0 实测）。
async function streamOnce(llm, { text, provider, model, maxTokens, reasoningEffort, signal }) {
  let out = ''
  let hadTextDelta = false
  let finish = null
  try {
    const options = {
      provider,
      model,
      maxTokens: maxTokens || 900,
      messages: [
        { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT }] },
        { role: 'user', content: [{ type: 'text', text }] },
      ],
    }
    if (reasoningEffort) options.reasoningEffort = reasoningEffort
    if (signal) options.signal = signal
    for await (const chunk of llm.stream(options)) {
      const type = chunk && (chunk.type || chunk.kind)
      if ((type === 'text-delta' || type === 'text') && typeof chunk.text === 'string') {
        hadTextDelta = true
        out += chunk.text
      } else if (type === 'finish') {
        finish = chunk
      }
    }
    return { ok: true, text: out, hadTextDelta, finish }
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error), finish }
  }
}

// JSON 不合法或没有可见文本时重试一次（Phase 0 实测约 1/5 概率只出 reasoning）。
async function extract(llm, { text, provider, model, signal }) {
  const attempts = []
  for (let i = 0; i < 2; i++) {
    const extraReasoning = i === 0 ? 'low' : 'max'
    const run = await streamOnce(llm, {
      text, provider, model,
      maxTokens: i === 0 ? 900 : 1200,
      reasoningEffort: extraReasoning,
      signal,
    })
    const parsed = run.ok ? parseJson(run.text) : { ok: false, reason: run.error }
    attempts.push({
      attempt: i + 1,
      ok: run.ok,
      hadTextDelta: run.hadTextDelta,
      chars: (run.text || '').length,
      jsonOk: parsed.ok,
      reason: parsed.reason || null,
    })
    if (run.ok && parsed.ok && Array.isArray(parsed.value && parsed.value.entities)) {
      return { ok: true, attempts, entities: backfillOffsets(text, parsed.value.entities) }
    }
    if (signal && signal.aborted) break
  }
  return { ok: false, attempts, entities: [] }
}

async function loadHostModules() {
  if (HOST_MODULES) return HOST_MODULES
  const mods = { enrich: null, image: null, error: null }
  try { mods.enrich = await import('./host/entity-enrich.mjs') } catch (error) { mods.error = String(error) }
  try { mods.image = await import('./host/entity-image.mjs') } catch (error) { mods.error = (mods.error || '') + ' | ' + String(error) }
  HOST_MODULES = mods
  return mods
}

export function apply(ctx) {
  ctx.inject(['connection', 'web', 'llm'], (ctx) => {
    const provider = process.env.DSH_STYLE_ENTITY_PROVIDER || 'magpie'
    const model = process.env.DSH_STYLE_ENTITY_MODEL || 'opencode/deepseek-v4.1-flash'

    const route = (path, methods, fetch, label) =>
      ctx.effect(
        () => ctx.connection.fetch.register({ path, methods, requestBody: 'buffered', fetch }),
        'dsh-style: ' + label
      )

    route('/api/style-entity/ping', ['GET'], async () =>
      jsonResponse({ ok: true, provider, model, at: Date.now() }), 'entity ping')

    route('/api/style-entity/extract', ['POST'], async (request) => {
      let body = null
      try { body = await request.json() } catch {}
      const text = String((body && body.text) || '').slice(0, 24000)
      if (!text) return jsonResponse({ ok: false, error: 'no-text' }, 400)
      const useProvider = (body && body.provider) || provider
      const useModel = (body && body.model) || model
      const key = 'x:' + useProvider + ':' + useModel + ':' + text
      const cached = cacheGet(key)
      if (cached) return jsonResponse({ ...cached, cached: true })
      const result = await extract(ctx.llm, { text, provider: useProvider, model: useModel, signal: request.signal })
      const payload = {
        ok: result.ok,
        entities: result.entities,
        attempts: result.attempts,
        offsetOk: result.entities.filter((e) => e.ok).length,
        offsetBad: result.entities.filter((e) => !e.ok).length,
      }
      if (result.ok) cacheSet(key, payload)
      return jsonResponse(payload)
    }, 'entity extract')

    route('/api/style-entity/enrich', ['POST'], async (request) => {
      let body = null
      try { body = await request.json() } catch {}
      const entityName = String((body && body.name) || '').slice(0, 200)
      if (!entityName) return jsonResponse({ ok: false, error: 'no-name' }, 400)
      const mods = await loadHostModules()
      if (!mods.enrich || typeof mods.enrich.enrichEntity !== 'function') {
        return jsonResponse({ ok: false, matched: false, empty: true, emptyReason: 'host-module-missing', error: mods.error })
      }
      const key = 'e:' + entityName.toLowerCase() + '|' + String((body && body.type) || '')
      const cached = cacheGet(key)
      if (cached) return jsonResponse({ ...cached, cached: true })
      const result = await mods.enrich.enrichEntity({
        name: entityName,
        type: (body && body.type) || '',
        context: (body && body.context) || '',
        signal: request.signal,
      })
      if (result && result.ok) cacheSet(key, result)
      return jsonResponse(result)
    }, 'entity enrich')

    route('/api/style-entity/image', ['GET'], async (request) => {
      const mods = await loadHostModules()
      if (!mods.image || typeof mods.image.proxyImage !== 'function') {
        return jsonResponse({ ok: false, error: 'host-module-missing' }, 503)
      }
      let raw = ''
      try { raw = new URL(request.url).searchParams.get('u') || '' } catch {}
      if (!raw) return jsonResponse({ ok: false, error: 'no-url' }, 400)
      const result = await mods.image.proxyImage(raw, { signal: request.signal })
      if (!result || !result.ok) {
        return jsonResponse({ ok: false, error: (result && result.error) || 'proxy-failed' }, 502)
      }
      return new Response(result.bytes, {
        status: 200,
        headers: {
          'content-type': result.contentType || 'application/octet-stream',
          'cache-control': 'public, max-age=86400',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; sandbox",
        },
      })
    }, 'entity image')
  })
}
