<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import TWEEN from '@tweenjs/tween.js'
import SceneView from '@/components/SceneView/index.js'
import chinaGeo from './china.json'
import {
  baseVertexShader,
  effect35Frag,
  boundaryFrag,
  moonVertexShader,
  moonFrag,
  flyLineVertexShader,
  flyLineSweepFrag,
  glowVertexShader,
  glowFrag,
  rimFrag,
  sweepShellVertexShader,
  sweepShellFrag,
} from './shaders.js'

const container = ref(null)

let sceneView = null
let scene = null
let camera = null
let map = null
let earthGlow = null
let clouds = null

// ==================== 场景科技色调主题 ====================
// 每套主题派生：primary 主色（边线/光柱/rim/卫星次点）、secondary 卫星次色、
// hi 亮核高亮色、glow 大气壳色；inLine 进站（海外→深圳货站）冷色、outLine 出站（深圳货站→国内）色
const THEMES = [
  { key: 'cyan-green', name: '冰青绿', primary: 0x00ffc8, secondary: 0x2effa8, hi: 0xaaffee, glow: 0x00a884, line: 0x35ffb0, inLine: 0x3fd8ff, outLine: 0x35ffb0 },
  { key: 'cyan-blue', name: '冰青蓝', primary: 0x3fd8ff, secondary: 0x2ba7ff, hi: 0xb3ecff, glow: 0x12779e, line: 0x57c8ff, inLine: 0x9db8ff, outLine: 0x57c8ff },
  { key: 'purple', name: '科技紫', primary: 0xb06bff, secondary: 0x7a5cff, hi: 0xe6d2ff, glow: 0x5a2d8f, line: 0xc78bff, inLine: 0x7a5cff, outLine: 0xc78bff },
  { key: 'amber', name: '琥珀橙', primary: 0xffb02e, secondary: 0xff7a3c, hi: 0xffe9b3, glow: 0x8f5a12, line: 0xffc45e, inLine: 0x57c8ff, outLine: 0xffc45e },
]
const themeIndex = ref(0)

// 待换色的材质引用集合
let boundaryMats = []
let inboundMats = []
let outboundMats = []
let beamMats = []
let spreadMats = []
let cityNodes = []
let moonMat = null
let rimMat = null
let glowMat = null
let sweepMat = null

// 按主题批量刷新场景配色
const applyTheme = (theme) => {
  const toColor = (v) => new THREE.Color(v)
  boundaryMats.forEach((m) => {
    m.uniforms.lineColor.value = toColor(theme.primary)
    m.uniforms.hiColor.value = toColor(theme.hi)
  })
  inboundMats.forEach((m) => {
    m.uniforms.lineColor.value = toColor(theme.inLine)
    m.uniforms.hiColor.value = toColor(0xffffff)
  })
  outboundMats.forEach((m) => {
    m.uniforms.lineColor.value = toColor(theme.outLine)
    m.uniforms.hiColor.value = toColor(0xffffff)
  })
  beamMats.forEach((m) => m.color.set(theme.primary))
  spreadMats.forEach((m) => m.uniforms.color.value = toColor(theme.primary))
  if (moonMat) {
    moonMat.uniforms.color.value = toColor(theme.secondary)
    moonMat.uniforms.color1.value = toColor(theme.primary)
  }
  if (rimMat) rimMat.uniforms.rimColor.value = toColor(theme.primary)
  if (glowMat) glowMat.uniforms.glowColor.value = toColor(theme.glow)
  if (sweepMat) sweepMat.uniforms.sweepColor.value = toColor(theme.primary)
}

const switchTheme = (index) => {
  themeIndex.value = index
  applyTheme(THEMES[index])
}

// ==================== 城市点位数据 ====================
// type: hub 枢纽货站 / in 进站货源地（海外→深圳货站） / out 出站目的地（深圳货站→国内）
const cities = [
  { name: '深圳货站', type: 'hub', note: '跨境物流国内中转枢纽：承接海外入境货物，分拣清关后分拨发往国内各中心城市。', lon: 114.06, lat: 22.55, rotate: -Math.PI, size: 2.4, color: 0xffee00 },
  { name: '北京', type: 'out', note: '北京（Beijing），简称“京”，古称燕京、北平，是中华人民共和国的首都、直辖市、国家中心城市、超大城市，国务院批复确定的中国政治中心、文化中心、国际交往中心、科技创新中心。', lon: 116.3, lat: 39.9, rotate: -Math.PI },
  { name: '长沙', type: 'out', note: '长沙，别称星城，湖南省辖地级市、省会、特大城市，国务院批复确定的长江中游地区重要的中心城市、长株潭城市群中心城市。', lon: 112.58, lat: 28.12, rotate: -Math.PI },
  { name: '上海', type: 'out', note: '上海，简称“沪”或“申”，是中华人民共和国省级行政区、直辖市、国家中心城市、超大城市、上海大都市圈核心城市，国务院批复确定的中国国际经济、金融、贸易、航运、科技创新中心。', lon: 120.52, lat: 30.4, rotate: -Math.PI },
  { name: '重庆', type: 'out', note: '重庆，简称“渝”，别称山城，是中华人民共和国省级行政区、直辖市、国家中心城市、超大城市，国务院批复确定的国家重要的中心城市之一、长江上游地区经济中心、国家重要先进制造业中心、西部金融中心、西部国际综合交通枢纽和国际门户枢纽。', lon: 106.55, lat: 29.57, rotate: -Math.PI },
  { name: '武汉', type: 'out', note: '武汉，简称“汉”，别称江城，是湖北省省会，中部六省唯一的副省级市，特大城市，中国中部地区的中心城市，全国重要的工业基地、科教基地和综合交通枢纽，联勤保障部队机关驻地。', lon: 114.17, lat: 30.35, rotate: -Math.PI },
  { name: '莫斯科', type: 'in', note: '莫斯科（俄语：Москва；英语：Moscow），是俄罗斯联邦首都、莫斯科州首府。莫斯科是俄罗斯的政治、经济、文化、金融、交通中心以及最大的综合性城市，是一座国际化大都市。', lon: 37.35, lat: 55.45, rotate: -Math.PI },
  { name: '纽约', type: 'in', note: '纽约市（New York City，简称：NYC），位于美国纽约州东南部大西洋沿岸，是美国第一大城市及第一大港口，纽约都市圈为世界上最大的都市圈之一，与英国伦敦、中国香港并称为“纽伦港”（Nylonkong）。', lon: -73.86, lat: 40.85, rotate: Math.PI },
  { name: '东京', type: 'in', note: '东京（日文：東京；英语：Tokyo），日本首都，位于日本关东平原中部，是面向东京湾的国际大都市，日本三大都市圈之一东京都市圈的中心城市。', lon: 139.69, lat: 35.69, rotate: -Math.PI },
  { name: '伦敦', type: 'in', note: '伦敦，是大不列颠及北爱尔兰联合王国首都，世界金融中心，伦敦占全球外汇交易额的比重超过40%，与纽约和香港并称为“纽伦港”。', lon: 0.15, lat: 51.3, rotate: -Math.PI },
  { name: '巴基斯坦', type: 'in', note: '巴基斯坦伊斯兰共和国（乌尔都语：اسلامی جمہوریہ پاکستان，英语：Islamic Republic of Pakistan），简称“巴基斯坦”，意为“圣洁的土地”、“清真之国”，95%以上的居民信奉伊斯兰教，是一个多民族伊斯兰国家。国语为乌尔都语。', lon: 73.09, lat: 31.25, rotate: -Math.PI },
  { name: '新加坡', type: 'in', note: '新加坡共和国（英语：Republic of Singapore），简称新加坡，旧称新嘉坡、星洲或星岛，别称为狮城，是东南亚的一个岛国，政治体制实行议会共和制，首都为新加坡市。', lon: 103.49, lat: 1.21, rotate: -Math.PI },
  { name: '埃及', type: 'in', note: '阿拉伯埃及共和国（阿拉伯语：جمهوريّة مصرالعربيّة），简称“埃及”。位于非洲东北部，地处欧亚非三大洲的交通要冲，是大西洋与印度洋之间海上航线的捷径。', lon: 29.66, lat: 26.8, rotate: -Math.PI },
  { name: '意大利', type: 'in', note: '意大利共和国（意大利语：Repubblica Italiana；英语：The Republic of Italy），简称意大利（意大利语：Italia；英语：Italy），是一个欧洲国家，主要由南欧的亚平宁半岛及两个位于地中海中的岛屿西西里岛与撒丁岛所组成。国土面积为301333平方公里，人口6024万。', lon: 12.44, lat: 43.93, rotate: -Math.PI },
  { name: '澳大利亚', type: 'in', note: '澳大利亚联邦（英语：Commonwealth of Australia），简称“澳大利亚”，其领土面积769.2万平方公里，位于南太平洋和印度洋之间，四面环海，是世界上唯一国土覆盖一整个大陆的国家，因此也称“澳洲”。', lon: 133.28, lat: -25.16, rotate: -Math.PI },
  { name: '加拿大', type: 'in', note: '加拿大（英语/法语：Canada），位于北美洲北部。东临大西洋，西濒太平洋，西北部邻美国阿拉斯加州，南接美国本土，北靠北冰洋。', lon: -106.22, lat: 56.12, rotate: -Math.PI },
]

// ==================== 贴图地址 ====================
const TEX = {
  day: '/3d/earth/earth-day.jpg',
  clouds: '/3d/earth/clouds.jpg',
  lightray: '/3d/earth/lightray.jpg',
}

// ==================== 球面经纬度换算 ====================
const lgltToxyz = (lng, lat, radius) => {
  const theta = (90 + lng) * (Math.PI / 180)
  const phi = (90 - lat) * (Math.PI / 180)
  return new THREE.Vector3(100, 220, 20).setFromSpherical(new THREE.Spherical(radius, phi, theta))
}

// 城市飞线贝塞尔辅助
const getVCenter = (v1, v2) => v1.add(v2).divideScalar(2)
const getLenVcetor = (v1, v2, len) => {
  const length = v1.distanceTo(v2)
  return v1.lerp(v2, len / length)
}

// ==================== 边界轮廓管 ====================
// 从 GeoJSON 面几何（Polygon / MultiPolygon）提取外环折线，跳过内环孔洞
const extractBoundaryRings = (features) => {
  const rings = []
  features.forEach((f) => {
    const g = f.geometry
    if (!g) return
    if (g.type === 'MultiPolygon') {
      g.coordinates.forEach((poly) => rings.push(poly[0]))
    } else if (g.type === 'Polygon') {
      rings.push(g.coordinates[0])
    }
  })
  return rings
}

const buildBoundary = () => {
  const rings = extractBoundaryRings(chinaGeo.features)
  rings.forEach((ring, index) => {
    const position = []
    ring.forEach((location) => {
      const p = lgltToxyz(location[0], location[1], 30.5)
      position.push(new THREE.Vector3(p.x, p.y, p.z))
    })
    if (position.length < 3) return
    // 与飞线同款：THREE.Path 描述轨迹 → 采样点 → BufferGeometry
    const path = new THREE.Path()
    path.setFromPoints(position)
    const sampleCount = Math.min(256, position.length)
    const pathPoints = path.getPoints(sampleCount)
    // Path 只保留 x/y，z 按比例从原始球面采样点补回，保持 3D 轨迹
    const points = pathPoints.map((p, i) => {
      const src = position[Math.min(Math.round((i / Math.max(1, pathPoints.length - 1)) * (position.length - 1)), position.length - 1)]
      return new THREE.Vector3(p.x, p.y, src.z)
    })
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    // 路径进度 UV（0~1），供流光片元取巡游进度
    const uv = new Float32Array(points.length)
    for (let j = 0; j < points.length; j++) uv[j] = j / (points.length - 1)
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: {
        lineColor: { value: new THREE.Color(0x00ffc8) },
        hiColor: { value: new THREE.Color(0xaaffee) },
        iTime: { value: 0 },
        uSpeed: { value: 0.18 },
        uPhase: { value: index / Math.max(1, rings.length) },
        uCount: { value: 2 },
        uTail: { value: 0.52 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexShader: baseVertexShader,
      fragmentShader: boundaryFrag,
    })
    boundaryMats.push(material)
    map.add(new THREE.Line(geometry, material))
  })
}

// ==================== 地球双球 + 大气辉光 ====================
const buildEarth = () => {
  // 云层球
  const cloudsGeo = new THREE.SphereGeometry(30.2, 64, 64)
  const cloudsMat = new THREE.MeshPhongMaterial({
    color: 0xdfffee,
    transparent: true,
    depthWrite: true,
    alphaMap: new THREE.TextureLoader().load(TEX.clouds),
  })
  clouds = new THREE.Mesh(cloudsGeo, cloudsMat)
  map.add(clouds)

  // 地表球
  const dayGeo = new THREE.SphereGeometry(30, 64, 64)
  const dayMat = new THREE.MeshPhongMaterial({
    map: new THREE.TextureLoader().load(TEX.day),
    color: 0xb8e6d2,
    emissive: new THREE.Color(0x06281f),
  })
  const earth2 = new THREE.Mesh(dayGeo, dayMat)
  map.add(earth2)
  map.rotation.set(0.3, Math.PI / 1.15, 0.1)

  // 球体正面菲涅尔 rim 边缘光（中心透明、轮廓提亮，跟随地球自转）
  const rimMaterial = new THREE.ShaderMaterial({
    uniforms: {
      rimColor: { value: new THREE.Color(0x00ffc8) },
      uPower: { value: 2.6 },
      uOpacity: { value: 0.28 },
    },
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexShader: glowVertexShader,
    fragmentShader: rimFrag,
  })
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(30.35, 64, 64), rimMaterial)
  rimMesh.renderOrder = 10
  map.add(rimMesh)
  rimMat = rimMaterial

  // 外层光波罩：一道光带沿纬度从下往上循环扫过，带余辉拖尾
  const sweepMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sweepColor: { value: new THREE.Color(0x00ffc8) },
      iTime: { value: 0 },
      uSpeed: { value: 0.16 },
      uBandWidth: { value: 0.045 },
      uTrailDecay: { value: 7.0 },
      uOpacity: { value: 0.55 },
    },
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexShader: sweepShellVertexShader,
    fragmentShader: sweepShellFrag,
  })
  const sweepMesh = new THREE.Mesh(new THREE.SphereGeometry(32.0, 64, 64), sweepMaterial)
  sweepMesh.renderOrder = 11
  map.add(sweepMesh)
  sweepMat = sweepMaterial

  // 大气辉光壳（世界空间 Fresnel 边缘发光）
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      c: { type: 'f', value: 0.15 },
      p: { type: 'f', value: 2.4 },
      glowColor: { type: 'c', value: new THREE.Color(0x00a884) },
      uIntensity: { type: 'f', value: 1.0 },
      uOpacity: { type: 'f', value: 0.6 },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexShader: glowVertexShader,
    fragmentShader: glowFrag,
  })
  glowMat = glowMaterial
  earthGlow = new THREE.Mesh(dayGeo.clone(), glowMaterial)
  earthGlow.position.set(map.position.x, map.position.y, map.position.z)
  earthGlow.scale.multiplyScalar(1.48)
  scene.add(earthGlow)
}

// ==================== 卫星轨迹流光环 ====================
// 地球半径 30；MEO 中轨高度取 21528 km（北斗 MEO），轨道半径约为地球半径的 4.375 倍，轨道环半径 ≈ 131.3
const EARTH_RADIUS = 30
const MEO_ALTITUDE_KM = 21528
const MEO_RATIO = (6378 + MEO_ALTITUDE_KM) / 6378
const createMoon = () => {
  const orbitRadius = EARTH_RADIUS * MEO_RATIO
  const curve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, 2 * Math.PI)
  const points = curve.getPoints(2000)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const index = []
  for (let i = 0; i < points.length; i++) index.push(i)
  geometry.setAttribute('index', new THREE.Float32BufferAttribute(index, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      color: { value: new THREE.Color(0x2effa8) },
      color1: { value: new THREE.Color(0x00ffc8) },
    },
    side: 2,
    transparent: false,
    vertexShader: moonVertexShader,
    fragmentShader: moonFrag,
  })
  moonMat = material
  const mesh = new THREE.Points(geometry, material)
  mesh.rotateX(Math.PI / 2)
  map.add(mesh)
}

// ==================== 光柱扩散片 ====================
const createPlane = (size = 1.2, color = 0x00ffc8) => {
  const geometry = new THREE.CircleGeometry(size, 16)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      color: { value: new THREE.Color(color) },
    },
    side: 2,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: baseVertexShader,
    fragmentShader: effect35Frag,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = 2.8
  mesh.rotateX(Math.PI / 2)
  return mesh
}

// ==================== 航班信息面板 ====================
// dir: in 进站（海外→深圳货站）/ out 出站（深圳货站→国内）
const FLIGHTS = [
  { no: 'RU-2041', from: '莫斯科', to: '深圳货站', depart: '08:20', arrive: '22:15', dir: 'in' },
  { no: 'UA-867', from: '纽约', to: '深圳货站', depart: '09:05', arrive: '11:40(+1)', dir: 'in' },
  { no: 'NH-913', from: '东京', to: '深圳货站', depart: '10:40', arrive: '14:05', dir: 'in' },
  { no: 'BA-356', from: '伦敦', to: '深圳货站', depart: '11:15', arrive: '06:20(+1)', dir: 'in' },
  { no: 'PK-788', from: '巴基斯坦', to: '深圳货站', depart: '12:30', arrive: '18:50', dir: 'in' },
  { no: 'SQ-845', from: '新加坡', to: '深圳货站', depart: '13:20', arrive: '17:10', dir: 'in' },
  { no: 'MS-921', from: '埃及', to: '深圳货站', depart: '14:05', arrive: '23:30', dir: 'in' },
  { no: 'AZ-684', from: '意大利', to: '深圳货站', depart: '15:40', arrive: '09:10(+1)', dir: 'in' },
  { no: 'QF-79', from: '澳大利亚', to: '深圳货站', depart: '16:10', arrive: '00:35(+1)', dir: 'in' },
  { no: 'AC-562', from: '加拿大', to: '深圳货站', depart: '17:25', arrive: '13:50(+1)', dir: 'in' },
  { no: 'CZ-301', from: '深圳货站', to: '北京', depart: '09:10', arrive: '11:25', dir: 'out' },
  { no: 'CZ-308', from: '深圳货站', to: '长沙', depart: '10:30', arrive: '12:05', dir: 'out' },
  { no: 'MU-512', from: '深圳货站', to: '上海', depart: '11:40', arrive: '13:50', dir: 'out' },
  { no: 'CZ-315', from: '深圳货站', to: '重庆', depart: '13:15', arrive: '15:00', dir: 'out' },
  { no: 'MU-520', from: '深圳货站', to: '武汉', depart: '14:50', arrive: '16:35', dir: 'out' },
]

const panelVisible = ref(false)
const panelCity = ref(null)
const panelMode = ref('in')

const panelFlights = computed(() => {
  const c = panelCity.value
  if (!c) return []
  if (c.type === 'hub') return FLIGHTS.filter((f) => f.dir === panelMode.value)
  if (c.type === 'in') return FLIGHTS.filter((f) => f.dir === 'in' && f.from === c.name)
  return FLIGHTS.filter((f) => f.dir === 'out' && f.to === c.name)
})

const openPanel = (item) => {
  panelCity.value = item
  panelMode.value = item.type === 'out' ? 'out' : 'in'
  panelVisible.value = true
}

const switchPanelMode = (m) => { panelMode.value = m }

// ==================== 城市光柱 + 标签 + 飞线 ====================
const buildCities = () => {
  const hub = cities.find((c) => c.type === 'hub')
  const hubPos = lgltToxyz(hub.lon, hub.lat, 30.1)

  cities.forEach((item, index) => {
    // 城市标签（CSS3DObject）
    const el = document.createElement('div')
    el.className = 'city'
    el.innerText = item.name
    const css3Text = sceneView.createText({ element: el, type: '3d' })
    const labelPos = lgltToxyz(item.lon, item.lat, 30.1)
    css3Text.scale.set(0.03, 0.03, 0.03)
    css3Text.visible = false
    css3Text.position.set(labelPos.x, labelPos.y, labelPos.z)
    const coordVec3 = new THREE.Vector3(labelPos.x, labelPos.y, labelPos.z).normalize()
    const meshNormal = new THREE.Vector3(0, 0, 1)
    css3Text.quaternion.setFromUnitVectors(meshNormal, coordVec3)
    css3Text.lookAt(0, 0, 0)
    css3Text.rotateY(item.rotate)
    map.add(css3Text)

    // 光柱分组
    const group = new THREE.Group()
    const beamGeo = new THREE.PlaneGeometry(1, 6, 32, 32)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffc8,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      alphaMap: new THREE.TextureLoader().load(TEX.lightray),
    })
    beamMats.push(beamMat)
    const mesh = new THREE.Mesh(beamGeo, beamMat)
    const mesh1 = mesh.clone()
    mesh1.rotateY(Math.PI / 2)
    // 入场前先压扁隐藏，待飞入结束后错峰升起
    mesh.visible = false
    mesh.scale.set(1, 0, 1)
    mesh1.visible = false
    mesh1.scale.set(1, 0, 1)
    const mesh2 = createPlane(item.size, item.color)
    mesh2.visible = false
    if (!item.color) spreadMats.push(mesh2.material)
    group.add(mesh, mesh1, mesh2)
    cityNodes.push({ beam: [mesh, mesh1], plane: mesh2, label: css3Text })
    // 透明命中代理：光柱本体较细，放大可拾取范围，不参与渲染
    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false })
    )
    group.add(hitProxy)

    const pos = lgltToxyz(item.lon, item.lat, 33)
    group.position.set(pos.x, pos.y, pos.z)
    const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize()
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), normal)
    map.add(group)

    // hover 变色
    group.on('hover', () => {
      group.children.forEach((child) => {
        if (child.material.uniforms) child.material.uniforms.color.value = new THREE.Color(THEMES[themeIndex.value].hi)
        else child.material.color.set(THEMES[themeIndex.value].hi)
      })
    }, () => {
      group.children.forEach((child) => {
        if (child.material.uniforms) child.material.uniforms.color.value = new THREE.Color(THEMES[themeIndex.value].primary)
        else child.material.color.set(THEMES[themeIndex.value].primary)
      })
    })

    // click 弹出航班信息面板
    group.on('click', () => {
      openPanel(item)
    })

    // 物流链飞线：in 海外货源地 → 深圳货站（进站）；out 深圳货站 → 国内目的地（出站）
    if (item.type === 'in') {
      const { curve } = addLines(labelPos.clone(), hubPos.clone())
      flyLine(curve, 'in')
    } else if (item.type === 'out') {
      const { curve } = addLines(hubPos.clone(), labelPos.clone())
      flyLine(curve, 'out')
    }
  })
}

// 入场飞入结束后：光柱逐根错峰从地面升起，升起完成再亮出扩散片与标签
const RISE_DURATION = 600
const revealCities = () => {
  cityNodes.forEach((node, i) => {
    const delay = i * 90
    node.beam.forEach((b) => { b.visible = true; b.scale.set(1, 0, 1) })
    // 两根交叉光柱同步沿高度方向长起
    node.beam.forEach((b) => {
      new TWEEN.Tween(b.scale, true)
        .to({ y: 1 }, RISE_DURATION)
        .easing(TWEEN.Easing.Quintic.Out)
        .delay(delay)
        .start()
    })
    // 升起结束后亮出底部扩散片，标签由小放大渐显
    new TWEEN.Tween({ v: 0 }, true)
      .to({ v: 1 }, RISE_DURATION)
      .easing(TWEEN.Easing.Quintic.Out)
      .delay(delay)
      .onComplete(() => {
        node.plane.visible = true
        node.label.visible = true
        node.label.scale.set(0.015, 0.015, 0.015)
        new TWEEN.Tween(node.label.scale, true)
          .to({ x: 0.03, y: 0.03, z: 0.03 }, 300)
          .easing(TWEEN.Easing.Quintic.Out)
          .start()
      })
      .start()
  })

  // 物流飞线在点位升起后整体淡入
  const lineState = { o: 0 }
  new TWEEN.Tween(lineState, true)
    .to({ o: 1 }, 800)
    .easing(TWEEN.Easing.Quintic.Out)
    .delay(200)
    .onUpdate(() => {
      ;[...inboundMats, ...outboundMats].forEach((m) => {
        m.uniforms.uOpacity.value = lineState.o
      })
    })
    .start()
}

// 贝塞尔曲线
const addLines = (v0, v3) => {
  const angle = (v0.angleTo(v3) * 1.8) / Math.PI / 0.1
  const aLen = angle * 2.0
  const hLen = angle * angle * 100
  const p0 = new THREE.Vector3(0, 0, 0)
  const rayLine = new THREE.Ray(p0, getVCenter(v0.clone(), v3.clone()))
  const target = new THREE.Vector3(0, 0, 0)
  rayLine.at(1, target)
  rayLine.at(hLen / target.distanceTo(p0), target)

  const v1 = getLenVcetor(v0.clone(), target, aLen)
  const v2 = getLenVcetor(v3.clone(), target, aLen)

  const curve = new THREE.CubicBezierCurve3(v0, v1, v2, v3)
  return { curve }
}

// 路径飞线：type 为 'in' 进站（海外→深圳货站）/ 'out' 出站（深圳货站→国内）
const flyLine = (curve, type = 'out') => {
  const currentTheme = THEMES[themeIndex.value]
  const baseColor = type === 'in' ? currentTheme.inLine : currentTheme.outLine
  const bezierPoints = curve.getPoints(120)
  // 用 THREE.Path 描述飞行轨迹
  const path = new THREE.Path()
  path.setFromPoints(bezierPoints)
  const pathPoints = path.getPoints(120)
  // Path 只保留 x/y，z 按序从原曲线采样点补回，保持球面 3D 轨迹
  const points = pathPoints.map((p, i) => new THREE.Vector3(p.x, p.y, bezierPoints[Math.min(i, bezierPoints.length - 1)].z))
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  // 路径进度 UV（0~1），供流光片元取巡游进度
  const uv = new Float32Array(points.length)
  for (let j = 0; j < points.length; j++) uv[j] = j / (points.length - 1)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      lineColor: { value: new THREE.Color(baseColor) },
      hiColor: { value: new THREE.Color(0xffffff) },
      uSpeed: { value: 0.25 },
      uOpacity: { value: 0 },
      uTail: { value: 0.55 },
      uReverse: { value: -1.0 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexShader: flyLineVertexShader,
    fragmentShader: flyLineSweepFrag,
  })
  if (type === 'in') inboundMats.push(material)
  else outboundMats.push(material)
  map.add(new THREE.Line(geometry, material))
}

// ==================== 帧循环 ====================
let elapsed = 0
const onFrame = (delta) => {
  if (!sceneView) return
  elapsed += delta || 0.016
  scene.traverse((child) => {
    if (child.material && child.material.uniforms) {
      try { child.material.uniforms.iTime.value = elapsed } catch (e) { /* 忽略无 iTime 材质 */ }
    }
  })
}

onMounted(async () => {
  sceneView = new SceneView(container.value, {
    mode: '',
    bgColor: 0x020807,
    environment: false,
    shadowMapEnabled: false,
    floor: { enabled: false },
    floorReflection: { enabled: false },
    fog: { enabled: false },
    hemiLight: { enabled: false },
    ambLight: { enabled: true, color: 0x484848, intensity: 0.5 },
    dirLight: { enabled: true, color: 0xffffff, intensity: 0.5, position: { x: 0, y: 60, z: 100 }, castShadow: false },
    control: {
      enabled: true,
      enableDamping: true,
      dampingFactor: 0.3,
      enableRotate: true,
      enableZoom: true,
      enablePan: false,
      autoRotate: false,
      autoRotateSpeed: -0.2,
      minPolarAngle: 0,
      minDistance: 32,
      maxDistance: 180,
      maxPolarAngle: Math.PI,
    },
    postProcessing: {
      enabled: true,
      bloom: { enabled: true, strength: 0.25, radius: 0.2, threshold: 0.5 },
      gtao: { enabled: false },
      vignette: { enabled: true },
    },
  })

  scene = sceneView.scene
  camera = sceneView.camera

  // MapControls 默认左键平移、右键旋转；这里改为左键旋转（中键缩放、右键平移）
  if (sceneView.controls) {
    sceneView.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
  }

  map = new THREE.Group()
  scene.add(map)

  buildEarth()
  buildBoundary()
  createMoon()
  buildCities()
  applyTheme(THEMES[themeIndex.value])

  // 开场飞入：相机对准深圳货站所在球面方向，注视球心
  const hub = cities.find((c) => c.type === 'hub')
  const szLocal = lgltToxyz(hub.lon, hub.lat, 30.1)
  map.updateMatrixWorld(true)
  const szDir = map.localToWorld(szLocal.clone()).normalize()
  const camEnd = { x: szDir.x * 75, y: szDir.y * 75, z: szDir.z * 75 }
  camera.position.set(0, 320, 300)

  sceneView.animateCallback = onFrame
  sceneView.start()

  // 入场飞入结束后，点位光柱错峰升起、标签渐显
  await sceneView.flyTo(camera.position, camEnd, 2500)
  revealCities()
})

onUnmounted(() => {
  if (sceneView) {
    sceneView.clear()
    sceneView = null
  }
  scene = null
  camera = null
  map = null
  earthGlow = null
  clouds = null
  boundaryMats = []
  inboundMats = []
  outboundMats = []
  beamMats = []
  spreadMats = []
  cityNodes = []
  moonMat = null
  rimMat = null
  glowMat = null
  sweepMat = null
})
</script>

<template>
  <div class="earth-home">
    <div ref="container" class="earth-view"></div>

    <div v-if="panelVisible && panelCity" class="flight-panel">
      <div class="fp-header">
        <span class="fp-title">{{ panelCity.name }}</span>
        <button class="fp-close" @click="panelVisible = false">×</button>
      </div>

      <div v-if="panelCity.type === 'hub'" class="fp-tabs">
        <button
          class="fp-tab"
          :class="{ active: panelMode === 'in' }"
          @click="switchPanelMode('in')"
        >进站</button>
        <button
          class="fp-tab"
          :class="{ active: panelMode === 'out' }"
          @click="switchPanelMode('out')"
        >出站</button>
      </div>

      <table class="fp-table">
        <thead>
          <tr>
            <th>航班号</th>
            <th>出发站</th>
            <th>目的站</th>
            <th>起飞</th>
            <th>抵达</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in panelFlights" :key="f.no">
            <td>{{ f.no }}</td>
            <td>{{ f.from }}</td>
            <td>{{ f.to }}</td>
            <td>{{ f.depart }}</td>
            <td>{{ f.arrive }}</td>
          </tr>
          <tr v-if="panelFlights.length === 0">
            <td colspan="5" class="fp-empty">暂无航班</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="theme-panel">
      <button
        v-for="(t, i) in THEMES"
        :key="t.key"
        class="theme-dot"
        :class="{ active: i === themeIndex }"
        :style="{ backgroundColor: '#' + t.primary.toString(16).padStart(6, '0') }"
        :title="t.name"
        @click="switchTheme(i)"
      ></button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.earth-home {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .earth-view {
    width: 100%;
    height: 100%;
  }

  .flight-panel {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 20;
    width: 300px;
    background: rgba(2, 16, 13, 0.72);
    border: 1px solid rgba(0, 255, 200, 0.28);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    color: #fff;
    overflow: hidden;

    .fp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(0, 255, 200, 0.18);
    }

    .fp-title { font-size: 15px; font-weight: 600; }

    .fp-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.7;
      line-height: 1;
    }
    .fp-close:hover { opacity: 1; }

    .fp-tabs {
      display: flex;
      gap: 8px;
      padding: 10px 14px 0;
    }

    .fp-tab {
      padding: 4px 14px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid rgba(0, 255, 200, 0.3);
      background: transparent;
      color: #aaffee;
      font-size: 12px;
    }
    .fp-tab.active {
      background: rgba(0, 255, 200, 0.18);
      color: #fff;
      border-color: #00ffc8;
    }

    .fp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 10px;
    }
    .fp-table th,
    .fp-table td {
      padding: 7px 10px;
      text-align: left;
    }
    .fp-table th {
      color: #aaffee;
      opacity: 0.8;
      font-weight: 500;
    }
    .fp-table tbody tr {
      border-top: 1px solid rgba(0, 255, 200, 0.12);
    }
    .fp-empty {
      text-align: center;
      opacity: 0.6;
    }
  }

  .theme-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(2, 16, 13, 0.55);
    border: 1px solid rgba(0, 255, 200, 0.25);
    border-radius: 10px;
    backdrop-filter: blur(6px);
  }

  .theme-dot {
    width: 16px;
    height: 16px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.35);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      transform: scale(1.15);
    }

    &.active {
      transform: scale(1.2);
      box-shadow: 0 0 10px currentColor;
    }
  }
}
</style>

<style lang="scss">
.city {
  padding: 0 5px;
  line-height: 16px;
  font-size: 12px;
  color: #fff;
}
</style>
