<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import SceneView from '@/components/SceneView/index.js'
import SceneLoading from '@/components/SceneLoading/index.vue'
import * as THREE from 'three'
import TWEEN from '@tweenjs/tween.js'
import {
  flyLineVertex,
  flyLineFragment,
  buildingVertex,
  buildingFragment,
  metroVertex,
  metroFragment,
  injectWaveVertex,
  injectWaveFragment,
} from './shaders.js'

// ============ 长沙前 10 景点点位（数据在 public/3d/source/cs_poi.json） ============
// 坐标就用 json 里的原始值（已验证能落对位置，别再做坐标系换算）
// 单点要挪直接改 json 的 lng/lat；整体微调用下面两个数（0.0001 度 ≈ 10m）
const POI_D_LNG = 0
const POI_D_LAT = 0
const POI_URL = '/3d/source/cs_poi.json'
// 名次配色：1 红、2 橙、3 青…循环，和锥体、标签边同色
const POI_COLORS = [
  0xff4d4d, 0xff8a00, 0x35d0ff, 0x00ffa8, 0xff00ff,
  0x9d7bff, 0xddff00, 0x00ff00, 0xffa500, 0xffd400,
]
let CITY_POINTS = []
let HUB = null

const loadPoiData = async () => {
  const res = await fetch(POI_URL)
  const data = await res.json()
  const list = Array.isArray(data.points) ? data.points : []
  CITY_POINTS = list.map((p, i) => ({
    ...p,
    lng: +(+p.lng + POI_D_LNG).toFixed(6),
    lat: +(+p.lat + POI_D_LAT).toFixed(6),
    color: POI_COLORS[i % POI_COLORS.length],
    // 锥体上下浮动周期：越靠后越慢一点，画面里不会同呼吸
    time: 900 + i * 80,
    // 瓦片包围盒外的点不画（铜官窑在 28.41°N，地面砖只到 28.37°N）
    onMap: p.lat <= GROUND_BOUNDS.north && p.lat >= GROUND_BOUNDS.south && p.lng >= GROUND_BOUNDS.west && p.lng <= GROUND_BOUNDS.east,
  }))
  // 飞线汇聚中心：橘子洲（找不到就退到第 1 名）
  HUB = CITY_POINTS.find((p) => p.name.indexOf('橘子洲') >= 0 && p.onMap) || CITY_POINTS.find((p) => p.onMap)
  if (HUB) HUB.hub = true
  const off = CITY_POINTS.filter((p) => !p.onMap)
  if (off.length) console.info('[poi] 落在瓦片范围外的点位：', off.map((p) => p.name).join('、'))
}

// 点位基准离地高度（相对地面 y=0）
const POINT_Y = 0.1

const container = ref(null)
// 当前打开的景点详情（点 3D 里的卡片触发，左侧滑出详情板）
const activePoi = ref(null)
const openPoiDetail = (point) => {
  activePoi.value = point
}
let sceneView = null
let scene = null
let camera = null
let elapsed = 0
let disposed = false
// 当前主题：'dark' 科技风 / 'sat' 卫星实景
let theme = 'dark'

// 地铁线路图例（右下角）：{ name, color }，点一下高亮该线并呼吸
const metroLegends = ref([])
const activeMetroLine = ref(-1)
const selectMetroLine = (i) => {
  activeMetroLine.value = activeMetroLine.value === i ? -1 : i
}

// ============ 加载进度（瓦片 60% + 楼体 25% + 地铁 15%） ============
const loading = ref(true)
const loadProgress = ref(0)
let loadTarget = 0
const LOAD_WEIGHT = { tiles: 60, buildings: 25, metro: 15 }
let tileDone = 0
let tileTotal = 0
let buildingDone = false
let metroDone = false
// 开场飞入推迟到遮罩关闭的那一刻，避免飞完了才看到画面
let introStarted = false

const refreshLoadTarget = () => {
  const tilePart = tileTotal > 0 ? (tileDone / tileTotal) * LOAD_WEIGHT.tiles : 0
  loadTarget = Math.min(
    100,
    tilePart +
      (buildingDone ? LOAD_WEIGHT.buildings : 0) +
      (metroDone ? LOAD_WEIGHT.metro : 0),
  )
}

const modelGroup = new THREE.Group()
const flyGroup = new THREE.Group()
const buildingGroup = new THREE.Group()
const metroGroup = new THREE.Group()

// 巡游飞线材质集合，帧循环内刷新 iTime
const flyMats = []
// 地铁流管材质集合，帧循环内刷新 iTime
const metroMats = []

// 卫星底图很亮，additive 混合等于往白色上加，线会被"加没"。
// 切卫星时把地铁（线 + 站点白点）改成普通混合，颜色按本色画出来
const setMetroBlending = (sat) => {
  metroGroup.traverse((o) => {
    const m = o.material
    if (!m || !('blending' in m)) return
    const target = sat ? THREE.NormalBlending : THREE.AdditiveBlending
    if (m.blending !== target) {
      m.blending = target
      m.needsUpdate = true
    }
  })
}
// 楼体几何后台 Worker
let buildingWorker = null

// ============ 巡游飞线 shader（见 ./shaders.js） ============
// 贝塞尔曲线：起终点 + 中部两段抬高控制点
const buildCurve = (start, end) => {
  const d = start.distanceTo(end) / 3
  const p = new THREE.LineCurve3(start, end).getPoints(120)
  const v1 = new THREE.Vector3(p[40].x, p[40].y + d, p[40].z)
  const v2 = new THREE.Vector3(p[80].x, p[80].y + d, p[80].z)
  return new THREE.CubicBezierCurve3(start, v1, v2, end)
}

// 静态渐变曲线
const buildBaseLine = (curve) => {
  const points = curve.getPoints(150)
  const positions = []
  const colors = []
  const color = new THREE.Color()
  points.forEach((pt, j) => {
    color.setHSL(0.81666 + j * 0.0025, 0.88, 0.88)
    positions.push(pt.x, pt.y, pt.z)
    colors.push(color.r, color.g, color.b)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 })
  return new THREE.Line(geo, mat)
}

// 巡游流光 Points
const buildFlyPoints = (curve) => {
  const points = curve.getPoints(120)
  const positions = []
  const indexAttr = []
  const currentAttr = []
  points.forEach((pt, j) => {
    positions.push(pt.x, pt.y, pt.z)
    indexAttr.push(j / (points.length - 1))
    currentAttr.push(j)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('index', new THREE.Float32BufferAttribute(indexAttr, 1))
  geo.setAttribute('current', new THREE.Float32BufferAttribute(currentAttr, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      size: { value: 8 },
      uRange: { value: 30 },
      uTotal: { value: points.length },
      uColor: { value: new THREE.Color(0x00ffff) },
      uColor1: { value: new THREE.Color(0xff00ff) },
    },
    transparent: true,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: flyLineVertex,
    fragmentShader: flyLineFragment,
  })
  flyMats.push(mat)
  return new THREE.Points(geo, mat)
}

// ============ 点位：锥体 + 图文标签卡 + 浮动/自转 ============
const POI_LABEL_SCALE = 0.011 // 卡片缩放：觉得大就调小（0.006~0.014 之间玩）
const buildPoints = () => {
  CITY_POINTS.forEach((point, index) => {
    // 瓦片包围盒外的点没有地板可踩，直接不画
    if (!point.onMap) return
    const pos = sceneView.projectToScene(point.lng, point.lat, POINT_Y)

    const coneGeo = new THREE.ConeGeometry(0.1, 0.22, 4, 1, false)
    const coneMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(point.color),
      transparent: true,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.rotation.z = Math.PI

    // 标签：图片 + 名次 + 名称 + 评级/评分/票价，3ds 始终面向相机
    const tipElement = document.createElement('div')
    tipElement.className = 'poi-card'
    tipElement.style.setProperty('--poi', '#' + new THREE.Color(point.color).getHexString())
    const meta = [point.level, point.score ? point.score + '分' : '', point.price].filter(Boolean).join(' · ')
    // 名次单独做成一枚彩色徽标（两位数字，02 这种读起来就是排名），不再压在缩略图上
    const rankText = String(point.rank).padStart(2, '0')
    tipElement.innerHTML =
      '<span class="poi-rank"><b>' + rankText + '</b></span>' +
      '<div class="poi-thumb"><img src="' + point.img + '" alt="" draggable="false"></div>' +
      '<div class="poi-body"><div class="poi-name">' + point.name + '</div>' +
      '<div class="poi-meta">' + meta + '</div></div>'
    const tip = sceneView.createText({
      element: tipElement,
      className: 'poi-card',
      type: '3ds',
    })
    // 卡片点一下 → 左侧弹出详情（元素是动态插进 CSS3D 层的，只能手挂事件）
    tipElement.style.cursor = 'pointer'
    tipElement.addEventListener('click', (e) => {
      e.stopPropagation()
      openPoiDetail(point)
    })
    // CSS3D 对象以 DOM 像素为世界单位，需显式缩放到场景尺度
    tip.scale.set(POI_LABEL_SCALE, POI_LABEL_SCALE, POI_LABEL_SCALE)
    // 市中心几个点挨得近：按 index 分三层高度错开，卡片才不会叠成一坨
    tip.position.set(0, 0.5 + (index % 3) * 0.55, 0)

    const group = new THREE.Group()
    group.add(cone)
    group.add(tip)
    group.position.copy(pos)
    group.userData = { cone, tip, point }

    // 上下浮动：只动锥体，标签固定不动
    // 注意 tween.js v25 的第二参是 TweenGroup：传 true 才会挂到 mainGroup 由 TWEEN.update() 驱动，
    // 传 false/undefined 的 tween 不会被更新（表现就是“只有旋转、没有浮动”）
    const CONE_BASE_Y = POINT_Y // 锥体基准高度（相对点位组）
    const CONE_FLOAT_AMP = 0.12 // 浮动幅度
    cone.position.y = CONE_BASE_Y
    const rise = new TWEEN.Tween(cone.position, true)
      .to({ y: CONE_BASE_Y + CONE_FLOAT_AMP }, point.time)
      .easing(TWEEN.Easing.Quadratic.InOut)
    const fall = new TWEEN.Tween(cone.position, true)
      .to({ y: CONE_BASE_Y }, point.time)
      .easing(TWEEN.Easing.Quadratic.InOut)
    rise.start()
    rise.chain(fall)
    fall.chain(rise)

    // 绕 y 轴自转
    const spin1 = new TWEEN.Tween(cone.rotation, true).to({ y: Math.PI * 2 }, point.time * 5)
    const spin2 = new TWEEN.Tween(cone.rotation, true).to({ y: 0 }, point.time * 5)
    spin1.start()
    spin1.chain(spin2)
    spin2.chain(spin1)

    modelGroup.add(group)
  })
  scene.add(modelGroup)
}

// ============ 飞线：各非枢纽点汇聚到橘子洲 ============
const buildFlyLines = () => {
  if (!HUB) return
  const hubPos = sceneView.projectToScene(HUB.lng, HUB.lat, POINT_Y)
  CITY_POINTS.forEach((point) => {
    if (point.hub || !point.onMap) return
    const start = sceneView.projectToScene(point.lng, point.lat, POINT_Y)
    const curve = buildCurve(start, hubPos)
    flyGroup.add(buildBaseLine(curve))
    flyGroup.add(buildFlyPoints(curve))
  })
  scene.add(flyGroup)
}

// ============ 主题切换的扩散波（地面瓦片 + 楼体共用一套半径） ============
// 思路：切换时新旧两套东西同时在场景里，新的一套叠在上层，用片元 alpha 把“半径 R 以内”
// 抠出来；R 从场景中心向外涨，等于新内容从中心往四周推开，扫完才换灯、地铁、bloom。
const WAVE_DURATION = 1.4 // 波从中心扫到最外圈用时（秒）
const WAVE_MAX_R = 40 // 最大半径，盖住 58×50 的地面（半对角线约 38，留点余量）
const WAVE_BAND = 1.2 // 波前羽化宽度，越小越硬
// 相机只看得见中心 ±12 左右；用 t^1.6 让波在可视区里慢慢走，出了画面再加速收尾
const WAVE_POW = 1.6
const WAVE_BLOOM_FADE = 0.45 // 波扫完后 bloom 的淡入/淡出时长（秒）
// 波心=场景原点（模型中心），卡在地面高度附近
const waveCenter = new THREE.Vector2(0, 0)
const makeWaveUniforms = () => ({
  uWaveR: { value: WAVE_MAX_R },
  uWaveB: { value: WAVE_BAND },
  uWaveC: { value: waveCenter },
  uWaveOn: { value: 0 },
})
// 每种材质各自一份 uniform（同一帧里把 uWaveR 同步成同一个值）
const waveU = { dark: makeWaveUniforms(), sat: makeWaveUniforms() }
const buildingWaveU = { sci: makeWaveUniforms(), real: makeWaveUniforms() }
// 背景/雾的两端颜色：0 = 暗色主题，1 = 卫星主题
const BG_DARK = new THREE.Color(0x0b2231)
const BG_SAT = new THREE.Color(0xc9e2ee)
const _tmpBg = new THREE.Color()
const _tmpFog = new THREE.Color()

// ============ 楼体：GeoJSON 现场拉伸并合并为单 Mesh（范式同源工程 work.js） ============
// 楼体片元（科技渐变 + 波前）、地铁流光 shader 都在 ./shaders.js
const BUILDING_CFG = { heightScale: 0.004, minHeight: 0.05, maxHeight: 0.9 }

// 进场动画：镜头飞完之后楼体再从地面长起来
const INTRO_FLY_MS = 1800 // 与 onMounted 里的 flyTo 时长一致
const GROW_CFG = { delay: 0.5, duration: 1.6 } // 起飞后延迟（秒）/ 生长时长（秒）

// 扫光光条：暗色主题下从中心向外扩散的一条亮带
const SWEEP_CFG = {
  color: 0xffffff, // 光条颜色
  width: 2, // 光条宽度（世界单位，越大越散）
  radius: 44, // 扫到多远结束
  duration: 3, // 单次扩散用时（秒）
  interval: 4, // 两次扫光间隔（秒）
  intensity: 0.5, // 亮度
}

const GROW_UNIFORM = { value: 0 }
const sweepU = {
  uSweepR: { value: 0 },
  uSweepW: { value: SWEEP_CFG.width },
  uSweepColor: { value: new THREE.Color(SWEEP_CFG.color) },
  uSweepOn: { value: 0 },
}

const buildBuildingMaterial = () => {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uBottom: { value: new THREE.Color(0x0b1060) },
        uTop: { value: new THREE.Color(0x2aa8c4) },
        uMaxHeight: { value: BUILDING_CFG.maxHeight },
      },
    ]),
    fog: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    // 常开：波前靠片元 alpha 抠图；不开的话整层 alpha 被忽略，波就看不见
    transparent: true,
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  })
  // merge 会深拷贝 uniform，这里改回共享引用，波前推进时才有地方改值
  mat.uniforms.uWaveR = buildingWaveU.sci.uWaveR
  mat.uniforms.uWaveB = buildingWaveU.sci.uWaveB
  mat.uniforms.uWaveC = buildingWaveU.sci.uWaveC
  mat.uniforms.uWaveOn = buildingWaveU.sci.uWaveOn
  mat.uniforms.uGrow = GROW_UNIFORM
  mat.uniforms.uSweepR = sweepU.uSweepR
  mat.uniforms.uSweepW = sweepU.uSweepW
  mat.uniforms.uSweepColor = sweepU.uSweepColor
  mat.uniforms.uSweepOn = sweepU.uSweepOn
  return mat
}

// 两套楼体材质：科技风高度渐变 / 真实灰白实体（切到卫星图时换后者）
const buildingMatSci = buildBuildingMaterial()
const buildingMatReal = new THREE.MeshStandardMaterial({
  color: 0x9aa4af,
  roughness: 0.85,
  metalness: 0.06,
  fog: true,
  side: THREE.DoubleSide, // 必须和科技那套一致：sci 是双面，单面会让轮廓少一圈，切换时像楼体缩了一下/位移
  transparent: true, // 同上：常开，靠波前 alpha 抠图，不在切换过程中改
})
// 灰白材质走内置着色器，用 onBeforeCompile 注入同一套波前判断（注入代码在 ./shaders.js）
buildingMatReal.onBeforeCompile = (shader) => {
  shader.uniforms.uWaveR = buildingWaveU.real.uWaveR
  shader.uniforms.uWaveB = buildingWaveU.real.uWaveB
  shader.uniforms.uWaveC = buildingWaveU.real.uWaveC
  shader.uniforms.uWaveOn = buildingWaveU.real.uWaveOn
  // 两套楼体共享同一个高度生长 uniform，切换主题时形状不会突然差一截
  shader.uniforms.uGrow = GROW_UNIFORM
  shader.vertexShader = injectWaveVertex(shader.vertexShader, true)
  shader.fragmentShader = injectWaveFragment(shader.fragmentShader)
}
let buildingMeshSci = null
let buildingMeshReal = null

const buildBuildings = () => {
  buildingWorker = new Worker(new URL('./buildings.worker.js', import.meta.url), { type: 'module' })
  buildingWorker.postMessage({
    url: '/3d/source/cs_city_full.json',
    center: [112.96, 28.195],
    worldScale: 0.0012,
    heightScale: BUILDING_CFG.heightScale,
    minHeight: BUILDING_CFG.minHeight,
    maxHeight: BUILDING_CFG.maxHeight,
  })
  buildingWorker.onmessage = (e) => {
    const payload = e.data
    if (disposed || !payload || payload.error) {
      buildingWorker?.terminate()
      buildingWorker = null
      return
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(payload.position), 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(payload.normal), 3))
    if (payload.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(payload.uv), 2))
    if (payload.index) {
      const IndexArr = payload.indexType === 'uint32' ? Uint32Array : Uint16Array
      geo.setIndex(new THREE.BufferAttribute(new IndexArr(payload.index), 1))
    }
    // 同一份几何挂两套材质：换主题时靠波前把上面那层抠出来，扫完再藏掉下面那层
    buildingMeshSci = new THREE.Mesh(geo, buildingMatSci)
    buildingMeshReal = new THREE.Mesh(geo, buildingMatReal)
    ;[buildingMeshSci, buildingMeshReal].forEach((m, i) => {
      m.rotateX(-Math.PI / 2)
      m.renderOrder = i + 1
      buildingGroup.add(m)
    })
    buildingMeshSci.visible = theme === 'dark'
    buildingMeshReal.visible = theme === 'sat'
    scene.add(buildingGroup)
    buildingDone = true
    refreshLoadTarget()
    buildingWorker.terminate()
    buildingWorker = null
  }
  buildingWorker.onerror = (err) => {
    console.error('[building worker]', err)
    buildingDone = true
    refreshLoadTarget()
    buildingWorker?.terminate()
    buildingWorker = null
  }
}

// ============ 地铁线路与站点 ============
const METRO_Y = 0.04
const METRO_LABEL_Y = 0.12 // 站点标签离地高度
const buildMetro = async () => {
  const resp = await fetch('/3d/source/cs_dt.json')
  const data = await resp.json()
  if (disposed) return
  const stationPts = []
  // 站点记录：按站名去重，同时记下它出现在几条线上——2 条以上是换乘站，标签换成图标
  const stationMap = new Map()
  metroLegends.value = []
  ;(data.l || []).forEach((line, idx) => {
    const pts = (line.st || [])
      .map((s) => {
        const [lng, lat] = String(s.sl).split(',').map(Number)
        if (Number.isNaN(lng) || Number.isNaN(lat)) return null
        const { x, y } = sceneView.projectPlane(lng, lat)
        if (s.n) {
          const rec = stationMap.get(s.n)
          if (rec) rec.lines.add(idx)
          else stationMap.set(s.n, { name: s.n, x, y, lines: new Set([idx]) })
        }
        // 线高 0.06：贴着地面走（地面 0.02），既压得住楼体又不和瓦片 z-fighting
        return new THREE.Vector3(x, METRO_Y, -y)
      })
      .filter(Boolean)
    if (pts.length < 2) return

    // tension 0.1：站点之间基本走直线，只在转角处留一点点圆角；原来默认 0.5 是"香肠状"的圆
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1)
    // 采样成密集折线（Line 只有 1px，靠采样密度保证缓弯不折棱）
    const segCount = Math.max(160, pts.length * 24)
    const samples = curve.getPoints(segCount)

    // 累计弧长归一化 → 每个顶点的流光坐标，替代原 tube 的 uv.x
    const prog = new Float32Array(samples.length)
    let total = 0
    for (let i = 1; i < samples.length; i++) {
      total += samples[i].distanceTo(samples[i - 1])
      prog[i] = total
    }
    if (total > 0) for (let i = 0; i < prog.length; i++) prog[i] /= total

    const lineGeo = new THREE.BufferGeometry().setFromPoints(samples)
    lineGeo.setAttribute('aProgress', new THREE.BufferAttribute(prog, 1))

    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        lineColor: { value: new THREE.Color('#' + line.cl) },
        hiColor: { value: new THREE.Color(0xffffff) },
        iTime: { value: 0 },
        uSpeed: { value: 0.18 },
        uPhase: { value: idx / Math.max(1, data.l.length) },
        uCount: { value: 2 },
        uTail: { value: 0.5 },
        uOpacity: { value: 0.95 },
        // 图例选中用的两个量：uHi 0/1 高亮，uBreath 0..1 呼吸
        uHi: { value: 0 },
        uBreath: { value: 0 },
      },
      fog: false,
      transparent: true,
      depthWrite: false,
      // 不被深度检测：楼体是后画的透明物，靠 renderOrder 压到线路前面才行
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: metroVertex,
      fragmentShader: metroFragment,
    })
    lineMat.userData.legendIndex = metroLegends.value.length
    metroLegends.value.push({ name: line.ln, color: '#' + line.cl })
    metroMats.push(lineMat)
    const lineObj = new THREE.Line(lineGeo, lineMat)
    lineObj.renderOrder = 8 // 在所有透明楼体（1/2）之后画，线永远浮在上面
    metroGroup.add(lineObj)
    stationPts.push(...pts)
  })

  if (stationPts.length) {
    const stationGeo = new THREE.BufferGeometry().setFromPoints(stationPts)
    const ptsObj = new THREE.Points(
      stationGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    )
    ptsObj.renderOrder = 9
    metroGroup.add(ptsObj)
  }

  // 站点标签（挂在 metroGroup 上）
  // 普通站 = 站名文字；换乘站 = ⇄ 图标 + 站名（图标只是标记，名字要看得见）
  stationMap.forEach(({ name, x, y, lines }) => {
    const isHub = lines.size > 1
    const el = document.createElement('div')
    el.className = isHub ? 'metro-hub' : 'metro-tip'
    if (isHub) {
      el.title = name + '（换乘站）'
      el.innerHTML = '<i>⇄</i><span>' + name + '</span>'
    } else {
      el.innerText = name
    }
    const label = sceneView.createText({ element: el, className: el.className, type: '3ds' })
    // 卡片化之后整体变宽，缩放比原来纯文字小一点，密度才不会被放大
    const s = isHub ? 0.0058 : 0.0050
    label.scale.set(s, s, s)
    label.position.set(x, METRO_LABEL_Y, -y)
    metroGroup.add(label)
  })
  scene.add(metroGroup)
  metroDone = true
  refreshLoadTarget()
}

// ============ 路网瓦片地面 ============
// 两套底图：暗色矢量砖（本地渲染）/ 卫星影像砖（Esri World Imagery，同为 WGS84）
// 卫星砖用 z13（每块覆盖 2×2 个 z14 块），刚好贴住同一个包围盒，且体积只有 1.5MB
const TILE_SETS = {
  dark: { dir: '/tiles-ofm', zoom: 14, xMin: 13324, xMax: 13343, yMin: 6843, yMax: 6859, ext: '.png', opacity: 0.95 },
  sat: { dir: '/tiles-sat', zoom: 13, xMin: 6662, xMax: 6671, yMin: 3421, yMax: 3429, ext: '.jpg', opacity: 1 },
}
// 轻微外扩，吃掉浮点误差与纹理采样的发丝缝（0.6% ≈ 1cm）
const TILE_OVERLAP = 1.006

// XYZ 瓦片编号 ↔ 经纬度（与 SceneView 的 Web Mercator 同源，每块严格等边长）
const tileLon = (x, z) => (x / Math.pow(2, z)) * 360 - 180
const tileLat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / Math.pow(2, z)))

// 两套砖必须共用同一个经纬包围盒（以暗色 z14 那套为准）
// 卫星 z13 天生比它多出北边一行半：不夹的话最外圈那块要等波推到尾声才露脸 / 或者收尾时突然收掉，
// 看着就像地板高度跳了一下
const GROUND_BOUNDS = {
  west: tileLon(TILE_SETS.dark.xMin, TILE_SETS.dark.zoom),
  east: tileLon(TILE_SETS.dark.xMax + 1, TILE_SETS.dark.zoom),
  north: tileLat(TILE_SETS.dark.yMin, TILE_SETS.dark.zoom),
  south: tileLat(TILE_SETS.dark.yMax + 1, TILE_SETS.dark.zoom),
}

// 两套地面各自一个 Group，切换时按波前扩散显隐，不重建几何
const groundGroups = {}

const buildGround = (key) => {
  const { zoom, xMin, xMax, yMin, yMax, dir, ext, opacity } = TILE_SETS[key]
  const loader = new THREE.TextureLoader()
  const group = new THREE.Group()
  const wu = waveU[key]
  // 纹理异步加载：记录“还差几张”，全部落地后再允许波开始（否则会扫出一片黑砖）
  let pending = 0
  // 只有首屏那套（暗色）计入加载进度，卫星瓦片是切换时才拉的
  const countsForLoad = key === 'dark'
  group.userData.ready = false
  const onOne = () => {
    pending -= 1
    if (countsForLoad) {
      tileDone += 1
      refreshLoadTarget()
    }
    if (pending <= 0) group.userData.ready = true
  }
  // 瓦片与楼体同为 WGS84 + Web Mercator，直接投影即可
  const project = (lng, lat) => sceneView.projectPlane(lng, lat)
  const B = GROUND_BOUNDS

  for (let tx = xMin; tx <= xMax; tx++) {
    const west = tileLon(tx, zoom)
    const east = tileLon(tx + 1, zoom)
    // 横向也夹到统一包围盒（现在两套刚好对齐，留作保险）
    const cWest = Math.max(west, B.west)
    const cEast = Math.min(east, B.east)
    if (cEast <= cWest) continue

    for (let ty = yMin; ty <= yMax; ty++) {
      // 瓦片编号 y 越大越靠南：(ty) 是北边纬线，(ty + 1) 是南边纬线
      const north = tileLat(ty, zoom)
      const south = tileLat(ty + 1, zoom)
      // 纵向夹到同一范围：卫星最北那块只保留落在暗色包围盒里的那半截
      const cNorth = Math.min(north, B.north)
      const cSouth = Math.max(south, B.south)
      if (cNorth <= cSouth) continue

      const sw = project(cWest, cSouth)
      const ne = project(cEast, cNorth)
      const w = ne.x - sw.x
      const h = ne.y - sw.y

      // 被夹过的块只显示纹理里对应的那一段，否则整幅纹理会被压扁拉长
      const u0 = (cWest - west) / (east - west)
      const u1 = (cEast - west) / (east - west)
      const v0 = (cSouth - south) / (north - south) // 0 = 南边
      const v1 = (cNorth - south) / (north - south)

      pending += 1
      if (countsForLoad) tileTotal += 1
      const tex = loader.load(`${dir}/${zoom}/${tx}_${ty}${ext}`, onOne, undefined, onOne)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true, // 让两张地面能在同一帧里叠着混，靠波前 alpha 决定谁露脸
        opacity,
        depthWrite: false,
        // 地面吃雾：远处渐隐入背景色，近处保持清晰（雾色随主题切换，见 setTheme）
        fog: true,
      })
      // 波前：把“离波心 > R”的部分裁掉。R 由 onFrame 逐帧推进，扫过即完成贴图切换
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWaveR = wu.uWaveR
        shader.uniforms.uWaveB = wu.uWaveB
        shader.uniforms.uWaveC = wu.uWaveC
        shader.uniforms.uWaveOn = wu.uWaveOn
        shader.vertexShader = injectWaveVertex(shader.vertexShader)
        shader.fragmentShader = injectWaveFragment(shader.fragmentShader)
      }
      // 单块尺寸按自身经纬范围反算，块块等宽等高 → 相邻边天然重合
      const geo = new THREE.PlaneGeometry(w * TILE_OVERLAP, h * TILE_OVERLAP)
      // 夹过的块改写 uv：plane 的 v=1 在北、v=0 在南，直接把 0~1 重映射到 v0~v1
      if (u0 > 0 || u1 < 1 || v0 > 0 || v1 < 1) {
        const uv = geo.attributes.uv
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i))
        }
        uv.needsUpdate = true
      }
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotateX(-Math.PI / 2)
      mesh.position.set((sw.x + ne.x) / 2, 0.02, -(sw.y + ne.y) / 2)
      group.add(mesh)
    }
  }
  scene.add(group)
  group.renderOrder = 0
  groundGroups[key] = group
  if (pending <= 0) group.userData.ready = true
  return group
}

const isSatMode = ref(false)

// 正在推进的主题切换：{ next, t, waiting }
let swap = null
// 波扫完之后单独的 bloom 淡入淡出：{ from, to, t }
let bloomFade = null
const BLOOM_STRENGTH = 0.4

// 背景色跟着波前一起亮/暗
const FOG_NEAR = 8
const FOG_FAR = 22
const applyThemeColor = (k) => {
  _tmpBg.copy(BG_DARK).lerp(BG_SAT, k)
  if (scene.background && scene.background.isColor) scene.background.copy(_tmpBg)
}
// 两套主题共用同一组雾参数：切换全程浓度不变，只换雾色，
// 就不会出现“色亮了、雾还浓”糊成一整片奶白（也就不用再单独收放雾的 near/far）
const applyFogRange = () => {
  if (!scene.fog) return
  scene.fog.near = FOG_NEAR
  scene.fog.far = FOG_FAR
}
// 雾色跟背景同一节奏：波推到哪，雾色就跟着过到哪
const applyFogColor = (k) => {
  if (!scene.fog || !scene.fog.color) return
  _tmpFog.copy(BG_DARK).lerp(BG_SAT, k)
  scene.fog.color.copy(_tmpFog)
}

// 波扫完：收掉旧地面，再一次性换“其他内容”（材质/灯/地铁/飞线）
const finishSwap = () => {
  if (!swap) return
  const sat = swap.next === 'sat'
  theme = swap.next
  isSatMode.value = sat

  for (const key of ['dark', 'sat']) {
    waveU[key].uWaveR.value = WAVE_MAX_R
    waveU[key].uWaveOn.value = 0
  }
  for (const key of ['sci', 'real']) {
    buildingWaveU[key].uWaveR.value = WAVE_MAX_R
    buildingWaveU[key].uWaveOn.value = 0
  }
  applyThemeColor(sat ? 1 : 0)
  applyFogRange()
  applyFogColor(sat ? 1 : 0)

  // 楼体不再藏层：两份几何完全重合，上下先后由 renderOrder 决定，
  // 材质的 transparent 创建时就定死不开开关（改它会换绘制队列，收尾帧次序就变了）
  // 卫星主题也显示地铁（线 + 站点 + 标签），只收起飞线
  metroGroup.visible = true
  flyGroup.visible = !sat
  setMetroBlending(sat)
  // 切卫星时 bloom 已经在扩散前关掉了；切回暗色才是扫完之后再淡入
  if (sceneView.bloomPass) {
    if (sat) {
      bloomFade = null
      sceneView.bloomPass.strength = 0
      sceneView.bloomPass.enabled = false
    } else {
      sceneView.bloomPass.enabled = true // 先挂上 pass，强度从 0 往上淡，否则会到整帧结束才“啪”地亮
      bloomFade = { from: sceneView.bloomPass.strength ?? 0, to: BLOOM_STRENGTH, t: 0 }
    }
  }
  swap = null
}

// 深浅背景切换：地板贴图从中心向四周推开，扫完再换材质/灯/地铁/飞线
const setTheme = (next) => {
  if (!sceneView || !scene) return
  // 上一波没走完就又点了：先把上一波当场收尾，再从当前状态反向扫
  if (swap) finishSwap()
  if (next === theme) return
  const sat = next === 'sat'

  // 卫星地面按需构建（只建一次），暗色地面常驻
  if (sat && !groundGroups.sat) buildGround('sat')
  const incoming = groundGroups[sat ? 'sat' : 'dark']
  const outgoing = groundGroups[sat ? 'dark' : 'sat']
  if (!incoming || !outgoing) return

  isSatMode.value = sat
  // 两套地面同时在场：新地面画在旧地面之上，只让新地面吃波前
  incoming.visible = true
  incoming.renderOrder = -1  // 负号排在所有默认 0 的线/点之前，否则地板会盖住地铁流光
  outgoing.visible = true
  outgoing.renderOrder = -2  // 旧地面垫在新地面之下
  waveU.sat.uWaveOn.value = sat ? 1 : 0
  waveU.dark.uWaveOn.value = sat ? 0 : 1
  waveU.sat.uWaveR.value = 0
  waveU.dark.uWaveR.value = 0

  // 楼体同理：两套材质同挂在一份几何上，新材质那层吃波前，旧材质那层垫底
  if (buildingMeshSci && buildingMeshReal) {
    const inMesh = sat ? buildingMeshReal : buildingMeshSci
    const outMesh = sat ? buildingMeshSci : buildingMeshReal
    inMesh.visible = true
    outMesh.visible = true
    inMesh.renderOrder = 2 // 谁在上面只由 renderOrder 决定，跟透明开关无关
    outMesh.renderOrder = 1
    // 两套材质的 transparent 常开（创建时就定死），这里不再改：
    // 改 transparent 会把物体在“不透明/透明”两个队列之间搬家，收尾那一帧绘制次序就变了
    buildingWaveU.real.uWaveOn.value = sat ? 1 : 0
    buildingWaveU.sci.uWaveOn.value = sat ? 0 : 1
    buildingWaveU.real.uWaveR.value = 0
    buildingWaveU.sci.uWaveR.value = 0
  }

  // 夜景靠低照度压出氛围；换成灰白实景材质后 0.5/0.5 会把楼体压成黑点。
  // 波一开始就调灯：灰白材质是逐块露脸的，等到最后再调，中段全是黑点
  if (sceneView.dirLight) sceneView.dirLight.intensity = sat ? 1.15 : 0.5
  if (sceneView.ambLight) sceneView.ambLight.intensity = sat ? 0.85 : 0.5

  // 切卫星：只让飞线先退场，地铁这次保留；混合模式当场就换，扩散过程中就能看清
  if (sat) {
    flyGroup.visible = false
  }
  setMetroBlending(sat)

  // 卫星浅底上白字看不清：给 body 打一个类，标签样式在末尾非 scoped 块里跟着换深色
  document.body.classList.toggle('cm-sat', sat)

  // 切卫星时 bloom 要先关掉，关完才起波（bloomFade 由 stepBloom 跑，跑完清空）
  let waitBloom = false
  if (sat && sceneView.bloomPass) {
    const bp = sceneView.bloomPass
    const cur = bp.enabled ? (bp.strength ?? BLOOM_STRENGTH) : 0
    bp.enabled = true // 先启用再淡，淡到 0 时 stepBloom 会自己关掉
    if (cur > 0.001) {
      bloomFade = { from: cur, to: 0, t: 0 }
      waitBloom = true
    } else {
      bp.strength = 0
      bp.enabled = false
    }
  }

  // 卫星砖要等 90 张纹理全部落地再起波，否则会扫出一片黑砖（一般 0.2~0.5s）
  swap = { next, t: 0, waitBloom, waiting: !incoming.userData.ready }
}

// 每帧推进波前
const stepSwap = (delta) => {
  if (!swap) return
  // 等 bloom 关完再扩散
  if (swap.waitBloom) {
    if (bloomFade) return
    swap.waitBloom = false
    swap.t = 0
  }
  const incoming = groundGroups[swap.next === 'sat' ? 'sat' : 'dark']
  if (swap.waiting) {
    if (!incoming || !incoming.userData.ready) return
    swap.waiting = false
    swap.t = 0
  }
  // 夹住 delta：切卫星时要解码 90 张 jpg，那一帧可能卡 0.5s+，不夹住波会直接跳到底
  swap.t = Math.min(1, swap.t + Math.min(delta, 0.05) / WAVE_DURATION)
  // 雾的浓度不参与波前（两套主题共用一组 near/far），但雾色跟背景同一节奏慢慢过
  // 波前推进：可视区内慢、出画面快
  const k = Math.pow(swap.t, WAVE_POW)
  const r = WAVE_MAX_R * k
  waveU.dark.uWaveR.value = r
  waveU.sat.uWaveR.value = r
  buildingWaveU.sci.uWaveR.value = r
  buildingWaveU.real.uWaveR.value = r
  const sat = swap.next === 'sat'
  applyThemeColor(sat ? k : 1 - k)
  applyFogColor(sat ? k : 1 - k)
  if (swap.t >= 1) finishSwap()
}

// 波扫完之后才动 bloom：0.4 → 0 淡出（切卫星）/ 0 → 0.4 淡入（切暗色）
const stepBloom = (delta) => {
  if (!bloomFade || !sceneView?.bloomPass) return
  const bp = sceneView.bloomPass
  bloomFade.t = Math.min(1, bloomFade.t + Math.min(delta, 0.05) / WAVE_BLOOM_FADE)
  const k = bloomFade.t * bloomFade.t * (3 - 2 * bloomFade.t) // smoothstep
  bp.strength = bloomFade.from + (bloomFade.to - bloomFade.from) * k
  if (bloomFade.t >= 1) {
    bp.strength = bloomFade.to
    bp.enabled = bloomFade.to > 0
    bloomFade = null
  }
}

// ============ 进场动画：镜头飞完 → 楼体长高 → 暗色扫光 ============
let introClock = 0
let sweepClock = 0
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)

const stepIntro = (delta) => {
  if (!introStarted) return
  introClock += delta
  const growStart = INTRO_FLY_MS / 1000 + GROW_CFG.delay
  const k = Math.min(1, Math.max(0, (introClock - growStart) / GROW_CFG.duration))
  GROW_UNIFORM.value = easeOutCubic(k)

  // 扫光：暗色主题、楼体长完之后循环扫；卫星主题直接关掉
  if (theme === 'dark' && k >= 1) {
    sweepClock += delta
    const p = sweepClock % SWEEP_CFG.interval
    if (p < SWEEP_CFG.duration) {
      sweepU.uSweepOn.value = SWEEP_CFG.intensity
      sweepU.uSweepR.value = SWEEP_CFG.radius * (p / SWEEP_CFG.duration)
    } else {
      sweepU.uSweepOn.value = 0
    }
  } else {
    sweepU.uSweepOn.value = 0
  }
}

const onFrame = (delta) => {
  elapsed += delta
  // 加载进度：真实资源进度为主，目标没满时自己再往 99 蹭，避免长时间钉在 75%
  if (loading.value) {
    const step = Math.min(1, delta * 6)
    // 只涨不跌：真实进度晚到（例如楼体 100 后又回落到 75）时不再往回缩
    const prev = loadProgress.value
    loadProgress.value = Math.max(prev, prev + (loadTarget - prev) * step)
    if (loadTarget < 100 && loadProgress.value > 70) {
      // 指数逼近 98.7（四舍五入显示就是 99%）：越接近越慢，收尾还留 1.5 个点给真实进度走完
      loadProgress.value += (98.7 - loadProgress.value) * Math.min(1, delta * 0.6)
    }
    if (loadProgress.value > 100) loadProgress.value = 100
    if (loadTarget >= 100 && loadProgress.value >= 99.5) {
      loadProgress.value = 100
      loading.value = false
      // 遮罩关闭的同时启动开场飞入，保证飞入动画是看得见的
      if (!introStarted && sceneView && camera) {
        introStarted = true
        sceneView.flyTo(camera.position, { x: 0, y: 6, z: 10 }, 1800)
      }
    }
  }
  if (!scene) return
  stepIntro(delta)
  stepSwap(delta)
  stepBloom(delta)
  flyMats.forEach((mat) => {
    mat.uniforms.iTime.value = elapsed
  })
  // 地铁：流光时间 + 选中高亮（uHi 平滑逼近）+ 呼吸（uBreath）
  const activeIdx = activeMetroLine.value
  metroMats.forEach((mat) => {
    mat.uniforms.iTime.value = elapsed
    const isActive = mat.userData.legendIndex === activeIdx
    const cur = mat.userData.hi || 0
    mat.userData.hi = cur + ((isActive ? 1 : 0) - cur) * Math.min(1, delta * 9)
    mat.uniforms.uHi.value = mat.userData.hi
    mat.uniforms.uBreath.value = 0.5 + 0.5 * Math.sin(elapsed * 3.2)
    // 有选中时其它线压暗，让高亮那条跳出来
    mat.uniforms.uOpacity.value = activeIdx >= 0 ? (isActive ? 1 : 0.4) : 0.95
  })
}

onMounted(async () => {
  sceneView = new SceneView(container.value, {
    mode: '',
    bgColor: 0x0b2231,
    environment: false,
    shadowMapEnabled: false,
    floor: { enabled: false },
    // 地面已经是 58.7×50 单位的全城底图：25/60 会让中心就吃到雾，改成 26/52
    // 相机到中心 28.4 单位 → 雾占比约 2%，到四角 44 单位 → 约 79%，边缘自然融进背景
    fog: { enabled: true, color: 0x0b2231, near: 8, far: 22 },
    ambLight: { enabled: true, color: 0x404040, intensity: 0.5 },
    dirLight: { enabled: true, color: 0xffffff, intensity: 0.5, position: { x: 0, y: 30, z: 50 } },
    control: {
      enabled: true,
      enableDamping: true,
      dampingFactor: 0.3,
      zoomSpeed: 2,
      minDistance: 1,
      maxDistance: 16,
      minPolarAngle: -Math.PI / 2,
      maxPolarAngle: Math.PI / 2.2,
      panLimit: { enabled: true, min: { x: -10, z: -10 }, max: { x: 20, z: 10 } }
    },
    geo: {
      center: [112.96, 28.195],
      worldScale: 0.0012,
    },
    postProcessing: {
      enabled: true,
      smaa: { enabled: true },
      gtao: { enabled: false },
      bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.4 },
      vignette: { enabled: true, darkness: 0.75, offset: 1.6 },
      film: { enabled: false },
      bokeh: { enabled: false },
      outline: { enabled: false },
    },
  })

  scene = sceneView.scene
  camera = sceneView.camera
  camera.position.set(0, 34, 30)

  // 点位数据先就位，再建锥体与飞线（飞线要按枢纽点算）
  try {
    await loadPoiData()
  } catch (e) {
    console.warn('[poi] 点位数据加载失败', e)
  }
  buildPoints()
  buildFlyLines()
  buildGround('dark')
  // 楼体、地铁数据异步加载，不阻塞点位入场
  buildBuildings()
  // 城区边界凸包暂隐藏（需要时恢复 buildOutline() 调用）
  // buildOutline()
  buildMetro().finally(() => {
    metroDone = true
    refreshLoadTarget()
  })

  sceneView.animateCallback = onFrame
  sceneView.start()
  // 开场飞入在 onFrame 里等遮罩关闭后再触发（见 introStarted）
})

onUnmounted(() => {
  disposed = true
  document.body.classList.remove('cm-sat')
  buildingWorker?.terminate()
  buildingWorker = null
  if (sceneView) {
    sceneView.clear()
    sceneView = null
  }
  scene = null
  camera = null
})
</script>

<template>
  <div class="city-container">
    <div ref="container" class="city-canvas-wrap"></div>

    <!-- 加载遮罩（公共组件） -->
    <SceneLoading
      :visible="loading"
      :progress="loadProgress"
      brand="CITY MAP"
      title="长沙城市模型载入"
      status="正在加载瓦片底图 · 楼体与地铁线路构建中"
      accent="#4fd1ff"
      accent2="#7cf7c4"
    />

    <div class="city-header">
      <h3>长沙 TOP10 景点</h3>
      <span>热度排名 · 实景缩略图 · 评级/评分/票价 · 汇聚飞线</span>
    </div>
    <div class="city-switch">
      <button :class="['theme-btn', isSatMode ? 'is-sat' : 'is-dark']" @click="setTheme(isSatMode ? 'dark' : 'sat')">
        {{ isSatMode ? '深色背景' : '卫星背景' }}
      </button>
    </div>

    <!-- 景点详情板：点 3D 卡片后从左侧滑出 -->
    <aside v-if="activePoi" class="poi-detail">
      <button class="pd-close" @click="activePoi = null">×</button>
      <div class="pd-cover">
        <img :src="activePoi.img" alt="" />
        <span class="pd-rank">TOP {{ activePoi.rank }}</span>
      </div>
      <div class="pd-head">
        <h4>{{ activePoi.name }}</h4>
        <div class="pd-tags">
          <span v-if="activePoi.level">{{ activePoi.level }}</span>
          <span>{{ activePoi.score }} 分</span>
          <span>{{ activePoi.price }}</span>
        </div>
        <p class="pd-intro">{{ activePoi.intro }}</p>
        <p class="pd-sub">{{ activePoi.comments }} 条评论 · {{ activePoi.open }}</p>
      </div>
      <section class="pd-sec">
        <h5>景点特色</h5>
        <p>{{ activePoi.features }}</p>
      </section>
      <section v-if="activePoi.plays && activePoi.plays.length" class="pd-sec">
        <h5>好玩项目</h5>
        <ul>
          <li v-for="it in activePoi.plays" :key="it">{{ it }}</li>
        </ul>
      </section>
      <section v-if="activePoi.foods && activePoi.foods.length" class="pd-sec">
        <h5>美食推荐</h5>
        <ul>
          <li v-for="it in activePoi.foods" :key="it">{{ it }}</li>
        </ul>
      </section>
      <div class="pd-foot">地址：{{ activePoi.addr }}</div>
    </aside>

    <!-- 地铁线路图例：右下角，点一条就高亮并呼吸（卫星主题里地铁也显示，图例跟着留着） -->
    <div v-if="metroLegends.length" class="metro-legend">
      <div class="ml-head">地铁线路</div>
      <button
        v-for="(l, i) in metroLegends"
        :key="l.name"
        :class="['ml-item', { active: activeMetroLine === i }]"
        :style="{ '--line': l.color }"
        @click="selectMetroLine(i)"
      >
        <i class="ml-bar" />
        <span>{{ l.name }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.city-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.city-canvas-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #0a1929;
  overflow: hidden;
}

.city-header {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 10;
  pointer-events: none;

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 6px;
  }

  span {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }
}

.city-switch {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 10;

  .theme-btn {
    min-width: 104px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 1px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.25s ease;
    backdrop-filter: blur(8px);

    &.is-dark {
      color: #7fe3ff;
      background: rgba(10, 40, 64, 0.72);
      border: 1px solid rgba(63, 198, 255, 0.55);
      box-shadow: 0 0 12px rgba(63, 198, 255, 0.25) inset;
    }

    &.is-dark:hover {
      color: #fff;
      border-color: rgba(63, 198, 255, 0.95);
      box-shadow: 0 0 18px rgba(63, 198, 255, 0.45);
    }

    // 卫星模式下换成浅色实心按钮，压在亮底图上才看得见
    &.is-sat {
      color: #16344d;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(22, 52, 77, 0.25);
    }

    &.is-sat:hover {
      background: #fff;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    }
  }
}

/* ===== 地铁线路图例（右下） ===== */
.metro-legend {
  position: absolute;
  right: 24px;
  bottom: 26px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(79, 209, 255, 0.16);
  background: linear-gradient(160deg, rgba(7, 26, 40, 0.86), rgba(4, 12, 22, 0.8));
  backdrop-filter: blur(4px);
}

.ml-head {
  margin-bottom: 2px;
  font-size: 10px;
  letter-spacing: 2px;
  color: #5f8093;
}

.ml-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 2px 4px;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #a9c8d8;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: #fff;
    background: rgba(79, 209, 255, 0.1);
  }

  &.active {
    color: #fff;
    outline: 1px solid var(--line);
    outline-offset: 2px;
    animation: ml-breath 1.7s ease-in-out infinite;
  }
}

.ml-bar {
  flex: none;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: var(--line);
  box-shadow: 0 0 6px var(--line);
}

@keyframes ml-breath {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  50% {
    box-shadow: 0 0 14px -2px var(--line);
  }
}

/* ===== 景点详情板（点 3D 卡片后从左侧滑出） ===== */
.poi-detail {
  position: absolute;
  left: 24px;
  top: 96px;
  bottom: 26px;
  z-index: 999;
  width: 320px;
  padding: 12px 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(79, 209, 255, 0.22);
  background: linear-gradient(160deg, rgba(7, 26, 40, 0.94), rgba(4, 12, 22, 0.9));
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 0 40px rgba(79, 209, 255, 0.06);
  backdrop-filter: blur(6px);
  overflow-y: auto;
  color: #cfe6f2;
  animation: pd-in 0.26s ease;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(79, 209, 255, 0.25);
    border-radius: 3px;
  }
}

@keyframes pd-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.pd-close {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 2;
  width: 22px;
  height: 22px;
  line-height: 20px;
  font-size: 15px;
  color: #bfe9ff;
  background: rgba(4, 14, 24, 0.7);
  border: 1px solid rgba(79, 209, 255, 0.3);
  border-radius: 50%;
  cursor: pointer;
  transition: 0.2s;

  &:hover {
    color: #fff;
    background: rgba(79, 209, 255, 0.22);
  }
}

.pd-cover {
  position: relative;
  height: 148px;
  margin: -12px -14px 12px;
  border-radius: 10px 10px 0 0;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
  }

  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 48px;
    background: linear-gradient(180deg, transparent, rgba(5, 18, 30, 0.9));
  }
}

.pd-rank {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 2;
  padding: 2px 8px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #bfeaff;
  background: rgba(6, 20, 32, 0.78);
  border-left: 2px solid #4fd1ff;
}

.pd-head {
  h4 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 1px;
    color: #fff;
  }
}

.pd-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 9px;

  span {
    padding: 1px 7px;
    font-size: 10px;
    letter-spacing: 0.5px;
    color: #7ee0ff;
    border: 1px solid rgba(79, 209, 255, 0.32);
    border-radius: 3px;
  }
}

.pd-intro {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #90b6c8;
}

.pd-sub {
  margin: 0;
  font-size: 10px;
  color: #5f8093;
}

.pd-sec {
  margin-top: 15px;

  h5 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 7px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    color: #4fd1ff;
  }

  h5::before {
    content: '';
    width: 3px;
    height: 10px;
    background: #4fd1ff;
    border-radius: 1px;
  }

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.8;
    text-align: justify;
    color: #b6d3e1;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 6px;
    font-size: 12px;
    line-height: 1.95;
    color: #b6d3e1;
  }

  li::before {
    content: '▸';
    font-size: 10px;
    line-height: 2.3;
    color: #4fd1ff;
  }
}

.pd-foot {
  margin-top: 16px;
  padding-top: 10px;
  font-size: 10px;
  color: #5f8093;
  border-top: 1px dashed rgba(79, 209, 255, 0.18);
}

/* 景点点位卡：名次徽标 + 缩略图 + 名称 + 评级/评分/票价
   注意：这些 DOM 是 JS 动态创建后塞进 CSS3D 图层的，没有组件的 data-v 属性，
   所以样式必须放在文件末尾那个非 scoped 的样式块里，否则一条都不生效 */
</style>

<style>
.poi-card {
  --poi: #35d0ff;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px 4px 4px;
  width: max-content;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(8, 30, 46, 0.94), rgba(4, 14, 24, 0.86));
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  /* CSS3D 会给元素内联 pointer-events:auto，卡片要能点，这里就保持可点 */
  pointer-events: auto !important;
  white-space: nowrap;
  transition: box-shadow 0.18s ease;
}

/* 内联 transform 是 CSS3D 每帧写的，别在这儿动 transform，动不动 */
.poi-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

/* 名次：彩色徽标块，底色由该点主色渐到深，白字才压得住高亮色 */
.poi-rank {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: linear-gradient(140deg, var(--poi) 0%, rgba(2, 8, 14, 0.85) 135%);
  box-shadow: 0 0 10px -2px var(--poi), inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.poi-rank b {
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}

.poi-thumb {
  position: relative;
  flex: none;
  width: 34px;
  height: 24px;
  overflow: hidden;
  border-radius: 4px;
  background: #0a1a26;
}

.poi-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poi-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.poi-name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #fff;
}

.poi-meta {
  font-size: 9px;
  letter-spacing: 0.2px;
  color: var(--poi);
  opacity: 0.92;
}

/* 地铁站点标签：所有站统一做成小卡片（深色半透明底 + 细亮边），换乘站多一枚 ⇄ */
.metro-tip {
  display: flex;
  align-items: center;
  height: 15px;
  padding: 0 5px;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.4px;
  white-space: nowrap;
  pointer-events: none;
  color: rgba(232, 249, 255, 0.96);
  background: rgba(4, 18, 30, 0.74);
  border: 1px solid rgba(120, 230, 255, 0.34);
  border-radius: 3px;
  box-shadow: 0 0 6px -4px rgba(0, 0, 0, 0.9);
}

/* 换乘站：⇄ 图标 + 站名，横向自适应宽度，等宽字号 */
.metro-hub {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 15px;
  padding: 0 4px 0 3px;
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
  color: #eaf9ff;
  background: rgba(4, 18, 30, 0.9);
  border: 1px solid rgba(120, 230, 255, 0.9);
  border-radius: 3px;
  box-shadow: 0 0 9px -3px rgba(120, 230, 255, 0.95);
  pointer-events: auto !important;
}

.metro-hub i {
  font-style: normal;
  letter-spacing: 0;
  color: #7fe3ff;
}

.metro-hub span {
  letter-spacing: 0.4px;
}

/* 卫星主题：底图是浅色实景，白字白框会被吃掉，统一翻成深字浅底 */
body.cm-sat .metro-tip {
  color: #05303f;
  background: rgba(240, 251, 255, 0.86);
  border-color: rgba(8, 56, 76, 0.42);
}

body.cm-sat .metro-hub {
  color: #05303f;
  background: rgba(240, 251, 255, 0.94);
  border-color: rgba(8, 56, 76, 0.75);
  box-shadow: 0 0 8px -3px rgba(8, 56, 76, 0.85);
}

body.cm-sat .metro-hub i {
  color: #0b6b8e;
}
</style>
