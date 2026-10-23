<script setup>
import { computed, h, ref } from 'vue'
import { NDropdown, NIcon } from 'naive-ui'
import SiteFavicon from '@/components/SiteFavicon.vue'
import { BOOKS_TAB_ID, GAMES_TAB_ID, HOME_TAB_ID, MOVIES_TAB_ID } from '@/composables/useTabs'

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  activeTabId: { type: String, default: null }
})

const emit = defineEmits(['activate', 'close', 'close-others', 'close-all', 'reorder'])

const dragFromId = ref('')
const dragOverId = ref('')
const didDrag = ref(false)

const PINNED = new Set([HOME_TAB_ID, BOOKS_TAB_ID, MOVIES_TAB_ID, GAMES_TAB_ID])

function IconHome() {
  return h(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
    [
      h('path', {
        d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linejoin': 'round'
      })
    ]
  )
}

function IconBooks() {
  return h(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
    [
      h('path', {
        d: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5H7.5A2.5 2.5 0 0 0 5 21V5.5Z',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linejoin': 'round'
      }),
      h('path', {
        d: 'M5 18.5A2.5 2.5 0 0 1 7.5 16H19',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linecap': 'round'
      })
    ]
  )
}

function IconMovies() {
  return h(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
    [
      h('rect', {
        x: '3.5',
        y: '6',
        width: '17',
        height: '12',
        rx: '2',
        stroke: 'currentColor',
        'stroke-width': '1.8'
      }),
      h('path', {
        d: 'M10 9.5v5l4.5-2.5L10 9.5Z',
        fill: 'currentColor'
      })
    ]
  )
}

function IconGames() {
  return h(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
    [
      h('path', {
        d: 'M7 15.5c-2.2 0-3.5-1.6-3.5-3.5S4.8 8.5 7 8.5h10c2.2 0 3.5 1.6 3.5 3.5s-1.3 3.5-3.5 3.5H7Z',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linejoin': 'round'
      }),
      h('path', {
        d: 'M8 12h2.5M9.25 10.75v2.5M15.2 11.2h.01M17 13h.01',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linecap': 'round'
      })
    ]
  )
}

const pinnedIconMap = {
  [HOME_TAB_ID]: IconHome,
  [BOOKS_TAB_ID]: IconBooks,
  [MOVIES_TAB_ID]: IconMovies,
  [GAMES_TAB_ID]: IconGames
}

function pinnedIcon(tab) {
  return pinnedIconMap[tab?.id] || null
}

function isPinned(tab) {
  return !!tab?.pinned || PINNED.has(tab?.id)
}

const hasClosable = computed(() => props.tabs.some((t) => !isPinned(t)))

const moreOptions = computed(() => {
  const list = []
  if (hasClosable.value) {
    list.push({ label: '关闭其他标签', key: 'others' })
    list.push({ label: '关闭全部标签', key: 'all' })
  }
  return list
})

function onMore(key) {
  if (key === 'others') emit('close-others', props.activeTabId)
  else if (key === 'all') emit('close-all')
}

function onClose(e, tabId) {
  e.stopPropagation()
  if (PINNED.has(tabId)) return
  emit('close', tabId)
}

function onAuxClick(tab) {
  if (isPinned(tab)) return
  emit('close', tab.id)
}

function onActivate(tabId) {
  if (didDrag.value) {
    didDrag.value = false
    return
  }
  emit('activate', tabId)
}

function onDragStart(tab, e) {
  if (isPinned(tab)) {
    e.preventDefault()
    return
  }
  dragFromId.value = tab.id
  dragOverId.value = tab.id
  didDrag.value = false
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', tab.id)
  try {
    e.dataTransfer.setData('application/x-tab-id', tab.id)
  } catch {
    // ignore
  }
}

function onDragOver(tab, e) {
  if (!dragFromId.value || PINNED.has(dragFromId.value)) return
  if (isPinned(tab)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (dragOverId.value !== tab.id) {
    dragOverId.value = tab.id
    didDrag.value = true
  }
}

function onDrop(tab, e) {
  e.preventDefault()
  const fromId =
    dragFromId.value ||
    e.dataTransfer.getData('application/x-tab-id') ||
    e.dataTransfer.getData('text/plain')
  const toId = tab.id
  dragFromId.value = ''
  dragOverId.value = ''
  if (!fromId || fromId === toId) return
  if (PINNED.has(fromId) || PINNED.has(toId)) return
  didDrag.value = true
  emit('reorder', fromId, toId)
}

function onDragEnd() {
  dragFromId.value = ''
  dragOverId.value = ''
}

function tabTitle(tab) {
  if (tab.isHome) return '首页 · 聚合搜索'
  if (tab.isBooks) return '书籍 · 收藏与阅读'
  if (tab.isMovies) return '电影 · 收藏与观看'
  if (tab.isGames) return '游戏 · 收藏与打开'
  return tab.url || tab.name
}
</script>

<template>
  <div class="tab-bar">
    <div class="tab-bar__scroll">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="tab-item"
        :class="{
          'is-active': tab.id === activeTabId,
          'is-pinned': isPinned(tab),
          'is-home': tab.id === HOME_TAB_ID,
          'is-books': tab.id === BOOKS_TAB_ID,
          'is-movies': tab.id === MOVIES_TAB_ID,
          'is-games': tab.id === GAMES_TAB_ID,
          'is-dragging': dragFromId === tab.id,
          'is-drag-over': dragOverId === tab.id && dragFromId !== tab.id
        }"
        :title="tabTitle(tab)"
        :draggable="!isPinned(tab)"
        @click="onActivate(tab.id)"
        @auxclick.middle.prevent="onAuxClick(tab)"
        @dragstart="onDragStart(tab, $event)"
        @dragover="onDragOver(tab, $event)"
        @drop="onDrop(tab, $event)"
        @dragend="onDragEnd"
      >
        <n-icon v-if="pinnedIcon(tab)" class="tab-pin-icon" :size="16" :component="pinnedIcon(tab)" />
        <SiteFavicon
          v-else
          :icon="tab.icon"
          :url="tab.url"
          :letter="tab.letter || tab.name?.slice(0, 1)"
        />
        <span class="tab-item__name">{{ tab.name }}</span>
        <span
          v-if="!isPinned(tab)"
          class="tab-item__close"
          title="关闭"
          @click="onClose($event, tab.id)"
        >
          ×
        </span>
      </button>
    </div>

    <n-dropdown v-if="moreOptions.length" :options="moreOptions" @select="onMore">
      <button type="button" class="tab-bar__more" title="标签操作">⋯</button>
    </n-dropdown>
  </div>
</template>
