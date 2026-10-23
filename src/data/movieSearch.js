/** 在线电影搜索引擎（优先可播放平台） */

function enc(q) {
  return encodeURIComponent(q)
}

export const MOVIE_SEARCH_ENGINES = [
  {
    id: 'iqiyi',
    name: '爱奇艺',
    letter: '爱',
    host: 'www.iqiyi.com',
    watchable: true,
    build: (q) => `https://so.iqiyi.com/so/q_${enc(q)}`
  },
  {
    id: 'youku',
    name: '优酷',
    letter: '优',
    host: 'www.youku.com',
    watchable: true,
    build: (q) => `https://so.youku.com/search_video/q_${enc(q)}`
  },
  {
    id: 'tencent-video',
    name: '腾讯视频',
    letter: '腾',
    host: 'v.qq.com',
    watchable: true,
    build: (q) => `https://v.qq.com/x/search/?q=${enc(q)}`
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    letter: 'B',
    host: 'search.bilibili.com',
    watchable: true,
    build: (q) => `https://search.bilibili.com/all?keyword=${enc(q)}`
  },
  {
    id: 'mgtv',
    name: '芒果TV',
    letter: '芒',
    host: 'so.mgtv.com',
    watchable: true,
    build: (q) => `https://so.mgtv.com/so?k=${enc(q)}`
  },
  {
    id: 'sohu-tv',
    name: '搜狐视频',
    letter: '搜',
    host: 'tv.sohu.com',
    watchable: true,
    build: (q) => `https://so.tv.sohu.com/mts?wd=${enc(q)}`
  },
  {
    id: 'douban-movie',
    name: '豆瓣（资料）',
    letter: '豆',
    host: 'movie.douban.com',
    watchable: false,
    build: (q) => `https://search.douban.com/movie/subject_search?search_text=${enc(q)}`
  }
]

/** 默认可在线观看平台 */
export const DEFAULT_MOVIE_ENGINES = ['iqiyi', 'youku', 'tencent-video']

export function movieEngineIcon(engine) {
  return `https://icon.horse/icon/${engine.host}`
}

export function buildMovieSearchTabs(engineIds, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const stamp = Date.now().toString(36)
  return engineIds
    .map((id, index) => {
      const engine = MOVIE_SEARCH_ENGINES.find((e) => e.id === id)
      if (!engine) return null
      const url = engine.build(q)
      return {
        id: `movie-search-${id}-${stamp}-${index}`,
        name: engine.name,
        desc: engine.watchable === false ? `电影资料：${q}` : `在线观看搜索：${q}`,
        url,
        icon: movieEngineIcon(engine),
        letter: engine.letter,
        ephemeral: true,
        searchQuery: q,
        searchType: 'movie'
      }
    })
    .filter(Boolean)
}

export function buildMovieSearchBoard(engineIds, query) {
  const panes = buildMovieSearchTabs(engineIds, query)
  if (!panes.length) return null
  if (panes.length === 1) return panes[0]
  const q = String(query || '').trim()
  const stamp = Date.now().toString(36)
  return {
    id: `movie-search-board-${stamp}`,
    name: '电影搜索',
    desc: `在线观看：${q}（${panes.length} 个平台）`,
    url: panes[0].url,
    icon: '',
    letter: '影',
    ephemeral: true,
    isSearchBoard: true,
    searchQuery: q,
    searchType: 'movie',
    panes
  }
}
