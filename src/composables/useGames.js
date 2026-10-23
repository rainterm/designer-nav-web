import { computed, ref } from 'vue'
import { createId, letterFromName } from '@/data/defaultSites'
import { iconFromSiteUrl } from '@/utils/favicon'
import { isGenericSiteIcon, pickBookCover } from '@/utils/bookCover'

const STORAGE_KEY = 'nav-web.games.v1'

export const DEFAULT_GAME_GROUP_ID = 'default'

function normalizeGroup(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  if (!name) return null
  return {
    id: String(raw.id || createId('gg')),
    name: name.slice(0, 24),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index
  }
}

function normalizeGame(raw, groupIds = null) {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || raw.name || '').trim()
  const url = String(raw.url || '').trim()
  if (!title || !url) return null
  let groupId = String(raw.groupId || DEFAULT_GAME_GROUP_ID).trim() || DEFAULT_GAME_GROUP_ID
  if (groupIds && !groupIds.has(groupId)) groupId = DEFAULT_GAME_GROUP_ID
  const cover = pickBookCover(raw.cover, url) || iconFromSiteUrl(url)
  return {
    id: raw.id || createId('game'),
    title,
    platform: String(raw.platform || raw.director || raw.author || '').trim(),
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
  if (!list.some((g) => g.id === DEFAULT_GAME_GROUP_ID)) {
    list.unshift({ id: DEFAULT_GAME_GROUP_ID, name: '默认', order: 0 })
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
      const games = (Array.isArray(raw.games) ? raw.games : [])
        .map((g) => normalizeGame(g, groupIds))
        .filter(Boolean)
      return { groups, games }
    }
  } catch {
    // ignore
  }
  return { groups: ensureDefaultGroup([]), games: [] }
}

const initial = loadStore()
const groups = ref(initial.groups)
const games = ref(initial.games)

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      groups: groups.value,
      games: games.value
    })
  )
}

if (!localStorage.getItem(STORAGE_KEY)) {
  persist()
}

/**
 * 游戏收藏：本地存储 + 分组
 */
export function useGames() {
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
    return games.value.find((g) => g.url === target) || null
  }

  function addGroup(name) {
    const n = String(name || '').trim().slice(0, 24)
    if (!n) return null
    if (groups.value.some((g) => g.name === n)) return null
    const maxOrder = groups.value.reduce((m, g) => Math.max(m, g.order), 0)
    const group = { id: createId('gg'), name: n, order: maxOrder + 1 }
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
    if (!id || id === DEFAULT_GAME_GROUP_ID) return false
    if (!groups.value.some((g) => g.id === id)) return false
    groups.value = groups.value.filter((g) => g.id !== id)
    games.value = games.value.map((g) =>
      g.groupId === id ? { ...g, groupId: DEFAULT_GAME_GROUP_ID, updatedAt: Date.now() } : g
    )
    persist()
    return true
  }

  function addGame(payload) {
    const groupIds = new Set(groups.value.map((g) => g.id))
    const game = normalizeGame(
      {
        ...payload,
        id: createId('game'),
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!game) return null
    const existed = findByUrl(game.url)
    if (existed) {
      const nextCover =
        game.cover && !isGenericSiteIcon(game.cover)
          ? game.cover
          : existed.cover && !isGenericSiteIcon(existed.cover)
            ? existed.cover
            : game.cover
      return updateGame(existed.id, {
        title: game.title,
        platform: game.platform || existed.platform,
        cover: nextCover,
        note: game.note || existed.note,
        letter: game.letter,
        groupId: payload.groupId || existed.groupId
      })
    }
    games.value = [game, ...games.value]
    persist()
    return game
  }

  function updateGame(id, payload) {
    const idx = games.value.findIndex((g) => g.id === id)
    if (idx < 0) return null
    const groupIds = new Set(groups.value.map((g) => g.id))
    const game = normalizeGame(
      {
        ...games.value[idx],
        ...payload,
        id,
        updatedAt: Date.now()
      },
      groupIds
    )
    if (!game) return null
    const next = [...games.value]
    next[idx] = game
    games.value = next
    persist()
    return game
  }

  function removeGame(id) {
    games.value = games.value.filter((g) => g.id !== id)
    persist()
  }

  function reorderGames(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    const list = [...games.value]
    const fromIdx = list.findIndex((g) => g.id === fromId)
    if (fromIdx < 0) return
    const [item] = list.splice(fromIdx, 1)
    let insertAt = list.findIndex((g) => g.id === toId)
    if (insertAt < 0) insertAt = list.length
    list.splice(insertAt, 0, item)
    games.value = list
    persist()
  }

  function moveGameToGroup(gameId, groupId) {
    const gid = groupId || DEFAULT_GAME_GROUP_ID
    if (!groups.value.some((g) => g.id === gid)) return null
    return updateGame(gameId, { groupId: gid })
  }

  function toOpenSite(game) {
    if (!game?.url) return null
    return {
      id: `game-open-${game.id}`,
      name: game.title,
      url: game.url,
      icon: game.cover || '',
      letter: game.letter || letterFromName(game.title),
      desc: game.platform ? `${game.platform} · 游戏` : '游戏',
      ephemeral: true,
      searchType: 'game'
    }
  }

  return {
    games,
    groups,
    groupName,
    addGroup,
    renameGroup,
    removeGroup,
    addGame,
    updateGame,
    removeGame,
    reorderGames,
    moveGameToGroup,
    findByUrl,
    toOpenSite,
    DEFAULT_GAME_GROUP_ID
  }
}
