<script setup>
import { computed, h, ref, watch } from 'vue'
import { NButton, NInput, NMenu, NTooltip } from 'naive-ui'
import BrandLogo from '@/components/BrandLogo.vue'
import SiteFavicon from '@/components/SiteFavicon.vue'

const props = defineProps({
  groups: { type: Array, required: true },
  activeSiteId: { type: String, default: null },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['select-site', 'edit', 'toggle-collapsed'])

const keyword = ref('')
const expandedKeys = ref([])

function itemIcon(item) {
  return () =>
    h(SiteFavicon, {
      icon: item.icon || '',
      url: item.url || item.items?.[0]?.url || '',
      letter: item.letter || letterFallback(item)
    })
}

function letterFallback(item) {
  if (item.letter) return item.letter
  if (item.category) return item.category.slice(0, 1)
  if (item.name) return item.name.slice(0, 1)
  return '?'
}

const filteredGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return props.groups
  return props.groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        `${it.name} ${it.desc} ${it.url}`.toLowerCase().includes(q)
      )
    }))
    .filter((g) => g.items.length > 0)
})

const menuOptions = computed(() =>
  filteredGroups.value.map((g) => ({
    label: g.category,
    key: `cat:${g.id}`,
    icon: itemIcon(g),
    children: g.items.map((it) => ({
      label: it.name,
      key: `site:${g.id}:${it.id}`,
      icon: itemIcon(it)
    }))
  }))
)

const selectedKey = computed(() => {
  if (!props.activeSiteId) return null
  for (const g of props.groups) {
    if (g.items.some((it) => it.id === props.activeSiteId)) {
      return `site:${g.id}:${props.activeSiteId}`
    }
  }
  return null
})

watch(
  () => props.groups.map((g) => g.id).join('|'),
  () => {
    const allKeys = props.groups.map((g) => `cat:${g.id}`)
    if (!expandedKeys.value.length) {
      expandedKeys.value = allKeys
      return
    }
    const prev = new Set(expandedKeys.value)
    const kept = allKeys.filter((k) => prev.has(k))
    const added = allKeys.filter((k) => !prev.has(k))
    expandedKeys.value = [...kept, ...added]
  },
  { immediate: true }
)

function onUpdateValue(key) {
  if (!key?.startsWith('site:')) return
  const [, catId, siteId] = key.split(':')
  const group = props.groups.find((g) => g.id === catId)
  const site = group?.items.find((it) => it.id === siteId)
  if (site) emit('select-site', site)
}
</script>

<template>
  <div class="sider-inner" :class="{ 'is-collapsed': collapsed }">
    <div class="logo">
      <div class="logo-brand">
        <BrandLogo class="logo-img" alt="Designer网址导航" />
        <span v-show="!collapsed" class="logo-text">Designer网址导航</span>
      </div>
      <n-button
        quaternary
        circle
        class="collapse-btn"
        :title="collapsed ? '展开菜单' : '收起菜单'"
        @click="emit('toggle-collapsed')"
      >
        <span class="collapse-icon">{{ collapsed ? '»' : '«' }}</span>
      </n-button>
    </div>

    <div v-show="!collapsed" class="sider-search">
      <n-input v-model:value="keyword" clearable placeholder="搜索网站…" />
    </div>

    <div class="sider-menu">
      <n-menu
        :value="selectedKey"
        :expanded-keys="expandedKeys"
        :options="menuOptions"
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="20"
        :indent="18"
        :root-indent="12"
        @update:value="onUpdateValue"
        @update:expanded-keys="(keys) => (expandedKeys = keys)"
      />
    </div>

    <div class="sider-footer">
      <n-tooltip v-if="collapsed" placement="right">
        <template #trigger>
          <n-button block secondary type="primary" @click="emit('edit')">管</n-button>
        </template>
        管理网站
      </n-tooltip>
      <n-button v-else block secondary type="primary" @click="emit('edit')">管理网站</n-button>
    </div>
  </div>
</template>
