<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NInput, useMessage } from 'naive-ui'
import SiteFavicon from '@/components/SiteFavicon.vue'
import {
  SEARCH_TYPES,
  DEFAULT_ENGINE_ORDER,
  engineIcon,
  enginesForType,
  buildSearchTabs,
  buildSearchBoard,
  loadSearchPrefs,
  saveSearchPrefs,
  normalizeEngineOrder
} from '@/data/searchEngines'

const OPENSOURCE_DEFAULTS = ['github', 'gitee']

const emit = defineEmits(['search'])

const message = useMessage()
const query = ref('')
const searchType = ref('web')
const selectedIds = ref([])
const oneScreen = ref(true)
const order = ref([...DEFAULT_ENGINE_ORDER])
const dragFromId = ref('')
const dragOverId = ref('')
const didDrag = ref(false)

const availableEngines = computed(() => enginesForType(searchType.value, order.value))
const multiSelected = computed(() => selectedIds.value.length > 1)

const placeholders = {
  web: '输入关键词，聚合搜索文字结果…',
  image: '搜索图片，例如：极光 壁纸',
  video: '搜索视频，例如：旅行 vlog',
  opensource: '搜索开源项目，例如：vue3 llm agent'
}

watch(searchType, () => {
  const valid = new Set(availableEngines.value.map((e) => e.id))
  selectedIds.value = selectedIds.value.filter((id) => valid.has(id))
  if (!selectedIds.value.length && availableEngines.value.length) {
    if (searchType.value === 'opensource') {
      const preferred = OPENSOURCE_DEFAULTS.filter((id) => valid.has(id))
      selectedIds.value = preferred.length
        ? preferred
        : availableEngines.value.slice(0, 2).map((e) => e.id)
    } else {
      selectedIds.value = availableEngines.value.slice(0, 2).map((e) => e.id)
    }
  }
  persist()
})

watch([selectedIds, oneScreen, order], persist, { deep: true })

function persist() {
  saveSearchPrefs({
    type: searchType.value,
    engines: selectedIds.value,
    oneScreen: oneScreen.value,
    order: order.value
  })
}

function isEnabled(id) {
  return selectedIds.value.includes(id)
}

function toggleEngine(id) {
  if (didDrag.value) {
    didDrag.value = false
    return
  }
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

function selectAll() {
  selectedIds.value = availableEngines.value.map((e) => e.id)
}

function clearAll() {
  selectedIds.value = []
}

function orderedSelectedIds() {
  const picked = new Set(selectedIds.value)
  return availableEngines.value.map((e) => e.id).filter((id) => picked.has(id))
}

function onDragStart(id, e) {
  dragFromId.value = id
  dragOverId.value = id
  didDrag.value = false
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
  try {
    e.dataTransfer.setData('application/x-engine-id', id)
  } catch {
    // ignore
  }
}

function onDragOver(id, e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (dragOverId.value !== id) {
    dragOverId.value = id
    didDrag.value = true
  }
}

function onDrop(targetId, e) {
  e.preventDefault()
  const fromId =
    dragFromId.value ||
    e.dataTransfer.getData('application/x-engine-id') ||
    e.dataTransfer.getData('text/plain')
  dragFromId.value = ''
  dragOverId.value = ''
  if (!fromId || fromId === targetId) return

  didDrag.value = true
  const typeIds = availableEngines.value.map((eng) => eng.id)
  const fromType = typeIds.indexOf(fromId)
  const toType = typeIds.indexOf(targetId)
  if (fromType < 0 || toType < 0) return

  const nextType = [...typeIds]
  nextType.splice(fromType, 1)
  nextType.splice(toType, 0, fromId)

  const current = [...order.value]
  let ti = 0
  order.value = current.map((id) => {
    if (!typeIds.includes(id)) return id
    return nextType[ti++]
  })
}

function onDragEnd() {
  dragFromId.value = ''
  dragOverId.value = ''
}

function runSearch() {
  const q = query.value.trim()
  if (!q) {
    message.warning('请输入搜索内容')
    return
  }
  if (!selectedIds.value.length) {
    message.warning('请至少选择一个搜索引擎')
    return
  }

  const ids = orderedSelectedIds()
  if (oneScreen.value && ids.length > 1) {
    const board = buildSearchBoard(ids, searchType.value, q)
    if (!board) {
      message.error('无法生成搜索地址')
      return
    }
    emit('search', [board])
    return
  }

  const tabs = buildSearchTabs(ids, searchType.value, q)
  if (!tabs.length) {
    message.error('无法生成搜索地址')
    return
  }
  emit('search', tabs)
}

onMounted(() => {
  const prefs = loadSearchPrefs()
  searchType.value = prefs.type
  oneScreen.value = prefs.oneScreen !== false
  order.value = normalizeEngineOrder(prefs.order)
  const valid = new Set(enginesForType(searchType.value, order.value).map((e) => e.id))
  const picked = prefs.engines.filter((id) => valid.has(id))
  selectedIds.value = picked.length
    ? picked
    : enginesForType(searchType.value, order.value).slice(0, 2).map((e) => e.id)
})
</script>

<template>
  <div class="agg-search">
    <div class="agg-search__types">
      <button
        v-for="t in SEARCH_TYPES"
        :key="t.id"
        type="button"
        class="agg-type"
        :class="{ 'is-active': searchType === t.id }"
        @click="searchType = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="agg-search__box">
      <n-input
        v-model:value="query"
        size="large"
        clearable
        :placeholder="placeholders[searchType]"
        @keydown.enter="runSearch"
      />
      <n-button type="primary" size="large" class="agg-search__submit" @click="runSearch">
        搜索
      </n-button>
    </div>

    <div class="agg-search__engines-head">
      <span>选择搜索引擎（可多选，拖拽排序）</span>
      <div class="agg-search__engine-actions">
        <button type="button" class="agg-link" @click="selectAll">全选</button>
        <button type="button" class="agg-link" @click="clearAll">清空</button>
      </div>
    </div>

    <div class="agg-search__engines">
      <button
        v-for="engine in availableEngines"
        :key="engine.id"
        type="button"
        class="agg-engine"
        :class="{
          'is-checked': isEnabled(engine.id),
          'is-dragging': dragFromId === engine.id,
          'is-drag-over': dragOverId === engine.id && dragFromId !== engine.id
        }"
        draggable="true"
        @click="toggleEngine(engine.id)"
        @dragstart="onDragStart(engine.id, $event)"
        @dragover="onDragOver(engine.id, $event)"
        @drop="onDrop(engine.id, $event)"
        @dragend="onDragEnd"
      >
        <span class="agg-engine__check" aria-hidden="true">
          {{ isEnabled(engine.id) ? '✓' : '' }}
        </span>
        <SiteFavicon
          :icon="engineIcon(engine)"
          :url="`https://${engine.host}`"
          :letter="engine.letter"
        />
        <span>{{ engine.name }}</span>
      </button>
    </div>

    <label class="agg-onescreen" :class="{ 'is-disabled': !multiSelected }">
      <input v-model="oneScreen" type="checkbox" :disabled="!multiSelected" />
      <span>一屏显示所选引擎结果</span>
      <em v-if="multiSelected">（同一标签内分屏）</em>
      <em v-else>（多选引擎后可用）</em>
    </label>
  </div>
</template>
