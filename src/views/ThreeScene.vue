<template>
  <div class="sence-container">
    <!-- 3D 渲染区域 -->
    <div ref="container" class="sence-canvas-wrap"></div>
    <!-- 模型加载遮罩（公共组件） -->
    <SceneLoading
      :visible="loading"
      :progress="loadProgress"
      brand="THREE SCENE"
      title="场景资源载入"
      status="正在加载模型与贴图 · 场景预编译中"
      accent="#39d8ff"
      accent2="#7ce8c8"
    />
    <div :class="{'show': maskShow}" class="container-mask"></div>
    <button v-if="isIntoTargetScene && !isIntoLoading" class="back-btn" @click="switchBack">
      返回
    </button>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import SceneView from '@/components/SceneView/index.js';
import SceneLoading from '@/components/SceneLoading/index.vue'
import { Water } from 'three/examples/jsm/objects/Water.js';
const container = ref(null)
const loadProgress = ref(0)
let sceneView = null, THREE = null;
let waterMesh = null, flowMesh = null, buildingMat = null;
let sceneModalGroup = null;
let outScene = null;
let innerScene = null;
let tragetCamera = null;
let originalObj = null;
let loadedModal = ref(0);
let isIntoTargetScene = ref(false);
let isIntoLoading = ref(false);
let maskShow = ref(false);
let files = ref({ 
  // '/3d/glb/home.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/main-d.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/树.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/配楼.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/cameras.glb': { total: 0,loaded: 0, show: true },
  '/3d/glb/water.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/b1-d.glb': { total: 0, loaded: 0,pos: [11, 0, -3], rot: [0, Math.PI/1.98, 0], show: false },
  '/3d/glb/世纪仓库-d.glb': { total: 0, loaded: 0, pos: [-9, 0, -12],rot: [0, Math.PI/1.95, 0], show: false },
  '/3d/glb/edge.glb': { total: 0, loaded: 0, show: true },
  '/3d/glb/货物.glb': { total: 0, loaded: 0, pos: [-9, 0, -12],rot: [0, Math.PI/1.95, 0],show: false },
  // '/3d/glb/SZLog.glb': { total: 0, loaded: 0, show: true },
})
let viewPosition = {
    x: 0,
    y: 45,
    z: 0
}
// 仓库内 / 仓库外共用同一套光照与环境贴图配置，保证切换场景时观感一致
// 平行光分两档强度：仓库内是室内平光（弱），仓库外保留投影并让太阳更亮
const sceneLightConfig = {
  // —— 室外：太阳为主，环境光压得低才有"影子黑下去"的对比 ——
  environmentIntensity: 0.38,
  ambient: { color: 0xeaf1ff, intensity: 0.05 },
  hemisphere: { skyColor: 0xbcd6ff, groundColor: 0xcbb59a, intensity: 0.14 },
  directional: {
    // 橙色暖光：偏暖的落日/午后阳光
    color: 0xffcf9e,
    intensity: 0.5,
    outdoorIntensity: 11.8,
    position: { x: 100, y: 85, z: 0 },
    target: { x: -9, y: 0, z: -12 }
  },
  // —— 室内：仓库里没有太阳直射，环境光给足一些，货架不至于黑成剪影 ——
  indoor: {
    environmentIntensity: 0.5,
    ambient: { color: 0xeaf1ff, intensity: 0.14 },
    hemisphere: { skyColor: 0xbcd6ff, groundColor: 0xcbb59a, intensity: 0.36 }
  }
}
let buildingPos = [{
  name: 'B1栋',
  typeName: ['/3d/glb/b1-d.glb'],
  size: [8.2, 2.4, 4],
  rot: [0, 0.02, 0],
  pos: [11.1, 1.2, -3.8]
},{
  name: '世纪物流园',
  typeName: ['/3d/glb/世纪仓库-d.glb', '/3d/glb/货物.glb'],
  size: [8.2, 2.8, 4],
  rot: [0, Math.PI/1.95, 0],
  pos: [-9.2, 1.4, -11.8],
  storageRot: [0, 0, 0]
},{
  name: '闸口',
  size: [4.2, 1, 2],
  rot: [0, 0.02, 0],
  pos: [4.2, 0.5, -14.8],
}]
// 监听模型加载进度
watch(files.value, (newVal) => {
  let totalCount = 0;
  let loadedCount = 0;
  const totalModels = Object.keys(newVal).length;
  for (let url in newVal) {
    totalCount += newVal[url].total || 0;
    loadedCount += newVal[url].loaded || 0;
  }
  let percent;
  if (totalCount > 0) {
    // 按已下载字节数占比
    percent = (loadedCount / totalCount) * 100;
  } else if (totalModels > 0) {
    // xhr.total 未知时，按已完成模型数估算
    percent = (loadedModal.value / totalModels) * 100;
  } else {
    percent = 0;
  }
  loadProgress.value = Math.min(100, Math.max(0, Math.round(percent)));
})
// 监听模型加载完成
const loading = computed(() => {
  return loadProgress.value < 100 || loadedModal.value !== Object.keys(files.value).length;
})
// 监听模型加载完成，进入视图，添加建筑，处理模型显示
watch(loading, (newVal) => {
  if (!newVal) {
    loadProgress.value = 100;
    intoView();
    addBuilding();
    handleModal(sceneModalGroup);
    fitDirectionalShadow();
  }
})
// 外景模型开启阴影：所有网格接收阴影，只让“有厚度”的网格投影
// sceneModalGroup 已缩放 0.05，阈值按世界单位算，0.35 约等于 7 米的实体
const enableOutdoorShadows = (root) => {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.receiveShadow = true;
    box.setFromObject(child);
    box.getSize(size);
    child.castShadow = size.y > 0.35;
  });
};
// 阴影相机贴合模型范围：默认 ±240 的视锥铺在 2048 贴图上，
// 每个像素要覆盖 0.23 个世界单位，影子会糊成一片，贴合后才有清晰投影
const fitDirectionalShadow = () => {
  if (!sceneView || !sceneView.dirLight || !sceneModalGroup) return;
  sceneModalGroup.updateMatrixWorld(true);

  // ★ 包围盒必须过滤掉超大网格（地图底图/天际边这类网格有 7000+ 世界单位），
  //   否则视锥被撑到几千宽，2048 贴图每像素吃掉几个单位，影子直接消失
  const box = new THREE.Box3();
  const tmpBox = new THREE.Box3();
  const tmpSize = new THREE.Vector3();
  const MAX_MESH_SPAN = 200;
  sceneModalGroup.traverse((child) => {
    if (!child.isMesh) return;
    tmpBox.setFromObject(child);
    if (tmpBox.isEmpty()) return;
    tmpBox.getSize(tmpSize);
    if (Math.max(tmpSize.x, tmpSize.y, tmpSize.z) > MAX_MESH_SPAN) return;
    box.union(tmpBox);
  });
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.62 + 4, 12, 80);

  const light = sceneView.dirLight;
  const dir = new THREE.Vector3().subVectors(light.target.position, light.position).normalize();
  const dist = light.position.distanceTo(light.target.position);

  // 保持原太阳方向，只把视锥中心对准模型
  light.target.position.copy(center);
  light.target.updateMatrixWorld();
  light.position.copy(center).addScaledVector(dir, -dist);

  const cam = light.shadow.camera;
  cam.left = -radius;
  cam.right = radius;
  cam.top = radius;
  cam.bottom = -radius;
  cam.near = Math.max(dist - radius * 2, 0.1);
  cam.far = dist + radius * 2;
  cam.updateProjectionMatrix();

  light.shadow.mapSize.set(2048, 2048);
  light.shadow.needsUpdate = true;
  sceneView.renderer.shadowMap.needsUpdate = true;
};
// 加载模型
const loadModel = async (url) => {
    sceneView.camera.position.set(viewPosition.x, viewPosition.y + 15, viewPosition.z);
    sceneView.glbModelLoader(url, (gltf) => {
        let modal = gltf.scene;
        modal.name = url;
        if (files.value[url].show) {
          sceneModalGroup.add(modal);
          sceneModalGroup.updateMatrixWorld(true);
          enableOutdoorShadows(modal);
        }else{
          innerScene.add(modal);
          modal.visible = false;
          modal.on('dblclick', (g, m, p) => {
            console.log('双击模型:', m, p);
            sceneView.setOutlineObjects(m);
          })
          const groundMeshes = []
          modal.traverse((child) => {
            if (!child.isMesh) return
            if (child.name.indexOf('SM_摄像头') !== -1) {
              child.material.emissiveIntensity = 1;
              child.material.metalness = 0.1;
              child.material.roughness = 0.8;
            }
            if(child.name.indexOf('墙_2') !== -1){
              child.material.metalness = 0.1;
              child.material.roughness = 0.8;
            }
            if (child.name.indexOf('停车') !== -1) {
              child.material.emissiveIntensity = 20;
            }
            if (child.name.indexOf('Plane') !== -1) {
              child.material = new THREE.MeshBasicMaterial({ color: child.material.color, map: child.material.map });
            }
            if(child.name.indexOf('B1_地面') !== -1){
              child.material.metalness = 0.1;
              child.material.roughness = 0.8;
            }
            // 地面网格：收集后统一交给反射层（由调用方指定 Mesh，封装不再按名称遍历匹配）
            if (child.name.indexOf('地面反射') !== -1 || child.name.indexOf('B1_地面') !== -1) {
              groundMeshes.push(child)
            }
          })
          // 地板反射：只对上面收集到的地面网格叠一层柔和反射
          // shader、反射面尺寸计算、挂载逻辑已统一收进 SceneView，参数见 config.floorReflection
          sceneView.addFloorReflections(groundMeshes)
        }
        if (files.value[url].pos) {
          modal.position.set(...files.value[url].pos);
          modal.scale.set(0.05, 0.05, 0.05);
        }
        if (files.value[url].rot) {
          modal.rotation.set(...files.value[url].rot);
        }
        loadedModal.value++;
    }, (xhr) => {
        files.value[url].total = xhr.total;
        files.value[url].loaded = xhr.loaded
    });
}
// 模型进入视图
const intoView = async () => {
    await sceneView.thingAnimate(sceneView.camera.position, viewPosition, 1200)
}

// 处理模型显示
const handleModal = (modal) => {
  modal.on('dblclick', (g, m, p) => {
    console.log('双击模型:', m, p);
    sceneView.setOutlineObjects(m);
  })
  let planeNames = [
    'b1_diji004_3',
    '3d66-PolyMeshObject-20022528-001', 
    '对象005_4', 
    '对象005_3', 
    '对象005_2',
    'Line001', 
    'Line002', 
    '1号楼', 
    'SM_DiMian_1', 
    '3d66-PolyMeshObject-20022528-006'
  ]
  modal.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      // ★ 移除强制覆盖 metalness/roughness，保留模型原始 PBR 参数
      // 只有当材质缺少 PBR 属性时才做默认值补充
      // if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
      //   // 确保材质启用 envMapIntensity（默认为1，无需显式设）
      //   child.material.envMapIntensity = 0;
      //   child.material.roughness = 0.95;
      //   child.material.metalness = 0.95;
      // }
      // child.material.map = new THREE.TextureLoader().load('/3d/glb/map.jpg');
    }
    if (child.isLight) {
      child.intensity = 0;
    }
    // 水面
    if (child.isMesh && child.name === 'Water_Plane') {
      // 保存原始位置和旋转
      const pos = child.position.clone();
      pos.y = -20;
      // 获取原始平面的尺寸
      const box = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3();
      box.getSize(size);
      // 用高细分的 PlaneGeometry 替代（确保有足够顶点显示波浪）
      const width = size.x / 0.05;
      const height = size.z / 0.05;  // 平面通常旋转后 width 在 x, height 在 z
      const waterGeo = new THREE.PlaneGeometry(width, height, 64, 64);
      waterGeo.computeVertexNormals();

      // 创建水面
      const water = new Water(waterGeo, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load(
          '/3d/textures/waternormals.png',
          (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }
        ),
        sunDirection: new THREE.Vector3(1, 1, 1),
        sunColor: 0xffffff,
        waterColor: 0x004040,
        distortionScale: 1.0,
        alpha: 1.0,
      });
      water.position.copy(pos);
      water.rotateX(-Math.PI/2);
      // 替换原 mesh
      child.parent.add(water);
      child.parent.remove(child);
      waterMesh = water;
    }
    // 阴影 + 菲涅尔边缘发光（保留光照响应）
    if (child.isMesh && planeNames.includes(child.name)) {
      child.receiveShadow = true;
    }
    if (child.isMesh && child.name === '3d66-PolyMeshObject-20022528-006') {
      child.position.y = 2.5
    }
    if (child.isMesh && child.name === 'Plane_(1)') {
      child.visible = false;
    }
    if (child.isMesh && child.name === '边缘') {
      flowMesh = child;
      child.material.alphaMap = child.material.map;
      child.material.alphaTest = 0.05;
    }
    if (child.isMesh && ['T2_1_2', 'T4_1_2'].includes(child.name)) {
      child.material.color.set(0x006000);
    }
    if (child.isMesh && ['Line001', 'Line002', '1号楼'].includes(child.name)) {
      child.material.color.set(0x666666);
    }
    // if (child.isMesh && child.name === 'SM_CardBox_Big_B4') {
    //   sceneView.exportModel(child, 'glb');
    // }
  })
}

// 加载FBX模型
const loadFBX = (url) => {
    sceneView.fbxModelLoader(url, (fbx) => {
        fbx.name = url;
        fbx.scale.set(0.001, 0.001, 0.001);
        console.log(fbx);
        // fbx.traverse((child) => {
        //   if (child.isMesh) {
        //   }
        // })
    
        setTimeout(() => {
          sceneView.exportModel(fbx, 'glb');
        }, 15000);
        sceneView.scene.add(fbx);
    });
};

// 添加楼栋模型
const addBuilding = () => {
  const building = new THREE.Group();
  buildingMat = new THREE.MeshBasicMaterial({ 
    color: 0x41dd9c, 
    transparent: true, 
    opacity: 0.15 
  });
  buildingPos.forEach((pos) => {
    const newBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(...pos.size), 
      buildingMat
    );
    newBuilding.position.set(...pos.pos);
    newBuilding.rotation.set(...pos.rot);
    newBuilding.userData = pos;
    newBuilding.name = pos.name;
    if(pos.name) {
      let text = sceneView.createText({
        element: pos.name,
        className: 'building-name',
        color: '#fff',
        position: {x: pos.pos[0], y: pos.size[1] + 2, z: pos.pos[2]},
      });
      outScene.add(text)
    }
    if(pos.subName) {
      let text = sceneView.createText({
        element: pos.subName,
        className: 'building-name-3d',
        color: 'rgba(255, 255, 255, 0.45)',
        type: '3d',
        position: {x: pos.pos[0], y: pos.size[1], z: pos.pos[2]},
      });
      text.rotateX(-Math.PI/2);
      text.scale.set(0.06, 0.06, 0.06);
      outScene.add(text)
    }
    building.add(newBuilding);
  })
  building.name = 'building-box';
  building.on('hover', (g, m) => {
    document.body.style.cursor = 'pointer';
    sceneView.setOutlineObjects(m);
  }, () => {
    document.body.style.cursor = 'default';
    sceneView.clearOutline();
  })
  building.on('click', (g, m) => {
    intoStorage(m)
  })
  outScene.add(building);
}
// 进入/离开仓库时开关阴影渲染
const setShadowEnabled = (enabled) => {
  if (!sceneView || !sceneView.renderer) return;
  sceneView.renderer.shadowMap.enabled = enabled;
  // 平行光也同步关掉，避免无谓的阴影贴图计算
  if (sceneView.dirLight) {
    sceneView.dirLight.castShadow = enabled;
  }
  // 触发一次阴影贴图更新，保证重新开启时立即生效
  sceneView.renderer.shadowMap.needsUpdate = enabled;
}

// 进入存储场景
const intoStorage = async (storage) => {
  if(isIntoLoading.value || !storage.userData.typeName) {
    return;
  }
  isIntoLoading.value = true;
  originalObj = storage;
  // 加载模型
  storage.userData.typeName.forEach((typeName) => {
    innerScene.getObjectByName(typeName).visible = true;
  })
  // ★ 修复：把两段相机飞行合并为一个多关键帧 chain
  const risePoint  = new THREE.Vector3(storage.position.x, storage.position.y + 20, storage.position.z);
  const finalPoint = new THREE.Vector3(storage.position.x, storage.position.y + 5,  storage.position.z);
  const targetPos  = { x: storage.position.x, y: storage.position.y - 1, z: storage.position.z };

  // ★ Promise.all 显式并行：相机弧线飞行 + controls.target 同步移动
  Promise.all([
    sceneView.thingAnimate(sceneView.camera.position, [risePoint, finalPoint], 800),
    sceneView.thingAnimate(sceneView.controls.target, targetPos, 800)
  ]);

  outScene.traverse((child) => {
    if (child.isCSS2DObject) {
      child.element.style.opacity = 0;
    }
  });
  setTimeout(() => {
    tragetCamera.near = 0.001;
    // 一站式切换：过渡 + 主引用 + 所有 pass 重绑 + GTAO 相机参数 + 拾取场景
    sceneView.switchScene({
        scene: innerScene,
        camera: tragetCamera,
        transition: { type: 4, duration: 1 },
        onComplete: () => {
            // 进入仓库内部：关闭阴影渲染
            setShadowEnabled(false);
            outScene.traverse((child) => {
              if (child.isMesh) {
                child.visible = false;
              }
            })
            isIntoTargetScene.value = true;
            isIntoLoading.value = false;
            // 切换到目标场景
            if(storage.userData.storageRot) {
              storage.userData.typeName.forEach((typeName) => {
                let targetObj = innerScene.getObjectByName(typeName)
                let rot = storage.userData.storageRot
                sceneView.thingAnimate(targetObj.rotation, [{x: rot[0], y: rot[1], z: rot[2]}], 500)
              })
            }
        }
    });
  }, 800)
}
// 切换回原始场景
const switchBack = async () => {
    if(isIntoLoading.value) {
      return;
    }
    isIntoLoading.value = true;
    // 离开仓库：恢复阴影渲染（外层场景需要阴影）
    setShadowEnabled(true);
    // 显示所有模型
    outScene.traverse((child) => {
      if (child.isMesh) {
        child.visible = true;
      }
    })
    sceneView.camera.near = 1;
    sceneView.switchScene({
        scene: outScene,
        camera: sceneView.camera,
        transition: { type: 5, duration: 1 },
        onComplete: () => {
            isIntoTargetScene.value = false;
            isIntoLoading.value = false;
            originalObj.userData.typeName.forEach((typeName) => {
              innerScene.getObjectByName(typeName).visible = false;
            })
            outScene.traverse((child) => {
              if (child.isCSS2DObject) {
                child.element.style.opacity = 1
              }
            })
        }
    });
    if(originalObj.userData.storageRot) {
      originalObj.userData.typeName.forEach((typeName) => {
        let targetObj = innerScene.getObjectByName(typeName)
        let rot = originalObj.userData.storageRot
        sceneView.thingAnimate(targetObj.rotation, [{x: rot[0], y: Math.PI / 2, z: rot[2]}], 500)
      })
    }
    let pos = originalObj.userData.pos
    await sceneView.thingAnimate(sceneView.camera.position, [new THREE.Vector3(pos[0], pos[1] + 15, pos[2])], 800)
    // 计算目标位置
    Promise.all([
      sceneView.thingAnimate(sceneView.camera.position, new THREE.Vector3(0, 50, 1), 1000),
      sceneView.thingAnimate(sceneView.controls.target, new THREE.Vector3(0, 0, 0), 1000)
    ]);
}

// 创建第二场景
const createSecondScene = () => {
  // 1. 创建目标场景
  innerScene = new THREE.Scene();
  innerScene.name = 'innerScene';
  tragetCamera = sceneView.camera;
  // ★ 关键：把 HDR 环境贴图也赋给 innerScene，让 PBR 材质在切换后依然正确
  innerScene.environment = sceneView.scene.environment;
  innerScene.environmentIntensity = sceneLightConfig.indoor.environmentIntensity;
  // HDR 是异步加载的：加载完成后再同步给内景，避免拿到 null
  sceneView.environmentCallback = (envTexture) => {
    if (innerScene) {
      innerScene.environment = envTexture;
      innerScene.environmentIntensity = sceneLightConfig.indoor.environmentIntensity;
    }
  };
  // 添加光源（仓库内部专用）
  let ambientLight = new THREE.AmbientLight(
    sceneLightConfig.indoor.ambient.color,
    sceneLightConfig.indoor.ambient.intensity
  );
  innerScene.add(ambientLight);

  let hemiLight = new THREE.HemisphereLight(
    sceneLightConfig.indoor.hemisphere.skyColor,
    sceneLightConfig.indoor.hemisphere.groundColor,
    sceneLightConfig.indoor.hemisphere.intensity
  );
  innerScene.add(hemiLight);

  let dirLight = new THREE.DirectionalLight(
    sceneLightConfig.directional.color,
    sceneLightConfig.directional.intensity
  );
  dirLight.position.set(
    sceneLightConfig.directional.position.x,
    sceneLightConfig.directional.position.y,
    sceneLightConfig.directional.position.z
  );
  dirLight.target.position.set(
    sceneLightConfig.directional.target.x,
    sceneLightConfig.directional.target.y,
    sceneLightConfig.directional.target.z
  );
  innerScene.add(dirLight);
  innerScene.add(dirLight.target);
}

// 每帧业务逻辑：由 SceneView 的渲染循环统一回调（渲染完成后执行）
const onFrame = () => {
    // 更新水面动画时间
    if (waterMesh) {
      waterMesh.material.uniforms.time.value = performance.now() * 0.0005;
    }
    // 更新流动动画时间
    if (flowMesh && flowMesh.visible) {
      const mat = flowMesh.material;
      mat.map.offset.x += 0.01;
    }
    // 根据相机 Y 坐标控制平行光强度：Y 越大（越高）光越暗
    // 根据相机 Y 坐标控制光照强度和 Bloom
    if (sceneView && sceneView.camera && sceneView.dirLight && !isIntoTargetScene.value) {
      const camY = sceneView.camera.position.y;
      const Y_MIN = 40;
      const Y_MAX = 70;
      // 以仓库外的太阳强度为基准，高空视角时衰减到 10%
      const INTENSITY_MAX = sceneLightConfig.directional.outdoorIntensity;
      const INTENSITY_MIN = sceneLightConfig.directional.outdoorIntensity * 0.55;
      let intensity = INTENSITY_MAX;
      if (camY >= Y_MAX) {
        intensity = INTENSITY_MIN;
        if (sceneView.bloomPass) sceneView.bloomPass.enabled = true;
        if (buildingMat) buildingMat.opacity = 0.15;
        maskShow.value = true;
      } else if (camY > Y_MIN) {
        const t = (camY - Y_MIN) / (Y_MAX - Y_MIN);
        if (flowMesh) flowMesh.visible = true;
        intensity = THREE.MathUtils.lerp(INTENSITY_MAX, INTENSITY_MIN, t);
        if (sceneView.bloomPass) sceneView.bloomPass.enabled = true;
        if (buildingMat) buildingMat.opacity = 0.15;
        maskShow.value = true;
      } else {
        if (flowMesh) flowMesh.visible = false;
        if (sceneView.bloomPass) sceneView.bloomPass.enabled = false;
        if (buildingMat) buildingMat.opacity = 0;
        maskShow.value = false;
      }
      sceneView.dirLight.intensity = intensity;
    }
    if(isIntoTargetScene.value) {
      if (sceneView.bloomPass) sceneView.bloomPass.enabled = true;
    }
}

onMounted(() => {
    sceneView = new SceneView(container.value, {
        mode: '',//development
        environmentIntensity: sceneLightConfig.environmentIntensity,
        ambLight: {
            color: sceneLightConfig.ambient.color,
            intensity: sceneLightConfig.ambient.intensity
        },
        hemiLight: {
            skyColor: sceneLightConfig.hemisphere.skyColor,
            groundColor: sceneLightConfig.hemisphere.groundColor,
            intensity: sceneLightConfig.hemisphere.intensity
        },
        dirLight: {
            color: sceneLightConfig.directional.color,
            intensity: sceneLightConfig.directional.outdoorIntensity,
            position: sceneLightConfig.directional.position,
            target: sceneLightConfig.directional.target,
            // 仓库外保留阴影投影
            castShadow: true
        },
        fog: {
            // 大气散射（空气透视）：FogExp2 按距离平方衰减，近处干净、远处泛雾蓝，
            // 比线性雾更像真实空气，物体会随距离褪色、对比度下降
            enabled: true,
            type: 'FogExp2',
            color: 0xc9d8e6,
            density: 0.0022,
            near: 60,
            far: 420
        },
        quality: {
            // 环境反射拉强一档，材质别像塑料片
            envMapIntensity: 0.75
        },
        postProcessing: {
            // 接触阴影范围放大，物体才有"落地感"
            gtao: { radius: 1.2, blendIntensity: 1.25 },
            // 收掉多余的泛光，压浅暗角，把曝光校到中间调
            bloom: { strength: 0.1 },
            vignette: { darkness: 0.22 },
            output: { toneMappingExposure: 1.02 }
        }
    })
    THREE = sceneView.THREE;
    outScene = sceneView.scene;
    createSecondScene()
    sceneModalGroup = new THREE.Group();
    sceneModalGroup.scale.set(0.05, 0.05, 0.05);
    sceneModalGroup.rotation.y = Math.PI * 1.1;
    sceneModalGroup.position.set(95, 0, -3);
    outScene.add(sceneModalGroup);
    Object.keys(files.value).forEach((url) => {
      loadModel(url)
    })
    // 每帧业务逻辑交给 SceneView 的渲染循环，不再自己维护 requestAnimationFrame
    sceneView.animateCallback = onFrame
    sceneView.start()
})

// 兜底超时处理：防止加载进度一直停留在 0%
setTimeout(() => {
    if (loading.value) {
      loadProgress.value = 100;
      loadedModal.value = Object.keys(files.value).length;
    }
}, 30000)

onUnmounted(() => {
    sceneView.clear()
    // 清理场景对象
    if (innerScene) {
        innerScene.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        innerScene.clear();
    }
    tragetCamera = null;
    sceneModalGroup = null;
})
</script>

<style scoped>
.sence-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.container-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.05);
  transition: all 0.5s ease-in-out;
  opacity: 0;
  &.show {
    opacity: 1;
  }
}

.sence-canvas-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  overflow: hidden;
}

</style>
<style>

.building-name {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  min-width: 50px;
  text-align: center;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 1px;
  white-space: nowrap;
  background: rgba(5, 25, 40, 0.35);
  border: 1px solid rgba(0, 212, 255, 1);
  border-radius: 4px;
  transform: translate(-50%, -100%);
  box-shadow: 0 0 10px inset rgba(0, 212, 255, 0.4);
}
.building-name::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid rgba(0, 212, 255, 0.6);
}

.back-btn {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 10px 20px;
    background: rgba(64, 158, 255, 0.9);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
    transition: all 0.2s ease;
}

.back-btn:hover {
    background: rgba(64, 158, 255, 1);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(64, 158, 255, 0.5);
}

.back-btn:active {
    transform: translateY(0);
}
</style>