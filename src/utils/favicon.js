/** 规范化网站地址，取出 hostname（去掉 www.） */
export function hostnameFromUrl(pageUrl = '') {
  const raw = String(pageUrl || '').trim()
  if (!raw || raw === 'https://' || raw === 'http://') return ''
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * 在线图标候选（国内可访问优先）。
 * 不使用任何本地 /icons 路径。
 */
export function iconCandidatesFromSiteUrl(pageUrl = '') {
  const host = hostnameFromUrl(pageUrl)
  if (!host) return []
  const parts = host.split('.')
  const apex = parts.length > 2 ? parts.slice(-2).join('.') : ''
  const hosts = [host]
  if (apex && apex !== host) hosts.push(apex)

  const list = []
  for (const h of hosts) {
    list.push(
      `https://icon.horse/icon/${h}`,
      `https://favicon.qqsuu.cn/${h}`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`,
      `https://${h}/favicon.ico`,
      `https://${h}/favicon.png`
    )
  }
  return list
}

/** 默认写入配置的在线图标地址 */
export function iconFromSiteUrl(pageUrl = '') {
  return iconCandidatesFromSiteUrl(pageUrl)[0] || ''
}

/** 只接受 http(s) 在线图标；本地路径一律忽略 */
export function getConfiguredIcon(customIcon = '') {
  const icon = String(customIcon || '').trim()
  if (!icon) return ''
  if (!/^https?:\/\//i.test(icon)) return ''
  return icon
}

/** 给定已配置 icon + 站点 url，得到完整候选列表（去重） */
export function resolveIconCandidates(customIcon = '', pageUrl = '') {
  const primary = getConfiguredIcon(customIcon)
  const fromUrl = iconCandidatesFromSiteUrl(pageUrl)
  const list = []
  if (primary) list.push(primary)
  for (const u of fromUrl) {
    if (u && !list.includes(u)) list.push(u)
  }
  return list
}
