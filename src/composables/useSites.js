import { computed, ref } from 'vue'
import {
  STORAGE_KEY,
  cloneDefaults,
  createId,
  letterFromName
} from '@/data/defaultSites'
import { getConfiguredIcon, iconFromSiteUrl } from '@/utils/favicon'

function normalizeIcon(icon, pageUrl = '') {
  const online = getConfiguredIcon(icon)
  if (online) return online
  return iconFromSiteUrl(pageUrl)
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((it) => it && it.name && it.url)
    .map((it) => {
      const url = String(it.url).trim()
      return {
        id: it.id || createId('site'),
        name: String(it.name).trim(),
        desc: String(it.desc || '').trim(),
        url,
        icon: normalizeIcon(it.icon, url),
        letter: String(it.letter || letterFromName(it.name)).slice(0, 2)
      }
    })
}

const LEGACY_LLM_NAMES = new Set(['国外大模型', '国内大模型'])
const LEGACY_LLM_IDS = new Set(['cat-chat', 'cat-cn'])

/** 将旧「国外/国内大模型」合并为「大模型」 */
function mergeLegacyLlmGroups(groups) {
  const legacy = []
  const rest = []
  let existingLlm = null
  for (const g of groups) {
    if (LEGACY_LLM_NAMES.has(g.category) || LEGACY_LLM_IDS.has(g.id)) legacy.push(g)
    else if (g.category === '大模型' || g.id === 'cat-llm') existingLlm = g
    else rest.push(g)
  }
  if (!legacy.length) return groups

  const seen = new Set()
  const items = []
  for (const g of [...(existingLlm ? [existingLlm] : []), ...legacy]) {
    for (const it of g.items || []) {
      const key = it.id || it.url
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push(it)
    }
  }

  const llm = {
    id: existingLlm?.id || 'cat-llm',
    category: '大模型',
    letter: '大',
    icon: normalizeIcon(
      existingLlm?.icon || legacy[0]?.icon || items[0]?.icon,
      items[0]?.url || ''
    ),
    items
  }

  const insertAt = groups.findIndex(
    (g) =>
      LEGACY_LLM_NAMES.has(g.category) ||
      LEGACY_LLM_IDS.has(g.id) ||
      g.category === '大模型' ||
      g.id === 'cat-llm'
  )
  const next = [...rest]
  next.splice(Math.max(0, insertAt === -1 ? 0 : Math.min(insertAt, next.length)), 0, llm)
  return next
}

function normalizeGroups(raw) {
  if (!Array.isArray(raw)) return cloneDefaults()
  const groups = raw
    .filter((g) => g && typeof g.category === 'string')
    .map((g) => {
      const category = String(g.category).trim() || '未命名分类'
      const items = normalizeItems(g.items)
      return {
        id: g.id || createId('cat'),
        category,
        icon: normalizeIcon(g.icon || items[0]?.icon, items[0]?.url || ''),
        letter: String(g.letter || letterFromName(category)).slice(0, 2),
        items
      }
    })
  return mergeLegacyLlmGroups(groups)
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneDefaults()
    const groups = normalizeGroups(JSON.parse(raw))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
    return groups
  } catch {
    return cloneDefaults()
  }
}

const groups = ref(loadFromStorage())
const dirty = ref(false)

export function useSites() {
  const siteCount = computed(() =>
    groups.value.reduce((sum, g) => sum + g.items.length, 0)
  )

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups.value))
    dirty.value = false
  }

  function markDirty() {
    dirty.value = true
  }

  function replaceAll(next) {
    groups.value = normalizeGroups(next)
    markDirty()
  }

  function save() {
    persist()
  }

  function resetDefaults() {
    groups.value = cloneDefaults()
    persist()
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(groups.value, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nav-sites-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result))
          groups.value = normalizeGroups(data)
          persist()
          resolve(true)
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  function addCategory(input) {
    const payload = typeof input === 'string' ? { name: input } : input || {}
    const category = String(payload.name || '').trim() || '新分类'
    if (groups.value.some((g) => g.category === category)) return null
    const group = {
      id: createId('cat'),
      category,
      icon: getConfiguredIcon(payload.icon) || '',
      letter: letterFromName(category).slice(0, 2),
      items: []
    }
    groups.value = [...groups.value, group]
    markDirty()
    return group
  }

  function updateCategory(catId, patch) {
    const idx = groups.value.findIndex((g) => g.id === catId)
    if (idx < 0) return
    const cat = { ...groups.value[idx], items: [...groups.value[idx].items] }
    if (typeof patch === 'string') {
      cat.category = patch.trim() || cat.category
      if (!cat.letter) cat.letter = letterFromName(cat.category).slice(0, 2)
    } else if (patch && typeof patch === 'object') {
      if (patch.category !== undefined) {
        cat.category = String(patch.category).trim() || cat.category
      }
      if (patch.icon !== undefined) {
        cat.icon = getConfiguredIcon(patch.icon)
      }
      if (patch.letter !== undefined) {
        cat.letter = String(patch.letter || letterFromName(cat.category)).slice(0, 2)
      } else if (patch.category !== undefined && (!cat.letter || cat.letter === letterFromName(cat.category))) {
        cat.letter = letterFromName(cat.category).slice(0, 2)
      }
    }
    const list = [...groups.value]
    list[idx] = cat
    groups.value = list
    markDirty()
  }

  function removeCategory(catId) {
    groups.value = groups.value.filter((g) => g.id !== catId)
    markDirty()
  }

  function moveCategory(catId, dir) {
    const idx = groups.value.findIndex((g) => g.id === catId)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= groups.value.length) return
    const list = [...groups.value]
    ;[list[idx], list[next]] = [list[next], list[idx]]
    groups.value = list
    markDirty()
  }

  function addSite(catId, site) {
    const idx = groups.value.findIndex((g) => g.id === catId)
    if (idx < 0) return null
    const url = site.url.trim()
    const item = {
      id: createId('site'),
      name: site.name.trim(),
      desc: (site.desc || '').trim(),
      url,
      icon: normalizeIcon(site.icon, url),
      letter: (site.letter || letterFromName(site.name)).slice(0, 2)
    }
    const list = [...groups.value]
    list[idx] = { ...list[idx], items: [...list[idx].items, item] }
    groups.value = list
    markDirty()
    return item
  }

  function updateSite(catId, siteId, patch) {
    const idx = groups.value.findIndex((g) => g.id === catId)
    if (idx < 0) return
    const cat = groups.value[idx]
    const itemIdx = cat.items.findIndex((it) => it.id === siteId)
    if (itemIdx < 0) return
    const item = cat.items[itemIdx]
    const nextUrl = (patch.url ?? item.url).trim()
    const nextItem = {
      ...item,
      name: (patch.name ?? item.name).trim(),
      desc: (patch.desc ?? item.desc).trim(),
      url: nextUrl,
      icon:
        patch.icon !== undefined
          ? normalizeIcon(patch.icon, nextUrl)
          : normalizeIcon(item.icon, nextUrl),
      letter: (patch.letter || letterFromName(patch.name ?? item.name)).slice(0, 2)
    }
    const items = [...cat.items]
    items[itemIdx] = nextItem
    const list = [...groups.value]
    list[idx] = { ...cat, items }
    groups.value = list
    markDirty()
  }

  function removeSite(catId, siteId) {
    const idx = groups.value.findIndex((g) => g.id === catId)
    if (idx < 0) return
    const list = [...groups.value]
    list[idx] = {
      ...list[idx],
      items: list[idx].items.filter((it) => it.id !== siteId)
    }
    groups.value = list
    markDirty()
  }

  function moveSite(catId, siteId, dir) {
    const catIdx = groups.value.findIndex((g) => g.id === catId)
    if (catIdx < 0) return
    const cat = groups.value[catIdx]
    const idx = cat.items.findIndex((it) => it.id === siteId)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= cat.items.length) return
    const items = [...cat.items]
    ;[items[idx], items[next]] = [items[next], items[idx]]
    const list = [...groups.value]
    list[catIdx] = { ...cat, items }
    groups.value = list
    markDirty()
  }

  function findSite(siteId) {
    for (const g of groups.value) {
      const item = g.items.find((it) => it.id === siteId)
      if (item) return { group: g, site: item }
    }
    return null
  }

  function findSiteByUrl(url) {
    const target = String(url || '').trim()
    if (!target) return null
    for (const g of groups.value) {
      const item = g.items.find((it) => it.url === target)
      if (item) return { group: g, site: item }
    }
    return null
  }

  return {
    groups,
    dirty,
    siteCount,
    save,
    resetDefaults,
    exportJson,
    importJson,
    replaceAll,
    addCategory,
    updateCategory,
    removeCategory,
    moveCategory,
    addSite,
    updateSite,
    removeSite,
    moveSite,
    findSite,
    findSiteByUrl
  }
}
