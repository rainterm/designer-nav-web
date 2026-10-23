import { computed, ref } from 'vue'

export const HOME_TAB_ID = 'home'
export const BOOKS_TAB_ID = 'books'
export const MOVIES_TAB_ID = 'movies'
export const GAMES_TAB_ID = 'games'

const HOME_TAB = {
  id: HOME_TAB_ID,
  name: '首页',
  url: '',
  icon: '',
  letter: '首',
  desc: '聚合搜索',
  pinned: true,
  isHome: true
}

const BOOKS_TAB = {
  id: BOOKS_TAB_ID,
  name: '书籍',
  url: '',
  icon: '',
  letter: '书',
  desc: '收藏与阅读',
  pinned: true,
  isBooks: true
}

const MOVIES_TAB = {
  id: MOVIES_TAB_ID,
  name: '电影',
  url: '',
  icon: '',
  letter: '影',
  desc: '收藏与观看',
  pinned: true,
  isMovies: true
}

const GAMES_TAB = {
  id: GAMES_TAB_ID,
  name: '游戏',
  url: '',
  icon: '',
  letter: '游',
  desc: '收藏与打开',
  pinned: true,
  isGames: true
}

const PINNED_TABS = [HOME_TAB, BOOKS_TAB, MOVIES_TAB, GAMES_TAB]
const PINNED_IDS = new Set(PINNED_TABS.map((t) => t.id))

function clonePinned() {
  return PINNED_TABS.map((t) => ({ ...t }))
}

/**
 * 多标签：首页 / 书籍 / 电影 / 游戏固定；侧栏站点 / 搜索结果可并存。
 */
export function useTabs() {
  const tabs = ref(clonePinned())
  const activeTabId = ref(HOME_TAB_ID)
  const tabHistory = []

  const activeSite = computed(() => {
    if (!activeTabId.value || activeTabId.value === HOME_TAB_ID) return null
    return tabs.value.find((t) => t.id === activeTabId.value) || null
  })

  function hasTab(tabId) {
    return tabs.value.some((t) => t.id === tabId)
  }

  function setActiveTab(tabId) {
    if (!tabId || !hasTab(tabId)) return
    const cur = activeTabId.value
    if (cur && cur !== tabId) {
      tabHistory.push(cur)
      if (tabHistory.length > 50) tabHistory.splice(0, tabHistory.length - 50)
    }
    activeTabId.value = tabId
  }

  function restorePrevious(closedId) {
    while (tabHistory.length) {
      const id = tabHistory.pop()
      if (id && id !== closedId && hasTab(id)) {
        activeTabId.value = id
        return
      }
    }
    activeTabId.value = HOME_TAB_ID
  }

  function rewriteHistory(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    for (let i = 0; i < tabHistory.length; i++) {
      if (tabHistory[i] === fromId) tabHistory[i] = toId
    }
  }

  function ensurePinnedOrder() {
    const pinned = PINNED_TABS.map((def) => {
      const found = tabs.value.find((t) => t.id === def.id)
      return { ...(found || def) }
    })
    const rest = tabs.value.filter((t) => !PINNED_IDS.has(t.id))
    tabs.value = [...pinned, ...rest]
  }

  function openSite(site, { activate = true } = {}) {
    if (!site?.id || PINNED_IDS.has(site.id)) return
    if (site.ephemeral) {
      tabs.value.push({
        id: site.id,
        name: site.name,
        url: site.url,
        icon: site.icon || '',
        letter: site.letter || '',
        desc: site.desc || '',
        ephemeral: true,
        searchQuery: site.searchQuery || '',
        searchType: site.searchType || '',
        isSearchBoard: !!site.isSearchBoard,
        panes: Array.isArray(site.panes) ? site.panes : undefined
      })
      ensurePinnedOrder()
      if (activate) setActiveTab(site.id)
      return
    }

    const existing = tabs.value.find((t) => t.id === site.id && !t.ephemeral && !t.pinned)
    if (existing) {
      existing.name = site.name
      existing.url = site.url
      existing.icon = site.icon || ''
      existing.letter = site.letter || ''
      existing.desc = site.desc || ''
      if (activate) setActiveTab(existing.id)
      return
    }
    tabs.value.push({
      id: site.id,
      name: site.name,
      url: site.url,
      icon: site.icon || '',
      letter: site.letter || '',
      desc: site.desc || ''
    })
    ensurePinnedOrder()
    if (activate) setActiveTab(site.id)
  }

  function openSites(sites = []) {
    const list = (sites || []).filter((s) => s?.id && s?.url)
    if (!list.length) return
    list.forEach((site, index) => {
      openSite(site, { activate: index === 0 })
    })
  }

  function activateTab(tabId) {
    setActiveTab(tabId)
  }

  function goHome() {
    ensurePinnedOrder()
    setActiveTab(HOME_TAB_ID)
  }

  function goBooks() {
    ensurePinnedOrder()
    setActiveTab(BOOKS_TAB_ID)
  }

  function goMovies() {
    ensurePinnedOrder()
    setActiveTab(MOVIES_TAB_ID)
  }

  function goGames() {
    ensurePinnedOrder()
    setActiveTab(GAMES_TAB_ID)
  }

  function closeTab(tabId) {
    if (PINNED_IDS.has(tabId)) return
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx < 0) return
    const wasActive = activeTabId.value === tabId
    tabs.value.splice(idx, 1)
    ensurePinnedOrder()
    if (wasActive) restorePrevious(tabId)
  }

  /** 关闭一屏搜索中的某个引擎窗格；剩 0 个则关标签，剩 1 个则收成单页 */
  function closeSearchPane(tabId, paneId) {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx < 0) return
    const tab = tabs.value[idx]
    if (!tab?.isSearchBoard || !Array.isArray(tab.panes)) return
    const panes = tab.panes.filter((p) => p.id !== paneId)
    if (!panes.length) {
      closeTab(tabId)
      return
    }
    if (panes.length === 1) {
      const only = panes[0]
      const nextId = only.id || tab.id
      tabs.value[idx] = {
        id: nextId,
        name: only.name,
        url: only.url,
        icon: only.icon || '',
        letter: only.letter || '',
        desc: tab.searchQuery
          ? `${
              tab.searchType === 'game'
                ? '游戏'
                : tab.searchType === 'movie'
                  ? '电影'
                  : tab.searchType === 'book'
                    ? '图书'
                    : '搜索'
            }：${tab.searchQuery}`
          : only.desc || '',
        ephemeral: true,
        searchQuery: tab.searchQuery || '',
        searchType: tab.searchType || ''
      }
      if (activeTabId.value === tabId) {
        rewriteHistory(tabId, nextId)
        activeTabId.value = nextId
      }
      ensurePinnedOrder()
      return
    }
    const kind =
      tab.searchType === 'game'
        ? '游戏'
        : tab.searchType === 'movie'
          ? '电影'
          : tab.searchType === 'book'
            ? '图书'
            : '搜索'
    tabs.value[idx] = {
      ...tab,
      panes,
      url: panes[0].url,
      desc: tab.searchQuery
        ? `${kind}：${tab.searchQuery}（${panes.length} 个）`
        : `${panes.length} 个引擎`
    }
  }

  function closeOtherTabs(tabId) {
    tabHistory.length = 0
    if (PINNED_IDS.has(tabId)) {
      tabs.value = clonePinned()
      activeTabId.value = tabId
      return
    }
    const keep = tabs.value.find((t) => t.id === tabId && !t.pinned)
    tabs.value = keep ? [...clonePinned(), keep] : clonePinned()
    activeTabId.value = keep ? keep.id : HOME_TAB_ID
  }

  function closeAllTabs() {
    tabHistory.length = 0
    tabs.value = clonePinned()
    activeTabId.value = HOME_TAB_ID
  }

  function reorderTabs(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    if (PINNED_IDS.has(fromId)) return

    const list = [...tabs.value]
    const fromIdx = list.findIndex((t) => t.id === fromId)
    if (fromIdx < 0) return

    const [item] = list.splice(fromIdx, 1)
    let insertAt = list.findIndex((t) => t.id === toId)
    if (insertAt < 0) insertAt = list.length
    const pinnedCount = PINNED_TABS.length
    if (PINNED_IDS.has(toId) || insertAt < pinnedCount) insertAt = pinnedCount

    list.splice(insertAt, 0, item)
    tabs.value = list
    ensurePinnedOrder()
  }

  function syncFromGroups(groups) {
    const flat = new Map()
    for (const g of groups || []) {
      for (const it of g.items || []) flat.set(it.id, it)
    }
    const next = clonePinned()
    for (const tab of tabs.value) {
      if (PINNED_IDS.has(tab.id) || tab.pinned) continue
      if (tab.ephemeral) {
        next.push(tab)
        continue
      }
      const site = flat.get(tab.id)
      if (!site) continue
      next.push({
        id: site.id,
        name: site.name,
        url: site.url,
        icon: site.icon || '',
        letter: site.letter || '',
        desc: site.desc || ''
      })
    }
    tabs.value = next
    if (activeTabId.value && !next.some((t) => t.id === activeTabId.value)) {
      restorePrevious(activeTabId.value)
    }
  }

  return {
    tabs,
    activeTabId,
    activeSite,
    HOME_TAB_ID,
    BOOKS_TAB_ID,
    MOVIES_TAB_ID,
    GAMES_TAB_ID,
    openSite,
    openSites,
    activateTab,
    goHome,
    goBooks,
    goMovies,
    goGames,
    closeTab,
    closeSearchPane,
    closeOtherTabs,
    closeAllTabs,
    reorderTabs,
    syncFromGroups
  }
}
