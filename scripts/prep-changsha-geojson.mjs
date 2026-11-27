/**
 * 长沙楼体 GeoJSON 裁剪预处理
 * 源：D:/myTest/3d-origin/public/geojson/cs_city.json（6.9 万面全量）
 * 产物：public/3d/source/cs_city_local.json（点位周边框内要素）
 * 边界：public/3d/source/cs_outline.json（拷贝源 cs.json 行政边界）
 *
 * 运行：node scripts/prep-changsha-geojson.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC_CITY = 'D:/myTest/3d-origin/public/geojson/cs_city.json'
const SRC_OUTLINE = 'D:/myTest/3d-origin/public/geojson/cs.json'
const OUT_DIR = path.resolve('public/3d/source')

// 周边裁剪框 [lngMin, lngMax, latMin, latMax]，覆盖 5 个点位周边
const BOX = [112.905, 113.005, 28.168, 28.212]

function ringsOf(feature) {
  const c = feature.geometry.coordinates
  return feature.geometry.type === 'MultiPolygon' ? c.flat() : c
}

function pointsOf(feature) {
  const out = []
  ringsOf(feature).forEach((ring) => ring.forEach((p) => out.push(p)))
  return out
}

function inBox(feature) {
  const [lngMin, lngMax, latMin, latMax] = BOX
  return pointsOf(feature).some(
    (p) => p[0] >= lngMin && p[0] <= lngMax && p[1] >= latMin && p[1] <= latMax
  )
}

fs.mkdirSync(OUT_DIR, { recursive: true })

// ---- 楼体裁剪 ----
const city = JSON.parse(fs.readFileSync(SRC_CITY, 'utf8'))
const kept = city.features.filter(inBox)
const cityOut = { type: 'FeatureCollection', features: kept }
fs.writeFileSync(path.join(OUT_DIR, 'cs_city_local.json'), JSON.stringify(cityOut))

// ---- 边界直拷 ----
fs.copyFileSync(SRC_OUTLINE, path.join(OUT_DIR, 'cs_outline.json'))

const kb = (f) => (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(1)
console.log(`楼体要素：${city.features.length} -> ${kept.length}`)
console.log(`cs_city_local.json ${kb('cs_city_local.json')} KB`)
console.log(`cs_outline.json ${kb('cs_outline.json')} KB`)
