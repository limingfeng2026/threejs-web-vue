/**
 * SceneView 页面接入样板（复制到新三维页面后按业务改）
 * 依赖：Vue3 <script setup>、SceneView、THREE、TWEEN
 */
import { ref, onMounted, onUnmounted } from 'vue'
import SceneView from '@/components/SceneView/index.js'
import * as THREE from 'three'

const container = ref(null)
let sceneView = null
let scene = null
let camera = null

onMounted(() => {
  sceneView = new SceneView(container.value, {
    // 顶层
    bgColor: 0x0a1929,
    environment: false,
    shadowMapEnabled: false,
    // 地面 / 雾
    floor: { enabled: false },
    fog: { enabled: true, color: 0x000000, near: 30, far: 300 },
    // 灯光
    ambLight: { enabled: true, color: 0x404040, intensity: 0.5 },
    dirLight: { enabled: true, color: 0xffffff, intensity: 0.5, position: { x: 0, y: 30, z: 50 } },
    // 控制器
    control: {
      enabled: true,
      enableDamping: true,
      dampingFactor: 0.3,
      zoomSpeed: 1,
      maxDistance: 150,
      // 平移 xyz 盒范围限制（默认关闭，需要再开）
      // panLimit: { enabled: true, min: { x: -60, z: -60 }, max: { x: 60, z: 60 } },
    },
    // 后期
    postProcessing: {
      enabled: true,
      smaa: { enabled: true },
      bloom: { enabled: true, strength: 0.8, radius: 0.35, threshold: 0.35 },
      outline: { enabled: true, edgeStrength: 5, edgeThickness: 1 },
    },
  })

  scene = sceneView.scene
  camera = sceneView.camera
  camera.position.set(-24.5, 135, 160)

  // 每帧业务回调（可选）：delta 为帧间隔秒
  sceneView.animateCallback = (delta) => {
    // 更新 shader iTime、动画状态等
  }

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
