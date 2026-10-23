<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getConfiguredIcon, resolveIconCandidates } from '@/utils/favicon'
import { looksLikeBookCover } from '@/utils/bookCover'

const props = defineProps({
  icon: { type: String, default: '' },
  url: { type: String, default: '' },
  letter: { type: String, default: '?' },
  /** 书籍封面等大图：直接展示，不走 favicon 解析 */
  cover: { type: Boolean, default: false }
})

const imgRef = ref(null)
const failed = ref(false)
const resolvedSrc = ref('')

const candidates = computed(() => resolveIconCandidates(props.icon, props.url))

const directCover = computed(() => {
  const icon = getConfiguredIcon(props.icon)
  if (icon && (props.cover || looksLikeBookCover(icon))) return icon
  return ''
})

const src = computed(() => directCover.value || resolvedSrc.value)

async function resolveIcon() {
  failed.value = false
  resolvedSrc.value = ''

  if (directCover.value) {
    resolvedSrc.value = directCover.value
    return
  }

  if (!window.navDesktop?.resolveFavicon) {
    resolvedSrc.value = getConfiguredIcon(props.icon) || candidates.value[0] || ''
    failed.value = !resolvedSrc.value
    return
  }

  try {
    const dataUrl = await window.navDesktop.resolveFavicon({
      icon: getConfiguredIcon(props.icon),
      url: props.url || ''
    })
    resolvedSrc.value = dataUrl || ''
    failed.value = !dataUrl
  } catch {
    resolvedSrc.value = ''
    failed.value = true
  }
}

watch(
  () => [props.icon, props.url, props.cover],
  () => {
    failed.value = false
    resolveIcon()
  },
  { immediate: true }
)

function markOk(img) {
  if (!img) return
  if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
    failed.value = true
    return
  }
  failed.value = false
}

function onLoad(e) {
  markOk(e.target)
}

function onError() {
  failed.value = true
}

onMounted(() => {
  const img = imgRef.value
  if (img?.complete && img.naturalWidth) markOk(img)
})
</script>

<template>
  <span class="menu-favicon-wrap" :class="{ 'is-book-cover': cover || !!directCover }">
    <img
      v-if="src && !failed"
      :key="src"
      ref="imgRef"
      class="menu-favicon"
      :src="src"
      alt=""
      referrerpolicy="no-referrer"
      loading="eager"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="menu-letter-icon">{{ letter || '?' }}</span>
  </span>
</template>
