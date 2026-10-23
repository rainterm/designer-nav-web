import { computed, ref } from 'vue'
import { createId, letterFromName } from '@/data/defaultSites'
import { iconFromSiteUrl } from '@/utils/favicon'
import { isGenericSiteIcon, pickBookCover } from '@/utils/bookCover'

const STORAGE_KEY = 'nav-web.movies.v1'

export const DEFAULT_MOVIE_GROUP_ID = 'default'

function normalizeGroup(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  if (!name) return null
  return {
    id: String(raw.id || createId('mg')),
    name: name.slice(0, 24),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index
  }
}

function normalizeMovie(raw, groupIds = null) {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || raw.name || '').trim()
  const url = String(raw.url || '').trim()
  if (!title || !url) return null
  let groupId = String(raw.groupId || DEFAULT_MOVIE_GROUP_ID).trim() || DEFAULT_MOVIE_GROUP_ID
  if (groupIds && !groupIds.has(groupId)) groupId = DEFAULT_MOVIE_GROUP_ID
  const cover = pickBookCover(raw.cover, url) || iconFromSiteUrl(url)
  return {
    id: raw.id || createId('movie'),
    title,
    year: String(raw.year || '').trim().slice(0, 12),
    director: String(raw.director || raw.author || '').trim(),
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
  if (!list.some((g) => g.id === DEFAULT_MOVIE_GROUP_ID)) {
    list.unshift({ id: DEFAULT_MOVIE_GROUP_ID, name: '默认', order: 0 })
  }
  return list
    .map((g, i) => normalizeGroup(g, i))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh'))
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (raw && typeof raw === 'object') {
      const groups = ensureDefaultGroup(Array.isArray(raw.groups) ? raw.groups : [])
      const groupIds = new Set(groups.map((g) => g.id))
      const movies = (Array.isArray(raw.movies) ? raw.movies : [])
        .map((m) => normalizeMovie(m, groupIds))
        .filter(Boolean)
      return { groups, movies }
    }
  } catch {
    // ignore
  }
  return { groups: ensureDefaultGroup([]), movies: [] }
}

const initial = loadStore()
const groups = ref(initial.groups)
const movies = ref(initial.movies)

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      groups: groups.value,
      movies: movies.value
    })
  )
}

if (!localStorage.getItem(STORAGE_KEY)) {
  persist()
}

/**
 * 电影收藏：本地存储 + 分组
 */
export function useMovies() {
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
    return movies.value.find((m) => m.url === target) || null
  }

  function addGroup(name) {
    const n = String(name || '').trim().slice(0, 24)
    if (!n) return null
    if (groups.value.some((g) => g.name === n)) return null
    const maxOrder = groups.value.reduce((m, g) => Math.max(m, g.order), 0)
    const group = { id: createId('mg'), name: n, order: maxOrder + 1 }
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
    if (!id || id === DEFAULT_MOVIE_GROUP_ID) return false
    if (!groups.value.some((g) => g.id === id)) return false
    groups.value = groups.value.filter((g) => g.id !== id)
    movies.value = movies.value.map((m) =>
      m.groupId === id ? { ...m, groupId: DEFAULT_MOVIE_GROUP_ID, updatedAt: Date.now() } : m
    )
    persist()
    return true
  }

  function addMovie(payload) {
    const groupIds = new Set(groups.value.map((g) => g.id))
    const movie = normalizeMovie(
      {
        ...payload,
        id: createId('movie'),
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!movie) return null
    const existed = findByUrl(movie.url)
    if (existed) {
      const nextCover =
        movie.cover && !isGenericSiteIcon(movie.cover)
          ? movie.cover
          : existed.cover && !isGenericSiteIcon(existed.cover)
            ? existed.cover
            : movie.cover
      return updateMovie(existed.id, {
        title: movie.title,
        year: movie.year || existed.year,
        director: movie.director || existed.director,
        cover: nextCover,
        note: movie.note || existed.note,
        letter: movie.letter,
        groupId: payload.groupId || existed.groupId
      })
    }
    movies.value = [movie, ...movies.value]
    persist()
    return movie
  }

  function updateMovie(id, payload) {
    const idx = movies.value.findIndex((m) => m.id === id)
    if (idx < 0) return null
    const groupIds = new Set(groups.value.map((g) => g.id))
    const movie = normalizeMovie(
      {
        ...movies.value[idx],
        ...payload,
        id,
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!movie) return null
    const next = [...movies.value]
    next[idx] = movie
    movies.value = next
    persist()
    return movie
  }

  function removeMovie(id) {
    movies.value = movies.value.filter((m) => m.id !== id)
    persist()
  }

  function reorderMovies(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    const list = [...movies.value]
    const fromIdx = list.findIndex((m) => m.id === fromId)
    if (fromIdx < 0) return
    const [item] = list.splice(fromIdx, 1)
    let insertAt = list.findIndex((m) => m.id === toId)
    if (insertAt < 0) insertAt = list.length
    list.splice(insertAt, 0, item)
    movies.value = list
    persist()
  }

  function moveMovieToGroup(movieId, groupId) {
    const gid = groupId || DEFAULT_MOVIE_GROUP_ID
    if (!groups.value.some((g) => g.id === gid)) return null
    return updateMovie(movieId, { groupId: gid })
  }

  function toOpenSite(movie) {
    if (!movie?.url) return null
    return {
      id: `movie-watch-${movie.id}`,
      name: movie.title,
      url: movie.url,
      icon: movie.cover || '',
      letter: movie.letter || letterFromName(movie.title),
      desc: movie.director ? `${movie.director} · 观看` : '观看',
      ephemeral: true,
      searchType: 'movie'
    }
  }

  return {
    movies,
    groups,
    groupName,
    addGroup,
    renameGroup,
    removeGroup,
    addMovie,
    updateMovie,
    removeMovie,
    reorderMovies,
    moveMovieToGroup,
    findByUrl,
    toOpenSite,
    DEFAULT_MOVIE_GROUP_ID
  }
}
