/**
 * SceneView —— three.js 场景封装入口
 *
 * 设计约定：
 * 1. 只做"装配与编排"，具体能力拆到 core/ 下，每个子模块只依赖原生 three 对象；
 * 2. 对外保留原生 scene / camera / renderer / controls，外部照常用 three.js 的 API；
 * 3. 加载器遵循 Loader.load(url, onLoad, onProgress, onError) 四参约定；
 * 4. 生命周期 start() / stop() / clear() 完整，事件通过 EventDispatcher 派发。
 *
 * 控制器统一使用 MapControls 原生行为。
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Object3DEvent from './utils/object3DEvent.js';
import { SceneTransition } from './utils/sceneTransition.js';
import { createParams } from './config.js';
import { createRenderer, createPostProcessing, resizePostProcessing, disposePostProcessing } from './core/RendererFactory.js';
import { LoaderHub } from './core/LoaderHub.js';
import { TextLayer } from './core/TextLayer.js';
import { DevTools } from './core/DevTools.js';
import { SceneSwitcher } from './core/SceneSwitcher.js';
import { FloorReflectionLayer, createFloorReflectShader } from './core/FloorReflection.js';

// 平移边界钳制用的临时向量（避免每帧分配）
const _panClampPrev = new THREE.Vector3();
const _panClampDiff = new THREE.Vector3();

// WGS84 长半轴（米），Web Mercator（EPSG:3857）球面墨卡托固定半径
const MERC_R = 6378137;

class SceneView {
    /**
     * @param {HTMLElement} container 渲染容器
     * @param {object} [options] 覆盖默认配置（支持深合并）
     */
    constructor(container, options = {}) {
        if (!container) throw new Error('[SceneView] container 不能为空');

        this.container = container;
        this.params = createParams(options);

        // 原生 three 对象（外部可直接使用 three.js API 操作）
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.THREE = THREE; // @deprecated 建议外部自行 import * as THREE from 'three'

        // 灯光
        this.dirLight = null;
        this.ambLight = null;
        this.hemisphereLight = null;
        this.floor = null;
        this.floorReflection = null;
        this.floorReflectors = [];

        // 后期处理
        this.composer = null;
        this.postProcessing = null;
        this.bloomPass = null;
        this.vignettePass = null;
        this.filmPass = null;
        this.bokehPass = null;
        this.outputPass = null;
        this.smaaPass = null;
        this.outlinePass = null;
        this.gtaoPass = null;
        this.outlineSelectedObjects = [];

        // 文本层
        this.textLayer = null;
        this.render2dText = null;
        this.render3dText = null;

        // 交互 / 过渡
        this.objEvent = null;
        this.transition = null;
        this.sceneSwitcher = null;

        // 加载与动画
        this.loaderHub = null;
        this.mixers = [];
        this.mixerList = this.mixers;
        this.maxAnisotropy = 1;

        // 环境贴图
        this.lightEnvironment = null;
        this.nightEnvironment = null;
        this.environmentRT = null;
        this._environmentPromise = null;

        // 循环与回调
        this.clock = new THREE.Timer();
        this.animateCallback = null;
        this.resizeCallback = null;
        this.loadedCallback = null;
        this.environmentCallback = null;
        this.events = new THREE.EventDispatcher();
        this._running = false;
        this._animateLocks = 0;

        // 开发工具
        this.devTools = null;
        this.stats = null;
        this.gui = null;
        this.grid = null;
        this.directionalLightHelper = null;

        this.init();
    }

    // ==================== 生命周期 ====================

    /** 初始化：装配所有部件（顺序有依赖，勿随意调整） */
    init() {
        const params = this.params;
        const width = this.getContainerWidth();
        const height = this.getContainerHeight();

        // 1. 场景
        this.scene = new THREE.Scene();
        this.scene.environmentIntensity = params.environmentIntensity;
        this.scene.backgroundIntensity = params.backgroundIntensity;
        // 未启用环境贴图时用背景色兜底，避免黑屏
        if (!params.environment) this.scene.background = new THREE.Color(params.bgColor);

        // 2. 相机
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
        this.camera.position.set(0, 100, 0);
        this.camera.lookAt(0, 0, 0);

        // 3. 渲染器（环境贴图必须在 renderer 之后，PMREM 需要 GL 上下文）
        const { renderer, maxAnisotropy } = createRenderer({ container: this.container, params });
        this.renderer = renderer;
        this.maxAnisotropy = maxAnisotropy;

        // 4. 加载中心（GLB/FBX/HDR 共用一套 loader）
        this.loaderHub = new LoaderHub(params, {
            optimizeMaterials: (root) => this.optimizeMaterials(root),
        });
        this.mixers = this.loaderHub.mixers;
        this.mixerList = this.mixers;

        // 5. 环境贴图 + 灯光 + 控制器 + 文本 + 事件 + 雾 + 地板 + 后期 + 过渡
        this.loadEnvironment();
        this.initLight();
        this.initControls();
        this.initTextRender();
        this.initEvent();
        this.initFog();
        this.initFloor();
        this.initFloorReflection();
        this.initPostProcessing();
        this.initTransition();
        this.setDevelopmentMode(params.mode);

        this._bindResize();
    }

    /** 启动渲染循环（内部使用 renderer.setAnimationLoop） */
    start() {
        if (!this.renderer || this._running) return;
        this._running = true;
        this.renderer.setAnimationLoop((time) => this.animate(time));
    }

    /** 暂停渲染循环 */
    stop() {
        this._running = false;
        if (this.renderer) this.renderer.setAnimationLoop(null);
    }

    // ==================== 环境与灯光 ====================

    /**
     * 加载 HDR 环境贴图（HDR → PMREM 预过滤，得到物理正确的 IBL）
     * @returns {Promise<THREE.Texture|null>}
     */
    loadEnvironment() {
        const params = this.params;
        if (!params.environment) {
            return Promise.resolve(null);
        }

        this._environmentPromise = new Promise((resolve) => {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileEquirectangularShader();

            const url = (params.isNight && params.nightEnvironmentUrl)
                ? params.nightEnvironmentUrl
                : params.environmentUrl;

            this.loaderHub.loadHDR(url, (texture) => {
                this.lightEnvironment = texture;
                texture.mapping = THREE.EquirectangularReflectionMapping;

                // PMREM 预过滤：按粗糙度生成正确 mip 层级，PBR 反射才准确
                const envRT = pmrem.fromEquirectangular(texture);
                this.environmentRT = envRT;
                this.scene.environment = envRT.texture;
                this.scene.environmentIntensity = params.environmentIntensity;
                if (!params.isNight) this.scene.background = texture;

                pmrem.dispose();
                if (this.environmentCallback) this.environmentCallback(envRT.texture);
                this.events.dispatchEvent({ type: 'environment', texture: envRT.texture });
                resolve(envRT.texture);
            }, () => {
                // 备用方案：立方体天空盒
                const cubeTexture = new THREE.CubeTextureLoader().load(params.fallbackCubeUrls);
                this.lightEnvironment = cubeTexture;
                this.scene.environment = cubeTexture;
                this.scene.background = cubeTexture;

                pmrem.dispose();
                if (this.environmentCallback) this.environmentCallback(cubeTexture);
                this.events.dispatchEvent({ type: 'environment', texture: cubeTexture });
                resolve(cubeTexture);
            });
        });

        return this._environmentPromise;
    }

    /** 等待环境贴图就绪（未加载时立即 resolve） */
    whenReady() {
        return this._environmentPromise || Promise.resolve(null);
    }

    /** 初始化灯光 */
    initLight() {
        const params = this.params;
        // 夜景由外部自行布光（保持原有行为）
        if (params.isNight) return;

        if (params.ambLight.enabled) {
            this.ambLight = new THREE.AmbientLight(params.ambLight.color, params.ambLight.intensity);
            this.ambLight.name = 'amb_light';
            this.scene.add(this.ambLight);
        }

        if (params.hemiLight.enabled) {
            const hemi = params.hemiLight;
            this.hemisphereLight = new THREE.HemisphereLight(hemi.skyColor, hemi.groundColor, hemi.intensity);
            this.hemisphereLight.name = 'hemisphere_light';
            this.scene.add(this.hemisphereLight);
        }

        if (params.dirLight.enabled) {
            const shadow = params.dirLight;
            const target = shadow.target || { x: 0, y: 0, z: 0 };

            this.dirLight = new THREE.DirectionalLight(shadow.color, shadow.intensity);
            this.dirLight.name = 'dir_light';
            this.dirLight.position.set(shadow.position.x, shadow.position.y, shadow.position.z);
            this.dirLight.castShadow = shadow.castShadow;

            this.dirLight.shadow.camera.left = shadow.shadowCameraLeft;
            this.dirLight.shadow.camera.right = shadow.shadowCameraRight;
            this.dirLight.shadow.camera.top = shadow.shadowCameraTop;
            this.dirLight.shadow.camera.bottom = shadow.shadowCameraBottom;
            this.dirLight.shadow.camera.near = shadow.shadowCameraNear;
            this.dirLight.shadow.camera.far = shadow.shadowCameraFar;
            this.dirLight.shadow.mapSize.width = shadow.shadowCameraMapSize.width;
            this.dirLight.shadow.mapSize.height = shadow.shadowCameraMapSize.height;
            this.dirLight.shadow.normalBias = shadow.normalBias;
            this.dirLight.shadow.radius = shadow.shadowRadius;
            this.dirLight.shadow.bias = shadow.bias;
            this.dirLight.shadow.blurSamples = shadow.blurSamples;
            this.dirLight.shadow.intensity = shadow.shadowIntensity;

            this.dirLight.target.position.set(target.x, target.y, target.z);
            this.scene.add(this.dirLight);
            this.scene.add(this.dirLight.target);

            this.renderer.shadowMap.needsUpdate = true;
        }
    }

    /** 初始化控制器（MapControls 原生行为，不含自定义滚轮俯仰） */
    initControls() {
        if (!this.params.control.enabled || !this.renderer) return;

        this.controls = new MapControls(this.camera, this.renderer.domElement);
        this._applyNativeControlSettings();
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /** 把 params.control 映射到 MapControls 原生属性 */
    _applyNativeControlSettings() {
        const c = this.params.control;
        const controls = this.controls;
        if (!controls) return;

        controls.autoRotate = c.autoRotate;
        controls.autoRotateSpeed = c.autoRotateSpeed;
        controls.enableDamping = c.enableDamping;
        controls.dampingFactor = c.dampingFactor;
        controls.minDistance = c.minDistance;
        controls.maxDistance = c.maxDistance;
        controls.minPolarAngle = c.minPolarAngle;
        controls.maxPolarAngle = c.maxPolarAngle;
        controls.enableZoom = c.enableZoom;
        controls.enablePan = c.enablePan;
        controls.zoomSpeed = c.zoomSpeed !== undefined ? c.zoomSpeed : 1.0;
    }

    /**
     * 把平移目标点夹回 control.panLimit 围成的 xyz 盒内；
     * target 被推回的差值同步平移相机，保持视角相对偏移不变。
     * 未启用 panLimit 或某轴未给边界时，该轴不限制。
     */
    _clampPanTarget() {
        const limit = this.params.control && this.params.control.panLimit;
        if (!this.controls || !limit || !limit.enabled) {
            return;
        }

        const target = this.controls.target;
        const min = limit.min || {};
        const max = limit.max || {};
        const prev = _panClampPrev.copy(target);

        const clampAxis = (key) => {
            if (min[key] === undefined) return;
            const lo = min[key];
            const hi = max[key] === undefined ? Infinity : max[key];
            target[key] = THREE.MathUtils.clamp(target[key], lo, hi);
        };
        clampAxis('x');
        clampAxis('y');
        clampAxis('z');

        // 仅当 target 被边界推回时，把同样的差值补偿给相机位置
        const diff = _panClampDiff.subVectors(target, prev);
        if (diff.lengthSq() > 0 && this.camera) this.camera.position.add(diff);
    }

    /**
     * 用新的相机重建控制器（切场景后若换了相机调用）
     * @param {THREE.Camera} newCamera
     * @param {THREE.Vector3} [targetPoint]
     */
    updateControls(newCamera, targetPoint) {
        if (!this.params.control.enabled || !this.renderer) return;

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        this.controls = new MapControls(newCamera || this.camera, this.renderer.domElement);
        this._applyNativeControlSettings();

        if (targetPoint) this.controls.target.copy(targetPoint);
        else this.controls.target.set(0, 0, 0);

        this.controls.update();
    }

    // ==================== 场景部件 ====================

    /** 初始化迷雾 */
    initFog() {
        const fog = this.params.fog;
        if (!fog.enabled) return;

        const color = this.params.isNight ? 0x222222 : fog.color;
        if (fog.type === 'FogExp2') {
            this.scene.fog = new THREE.FogExp2(color, fog.density);
        } else {
            this.scene.fog = new THREE.Fog(color, fog.near, fog.far);
        }
    }

    /** 初始化地面（默认关闭，开启时受光且接收阴影） */
    initFloor() {
        const floor = this.params.floor;
        if (!floor.enabled) return;

        const geometry = new THREE.BoxGeometry(floor.width, floor.depth, floor.height);
        const material = new THREE.MeshStandardMaterial({
            color: floor.color,
            roughness: floor.roughness,
            metalness: floor.metalness,
        });
        this.floor = new THREE.Mesh(geometry, material);
        this.floor.name = floor.name || 'scene_floor';
        this.floor.position.y = -floor.depth / 2;
        this.floor.receiveShadow = floor.receiveShadow;
        this.scene.add(this.floor);
    }

    /** 初始化地板反射层管理器（此时不挂任何反射面，等模型加载完再调 add） */
    initFloorReflection() {
        if (this.floorReflection) return;
        this.floorReflection = new FloorReflectionLayer(() => this.params.floorReflection);
        // 共享同一个数组引用，外部可随时读 this.floorReflectors 排查
        this.floorReflectors = this.floorReflection.items;
    }

    /**
     * 给单块地板叠加反射层（原地板保留受光材质）
     * @param {THREE.Mesh} mesh 名称/位置由模型决定，通常就是名为"地面反射"的那块
     * @param {object} [options] 覆盖 params.floorReflection
     * @returns {Reflector|null}
     */
    addFloorReflection(mesh, options) {
        if (!this.floorReflection) this.initFloorReflection();
        return this.floorReflection.add(mesh, options);
    }

    /**
     * 给一块或多块地板叠加反射层（直接传入目标 Mesh，封装不再按名称在模型树里匹配）
     * @param {THREE.Mesh|THREE.Mesh[]} meshes 地板网格，单个或数组
     * @param {object} [options] 覆盖 params.floorReflection
     * @returns {Reflector[]}
     */
    addFloorReflections(meshes, options) {
        if (!this.floorReflection) this.initFloorReflection();
        return this.floorReflection.addList(meshes, options);
    }

    /** 移除并释放所有地板反射层（切场景/重新加载模型前可手动调） */
    removeFloorReflections() {
        if (!this.floorReflection) return;
        this.floorReflection.dispose();
        this.floorReflectors = this.floorReflection.items;
    }

    /**
     * 生成地板反射 shader（给需要自定义 Reflector 的高级用法留的入口）
     * @param {object} [options]
     * @returns {{ name: string, uniforms: object, vertexShader: string, fragmentShader: string }}
     */
    createFloorReflectShader(options) {
        return createFloorReflectShader(
            Object.assign({}, this.params.floorReflection, options || {})
        );
    }

    /** 初始化后期处理管线 */
    initPostProcessing() {
        if (!this.params.postProcessing.enabled || !this.renderer) return;

        const context = createPostProcessing({
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            params: this.params,
            width: this.getContainerWidth(),
            height: this.getContainerHeight(),
        });

        this.postProcessing = context;
        this.composer = context.composer;
        this.gtaoPass = context.gtaoPass;
        this.bloomPass = context.bloomPass;
        this.smaaPass = context.smaaPass;
        this.vignettePass = context.vignettePass;
        this.filmPass = context.filmPass;
        this.bokehPass = context.bokehPass;
        this.outlinePass = context.outlinePass;
        this.outputPass = context.outputPass;
    }

    /** 初始化文本渲染层 */
    initTextRender() {
        if (this.textLayer) return;
        this.textLayer = new TextLayer(this.container);
        this.render2dText = this.textLayer.render2d;
        this.render3dText = this.textLayer.render3d;
    }

    /**
     * 创建文本
     * @param {object} options 见 TextLayer.create
     * @returns {THREE.Object3D|Promise<THREE.Mesh|null>|null}
     */
    createText(options = {}) {
        if (!this.textLayer) this.initTextRender();
        return this.textLayer.create(options);
    }

    /** 初始化物体拾取事件 */
    initEvent() {
        this.objEvent = new Object3DEvent(this.container, this.scene, this.camera, false);
    }

    /** 初始化场景过渡 */
    initTransition() {
        this.transition = new SceneTransition(this.renderer, this.composer, {
            width: this.getContainerWidth(),
            height: this.getContainerHeight(),
            duration: 1.5,
            type: 0,
        });
        this.transition.setCurrentScene(this.scene, this.camera);

        this.sceneSwitcher = new SceneSwitcher(this);
        this.sceneSwitcher.bindTransition();
    }

    // ==================== 场景切换 ====================

    /**
     * 一站式切场景：过渡 + 主引用 + pass 重绑 + GTAO + 拾取场景
     * @param {object} options 见 SceneSwitcher.switchScene
     * @returns {Promise<boolean>}
     */
    switchScene(options) {
        if (!this.sceneSwitcher) return Promise.resolve(false);
        return this.sceneSwitcher.switchScene(options);
    }

    /**
     * 兼容旧接口：仅同步 scene/camera 与相关部件（不做过渡动画）
     * @param {THREE.Scene} newScene
     * @param {THREE.Camera} newCamera
     */
    updatePostProcessingScene(newScene, newCamera) {
        if (!this.sceneSwitcher) return;
        this.sceneSwitcher.sync(newScene, newCamera);
    }

    // ==================== 渲染循环 ====================

    /** 单帧渲染（start() 会自动调用；也可外部手动驱动） */
    animate(time) {
        // Timer 必须先 update 再 getDelta，否则 delta 恒为 0
        this.clock.update(time);
        const delta = this.clock.getDelta();

        // Stats 由 DevTools 统一驱动，保留 this.stats 兼容引用
        if (this.devTools) this.devTools.update();
        else if (this.stats) this.stats.update();

        // 位移动画锁定期间跳过控制器 update，避免它每帧反推 spherical、回写朝向，
        // 与补间直接写相机位置互相覆盖造成视角抖动
        if (this.controls && this._animateLocks === 0) {
            this.controls.update(delta);
            this._clampPanTarget();
        }

        TWEEN.update(time === undefined ? performance.now() : time);

        if (this.loaderHub) this.loaderHub.updateMixers(delta);

        if (this.transition && this.transition.isTransitioning) {
            this.transition.update(performance.now());
            this.transition.preRender();
        }
        // 过渡期间关闭 AO：TransitionPass 输出不含深度/法线，AO 会算错
        if (this.gtaoPass) {
            this.gtaoPass.enabled = !(this.transition && this.transition.isTransitioning);
        }

        if (this.composer) {
            this.composer.render();
        } else if (this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }

        if (this.textLayer) this.textLayer.render(this.scene, this.camera);

        if (this.animateCallback) this.animateCallback(delta);
    }

    // ==================== 尺寸 ====================

    getContainerWidth() {
        return Math.max(this.container.clientWidth, 1);
    }

    getContainerHeight() {
        return Math.max(this.container.clientHeight, 1);
    }

    /** 窗口/容器尺寸变化 */
    resizeView() {
        const width = this.getContainerWidth();
        const height = this.getContainerHeight();
        const pixelRatio = Math.min(window.devicePixelRatio, this.params.quality.maxPixelRatio);

        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setPixelRatio(pixelRatio);
            this.renderer.setSize(width, height);
        }

        if (this.textLayer) this.textLayer.resize(width, height);

        resizePostProcessing(this.postProcessing, width, height, pixelRatio);

        if (this.transition) this.transition.resize(width, height);

        if (this.resizeCallback) this.resizeCallback();
        if (this.objEvent) this.objEvent.resize();
    }

    /** 绑定 resize（debounce，避免拖拽窗口时 GPU 资源反复重建） */
    _bindResize() {
        this._resizeTimer = null;
        this._resizeHandler = () => {
            if (this._resizeTimer) clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this.resizeView(), 100);
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    // ==================== 加载器 ====================

    /**
     * 材质/贴图质量优化：各向异性、抖动、环境反射强度
     * @param {THREE.Object3D} root
     */
    optimizeMaterials(root) {
        if (!root) return;
        const quality = this.params.quality;

        root.traverse((child) => {
            if (!child.isMesh) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];

            for (const material of materials) {
                if (!material) continue;

                // 各向异性过滤：让倾斜视角下的贴图保持清晰（地板/墙面提升明显）
                if (quality.anisotropy && this.maxAnisotropy > 1) {
                    const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
                    for (const key of keys) {
                        const texture = material[key];
                        if (texture && texture.isTexture) {
                            texture.anisotropy = this.maxAnisotropy;
                            texture.needsUpdate = true;
                        }
                    }
                }

                if (quality.dithering && 'dithering' in material) {
                    material.dithering = true;
                }

                if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                    material.envMapIntensity = quality.envMapIntensity;
                }
            }
        });
    }

    /**
     * 加载 GLB / GLTF
     * @param {string} url
     * @param {(gltf: object) => void} callback
     * @param {(xhr, progress) => void} [progressCallback]
     * @param {(error) => void} [errorCallback]
     */
    glbModelLoader(url, callback, progressCallback, errorCallback) {
        this.loaderHub.loadGLB(url, callback, progressCallback, errorCallback);
    }

    /** loadGLB 别名（与 three.js Loader 命名习惯一致） */
    loadGLB(url, onLoad, onProgress, onError) {
        this.glbModelLoader(url, onLoad, onProgress, onError);
    }

    /**
     * 加载 FBX
     * @param {string} url
     * @param {(fbx, mixer) => void} callback
     * @param {(xhr, progress) => void} [progressCallback]
     * @param {{ texturePath?: string, enableShadow?: boolean, autoPlay?: boolean }} [options]
     * @param {(error) => void} [errorCallback]
     */
    fbxModelLoader(url, callback, progressCallback, options = {}, errorCallback) {
        // 容错：第四个参数直接传函数时视为 errorCallback
        if (typeof options === 'function') {
            errorCallback = options;
            options = {};
        }
        this.loaderHub.loadFBX(url, callback, progressCallback, errorCallback, options);
    }

    /** loadFBX 别名 */
    loadFBX(url, onLoad, onProgress, onError, options) {
        this.fbxModelLoader(url, onLoad, onProgress, options, onError);
    }

    // ==================== 位移动画 ====================

    /**
     * 物体位移/旋转动画（支持多段关键帧链）
     * @param {object} target 被修改的对象（Vector3 / Euler 等）
     * @param {object|object[]} positions 单点或多段关键点
     * @param {number} [duration] 每段时长（毫秒），不传则按距离估算
     * @param {(target: object) => void} [onUpdate]
     * @returns {Promise<void>}
     */
    async thingAnimate(target, positions, duration, onUpdate) {
        const points = Array.isArray(positions) ? positions : [positions];

        this._animateLocks += 1;
        if (this.controls) this.controls.enabled = false;

        // 被补间的是相机位置时，飞行期间手动维持朝向对准目标点（控制器 update 已跳过）
        const cameraRef = this.camera;
        const isCameraPos = !!(cameraRef && target === cameraRef.position);
        const lookTarget = this.controls ? this.controls.target : null;

        try {
            await new Promise((resolve) => {
                let previous = null;
                for (const point of points) {
                    const segmentDuration = this._resolveDuration(target, point, duration);
                    const tween = new TWEEN.Tween(target, true)
                        .to(point, segmentDuration)
                        .easing(TWEEN.Easing.Linear.None);

                    tween.onUpdate(() => {
                        if (typeof onUpdate === 'function') onUpdate(target);
                        if (isCameraPos && lookTarget && cameraRef) cameraRef.lookAt(lookTarget);
                    });
                    if (previous) previous.chain(tween);
                    else tween.start();

                    previous = tween;
                }
                if (previous) previous.onComplete(() => resolve());
                else resolve();
            });
        } finally {
            this._animateLocks = Math.max(0, this._animateLocks - 1);
            if (this.controls) {
                // 落地后先让控制器按最终相机位置重建内部状态，再放开交互
                this.controls.update();
                if (this._animateLocks === 0) this.controls.enabled = true;
            }
        }
    }

    /** flyTo 别名 */
    flyTo(target, positions, duration, onUpdate) {
        return this.thingAnimate(target, positions, duration, onUpdate);
    }

    /**
     * 按距离估算时长：每单位 250ms，夹在 1500~2500ms
     * @returns {number}
     */
    _resolveDuration(start, end, duration) {
        if (duration) return duration;
        const from = new THREE.Vector3(start.x, start.y, start.z);
        const to = new THREE.Vector3(end.x, end.y, end.z);
        return THREE.MathUtils.clamp(Math.floor(from.distanceTo(to)) * 250, 1500, 2500);
    }

    /**
     * 生成一个按距离换算时长的 Tween
     * @returns {TWEEN.Tween}
     */
    getTweenBySpeed(start, end, duration) {
        const segmentDuration = this._resolveDuration(start, end, duration);
        return new TWEEN.Tween(start, true).to(end, segmentDuration).easing(TWEEN.Easing.Linear.None);
    }

    // ==================== 描边 ====================

    /** 设置描边对象 */
    setOutlineObjects(objects) {
        if (!this.outlinePass) return;
        this.outlineSelectedObjects = Array.isArray(objects) ? objects : [objects];
        this.outlinePass.selectedObjects = this.outlineSelectedObjects;
    }

    /** 清除描边 */
    clearOutline() {
        if (!this.outlinePass) return;
        this.outlineSelectedObjects = [];
        this.outlinePass.selectedObjects = [];
    }

    // ==================== 地理投影（Web Mercator / EPSG:3857） ====================

    /**
     * 经纬度 → 墨卡托米制坐标
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {{ x: number, y: number }}
     */
    projectMercator(lng, lat) {
        const lngRad = (lng * Math.PI) / 180;
        const latRad = (lat * Math.PI) / 180;
        return {
            x: MERC_R * lngRad,
            y: MERC_R * Math.log(Math.tan(Math.PI / 4 + latRad / 2)),
        };
    }

    /**
     * 经纬度 → 相对投影中心的场景平面坐标（x/y 同系数保形）
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {{ x: number, y: number }}
     */
    projectPlane(lng, lat) {
        const [centerLng, centerLat] = this.params.geo.center;
        const scale = this.params.geo.worldScale;
        const p = this.projectMercator(lng, lat);
        const o = this.projectMercator(centerLng, centerLat);
        return { x: (p.x - o.x) * scale, y: (p.y - o.y) * scale };
    }

    /**
     * 经纬度 → 场景三维坐标（世界 z 取负平面 y）
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @param {number} [height=5.5] 离地高度
     * @returns {THREE.Vector3}
     */
    projectToScene(lng, lat, height = 5.5) {
        const { x, y } = this.projectPlane(lng, lat);
        return new THREE.Vector3(x, height, -y);
    }

    // ==================== 导出 ====================

    /** 模型居中（y 取包围盒底部） */
    setCenter(model) {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        center.y = box.min.y;
        model.position.sub(center);
    }

    /**
     * 导出前预处理：克隆 + 强制三角化 + 关闭线框
     * @param {THREE.Object3D} root
     * @returns {{ object: THREE.Object3D, cleanup: () => void }}
     */
    _prepareForExport(root) {
        const clone = root.clone(true);
        const createdGeometries = [];
        const clonedMaterials = [];

        clone.traverse((child) => {
            if (!child.isMesh) return;

            if (child.geometry) {
                // indexed → non-indexed → 合并重复顶点，确保是标准 TRIANGLES
                let processed = child.geometry;
                if (processed.index) processed = processed.toNonIndexed();
                processed = mergeVertices(processed);
                processed.computeVertexNormals();
                child.geometry = processed;
                createdGeometries.push(processed);
            }

            if (child.material) {
                // 克隆材质再改 wireframe，避免污染原场景材质
                if (Array.isArray(child.material)) {
                    child.material = child.material.map((material) => {
                        const next = material.clone();
                        next.wireframe = false;
                        clonedMaterials.push(next);
                        return next;
                    });
                } else {
                    child.material = child.material.clone();
                    child.material.wireframe = false;
                    clonedMaterials.push(child.material);
                }
            }
        });

        const cleanup = () => {
            for (const geometry of createdGeometries) geometry.dispose();
            for (const material of clonedMaterials) material.dispose();
        };

        return { object: clone, cleanup };
    }

    /**
     * 导出指定模型
     * @param {THREE.Object3D} object
     * @param {'gltf'|'glb'} [format]
     * @param {string} [fileName]
     */
    exportModel(object, format = 'gltf', fileName = 'model') {
        if (!object) {
            console.warn('exportModel: 未指定导出对象');
            return;
        }

        const exporter = new GLTFExporter();
        const { object: preparedObject, cleanup } = this._prepareForExport(object);
        const options = {
            binary: format === 'glb',
            animations: true,
            framesPerSecond: 30,
            includeCustomProperties: true,
        };

        exporter.parse(
            preparedObject,
            (result) => {
                cleanup();

                const ext = format === 'glb' ? 'glb' : 'gltf';
                const mimeType = format === 'glb' ? 'model/gltf-binary' : 'model/gltf+json';
                const blob = new Blob(
                    [format === 'glb' ? result : JSON.stringify(result)],
                    { type: mimeType }
                );
                this._downloadBlob(blob, `${fileName}.${ext}`);
                console.log(`导出成功: ${fileName}.${ext}`);
            },
            (error) => {
                cleanup();
                console.error('导出失败:', error);
            },
            options
        );
    }

    /** exportGLTF 别名 */
    exportGLTF(object, format, fileName) {
        this.exportModel(object, format, fileName);
    }

    /** 导出整个场景 */
    exportScene(format = 'gltf', fileName = 'scene') {
        this.exportModel(this.scene, format, fileName);
    }

    /** 按名称查找并导出 */
    exportModelByName(name, format = 'gltf', fileName) {
        const target = this.scene.getObjectByName(name);
        if (!target) {
            console.warn(`exportModelByName: 未找到名为 "${name}" 的对象`);
            return;
        }
        this.exportModel(target, format, fileName || name);
    }

    /** 下载 Blob */
    _downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ==================== 开发工具 ====================

    /**
     * 开发模式
     * @param {''|'development'|{stats?:boolean,gui?:boolean,helper?:boolean,grid?:boolean}} mode
     */
    setDevelopmentMode(mode) {
        if (!mode) return;
        if (!this.devTools) this.devTools = new DevTools(this);

        if (mode === 'development' || mode === true) {
            this.initStats();
            this.initGUI();
            this.initHelper();
            this.initGrid(1000, 100);
            return;
        }
        if (typeof mode === 'object') {
            if (mode.stats) this.initStats();
            if (mode.gui) this.initGUI();
            if (mode.helper) this.initHelper();
            if (mode.grid) this.initGrid(20, 40);
        }
    }

    initStats() {
        if (!this.devTools) this.devTools = new DevTools(this);
        this.devTools.initStats();
        this.stats = this.devTools.stats;
    }

    initGUI() {
        if (!this.devTools) this.devTools = new DevTools(this);
        this.devTools.initGUI();
        this.gui = this.devTools.gui;
    }

    initHelper() {
        if (!this.devTools) this.devTools = new DevTools(this);
        this.devTools.initHelper();
        this.directionalLightHelper = this.devTools.directionalLightHelper;
    }

    initGrid(size, divisions) {
        if (!this.devTools) this.devTools = new DevTools(this);
        this.devTools.initGrid(size, divisions);
        this.grid = this.devTools.grid;
    }

    /** 给模型加材质面板 */
    addGuiMesh(mesh) {
        if (!this.devTools) return;
        this.devTools.addGuiMesh(mesh);
    }

    // ==================== 事件 ====================

    /** three.js 风格事件订阅 */
    addEventListener(type, listener) {
        this.events.addEventListener(type, listener);
        return this;
    }

    removeEventListener(type, listener) {
        this.events.removeEventListener(type, listener);
        return this;
    }

    dispatchEvent(event) {
        this.events.dispatchEvent(event);
        return this;
    }

    // ==================== 销毁 ====================

    /** 清理场景与所有 GPU 资源 */
    clear() {
        this.stop();

        if (this._resizeTimer) {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = null;
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }

        if (this.devTools) {
            this.devTools.dispose();
            this.devTools = null;
        }
        this.stats = null;
        this.gui = null;
        this.grid = null;
        this.directionalLightHelper = null;

        if (this.objEvent) {
            if (typeof this.objEvent.dispose === 'function') this.objEvent.dispose();
            else this.objEvent.clear();
            this.objEvent = null;
        }

        if (this.transition) {
            this.transition.dispose();
            this.transition = null;
        }
        this.sceneSwitcher = null;

        // 地板反射层（内部持有 WebGLRenderTarget，必须在场景遍历释放前处理）
        if (this.floorReflection) {
            this.floorReflection.dispose();
            this.floorReflection = null;
        }
        this.floorReflectors = [];

        // 场景内的几何体与材质
        if (this.scene) {
            this.scene.traverse((child) => {
                if (!child.isMesh) return;
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
                    else child.material.dispose();
                }
            });
            this.scene.clear();
        }

        // 环境贴图与 PMREM 渲染目标
        if (this.environmentRT) {
            this.environmentRT.dispose();
            this.environmentRT = null;
        }
        if (this.lightEnvironment && typeof this.lightEnvironment.dispose === 'function') {
            this.lightEnvironment.dispose();
        }
        this.lightEnvironment = null;
        this.nightEnvironment = null;
        this._environmentPromise = null;

        // 后期处理
        disposePostProcessing(this.postProcessing);
        this.postProcessing = null;
        this.composer = null;
        this.gtaoPass = null;
        this.bloomPass = null;
        this.smaaPass = null;
        this.vignettePass = null;
        this.filmPass = null;
        this.bokehPass = null;
        this.outlinePass = null;
        this.outputPass = null;
        this.outlineSelectedObjects = [];

        // 控制器
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // 文本层
        if (this.textLayer) {
            this.textLayer.dispose();
            this.textLayer = null;
        }
        this.render2dText = null;
        this.render3dText = null;

        // 加载中心
        if (this.loaderHub) {
            this.loaderHub.dispose();
            this.loaderHub = null;
        }
        this.mixers = [];
        this.mixerList = this.mixers;

        // 渲染器
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.scene = null;
        this.camera = null;
        this.dirLight = null;
        this.ambLight = null;
        this.hemisphereLight = null;
        this.floor = null;
        this.animateCallback = null;
        this.resizeCallback = null;
        this.loadedCallback = null;
        this.environmentCallback = null;
        this.events = null;
    }

    /** dispose 别名 */
    dispose() {
        this.clear();
    }
}

export default SceneView;
