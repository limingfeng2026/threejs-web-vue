// 长沙路网瓦片预下载脚本
// 用法：
//   node scripts/download-changsha-tiles.mjs --dryrun   只算瓦片范围与数量，不下载
//   node scripts/download-changsha-tiles.mjs           并发下载到 public/tiles
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'

// 覆盖范围：覆盖点位与核心楼群（与裁剪框一致）
const BBOX = [112.905, 28.168, 113.005, 28.212] // [lonMin, latMin, lonMax, latMax]
const ZOOM = 15
const TILE_SIZE = 256

const lon2tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

const [lonMin, latMin, lonMax, latMax] = BBOX
const xMin = lon2tileX(lonMin, ZOOM)
const xMax = lon2tileX(lonMax, ZOOM)
const yMin = lat2tileY(latMax, ZOOM)
const yMax = lat2tileY(latMin, ZOOM)
const cols = xMax - xMin + 1
const rows = yMax - yMin + 1
console.log(`zoom=${ZOOM} x=[${xMin},${xMax}] y=[${yMin},${yMax}] cols=${cols} rows=${rows} tiles=${cols * rows}`)

// 估算体积：单张路网 png 约 12~18KB
console.log(`预估体积 ≈ ${Math.round((cols * rows * 15) / 1024)} MB（按 15KB/张）`)

if (process.argv.includes('--dryrun')) process.exit(0)

const outDir = path.join('public', 'tiles', String(ZOOM))
fs.mkdirSync(outDir, { recursive: true })

const tileUrl = (x, y) =>
  `https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${ZOOM}`

const download = (x, y) =>
  new Promise((resolve) => {
    const file = path.join(outDir, `${x}_${y}.png`)
    if (fs.existsSync(file)) return resolve('cached')
    const req = https.get(tileUrl(x, y), { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) return resolve(`status-${res.statusCode}`)
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        fs.writeFileSync(file, Buffer.concat(chunks))
        resolve('ok')
      })
    })
    req.on('error', (e) => resolve(`err:${String(e)}`))
    req.setTimeout(10000, () => req.destroy())
  })

// 并发 6，礼貌下载
const queue = []
for (let x = xMin; x <= xMax; x++) for (let y = yMin; y <= yMax; y++) queue.push([x, y])

let done = 0
const concurrency = 6
async function worker() {
  while (queue.length) {
    const [x, y] = queue.shift()
    const r = await download(x, y)
    done++
    if (done % 20 === 0 || done === queue.length) console.log(`progress ${done}/${cols * rows} ${r}`)
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log('download finished ->', outDir)
