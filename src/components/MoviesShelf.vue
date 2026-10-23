<script setup>
import { computed, reactive, ref } from 'vue'
import { NButton, NInput, NModal, NSelect, useDialog, useMessage } from 'naive-ui'
import SiteFavicon from '@/components/SiteFavicon.vue'
import { useMovies, DEFAULT_MOVIE_GROUP_ID } from '@/composables/useMovies'
import { iconFromSiteUrl } from '@/utils/favicon'
import { letterFromName } from '@/data/defaultSites'
import {
  MOVIE_SEARCH_ENGINES,
  DEFAULT_MOVIE_ENGINES,
  movieEngineIcon,
  buildMovieSearchBoard,
  buildMovieSearchTabs
} from '@/data/movieSearch'

const emit = defineEmits(['open', 'search'])

const message = useMessage()
const dialog = useDialog()
const {
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
  toOpenSite
} = useMovies()

const keyword = ref('')
const searchMode = ref('local')
const selectedEngines = ref([...DEFAULT_MOVIE_ENGINES])
const oneScreen = ref(true)
const showModal = ref(false)
const editingId = ref('')
const dragFromId = ref('')
const dragOverId = ref('')
const activeGroupId = ref('')
const showGroupModal = ref(false)
const groupEditingId = ref('')
const groupFormName = ref('')

const form = reactive({
  title: '',
  year: '',
  director: '',
  url: '',
  cover: '',
  note: '',
  groupId: DEFAULT_MOVIE_GROUP_ID
})

const groupOptions = computed(() =>
  groups.value.map((g) => ({
    label: g.name,
    value: g.id
  }))
)

const filtered = computed(() => {
  let list = movies.value
  if (activeGroupId.value) {
    list = list.filter((m) => m.groupId === activeGroupId.value)
  }
  if (searchMode.value === 'local') {
    const q = keyword.value.trim().toLowerCase()
    if (q) {
      list = list.filter((m) =>
        `${m.title} ${m.year} ${m.director} ${m.note} ${m.url} ${groupName(m.groupId)}`
          .toLowerCase()
          .includes(q)
      )
    }
  }
  return list
})

const groupedSections = computed(() => {
  if (activeGroupId.value) {
    const g = groups.value.find((x) => x.id === activeGroupId.value)
    return [
      {
        id: activeGroupId.value,
        name: g?.name || '分组',
        items: filtered.value
      }
    ]
  }
  return groups.value
    .map((g) => ({
      id: g.id,
      name: g.name,
      items: filtered.value.filter((m) => m.groupId === g.id)
    }))
    .filter((s) => s.items.length)
})

function countInGroup(groupId) {
  return movies.value.filter((m) => m.groupId === groupId).length
}

function isEngineOn(id) {
  return selectedEngines.value.includes(id)
}

function toggleEngine(id) {
  const i = selectedEngines.value.indexOf(id)
  if (i >= 0) selectedEngines.value.splice(i, 1)
  else selectedEngines.value.push(id)
}

function runOnlineSearch() {
  const q = keyword.value.trim()
  if (!q) {
    message.warning('请输入电影名或导演')
    return
  }
  if (!selectedEngines.value.length) {
    message.warning('请至少选择一个搜索引擎')
    return
  }
  if (oneScreen.value && selectedEngines.value.length > 1) {
    const board = buildMovieSearchBoard(selectedEngines.value, q)
    if (!board) {
      message.error('无法生成搜索地址')
      return
    }
    emit('search', [board])
    return
  }
  const tabs = buildMovieSearchTabs(selectedEngines.value, q)
  if (!tabs.length) {
    message.error('无法生成搜索地址')
    return
  }
  emit('search', tabs)
}

function onSearchEnter() {
  if (searchMode.value === 'online') runOnlineSearch()
}

function resetForm() {
  editingId.value = ''
  form.title = ''
  form.year = ''
  form.director = ''
  form.url = ''
  form.cover = ''
  form.note = ''
  form.groupId = activeGroupId.value || DEFAULT_MOVIE_GROUP_ID
}

function openAdd() {
  resetForm()
  showModal.value = true
}

function openEdit(movie) {
  editingId.value = movie.id
  form.title = movie.title
  form.year = movie.year || ''
  form.director = movie.director || ''
  form.url = movie.url
  form.cover = movie.cover || ''
  form.note = movie.note || ''
  form.groupId = movie.groupId || DEFAULT_MOVIE_GROUP_ID
  showModal.value = true
}

function fillCoverFromUrl() {
  const url = form.url.trim()
  if (!url) {
    message.warning('请先填写观看地址')
    return
  }
  form.cover = iconFromSiteUrl(url)
  message.success('已根据网址填充封面图标')
}

function submit() {
  const title = form.title.trim()
  const url = form.url.trim()
  if (!title) {
    message.warning('请填写片名')
    return
  }
  if (!url) {
    message.warning('请填写观看地址')
    return
  }
  const payload = {
    title,
    year: form.year.trim(),
    director: form.director.trim(),
    url,
    cover: form.cover.trim() || iconFromSiteUrl(url),
    note: form.note.trim(),
    letter: letterFromName(title),
    groupId: form.groupId || DEFAULT_MOVIE_GROUP_ID
  }
  if (editingId.value) {
    updateMovie(editingId.value, payload)
    message.success('已更新电影')
  } else {
    addMovie(payload)
    message.success('已收藏电影')
  }
  showModal.value = false
  resetForm()
}

function confirmRemove(movie) {
  dialog.warning({
    title: '移除收藏',
    content: `确定移除「${movie.title}」？`,
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: () => {
      removeMovie(movie.id)
      message.success('已移除')
    }
  })
}

function openMovie(movie) {
  const site = toOpenSite(movie)
  if (site) emit('open', site)
}

function openAddGroup() {
  groupEditingId.value = ''
  groupFormName.value = ''
  showGroupModal.value = true
}

function openRenameGroup(group) {
  groupEditingId.value = group.id
  groupFormName.value = group.name
  showGroupModal.value = true
}

function submitGroup() {
  const name = groupFormName.value.trim()
  if (!name) {
    message.warning('请填写分组名称')
    return
  }
  if (groupEditingId.value) {
    const ok = renameGroup(groupEditingId.value, name)
    if (!ok) {
      message.warning('分组名无效或已存在')
      return
    }
    message.success('已重命名分组')
  } else {
    const g = addGroup(name)
    if (!g) {
      message.warning('分组名无效或已存在')
      return
    }
    activeGroupId.value = g.id
    message.success('已新建分组')
  }
  showGroupModal.value = false
}

function confirmRemoveGroup(group) {
  if (!group || group.id === DEFAULT_MOVIE_GROUP_ID) {
    message.warning('默认分组不能删除')
    return
  }
  const n = countInGroup(group.id)
  dialog.warning({
    title: '删除分组',
    content: n
      ? `删除「${group.name}」后，其中 ${n} 部电影会移到「默认」分组。确定删除？`
      : `确定删除分组「${group.name}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      removeGroup(group.id)
      if (activeGroupId.value === group.id) activeGroupId.value = ''
      message.success('已删除分组')
    }
  })
}

function confirmRemoveActiveGroup() {
  const g = groups.value.find((x) => x.id === activeGroupId.value)
  if (g) confirmRemoveGroup(g)
}

function onDragStart(id, e) {
  dragFromId.value = id
  dragOverId.value = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
}

function onDragOver(id, e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (dragOverId.value !== id) dragOverId.value = id
}

function onDrop(id, e) {
  e.preventDefault()
  const fromId = dragFromId.value || e.dataTransfer.getData('text/plain')
  dragFromId.value = ''
  dragOverId.value = ''
  if (!fromId || fromId === id) return
  reorderMovies(fromId, id)
}

function onDragEnd() {
  dragFromId.value = ''
  dragOverId.value = ''
}

function onGroupChipDrop(groupId, e) {
  e.preventDefault()
  const fromId = dragFromId.value || e.dataTransfer.getData('text/plain')
  dragFromId.value = ''
  dragOverId.value = ''
  if (!fromId || !groupId) return
  const movie = movies.value.find((m) => m.id === fromId)
  if (!movie || movie.groupId === groupId) return
  moveMovieToGroup(fromId, groupId)
  message.success(`已移到「${groupName(groupId)}」`)
}

function onGroupChipDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
</script>

<template>
  <div class="books-page movies-page">
    <div class="books-page__head">
      <div>
        <h2>我的电影</h2>
        <p>收藏想看的电影；支持分组管理，拖到分组标签可快速移动</p>
      </div>
      <n-button type="primary" @click="openAdd">添加电影</n-button>
    </div>

    <div class="books-search">
      <div class="books-search__modes">
        <button
          type="button"
          class="books-mode"
          :class="{ 'is-active': searchMode === 'local' }"
          @click="searchMode = 'local'"
        >
          本地收藏
        </button>
        <button
          type="button"
          class="books-mode"
          :class="{ 'is-active': searchMode === 'online' }"
          @click="searchMode = 'online'"
        >
          在线搜索
        </button>
      </div>

      <div class="books-search__box">
        <n-input
          v-model:value="keyword"
          clearable
          size="large"
          :placeholder="
            searchMode === 'online'
              ? '输入电影名或导演，在线搜索…'
              : '筛选本地收藏的片名、导演、分组…'
          "
          @keydown.enter="onSearchEnter"
        />
        <n-button
          v-if="searchMode === 'online'"
          type="primary"
          size="large"
          class="books-search__submit"
          @click="runOnlineSearch"
        >
          搜索
        </n-button>
      </div>

      <template v-if="searchMode === 'online'">
        <div class="books-search__engines-head">
          <span>选择可在线观看的平台（可多选；豆瓣仅资料）</span>
          <label class="books-onescreen">
            <input v-model="oneScreen" type="checkbox" :disabled="selectedEngines.length < 2" />
            一屏显示
          </label>
        </div>
        <div class="books-search__engines">
          <button
            v-for="engine in MOVIE_SEARCH_ENGINES"
            :key="engine.id"
            type="button"
            class="agg-engine"
            :class="{
              'is-checked': isEngineOn(engine.id),
              'is-meta': engine.watchable === false
            }"
            @click="toggleEngine(engine.id)"
          >
            <span class="agg-engine__check" aria-hidden="true">
              {{ isEngineOn(engine.id) ? '✓' : '' }}
            </span>
            <SiteFavicon
              :icon="movieEngineIcon(engine)"
              :url="`https://${engine.host}`"
              :letter="engine.letter"
            />
            <span>{{ engine.name }}</span>
          </button>
        </div>
      </template>
    </div>

    <div v-if="searchMode === 'local'" class="books-groups">
      <button
        type="button"
        class="books-group-chip"
        :class="{ 'is-active': !activeGroupId }"
        @click="activeGroupId = ''"
      >
        全部
        <em>{{ movies.length }}</em>
      </button>
      <button
        v-for="g in groups"
        :key="g.id"
        type="button"
        class="books-group-chip"
        :class="{ 'is-active': activeGroupId === g.id }"
        @click="activeGroupId = g.id"
        @dblclick="openRenameGroup(g)"
        @dragover="onGroupChipDragOver"
        @drop="onGroupChipDrop(g.id, $event)"
      >
        {{ g.name }}
        <em>{{ countInGroup(g.id) }}</em>
      </button>
      <button type="button" class="books-group-chip books-group-chip--add" @click="openAddGroup">
        + 新建分组
      </button>
      <button
        v-if="activeGroupId && activeGroupId !== DEFAULT_MOVIE_GROUP_ID"
        type="button"
        class="books-group-chip books-group-chip--danger"
        @click="confirmRemoveActiveGroup"
      >
        删除当前分组
      </button>
    </div>

    <div v-if="searchMode === 'local'" class="books-section-label">
      {{ activeGroupId ? groupName(activeGroupId) : '全部分组' }}（{{ filtered.length }}）
    </div>
    <div v-else class="books-section-label">
      我的片单 · 搜索结果页顶部点「收藏到片单」，或分屏栏点「收藏」
    </div>

    <template v-if="filtered.length">
      <section v-for="section in groupedSections" :key="section.id" class="books-group-section">
        <div v-if="!activeGroupId" class="books-group-section__head">
          <strong>{{ section.name }}</strong>
          <span>{{ section.items.length }}</span>
        </div>
        <div class="books-grid">
          <article
            v-for="movie in section.items"
            :key="movie.id"
            class="book-card"
            :class="{
              'is-dragging': dragFromId === movie.id,
              'is-drag-over': dragOverId === movie.id && dragFromId !== movie.id
            }"
            draggable="true"
            @dragstart="onDragStart(movie.id, $event)"
            @dragover="onDragOver(movie.id, $event)"
            @drop="onDrop(movie.id, $event)"
            @dragend="onDragEnd"
          >
            <button type="button" class="book-card__main" @click="openMovie(movie)">
              <span class="book-card__cover">
                <SiteFavicon cover :icon="movie.cover" :url="movie.url" :letter="movie.letter" />
              </span>
              <span class="book-card__meta">
                <strong>{{ movie.title }}</strong>
                <em v-if="movie.year || movie.director">
                  <template v-if="movie.year">{{ movie.year }}</template>
                  <template v-if="movie.year && movie.director"> · </template>
                  <template v-if="movie.director">{{ movie.director }}</template>
                </em>
                <span v-if="activeGroupId === ''" class="book-card__group">{{
                  groupName(movie.groupId)
                }}</span>
                <span v-if="movie.note">{{ movie.note }}</span>
              </span>
            </button>
            <div class="book-card__actions">
              <n-button type="primary" @click="openMovie(movie)">观看</n-button>
              <n-button secondary @click="openEdit(movie)">编辑</n-button>
              <n-button quaternary @click="confirmRemove(movie)">移除</n-button>
            </div>
          </article>
        </div>
      </section>
    </template>

    <div v-else class="books-empty">
      <p>
        {{
          searchMode === 'local' && keyword
            ? '没有匹配的本地收藏'
            : activeGroupId
              ? '该分组还没有电影，可添加或从其他分组拖入'
              : '还没有收藏，点击右上角添加，或先在线搜索'
        }}
      </p>
    </div>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '编辑电影' : '添加电影'"
      style="width: min(480px, 92vw)"
      :bordered="false"
      @after-leave="resetForm"
    >
      <div class="books-form">
        <label>
          <span>片名 *</span>
          <n-input v-model:value="form.title" maxlength="80" placeholder="例如：星际穿越" />
        </label>
        <label>
          <span>年份</span>
          <n-input v-model:value="form.year" maxlength="12" placeholder="可选，如 2014" />
        </label>
        <label>
          <span>导演 / 主演</span>
          <n-input v-model:value="form.director" maxlength="80" placeholder="可选" />
        </label>
        <label>
          <span>分组</span>
          <n-select v-model:value="form.groupId" :options="groupOptions" />
        </label>
        <label>
          <span>观看地址 *</span>
          <n-input
            v-model:value="form.url"
            placeholder="https://… 影片详情 / 播放页"
            @blur="!form.cover && form.url && fillCoverFromUrl()"
          />
        </label>
        <label>
          <span>海报封面</span>
          <div class="books-form__cover-row">
            <SiteFavicon
              cover
              :icon="form.cover || iconFromSiteUrl(form.url)"
              :url="form.url"
              :letter="letterFromName(form.title || '?')"
            />
            <n-input v-model:value="form.cover" placeholder="封面 URL，可留空自动获取" />
            <n-button @click="fillCoverFromUrl">获取</n-button>
          </div>
        </label>
        <label>
          <span>备注</span>
          <n-input
            v-model:value="form.note"
            type="textarea"
            :rows="2"
            maxlength="120"
            placeholder="可选，例如想看 / 已看"
          />
        </label>
      </div>
      <template #footer>
        <div class="books-form__footer">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="submit">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showGroupModal"
      preset="card"
      :title="groupEditingId ? '重命名分组' : '新建分组'"
      style="width: min(360px, 92vw)"
      :bordered="false"
    >
      <div class="books-form">
        <label>
          <span>分组名称 *</span>
          <n-input
            v-model:value="groupFormName"
            maxlength="24"
            placeholder="例如：想看 / 科幻 / 已看"
            @keydown.enter="submitGroup"
          />
        </label>
      </div>
      <template #footer>
        <div class="books-form__footer">
          <n-button @click="showGroupModal = false">取消</n-button>
          <n-button type="primary" @click="submitGroup">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>
