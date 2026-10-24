const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  shell,
  net,
  session,
  nativeImage
} = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const crypto = require('crypto')

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5175'
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let mainWindow = null
let contentView = null
let loadedUrl = ''
let viewZoomFactor = 1
/** @type {Map<string, Electron.BrowserView>} */
const paneViews = new Map()
/** @type {Map<string, string>} */
const paneUrls = new Map()
const faviconCache = new Map()
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

function clampZoom(factor) {
  const n = Number(factor)
  if (!Number.isFinite(n)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 10) / 10))
}

function notifyZoomChanged(factor) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser-view:zoom-changed', factor)
  }
}

function listAttachedViews() {
  const attached = mainWindow?.getBrowserViews?.() || []
  if (attached.length) return attached
  return [...paneViews.values()].filter((view) => view && !view.webContents.isDestroyed())
}

function viewCanGoBack(wc) {
  if (!wc || wc.isDestroyed()) return false
  if (wc.navigationHistory) return wc.navigationHistory.canGoBack()
  return typeof wc.canGoBack === 'function' ? wc.canGoBack() : false
}

function viewCanGoForward(wc) {
  if (!wc || wc.isDestroyed()) return false
  if (wc.navigationHistory) return wc.navigationHistory.canGoForward()
  return typeof wc.canGoForward === 'function' ? wc.canGoForward() : false
}

function viewGoBack(wc) {
  if (!viewCanGoBack(wc)) return
  if (wc.navigationHistory) wc.navigationHistory.goBack()
  else wc.goBack()
}

function viewGoForward(wc) {
  if (!viewCanGoForward(wc)) return
  if (wc.navigationHistory) wc.navigationHistory.goForward()
  else wc.goForward()
}

function readNavState() {
  let canGoBack = false
  let canGoForward = false
  for (const view of listAttachedViews()) {
    if (!view || view.webContents.isDestroyed()) continue
    if (viewCanGoBack(view.webContents)) canGoBack = true
    if (viewCanGoForward(view.webContents)) canGoForward = true
  }
  return { canGoBack, canGoForward }
}

function notifyNavChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser-view:nav-changed', readNavState())
  }
}

function wireNavEvents(webContents) {
  if (!webContents || webContents.isDestroyed()) return
  const emit = () => notifyNavChanged()
  webContents.on('did-navigate', emit)
  webContents.on('did-navigate-in-page', emit)
  webContents.on('did-finish-load', emit)
  webContents.on('did-stop-loading', emit)
}

function goAttached(direction) {
  const forward = direction > 0
  for (const view of listAttachedViews()) {
    if (!view || view.webContents.isDestroyed()) continue
    if (forward) viewGoForward(view.webContents)
    else viewGoBack(view.webContents)
  }
  notifyNavChanged()
  return readNavState()
}

function applyZoomToView(view) {
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.setZoomFactor(viewZoomFactor)
  }
}

function applyViewZoom(factor) {
  viewZoomFactor = clampZoom(factor)
  applyZoomToView(contentView)
  for (const view of paneViews.values()) applyZoomToView(view)
  notifyZoomChanged(viewZoomFactor)
  return viewZoomFactor
}

function stepViewZoom(direction) {
  const dir = direction > 0 ? 1 : -1
  return applyViewZoom(viewZoomFactor + dir * ZOOM_STEP)
}

function detachAllViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    if (typeof mainWindow.setBrowserViews === 'function') {
      mainWindow.setBrowserViews([])
    }
  } catch {
    // ignore
  }
  for (const view of mainWindow.getBrowserViews()) {
    try {
      mainWindow.removeBrowserView(view)
    } catch {
      // ignore
    }
  }
  try {
    if (mainWindow.getBrowserView()) mainWindow.setBrowserView(null)
  } catch {
    // ignore
  }
}

function attachViews(views) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const list = views.filter(Boolean)
  detachAllViews()
  if (typeof mainWindow.setBrowserViews === 'function') {
    mainWindow.setBrowserViews(list)
    return
  }
  for (const view of list) {
    mainWindow.addBrowserView(view)
  }
}

function destroyPane(id) {
  const view = paneViews.get(id)
  if (!view) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.removeBrowserView(view)
    } catch {
      // ignore
    }
  }
  if (!view.webContents.isDestroyed()) {
    view.webContents.close()
  }
  paneViews.delete(id)
  paneUrls.delete(id)
}

function eachWebContents(fn) {
  if (contentView && !contentView.webContents.isDestroyed()) fn(contentView.webContents)
  for (const view of paneViews.values()) {
    if (view && !view.webContents.isDestroyed()) fn(view.webContents)
  }
}

function muteAllViews(muted) {
  eachWebContents((wc) => {
    try {
      wc.setAudioMuted(!!muted)
    } catch {
      // ignore
    }
  })
}

function pauseAllMedia() {
  eachWebContents((wc) => {
    wc.executeJavaScript(
      `(() => {
        document.querySelectorAll('video,audio').forEach((el) => {
          try { el.pause() } catch (e) {}
        })
        true
      })()`
    ).catch(() => {})
  })
}

async function unloadContentView() {
  if (!contentView || contentView.webContents.isDestroyed()) {
    loadedUrl = ''
    return
  }
  loadedUrl = ''
  try {
    contentView.webContents.setAudioMuted(true)
  } catch {
    // ignore
  }
  try {
    await contentView.webContents.loadURL('about:blank')
  } catch {
    // ignore
  }
}

async function unloadAllViews() {
  detachAllViews()
  muteAllViews(true)
  pauseAllMedia()
  for (const id of [...paneViews.keys()]) destroyPane(id)
  await unloadContentView()
}

function keepLinksInView(webContents) {
  if (!webContents || webContents.isDestroyed()) return
  webContents.setWindowOpenHandler(({ url }) => {
    const href = String(url || '').trim()
    if (/^https?:\/\//i.test(href)) {
      setImmediate(() => {
        if (!webContents.isDestroyed()) {
          webContents.loadURL(href).catch(() => {})
        }
      })
    }
    return { action: 'deny' }
  })
}

/** 从当前页提取书名/作者/封面（og:image 等） */
async function readPageMeta(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return { url: '', title: '', cover: '', author: '' }
  }
  const url = webContents.getURL()
  const title = webContents.getTitle()
  let meta = { cover: '', author: '', title: '' }
  try {
    meta = await webContents.executeJavaScript(
      `(() => {
        const abs = (u) => {
          try { return u ? new URL(u, location.href).href : '' } catch { return '' }
        }
        const metaContent = (sel) => {
          const el = document.querySelector(sel)
          return el ? (el.getAttribute('content') || '').trim() : ''
        }
        let cover =
          metaContent('meta[property="og:image"]') ||
          metaContent('meta[property="og:image:url"]') ||
          metaContent('meta[name="twitter:image"]') ||
          metaContent('meta[property="twitter:image"]') ||
          metaContent('meta[name="image"]') ||
          ''
        if (!cover) {
          const pick = document.querySelector([
            'img.wr_bookCover_img',
            'img[class*="bookCover"]',
            'img[class*="BookCover"]',
            'img[class*="book-cover"]',
            'img[class*="cover-img"]',
            '.wr_bookCover img',
            '.bookCover img',
            '.book-cover img',
            '[class*="cover"] img',
            'img[alt*="封面"]',
            'img[alt*="cover" i]'
          ].join(','))
          if (pick) cover = pick.currentSrc || pick.src || pick.getAttribute('data-src') || ''
        }
        if (!cover) {
          const bgEl = document.querySelector(
            '.wr_bookCover, [class*="bookCover"], [class*="BookCover"], [class*="book-cover"]'
          )
          if (bgEl) {
            const bg = window.getComputedStyle(bgEl).backgroundImage || ''
            const m = bg.match(/url\\([\"']?(.*?)[\"']?\\)/)
            if (m && m[1] && !m[1].startsWith('data:')) cover = m[1]
          }
        }
        if (!cover) {
          const imgs = Array.from(document.images || []).filter((img) => {
            const w = img.naturalWidth || img.width || 0
            const h = img.naturalHeight || img.height || 0
            if (w < 60 || h < 80) return false
            const src = img.currentSrc || img.src || ''
            if (!src || src.startsWith('data:')) return false
            if (/avatar|icon|logo|emoji|sprite|qrcode|loading/i.test(src)) return false
            return h >= w * 0.9
          })
          imgs.sort((a, b) => {
            const sa = (a.naturalWidth || a.width) * (a.naturalHeight || a.height)
            const sb = (b.naturalWidth || b.width) * (b.naturalHeight || b.height)
            return sb - sa
          })
          if (imgs[0]) cover = imgs[0].currentSrc || imgs[0].src
        }
        let author =
          metaContent('meta[property="books:author"]') ||
          metaContent('meta[property="og:book:author"]') ||
          metaContent('meta[name="author"]') ||
          ''
        if (!author) {
          const authorEl = document.querySelector([
            '.bookInfo_author',
            '.wr_bookInfo_author',
            '[class*="author"] a',
            '[class*="Author"] a',
            'a[href*="author"]'
          ].join(','))
          if (authorEl) author = (authorEl.textContent || '').trim()
        }
        author = author.replace(/^作者[：:]\\s*/u, '').replace(/\\s+/g, ' ').slice(0, 60)
        let pageTitle =
          metaContent('meta[property="og:title"]') ||
          metaContent('meta[name="twitter:title"]') ||
          metaContent('meta[name="title"]') ||
          ''
        // Steam 商店页标题常带「在 Steam 上购买」，优先取页面主标题
        const steamName =
          document.querySelector('#appHubAppName, .apphub_AppName')?.textContent?.trim() || ''
        if (steamName) pageTitle = steamName
        else if (/在\\s*Steam\\s*上/i.test(pageTitle) || /on\\s+Steam/i.test(pageTitle)) {
          const buy = pageTitle.match(/在\\s*Steam\\s*上(?:购买|下载|获取)\\s*(.+)$/i)
          const on = pageTitle.match(/^(.+?)\\s+on\\s+Steam/i)
          pageTitle = (buy && buy[1]) || (on && on[1]) || pageTitle
        }
        return {
          cover: abs(cover),
          author,
          title: (pageTitle || '').trim()
        }
      })()`,
      true
    )
  } catch {
    meta = { cover: '', author: '', title: '' }
  }
  return {
    url,
    title: (meta && meta.title) || title || '',
    cover: (meta && meta.cover) || '',
    author: (meta && meta.author) || ''
  }
}

async function getViewPageInfo(view) {
  if (!view || view.webContents.isDestroyed()) return null
  return readPageMeta(view.webContents)
}

function seedDuokanSearch(webContents) {
  if (!webContents || webContents.isDestroyed()) return
  webContents
    .executeJavaScript(
      `(() => {
        try {
          const u = new URL(location.href)
          const host = u.hostname.replace(/^www\\./, '')
          if (host !== 'duokan.com' || !u.pathname.includes('/pc/search-result')) return false
          const q = String(u.searchParams.get('s') || '').trim()
          if (!q) return false
          const raw = (history.state && typeof history.state === 'object') ? history.state : {}
          const got = raw.state && raw.state.searchQuery
          if (got === q) return false
          const flag = 'dk-search-seed:' + q
          if (sessionStorage.getItem(flag) === '1') return false
          sessionStorage.setItem(flag, '1')
          history.replaceState(
            { key: raw.key || 'dk-search', state: { searchQuery: q, jumpTopResult: true } },
            '',
            u.pathname + u.search + u.hash
          )
          location.reload()
          return true
        } catch (e) {
          return false
        }
      })()`
    )
    .catch(() => {})
}

function createPaneBrowserView(id) {
  const existing = paneViews.get(id)
  if (existing && !existing.webContents.isDestroyed()) return existing
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'view-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  view.setBackgroundColor('#ffffff')
  view.webContents.setUserAgent(CHROME_UA)
  view.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {})
  keepLinksInView(view.webContents)
  wireNavEvents(view.webContents)
  view.webContents.on('did-finish-load', () => {
    applyZoomToView(view)
    seedDuokanSearch(view.webContents)
  })
  paneViews.set(id, view)
  return view
}

function normalizeBounds(bounds) {
  return {
    x: Math.max(0, Math.round(bounds.x || 0)),
    y: Math.max(0, Math.round(bounds.y || 0)),
    width: Math.max(0, Math.round(bounds.width || 0)),
    height: Math.max(0, Math.round(bounds.height || 0))
  }
}

function hostnameFromUrl(pageUrl = '') {
  const raw = String(pageUrl || '').trim()
  if (!raw || raw === 'https://' || raw === 'http://') return ''
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function iconCandidates(icon = '', pageUrl = '') {
  const list = []
  const custom = String(icon || '').trim()
  if (/^https?:\/\//i.test(custom)) list.push(custom)
  const host = hostnameFromUrl(pageUrl)
  if (host) {
    const parts = host.split('.')
    const apex = parts.length > 2 ? parts.slice(-2).join('.') : ''
    const hosts = [host]
    if (apex && apex !== host) hosts.push(apex)
    for (const h of hosts) {
      list.push(
        `https://icon.horse/icon/${h}`,
        `https://favicon.qqsuu.cn/${h}`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`,
        `https://${h}/favicon.ico`,
        `https://${h}/favicon.png`
      )
    }
  }
  return [...new Set(list)]
}

function nodeFetchBuffer(imageUrl, redirectLeft = 4) {
  return new Promise((resolve, reject) => {
    const lib = imageUrl.startsWith('https') ? https : http
    const req = lib.get(
      imageUrl,
      {
        timeout: 10000,
        headers: {
          'User-Agent': CHROME_UA,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
      },
      (res) => {
        const status = res.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume()
          if (redirectLeft <= 0) {
            reject(new Error('too many redirects'))
            return
          }
          const next = new URL(res.headers.location, imageUrl).toString()
          nodeFetchBuffer(next, redirectLeft - 1).then(resolve, reject)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new Error(`HTTP ${status}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          resolve({
            buf: Buffer.concat(chunks),
            ctype: res.headers['content-type'] || ''
          })
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
  })
}

async function netFetchBuffer(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await net.fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return {
      buf: Buffer.from(await res.arrayBuffer()),
      ctype: res.headers.get('content-type') || ''
    }
  } finally {
    clearTimeout(timer)
  }
}

function looksLikeSvg(buf) {
  const head = buf.slice(0, 256).toString('utf8').replace(/^\uFEFF/, '').trim()
  return head.startsWith('<svg') || head.startsWith('<?xml') || /^<[^>]*svg/i.test(head)
}

/** favicon.qqsuu.cn 对无法解析的国外站会返回同一张无效占位图 */
const QQSUU_PLACEHOLDER_MD5 = '18ea864233008e0cffbfdafabbcf4989'

function isUselessFavicon(buf) {
  if (!buf || buf.length < 16) return true
  if (buf.length === 627) {
    const hash = crypto.createHash('md5').update(buf).digest('hex')
    if (hash === QQSUU_PLACEHOLDER_MD5) return true
  }
  return false
}

function toDataUrl(buf, ctype = '') {
  if (!buf || buf.length < 16) throw new Error('empty image')
  if (isUselessFavicon(buf)) throw new Error('placeholder favicon')

  // SVG：nativeImage 无法解析；纠正错误 Content-Type（如标成 image/x-icon）
  if (looksLikeSvg(buf)) {
    return `data:image/svg+xml;base64,${buf.toString('base64')}`
  }

  const img = nativeImage.createFromBuffer(buf)
  if (!img.isEmpty()) {
    const size = img.getSize()
    // 跳过 1x1 占位图
    if ((size.width || 0) > 1 && (size.height || 0) > 1) {
      const png = img.toPNG()
      if (png?.length) return `data:image/png;base64,${png.toString('base64')}`
    }
  }
  // PNG / JPEG / WebP magic
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return `data:image/png;base64,${buf.toString('base64')}`
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  }
  if (
    buf.length > 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return `data:image/webp;base64,${buf.toString('base64')}`
  }
  const type = (ctype || 'image/png').split(';')[0]
  if (!type.startsWith('image/')) throw new Error(`bad type ${type}`)
  return `data:${type};base64,${buf.toString('base64')}`
}

async function fetchImageDataUrl(imageUrl) {
  let lastErr
  for (const loader of [netFetchBuffer, nodeFetchBuffer]) {
    try {
      const { buf, ctype } = await loader(imageUrl)
      return toDataUrl(buf, ctype)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('fetch failed')
}

async function resolveFavicon({ icon, url } = {}) {
  const key = `${String(icon || '').trim()}|${String(url || '').trim()}`
  if (faviconCache.has(key)) return faviconCache.get(key)

  for (const candidate of iconCandidates(icon, url)) {
    try {
      const dataUrl = await fetchImageDataUrl(candidate)
      faviconCache.set(key, dataUrl)
      return dataUrl
    } catch {
      // try next
    }
  }

  faviconCache.set(key, '')
  return ''
}

function createContentView() {
  contentView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'view-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  contentView.setBackgroundColor('#ffffff')
  contentView.webContents.setUserAgent(CHROME_UA)
  contentView.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {})
  keepLinksInView(contentView.webContents)
  wireNavEvents(contentView.webContents)
  contentView.webContents.on('did-finish-load', () => {
    if (!contentView?.webContents.isDestroyed()) {
      contentView.webContents.setZoomFactor(viewZoomFactor)
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Designer网址导航',
    backgroundColor: '#f2f5f3',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  createContentView()
  mainWindow.webContents.setUserAgent(CHROME_UA)

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    for (const id of [...paneViews.keys()]) destroyPane(id)
    mainWindow = null
    contentView = null
    loadedUrl = ''
  })
}

function ensureViewAttached() {
  if (!mainWindow || !contentView) return
  attachViews([contentView])
}

ipcMain.handle('browser-view:show', async (_event, { id, url, bounds } = {}) => {
  if (!mainWindow) return { ok: false }
  const viewId = String(id || 'main')
  const view = createPaneBrowserView(viewId)
  muteAllViews(true)
  attachViews([view])
  if (bounds) view.setBounds(normalizeBounds(bounds))
  try {
    view.webContents.setAudioMuted(false)
  } catch {
    // ignore
  }
  if (url && paneUrls.get(viewId) !== url) {
    paneUrls.set(viewId, url)
    try {
      await view.webContents.loadURL(url)
    } catch {
      // ignore load abort
    }
  }
  applyZoomToView(view)
  notifyNavChanged()
  return { ok: true }
})

ipcMain.handle('browser-view:show-panes', async (_event, { panes } = {}) => {
  if (!mainWindow) return { ok: false }
  const list = Array.isArray(panes) ? panes : []
  if (!list.length) {
    detachAllViews()
    muteAllViews(true)
    pauseAllMedia()
    return { ok: true }
  }

  const orderedViews = []
  for (const pane of list) {
    if (!pane?.id || !pane.url || !pane.bounds) continue
    const b = normalizeBounds(pane.bounds)
    if (b.width < 8 || b.height < 8) continue
    const view = createPaneBrowserView(pane.id)
    orderedViews.push({ view, pane, bounds: b })
  }

  if (!orderedViews.length) {
    detachAllViews()
    return { ok: false, reason: 'no-valid-bounds' }
  }

  muteAllViews(true)
  attachViews(orderedViews.map((x) => x.view))

  for (const { view, pane, bounds } of orderedViews) {
    view.setBounds(bounds)
    const needLoad = paneUrls.get(pane.id) !== pane.url
    if (needLoad) {
      paneUrls.set(pane.id, pane.url)
      try {
        await view.webContents.loadURL(pane.url)
      } catch {
        // ignore
      }
    }
    try {
      view.webContents.setAudioMuted(false)
    } catch {
      // ignore
    }
    applyZoomToView(view)
  }

  for (const { view, bounds } of orderedViews) {
    view.setBounds(bounds)
  }

  notifyNavChanged()
  return { ok: true, count: orderedViews.length }
})

ipcMain.handle('browser-view:set-bounds', (_event, bounds) => {
  if (!mainWindow) return { ok: false }
  const attached = mainWindow.getBrowserViews?.() || []
  if (!attached.length) return { ok: false }
  const b = normalizeBounds(bounds)
  attached[0].setBounds(b)
  return { ok: true }
})

ipcMain.handle('browser-view:hide', () => {
  detachAllViews()
  muteAllViews(true)
  pauseAllMedia()
  notifyNavChanged()
  return { ok: true }
})

ipcMain.handle('browser-view:unload', async () => {
  await unloadAllViews()
  return { ok: true }
})

ipcMain.handle('browser-view:destroy', (_event, { ids } = {}) => {
  const list = Array.isArray(ids) && ids.length ? ids : [...paneViews.keys()]
  for (const id of list) destroyPane(id)
  return { ok: true }
})

ipcMain.handle('browser-view:reload', () => {
  for (const view of listAttachedViews()) {
    if (view && !view.webContents.isDestroyed()) view.webContents.reload()
  }
  notifyNavChanged()
  return { ok: true }
})

ipcMain.handle('browser-view:go-back', () => goAttached(-1))

ipcMain.handle('browser-view:go-forward', () => goAttached(1))

ipcMain.handle('browser-view:get-nav-state', () => readNavState())

ipcMain.handle('browser-view:open-external', async (_event, url) => {
  if (url) await shell.openExternal(url)
  return { ok: true }
})

ipcMain.handle('browser-view:get-current', async (_event, { paneId } = {}) => {
  if (paneId && paneViews.has(paneId)) {
    const view = paneViews.get(paneId)
    const meta = await getViewPageInfo(view)
    if (meta) {
      return { mode: 'pane', paneId, ...meta }
    }
  }
  const attached = (mainWindow && !mainWindow.isDestroyed() && mainWindow.getBrowserViews?.()) || []
  if (attached.length === 1) {
    const meta = await getViewPageInfo(attached[0])
    if (meta) return { mode: 'single', ...meta }
  }
  if (attached.length > 1) {
    const urls = {}
    const titles = {}
    const covers = {}
    const authors = {}
    for (const [id, view] of paneViews) {
      if (!attached.includes(view)) continue
      const meta = await getViewPageInfo(view)
      if (!meta) continue
      urls[id] = meta.url
      titles[id] = meta.title
      covers[id] = meta.cover
      authors[id] = meta.author
    }
    const firstId = Object.keys(urls)[0]
    return {
      mode: 'panes',
      urls,
      titles,
      covers,
      authors,
      url: firstId ? urls[firstId] : '',
      title: firstId ? titles[firstId] : '',
      cover: firstId ? covers[firstId] : '',
      author: firstId ? authors[firstId] : ''
    }
  }
  if (contentView && !contentView.webContents.isDestroyed()) {
    const meta = await readPageMeta(contentView.webContents)
    return { mode: 'single', ...meta }
  }
  return { mode: 'none', url: '', title: '', cover: '', author: '' }
})

ipcMain.handle('browser-view:get-zoom', () => viewZoomFactor)

ipcMain.handle('browser-view:set-zoom', (_event, factor) => applyViewZoom(factor))

ipcMain.handle('browser-view:zoom-step', (_event, direction) => stepViewZoom(direction))

ipcMain.handle('browser-view:zoom-reset', () => applyViewZoom(1))

ipcMain.handle('favicon:resolve', async (_event, payload) => {
  try {
    return await resolveFavicon(payload || {})
  } catch {
    return ''
  }
})

app.whenReady().then(async () => {
  try {
    await session.defaultSession.setProxy({ mode: 'system' })
  } catch {
    // ignore
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
