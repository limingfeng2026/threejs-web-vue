<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import SceneView from '@/components/SceneView/index.js'
import * as THREE from 'three'
import TWEEN from '@tweenjs/tween.js'
import { FresnelMaterial } from '@/components/SceneView/utils/FresnelMaterial.js'
import appService from './api.js'
import { vertexShader, bgPlane, pointSpread, borderLineVertex, borderSweep, beamColumn } from './effect.js'

// ============ 场景资源路径 ============
const RES = {
  techBgTex: '/3d/source/tietu/Tech_021.png',
  diffuseTex: '/3d/source/tietu/manshe_h.png',
  bumpTex: '/3d/source/tietu/dem.png',
  geoJson: '/3d/source/深圳市.json',
}

// 卫星底图覆盖的地理边界框（由旧 OBJ 模型外接框反推的初值，实拍后可在此微调）
const TEX_BOUNDS = {
  lngW: 113.7497,
  lngE: 114.6303,
  latS: 22.3982,
  latN: 22.8618,
}

const container = ref(null)
const noteRef = ref(null)
const loading = ref(true)
const progress = ref(0)

let sceneView = null
let scene = null
let camera = null

// 场景分组
const map = new THREE.Group()
const textGroup = new THREE.Group()
const modelGroup = new THREE.Group()

// 预加载纹理（占位对象，下载完成后原地填充），纳入加载计数
let techBgTex = null
let diffuseTex = null
let bumpTex = null
// 背景三圈材质（入场飞行完成后再扩散显现）
let bgRingMat = null

// 业务数据
let factories = null
let nodes = []
let selecteFactories = null
let infoObj = null
let infoElement = null
let elapsed = 0

const active = ref(null)
const noteShow = ref(false)
const showNodeData = ref([])

const areaText = [
  { name: '宝安区', position: { x: -43.85707054323405, y: 5, z: -3.8569488892345327 } },
  { name: '光明区', position: { x: -33.89367959864091, y: 5, z: -18.70377690382958 } },
  { name: '龙华区', position: { x: -20.791392249007615, y: 5, z: -8.04661735891984 } },
  { name: '龙岗区', position: { x: 1.4430810801444973, y: 5, z: -7.906977311650373 } },
  { name: '坪山区', position: { x: 23.008000562118, y: 5, z: -8.552855612845365 } },
  { name: '大鹏新区', position: { x: 43.02894601290143, y: 5, z: 10.854145262604652 } },
  { name: '南山区', position: { x: -34.67715635549325, y: 5, z: 15.152619970603602 } },
  { name: '福田区', position: { x: -18.4557872886727, y: 5, z: 12.436954685944727 } },
  { name: '罗湖区', position: { x: -3.820589246963976, y: 5, z: 7.662604891478809 } },
  { name: '盐田区', position: { x: 10.840856944882267, y: 5, z: 5.901830331234198 } },
]

const categoryColor = ['#00FFF6', '#FEDA33', '#2BA7FF']
// 边框：常态冷光科技蓝 / 悬停高亮冰蓝
const BORDER_COLOR = 0x8fe6ff
// 边框透明度（1.0 实心；0~1 越低越淡、半透明）
const BORDER_OPACITY =  0.25

const waterWorksType = ref([
  { lable: '水厂', alias: 'SHUICHANG', className: 'active1', value: 1, points: [] },
  { lable: '水质净化厂', alias: 'SHUIZHIJINGHUACHANG', className: 'active2', value: 2, points: [] },
  { lable: '泵站', alias: 'BENGZHAN', className: 'active3', value: 3, points: [] },
])

// 资源加载计数：geoJson + 背景贴图 + 点位接口，共 3 项
let loadedParts = 0
let targetProgress = 0
let sceneEntered = false
const TOTAL_PARTS = 3
const markPartLoaded = () => {
  loadedParts += 1
  targetProgress = Math.min(100, Math.round((loadedParts / TOTAL_PARTS) * 100))
}

// ============ 边框管线 ============
const addBorderLine = (borderLine, lineColor, opacity = 1) => {
  const path = new THREE.Path()
  path.setFromPoints(borderLine.map((p) => new THREE.Vector2(p.x, p.y)))
  const points = path.getPoints()
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      lineColor: { value: new THREE.Color(lineColor) },
      uOpacity: { value: opacity },
    },
    vertexShader: borderLineVertex,
    fragmentShader: borderSweep,
    transparent: true,
  })
  material.color = material.uniforms.lineColor.value
  material.borderOpacity = material.uniforms.uOpacity
  const line = new THREE.LineLoop(geometry, material)
  line.computeLineDistances()
  return line
}

// ============ 地块 GeoJSON ============
const loadGeoJson = async () => {
  const resp = await fetch(RES.geoJson)
  const data = await resp.json()
  const meshGroup = new THREE.Group()
  const groundShapes = []

  data.features.forEach((item) => {
    item.geometry.coordinates.forEach((ele) => {
      const shape = new THREE.Shape()
      const borderLine = []
      ele.forEach((val) => {
        val.forEach((p, i) => {
          const { x: px, y: py } = sceneView.projectPlane(p[0], p[1])
          if (i === 0) shape.moveTo(px, py)
          else shape.lineTo(px, py)
          borderLine.push(new THREE.Vector3(px, py, 0))
        })
      })
      groundShapes.push(shape)
      const curveLine = addBorderLine(borderLine, BORDER_COLOR, BORDER_OPACITY)

      if (item.geometry.coordinates.length === 4) {
        meshGroup.add(curveLine)
      } else {
        curveLine.rotateX(-Math.PI / 2)
        curveLine.position.y = 5.05
        map.add(curveLine)
      }
    })

    // 南山区四个边框组合成一个 Group
    if (item.geometry.coordinates.length === 4) {
      meshGroup.rotateX(-Math.PI / 2)
      meshGroup.position.y = 5.05
      map.add(meshGroup)
    }
  })

  // 地面轮廓平面：与边框同源投影，天然重合
  const groundGeo = new THREE.ShapeGeometry(groundShapes)
  // ShapeGeometry 默认 UV 取平面坐标原值。底图是正方形，复刻旧 OBJ 做法：
  // 地形等比例居中铺进图面（u 占图宽 90%，v 占图高约 51.8%），不拉伸铺满整图
  const gPos = groundGeo.attributes.position
  const gUv = groundGeo.attributes.uv
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i), y = gPos.getY(i)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const fit = Math.min(0.9 / (maxX - minX), 0.5183 / (maxY - minY))
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  for (let i = 0; i < gUv.count; i++) {
    gUv.setXY(
      i,
      0.5085 + (gPos.getX(i) - cx) * fit,
      0.5185 + (gPos.getY(i) - cy) * fit
    )
  }
  gUv.needsUpdate = true

  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      map: diffuseTex,
      bumpMap: bumpTex,
      bumpScale: 0.5,
      emissiveMap: diffuseTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.35,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.85,
    })
  )
  ground.rotateX(-Math.PI / 2)
  ground.position.y = 5.0
  map.add(ground)

  // 挤出侧壁：顶到地面齐平；盖子用不可见占位材质隐藏，只保留一圈侧壁
  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(groundShapes, { depth: 4.5, bevelEnabled: false }),
    [
      new THREE.MeshBasicMaterial({ visible: false }),
      new FresnelMaterial({
        fresnelScale: 0.5,
        color: 0x0b2233,
        fresnelColor: 0x3fc6ff,
        doubleSide: true,
      }),
    ]
  )
  wall.rotateX(-Math.PI / 2)
  wall.position.y = 0.5
  map.add(wall)

  scene.add(map)
  markPartLoaded()
}

// ============ 贴图预加载 ============
const loadTextures = () => {
  const loader = new THREE.TextureLoader()
  // 占位纹理对象立即返回，下载完成后原地填充 image；失败同样计数避免卡死
  techBgTex = loader.load(RES.techBgTex, () => markPartLoaded(), undefined, () => markPartLoaded())

  // 地面卫星漫反射 + 地形凹凸
  diffuseTex = loader.load(RES.diffuseTex)
  diffuseTex.colorSpace = THREE.SRGBColorSpace
  diffuseTex.wrapS = diffuseTex.wrapT = THREE.RepeatWrapping

  bumpTex = loader.load(RES.bumpTex)
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping
}

// ============ 背景平面 ============
const planeMesh = () => {
  const planeGeo = new THREE.PlaneGeometry(900, 750, 64)
  const planeMesh1 = new THREE.Mesh(
    planeGeo,
    new THREE.MeshPhongMaterial({
      map: techBgTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: techBgTex,
      emissiveIntensity: 0.4,
      transparent: true,
      blending: THREE.AdditiveBlending,
    })
  )
  planeMesh1.rotateX(-Math.PI / 2)
  planeMesh1.position.y = -0.1
  planeMesh1.position.z = -1
  map.add(planeMesh1)

  const planeGeo2 = new THREE.PlaneGeometry(150, (150 * 1080) / 1920, 64)
  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      baseColor: { value: new THREE.Color(0x3fc6ff) },
      hiColor: { value: new THREE.Color(0x00eeff) },
      iResolution: { value: new THREE.Vector2(1500, (1500 * 1080) / 1920) },
      uReveal: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader,
    fragmentShader: bgPlane,
    blending: THREE.AdditiveBlending,
  })
  bgRingMat = ringMat
  const planeMesh2 = new THREE.Mesh(planeGeo2, ringMat)
  planeMesh2.rotateX(-Math.PI / 2)
  map.add(planeMesh2)
}

// ============ 区域名标签（CSS3DObject） ============
const createAreaText = () => {
  areaText.forEach((item) => {
    const css3Text = sceneView.createText({
      element: item.name,
      className: 'city-area',
      type: '3d',
      position: item.position,
    })
    css3Text.scale.set(0, 0, 0)
    css3Text.rotateX(-Math.PI / 2)
    textGroup.add(css3Text)
  })
  scene.add(textGroup)
  // 入场飞行完成前整体隐藏，飞完再显现
  textGroup.visible = false
}

// ============ 点位分组 ============
const buildPointTemplate = () => {
  // 分组不做旋转，点位直接用世界坐标摆放（圆盘自身绕 X 平躺）
  scene.add(modelGroup)
}

// 点位共享几何：平躺圆盘
const pointGeo = new THREE.CircleGeometry(15, 64)
// 点位共享几何：竖向光柱（Group 缩放 0.1 后世界高约 4.8）；几何上移使底面落在局部 y=0，缩放围绕底面向上拉伸
const beamGeo = new THREE.CylinderGeometry(2.8, 4.2, 48, 16, 1, true)
beamGeo.translate(0, 24, 0)

// ============ 点位创建与筛选 ============
const createPointForCategory = (categoryIndex, points) => {
  points.forEach((point) => {
    const tipElement = document.createElement('div')
    tipElement.className = 'tipElement'
    tipElement.innerText = point.name
    tipElement.style.color = categoryColor[categoryIndex]

    const css2dText = sceneView.createText({
      element: tipElement,
      className: 'tipElement',
      type: '3ds',
    })
    // 标签待光柱升起完成后再渐显
    css2dText.visible = false
    css2dText.scale.set(0.8, 0.8, 0.8)
    tipElement.style.opacity = '0'
    // 标签定位到光柱顶端上方
    css2dText.position.set(0, 50, 0)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        animate: { value: false },
        color: { value: new THREE.Color(categoryColor[categoryIndex]) },
      },
      side: THREE.FrontSide,
      transparent: true,
      vertexShader,
      fragmentShader: pointSpread,
    })
    const mesh = new THREE.Mesh(pointGeo, mat)
    mesh.name = point.businessCode
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false

    // 竖向光柱体：类别色、加色混合、底部实顶部渐隐
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        color: { value: new THREE.Color(categoryColor[categoryIndex]) },
      },
      vertexShader,
      fragmentShader: beamColumn,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.name = 'beam_' + point.businessCode
    beam.position.y = 0
    beam.visible = false
    // 初始压扁，待升起动画从地面长起
    beam.scale.set(1, 0, 1)

    const newObj = new THREE.Group()
    newObj.add(mesh)
    newObj.add(beam)
    newObj.add(css2dText)
    newObj.userData = { mesh, beam, tip: css2dText }

    // 经纬度 → 场景三维坐标（墨卡托投影，世界 z 取负平面 y）
    newObj.position.copy(sceneView.projectToScene(point.mapCoord[0], point.mapCoord[1]))
    newObj.scale.set(0.1, 0.1, 0.1)
    modelGroup.add(newObj)
  })
}

// 标签渐显：透明度 0→1 + 轻微放大，避免硬切突兀
const TIP_FADE = 350
const showTip = (group) => {
  const { tip, mesh } = group.userData
  if (!tip) return
  if (mesh && !mesh.visible) return
  const dom = tip.element
  tip.visible = true
  const state = { o: 0, s: 0.8 }
  tip.scale.set(0.8, 0.8, 0.8)
  if (dom) dom.style.opacity = '0'
  new TWEEN.Tween(state, true)
    .to({ o: 1, s: 1 }, TIP_FADE)
    .easing(TWEEN.Easing.Quintic.Out)
    .onUpdate(() => {
      if (!tip.visible) return
      if (dom) dom.style.opacity = state.o.toFixed(3)
      tip.scale.set(state.s, state.s, state.s)
    })
    .onComplete(() => {
      if (dom) dom.style.opacity = '1'
      tip.scale.set(1, 1, 1)
    })
    .start()
}

// 标签隐藏：复位透明度与缩放，供下次渐显
const hideTip = (group) => {
  const { tip } = group.userData
  if (!tip) return
  tip.visible = false
  if (tip.element) tip.element.style.opacity = '0'
  tip.scale.set(0.8, 0.8, 0.8)
}

// 光柱从地面向上升起，升起完成后再亮出对应标签
const RISE_DURATION = 700
const revealBeam = (group, delay = 0) => {
  const { beam, tip, mesh } = group.userData
  if (!beam) return
  beam.visible = true
  beam.scale.set(1, 0, 1)
  hideTip(group)
  new TWEEN.Tween(beam.scale, true)
    .to({ y: 1 }, RISE_DURATION)
    .easing(TWEEN.Easing.Quintic.Out)
    .delay(delay)
    .onComplete(() => {
      // 仅点位圆盘仍可见时才渐显标签，避免带出隐藏分类
      if (mesh && mesh.visible) showTip(group)
    })
    .start()
}

const setEventOfModel = (model, value) => {
  model.on('hover', (g, m) => {
    sceneView.outlinePass.edgeStrength = 2
    sceneView.outlinePass.visibleEdgeColor.set(new THREE.Color(categoryColor[active.value - 1]))
    sceneView.setOutlineObjects(model)
  }, () => {
    sceneView.clearOutline()
  })

  model.on('click', (g, m) => {
    addTextInfo(g, g.userData.mesh || m, value)
    selecteFactories = value
  })
}

// 按点位类别生成模拟节点明细（接口缺 displayName/dataValue/dataUnit 时兜底）
const buildMockNodeData = (item) => {
  const presets = {
    1: [
      { displayName: '今日供水量', dataValue: '12.6', dataUnit: '万吨' },
      { displayName: '出厂浊度', dataValue: '0.32', dataUnit: 'NTU' },
      { displayName: '出厂余氯', dataValue: '0.68', dataUnit: 'mg/L' },
      { displayName: 'pH 值', dataValue: '7.45', dataUnit: '' },
    ],
    2: [
      { displayName: '今日处理量', dataValue: '9.8', dataUnit: '万吨' },
      { displayName: '出水 COD', dataValue: '26', dataUnit: 'mg/L' },
      { displayName: '出水氨氮', dataValue: '1.2', dataUnit: 'mg/L' },
      { displayName: '出水流量', dataValue: '320', dataUnit: 'm³/h' },
    ],
    3: [
      { displayName: '运行电流', dataValue: '86.4', dataUnit: 'A' },
      { displayName: '出口压力', dataValue: '0.32', dataUnit: 'MPa' },
      { displayName: '累计提升量', dataValue: '58.2', dataUnit: '万吨' },
      { displayName: '设备状态', dataValue: '正常', dataUnit: '' },
    ],
  }
  const list = presets[item.bizType] || presets[1]
  return list.map((d, i) => ({ id: `${item.id}-${i}`, ...d }))
}

const addTextInfo = (g, m, item) => {
  if (infoObj !== null) {
    scene.remove(infoObj)
  }
  if (item.mapSubTitle === infoElement.querySelector('.point-note-detail').innerText && noteShow.value) {
    noteShow.value = false
    // 信息框关闭：渐显恢复对应点位标签（点位圆盘仍可见时）
    if (g.userData.tip && g.userData.mesh && g.userData.mesh.visible) showTip(g)
    if (m.material.uniforms && m.material.uniforms.animate) m.material.uniforms.animate.value = false
    return
  } else {
    noteShow.value = true
    modelGroup.traverse((child) => {
      // 标签显隐：当前点位隐藏标签让位信息框；其余仅在点位圆盘可见时恢复标签
      if (child.userData && child.userData.mesh && child.userData.tip) {
        child.userData.tip.visible = (child !== g) && child.userData.mesh.visible
      }
      if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.animate) {
        try {
          child.material.uniforms.animate.value = false
        } catch (e) {}
      }
    })
    if (m.material.uniforms && m.material.uniforms.animate) m.material.uniforms.animate.value = true
  }
  // 信息框配色跟随点位所属类别色
  const noteColor = categoryColor[(item.bizType || 1) - 1] || categoryColor[0]
  infoElement.style.setProperty('--note-color', noteColor)

  const realNodes = nodes.filter((x) => x.factoryId === item.id)
  showNodeData.value = realNodes.length ? realNodes : buildMockNodeData(item)
  infoElement.querySelector('.point-note-title').innerText = item.name
  infoElement.querySelector('.point-note-detail').innerText = item.mapSubTitle || item.mapArea || ''

  infoObj = sceneView.createText({ element: infoElement, type: '2d' })
  const v3 = new THREE.Vector3()
  g.getWorldPosition(v3)
  infoObj.position.set(v3.x, v3.y + 1.5, v3.z)
  scene.add(infoObj)
}

const pointShowAniamte = (value, isFirst = false) => {
  if (infoObj !== null) {
    scene.remove(infoObj)
    infoObj = null
  }
  active.value = active.value === value ? null : value

  waterWorksType.value.forEach((item, i) => {
    if (active.value === null) {
      if (isFirst) {
        createPointForCategory(i, item.points)
      } else {
        item.points.forEach(() => {
          modelGroup.traverse((child) => {
            if (child.isMesh) {
              child.parent.offAll()
              child.visible = false
              const ud = child.parent.userData
              if (ud.tip) hideTip(child.parent)
              if (ud.beam) { ud.beam.visible = false; ud.beam.scale.set(1, 0, 1) }
            }
          })
        })
      }
    } else if (active.value !== item.value) {
      item.points.forEach((point) => {
        modelGroup.traverse((child) => {
          if (child.isMesh && child.name === point.businessCode) {
            child.parent.offAll()
            child.visible = false
            const ud = child.parent.userData
            if (ud.tip) hideTip(child.parent)
            if (ud.beam) { ud.beam.visible = false; ud.beam.scale.set(1, 0, 1) }
          }
        })
      })
    } else {
      item.points.forEach((point) => {
        modelGroup.traverse((child) => {
          if (child.isMesh && child.name === point.businessCode) {
            setEventOfModel(child.parent, point)
            child.visible = true
            const g = child.parent
            // 光柱先就位压扁、标签隐藏；入场完成后再走升起动画，升完渐显标签
            g.userData.beam.visible = true
            g.userData.beam.scale.set(1, 0, 1)
            hideTip(g)
            if (sceneEntered) revealBeam(g, 0)
            if (child.material && child.material.uniforms && child.material.uniforms.animate) {
              try {
                child.material.uniforms.animate.value = false
              } catch (e) {}
            }
          }
        })
      })
    }
  })
}

// ============ 数据加载 ============
const getFactories = async () => {
  try {
    const list = await appService.getAllFactories()
    factories = JSON.parse(JSON.stringify(list))
    nodes = factories.filter((x) => x.mapCoord.length > 0)
    waterWorksType.value.forEach((item, i) => {
      waterWorksType.value[i] = { ...item, points: nodes.filter((val) => val.bizType === item.value) }
    })
    buildPointTemplate()
    pointShowAniamte(null, true)
    // 默认显示水厂点位并高亮水厂分类
    pointShowAniamte(1)
  } finally {
    markPartLoaded()
  }
}

// ============ 开场相机飞入 + 标签显现 ============
const enterScene = async () => {
  if (sceneEntered) return
  sceneEntered = true
  loading.value = false

  const controls = sceneView.controls
  // 飞行期间关闭阻尼惯性，避免控制器 update 与补间互相拉扯造成抖动
  if (controls) controls.enableDamping = false

  // 单段直飞俯视视角（flyTo 内部自动锁定控制器，结束自动放开）
  await sceneView.flyTo(camera.position, { x: 0, y: 100, z: 55 }, 1800)

  // 区域文本显现动画（飞行完成后再显示）
  textGroup.visible = true
  textGroup.traverse((child) => {
    if (child.isCSS3DObject) {
      new TWEEN.Tween(child.position, true)
        .to({ x: child.position.x + 2, y: child.position.y, z: child.position.z }, 300)
        .easing(TWEEN.Easing.Quintic.Out)
        .start()
      new TWEEN.Tween(child.scale, true)
        .to({ x: 0.1, y: 0.1, z: 0.1 }, 300)
        .easing(TWEEN.Easing.Quintic.Out)
        .start()
    }
  })

  // 入场飞行完成后，可见点位光柱逐根错峰升起，升起结束再亮出标签
  let beamIndex = 0
  modelGroup.traverse((child) => {
    if (child.userData && child.userData.beam && child.userData.mesh && child.userData.mesh.visible) {
      revealBeam(child, beamIndex * 90)
      beamIndex += 1
    }
  })

  // 背景三圈从中心向外扩散展开
  if (bgRingMat) {
    const reveal = { v: 0 }
    new TWEEN.Tween(reveal, true)
      .to({ v: 1 }, 1400)
      .easing(TWEEN.Easing.Quintic.Out)
      .onUpdate(() => { bgRingMat.uniforms.uReveal.value = reveal.v })
      .start()
  }

  if (controls) {
    controls.minDistance = 30
    controls.maxDistance = 200
    // 飞行结束，恢复阻尼惯性
    controls.enableDamping = true
  }
}

// ============ 每帧：更新 shader 时间 ============
const onFrame = (delta) => {
  elapsed += delta
  // 进度条向真实目标缓动爬升；全部就绪且爬到 100 后再进入场景
  if (!sceneEntered) {
    if (progress.value < targetProgress) {
      progress.value += (targetProgress - progress.value) * 0.12 + 0.4
      if (progress.value > targetProgress) progress.value = targetProgress
    }
    if (targetProgress >= 100 && progress.value >= 99.5) {
      progress.value = 100
      enterScene()
    }
  }
  if (!scene) return
  scene.traverse((child) => {
    if (child.material && child.material.uniforms) {
      try {
        child.material.uniforms.iTime.value = elapsed
      } catch (e) {}
    }
  })
}

onMounted(() => {
  sceneView = new SceneView(container.value, {
    mode: '',
    bgColor: 0x0a1929,
    environment: false,
    shadowMapEnabled: false,
    floor: { enabled: false },
    fog: { enabled: true, color: 0x000000, near: 30, far: 300 },
    ambLight: { enabled: true, color: 0x404040, intensity: 0.5 },
    dirLight: { enabled: true, color: 0xffffff, intensity: 0.5, position: { x: 0, y: 30, z: 50 } },
    control: {
      enabled: true,
      enableDamping: true,
      dampingFactor: 0.3,
      zoomSpeed: 1,
      maxDistance: 150,
      autoRotateSpeed: -0.2,
      minPolarAngle: -Math.PI / 2,
      maxPolarAngle: Math.PI / 2.2,
      panLimit: { enabled: true, min: { x: -40, z: -30 }, max: { x: 40, z: 30 } }
    },
    geo: {
      center: [114.19, 22.63],
      worldScale: 0.0012,
    },
    postProcessing: {
      enabled: true,
      smaa: { enabled: true },
      gtao: { enabled: false },
      bloom: { enabled: true, strength: 0.8, radius: 0.35, threshold: 0.35 },
      vignette: { enabled: true, strength: 0.75, offset: 1.6 },
      film: { enabled: false },
      bokeh: { enabled: false },
      outline: { enabled: true, edgeStrength: 5, edgeThickness: 1 },
    },
  })

  scene = sceneView.scene
  camera = sceneView.camera
  camera.position.set(-24.5, 135, 160)
  infoElement = noteRef.value

  loadTextures()
  loadGeoJson()
  planeMesh()
  createAreaText()
  getFactories()

  // 兜底：资源异常时 8s 后强制进入展示态
  setTimeout(() => {
    if (loading.value) {
      progress.value = 100
      enterScene()
    }
  }, 8000)

  sceneView.animateCallback = onFrame
  sceneView.start()
})

onUnmounted(() => {
  if (sceneView) {
    sceneView.clear()
    sceneView = null
  }
  scene = null
  camera = null
})
</script>

<template>
  <div class="map-container">
    <!-- 3D 渲染区域 -->
    <div ref="container" class="map-canvas-wrap"></div>

    <!-- 加载遮罩 -->
    <div v-if="loading" class="loading-mask">
      <span>正在加载资源({{ Math.round(progress) }}%)</span>
      <div class="loading-bar">
        <div class="loading-bar-inner" :style="{ width: progress + '%' }"></div>
      </div>
    </div>

    <!-- 底部：点位分类导航 -->
    <div v-if="!loading" class="footer">
      <ul class="foot-nav">
        <li
          v-for="item in waterWorksType"
          :key="item.value"
          :class="{ [item.className]: active === item.value }"
        >
          <div
            class="border-inner"
            :class="{ [item.className]: active === item.value }"
            @click="pointShowAniamte(item.value)"
          >
            <div class="nav-text">
              <h6>{{ item.lable }}</h6>
              <span>{{ item.alias }}</span>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 点位信息框（CSS2D 挂载元素） -->
    <div ref="noteRef" class="point-note" v-show="noteShow">
      <div class="trangle"></div>
      <div class="info-box">
        <div class="top-wrap">
          <div>
            <div class="point-note-title"></div>
            <div class="point-note-detail"></div>
          </div>
          <span class="right-icon"></span>
        </div>
        <ul class="info-content">
          <li v-for="item in showNodeData" :key="item.id">
            <span class="name">{{ item.displayName }}</span>
            <span class="value">{{ item.dataValue }}<span class="unit">{{ item.dataUnit }}</span></span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-canvas-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #0a1929;
  overflow: hidden;
}

.loading-mask {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-color: #000;
  color: #eee;
  font-size: 14px;
}

.loading-bar {
  width: 240px;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 5px;
  overflow: hidden;
}

.loading-bar-inner {
  height: 100%;
  background: #20cabf;
  border-radius: 5px;
  transition: width 0.2s ease;
}

// 底部分类导航
.footer {
  position: absolute;
  bottom: 60px;
  width: 100%;
  z-index: 100;
  user-select: none;

  .foot-nav {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      .border-inner {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 220px;
        padding: 10px 0;
        color: #fff;
        background-color: rgba(23, 88, 107, 0.3);
        border: 1px solid #1e606d;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: rgba(23, 88, 107, 0.6);
        }

        &.active1 {
          border-color: #2ca796;
          background: linear-gradient(0deg, #127c6e, #2ca796);
        }
        &.active2 {
          border-color: #aaab4e;
          background: linear-gradient(0deg, #877631, #aaab4e);
        }
        &.active3 {
          border-color: #2c94a7;
          background: linear-gradient(0deg, #13597d, #2c94a7);
        }

        .nav-text {
          text-align: center;
          h6 {
            margin: 0 0 2px 0;
            font-size: 18px;
            font-weight: 600;
          }
          span {
            font-size: 12px;
            opacity: 0.8;
          }
        }
      }
    }
  }
}
</style>

<style>
/* 以下标签类为 CSS2D / CSS3D 层注入到容器外的 DOM，需用全局样式 */
.city-area {
  padding: 2px 4px;
  font-size: 12px;
  color: #06bdf5;
  background-color: rgba(1, 24, 43, 0.5);
  white-space: nowrap;
  border-radius: 4px;
  border: 1px solid #06bdf569;
}

.tipElement {
  padding: 2px 4px;
  font-size: 10px;
  color: #ffcd10;
  white-space: nowrap;
  pointer-events: none;
}

.point-note {
  --note-color: #00FFF6;
  position: relative;
  line-height: 16px;
  color: var(--note-color);
  text-align: start;

  .trangle {
    position: absolute;
    left: calc(50% + 1px);
    top: 50%;
    transform: translate(-50%, -100%) rotateZ(8deg);
    width: 8px;
    height: 8px;
    border-top: 16px solid var(--note-color);
    border-right: 8px solid transparent;
    border-left: 8px solid transparent;
    opacity: 0;
    animation: my_fadeInleft 0.2s ease-in forwards;
    &::after {
      content: '';
      display: block;
      width: 0px;
      height: 2px;
      background: var(--note-color);
      position: absolute;
      left: 50%;
      top: 50%;
      transform: rotateZ(-80deg);
      transform-origin: left center;
      animation: my_widthShow1 0.3s linear 0.2s forwards;
    }
    &::before {
      content: '';
      display: block;
      width: 0px;
      height: 2px;
      background: var(--note-color);
      position: absolute;
      transform: rotateZ(-5deg);
      transform-origin: left center;
      left: calc(50% + 13px);
      top: calc(50% - 79px);
      animation: my_widthShow2 0.2s linear 0.5s forwards;
    }
  }
  .info-box {
    width: 290px;
    position: absolute;
    top: 50%;
    left: calc(50% + 33px);
    transform: translateY(calc(-50% - 79px));
    padding: 12px 15px;
    background: rgba(8, 22, 34, 0.96);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-left: 3px solid var(--note-color);
    border-right: 3px solid var(--note-color);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45), 0 0 18px rgba(0, 238, 255, 0.08);
    opacity: 0;
    animation: note-fade 0.3s ease-in 0.2s forwards;

    .top-wrap {
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      margin-bottom: 10px;
      padding: 2px 2px 10px;
      position: relative;

      .point-note-title {
        width: 190px;
        font-size: 15px;
        font-weight: 600;
        line-height: 22px;
        color: var(--note-color);
      }
      .point-note-detail {
        width: 190px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      .right-icon {
        position: absolute;
        right: 0;
        top: 4px;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 9px solid var(--note-color);
      }
    }

    .info-content {
      color: #fff;
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        line-height: 26px;
        padding: 2px 0;
        border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
        &:last-child {
          border-bottom: none;
        }
        .name {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.72);
        }
        .value {
          font-size: 14px;
          font-weight: 600;
          color: var(--note-color);
        }
        .unit {
          font-size: 12px;
          transform: scale(0.8);
          color: #aaa;
          display: inline-block;
          width: 50px;
          margin-left: 5px;
        }
      }
    }
  }
}
@keyframes my_fadeInleft {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes my_widthShow1 {
  from {
    width: 0;
  }
  to {
    width: 80px;
  }
}

@keyframes my_widthShow2 {
  from {
    width: 0;
  }
  to {
    width: 10px;
  }
}
@keyframes note-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
