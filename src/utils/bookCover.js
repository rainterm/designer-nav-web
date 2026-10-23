/** 站点 favicon / 图标服务，不是书籍封面 */
export function isGenericSiteIcon(url = '') {
  const u = String(url || '')
  if (!u) return true
  return /icon\.horse|favicon\.|\/favicon|s2\/favicons|gstatic\.com\/favicon/i.test(u)
}

/** 看起来像内容图（书籍封面 CDN 等），可直接用 img 展示 */
export function looksLikeBookCover(url = '') {
  const u = String(url || '').trim()
  if (!/^https?:\/\//i.test(u)) return false
  if (isGenericSiteIcon(u)) return false
  if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(u)) return true
  return /image\.|qpic\.|myqcloud|byteimg|pstatp|sns-webpic|wfqqreader|weread|doubanio|bookcover|movie\.|cover\.|cdn\.|alicdn|qiniu|fanqie|qqreader|iqiyipic|ykimg|gtimg|hdslb|meituan\.net|maoyan|steamstatic|akamaihd|epicgames|taptap/i.test(
    u
  )
}

/** 优先用抓取到的封面，否则回退站点图标 */
export function pickBookCover(cover, pageUrl, fallbackIcon = '') {
  const c = String(cover || '').trim()
  if (c && !isGenericSiteIcon(c)) return c
  const fb = String(fallbackIcon || '').trim()
  if (fb && !isGenericSiteIcon(fb)) return fb
  return fb || ''
}
