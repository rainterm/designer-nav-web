/** 统一色块字母标配色 */

const MARK_PALETTE = [
  '#16a34a',
  '#2563eb',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#059669',
  '#dc2626'
]

export const MARK_TONES = {
  home: '#16a34a',
  recharge: '#d97706',
  llm: '#2563eb',
  media: '#db2777'
}

export function markColorFromKey(key = '') {
  const s = String(key || '')
  if (!s) return MARK_PALETTE[0]
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return MARK_PALETTE[h % MARK_PALETTE.length]
}

/** 色块内只显示 1 个字符 */
export function markLetter(text = '', fallback = '?') {
  const raw = String(text || '').trim()
  if (!raw) return fallback
  return raw.slice(0, 1)
}
