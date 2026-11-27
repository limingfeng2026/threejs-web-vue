<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import SceneView from '@/components/SceneView/index.js'
import SceneLoading from '@/components/SceneLoading/index.vue'
import TWEEN from '@tweenjs/tween.js'

const container = ref(null)
const loading = ref(true)
const progress = ref(0)
// 真实加载目标进度：进度条向它缓动爬升，到 100 再关闭遮罩
const targetProgress = ref(0)
let enterTimer = null

let sceneView = null
let THREE = null
const wheels = []
let bodyMaterial = null
let detailsMaterial = null
let glassMaterial = null
let bodyShader = null
let carSweepTween = null
// 行驶状态：点击按钮切换；轮子转动与地板纹理滚动仅在行驶中进行
const running = ref(false)
let floorTex = null
let driveBtn = null
// 车身纵向（车头→车尾，z 轴）包围盒范围，由加载后的包围盒写入
let bodyZMin = -2.267
let bodyZMax = 2.256

// 常用车漆色板：点击实时切换车身（颜色与自发光同步）
const carColors = [
  { name: '熔岩红', hex: '#c01824' },
  { name: '珍珠白', hex: '#f2f2f2' },
  { name: '曜石黑', hex: '#1a1a1a' },
  { name: '金属银', hex: '#b8bcc2' },
  { name: '深空灰', hex: '#5a5f66' },
  { name: '冰川蓝', hex: '#2f6fb0' },
  { name: '宝石蓝', hex: '#1b3a6b' },
  { name: '翡翠绿', hex: '#2e7d5b' },
  { name: '柠檬黄', hex: '#e8c531' },
  { name: '活力橙', hex: '#e8742a' },
  { name: '钛金', hex: '#c9a86a' },
  { name: '霓虹青', hex: '#00ffff' },
]
const currentColor = ref(carColors[carColors.length - 1].hex)

// 颜色过渡动画时长（ms）
const COLOR_TWEEN_DURATION = 800
let colorTween = null

// 从起点色平滑过渡到目标 hex，onUpdate 每帧返回插值后的 rgb
const tweenColor = (startColor, endHex, onUpdate, duration = COLOR_TWEEN_DURATION) => {
  if (colorTween) { colorTween.stop(); colorTween = null }
  const end = new THREE.Color(endHex)
  const state = { r: startColor.r, g: startColor.g, b: startColor.b }
  colorTween = new TWEEN.Tween(state, true)
    .to({ r: end.r, g: end.g, b: end.b }, duration)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => onUpdate(state))
    .onComplete(() => { colorTween = null })
    .start()
}

// 车身换色：新颜色从车头沿 z 轴扫描蔓延到车尾
const applyCarColor = (hex) => {
  currentColor.value = hex
  if (!bodyShader) return
  const u = bodyShader.uniforms
  u.uColorFrom.value.copy(u.uColorTo.value)
  u.uColorTo.value.set(hex)
  u.uProgress.value = 0
  if (carSweepTween) carSweepTween.stop()
  const state = { p: 0 }
  carSweepTween = new TWEEN.Tween(state, true)
    .to({ p: 1 }, 600)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => { u.uProgress.value = state.p })
    .onComplete(() => { u.uColorFrom.value.set(hex); carSweepTween = null })
    .start()
}

// 常用展厅背景色：选背景时，背景、雾、地板一起联动
const bgColors = [
  { name: '冷蓝', hex: '#0a1420' },
  { name: '深灰', hex: '#33373d' }
]
const currentBgColor = ref('#0a1420')

// 切背景：背景 + 雾 + 地板联动；地板在背景色基础上提亮一档，保证地面与底色可区分
const applyBgColor = (hex) => {
  currentBgColor.value = hex
  if (!sceneView) return
  const bg = sceneView.scene.background
  const start = bg && bg.isColor ? bg.clone() : new THREE.Color(hex)
  tweenColor(start, hex, (s) => {
    if (!sceneView || !sceneView.scene) return
    const { r, g, b } = s
    if (bg && bg.isColor) bg.setRGB(r, g, b)
    if (sceneView.scene.fog && sceneView.scene.fog.color) sceneView.scene.fog.color.setRGB(r, g, b)
    if (sceneView.floor && sceneView.floor.material && THREE) {
      const floorMat = sceneView.floor.material
      // 挂贴图后 baseColor 保持白色：color 会与贴图相乘，跟随背景变色会把网格压暗；
      // 仅无贴图时才按背景色提亮联动
      if (floorMat.map) {
        floorMat.color.setRGB(1, 1, 1)
      } else {
        floorMat.color.setRGB(
          Math.min(r * 1.5, 1), Math.min(g * 1.5, 1), Math.min(b * 1.5, 1)
        )
      }
    }
  })
}

// 点击按钮：切换行驶状态，文案联动
const toggleDrive = () => {
  running.value = !running.value
  if (driveBtn) driveBtn.textContent = running.value ? '停止汽车' : '启动汽车'
}

const CAR_URL = '/3d/glb/car/car.glb'
const shadowUrl = '/3d/glb/car/ferrari_ao.png'
const FLOOR_TEX_URL = '/3d/textures/car-floor.png'

// 加载汽车模型：按节点名替换车身 / 轮毂 / 玻璃材质，收集车轮做旋转动画
const loadCar = () => {
  bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00ffff,
    metalness: 0.9,
    roughness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    // 车身自发光：颜色与车漆同色，强度控制发光亮度
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
  })

  // 注入“车头→车尾”颜色蔓延：uProgress=0 整车旧色，=1 整车新色，中间沿 z 轴扫描
  bodyMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = { value: 1 }
    shader.uniforms.uColorFrom = { value: new THREE.Color(0x00ffff) }
    shader.uniforms.uColorTo = { value: new THREE.Color(0x00ffff) }
    shader.uniforms.uZMin = { value: bodyZMin }
    shader.uniforms.uZMax = { value: bodyZMax }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos;
        uniform float uProgress;
        uniform vec3 uColorFrom;
        uniform vec3 uColorTo;
        uniform float uZMin;
        uniform float uZMax;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = clamp((vWorldPos.z - uZMin) / (uZMax - uZMin), 0.0, 1.0);
          float k = smoothstep(uProgress - 0.06, uProgress + 0.06, u);
          diffuseColor.rgb = mix(uColorTo, uColorFrom, k);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float u = clamp((vWorldPos.z - uZMin) / (uZMax - uZMin), 0.0, 1.0);
          float k = smoothstep(uProgress - 0.06, uProgress + 0.06, u);
          totalEmissiveRadiance = mix(uColorTo, uColorFrom, k);
        }`)

    bodyShader = shader
  }

  detailsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.5,
    // 车身自发光：颜色与车漆同色，强度控制发光亮度
    emissive: 0xffffff,
    emissiveIntensity: 0.5,
  })

  glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0,
    transmission: 1.0,
    ior: 1.5,
  })

  sceneView.glbModelLoader(CAR_URL, (gltf) => {
    const carModel = gltf.scene.children[0] || gltf.scene
    carModel.name = 'carModel'
    carModel.on('dblclick', (g,m,p) => {
      console.log(m)
    })
    // 车身
    const body = carModel.getObjectByName('body')
    if (body) {
      body.material = bodyMaterial
      body.updateWorldMatrix(true, false)
      const box = new THREE.Box3().setFromObject(body)
      bodyZMin = box.min.z
      bodyZMax = box.max.z
      if (bodyShader) {
        bodyShader.uniforms.uZMin.value = bodyZMin
        bodyShader.uniforms.uZMax.value = bodyZMax
      }
    }

    // 投影
    carModel.traverse((child) => {
      if (child.isMesh) child.castShadow = true
    })

    // 轮毂 / 饰条金属件
    ;['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].forEach((name) => {
      const obj = carModel.getObjectByName(name)
      if (obj) obj.material = detailsMaterial
    })

    // 玻璃
    const glass = carModel.getObjectByName('glass')
    if (glass) glass.material = glassMaterial

    // 收集四个车轮
    ;['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach((name) => {
      const wheel = carModel.getObjectByName(name)
      if (wheel) wheels.push(wheel)
    })

    const shadow = new THREE.TextureLoader().load( shadowUrl );
    // shadow
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry( 0.655 * 4, 1.2 * 4 ),
        new THREE.MeshBasicMaterial( {
            map: shadow, 
            blending: THREE.MultiplyBlending, 
            toneMapped: false, 
            transparent: true,
            premultipliedAlpha: true
        } )
    );
    mesh.rotation.x = - Math.PI / 2;
    mesh.renderOrder = 2;
    mesh.position.y = 0.2
    sceneView.scene.add(mesh)

    sceneView.scene.add(carModel)

    // 相机对准车辆
    sceneView.camera.position.set(3.6, 1.6, 4.6)
    sceneView.controls.target.set(0, 0.4, 0)
    sceneView.controls.update()

    // 模型就绪：交给 onFrame 缓动爬满后再关闭遮罩
    targetProgress.value = 100
  },
  // 真实下载进度（0-100）回写目标进度
  (xhr, p) => { targetProgress.value = Math.max(targetProgress.value, p) }
)
}

// 行驶参数：轮子转速(rad/s)、地板网格滚动速度(UV/s)
const WHEEL_SPEED = Math.PI * 1.8
const FLOOR_SCROLL_SPEED = 1.0

// 每帧：进度缓动爬升 → 行驶中车轮滚动 + 地板网格向后滚动
const onFrame = (delta) => {
  // 进度条向真实目标缓动爬升（加载期，不受行驶状态拦截）
  if (loading.value) {
    if (progress.value < targetProgress.value) {
      progress.value += (targetProgress.value - progress.value) * 0.12 + 0.4
      if (progress.value > targetProgress.value) progress.value = targetProgress.value
    }
    if (targetProgress.value >= 100 && progress.value >= 99.5) {
      progress.value = 100
      loading.value = false
    }
  }

  if (!running.value) return
  const dt = delta || 0.016
  wheels.forEach((wheel) => {
    if (wheel) wheel.rotation.x -= WHEEL_SPEED * dt
  })
  if (floorTex) {
    floorTex.offset.y += FLOOR_SCROLL_SPEED * dt
  }
}

onMounted(() => {
    sceneView = new SceneView(container.value, {
    mode: '',
    bgColor: 0x0a1420,
    environment: false,
    environmentIntensity: 0.6,
    shadowMapEnabled: false,
    floor: { name: 'scene_floor', enabled: true, color: 0x14263a, width: 30, height: 30 },
    fog: { enabled: true, near: 1, far: 30, color: 0x0a1420, density: 0.1 },
    control: {
      enabled: true,
      enableDamping: true,
      dampingFactor: 0.3,
      zoomSpeed: 2,
      minDistance: 1,
      maxDistance: 15,
      autoRotateSpeed: -0.2,
      minPolarAngle: -Math.PI / 2,
      maxPolarAngle: Math.PI / 2.2,
      panLimit: { enabled: true, min: { x: -4, z: -4 }, max: { x: 4, z: 4 } }
    },
    dirLight: {
      enabled: true,
      color: 0xcfe0ff,
      intensity: 1,
      position: { x: 10, y: 50, z: 0 },
    },
    ambLight: {
      enabled: true,
      color: 0x404040,
      intensity: 1,
    },
    postProcessing: {
      enabled: true,
      bloom: { enabled: false, strength: 0.1, radius: 0.1 },
      vignette: { enabled: false },
      gtao: { enabled: false },
    },
  })
  THREE = sceneView.THREE
  sceneView.addFloorReflections(sceneView.floor)
  // 地板贴科技网格底纹：原地板保留可见，反射层叠在其上
  floorTex = new THREE.TextureLoader().load(FLOOR_TEX_URL)
  floorTex.colorSpace = THREE.SRGBColorSpace
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(20, 20)
  sceneView.floor.material.map = floorTex
  sceneView.floor.material.color.set(0xffffff)
  sceneView.floor.material.needsUpdate = true
  // 悬浮按钮：点击切换行驶（轮子转动 + 地板网格滚动）
  driveBtn = document.createElement('button')
  driveBtn.type = 'button'
  driveBtn.className = 'car-label'
  driveBtn.textContent = '启动汽车'
  driveBtn.style.pointerEvents = 'auto'
  driveBtn.addEventListener('click', toggleDrive)
  const label = sceneView.createText({
    element: driveBtn,
    color: '#00dddd',
    type: '3ds',
    position: { x: 0, y: 1.5, z: 0 },
  })
  label.scale.set(0.01, 0.01, 0.01)
  sceneView.scene.add(label)

  loadCar()

  // 兜底：资源异常或卡住时 8s 后强制进入展示态
  enterTimer = setTimeout(() => {
    if (loading.value) {
      targetProgress.value = 100
      progress.value = 100
      loading.value = false
    }
  }, 8000)

  sceneView.animateCallback = onFrame
  sceneView.start()
})

onUnmounted(() => {
  if (carSweepTween) { carSweepTween.stop(); carSweepTween = null }
  if (colorTween) { colorTween.stop(); colorTween = null }
  if (enterTimer) { clearTimeout(enterTimer); enterTimer = null }
  if (sceneView) {
    sceneView.clear()
    sceneView = null
  }
})
</script>

<template>
  <div class="car-container">
    <!-- 3D 渲染区域 -->
    <div ref="container" class="car-canvas-wrap"></div>

    <!-- 模型加载遮罩（公共组件） -->
    <SceneLoading
      :visible="loading"
      :progress="progress"
      brand="CAR STAGE"
      title="整车模型载入"
      status="正在加载模型资源 · 车漆材质与光照校准中"
      accent="#57c8ff"
      accent2="#8ef2c8"
    />
    <!-- 底部：车身色板 -->
    <div v-if="!loading" class="color-panel">
      <div class="color-group">
        <span class="group-label">车身</span>
        <div class="swatches">
          <button
            v-for="c in carColors"
            :key="c.hex"
            class="swatch"
            :class="{ active: currentColor === c.hex }"
            :style="{ backgroundColor: c.hex }"
            :title="c.name"
            @click="applyCarColor(c.hex)"
          />
        </div>
      </div>
    </div>
    <!-- 右上角：背景色板（背景 / 雾 / 地板联动） -->
    <div v-if="!loading" class="bg-panel">
      <span class="group-label">背景</span>
      <div class="swatches">
        <button
          v-for="c in bgColors"
          :key="c.hex"
          class="swatch"
          :class="{ active: currentBgColor === c.hex }"
          :style="{ backgroundColor: c.hex }"
          :title="c.name"
          @click="applyBgColor(c.hex)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.car-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.car-canvas-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #333333;
  overflow: hidden;
}

// 底部车身色板
.color-panel {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: rgba(10, 20, 32, 0.72);
  border: 1px solid rgba(120, 180, 220, 0.25);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  z-index: 1000;
}

// 右上角背景色板（背景 / 雾 / 地板联动）
.bg-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(10, 20, 32, 0.72);
  border: 1px solid rgba(120, 180, 220, 0.25);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  z-index: 1000;
}

.color-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-label {
  width: 32px;
  flex-shrink: 0;
  font-size: 11px;
  color: #9fb6c9;
  letter-spacing: 1px;
}

.swatches {
  display: flex;
  align-items: center;
  gap: 10px;
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: scale(1.18);
  }

  &.active {
    border-color: #ffffff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
  }
}
</style>

<style>
.car-label {
  pointer-events: auto;
  cursor: pointer;
  color: #00dddd;
  background: rgba(10, 20, 32, 0.7);
  border: 1px solid rgba(0, 221, 221, 0.5);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 1px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.car-label:hover {
  background: rgba(0, 221, 221, 0.18);
  box-shadow: 0 0 12px rgba(0, 221, 221, 0.35);
}
</style>
