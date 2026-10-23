<script setup>
import { computed, reactive, ref } from 'vue'
import { NButton, NInput, NModal, NSelect, useDialog, useMessage } from 'naive-ui'
import SiteFavicon from '@/components/SiteFavicon.vue'
import { useBooks, DEFAULT_GROUP_ID } from '@/composables/useBooks'
import { iconFromSiteUrl } from '@/utils/favicon'
import { letterFromName } from '@/data/defaultSites'
import {
  BOOK_KIND_ENGINES,
  MANGA_KIND_ENGINES,
  DEFAULT_BOOK_ENGINES,
  bookEngineIcon,
  buildBookSearchBoard,
  buildBookSearchTabs
} from '@/data/bookSearch'

const emit = defineEmits(['open', 'search'])

const message = useMessage()
const dialog = useDialog()
const {
  books,
  groups,
  groupName,
  addGroup,
  renameGroup,
  removeGroup,
  addBook,
  updateBook,
  removeBook,
  reorderBooks,
  moveBookToGroup,
  toOpenSite
} = useBooks()

const keyword = ref('')
const searchMode = ref('local') // local | online
const selectedEngines = ref([...DEFAULT_BOOK_ENGINES])
const oneScreen = ref(true)
const showModal = ref(false)
const editingId = ref('')
const dragFromId = ref('')
const dragOverId = ref('')
/** '' = 全部 */
const activeGroupId = ref('')
const showGroupModal = ref(false)
const groupEditingId = ref('')
const groupFormName = ref('')

const form = reactive({
  title: '',
  author: '',
  url: '',
  cover: '',
  note: '',
  groupId: DEFAULT_GROUP_ID
})

const groupOptions = computed(() =>
  groups.value.map((g) => ({
    label: g.name,
    value: g.id
  }))
)

const filtered = computed(() => {
  let list = books.value
  if (activeGroupId.value) {
    list = list.filter((b) => b.groupId === activeGroupId.value)
  }
  if (searchMode.value === 'local') {
    const q = keyword.value.trim().toLowerCase()
    if (q) {
      list = list.filter((b) =>
        `${b.title} ${b.author} ${b.note} ${b.url} ${groupName(b.groupId)}`
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
        books: filtered.value
      }
    ]
  }
  return groups.value
    .map((g) => ({
      id: g.id,
      name: g.name,
      books: filtered.value.filter((b) => b.groupId === g.id)
    }))
    .filter((s) => s.books.length)
})

function countInGroup(groupId) {
  return books.value.filter((b) => b.groupId === groupId).length
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
    message.warning('请输入书名、漫画名或作者')
    return
  }
  if (!selectedEngines.value.length) {
    message.warning('请至少选择一个搜索引擎')
    return
  }
  if (oneScreen.value && selectedEngines.value.length > 1) {
    const board = buildBookSearchBoard(selectedEngines.value, q)
    if (!board) {
      message.error('无法生成搜索地址')
      return
    }
    emit('search', [board])
    return
  }
  const tabs = buildBookSearchTabs(selectedEngines.value, q)
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
  form.author = ''
  form.url = ''
  form.cover = ''
  form.note = ''
  form.groupId = activeGroupId.value || DEFAULT_GROUP_ID
}

function openAdd() {
  resetForm()
  showModal.value = true
}

function openEdit(book) {
  editingId.value = book.id
  form.title = book.title
  form.author = book.author || ''
  form.url = book.url
  form.cover = book.cover || ''
  form.note = book.note || ''
  form.groupId = book.groupId || DEFAULT_GROUP_ID
  showModal.value = true
}

function fillCoverFromUrl() {
  const url = form.url.trim()
  if (!url) {
    message.warning('请先填写阅读地址')
    return
  }
  form.cover = iconFromSiteUrl(url)
  message.success('已根据网址填充封面图标')
}

function submit() {
  const title = form.title.trim()
  const url = form.url.trim()
  if (!title) {
    message.warning('请填写书名')
    return
  }
  if (!url) {
    message.warning('请填写阅读地址')
    return
  }
  const payload = {
    title,
    author: form.author.trim(),
    url,
    cover: form.cover.trim() || iconFromSiteUrl(url),
    note: form.note.trim(),
    letter: letterFromName(title),
    groupId: form.groupId || DEFAULT_GROUP_ID
  }
  if (editingId.value) {
    updateBook(editingId.value, payload)
    message.success('已更新书籍')
  } else {
    addBook(payload)
    message.success('已收藏书籍')
  }
  showModal.value = false
  resetForm()
}

function confirmRemove(book) {
  dialog.warning({
    title: '移除收藏',
    content: `确定移除「${book.title}」？`,
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: () => {
      removeBook(book.id)
      message.success('已移除')
    }
  })
}

function openBook(book) {
  const site = toOpenSite(book)
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
  if (!group || group.id === DEFAULT_GROUP_ID) {
    message.warning('默认分组不能删除')
    return
  }
  const n = countInGroup(group.id)
  dialog.warning({
    title: '删除分组',
    content: n
      ? `删除「${group.name}」后，其中 ${n} 本书会移到「默认」分组。确定删除？`
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
  reorderBooks(fromId, id)
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
  const book = books.value.find((b) => b.id === fromId)
  if (!book || book.groupId === groupId) return
  moveBookToGroup(fromId, groupId)
  message.success(`已移到「${groupName(groupId)}」`)
}

function onGroupChipDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
</script>

<template>
  <div class="books-page">
    <div class="books-page__head">
      <div>
        <h2>我的书籍</h2>
        <p>收藏喜欢的书和漫画；支持分组，在线搜索后可收藏到书架</p>
      </div>
      <n-button type="primary" @click="openAdd">添加书籍</n-button>
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
              ? '输入书名、漫画名或作者，在线搜索…'
              : '筛选本地收藏的书名、作者、分组…'
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
          <span>选择搜索引擎（图书 / 漫画，可多选）</span>
          <label class="books-onescreen">
            <input v-model="oneScreen" type="checkbox" :disabled="selectedEngines.length < 2" />
            一屏显示
          </label>
        </div>
        <div class="books-search__kind-label">图书</div>
        <div class="books-search__engines">
          <button
            v-for="engine in BOOK_KIND_ENGINES"
            :key="engine.id"
            type="button"
            class="agg-engine"
            :class="{ 'is-checked': isEngineOn(engine.id) }"
            @click="toggleEngine(engine.id)"
          >
            <span class="agg-engine__check" aria-hidden="true">
              {{ isEngineOn(engine.id) ? '✓' : '' }}
            </span>
            <SiteFavicon
              :icon="bookEngineIcon(engine)"
              :url="`https://${engine.host}`"
              :letter="engine.letter"
            />
            <span>{{ engine.name }}</span>
          </button>
        </div>
        <div class="books-search__kind-label">漫画</div>
        <div class="books-search__engines">
          <button
            v-for="engine in MANGA_KIND_ENGINES"
            :key="engine.id"
            type="button"
            class="agg-engine"
            :class="{ 'is-checked': isEngineOn(engine.id) }"
            @click="toggleEngine(engine.id)"
          >
            <span class="agg-engine__check" aria-hidden="true">
              {{ isEngineOn(engine.id) ? '✓' : '' }}
            </span>
            <SiteFavicon
              :icon="bookEngineIcon(engine)"
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
        <em>{{ books.length }}</em>
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
        v-if="activeGroupId && activeGroupId !== DEFAULT_GROUP_ID"
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
      我的收藏 · 搜索结果页顶部点「收藏到书架」，或分屏栏点「收藏」
    </div>

    <template v-if="filtered.length">
      <section v-for="section in groupedSections" :key="section.id" class="books-group-section">
        <div v-if="!activeGroupId" class="books-group-section__head">
          <strong>{{ section.name }}</strong>
          <span>{{ section.books.length }}</span>
        </div>
        <div class="books-grid">
          <article
            v-for="book in section.books"
            :key="book.id"
            class="book-card"
            :class="{
              'is-dragging': dragFromId === book.id,
              'is-drag-over': dragOverId === book.id && dragFromId !== book.id
            }"
            draggable="true"
            @dragstart="onDragStart(book.id, $event)"
            @dragover="onDragOver(book.id, $event)"
            @drop="onDrop(book.id, $event)"
            @dragend="onDragEnd"
          >
            <button type="button" class="book-card__main" @click="openBook(book)">
              <span class="book-card__cover">
                <SiteFavicon cover :icon="book.cover" :url="book.url" :letter="book.letter" />
              </span>
              <span class="book-card__meta">
                <strong>{{ book.title }}</strong>
                <em v-if="book.author">{{ book.author }}</em>
                <span v-if="activeGroupId === ''" class="book-card__group">{{
                  groupName(book.groupId)
                }}</span>
                <span v-if="book.note">{{ book.note }}</span>
              </span>
            </button>
            <div class="book-card__actions">
              <n-button type="primary" @click="openBook(book)">阅读</n-button>
              <n-button secondary @click="openEdit(book)">编辑</n-button>
              <n-button quaternary @click="confirmRemove(book)">移除</n-button>
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
              ? '该分组还没有书，可添加或从其他分组拖入'
              : '还没有收藏，点击右上角添加，或先在线搜索'
        }}
      </p>
    </div>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '编辑书籍' : '添加书籍'"
      style="width: min(480px, 92vw)"
      :bordered="false"
      @after-leave="resetForm"
    >
      <div class="books-form">
        <label>
          <span>书名 *</span>
          <n-input v-model:value="form.title" maxlength="80" placeholder="例如：深入理解计算机系统" />
        </label>
        <label>
          <span>作者</span>
          <n-input v-model:value="form.author" maxlength="60" placeholder="可选" />
        </label>
        <label>
          <span>分组</span>
          <n-select v-model:value="form.groupId" :options="groupOptions" />
        </label>
        <label>
          <span>阅读地址 *</span>
          <n-input
            v-model:value="form.url"
            placeholder="https://… 在线阅读 / 文档页"
            @blur="!form.cover && form.url && fillCoverFromUrl()"
          />
        </label>
        <label>
          <span>封面图标</span>
          <div class="books-form__cover-row">
            <SiteFavicon
              cover
              :icon="form.cover || iconFromSiteUrl(form.url)"
              :url="form.url"
              :letter="letterFromName(form.title || '?')"
            />
            <n-input v-model:value="form.cover" placeholder="图标 URL，可留空自动获取" />
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
            placeholder="可选，例如章节进度"
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
            placeholder="例如：小说 / 技术 / 在读"
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
