const { ipcRenderer } = require('electron')

try {
  const href = String(location.href || '')
  const u = new URL(href)
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'duokan.com' && u.pathname.includes('/pc/search-result')) {
    const q = String(u.searchParams.get('s') || '').trim()
    const raw = (history.state && typeof history.state === 'object') ? history.state : {}
    const got = raw.state && raw.state.searchQuery
    if (q && got !== q) {
      history.replaceState(
        { key: raw.key || 'dk-search', state: { searchQuery: q, jumpTopResult: true } },
        '',
        u.pathname + u.search + u.hash
      )
    }
  }
} catch {
  // ignore
}

function isZoomModifier(e) {
  return e.ctrlKey || e.metaKey
}

window.addEventListener(
  'wheel',
  (e) => {
    if (!isZoomModifier(e)) return
    e.preventDefault()
    const direction = e.deltaY > 0 ? -1 : 1
    ipcRenderer.invoke('browser-view:zoom-step', direction)
  },
  { passive: false, capture: true }
)

window.addEventListener(
  'keydown',
  (e) => {
    if (!isZoomModifier(e)) return
    const key = e.key
    if (key === '+' || key === '=' || key === 'Add') {
      e.preventDefault()
      ipcRenderer.invoke('browser-view:zoom-step', 1)
    } else if (key === '-' || key === '_' || key === 'Subtract') {
      e.preventDefault()
      ipcRenderer.invoke('browser-view:zoom-step', -1)
    } else if (key === '0' || key === 'Digit0') {
      e.preventDefault()
      ipcRenderer.invoke('browser-view:zoom-reset')
    }
  },
  { capture: true }
)
