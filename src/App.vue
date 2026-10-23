<script setup>
import { computed, ref, watch } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NLayoutSider,
  NMessageProvider,
  zhCN,
  dateZhCN
} from 'naive-ui'
import Sidebar from '@/components/Sidebar.vue'
import SiteViewer from '@/components/SiteViewer.vue'
import TabBar from '@/components/TabBar.vue'
import EditDrawer from '@/components/EditDrawer.vue'
import AppShell from '@/components/AppShell.vue'
import { useSites } from '@/composables/useSites'
import { useTabs } from '@/composables/useTabs'
import { exportAllBackup, importAllBackup } from '@/composables/useBackup'
import { buildThemeOverrides } from '@/theme'

const {
  groups,
  dirty,
  siteCount,
  save,
  resetDefaults,
  addCategory,
  updateCategory,
  removeCategory,
  moveCategory,
  addSite,
  updateSite,
  removeSite,
  moveSite
} = useSites()

const {
  tabs,
  activeTabId,
  activeSite,
  openSite,
  openSites,
  activateTab,
  closeTab,
  closeSearchPane,
  closeOtherTabs,
  closeAllTabs,
  reorderTabs,
  syncFromGroups
} = useTabs()

const editing = ref(false)
const collapsed = ref(false)
const themeOverrides = buildThemeOverrides()

watch(
  groups,
  (list) => {
    syncFromGroups(list)
  },
  { deep: true }
)

const activeSiteId = computed(() => {
  if (
    !activeSite.value ||
    activeSite.value.isHome ||
    activeSite.value.isBooks ||
    activeSite.value.isMovies ||
    activeSite.value.isGames
  ) {
    return null
  }
  return activeSite.value.id
})

function selectSite(site) {
  openSite(site)
}

function tabViewIds(tab) {
  if (!tab) return []
  const ids = [tab.id]
  if (Array.isArray(tab.panes)) {
    for (const pane of tab.panes) {
      if (pane?.id) ids.push(pane.id)
    }
  }
  return ids
}

async function destroyTabViews(tab) {
  if (!window.navDesktop?.destroyViews) return
  const ids = tabViewIds(tab)
  if (!ids.length) return
  await window.navDesktop.destroyViews({ ids })
}

async function onCloseTab(tabId) {
  const tab = tabs.value.find((t) => t.id === tabId)
  await destroyTabViews(tab)
  closeTab(tabId)
}

async function onClosePane(tabId, paneId) {
  if (paneId && window.navDesktop?.destroyViews) {
    await window.navDesktop.destroyViews({ ids: [paneId] })
  }
  closeSearchPane(tabId, paneId)
}

async function onCloseOthers(tabId) {
  if (window.navDesktop?.destroyViews) {
    const keep = new Set(tabViewIds(tabs.value.find((t) => t.id === tabId)))
    const ids = []
    for (const tab of tabs.value) {
      for (const id of tabViewIds(tab)) {
        if (!keep.has(id)) ids.push(id)
      }
    }
    if (ids.length) await window.navDesktop.destroyViews({ ids })
  }
  closeOtherTabs(tabId)
}

async function onCloseAll() {
  if (window.navDesktop?.destroyViews) {
    await window.navDesktop.destroyViews({})
  }
  closeAllTabs()
}

function onAggregateSearch(searchTabs) {
  openSites(searchTabs)
}
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <AppShell v-slot="{ message }">
          <n-layout has-sider class="nav-layout">
            <n-layout-sider
              bordered
              collapse-mode="width"
              :collapsed-width="64"
              :width="240"
              :collapsed="collapsed"
              :show-trigger="false"
              :native-scrollbar="true"
              content-style="display:flex;flex-direction:column;height:100%"
            >
              <Sidebar
                :groups="groups"
                :active-site-id="activeSiteId"
                :collapsed="collapsed"
                @select-site="selectSite"
                @edit="editing = true"
                @toggle-collapsed="collapsed = !collapsed"
              />
            </n-layout-sider>

            <div class="main-pane">
              <TabBar
                :tabs="tabs"
                :active-tab-id="activeTabId"
                @activate="activateTab"
                @close="onCloseTab"
                @close-others="onCloseOthers"
                @close-all="onCloseAll"
                @reorder="reorderTabs"
              />
              <div class="main-pane__body">
                <SiteViewer
                  :site="activeSite"
                  :collapsed="collapsed"
                  :overlay-open="editing"
                  @select-site="selectSite"
                  @search="onAggregateSearch"
                  @open-site="selectSite"
                  @close-tab="onCloseTab"
                  @close-pane="onClosePane"
                />
              </div>
            </div>
          </n-layout>

          <EditDrawer
            v-model:show="editing"
            :groups="groups"
            :dirty="dirty"
            :site-count="siteCount"
            @save="save"
            @reset="
              () => {
                resetDefaults()
                onCloseAll()
                message.success('已恢复默认数据')
              }
            "
            @export="
              () => {
                exportAllBackup()
                message.success('已导出全部备份')
              }
            "
            @import="
              async (file) => {
                try {
                  const result = await importAllBackup(file)
                  message.success(
                    result.mode === 'sites'
                      ? '已导入网站备份，即将刷新'
                      : '已导入全部备份，即将刷新'
                  )
                  setTimeout(() => window.location.reload(), 400)
                } catch {
                  message.error('导入失败，请选择本应用导出的备份 JSON')
                }
              }
            "
            @add-category="addCategory"
            @update-category="updateCategory"
            @remove-category="removeCategory"
            @move-category="moveCategory"
            @add-site="addSite"
            @update-site="updateSite"
            @remove-site="removeSite"
            @move-site="moveSite"
          />
        </AppShell>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
