// GitHub Pages 部署在 /<repo>/ 子路径下：public 里那些 '/3d/...'、'/tiles-...'
// 这样的根绝对路径会 404。这里统一补一次站点前缀。
// 本地 dev 时 BASE_URL 是 '/'，下面全部走恒等，行为不变。
export const BASE = import.meta.env.BASE_URL || '/'
// 去掉尾部斜杠：'' 或 '/threejs-web-vue'
const ROOT = BASE.replace(/\/+$/, '')

export const fixUrl = (url) => {
  if (typeof url !== 'string') return url
  if (!url.startsWith('/') || url.startsWith('//')) return url
  if (ROOT && (url === ROOT || url.startsWith(ROOT + '/'))) return url
  return ROOT + url
}
