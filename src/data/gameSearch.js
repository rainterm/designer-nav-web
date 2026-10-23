/** 在线游戏 / 小游戏搜索引擎 */

function enc(q) {
  return encodeURIComponent(q)
}

export const GAME_SEARCH_ENGINES = [
  {
    id: 'steam',
    name: 'Steam',
    letter: 'S',
    host: 'store.steampowered.com',
    kind: 'store',
    build: (q) => `https://store.steampowered.com/search/?term=${enc(q)}`
  },
  {
    id: 'taptap',
    name: 'TapTap',
    letter: 'T',
    host: 'www.taptap.cn',
    kind: 'store',
    build: (q) => `https://www.taptap.cn/search/${enc(q)}?type=game`
  },
  {
    id: '3839',
    name: '好游快爆',
    letter: '好',
    host: 'www.3839.com',
    kind: 'store',
    build: (q) => `https://www.3839.com/search.php?word=${enc(q)}`
  },
  {
    id: 'bilibili-game',
    name: '哔哩哔哩游戏',
    letter: 'B',
    host: 'game.bilibili.com',
    kind: 'store',
    build: (q) => `https://game.bilibili.com/platform/search/?keyword=${enc(q)}`
  },
  {
    id: 'xbox',
    name: 'Xbox',
    letter: 'X',
    host: 'www.xbox.com',
    kind: 'store',
    build: (q) => `https://www.xbox.com/zh-CN/search/results?q=${enc(q)}`
  },
  {
    id: 'switch',
    name: 'Nintendo Switch',
    letter: 'N',
    host: 'www.nintendo.com',
    kind: 'store',
    build: (q) => `https://www.nintendo.com/hk/search?k=${enc(q)}`
  },
  {
    id: 'psn',
    name: 'PlayStation',
    letter: 'P',
    host: 'store.playstation.com',
    kind: 'store',
    build: (q) => `https://store.playstation.com/zh-hans-cn/search/${enc(q)}`
  },
  {
    id: 'itch',
    name: 'itch.io',
    letter: 'i',
    host: 'itch.io',
    kind: 'store',
    build: (q) => `https://itch.io/search?q=${enc(q)}`
  },
  {
    id: '4399',
    name: '4399 小游戏',
    letter: '4',
    host: 'www.4399.com',
    kind: 'mini',
    build: (q) => `https://so2.4399.com/search/search.php?k=${enc(q)}`
  },
  {
    id: '7k7k',
    name: '7k7k 小游戏',
    letter: '7',
    host: 'www.7k7k.com',
    kind: 'mini',
    build: (q) => `https://so.7k7k.com/game/${enc(q)}/`
  },
  {
    id: 'poki',
    name: 'Poki',
    letter: 'P',
    host: 'poki.com',
    kind: 'mini',
    build: (q) => `https://poki.com/zh?search=${enc(q)}`
  },
  {
    id: 'crazygames',
    name: 'CrazyGames',
    letter: 'C',
    host: 'www.crazygames.com',
    kind: 'mini',
    build: (q) => `https://www.crazygames.com/search?q=${enc(q)}`
  },
  {
    id: 'gamersky',
    name: '游民星空（资料）',
    letter: '游',
    host: 'www.gamersky.com',
    kind: 'meta',
    watchable: false,
    build: (q) => `https://so.gamersky.com/?s=${enc(q)}`
  }
]

export const STORE_GAME_ENGINES = GAME_SEARCH_ENGINES.filter((e) => e.kind === 'store')
export const MINI_GAME_ENGINES = GAME_SEARCH_ENGINES.filter((e) => e.kind === 'mini')
export const META_GAME_ENGINES = GAME_SEARCH_ENGINES.filter((e) => e.kind === 'meta')

/** 默认：商店 + 在线小游戏 */
export const DEFAULT_GAME_ENGINES = ['steam', 'taptap', '4399']

export function gameEngineIcon(engine) {
  return `https://icon.horse/icon/${engine.host}`
}

export function buildGameSearchTabs(engineIds, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const stamp = Date.now().toString(36)
  return engineIds
    .map((id, index) => {
      const engine = GAME_SEARCH_ENGINES.find((e) => e.id === id)
      if (!engine) return null
      const isMini = engine.kind === 'mini'
      const isMeta = engine.kind === 'meta' || engine.watchable === false
      return {
        id: `game-search-${id}-${stamp}-${index}`,
        name: engine.name,
        desc: isMeta ? `游戏资料：${q}` : isMini ? `小游戏：${q}` : `游戏搜索：${q}`,
        url: engine.build(q),
        icon: gameEngineIcon(engine),
        letter: engine.letter,
        ephemeral: true,
        searchQuery: q,
        searchType: 'game'
      }
    })
    .filter(Boolean)
}

export function buildGameSearchBoard(engineIds, query) {
  const panes = buildGameSearchTabs(engineIds, query)
  if (!panes.length) return null
  if (panes.length === 1) return panes[0]
  const q = String(query || '').trim()
  const stamp = Date.now().toString(36)
  const hasMini = engineIds.some((id) =>
    GAME_SEARCH_ENGINES.some((e) => e.id === id && e.kind === 'mini')
  )
  const hasStore = engineIds.some((id) =>
    GAME_SEARCH_ENGINES.some((e) => e.id === id && e.kind === 'store')
  )
  const label = hasMini && hasStore ? '游戏/小游戏' : hasMini ? '小游戏' : '游戏'
  return {
    id: `game-search-board-${stamp}`,
    name: `${label}搜索`,
    desc: `${label}：${q}（${panes.length} 个平台）`,
    url: panes[0].url,
    icon: '',
    letter: hasMini && !hasStore ? '小' : '游',
    ephemeral: true,
    isSearchBoard: true,
    searchQuery: q,
    searchType: 'game',
    panes
  }
}
