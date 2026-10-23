/** 在线图书 / 漫画搜索引擎 */

function enc(q) {
  return encodeURIComponent(q)
}

export const BOOK_SEARCH_ENGINES = [
  {
    id: 'fanqie',
    name: '番茄小说',
    letter: '番',
    host: 'fanqienovel.com',
    kind: 'book',
    build: (q) => `https://fanqienovel.com/search/${enc(q)}`
  },
  {
    id: 'weread',
    name: '微信读书',
    letter: '微',
    host: 'weread.qq.com',
    kind: 'book',
    build: (q) => `https://weread.qq.com/web/search/books?keyword=${enc(q)}`
  },
  {
    id: 'douban',
    name: '豆瓣读书',
    letter: '豆',
    host: 'book.douban.com',
    kind: 'book',
    build: (q) => `https://search.douban.com/book/subject_search?search_text=${enc(q)}`
  },
  {
    id: 'dangdang',
    name: '当当',
    letter: '当',
    host: 'search.dangdang.com',
    kind: 'book',
    build: (q) => `https://search.dangdang.com/?key=${enc(q)}&category_path=01.00.00.00.00.00`
  },
  {
    id: 'shidian',
    name: '识典古籍',
    letter: '识',
    host: 'www.shidianguji.com',
    kind: 'book',
    build: (q) => `https://www.shidianguji.com/search/${enc(q)}`
  },
  {
    id: 'google-books',
    name: 'Google 图书',
    letter: 'G',
    host: 'books.google.com',
    kind: 'book',
    build: (q) => `https://www.google.com/search?tbm=bks&q=${enc(q)}`
  },
  {
    id: 'duokan',
    name: '多看阅读',
    letter: '多',
    host: 'www.duokan.com',
    kind: 'book',
    build: (q) => `https://www.duokan.com/pc/search-result?s=${enc(q)}`
  },
  {
    id: 'bilibili-manga',
    name: '哔哩哔哩漫画',
    letter: '漫',
    host: 'manga.bilibili.com',
    kind: 'manga',
    build: (q) => `https://manga.bilibili.com/search?keyword=${enc(q)}`
  },
  {
    id: 'tencent-ac',
    name: '腾讯动漫',
    letter: '腾',
    host: 'ac.qq.com',
    kind: 'manga',
    build: (q) => `https://ac.qq.com/Comic/searchList?search=${enc(q)}`
  },
  {
    id: 'kuaikan',
    name: '快看漫画',
    letter: '快',
    host: 'www.kuaikanmanhua.com',
    kind: 'manga',
    build: (q) => `https://www.kuaikanmanhua.com/sou/${enc(q)}`
  }
]

export const DEFAULT_BOOK_ENGINES = ['fanqie', 'weread', 'bilibili-manga']

export const BOOK_KIND_ENGINES = BOOK_SEARCH_ENGINES.filter((e) => e.kind !== 'manga')
export const MANGA_KIND_ENGINES = BOOK_SEARCH_ENGINES.filter((e) => e.kind === 'manga')

export function bookEngineIcon(engine) {
  return `https://icon.horse/icon/${engine.host}`
}

export function buildBookSearchTabs(engineIds, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const stamp = Date.now().toString(36)
  return engineIds
    .map((id, index) => {
      const engine = BOOK_SEARCH_ENGINES.find((e) => e.id === id)
      if (!engine) return null
      const url = engine.build(q)
      const isManga = engine.kind === 'manga'
      return {
        id: `book-search-${id}-${stamp}-${index}`,
        name: engine.name,
        desc: isManga ? `漫画搜索：${q}` : `图书搜索：${q}`,
        url,
        icon: bookEngineIcon(engine),
        letter: engine.letter,
        ephemeral: true,
        searchQuery: q,
        searchType: 'book'
      }
    })
    .filter(Boolean)
}

export function buildBookSearchBoard(engineIds, query) {
  const panes = buildBookSearchTabs(engineIds, query)
  if (!panes.length) return null
  if (panes.length === 1) return panes[0]
  const q = String(query || '').trim()
  const stamp = Date.now().toString(36)
  const hasManga = engineIds.some((id) =>
    BOOK_SEARCH_ENGINES.some((e) => e.id === id && e.kind === 'manga')
  )
  const hasBook = engineIds.some((id) =>
    BOOK_SEARCH_ENGINES.some((e) => e.id === id && e.kind !== 'manga')
  )
  const label = hasManga && hasBook ? '图书/漫画' : hasManga ? '漫画' : '图书'
  return {
    id: `book-search-board-${stamp}`,
    name: `${label}搜索`,
    desc: `${label}：${q}（${panes.length} 个引擎）`,
    url: panes[0].url,
    icon: '',
    letter: hasManga && !hasBook ? '漫' : '书',
    ephemeral: true,
    isSearchBoard: true,
    searchQuery: q,
    searchType: 'book',
    panes
  }
}
