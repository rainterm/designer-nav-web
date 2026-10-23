<script setup>
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDrawer,
  NDrawerContent,
  NDropdown,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NText,
  useDialog,
  useMessage
} from 'naive-ui'
import SiteFavicon from '@/components/SiteFavicon.vue'
import { letterFromName } from '@/data/defaultSites'
import { iconFromSiteUrl } from '@/utils/favicon'
import { appTitle, REPO_URL } from '@/settings'

const props = defineProps({
  show: { type: Boolean, default: false },
  groups: { type: Array, required: true },
  dirty: { type: Boolean, default: false },
  siteCount: { type: Number, default: 0 }
})

const emit = defineEmits([
  'update:show',
  'save',
  'reset',
  'export',
  'import',
  'add-category',
  'update-category',
  'remove-category',
  'move-category',
  'add-site',
  'update-site',
  'remove-site',
  'move-site'
])

const message = useMessage()
const dialog = useDialog()
const fileInput = ref(null)
const expandedNames = ref([])

const siteModal = reactive({
  show: false,
  mode: 'add',
  catId: '',
  siteId: '',
  name: '',
  url: '',
  desc: '',
  icon: '',
  showMore: false
})

const catModal = reactive({
  show: false,
  mode: 'add',
  catId: '',
  name: '',
  icon: '',
  showMore: false
})

const moreOptions = [
  { label: '导出全部备份', key: 'export' },
  { label: '导入全部备份', key: 'import' },
  { type: 'divider', key: 'd1' },
  { label: '恢复默认网站数据', key: 'reset' },
  { type: 'divider', key: 'd2' },
  { label: '关于', key: 'about' }
]

function catActionOptions() {
  return [
    { label: '上移分类', key: 'up' },
    { label: '下移分类', key: 'down' },
    { label: '编辑分类', key: 'edit' },
    { type: 'divider', key: 'd' },
    { label: '删除分类', key: 'remove' }
  ]
}

function siteActionOptions() {
  return [
    { label: '上移', key: 'up' },
    { label: '下移', key: 'down' },
    { label: '编辑', key: 'edit' },
    { type: 'divider', key: 'd' },
    { label: '删除', key: 'remove' }
  ]
}

function onCatAction(key, cat) {
  if (key === 'up') moveCat(cat.id, -1)
  else if (key === 'down') moveCat(cat.id, 1)
  else if (key === 'edit') openEditCategory(cat)
  else if (key === 'remove') confirmRemoveCat(cat)
}

function onSiteAction(key, cat, site) {
  if (key === 'up') moveSite(cat.id, site.id, -1)
  else if (key === 'down') moveSite(cat.id, site.id, 1)
  else if (key === 'edit') openEditSite(cat, site)
  else if (key === 'remove') confirmRemoveSite(cat, site)
}

watch(
  () => [props.show, props.groups.map((g) => g.id).join('|')],
  ([visible], prev) => {
    if (!visible) return
    const ids = props.groups.map((g) => g.id)
    if (!expandedNames.value.length) {
      expandedNames.value = ids
      return
    }
    const prevIds = String(prev?.[1] || '')
      .split('|')
      .filter(Boolean)
    const added = ids.filter((id) => !prevIds.includes(id))
    if (added.length) {
      expandedNames.value = [...new Set([...expandedNames.value, ...added])]
    }
  },
  { immediate: true }
)

const siteModalTitle = computed(() =>
  siteModal.mode === 'add' ? '添加网站' : '编辑网站'
)
const catModalTitle = computed(() =>
  catModal.mode === 'add' ? '添加分类' : '编辑分类'
)

function close() {
  emit('update:show', false)
}

function openAddCategory() {
  catModal.mode = 'add'
  catModal.catId = ''
  catModal.name = ''
  catModal.icon = ''
  catModal.showMore = false
  catModal.show = true
}

function openEditCategory(cat) {
  catModal.mode = 'edit'
  catModal.catId = cat.id
  catModal.name = cat.category
  catModal.icon = cat.icon || ''
  catModal.showMore = Boolean(cat.icon)
  catModal.show = true
}

function submitCategory() {
  const name = catModal.name.trim()
  if (!name) {
    message.warning('请填写分类名称')
    return
  }
  if (catModal.mode === 'add') {
    emit('add-category', { name, icon: catModal.icon.trim() })
  } else {
    emit('update-category', catModal.catId, {
      category: name,
      icon: catModal.icon.trim(),
      letter: letterFromName(name)
    })
  }
  catModal.show = false
  message.success(catModal.mode === 'add' ? '已添加分类' : '分类已更新')
  emit('save')
}

function openAddSite(catId) {
  siteModal.mode = 'add'
  siteModal.catId = catId
  siteModal.siteId = ''
  siteModal.name = ''
  siteModal.url = 'https://'
  siteModal.desc = ''
  siteModal.icon = ''
  siteModal.showMore = false
  siteModal.show = true
}

function openEditSite(cat, site) {
  siteModal.mode = 'edit'
  siteModal.catId = cat.id
  siteModal.siteId = site.id
  siteModal.name = site.name
  siteModal.url = site.url
  siteModal.desc = site.desc || ''
  siteModal.icon = site.icon || ''
  siteModal.showMore = Boolean(site.desc)
  siteModal.show = true
}

function normalizeUrl(url) {
  const u = url.trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u}`
}

function fillIconFromUrl() {
  const url = normalizeUrl(siteModal.url)
  if (!url || url === 'https://') {
    message.warning('请先填写网站地址')
    return
  }
  const icon = iconFromSiteUrl(url)
  if (!icon) {
    message.warning('无法从该地址识别图标')
    return
  }
  siteModal.icon = icon
  siteModal.showMore = true
  message.success('已填入在线图标地址')
}

function onSiteUrlBlur() {
  if (siteModal.icon.trim()) return
  const url = normalizeUrl(siteModal.url)
  if (!url || url === 'https://') return
  siteModal.icon = iconFromSiteUrl(url)
}

function submitSite() {
  const name = siteModal.name.trim()
  const url = normalizeUrl(siteModal.url)
  if (!name) {
    message.warning('请填写网站名称')
    return
  }
  if (!url || url === 'https://') {
    message.warning('请填写网站地址')
    return
  }
  const payload = {
    name,
    url,
    desc: siteModal.desc.trim(),
    icon: siteModal.icon.trim() || iconFromSiteUrl(url),
    letter: letterFromName(name)
  }
  if (siteModal.mode === 'add') {
    emit('add-site', siteModal.catId, payload)
    message.success('已添加网站')
  } else {
    emit('update-site', siteModal.catId, siteModal.siteId, payload)
    message.success('网站已更新')
  }
  siteModal.show = false
  emit('save')
}

function confirmRemoveCat(cat) {
  dialog.warning({
    title: '删除分类',
    content: `确定删除「${cat.category}」及其下全部网站？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('remove-category', cat.id)
      emit('save')
      message.success('已删除分类')
    }
  })
}

function confirmRemoveSite(cat, site) {
  dialog.warning({
    title: '删除网站',
    content: `确定删除「${site.name}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('remove-site', cat.id, site.id)
      emit('save')
      message.success('已删除')
    }
  })
}

function moveCat(catId, dir) {
  emit('move-category', catId, dir)
  emit('save')
}

function moveSite(catId, siteId, dir) {
  emit('move-site', catId, siteId, dir)
  emit('save')
}

function confirmReset() {
  dialog.warning({
    title: '恢复默认网站',
    content: '仅恢复左侧导航网站为默认列表，不会删除书籍/电影/游戏收藏。此操作不可撤销。',
    positiveText: '恢复默认',
    negativeText: '取消',
    onPositiveClick: () => emit('reset')
  })
}

function confirmImport() {
  dialog.warning({
    title: '导入全部备份',
    content:
      '将覆盖当前全部本地数据（导航网站、书籍/电影/游戏收藏、搜索偏好）。导入后会自动刷新页面。确定继续？',
    positiveText: '选择文件',
    negativeText: '取消',
    onPositiveClick: () => fileInput.value?.click()
  })
}

async function openRepo() {
  if (window.navDesktop?.openExternal) {
    await window.navDesktop.openExternal(REPO_URL)
    return
  }
  window.open(REPO_URL, '_blank', 'noopener,noreferrer')
}

function showAbout() {
  dialog.info({
    title: '关于',
    content: () =>
      h('div', { class: 'about-dialog' }, [
        h('p', { class: 'about-dialog__name' }, appTitle),
        h('p', null, '开源协议：MIT'),
        h('p', null, [
          '开源地址：',
          h(
            'a',
            {
              class: 'about-dialog__link',
              href: REPO_URL,
              onClick: (e) => {
                e.preventDefault()
                openRepo()
              }
            },
            REPO_URL
          )
        ])
      ]),
    positiveText: '打开开源地址',
    negativeText: '关闭',
    onPositiveClick: () => {
      openRepo()
    }
  })
}

function onMoreSelect(key) {
  if (key === 'export') emit('export')
  else if (key === 'import') confirmImport()
  else if (key === 'reset') confirmReset()
  else if (key === 'about') showAbout()
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) emit('import', file)
}

function shortUrl(url) {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}
</script>

<template>
  <n-drawer
    :show="show"
    :width="560"
    placement="right"
    @update:show="(v) => emit('update:show', v)"
  >
    <n-drawer-content title="管理网站" closable>
      <template #header-extra>
        <n-text depth="3" style="font-size: 12px">
          {{ groups.length }} 个分类 · {{ siteCount }} 个网站
        </n-text>
      </template>

      <div class="edit-toolbar">
        <n-button type="primary" @click="openAddCategory">添加分类</n-button>
        <n-dropdown :options="moreOptions" @select="onMoreSelect">
          <n-button quaternary>更多</n-button>
        </n-dropdown>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onFileChange"
        />
      </div>

      <n-empty
        v-if="!groups.length"
        description="还没有分类，先添加一个吧"
        style="margin-top: 48px"
      >
        <template #extra>
          <n-button type="primary" @click="openAddCategory">添加分类</n-button>
        </template>
      </n-empty>

      <n-collapse
        v-else
        v-model:expanded-names="expandedNames"
        display-directive="show"
        class="edit-collapse"
      >
        <n-collapse-item v-for="cat in groups" :key="cat.id" :name="cat.id">
          <template #header>
            <div class="edit-cat-title">
              <SiteFavicon
                :icon="cat.icon"
                :url="cat.items?.[0]?.url || ''"
                :letter="cat.letter || cat.category.slice(0, 1)"
              />
              <div class="edit-cat-title__text">
                <strong>{{ cat.category }}</strong>
                <span>{{ cat.items.length }} 个网站</span>
              </div>
            </div>
          </template>
          <template #header-extra>
            <div class="edit-cat-actions" @click.stop>
              <n-dropdown
                :options="catActionOptions()"
                @select="(key) => onCatAction(key, cat)"
              >
                <n-button quaternary>操作</n-button>
              </n-dropdown>
            </div>
          </template>

          <div class="edit-site-list">
            <div v-if="!cat.items.length" class="edit-site-empty">此分类还没有网站</div>
            <div v-for="site in cat.items" :key="site.id" class="edit-site-item">
              <SiteFavicon
                :icon="site.icon"
                :url="site.url"
                :letter="site.letter || site.name.slice(0, 1)"
              />
              <button type="button" class="edit-site-item__main" @click="openEditSite(cat, site)">
                <strong>{{ site.name }}</strong>
                <span>{{ shortUrl(site.url) }}</span>
              </button>
              <n-dropdown
                :options="siteActionOptions()"
                @select="(key) => onSiteAction(key, cat, site)"
              >
                <n-button quaternary class="edit-site-item__more">⋯</n-button>
              </n-dropdown>
            </div>
            <n-button block dashed class="edit-add-site" @click="openAddSite(cat.id)">
              在此分类添加网站
            </n-button>
          </div>
        </n-collapse-item>
      </n-collapse>

      <template #footer>
        <n-space justify="end" style="width: 100%">
          <n-button type="primary" @click="close">完成</n-button>
        </n-space>
      </template>
    </n-drawer-content>
  </n-drawer>

  <n-modal
    v-model:show="catModal.show"
    preset="card"
    :title="catModalTitle"
    style="width: 420px"
    :mask-closable="false"
  >
    <n-form label-placement="top">
      <n-form-item label="分类名称" required>
        <n-input
          v-model:value="catModal.name"
          placeholder="例如：大模型"
          maxlength="20"
          @keydown.enter="submitCategory"
        />
      </n-form-item>
      <n-button text type="primary" @click="catModal.showMore = !catModal.showMore">
        {{ catModal.showMore ? '收起更多' : '更多设置（图标）' }}
      </n-button>
      <n-form-item v-if="catModal.showMore" label="图标地址" style="margin-top: 12px">
        <div class="edit-icon-row">
          <SiteFavicon :icon="catModal.icon" :letter="letterFromName(catModal.name)" />
          <n-input
            v-model:value="catModal.icon"
            placeholder="https:// 在线图片地址，可选"
          />
        </div>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="catModal.show = false">取消</n-button>
        <n-button type="primary" @click="submitCategory">确定</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal
    v-model:show="siteModal.show"
    preset="card"
    :title="siteModalTitle"
    style="width: 460px"
    :mask-closable="false"
  >
    <n-form label-placement="top">
      <n-form-item label="网站名称" required>
        <n-input v-model:value="siteModal.name" placeholder="例如：ChatGPT" maxlength="40" />
      </n-form-item>
      <n-form-item label="网站地址" required>
        <n-input
          v-model:value="siteModal.url"
          placeholder="粘贴网址，如 chatgpt.com"
          @blur="onSiteUrlBlur"
          @keydown.enter="submitSite"
        />
      </n-form-item>
      <n-form-item label="图标地址">
        <div class="edit-icon-row">
          <SiteFavicon
            :icon="siteModal.icon"
            :url="siteModal.url"
            :letter="letterFromName(siteModal.name || siteModal.url)"
          />
          <n-input
            v-model:value="siteModal.icon"
            placeholder="https:// 在线图片地址"
          />
          <n-button @click="fillIconFromUrl">从网址获取</n-button>
        </div>
      </n-form-item>
      <n-button text type="primary" @click="siteModal.showMore = !siteModal.showMore">
        {{ siteModal.showMore ? '收起更多' : '更多设置（简介）' }}
      </n-button>
      <template v-if="siteModal.showMore">
        <n-form-item label="简介" style="margin-top: 12px">
          <n-input v-model:value="siteModal.desc" placeholder="可选，一两句话说明用途" />
        </n-form-item>
      </template>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="siteModal.show = false">取消</n-button>
        <n-button type="primary" @click="submitSite">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>
