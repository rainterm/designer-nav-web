import { STORAGE_KEY as SITES_KEY } from '@/data/defaultSites'

export const BACKUP_KIND = 'nav-web-backup'
export const BACKUP_VERSION = 1
const PREFIX = 'nav-web.'

function collectLocalData() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    data[key] = localStorage.getItem(key)
  }
  return data
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function isLegacySitesBackup(data) {
  if (Array.isArray(data)) {
    return data.some((g) => g && typeof g.category === 'string')
  }
  if (data && Array.isArray(data.groups) && data.groups.some((g) => g && typeof g.category === 'string')) {
    return true
  }
  return false
}

function applyLocalData(entries) {
  const incoming = new Set(Object.keys(entries))
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREFIX) && !incoming.has(key)) toRemove.push(key)
  }
  toRemove.forEach((key) => localStorage.removeItem(key))
  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith(PREFIX)) continue
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

function readFileJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function exportAllBackup() {
  const data = collectLocalData()
  downloadJson(`nav-backup-${stamp()}.json`, {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data
  })
  return Object.keys(data).length
}

/**
 * 导入完整备份，或旧版仅网站 JSON。导入后刷新页面以加载全部模块状态。
 */
export async function importAllBackup(file) {
  const parsed = await readFileJson(file)

  if (parsed && parsed.kind === BACKUP_KIND && parsed.data && typeof parsed.data === 'object') {
    applyLocalData(parsed.data)
    return { mode: 'all', reload: true }
  }

  if (isLegacySitesBackup(parsed)) {
    const groups = Array.isArray(parsed) ? parsed : parsed.groups
    localStorage.setItem(SITES_KEY, JSON.stringify(groups))
    return { mode: 'sites', reload: true }
  }

  throw new Error('unrecognized backup')
}
