/** 聚合搜索引擎：文字 / 图片 / 视频 / 开源 */

function enc(q) {
  return encodeURIComponent(q)
}

export const SEARCH_TYPES = [
  { id: 'web', label: '文字' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'opensource', label: '开源' }
]

export const SEARCH_ENGINES = [
  {
    id: 'google',
    name: 'Google',
    letter: 'G',
    host: 'www.google.com',
    build: {
      web: (q) => `https://www.google.com/search?q=${enc(q)}`,
      image: (q) => `https://www.google.com/search?tbm=isch&q=${enc(q)}`,
      video: (q) => `https://www.google.com/search?tbm=vid&q=${enc(q)}`
    }
  },
  {
    id: 'bing',
    name: '必应',
    letter: '必',
    host: 'www.bing.com',
    build: {
      web: (q) => `https://www.bing.com/search?q=${enc(q)}`,
      image: (q) => `https://www.bing.com/images/search?q=${enc(q)}`,
      video: (q) => `https://www.bing.com/videos/search?q=${enc(q)}`
    }
  },
  {
    id: 'baidu',
    name: '百度',
    letter: '百',
    host: 'www.baidu.com',
    build: {
      web: (q) => `https://www.baidu.com/s?wd=${enc(q)}`,
      image: (q) => `https://image.baidu.com/search/index?tn=baiduimage&word=${enc(q)}`,
      video: (q) => `https://www.baidu.com/sf/vsearch?pd=video&wd=${enc(q)}`
    }
  },
  {
    id: 'github',
    name: 'GitHub',
    letter: 'GH',
    host: 'github.com',
    build: {
      opensource: (q) => `https://github.com/search?q=${enc(q)}&type=repositories`
    }
  },
  {
    id: 'gitee',
    name: 'Gitee',
    letter: '码',
    host: 'gitee.com',
    build: {
      opensource: (q) => `https://search.gitee.com/?type=repository&q=${enc(q)}`
    }
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    letter: 'HF',
    host: 'huggingface.co',
    build: {
      opensource: (q) => `https://huggingface.co/search/full-text?q=${enc(q)}`
    }
  },
  {
    id: 'npm',
    name: 'npm',
    letter: 'npm',
    host: 'www.npmjs.com',
    build: {
      opensource: (q) => `https://www.npmjs.com/search?q=${enc(q)}`
    }
  },
  {
    id: 'pypi',
    name: 'PyPI',
    letter: 'Py',
    host: 'pypi.org',
    build: {
      opensource: (q) => `https://pypi.org/search/?q=${enc(q)}`
    }
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    letter: 'Dk',
    host: 'hub.docker.com',
    build: {
      opensource: (q) => `https://hub.docker.com/search?q=${enc(q)}`
    }
  },
  {
    id: 'sourceforge',
    name: 'SourceForge',
    letter: 'SF',
    host: 'sourceforge.net',
    build: {
      opensource: (q) => `https://sourceforge.net/directory/?q=${enc(q)}`
    }
  },
  {
    id: 'douyin',
    name: '抖音',
    letter: '抖',
    host: 'www.douyin.com',
    build: {
      video: (q) => `https://www.douyin.com/search/${enc(q)}?type=general`
    }
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    letter: 'B',
    host: 'search.bilibili.com',
    build: {
      video: (q) => `https://search.bilibili.com/all?keyword=${enc(q)}`
    }
  },
  {
    id: 'toutiao',
    name: '头条搜索',
    letter: '头',
    host: 'so.toutiao.com',
    build: {
      web: (q) => `https://so.toutiao.com/search?keyword=${enc(q)}`,
      image: (q) => `https://so.toutiao.com/search?keyword=${enc(q)}&pd=synthesis&source=input`,
      video: (q) => `https://so.toutiao.com/search?keyword=${enc(q)}&pd=video`
    }
  },
  {
    id: 'sogou',
    name: '搜狗',
    letter: '搜',
    host: 'www.sogou.com',
    build: {
      web: (q) => `https://www.sogou.com/web?query=${enc(q)}`,
      image: (q) => `https://pic.sogou.com/pics?query=${enc(q)}`,
      video: (q) => `https://v.sogou.com/v?query=${enc(q)}`
    }
  },
  {
    id: 'youtube',
    name: 'YouTube',
    letter: 'YT',
    host: 'www.youtube.com',
    build: {
      video: (q) => `https://www.youtube.com/results?search_query=${enc(q)}`
    }
  }
]

/** 默认按检索质量从高到低 */
export const DEFAULT_ENGINE_ORDER = SEARCH_ENGINES.map((e) => e.id)

export function normalizeEngineOrder(order) {
  const known = new Set(SEARCH_ENGINES.map((e) => e.id))
  const seen = new Set()
  const next = []
  for (const id of Array.isArray(order) ? order : []) {
    if (!known.has(id) || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  for (const id of DEFAULT_ENGINE_ORDER) {
    if (!seen.has(id)) next.push(id)
  }
  return next
}

export function sortEngines(list, order) {
  const rank = new Map(normalizeEngineOrder(order).map((id, i) => [id, i]))
  return [...list].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
}

export function engineIcon(engine) {
  return `https://favicon.qqsuu.cn/${engine.host}`
}

export function enginesForType(typeId, order) {
  const list = SEARCH_ENGINES.filter((e) => typeof e.build?.[typeId] === 'function')
  return sortEngines(list, order)
}

export function buildSearchUrl(engineId, typeId, query) {
  const engine = SEARCH_ENGINES.find((e) => e.id === engineId)
  const builder = engine?.build?.[typeId]
  if (!builder) return ''
  return builder(String(query || '').trim())
}

export function buildSearchTabs(engineIds, typeId, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const typeLabel = SEARCH_TYPES.find((t) => t.id === typeId)?.label || '搜索'
  const stamp = Date.now().toString(36)
  return engineIds
    .map((id, index) => {
      const engine = SEARCH_ENGINES.find((e) => e.id === id)
      const url = buildSearchUrl(id, typeId, q)
      if (!engine || !url) return null
      return {
        id: `search-${id}-${stamp}-${index}`,
        name: `${engine.name}`,
        desc: `${typeLabel}：${q}`,
        url,
        icon: engineIcon(engine),
        letter: engine.letter,
        ephemeral: true,
        searchQuery: q,
        searchType: typeId
      }
    })
    .filter(Boolean)
}

/** 多个引擎合并为一个「一屏显示」标签 */
export function buildSearchBoard(engineIds, typeId, query) {
  const panes = buildSearchTabs(engineIds, typeId, query)
  if (!panes.length) return null
  if (panes.length === 1) return panes[0]
  const q = String(query || '').trim()
  const typeLabel = SEARCH_TYPES.find((t) => t.id === typeId)?.label || '搜索'
  const stamp = Date.now().toString(36)
  return {
    id: `search-board-${stamp}`,
    name: `聚合搜索`,
    desc: `${typeLabel}：${q}（${panes.length} 个引擎）`,
    url: panes[0].url,
    icon: '',
    letter: '搜',
    ephemeral: true,
    isSearchBoard: true,
    searchQuery: q,
    searchType: typeId,
    panes
  }
}

const PREF_KEY = 'nav-web.search.prefs.v5'
const DEFAULT_ENGINES = ['google', 'bing']

export function loadSearchPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
    const engines = Array.isArray(raw.engines)
      ? raw.engines.filter((id) => id && id !== 'so360' && id !== 'duckduckgo')
      : DEFAULT_ENGINES
    return {
      type: SEARCH_TYPES.some((t) => t.id === raw.type) ? raw.type : 'web',
      engines: engines.length ? engines : DEFAULT_ENGINES,
      oneScreen: raw.oneScreen !== false,
      order: normalizeEngineOrder(raw.order)
    }
  } catch {
    return {
      type: 'web',
      engines: DEFAULT_ENGINES,
      oneScreen: true,
      order: [...DEFAULT_ENGINE_ORDER]
    }
  }
}

export function saveSearchPrefs(prefs) {
  localStorage.setItem(
    PREF_KEY,
    JSON.stringify({
      type: prefs.type || 'web',
      engines: (prefs.engines || []).filter((id) => id !== 'so360' && id !== 'duckduckgo'),
      oneScreen: prefs.oneScreen !== false,
      order: normalizeEngineOrder(prefs.order)
    })
  )
}
