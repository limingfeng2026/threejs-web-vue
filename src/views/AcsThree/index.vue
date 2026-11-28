<template>
  <div class="asc-home-three-view" ref="threeWrap">
    <div class="home-view" ref="views"></div>
    <!-- 添加视角切换按钮 -->
    <!-- 视角 / 演示控制区 -->
    <div class="view-buttons-bottom" :class="{ isRoaming }" v-show="!showLoading">
      <div class="view-button">
        <el-button
        v-show="userInfo.trackDetailList && userInfo.trackDetailList.length > 0"
        :type="isRunPath ? 'primary' : ''"
        class="tech-btn"
        @click="runTrajectory"><span class="tech-btn-text">{{!isRunPath ? '轨迹演示':'取消演示'}}</span></el-button>
        <el-button
          v-show="userInfo.trackDetailList && userInfo.trackDetailList.length > 0 && isRunPath"
          :type="isRoaming ? 'primary' : ''"
          class="tech-btn"
          @click="onFollowing"><span class="tech-btn-text">{{!isRoaming ? '开启漫游':'关闭漫游'}}</span></el-button>
      </div>
      <div class="view-button1">
        <div
          v-for="(item, index) in modelCameras"
          :key="item.key"
          class="custom-view-item"
          :class="{ 'active': viewIndex === index }"
          @click="switchToView(index)"
        >
          <!-- 视角座：刻度环 + 核心光点 + 编号 -->
          <div class="view-orb">
            <span class="view-orb-ring"></span>
            <span class="view-orb-core"></span>
            <span class="view-orb-index">{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <div class="room-name-view">
            <span class="room-name">{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- 全局公共加载遮罩 -->
    <SceneLoading
      :visible="showLoading"
      :progress="progress"
      title="门禁三维数字孪生"
      brand="ACS · DIGITAL TWIN"
      status="正在加载门禁场景资源"
      theme="dark"
    />
  </div>
</template>

<script>
  import { markRaw } from 'vue'
  import * as THREE from 'three'
  import SceneView from '@/components/SceneView/index.js'   // 场景统一由组件库装配
  import SceneLoading from '@/components/SceneLoading/index.vue'   // 全局公共加载遮罩
  import TWEEN from '@tweenjs/tween.js'
  import { PathPointList, PathGeometry } from 'three.path'
  let sceneView;   // SceneView 实例：渲染循环 / 控制器 / 文本层都归它管
  let scene;
  let camera;
  let controler;   // = sceneView.controls（MapControls），业务里只做开关与 target
  let mixer; // 动画
  let roofObject; // 存储楼顶对象
  const roofHeight = 40; // 假设楼顶高度为 40，根据实际情况修改
  const roomLineData = {
    "1901.1902": [],
    "1901.1904": [[132,0,-92], [126,0,-7]],
    "1901.1905": [[-141,0,-94], [-143,0,75]],
    "1901.1906": [[123,0,-93], [132,0,-89], [130,0,55]],
    "1901.1907": [[-47,0,-91], [-36,0,-83], [-36,0,34]],
    "1902.1904": [[132,0,-92], [126,0,-7]],
    "1902.1905": [[-140,0,-94],[-140,0,71]],
    "1902.1906": [[122,0,-94], [132,0,-89], [132,0,62]],
    "1902.1907": [[-36,0,-83], [-36,0,54]],
    "1904.1905": [[124,0,57],[-129,0,72]],
    "1904.1906": [[124,0,57]],
    "1904.1907": [[124,0,57],[-0,0,65]],
    "1905.1906": [[-129,0,68],[-126,0,68], [118,0,72]],
    "1905.1907": [[-132,0,66], [-55,0,66]],
    "1906.1907": [[111,0,70], [-36,0,66]]
  };
  const textureLoader = new THREE.TextureLoader();
  const BASE = import.meta.env.BASE_URL   // 站点部署在子目录时，资源路径必须带 base
  const SCENE_GLB_SIZE = 1358912; // scene_opt.glb 字节数，用于加载进度
  const arrowTexture = textureLoader.load(BASE + 'glb/arrow.svg', (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.needsUpdate = true;
  })
  export default {
    name: 'scs-home',
    components: { SceneLoading },
    data() {
      return {
        views: null,
        animateId: null,
        rooms: ['1901', '1902', '1904', '1905', '1906', '1907'], // 用于存储房间对象
        activeDoorIndex: [], // 用于存储当前激活的门的索引
        scenePersons: [],
        trajectoryLine: markRaw(new THREE.Group()), // 用于存储轨迹线
        doorDeviceGroup: markRaw(new THREE.Group()), // 用于存储门设备
        // 用于存储开门动画
        actions: { 
          1901: null,
          1902: null,
          1907: null
        },
        // 用于存储人物移动位置
        personObject: {
          1901: {
            startP: {x: -64, y: 0, z: -95},
            endP: {x: -65, y: 0, z: -140},
            doorDeviceP: {x: -65, y: 19.6, z: -108},
            offset: {x: '-40%', y: 0},
            psersonList: [],
          },
          1902: {
            startP: {x: -27, y: 0, z: -95},
            endP: {x: -25, y: 0, z: -140},
            doorDeviceP: {x: -27, y: 19.6, z: -108},
            offset: {x: '40%', y: 0},
            psersonList: [],
          },
          1904: {
            startP: {x:125, y:0, z:-18},
            endP: {x: 187, y: 0, z: -18},
            doorDeviceP: {x: 141, y: 19.6, z: -20},
            psersonList: [],
          },
          1905: {
            startP: {x: -149, y: 0, z: 72},
            endP: {x: -173, y: 0, z: 73},
            doorDeviceP: {x: -153, y: 19.6, z: 71},
            offset: {x: '-10%', y: 0},
            psersonList: [],
          },
          1906: {
            startP: {x: 132, y: 0, z: 62},
            endP: {x: 172, y: 0, z: 63},
            doorDeviceP: {x: 141, y: 19.6, z: 61},
            psersonList: [],
          },
          1907: {
            startP: {x: -36, y: 0, z: 66},
            endP: {x: -35, y: 0, z: 100},
            doorDeviceP: {x: -36, y: 19.6, z: 79},
            offset: {x: '10%', y: 0},
            psersonList: [],
          }
        },
        // 用于存储房间的门禁闪灯
        flashingSpheres:{
          1901: [],
          1907: []
        },
        viewIndex: 0,
        // 用于存储相机视角
        modelCameras: [
          {
          key: 'defualt',
          name: '俯视图',
          time: 1500,
          position: { x: 0, y: 600, z: 90 },
          target: { x: 0, y: 0, z: 0 }
        },
        { 
          key: '1901',
          name: '1901室',
          time: 1000,
          position: { x: -41.5, y: 8, z: -143 + 60},
          target: {x: -60, y: 10, z: -168 + 60}
        },{ 
          key: '1902',
          name: '1902室',
          time: 1000,
          position: { x: -43, y: 8, z: -138 + 60},
          target: {x: -28, y: 8, z: -168 + 60}
        },{ 
          key: '1904',
          name: '1904室',
          time: 1000,
          position: { x: 123, y: 15, z: -57},
          target: {x: 143, y: 8, z: -20}
        },{ 
          key: '1905',
          name: '1905室',
          time: 1000,
          position: { x: -112, y: 8, z: 69},
          target: {x: -153, y: 8, z: 69}
        },{ 
          key: '1906',
          name: '1906室',
          time: 1000,
          position: {x: 104, y: 8, z: 76},
          target: {x: 141, y: 8, z: 60}
        },{
          key: '1907',
          name: '1907室',
          time: 1000,
          position: { x: -36, y: 10, z: 30},
          target: { x: -36, y: 10, z: 20 + 60}
        }],
        closeTimer: null, // 用于控制是否正在行走
        resetTimer: null, // 用于控制是否正在重置
        closeDelay: 3000, // 门关闭延迟时间，单位为毫秒
        personMan: null,
        personWoman: null,
        cameraOffset: { x: 0, y: 18, z: -16 }, // 相机偏移量
        cameraTargetOffset: { x: 0, y: 10, z: 30 }, // 相机目标点
        // 新增漫游相机相关属性
        isRunPath: false,
        roamingCamera: null,
        isRoaming: false,
        progress: 0, //模型加载进度
        showLoading: false,
        userInfo: {
			"abnormalNum":null,
			"begTime":null,
			"departureTime":null,
			"deptName":"研发部门",
			"endTime":null,
			"normalNum":null,
			"readerCode":"",
			"readerName":"",
			"sex":"1",
			"trackDetailList":[
				{
					"departureTime":null,
					"readerCode":"QAYX-01",
					"readerId":"1551952907281244161",
					"readerName":"1901办公室",
					"visitTime":"2024-12-02 11:27:37",
					"visitorId":"179"
				},
				{
					"departureTime":"2025-04-28 16:21:38",
					"readerCode":"QAYX-02",
					"readerId":"1551953102450597890",
					"readerName":"1907办公室",
					"visitTime":"2024-12-02 10:50:12",
					"visitorId":"179"
				},
				{
					"departureTime":"2025-04-29 14:49:28",
					"readerCode":"QAYX-03",
					"readerId":"1551953362082209793",
					"readerName":"1905办公室",
					"visitTime":"2024-12-02 08:42:22",
					"visitorId":"179"
				},
				{
					"departureTime":"2025-04-29 13:27:33",
					"readerCode":"QAYX-06",
					"readerId":"1598559137922301953",
					"readerName":"1902办公室",
					"visitTime":"2024-12-02 11:24:49",
					"visitorId":"179"
				},
				{
					"departureTime":"2025-04-25 15:44:27",
					"readerCode":"QAYX-07",
					"readerId":"1598559794058248194",
					"readerName":"1906办公室",
					"visitTime":"2024-12-16 15:37:49",
					"visitorId":"179"
				}
			],
			"visitTime":null,
			"visitorId":"",
			"visitorName":"李sir",
			"visitorOrg":"",
			"visitorType":0
		}
      }
    },
    watch: {
      userInfo: {
        handler() {
          // 先清空之前的路径
          this.isRunPath = false;
          this.isRoaming = false;
          this.resetTrajectory();
          this.drawTrajectoryLine()
        },
        deep: true
      } 
    },
    methods: {
      // 场景初始化：统一交给 SceneView 装配（不再页面手写 renderer/scene/controls）
      init() {
        this.views = this.$refs.views
        sceneView = new SceneView(this.views, {
          bgColor: 0xc7ffff,              // 与原页面同色
          environment: false,
          shadowMapEnabled: false,         // 原页面虽开 shadowMap，但材质未开 receiveShadow，无可见阴影，这里保持一致
          fontUrl: '',                    // 本项目不内置 typeface，避免无谓 404
          dracoPath: BASE + '3d/draco/',
          floor: { enabled: false },
          floorReflection: { enabled: false },
          fog: { enabled: false },
          hemiLight: { enabled: false },
          ambLight: { enabled: true, color: 0x404040, intensity: 6 },   // r187 物理光照单位，原 r140 的 2 需放大约 π 倍
          dirLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.6,
            position: { x: -150, y: 850, z: 300 },
            castShadow: false,
            shadowCameraLeft: -512,
            shadowCameraRight: 512,
            shadowCameraTop: -512,
            shadowCameraBottom: 512,
            shadowCameraNear: -512,
            shadowCameraFar: 512,
            shadowCameraMapSize: { width: 2048, height: 2048 },
          },
          control: {
            enabled: true,
            enableDamping: true,
            dampingFactor: 0.8,
            zoomSpeed: 1.5,
            minDistance: 20,
            maxDistance: 1000,
          },
          postProcessing: {
            enabled: false,
            // 原页面是 r140 默认 NoToneMapping，组件默认 ACES 会把灰阶压暗，这里还原
            output: { toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 },
          },
        })
        scene = sceneView.scene
        camera = sceneView.camera
        camera.fov = 45                 // 原页面 45°，组件默认 50°
        camera.updateProjectionMatrix()
        camera.position.copy(this.modelCameras[this.viewIndex].position)
        controler = sceneView.controls

        // 文本层默认 z 100/200，会让标签盖住按钮与加载遮罩，这里压回原页面的 1/2
        if (sceneView.textLayer) {
          sceneView.textLayer.render2d.domElement.style.zIndex = 2
          sceneView.textLayer.render3d.domElement.style.zIndex = 1
        }

        // 原页面第二盏平行光（对称补光），组件只给一盏，这里补上
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
        fillLight.position.set(150, 850, -300)
        scene.add(fillLight)

        // 漫游相机
        this.roamingCamera = markRaw(new THREE.PerspectiveCamera(45, this.views.clientWidth / this.views.clientHeight, 1, 5000))

        // 每帧业务回调交给组件驱动，start() 后自动跑
        sceneView.animateCallback = (delta) => this.animationStep(delta)
        sceneView.start()
      },
      // 创建文本
      createText(model, className, text, position, type='2d', offset) {
        let element = document.createElement('div')
        let style = ''
        if(offset) {
          style = `transform: translate(${offset.x}, ${offset.y});`
        }
        element.innerHTML = `<div class="${className}" style="${style}"><span class="text-element">${text}</span></div>`
        // 文本层统一由 SceneView 的 TextLayer 创建（2d / 3ds / 3d 同款 DOM 结构）
        const cssText = sceneView.createText({
          element: element.firstElementChild,
          type,
          position,
        })
        if (!cssText) return
        if (type === '3ds') cssText.scale.set(0.1, 0.1, 0.1)
        cssText.name = `${text}_label`
        model.add(cssText)
      },
      createPointGeo() {
        for(let key in this.personObject) {
          let { doorDeviceP, offset } = this.personObject[key]
          this.createText(this.doorDeviceGroup, 'point-text', `${key}室 RFID设备`, doorDeviceP, '2d', offset)
        }
        scene.add(this.doorDeviceGroup)
      },
      // 加载 GLB 模型的方法（走 SceneView 的 loaderHub，Draco 已按 dracoPath 配置）
      loadGLBModel(filePath, showLoading) {
        return new Promise((resolve, reject) => {
          sceneView.loadGLB(
            filePath,
            (gltf) => resolve(gltf),
            (xhr) => {
              if (showLoading) {
                this.progress = Math.floor(xhr.loaded / SCENE_GLB_SIZE * 100)
              }
            },
            (error) => {
              console.error('An error happened', error)
              reject(error)
            }
          )
        })
      },
      // 处理房间模型
      handerRooms(gltf) {
        let model = gltf.scene;
        model.position.set(1720, 0, -320);
        model.scale.set(10, 10, 10);
        scene.add(model);
        // 开门动画收集
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          let animationClip = gltf.animations[0]
          let trackObj = { 1901: [], 1907: [] }
          animationClip.tracks.forEach((track) => {
            if(track.name.includes('对象001') || track.name.includes('Rectangle017')) {
              trackObj[1901].push(track)
            }
            if(track.name.includes('youmen') || track.name.includes('zuomen')) {
              trackObj[1907].push(track)
            }
          })
          for(let key in trackObj) {
            const singleTrackClip = new THREE.AnimationClip(
              `${animationClip.name}_track_${key}`, // 新剪辑的名称
              -1, // 持续时间，-1 表示自动计算
              trackObj[key] // 只包含当前 track
            ); 
            // 创建动画动作
            this.actions[key] = markRaw(mixer.clipAction(singleTrackClip));
            // 设置动画不循环
            this.actions[key].setLoop(THREE.LoopOnce);
            this.actions[key].clampWhenFinished = true;
          }
        }

        model.on('click', (g, m, p) => {
          let { x, y, z } = {x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z)};
          console.debug('点击',m, camera.position, JSON.stringify([x,0,z]), { x, y: 0, z });
        });
        // 蓝色玻璃材质
        const glassMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x66a3ff,
          transparent: true,
          depthWrite: false,
          opacity: 0.4,
          roughness: 0.2,
          metalness: 0.0,
          transmission: 0.8,
          ior: 1.8,
          name: 'boli'
        });
        model.traverse((child) => {
          // 查找所有包含 'boli' 的材质并替换为蓝色玻璃材质
          if (child.isMesh) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map((mat) => {
                if (mat.name && mat.name.includes('boli')) {
                  return glassMaterial;
                }
                return mat;
              });
            } else if (child.material.name && child.material.name.includes('boli')) {
              child.material = glassMaterial;
            }
          }
          if (child.name === '1907MEN') {
            child.traverse((itemChild) => {
              if (itemChild.isMesh) {
                itemChild.material = glassMaterial;
              }
            });
          }
            // 找到名称为 diantikousuoyoushuzi 设置为金属材质
          if (child.isMesh && (child.name.includes('文本') || child.name.includes('Text'))) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xeeeeee, // 白色,
              roughness: 0.3, // 粗糙度
              metalness: 0.6 // 金属度
            });
          }
          // 收集需要闪烁的球体
          if (child.name.includes('检验机')) {
            let key = child.name == '检验机'? '1901' : '1907'
            child.children.forEach((itemChild) => {
              if (itemChild.isMesh && itemChild.name.includes('Sphere')) {
                // 保存需要闪烁的球体
                this.flashingSpheres[key].push(markRaw(itemChild));
                // 初始化材质
                itemChild.material = new THREE.MeshBasicMaterial({
                  color: 0xff0000,
                  transparent: true,
                  depthWrite: false, // 关闭深度写入
                  opacity: 0.8 // 初始透明度设为 1
                });
                itemChild.material.color.multiplyScalar(0.1);
                // 为球体创建点光源
                const pointLight = new THREE.PointLight(0xff0000, 0, 10); // 颜色、初始强度、距离
                // 创建一个临时的 Vector3 对象来存储世界位置
                const worldPosition = new THREE.Vector3();
                // 获取小球在世界坐标系中的位置
                itemChild.getWorldPosition(worldPosition);
                // 设置点光源的位置为小球的世界位置
                pointLight.position.copy(worldPosition); 
                pointLight.position.y -= 0.1; 
                itemChild.add(pointLight); // 将光源添加到球体上
                scene.add(pointLight); // 将光源添加到场景中
                // 保存光源到球体对象上，方便后续访问
                itemChild.pointLight = pointLight;
              }
            });
          }
          // 查找楼顶对象，根据实际模型中楼顶的名称修改
          if (child.name === 'louban') { // 假设楼顶对象名称为 'Roof'
            roofObject = child;
          }
          if(child.name === 'beijingqiang') { // 假设门对象名称为 'Door'
            child.visible = false
          }
        });
        console.log(model)
      },
      // 处理男性人物模型
      handerPersonMan(gltf) {
        let model = gltf.scene
        model.position.set(0, 7, 0);
        model.scale.set(6.6, 6.6, 6.6);
        model.rotation.set(0, -Math.PI / 2, 0);
        let group = new THREE.Group();
        group.add(model);
         // 过滤掉位置轨道，使人物原地动画
        if (gltf.animations && gltf.animations.length > 0) {
          const animations = gltf.animations.map(animation => {
            const newTracks = animation.tracks.filter(track => {
              return !track.name.endsWith('.position'); 
            });
            return new THREE.AnimationClip(animation.name, animation.duration, newTracks);
          });
          group.animations = animations;
        }
        this.personMan = markRaw(group)
      },
      // 处理女男性人物模型
      handerPersonWoman(gltf) {
        let model = gltf.scene
        model.position.set(0, 1.2, 0);
        model.scale.set(7, 7, 7);
        let group = new THREE.Group();
        group.animations = gltf.animations;
        group.add(model);
        this.personWoman = markRaw(group)
      },
      // 场景自适应（画布 / 文本层尺寸都由组件统一处理）
      resizeView() {
        if (!sceneView) return
        sceneView.resizeView()
        const w = this.views.clientWidth
        const h = this.views.clientHeight
        if (this.roamingCamera && h > 0) {
          this.roamingCamera.aspect = w / h
          this.roamingCamera.updateProjectionMatrix()
        }
      },
      // 场景销毁
      sceneClear() {
        window.removeEventListener('resize', this.resizeView)
        this.personMan = null
        this.personWoman = null
        this.activeDoorIndex = []
        this.actions = {}
        if (this.closeTimer) clearTimeout(this.closeTimer)
        if (this.resetTimer) clearTimeout(this.resetTimer)
        if (sceneView) {
          sceneView.animateCallback = null
          sceneView.clear()
          sceneView = null
        }
        scene = null
        camera = null
        controler = null
      },
      // tween动画
      thingAnimate(start, end, duration) {
        let d = duration;
        if(!duration) {
          d = start.distanceTo(end)
          d = Math.floor(d)*2.5
          d = d < 1500 ? 1500 : d
          d = d < 800 ? 800 : d
        }
        // v25 的 Tween(object, group) 必须显式加入组（true = 主组），否则 TWEEN.update 永不推进
        let tween = new TWEEN.Tween(start, true)
            .to(end, d)
            .easing(TWEEN.Easing.Cubic.Out)
            .repeat(0)
            .start()
            console.log(start)
        return new Promise((resolve) => {
          tween.onComplete(() => {
            resolve(tween) 
          })
        })
      },
      // 门禁闪烁
      onFlashLight(state) {
        const time = Date.now() * 0.001; // 获取当前时间
        let lightSperes = []
        this.activeDoorIndex.forEach((key) => {
          // 闪灯条件是门开了，还有人员在门附近
          if(this.personObject[key].psersonList.length > 0){
            lightSperes = lightSperes.concat(this.flashingSpheres[key])
          }
        })
        lightSperes.forEach((sphere) => {
          const newOpacity = state == 1 ? Math.abs(Math.sin(time)) : 1; // 使用正弦函数计算透明度
          sphere.material.opacity = newOpacity;
          if (state !== 1) {
            // 降低颜色强度
            sphere.material.color.multiplyScalar(0.1);
          } else {
            // 恢复原始颜色
            sphere.material.color.setHex(0xff0000); 
          }
          sphere.material.needsUpdate = true; // 标记材质需要更新
          // 动态调整灯光强度
          if (sphere.pointLight) {
            sphere.pointLight.intensity = state == 1 ?  newOpacity * 2 : 0; // 调整灯光强度
          }
        });
      },
      // 打开门，key为门的索引
      openDoor(key) {
        if(this.actions[key]) {
          if(!this.activeDoorIndex.includes(key)) this.activeDoorIndex.push(key);
            const roomAction = this.actions[key];
            // 开门动画时间
            const clipDuration = roomAction.getClip().duration;
            const delayDuration = this.closeDelay; // 延迟时间
            // 关门
            if (roomAction && roomAction.time == 0) {
              roomAction.timeScale = 1;
              roomAction.reset();
              roomAction.play();
              this.closeTimer = setTimeout(() => {
                this.closeDoor(key)
              }, clipDuration * 1000 + delayDuration);
            }else if(roomAction.time == 4){
              //门已打开，等待关门
              if(this.closeTimer) clearTimeout(this.closeTimer)
              this.closeTimer = setTimeout(() => {
                this.closeDoor(key)
              }, delayDuration);
            }else if(roomAction.timeScale === -1) {
              // 门正在关闭，来人重新打开
              roomAction.timeScale = 1;
              const remainingTime = clipDuration - roomAction.time;
              if(this.closeTimer) {
                clearTimeout(this.closeTimer)
                clearTimeout(this.resetTimer)
                this.resetTimer = null
              }
              this.closeTimer = setTimeout(() => {
                this.closeDoor(key)
              }, delayDuration + remainingTime * 1000);
            }
        }
      },
      // 关门重置参数
      closeDoor(key) {
        const roomAction = this.actions[key];
        const clipDuration = roomAction.getClip().duration;
        roomAction.reset();
        roomAction.timeScale = -1; // 设置时间缩放为负数，实现反向播放
        roomAction.time = clipDuration;
        roomAction.play();
        if (roomAction && roomAction.time == clipDuration) {
          roomAction.reset();
          roomAction.timeScale = -1; // 设置时间缩放为负数，实现反向播放
          roomAction.time = clipDuration;
          roomAction.play();
          this.resetTimer = setTimeout(() => {
            roomAction.timeScale = 1;
            roomAction.time = 0;
            this.activeDoorIndex.splice(this.activeDoorIndex.findIndex(val => val == key), 1);
          }, clipDuration * 1000);
        }
      },
      // 运行轨迹动画
      async runTrajectory() {
        this.isRunPath = !this.isRunPath;
        if(!this.isRunPath) {
          this.isRoaming = false;
          controler.enabled = true
          this.resetTrajectory()
          this.drawTrajectoryLine()
          return
        }
        this.resetTrajectory()
        let sex = this.userInfo.sex === 'man' ? 'man' : 'woman'   // 归一化：'1' 等旧字段值按女模（与原 person 选择逻辑一致）
        let person = sex == 'man' ? this.personMan : this.personWoman
        // 克隆材质并设置可透明
        person.traverse((child) => {
          if (child.isMesh) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map((mat) => {
                const clonedMat = mat.clone();
                clonedMat.transparent = true;
                clonedMat.depthWrite = true;
                return clonedMat;
              });
            } else {
              const clonedMat = child.material.clone();
              clonedMat.transparent = true;
              clonedMat.depthWrite = true;
              child.material = clonedMat;
            }
          }
        });
        this.scenePersons.push(markRaw(person))
        // 为每个克隆人物创建独立的动画混合器
        const personMixer = new THREE.AnimationMixer(person);
        let personWalkAction;
        if (person.animations && person.animations.length > 0) {
          let animationClip = person.animations[0].clone(true);
          // 创建动画动作
          personWalkAction = personMixer.clipAction(animationClip);
          // 设置循环播放
          personWalkAction.setLoop(THREE.LoopRepeat);
        }
        this.createText(person, `asc-${sex}-name`, this.userInfo.visitorName, {x: 0, y: 52, z: 0});
        person.name = this.userInfo.visitorName
        scene.add(person);
        person.mixer = personMixer;
        person.personWalkAction = personWalkAction
        if(personWalkAction) {
          personWalkAction.reset();
          personWalkAction.play();
        }
        this.runPathAnimation(person);
        await this.switchToView(0)
      },
      // 相机跟随
      onFollowing() {
        this.isRoaming = !this.isRoaming; 
        // 根据相机跟随状态设置控制器是否可用
        if (controler) {
          controler.enabled = !this.isRoaming;
        }
        if(!this.isRoaming) {
          this.switchToView(0)
        }
      },
      // 重置轨迹
      resetTrajectory() {
        TWEEN.removeAll()
        // 清空人物
        this.scenePersons.forEach((person) => {
          if (person.mixer) {
            person.mixer.stopAllAction();
          }
          const nameLabel = person.getObjectByName(`${person.name}_label`);
          if (nameLabel) {
            person.remove(nameLabel);
          }
          scene.remove(person);
        });
        this.scenePersons = [];
        // 清空轨迹
        scene.remove(this.trajectoryLine);
        this.trajectoryLine.children = [];
        this.trajectoryLine = markRaw(new THREE.Group());
        scene.add(this.trajectoryLine)
        // 清空闪烁
        for (let key in this.personObject) {
          if(this.personObject[key].psersonList.length == 1) {
            this.personObject[key].psersonList = []
          }
        }
        // 关闭闪灯
        this.onFlashLight(0);
        controler.enabled = true
      },
      // 人物路径
      async runPathAnimation(person) {
        let duration = 2000;
        let path = this.getMovePath()
        for (let i = 0; i < path.length; i++) {
          const item = path[i];
          const nextItem = path[i + 1];
          let currentItem = this.personObject[item.key];
          if (i === 0) {
            currentItem.psersonList.push(markRaw(person));
            console.debug(`开始从房间${item.key}进入`)
            this.$emit('enterRoom', item)
            this.openDoor(item.key)
            this.createRoomPaths(null,item.key)
            await this.moveLineToPerson(person, item.start, item.end, duration)
            console.debug(`开始从房间${item.key}出来`)
            this.greyLastPath()
            this.createRoomPaths(item.key, nextItem.key)
            this.fadeOutCharacter(duration, person, true)
            this.openDoor(item.key)
            await this.moveLineToPerson(person, item.end, item.start)
            this.onFlashLight(0)
            currentItem.psersonList = []
          } else {
            const prevItem = path[i - 1];
            const prevRoomKey = prevItem.key;
            const currentRoomKey = item.key;
            const keyAB = `${prevRoomKey}.${currentRoomKey}`;
            const keyBA = `${currentRoomKey}.${prevRoomKey}`;
            let intermediatePoints = [];
            if (roomLineData[keyAB]) {
              intermediatePoints = roomLineData[keyAB];
            } else if (roomLineData[keyBA]) {
              intermediatePoints = [...roomLineData[keyBA]].reverse();
            }
            const prevEnd = this.personObject[prevItem.key].startP;
            console.debug(`从房间${prevItem.key}到房间${item.key}`)
            //开始从上一个房间走到当前房间
            let lastPosition = prevEnd;
            for (const point of intermediatePoints) {
              const targetPoint = new THREE.Vector3(point[0], point[1], point[2]);
              await this.moveLineToPerson(person, lastPosition, targetPoint);
              lastPosition = targetPoint;
            }
            await this.moveLineToPerson(person, lastPosition, item.start)
            console.debug(`到达房间${item.key}房间门口`)
            currentItem.psersonList.push(markRaw(person));
            this.$emit('enterRoom', item)
            //开始进入房间
            this.openDoor(item.key)
            await this.moveLineToPerson(person, item.start, item.end, duration)
            console.debug(`进入到房间${item.key}完成`)
            //开始从房间出来
            this.openDoor(item.key)
            this.greyLastPath()
            if(nextItem) {
              this.createRoomPaths(item.key, nextItem.key)
            }
            if(i !== path.length - 1 || item.departureTime) {
              if(i == path.length - 1) this.createRoomPaths(item.key)
              this.fadeOutCharacter(duration, person, true)
              await this.moveLineToPerson(person, item.end, item.start)
              console.debug(`从房间${item.key}出来`)
            }
            // 演示结束, 重置
            if(i == path.length - 1) {
              this.isRunPath = false
              this.isRoaming = false
              this.resetTrajectory()
              this.drawTrajectoryLine()
            }
            this.onFlashLight(0)
            currentItem.psersonList = [];
          }
        }
      },
      // 获取移动路径
      getMovePath() {
        let path = [], isStart = true
        let trackDetailList = JSON.parse(JSON.stringify(this.userInfo.trackDetailList || []))
        trackDetailList.forEach(item => {
          let roomCode = parseInt(item.readerName)
          // if(roomCode != 1901 && roomCode != 1907) return
          path.push({
            ...item,
            key: roomCode,
            isStart,
            start: this.personObject[roomCode].startP,
            end: this.personObject[roomCode].endP
          })
          isStart = false
        })
        return path
      },
      // 绘制轨迹线
      drawTrajectoryLine() {
        const paths = this.getMovePath();
        for (let i = 0; i < paths.length - 1; i++) {
          const startKey = paths[i].key;
          const endKey = paths[i + 1].key;
          this.createRoomPaths(startKey, endKey);
        }
      },
      // 轨迹线变灰色
      greyLastPath() {
        let index = this.trajectoryLine.children.length - 1;
        let line = this.trajectoryLine.children[index]
        this.thingAnimate(line.material.color, new THREE.Color(0x808080), 500)
      },
      // 创建房间路径线
      createRoomPaths(startKey, endKey) {
        let len = this.trajectoryLine.children.length;
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ee00 || new THREE.Color('#45e6e2'),
          map: arrowTexture,
          transparent: true,
          opacity: 1,
          depthWrite: false
        });
        const points = [];
        const tanslateY = 1.8 + len * 0.3;
        if(startKey && endKey) {
          let key = `${startKey}.${endKey}`;
          const roomLine = roomLineData[key] || [...roomLineData[`${endKey}.${startKey}`]].reverse();
          const roomA = this.personObject[startKey];
          const roomB = this.personObject[endKey];
          points.push(new THREE.Vector3(roomA.endP.x, roomA.endP.y + tanslateY, roomA.endP.z));
          points.push(new THREE.Vector3(roomA.startP.x, roomA.startP.y + tanslateY, roomA.startP.z));
          roomLine.forEach((point) => {
            points.push(new THREE.Vector3(point[0], point[1] + tanslateY, point[2]));
          })
          points.push(new THREE.Vector3(roomB.startP.x, roomB.startP.y + tanslateY, roomB.startP.z));
          points.push(new THREE.Vector3(roomB.endP.x, roomB.endP.y + tanslateY, roomB.endP.z));
        }else if(startKey) {
          const roomA = this.personObject[startKey];
          points.push(new THREE.Vector3(roomA.endP.x, roomA.endP.y + tanslateY, roomA.endP.z));
          points.push(new THREE.Vector3(roomA.startP.x, roomA.startP.y + tanslateY, roomA.startP.z));
        }else if(endKey) {
          const roomB = this.personObject[endKey];
          points.push(new THREE.Vector3(roomB.startP.x, roomB.startP.y + tanslateY, roomB.startP.z));
          points.push(new THREE.Vector3(roomB.endP.x, roomB.endP.y + tanslateY, roomB.endP.z));
        }
        // 使用 three.path 创建路径
        let pathPointList = new PathPointList()
        pathPointList.set(points, 1, 10, new THREE.Vector3(0,1,0), false)
        let geometry = new PathGeometry()
        geometry.update(pathPointList, {
          width: 6,
          arrow: false
        })
        const line = new THREE.Mesh(geometry, material);
      
        line.name = `line_${startKey}`;
        this.trajectoryLine.add(line)
      },
      // 人物移动设置
      moveLineToPerson(person, start, end, duration) {
        return new Promise((resolve) => {
          const targetPosition = new THREE.Vector3(end.x, end.y, end.z) ;
          const startPosition = new THREE.Vector3(start.x, start.y, start.z);
          person.position.copy(startPosition)   // three r150+ 中 position 为只读访问器，需 copy
          const speed = 0.008; 
          const distance = startPosition.distanceTo(targetPosition);
          const moveDuration = distance / speed;

          const direction = new THREE.Vector3().subVectors(targetPosition, startPosition).normalize();
          // 计算目标旋转角度，考虑人物默认朝向 Z 轴正方向
          let targetRotationY = Math.atan2(direction.x, direction.z);
          // 将弧度差转换为角度
          const angleDifference = (person.rotation.y - targetRotationY)
          if(Math.abs(angleDifference) > Math.PI) {
            let unit = angleDifference > 0 ? -1 : 1;
            targetRotationY -= unit * (Math.PI * 2); // 小角度旋转
          }
          // 根据旋转角度动态计算旋转时间，这里设置每弧度旋转时间为 500 毫秒
          let rotationTime = Math.floor(Math.abs(angleDifference) * 500);
          if(Math.abs(angleDifference) ==  Math.PI) {
            rotationTime = 0
          }
          // 使用 TWEEN 动画让人物旋转
          new TWEEN.Tween(person.rotation, true)
            .to({ y: targetRotationY }, rotationTime) //人物旋转动画
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
          // 使用 TWEEN 动画让人物移动，并在移动过程中更新人物朝向
          new TWEEN.Tween(person.position, true)
            .to(targetPosition, moveDuration)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(() => {
                // 更新漫游相机的位置和朝向
                if (this.isRoaming) {
                  let { y, z } = this.cameraOffset;
                  // 获取人物当前朝向的向量
                  const personDirection = new THREE.Vector3();
                  person.getWorldDirection(personDirection);
                  // 计算相机的偏移向量，让相机在人物背后偏移 -30
                  const offsetVector = personDirection.clone().multiplyScalar(z);
                  // 设置相机的位置，在人物位置基础上加上偏移向量，同时在 y 轴上做一定偏移
                  this.roamingCamera.position.copy(person.position).add(offsetVector);
                  this.roamingCamera.position.y += y; // 保持 y 轴的偏移

                  // 计算人物当前朝向的向量
                  const lookAtDirection = new THREE.Vector3();
                  person.getWorldDirection(lookAtDirection);
                  // 沿着人物朝向的向量延伸 x 个单位
                  let lookAtPoint = new THREE.Vector3();
                  lookAtPoint.copy(person.position).add(lookAtDirection.multiplyScalar(this.cameraTargetOffset.z));
                  lookAtPoint.y = this.cameraTargetOffset.y;
                  // 让漫游相机看向计算出的目标点
                  this.roamingCamera.lookAt(lookAtPoint);
                }
            })
            .onComplete(() => {
              resolve()
            })
            .start();
          if(duration) {
            setTimeout(() => {
              this.fadeOutCharacter(duration, person, false)
            }, moveDuration - duration);
          }
       })
      },
      // 人物消失动画
      fadeOutCharacter(fadeDuration, person, show) {
        const initialOpacity = show ? 0 : 1;
        const finalOpacity = show ? 1 : 0;
        // 遍历人物的所有网格并创建透明度动画
        person.traverse((child) => {
          if (child.isMesh || child.isCSS2DObject) {
            new TWEEN.Tween({ opacity: initialOpacity }, true)
              .to({ opacity: finalOpacity }, fadeDuration)
              .onUpdate(({ opacity }) => {
                if(child.material ||  child.element) {
                  if (child.isMesh) {
                    child.material.opacity = opacity; 
                  }else{
                    child.element.style.opacity = opacity;
                  }
                }
              })
              .start();
          }
        });
      },
      // 视角切换
      async switchToView(index) {
          if(this.viewIndex == index) return
          this.viewIndex = index
          const viewCamera = this.modelCameras[index];
          controler.target.copy(viewCamera.target);
          if(index != 0) {
            camera.position.copy({x: this.modelCameras[0].position.x, y: this.modelCameras[0].position.y, z: this.modelCameras[0].position.z});
          }
          await this.thingAnimate(camera.position, viewCamera.position, 2500)
      },
      // 根据相机高度控制楼顶显示和隐藏
      async onChangeByDistance(renderCamera) {
        let textPostion = (renderCamera.position.y > roofHeight + 32) ? 52 : 14;
        let roomTopShow = renderCamera.position.y < roofHeight 
        this.scenePersons.forEach(person => {
          const nameLabel = person.getObjectByName(`${person.name}_label`);
          nameLabel.position.y = textPostion;
        })
        if(roofObject) {
          // 显示楼顶时加上延迟，解决进入时闪烁
          if(!roofObject.visible) await new Promise((resolve) => { setTimeout(() => resolve(), 100)})
          roofObject.visible = roomTopShow
        }
        // 根据相机高度显示或隐藏精灵材质和 CSS2DObject
        this.doorDeviceGroup.children.forEach(child => {
          if (child.isSprite) {
            child.visible = renderCamera.position.y < roofHeight;
          } else if (child.isCSS2DObject) {
            child.visible = renderCamera.position.y >= roofHeight;
          }
        });
      },
      // 使用精灵材质设置门禁文本信息
      createDoorTextWithSprite() {
        for (let key in this.personObject) {
          const { doorDeviceP } = this.personObject[key];
          const text = `${key}室 RFID设备`;
          const sprite = this.createTextSprite(text);
          sprite.position.copy(doorDeviceP);
          // 将精灵添加到门设备组
          this.doorDeviceGroup.add(sprite); 
        }
        // 将门设备组添加到场景
        scene.add(this.doorDeviceGroup); 
      },
      // 创建文本精灵
      createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // 获取设备像素比
        const dpr = window.devicePixelRatio || 1;
        // 设置字体样式
        const fontSize = 30; 
        context.font = `${fontSize}px Arial`;
        // 测量文本宽度
        const metrics = context.measureText(text); 
        const textWidth = metrics.width;

        // 定义圆圈半径和间距
        const circleRadius = 8;
        const circleTextSpacing = 8;
        const horizontalPadding = 10;
        const verticalPadding = 10;
        const borderRadius = 6; // 圆角半径

        // 计算原始画布尺寸
        const originalWidth = textWidth + circleRadius * 2 + circleTextSpacing + horizontalPadding * 2;
        const originalHeight = fontSize + verticalPadding * 2;

        // 根据设备像素比设置画布尺寸
        canvas.width = originalWidth * dpr;
        canvas.height = originalHeight * dpr;
        // 通过 CSS 设置画布显示尺寸
        canvas.style.width = `${originalWidth}px`;
        canvas.style.height = `${originalHeight}px`;

        // 缩放上下文以匹配设备像素比
        context.scale(dpr, dpr);

        // 创建从下到上的渐变背景
        const gradient = context.createLinearGradient(0, originalHeight, 0, 0);
        gradient.addColorStop(0, '#10e9e6'); // 底部颜色
        gradient.addColorStop(1, 'transparent'); // 顶部颜色

        // 绘制带圆角的背景
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(borderRadius, 0);
        context.lineTo(originalWidth - borderRadius, 0);
        context.quadraticCurveTo(originalWidth, 0, originalWidth, borderRadius);
        context.lineTo(originalWidth, originalHeight - borderRadius);
        context.quadraticCurveTo(originalWidth, originalHeight, originalWidth - borderRadius, originalHeight);
        context.lineTo(borderRadius, originalHeight);
        context.quadraticCurveTo(0, originalHeight, 0, originalHeight - borderRadius);
        context.lineTo(0, borderRadius);
        context.quadraticCurveTo(0, 0, borderRadius, 0);
        context.closePath();
        context.fill();

        // 绘制红色圆圈
        context.fillStyle = 'red';
        const circleX = horizontalPadding + circleRadius;
        const circleY = originalHeight / 2;
        context.beginPath();
        context.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        context.fill();

        // 重新设置字体样式
        context.font = `${fontSize}px Arial`; 
        
        // 添加 text-shadow 效果
        const shadowOffsetX = 2;
        const shadowOffsetY = 2;
        const shadowBlur = 4;
        const shadowColor = 'rgba(0, 0, 0, 1)';
        
        context.shadowOffsetX = shadowOffsetX;
        context.shadowOffsetY = shadowOffsetY;
        context.shadowBlur = shadowBlur;
        context.shadowColor = shadowColor;

        context.fillStyle = 'rgba(255, 255, 255, 1.0)';
        // 绘制文本
        const textX = circleX + circleRadius + circleTextSpacing;
        const textY = circleY + fontSize / 3;
        context.fillText(text, textX, textY); 

        // 重置阴影设置
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;
        context.shadowColor = 'rgba(0, 0, 0, 0)';

        // 创建纹理
        const texture = new THREE.Texture(canvas);
        // 设置纹理过滤模式
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        // 禁用 mipmap 生成
        texture.generateMipmaps = false; 
        texture.needsUpdate = true;

        // 创建精灵材质
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false 
        });

        // 创建精灵对象
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.visible = false;
        // 定义距离阈值，可根据实际情况调整
        const distanceThreshold = 50; 
        // 添加更新缩放的方法
        sprite.updateScale = (camera) => {
          const distance = camera.position.distanceTo(sprite.position);
          // 根据距离设置深度检测
          if (distance < distanceThreshold) {
            sprite.material.depthTest = false;
          } else {
            sprite.material.depthTest = true;
          }
          // 根据距离计算缩放比例，可根据实际情况调整系数
          sprite.scale.set(originalWidth * 0.03, originalHeight * 0.03, 1);
        };
        // 初始缩放
        sprite.updateScale(camera);

        return sprite;
      },
      // 每帧业务逻辑（由 SceneView.animateCallback 驱动，渲染本身由组件完成）
      animationStep(delta) {
        // 漫游时把组件相机切到漫游相机，让渲染与文本层都跟着走
        const renderCamera = this.isRoaming ? this.roamingCamera : camera
        if (sceneView.camera !== renderCamera) sceneView.camera = renderCamera

        // 更新动画混合器
        if (mixer) {
          mixer.update(delta)
        }
        // 更新每个克隆人物的动画混合器
        this.scenePersons.forEach(person => {
          if (person.mixer) {
            person.mixer.update(delta)
          }
        })
        if (arrowTexture) {
          arrowTexture.offset.x -= 0.03
        }
        // 实现闪烁效果
        this.onFlashLight(1)
        // 检查相机高度并控制楼顶显示和隐藏
        this.onChangeByDistance(renderCamera)
        // 更新所有 Sprite 的缩放
        this.doorDeviceGroup.children.forEach(child => {
          if (child.isSprite && child.updateScale) {
            child.updateScale(renderCamera)
          }
        })
      }
    },
    async mounted() {
      this.init()
      this.$nextTick(() => this.resizeView())
      // 调用加载 GLB 模型的方法，替换为实际的文件路径
      this.showLoading = true
      this.loadGLBModel(BASE + 'glb/scene/scene_opt.glb', true).then((gltf) => {
        setTimeout(() => {
          this.handerRooms(gltf)
          this.createPointGeo()
          // 使用精灵材质设置门禁文本信息
          this.createDoorTextWithSprite(); 
          // 先清空之前的路径
          this.isRunPath = false;
          this.isRoaming = false;
          this.resetTrajectory();
          this.drawTrajectoryLine()

          this.resizeView()   // 容器布局完成后校正画布尺寸
          this.showLoading = false
        }, 300)
      }) 
      // 加载女人物模型
      this.loadGLBModel(BASE + 'glb/woman.glb').then((gltf) => {
        this.handerPersonWoman(gltf)
      })
      // 加载男性人物模型
      this.loadGLBModel(BASE + 'glb/man.glb').then((gltf) => {
        this.handerPersonMan(gltf) 
      })
      window.addEventListener('resize', this.resizeView)
    },
    beforeUnmount() {
      this.sceneClear()
    }
  }
</script>

<style lang="scss" scoped>
.asc-home-three-view {
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  position: relative;
  background: #C7FFFF;
  border: none;
  .home-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  .view-buttons {
    position: absolute;
    top: 32px;
    right: 40px;
    z-index: 10;
    width: 120px;
    height: 40px;
    line-height: 40px;
    cursor: pointer;
  }
  .view-buttons-bottom {
    width: 100%;
    position: absolute;
    left: 0;
    bottom: 0;
    z-index: 9;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 14px 0 12px;
    background: linear-gradient(to top, rgba(3, 10, 18, 0.72) 0%, rgba(3, 10, 18, 0.22) 62%, transparent 100%);
    transition: 0.8s ease-in;
    transform: translateY(0);
    &::before {
      content: '';
      position: absolute;
      left: 12%;
      right: 12%;
      top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(79, 209, 255, 0.55), rgba(124, 247, 196, 0.4), rgba(79, 209, 255, 0.55), transparent);
    }
    &.isRoaming {
      transform: translateY(54px);
      transition: 0.8s ease-out;
    }
    .view-button {
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
    }
    // 切角科技按钮：深空底 + 青色细边 + 扫光 + 内发光
    ::v-deep .tech-btn.el-button {
      position: relative;
      overflow: hidden;
      width: 112px;
      height: 34px;
      margin: 0;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #cfeaff;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 2px;
      background: linear-gradient(180deg, rgba(10, 32, 50, 0.94) 0%, rgba(5, 15, 26, 0.94) 100%);
      border: 1px solid rgba(79, 209, 255, 0.34);
      border-radius: 2px;
      clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
      box-shadow: inset 0 0 12px rgba(79, 209, 255, 0.12), 0 6px 16px rgba(0, 0, 0, 0.42);
      transition: color 0.25s, border-color 0.25s, box-shadow 0.25s;
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(79, 209, 255, 0.9), transparent);
        opacity: 0.7;
      }
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: -65%;
        width: 42%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(124, 247, 196, 0.32), transparent);
        transform: skewX(-20deg);
        animation: techSweep 3.6s ease-in-out infinite;
      }
      &:hover {
        color: #eafcff;
        border-color: rgba(124, 247, 196, 0.6);
        background: linear-gradient(180deg, rgba(14, 44, 64, 0.96) 0%, rgba(6, 20, 32, 0.96) 100%);
        box-shadow: inset 0 0 16px rgba(79, 209, 255, 0.24), 0 0 18px rgba(79, 209, 255, 0.3);
      }
      &.el-button--primary {
        color: #eafff7;
        border-color: rgba(124, 247, 196, 0.72);
        background: linear-gradient(180deg, rgba(10, 52, 50, 0.96) 0%, rgba(6, 24, 28, 0.96) 100%);
        box-shadow: inset 0 0 16px rgba(124, 247, 196, 0.22), 0 0 18px rgba(124, 247, 196, 0.35);
        &:hover {
          background: linear-gradient(180deg, rgba(12, 64, 60, 0.97) 0%, rgba(7, 30, 34, 0.97) 100%);
          box-shadow: inset 0 0 18px rgba(124, 247, 196, 0.3), 0 0 22px rgba(124, 247, 196, 0.45);
        }
      }
      .tech-btn-text {
        position: relative;
        z-index: 2;
      }
    }
    .view-button1 {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: center;
      gap: 18px;
      padding: 0 12px;
      pointer-events: none;
      .custom-view-item {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        transition: transform 0.25s ease;
        &:hover {
          transform: translateY(-3px);
        }
        &.active {
          .view-orb {
            border-color: rgba(124, 247, 196, 0.85);
            box-shadow: inset 0 0 20px rgba(124, 247, 196, 0.35), 0 0 24px rgba(124, 247, 196, 0.45);
            animation: orbPulse 1.8s ease-in-out infinite;
          }
          .view-orb-ring {
            border-color: rgba(124, 247, 196, 0.5);
          }
          .view-orb-index {
            color: #eafff7;
            text-shadow: 0 0 12px rgba(124, 247, 196, 0.8);
          }
          .room-name {
            color: #d8fff2;
            border-color: rgba(124, 247, 196, 0.6);
            box-shadow: 0 0 14px rgba(124, 247, 196, 0.28);
          }
        }
      }
      // 视角座：环形刻度 + 核心光点 + 编号
      .view-orb {
        position: relative;
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 42%, rgba(22, 72, 102, 0.95) 0%, rgba(5, 16, 26, 0.96) 72%);
        border: 1px solid rgba(79, 209, 255, 0.3);
        box-shadow: inset 0 0 14px rgba(79, 209, 255, 0.16), 0 8px 18px rgba(0, 0, 0, 0.4);
        transition: border-color 0.25s, box-shadow 0.25s;
      }
      .view-orb-ring {
        position: absolute;
        inset: 4px;
        border-radius: 50%;
        border: 1px dashed rgba(79, 209, 255, 0.28);
        animation: orbSpin 14s linear infinite;
      }
      .view-orb-core {
        position: absolute;
        inset: 14px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(79, 209, 255, 0.4) 0%, rgba(79, 209, 255, 0) 70%);
      }
      .view-orb-index {
        position: relative;
        z-index: 2;
        font-family: ui-monospace, 'DIN Alternate', Menlo, Consolas, monospace;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #8fd8ff;
        text-shadow: 0 0 10px rgba(79, 209, 255, 0.6);
      }
      .room-name-view {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
      }
      .room-name {
        padding: 2px 8px;
        font-size: 11px;
        line-height: 15px;
        letter-spacing: 1px;
        color: #9fe0ff;
        background: rgba(5, 16, 26, 0.7);
        border: 1px solid rgba(79, 209, 255, 0.24);
        border-radius: 2px;
        white-space: nowrap;
        transition: color 0.25s, border-color 0.25s, box-shadow 0.25s;
      }
    }
  }
  // 移动端：缩小视角切换按钮，避免溢出与贴边裁切
  @media (max-width: 768px) {
    .view-buttons-bottom {
      bottom: 0;
      gap: 8px;
      padding: 10px 4px calc(8px + env(safe-area-inset-bottom, 0px));
      box-sizing: border-box;
      &.isRoaming {
        transform: translateY(44px);
      }
      ::v-deep .tech-btn.el-button {
        width: 88px;
        height: 28px;
        padding: 0 6px;
        font-size: 12px;
        letter-spacing: 1px;
      }
      .view-button {
        gap: 8px;
      }
      .view-button1 {
        flex-wrap: nowrap;
        gap: 6px;
        padding: 0;
        .view-orb {
          width: 36px;
          height: 36px;
        }
        .view-orb-ring {
          inset: 3px;
        }
        .view-orb-core {
          inset: 9px;
        }
        .view-orb-index {
          font-size: 10px;
          letter-spacing: 0;
        }
        .room-name {
          font-size: 10px;
          line-height: 13px;
          padding: 1px 4px;
          letter-spacing: 0;
        }
      }
    }
  }
}
// 按钮扫光 / 视角座旋转 / 选中脉冲
@keyframes techSweep {
  0% {
    left: -65%;
  }
  55%,
  100% {
    left: 105%;
  }
}
@keyframes orbSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes orbPulse {
  0%,
  100% {
    box-shadow: inset 0 0 18px rgba(124, 247, 196, 0.28), 0 0 18px rgba(124, 247, 196, 0.35);
  }
  50% {
    box-shadow: inset 0 0 26px rgba(124, 247, 196, 0.45), 0 0 30px rgba(124, 247, 196, 0.6);
  }
}
</style>
<style lang="scss">
 .asc-man-name {
    background: #409EFF;
  }
  .asc-woman-name {
    background: #F56C6C;
  }
  .asc-man-name, .asc-woman-name{
    padding: 2px 4px 4px 4px;
    color: white;
    border-radius: 2px;
    font-family: 'kaiti';
  }
  .point-text {
    background: linear-gradient(to top, #45e6e2 0, transparent 100%);
    color: #fff;
    font-size: 14px;
    padding: 4px 8px;
    position: relative;
    padding-left: 12px;
    border-radius: 4px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 1); 
    ::before {
      content: "";
      position: absolute;
      left: 4px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: orangered;
    }
  }
</style>
