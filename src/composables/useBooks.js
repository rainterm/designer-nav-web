import { computed, ref } from 'vue'
import { createId, letterFromName } from '@/data/defaultSites'
import { iconFromSiteUrl } from '@/utils/favicon'
import { isGenericSiteIcon, pickBookCover } from '@/utils/bookCover'

const STORAGE_KEY_V1 = 'nav-web.books.v1'
const STORAGE_KEY = 'nav-web.books.v2'

export const DEFAULT_GROUP_ID = 'default'

function normalizeGroup(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  if (!name) return null
  return {
    id: String(raw.id || createId('bg')),
    name: name.slice(0, 24),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index
  }
}

function normalizeBook(raw, groupIds = null) {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || raw.name || '').trim()
  const url = String(raw.url || '').trim()
  if (!title || !url) return null
  let groupId = String(raw.groupId || DEFAULT_GROUP_ID).trim() || DEFAULT_GROUP_ID
  if (groupIds && !groupIds.has(groupId)) groupId = DEFAULT_GROUP_ID
  const cover = pickBookCover(raw.cover, url) || iconFromSiteUrl(url)
  return {
    id: raw.id || createId('book'),
    title,
    author: String(raw.author || '').trim(),
    url,
    cover,
    letter: String(raw.letter || letterFromName(title)).slice(0, 2),
    note: String(raw.note || raw.desc || '').trim(),
    groupId,
    updatedAt: Number(raw.updatedAt) || Date.now()
  }
}

function ensureDefaultGroup(groups) {
  const list = [...groups]
  if (!list.some((g) => g.id === DEFAULT_GROUP_ID)) {
    list.unshift({ id: DEFAULT_GROUP_ID, name: '默认', order: 0 })
  }
  return list
    .map((g, i) => normalizeGroup(g, i))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh'))
}

function loadStore() {
  try {
    const v2 = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (v2 && typeof v2 === 'object') {
      const groups = ensureDefaultGroup(Array.isArray(v2.groups) ? v2.groups : [])
      const groupIds = new Set(groups.map((g) => g.id))
      const books = (Array.isArray(v2.books) ? v2.books : [])
        .map((b) => normalizeBook(b, groupIds))
        .filter(Boolean)
      return { groups, books }
    }
  } catch {
    // fall through
  }

  try {
    const v1 = JSON.parse(localStorage.getItem(STORAGE_KEY_V1) || '[]')
    if (Array.isArray(v1) && v1.length) {
      const groups = ensureDefaultGroup([])
      const books = v1
        .map((b) => normalizeBook({ ...b, groupId: DEFAULT_GROUP_ID }))
        .filter(Boolean)
      return { groups, books }
    }
  } catch {
    // ignore
  }

  return { groups: ensureDefaultGroup([]), books: [] }
}

const initial = loadStore()
const groups = ref(initial.groups)
const books = ref(initial.books)

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      groups: groups.value,
      books: books.value
    })
  )
}

// 将 v1 数据落到 v2，避免仅内存迁移
if (!localStorage.getItem(STORAGE_KEY)) {
  persist()
}

/**
 * 书籍收藏：本地存储 + 分组
 */
export function useBooks() {
  const groupMap = computed(() => {
    const map = new Map()
    for (const g of groups.value) map.set(g.id, g)
    return map
  })

  function groupName(groupId) {
    return groupMap.value.get(groupId)?.name || '默认'
  }

  function findByUrl(url) {
    const target = String(url || '').trim()
    if (!target) return null
    return books.value.find((b) => b.url === target) || null
  }

  function addGroup(name) {
    const n = String(name || '').trim().slice(0, 24)
    if (!n) return null
    if (groups.value.some((g) => g.name === n)) return null
    const maxOrder = groups.value.reduce((m, g) => Math.max(m, g.order), 0)
    const group = { id: createId('bg'), name: n, order: maxOrder + 1 }
    groups.value = [...groups.value, group]
    persist()
    return group
  }

  function renameGroup(id, name) {
    const n = String(name || '').trim().slice(0, 24)
    if (!id || !n) return null
    if (groups.value.some((g) => g.id !== id && g.name === n)) return null
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx < 0) return null
    const next = [...groups.value]
    next[idx] = { ...next[idx], name: n }
    groups.value = next
    persist()
    return next[idx]
  }

  function removeGroup(id) {
    if (!id || id === DEFAULT_GROUP_ID) return false
    if (!groups.value.some((g) => g.id === id)) return false
    groups.value = groups.value.filter((g) => g.id !== id)
    books.value = books.value.map((b) =>
      b.groupId === id ? { ...b, groupId: DEFAULT_GROUP_ID, updatedAt: Date.now() } : b
    )
    persist()
    return true
  }

  function reorderGroups(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    const list = [...groups.value]
    const fromIdx = list.findIndex((g) => g.id === fromId)
    if (fromIdx < 0) return
    const [item] = list.splice(fromIdx, 1)
    let insertAt = list.findIndex((g) => g.id === toId)
    if (insertAt < 0) insertAt = list.length
    list.splice(insertAt, 0, item)
    groups.value = list.map((g, i) => ({ ...g, order: i }))
    persist()
  }

  function addBook(payload) {
    const groupIds = new Set(groups.value.map((g) => g.id))
    const book = normalizeBook(
      {
        ...payload,
        id: createId('book'),
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!book) return null
    const existed = findByUrl(book.url)
    if (existed) {
      const nextCover =
        book.cover && !isGenericSiteIcon(book.cover)
          ? book.cover
          : existed.cover && !isGenericSiteIcon(existed.cover)
            ? existed.cover
            : book.cover
      return updateBook(existed.id, {
        title: book.title,
        author: book.author || existed.author,
        cover: nextCover,
        note: book.note || existed.note,
        letter: book.letter,
        groupId: payload.groupId || existed.groupId
      })
    }
    books.value = [book, ...books.value]
    persist()
    return book
  }

  function updateBook(id, payload) {
    const idx = books.value.findIndex((b) => b.id === id)
    if (idx < 0) return null
    const groupIds = new Set(groups.value.map((g) => g.id))
    const book = normalizeBook(
      {
        ...books.value[idx],
        ...payload,
        id,
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!book) return null
    const next = [...books.value]
    next[idx] = book
    books.value = next
    persist()
    return book
  }

  function removeBook(id) {
    books.value = books.value.filter((b) => b.id !== id)
    persist()
  }

  function reorderBooks(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    const list = [...books.value]
    const fromIdx = list.findIndex((b) => b.id === fromId)
    if (fromIdx < 0) return
    const [item] = list.splice(fromIdx, 1)
    let insertAt = list.findIndex((b) => b.id === toId)
    if (insertAt < 0) insertAt = list.length
    list.splice(insertAt, 0, item)
    books.value = list
    persist()
  }

  function moveBookToGroup(bookId, groupId) {
    const gid = groupId || DEFAULT_GROUP_ID
    if (!groups.value.some((g) => g.id === gid)) return null
    return updateBook(bookId, { groupId: gid })
  }

  function toOpenSite(book) {
    if (!book?.url) return null
    return {
      id: `book-read-${book.id}`,
      name: book.title,
      url: book.url,
      icon: book.cover || '',
      letter: book.letter || letterFromName(book.title),
      desc: book.author ? `${book.author} · 阅读` : '阅读',
      ephemeral: true
    }
  }

  return {
    books,
    groups,
    groupName,
    addGroup,
    renameGroup,
    removeGroup,
    reorderGroups,
    addBook,
    updateBook,
    removeBook,
    reorderBooks,
    moveBookToGroup,
    findByUrl,
    toOpenSite,
    DEFAULT_GROUP_ID
  }
}
