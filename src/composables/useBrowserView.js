import { nextTick } from 'vue'

export function isElectronApp() {
  return typeof window !== 'undefined' && !!window.navDesktop?.isElectron
}

/**
 * 右侧内容：单页 BrowserView，或聚合搜索多窗格。
 * getPanes: () => [{ id, url, el }] | null  （null 时回退单页 getTargetEl/getUrl）
 */
export function useBrowserView({ getTargetEl, getUrl, getViewId, getPanes, isActive, keepAlive }) {
  let resizeObserver = null
  let onWinResize = null
  let attached = false
  const observed = new Set()

  function readBounds(el) {
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) return null
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    }
  }

  function collectPanes() {
    if (typeof getPanes === 'function') {
      const panes = getPanes()
      if (Array.isArray(panes) && panes.length) return panes
    }
    const el = typeof getTargetEl === 'function' ? getTargetEl() : null
    const url = typeof getUrl === 'function' ? getUrl() : ''
    if (!el || !url) return []
    const id = typeof getViewId === 'function' ? getViewId() : 'main'
    return [{ id: id || 'main', url, el }]
  }

  async function sync() {
    if (!isElectronApp()) return
    const active = typeof isActive === 'function' ? isActive() : true
    const panes = collectPanes()

    if (!active || !panes.length) {
      await window.navDesktop.hideView()
      return
    }

    if (panes.length === 1) {
      const bounds = readBounds(panes[0].el)
      if (!bounds) {
        await window.navDesktop.hideView()
        return
      }
      await window.navDesktop.showView({ id: panes[0].id, url: panes[0].url, bounds })
      return
    }

    const payload = []
    for (const pane of panes) {
      const bounds = readBounds(pane.el)
      if (!bounds || !pane.url) continue
      payload.push({ id: pane.id, url: pane.url, bounds })
    }
    if (!payload.length) {
      await window.navDesktop.hideView()
      return
    }
    await window.navDesktop.showPanes({ panes: payload })
  }

  async function hide() {
    if (isElectronApp()) await window.navDesktop.hideView()
  }

  async function unload() {
    if (!isElectronApp()) return
    if (window.navDesktop.unloadView) await window.navDesktop.unloadView()
    else await hide()
  }

  async function destroyViews(ids) {
    if (!isElectronApp() || !window.navDesktop.destroyViews) return
    await window.navDesktop.destroyViews({ ids: Array.isArray(ids) ? ids : [] })
  }

  async function reload() {
    if (isElectronApp()) await window.navDesktop.reload()
  }

  async function goBack() {
    if (!isElectronApp() || !window.navDesktop.goBack) return { canGoBack: false, canGoForward: false }
    return (await window.navDesktop.goBack()) || { canGoBack: false, canGoForward: false }
  }

  async function goForward() {
    if (!isElectronApp() || !window.navDesktop.goForward) {
      return { canGoBack: false, canGoForward: false }
    }
    return (await window.navDesktop.goForward()) || { canGoBack: false, canGoForward: false }
  }

  async function getNavState() {
    if (!isElectronApp() || !window.navDesktop.getNavState) {
      return { canGoBack: false, canGoForward: false }
    }
    return (await window.navDesktop.getNavState()) || { canGoBack: false, canGoForward: false }
  }

  function onNavChanged(handler) {
    if (!isElectronApp() || !window.navDesktop.onNavChanged) return () => {}
    return window.navDesktop.onNavChanged(handler)
  }

  async function openExternal(url) {
    if (isElectronApp() && url) await window.navDesktop.openExternal(url)
  }

  async function getCurrentPage(payload) {
    if (!isElectronApp() || !window.navDesktop.getCurrentPage) return null
    try {
      return await window.navDesktop.getCurrentPage(payload || {})
    } catch {
      return null
    }
  }

  async function getZoom() {
    if (!isElectronApp()) return 1
    return (await window.navDesktop.getZoom()) || 1
  }

  async function setZoom(factor) {
    if (!isElectronApp()) return factor
    return window.navDesktop.setZoom(factor)
  }

  async function zoomStep(direction) {
    if (!isElectronApp()) return null
    return window.navDesktop.zoomStep(direction)
  }

  async function zoomReset() {
    if (!isElectronApp()) return 1
    return window.navDesktop.zoomReset()
  }

  function onZoomChanged(handler) {
    if (!isElectronApp() || !window.navDesktop.onZoomChanged) return () => {}
    return window.navDesktop.onZoomChanged(handler)
  }

  function observeEl(el) {
    if (!el || !resizeObserver || observed.has(el)) return
    resizeObserver.observe(el)
    observed.add(el)
  }

  function refreshObservers() {
    if (!resizeObserver) return
    for (const el of observed) {
      try {
        resizeObserver.unobserve(el)
      } catch {
        // ignore
      }
    }
    observed.clear()
    for (const pane of collectPanes()) observeEl(pane.el)
    const root = typeof getTargetEl === 'function' ? getTargetEl() : null
    observeEl(root)
  }

  function attach() {
    if (!isElectronApp() || attached) return
    attached = true
    onWinResize = () => {
      sync()
    }
    window.addEventListener('resize', onWinResize)
    nextTick(() => {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => sync())
      }
      refreshObservers()
      sync()
    })
  }

  function detach() {
    if (onWinResize) window.removeEventListener('resize', onWinResize)
    resizeObserver?.disconnect()
    resizeObserver = null
    observed.clear()
    onWinResize = null
    attached = false
    hide()
  }

  return {
    sync,
    hide,
    unload,
    destroyViews,
    reload,
    goBack,
    goForward,
    getNavState,
    onNavChanged,
    openExternal,
    getCurrentPage,
    attach,
    detach,
    refreshObservers,
    getZoom,
    setZoom,
    zoomStep,
    zoomReset,
    onZoomChanged,
    isElectron: isElectronApp
  }
}
