// 楼体几何后台 Worker：fetch 全量 GeoJSON → 墨卡托平面投影 → Shape 挤出 → 合并，
// 只回传合并后的 BufferGeometry attributes（ArrayBuffer 走 Transferable 零拷贝），
// 几何构造不阻塞页面主线程。
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const MERC_R = 6378137

self.addEventListener('message', async (e) => {
  const { url, center, worldScale, heightScale, minHeight, maxHeight } = e.data

  const resp = await fetch(url)
  const data = await resp.json()

  const [centerLng, centerLat] = center
  const mercator = (lng, lat) => {
    const lngRad = (lng * Math.PI) / 180
    const latRad = (lat * Math.PI) / 180
    return {
      x: MERC_R * lngRad,
      y: MERC_R * Math.log(Math.tan(Math.PI / 4 + latRad / 2)),
    }
  }
  const origin = mercator(centerLng, centerLat)
  const projectPlane = (lng, lat) => {
    const p = mercator(lng, lat)
    return { x: (p.x - origin.x) * worldScale, y: (p.y - origin.y) * worldScale }
  }

  const geos = []
  data.features.forEach((feature) => {
    const rawHeight = Number(feature.properties.height) || 10
    const h = Math.min(maxHeight, Math.max(minHeight, rawHeight * heightScale))
    const polys =
      feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates]
    polys.forEach((polygon) =>
      polygon.forEach((ring) => {
        if (!ring || ring.length < 3) return
        const shape = new THREE.Shape()
        ring.forEach((p, i) => {
          const { x: px, y: py } = projectPlane(p[0], p[1])
          if (i === 0) shape.moveTo(px, py)
          else shape.lineTo(px, py)
        })
        geos.push(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 }))
      })
    )
  })

  const merged = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  if (!merged) {
    self.postMessage({ error: 'merge-failed' })
    return
  }

  const pos = merged.attributes.position.array
  const nor = merged.attributes.normal.array
  const uv = merged.attributes.uv ? merged.attributes.uv.array : null
  const idx = merged.index ? merged.index.array : null

  const payload = {
    position: pos.buffer,
    normal: nor.buffer,
    uv: uv ? uv.buffer : null,
    index: idx ? idx.buffer : null,
    indexType: idx ? (idx instanceof Uint32Array ? 'uint32' : 'uint16') : null,
    indexItemSize: idx ? idx.BYTES_PER_ELEMENT : 0,
    count: pos.length / 3,
  }
  merged.dispose()

  const transfer = [payload.position, payload.normal, payload.uv, payload.index].filter(Boolean)
  self.postMessage(payload, transfer)
})
