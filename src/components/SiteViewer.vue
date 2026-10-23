<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSelect, NSpace, useMessage } from 'naive-ui'
import { useBrowserView } from '@/composables/useBrowserView'
import { useBooks, DEFAULT_GROUP_ID } from '@/composables/useBooks'
import { useMovies, DEFAULT_MOVIE_GROUP_ID } from '@/composables/useMovies'
import { useGames, DEFAULT_GAME_GROUP_ID } from '@/composables/useGames'
import { useSites } from '@/composables/useSites'
import AggregateSearch from '@/components/AggregateSearch.vue'
import BooksShelf from '@/components/BooksShelf.vue'
import MoviesShelf from '@/components/MoviesShelf.vue'
import GamesShelf from '@/components/GamesShelf.vue'
import SiteFavicon from '@/components/SiteFavicon.vue'
import { pickBookCover } from '@/utils/bookCover'
import { iconFromSiteUrl } from '@/utils/favicon'
import { letterFromName } from '@/data/defaultSites'

const props = defineProps({
  site: { type: Object, default: null },
  collapsed: { type: Boolean, default: false },
  /** 编辑抽屉打开时隐藏 BrowserView，避免挡住弹层 */
  overlayOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['select-site', 'search', 'open-site', 'close-tab', 'close-pane'])

const message = useMessage()
const { addBook, findByUrl: findBookByUrl, groups: bookGroups, addGroup: addBookGroup } = useBooks()
const {
  addMovie,
  findByUrl: findMovieByUrl,
  groups: movieGroups,
  addGroup: addMovieGroup
} = useMovies()
const {
  addGame,
  findByUrl: findGameByUrl,
  groups: gameGroups,
  addGroup: addGameGroup
} = useGames()
const {
  groups: siteGroups,
  addSite,
  updateSite,
  findSiteByUrl,
  addCategory,
  save: saveSites
} = useSites()

const collectOpen = ref(false)
const newGroupOpen = ref(false)
const newGroupName = ref('')
const collectForm = reactive({
  title: '',
  author: '',
  year: '',
  url: '',
  cover: '',
  note: '',
  groupId: DEFAULT_GROUP_ID
})

const isBookSearch = computed(
  () => props.site?.searchType === 'book' || !!props.site?.id?.startsWith?.('book-search')
)

const isMovieSearch = computed(
  () => props.site?.searchType === 'movie' || !!props.site?.id?.startsWith?.('movie-search')
)

const isGameSearch = computed(
  () => props.site?.searchType === 'game' || !!props.site?.id?.startsWith?.('game-search')
)

/** book | movie | game | site */
const collectKind = computed(() => {
  if (isMovieSearch.value) return 'movie'
  if (isGameSearch.value) return 'game'
  if (isBookSearch.value) return 'book'
  return 'site'
})

const collectAsMovie = computed(() => collectKind.value === 'movie')
const collectAsGame = computed(() => collectKind.value === 'game')
const collectAsBook = computed(() => collectKind.value === 'book')
const collectAsSite = computed(() => collectKind.value === 'site')

const collectGroupOptions = computed(() => {
  if (collectKind.value === 'movie') {
    return movieGroups.value.map((g) => ({ label: g.name, value: g.id }))
  }
  if (collectKind.value === 'game') {
    return gameGroups.value.map((g) => ({ label: g.name, value: g.id }))
  }
  if (collectKind.value === 'book') {
    return bookGroups.value.map((g) => ({ label: g.name, value: g.id }))
  }
  return siteGroups.value.map((g) => ({ label: g.category, value: g.id }))
})

const canCollect = computed(() => {
  if (!props.site?.url && !props.site?.isSearchBoard) return false
  if (props.site.isBooks || props.site.isMovies || props.site.isGames || props.site.isHome) {
    return false
  }
  return mode.value === 'frame' || mode.value === 'board' || mode.value === 'error'
})

const collectButtonLabel = computed(() => {
  if (collectKind.value === 'movie') return '收藏到片单'
  if (collectKind.value === 'game') return '收藏到游戏库'
  if (collectKind.value === 'book') return '收藏到书架'
  return '收藏网站'
})

const collectSaveLabel = computed(() => {
  if (collectKind.value === 'movie') return '保存到片单'
  if (collectKind.value === 'game') return '保存到游戏库'
  if (collectKind.value === 'book') return '保存到书架'
  return '保存到导航'
})

function isLikelySearchUrl(url = '') {
  const u = String(url)
  return /\/search(?:\/|\?|$)/i.test(u) || /[?&](?:query|q|keyword|word|search|term)=/i.test(u)
}

function cleanMediaTitle(raw = '', fallback = '') {
  let t = String(raw || '').trim()
  if (!t) return String(fallback || '').trim()

  // Steam / 商店常见标题：「在 Steam 上购买 XXX」「Buy XXX on Steam」
  let m = t.match(/在\s*Steam\s*上(?:购买|下载|获取)\s*(.+)$/i)
  if (m?.[1]) t = m[1].trim()
  m = t.match(/^Buy\s+(.+?)\s+on\s+Steam$/i)
  if (m?.[1]) t = m[1].trim()
  m = t.match(/^(.+?)\s+on\s+Steam(?:\s|$)/i)
  if (m?.[1]) t = m[1].trim()
  m = t.match(/在\s*(?:Epic|WeGame|Xbox|PlayStation|Nintendo|TapTap).{0,12}(?:购买|获取|下载)\s*(.+)$/i)
  if (m?.[1]) t = m[1].trim()

  // 去掉站点后缀，但不要误伤「在 Steam 上购买」已处理过的正文
  t = t
    .replace(
      /\s*[|\-_·—]\s*(?:番茄小说|番茄小说网|微信读书|豆瓣读书|豆瓣电影|爱奇艺|优酷|腾讯视频|哔哩哔哩|哔哩哔哩漫画|腾讯动漫|快看漫画|芒果TV|IMDb|Steam|TapTap|好游快爆|游民星空|Xbox|Nintendo|Switch|PlayStation|itch\.io|4399|7k7k|Poki|CrazyGames|起点中文网|晋江文学城|七猫小说|书旗小说|搜狗|百度|在线玩|在线观看).*$/i,
      ''
    )
    .replace(/\s*[-|_].*(搜索|search).*$/i, '')
    .replace(/\s*搜索$/, '')
    .replace(/^在\s*$/u, '')
    .trim()

  // 清理后过短或无意义 → 用搜索词 / 兜底
  const fb = String(fallback || '').trim()
  if (!t || t.length <= 1 || /^(在|的|了|和|与|买|购)$/u.test(t)) return fb || t
  return t
}

function pickCollectTitle(pageTitle, fallbacks = []) {
  const list = fallbacks.map((x) => String(x || '').trim()).filter(Boolean)
  const cleaned = cleanMediaTitle(pageTitle, '')
  if (cleaned && cleaned.length > 1) return cleaned
  return list[0] || cleaned || ''
}

async function resolveLivePage(paneId) {
  try {
    return await getCurrentPage(paneId ? { paneId } : {})
  } catch {
    return null
  }
}

function defaultCollectGroupId() {
  if (collectKind.value === 'movie') return DEFAULT_MOVIE_GROUP_ID
  if (collectKind.value === 'game') return DEFAULT_GAME_GROUP_ID
  if (collectKind.value === 'book') return DEFAULT_GROUP_ID
  return siteGroups.value[0]?.id || ''
}

function unnamedCollectTitle() {
  if (collectKind.value === 'movie') return '未命名电影'
  if (collectKind.value === 'game') return '未命名游戏'
  if (collectKind.value === 'book') return '未命名书籍'
  return '未命名网站'
}

function findCollectByUrl(url) {
  if (collectKind.value === 'movie') return findMovieByUrl(url)
  if (collectKind.value === 'game') return findGameByUrl(url)
  if (collectKind.value === 'book') return findBookByUrl(url)
  const hit = findSiteByUrl(url)
  return hit?.site || null
}

function platformFromUrl(url = '') {
  const u = String(url || '')
  if (/steampowered\.com|steamcommunity\.com/i.test(u)) return 'Steam'
  if (/taptap\./i.test(u)) return 'TapTap'
  if (/3839\.com/i.test(u)) return '好游快爆'
  if (/xbox\.com/i.test(u)) return 'Xbox'
  if (/playstation\.com/i.test(u)) return 'PlayStation'
  if (/nintendo\./i.test(u)) return 'Switch'
  if (/itch\.io/i.test(u)) return 'itch.io'
  if (/4399\.com/i.test(u)) return '4399'
  if (/7k7k\.com/i.test(u)) return '7k7k'
  if (/poki\.com/i.test(u)) return 'Poki'
  if (/crazygames\.com/i.test(u)) return 'CrazyGames'
  return ''
}

async function openCollect(source, paneId) {
  let live = null
  try {
    live = await resolveLivePage(paneId)
  } catch {
    live = null
  }
  const board = props.site
  const unnamed = unnamedCollectTitle()

  if (!source && board?.isSearchBoard && board.panes?.length) {
    const pane = board.panes[0]
    const liveUrl = live?.urls?.[pane.id] || live?.url || pane.url
    const liveTitle = live?.titles?.[pane.id] || live?.title || ''
    const liveCover = live?.covers?.[pane.id] || live?.cover || ''
    const liveAuthor = live?.authors?.[pane.id] || live?.author || ''
    collectForm.title = pickCollectTitle(liveTitle, [
      board.searchQuery,
      pane.name,
      unnamed
    ])
    collectForm.author =
      collectKind.value === 'game'
        ? liveAuthor || platformFromUrl(liveUrl)
        : collectKind.value === 'site'
          ? ''
          : liveAuthor
    collectForm.year = ''
    collectForm.url = liveUrl
    collectForm.cover = pickBookCover(liveCover, liveUrl) || iconFromSiteUrl(liveUrl)
    collectForm.note = board.desc || ''
    collectForm.groupId = defaultCollectGroupId()
    await showCollectModal(liveUrl)
    return
  }

  const src = source || props.site
  const liveUrl = live?.url || src?.url
  if (!liveUrl) {
    message.warning('当前页没有可收藏的地址')
    return
  }
  const existed = findCollectByUrl(liveUrl)
  const siteHit = collectKind.value === 'site' ? findSiteByUrl(liveUrl) : null
  const fromPage = pickCollectTitle(live?.title || '', [
    src.searchQuery,
    existed?.title || existed?.name,
    src.name,
    unnamed
  ])
  collectForm.title = existed?.title || existed?.name || fromPage || unnamed
  collectForm.author =
    collectKind.value === 'site'
      ? ''
      : existed?.author ||
        existed?.director ||
        existed?.platform ||
        live?.author ||
        (collectKind.value === 'game' ? platformFromUrl(liveUrl) : '')
  collectForm.year = existed?.year || ''
  collectForm.url = liveUrl
  collectForm.cover =
    pickBookCover(live?.cover || existed?.cover || existed?.icon, liveUrl) ||
    iconFromSiteUrl(liveUrl)
  collectForm.note = existed?.note || existed?.desc || src.desc || ''
  collectForm.groupId =
    siteHit?.group?.id || existed?.groupId || defaultCollectGroupId()
  await showCollectModal(liveUrl)
}

async function showCollectModal(liveUrl) {
  await hide()
  newGroupOpen.value = false
  newGroupName.value = ''
  collectOpen.value = true
  await nextTick()
  if (collectKind.value === 'site') return
  if (isLikelySearchUrl(liveUrl)) {
    const tip =
      collectKind.value === 'movie'
        ? '当前还是搜索列表，请先点进影片详情再收藏'
        : collectKind.value === 'game'
          ? '当前还是搜索列表，请先点进游戏详情再收藏'
          : '当前还是搜索列表，请先点进书籍详情再收藏'
    message.warning(tip)
  }
}

async function openCollectPane(pane) {
  await openCollect(
    {
      name: pane.name,
      url: pane.url,
      desc: props.site?.searchQuery ? `搜索：${props.site.searchQuery}` : pane.desc || '',
      searchQuery: props.site?.searchQuery || ''
    },
    pane.id
  )
}

function confirmCollect() {
  const title = collectForm.title.trim()
  const url = collectForm.url.trim()
  if (!title) {
    message.warning(
      collectKind.value === 'movie'
        ? '请填写片名'
        : collectKind.value === 'game'
          ? '请填写游戏名'
          : collectKind.value === 'site'
            ? '请填写网站名'
            : '请填写书名'
    )
    return
  }
  if (!url) {
    message.warning(
      collectKind.value === 'movie'
        ? '缺少观看地址'
        : collectKind.value === 'game'
          ? '缺少游戏地址'
          : collectKind.value === 'site'
            ? '缺少网站地址'
            : '缺少阅读地址'
    )
    return
  }
  if (collectKind.value === 'movie') {
    const existed = findMovieByUrl(url)
    addMovie({
      title,
      year: collectForm.year.trim(),
      director: collectForm.author.trim(),
      url,
      cover: collectForm.cover.trim(),
      note: collectForm.note.trim(),
      groupId: collectForm.groupId || DEFAULT_MOVIE_GROUP_ID
    })
    message.success(existed ? '已更新片单中的这部电影' : '已收藏到片单')
  } else if (collectKind.value === 'game') {
    const existed = findGameByUrl(url)
    addGame({
      title,
      platform: collectForm.author.trim(),
      url,
      cover: collectForm.cover.trim(),
      note: collectForm.note.trim(),
      groupId: collectForm.groupId || DEFAULT_GAME_GROUP_ID
    })
    message.success(existed ? '已更新游戏库中的这个游戏' : '已收藏到游戏库')
  } else if (collectKind.value === 'site') {
    const catId = collectForm.groupId
    if (!catId) {
      message.warning('请选择导航分类')
      return
    }
    const found = findSiteByUrl(url)
    const payload = {
      name: title,
      url,
      desc: collectForm.note.trim(),
      icon: collectForm.cover.trim() || iconFromSiteUrl(url),
      letter: letterFromName(title)
    }
    if (found) {
      updateSite(found.group.id, found.site.id, payload)
      message.success('已更新导航中的网站')
    } else {
      addSite(catId, payload)
      message.success('已收藏到导航')
    }
    saveSites()
  } else {
    const existed = findBookByUrl(url)
    addBook({
      title,
      author: collectForm.author.trim(),
      url,
      cover: collectForm.cover.trim(),
      note: collectForm.note.trim(),
      groupId: collectForm.groupId || DEFAULT_GROUP_ID
    })
    message.success(existed ? '已更新书架中的这本书' : '已收藏到书架')
  }
  closeCollectModal()
}

async function closeCollectModal() {
  collectOpen.value = false
  newGroupOpen.value = false
  newGroupName.value = ''
  await nextTick()
  await sync()
}

function openNewGroupInput() {
  newGroupOpen.value = true
  newGroupName.value = ''
}

function cancelNewGroup() {
  newGroupOpen.value = false
  newGroupName.value = ''
}

function confirmNewGroup() {
  const name = newGroupName.value.trim()
  if (!name) {
    message.warning(collectKind.value === 'site' ? '请输入分类名' : '请输入分组名')
    return
  }
  let created = null
  if (collectKind.value === 'movie') {
    created = addMovieGroup(name)
  } else if (collectKind.value === 'game') {
    created = addGameGroup(name)
  } else if (collectKind.value === 'book') {
    created = addBookGroup(name)
  } else {
    created = addCategory(name)
    if (created) saveSites()
  }
  if (!created) {
    message.warning(collectKind.value === 'site' ? '分类名无效或已存在' : '分组名无效或已存在')
    return
  }
  collectForm.groupId = created.id
  newGroupOpen.value = false
  newGroupName.value = ''
  message.success(collectKind.value === 'site' ? '已新建分类' : '已新建分组')
}

const viewerBodyRef = ref(null)
const loading = ref(false)
const zoomFactor = ref(1)
let loadTimer = null
let offZoom = null

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

const isBoard = computed(() => !!props.site?.isSearchBoard && Array.isArray(props.site?.panes))

const boardRef = ref(null)
const paneWidths = ref([])
const dragging = ref(false)
const MIN_PANE_PCT = 12
let splitDrag = null

watch(
  () => props.site?.panes?.map((p) => p.id).join(',') || '',
  () => {
    const n = props.site?.panes?.length || 0
    paneWidths.value = n ? Array.from({ length: n }, () => 100 / n) : []
  },
  { immediate: true }
)

function paneFlex(index) {
  return `${paneWidths.value[index] || 1} 1 0%`
}

function startSplit(index, e) {
  if (index < 0 || index >= paneWidths.value.length - 1) return
  e.preventDefault()
  const board = boardRef.value
  if (!board) return
  dragging.value = true
  splitDrag = {
    index,
    startX: e.clientX,
    widths: [...paneWidths.value],
    boardW: Math.max(1, board.getBoundingClientRect().width)
  }
  hide()
  window.addEventListener('mousemove', onSplitMove)
  window.addEventListener('mouseup', endSplit)
}

function onSplitMove(e) {
  if (!splitDrag) return
  const dPct = ((e.clientX - splitDrag.startX) / splitDrag.boardW) * 100
  const next = [...splitDrag.widths]
  const a = splitDrag.index
  const b = a + 1
  let left = next[a] + dPct
  let right = next[b] - dPct
  if (left < MIN_PANE_PCT) {
    right -= MIN_PANE_PCT - left
    left = MIN_PANE_PCT
  }
  if (right < MIN_PANE_PCT) {
    left -= MIN_PANE_PCT - right
    right = MIN_PANE_PCT
  }
  next[a] = left
  next[b] = right
  paneWidths.value = next
}

function endSplit() {
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', endSplit)
  splitDrag = null
  dragging.value = false
  syncBoardViews()
}

const {
  sync,
  hide,
  reload,
  openExternal,
  getCurrentPage,
  attach,
  detach,
  refreshObservers,
  getZoom,
  zoomStep,
  zoomReset,
  onZoomChanged
} = useBrowserView({
  getTargetEl: () => viewerBodyRef.value,
  getUrl: () => (isBoard.value ? '' : props.site?.url || ''),
  getViewId: () => props.site?.id || 'main',
  getPanes: () => {
    if (!props.site || props.overlayOpen) return []
    if (!isBoard.value) return []
    const root = viewerBodyRef.value
    if (!root) return []
    return [...root.querySelectorAll('[data-pane-id]')]
      .map((el) => ({
        id: el.getAttribute('data-pane-id') || '',
        url: el.getAttribute('data-pane-url') || '',
        el
      }))
      .filter((p) => p.id && p.url && p.el)
  },
  isActive: () =>
    !!props.site &&
    !props.site.isBooks &&
    !props.site.isMovies &&
    !props.site.isGames &&
    !props.overlayOpen &&
    !collectOpen.value,
  keepAlive: () => !!(props.overlayOpen || collectOpen.value)
})

const mode = computed(() => {
  if (!props.site) return 'welcome'
  if (props.site.isBooks) return 'books'
  if (props.site.isMovies) return 'movies'
  if (props.site.isGames) return 'games'
  if (isBoard.value) return 'board'
  return 'frame'
})

const canZoom = computed(() => mode.value === 'frame' || mode.value === 'board')

const zoomLabel = computed(() => `${Math.round(zoomFactor.value * 100)}%`)

function clearLoadTimer() {
  if (loadTimer) {
    clearTimeout(loadTimer)
    loadTimer = null
  }
}

function startLoading() {
  loading.value = true
  clearLoadTimer()
  loadTimer = setTimeout(() => {
    loading.value = false
  }, 8000)
}

async function applyZoomStep(direction) {
  if (!props.site || !canZoom.value) return
  const next = await zoomStep(direction)
  if (typeof next === 'number') zoomFactor.value = next
}

async function applyZoomReset() {
  const next = await zoomReset()
  zoomFactor.value = typeof next === 'number' ? next : 1
}

function onViewerWheel(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  applyZoomStep(e.deltaY > 0 ? -1 : 1)
}

function onViewerKeydown(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key === '+' || e.key === '=' || e.key === 'Add') {
    e.preventDefault()
    applyZoomStep(1)
  } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
    e.preventDefault()
    applyZoomStep(-1)
  } else if (e.key === '0') {
    e.preventDefault()
    applyZoomReset()
  }
}

async function syncBoardViews() {
  await nextTick()
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  refreshObservers()
  await sync()
  // 再测一次，避免首帧高度为 0
  await new Promise((r) => setTimeout(r, 50))
  refreshObservers()
  await sync()
}

watch(
  () => [
    props.site?.id,
    props.site?.url,
    props.site?.isSearchBoard,
    props.site?.panes?.map((p) => p.id).join(','),
    props.overlayOpen,
    props.collapsed,
    collectOpen.value
  ],
  async () => {
    if (!props.site) {
      loading.value = false
      clearLoadTimer()
      await hide()
      return
    }
    if (props.site.isBooks || props.site.isMovies || props.site.isGames) {
      loading.value = false
      clearLoadTimer()
      await hide()
      return
    }
    if (collectOpen.value || props.overlayOpen) {
      await hide()
      return
    }
    startLoading()
    await syncBoardViews()
    loading.value = false
  }
)

onMounted(async () => {
  attach()
  zoomFactor.value = (await getZoom()) || 1
  offZoom = onZoomChanged((factor) => {
    zoomFactor.value = factor
  })
  window.addEventListener('keydown', onViewerKeydown)
})

onBeforeUnmount(() => {
  clearLoadTimer()
  window.removeEventListener('keydown', onViewerKeydown)
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', endSplit)
  offZoom?.()
  detach()
})

async function refresh() {
  if (!props.site) return
  startLoading()
  await reload()
  loading.value = false
}

function openInBrowser() {
  if (!props.site) return
  if (isBoard.value) {
    for (const pane of props.site.panes || []) openExternal(pane.url)
    return
  }
  openExternal(props.site.url)
}

function openPaneExternal(url) {
  openExternal(url)
}

function closePane(paneId) {
  if (!props.site?.id || !paneId) return
  emit('close-pane', props.site.id, paneId)
}

function closeCurrentTab() {
  if (!props.site?.id || props.site.pinned || props.site.isHome) return
  emit('close-tab', props.site.id)
}
</script>

<template>
  <div class="viewer-root">
    <header
      v-if="mode !== 'welcome' && mode !== 'books' && mode !== 'movies' && mode !== 'games'"
      class="app-header"
    >
      <div class="app-header__meta">
        <strong>{{ site?.name || '未选择' }}</strong>
        <span>{{ site?.desc || site?.url || '从左侧选择一个网站' }}</span>
      </div>
      <n-space :size="8" align="center">
        <n-button
          :disabled="!site || !canZoom || zoomFactor <= ZOOM_MIN"
          title="缩小 (Ctrl + 滚轮)"
          @click="applyZoomStep(-1)"
        >
          −
        </n-button>
        <button
          type="button"
          class="zoom-label"
          :disabled="!site || !canZoom"
          title="点击恢复 100%"
          @click="applyZoomReset"
        >
          {{ zoomLabel }}
        </button>
        <n-button
          :disabled="!site || !canZoom || zoomFactor >= ZOOM_MAX"
          title="放大 (Ctrl + 滚轮)"
          @click="applyZoomStep(1)"
        >
          +
        </n-button>
        <n-button :disabled="!site || !canZoom" :loading="loading" @click="refresh">
          刷新
        </n-button>
        <n-button
          v-if="canCollect"
          :type="isBookSearch || isMovieSearch || isGameSearch ? 'primary' : 'default'"
          secondary
          :disabled="!site?.url && mode !== 'board'"
          @click="openCollect()"
        >
          {{ collectButtonLabel }}
        </n-button>
        <n-button type="primary" :disabled="!site?.url" @click="openInBrowser">系统浏览器</n-button>
        <n-button
          v-if="site?.ephemeral || mode === 'board'"
          quaternary
          title="关闭当前标签"
          @click="closeCurrentTab"
        >
          关闭
        </n-button>
      </n-space>
    </header>

    <div ref="viewerBodyRef" class="viewer-body" @wheel="onViewerWheel">
      <div v-show="mode === 'welcome'" class="viewer-panel viewer-panel--home">
        <div class="home-brand">
          <h2>聚合搜索</h2>
          <p>选择文字 / 图片 / 视频 / 开源，勾选多个引擎；可开启一屏分屏显示</p>
        </div>
        <AggregateSearch @search="(tabs) => emit('search', tabs)" />
      </div>

      <div v-show="mode === 'books'" class="viewer-panel viewer-panel--books">
        <BooksShelf
          @open="(site) => emit('open-site', site)"
          @search="(tabs) => emit('search', tabs)"
        />
      </div>

      <div v-show="mode === 'movies'" class="viewer-panel viewer-panel--books">
        <MoviesShelf
          @open="(site) => emit('open-site', site)"
          @search="(tabs) => emit('search', tabs)"
        />
      </div>

      <div v-show="mode === 'games'" class="viewer-panel viewer-panel--books">
        <GamesShelf
          @open="(site) => emit('open-site', site)"
          @search="(tabs) => emit('search', tabs)"
        />
      </div>

      <div
        v-if="mode === 'board'"
        ref="boardRef"
        class="search-board"
        :class="{ 'is-dragging': dragging }"
      >
        <template v-for="(pane, index) in site.panes" :key="pane.id">
          <div class="search-board__cell" :style="{ flex: paneFlex(index) }">
            <div class="search-board__label">
              <SiteFavicon :icon="pane.icon" :url="pane.url" :letter="pane.letter" />
              <strong>{{ pane.name }}</strong>
              <button
                v-if="isBookSearch || isMovieSearch || isGameSearch"
                type="button"
                class="agg-link"
                @click="openCollectPane(pane)"
              >
                收藏
              </button>
              <button type="button" class="agg-link" @click="openPaneExternal(pane.url)">
                新窗口
              </button>
              <button
                type="button"
                class="search-board__close"
                title="关闭此窗口"
                @click="closePane(pane.id)"
              >
                ×
              </button>
            </div>
            <div
              class="search-board__frame"
              :data-pane-id="pane.id"
              :data-pane-url="pane.url"
            >
              <div class="viewer-electron-slot" />
            </div>
          </div>
          <div
            v-if="index < site.panes.length - 1"
            class="search-board__splitter"
            title="拖拽调整宽度"
            @mousedown="startSplit(index, $event)"
          />
        </template>
      </div>

      <div v-else-if="mode === 'frame'" class="viewer-electron-slot" />
    </div>

    <n-modal
      :show="collectOpen"
      preset="card"
      :title="collectButtonLabel"
      style="width: min(440px, 92vw)"
      :bordered="false"
      to="body"
      @update:show="(v) => (v ? (collectOpen = true) : closeCollectModal())"
    >
      <p class="collect-tip">
        {{
          collectAsSite
            ? '将当前页面收藏到左侧导航分类；图标会尽量自动识别'
            : collectAsMovie
              ? '请先点进影片详情再收藏；海报会尽量从详情页自动识别'
              : collectAsGame
                ? '请先点进游戏详情再收藏；封面会尽量从详情页自动识别'
                : '请先点进书籍详情再收藏；封面会尽量从详情页自动识别'
        }}
      </p>
      <div class="books-form">
        <div class="books-form__cover-row">
          <SiteFavicon
            cover
            :icon="collectForm.cover"
            :url="collectForm.url"
            :letter="(collectForm.title || '?').slice(0, 1)"
          />
          <n-input
            v-model:value="collectForm.cover"
            :placeholder="collectAsSite ? '图标 URL，可留空' : '封面图 URL，可留空'"
          />
        </div>
        <label>
          <span>{{
            collectAsSite
              ? '网站名'
              : collectAsMovie
                ? '片名'
                : collectAsGame
                  ? '游戏名'
                  : '书名'
          }} *</span>
          <n-input
            v-model:value="collectForm.title"
            maxlength="80"
            :placeholder="
              collectAsSite
                ? '网站名'
                : collectAsMovie
                  ? '片名'
                  : collectAsGame
                    ? '游戏名'
                    : '书名'
            "
          />
        </label>
        <label v-if="collectAsMovie">
          <span>年份</span>
          <n-input v-model:value="collectForm.year" maxlength="12" placeholder="可选" />
        </label>
        <label v-if="!collectAsSite">
          <span>{{
            collectAsMovie ? '导演 / 主演' : collectAsGame ? '平台' : '作者'
          }}</span>
          <n-input
            v-model:value="collectForm.author"
            maxlength="80"
            :placeholder="collectAsGame ? '可选，如 Steam / Switch' : '可选'"
          />
        </label>
        <label>
          <span>{{ collectAsSite ? '导航分类' : '分组' }}</span>
          <div class="collect-group-row">
            <n-select
              v-model:value="collectForm.groupId"
              :options="collectGroupOptions"
              style="flex: 1; min-width: 0"
            />
            <n-button secondary :disabled="newGroupOpen" @click="openNewGroupInput">
              {{ collectAsSite ? '新建分类' : '新建分组' }}
            </n-button>
          </div>
          <div v-if="newGroupOpen" class="collect-group-new">
            <n-input
              v-model:value="newGroupName"
              maxlength="24"
              :placeholder="collectAsSite ? '输入新分类名' : '输入新分组名'"
              @keydown.enter.prevent="confirmNewGroup"
            />
            <n-button @click="cancelNewGroup">取消</n-button>
            <n-button type="primary" @click="confirmNewGroup">确定</n-button>
          </div>
        </label>
        <label>
          <span>{{
            collectAsSite
              ? '网站地址'
              : collectAsMovie
                ? '观看地址'
                : collectAsGame
                  ? '游戏地址'
                  : '阅读地址'
          }} *</span>
          <n-input
            v-model:value="collectForm.url"
            :placeholder="
              collectAsSite
                ? '当前页地址'
                : collectAsMovie
                  ? '打开影片详情/播放页后更准确'
                  : collectAsGame
                    ? '打开游戏商店/详情页后更准确'
                    : '打开书籍详情/阅读页后更准确'
            "
          />
        </label>
        <label>
          <span>{{ collectAsSite ? '简介' : '备注' }}</span>
          <n-input v-model:value="collectForm.note" maxlength="120" placeholder="可选" />
        </label>
      </div>
      <template #footer>
        <div class="books-form__footer">
          <n-button @click="closeCollectModal">取消</n-button>
          <n-button type="primary" @click="confirmCollect">
            {{ collectSaveLabel }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>
