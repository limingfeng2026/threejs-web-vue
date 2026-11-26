import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { SceneTransition } from './utils/sceneTransition.js';
import type Object3DEvent from './utils/object3DEvent.js';

/** 位移关键点：任意带 x/y/z 的对象（Vector3、Euler、普通对象均可） */
export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export interface PostProcessingParams {
    enabled?: boolean;
    smaa?: { enabled?: boolean };
    gtao?: {
        enabled?: boolean;
        blendIntensity?: number;
        radius?: number;
        distanceExponent?: number;
        thickness?: number;
        scale?: number;
        samples?: number;
        distanceFallOff?: number;
        lumaPhi?: number;
        depthPhi?: number;
        normalPhi?: number;
        denoiseRadius?: number;
        denoiseRings?: number;
        denoiseSamples?: number;
    };
    bloom?: { enabled?: boolean; strength?: number; radius?: number; threshold?: number };
    vignette?: { enabled?: boolean; offset?: number; darkness?: number };
    film?: { enabled?: boolean; noiseIntensity?: number; scanlinesIntensity?: number; scanlinesCount?: number };
    bokeh?: { enabled?: boolean; focus?: number; aperture?: number; maxblur?: number };
    output?: { toneMapping?: number; toneMappingExposure?: number };
    outline?: {
        enabled?: boolean;
        edgeStrength?: number;
        edgeGlow?: number;
        edgeThickness?: number;
        pulsePeriod?: number;
        visibleEdgeColor?: THREE.Color | number;
        hiddenEdgeColor?: THREE.Color | number;
    };
}

export interface SceneViewOptions {
    mode?: '' | 'development' | { stats?: boolean; gui?: boolean; helper?: boolean; grid?: boolean };
    isNight?: boolean;
    bgColor?: number | THREE.Color;
    environment?: boolean;
    environmentIntensity?: number;
    backgroundIntensity?: number;
    shadowMapEnabled?: boolean;
    /** 阴影类型，默认 THREE.PCFShadowMap（r185 已弃用 PCFSoftShadowMap） */
    shadowMapType?: number;
    nightEnvironmentUrl?: string;
    environmentUrl?: string;
    fallbackCubeUrls?: string[];
    dracoPath?: string;
    fontUrl?: string;

    floor?: {
        enabled?: boolean;
        color?: number;
        width?: number;
        height?: number;
        depth?: number;
        roughness?: number;
        metalness?: number;
    };
    floorReflection?: FloorReflectionOptions;
    fog?: { enabled?: boolean; type?: 'Fog' | 'FogExp2'; color?: number; density?: number; near?: number; far?: number };
    control?: {
        enabled?: boolean;
        autoRotate?: boolean;
        autoRotateSpeed?: number;
        enableDamping?: boolean;
        dampingFactor?: number;
        minDistance?: number;
        maxDistance?: number;
        minPolarAngle?: number;
        maxPolarAngle?: number;
        enableZoom?: boolean;
        enablePan?: boolean;
        /** 滚轮缩放灵敏度，默认 1.0 */
        zoomSpeed?: number;
        /** 平移目标点 xyz 盒范围限制；某轴不给边界则该轴不限制 */
        panLimit?: {
            enabled?: boolean;
            min?: { x?: number; y?: number; z?: number };
            max?: { x?: number; y?: number; z?: number };
        };
    };
    ambLight?: { enabled?: boolean; color?: number; intensity?: number };
    hemiLight?: { enabled?: boolean; skyColor?: number; groundColor?: number; intensity?: number };
    dirLight?: {
        enabled?: boolean;
        color?: number;
        intensity?: number;
        position?: XYZ | THREE.Vector3;
        target?: XYZ | THREE.Vector3;
        castShadow?: boolean;
        shadowCameraLeft?: number;
        shadowCameraRight?: number;
        shadowCameraTop?: number;
        shadowCameraBottom?: number;
        shadowCameraNear?: number;
        shadowCameraFar?: number;
        shadowRadius?: number;
        shadowIntensity?: number;
        normalBias?: number;
        bias?: number;
        blurSamples?: number;
        shadowCameraMapSize?: { width: number; height: number };
    };
    quality?: {
        maxPixelRatio?: number;
        anisotropy?: boolean;
        dithering?: boolean;
        envMapIntensity?: number;
    };
    /** 地理投影配置（Web Mercator / EPSG:3857） */
    geo?: {
        /** 投影中心 [经度, 纬度]，作为场景坐标原点的经纬度基准 */
        center?: [number, number];
        /** 墨卡托米制 → 场景世界单位的统一缩放，仅控整体尺度 */
        worldScale?: number;
    };
    postProcessing?: PostProcessingParams;
}

/** 地板反射叠加层（Reflector 子类，额外提供 getRenderTarget） */
export interface FloorReflector extends THREE.Mesh {
    getRenderTarget(): THREE.WebGLRenderTarget;
}

export interface FloorReflectionRecord {
    reflector: FloorReflector;
    sourceMesh: THREE.Mesh;
    parent: THREE.Object3D;
}

export interface FloorReflectionOptions {
    enabled?: boolean;
    /** 反射色调 */
    color?: number | THREE.Color;
    reflectStrength?: number;
    fresnelPower?: number;
    texelSize?: number;
    blur?: number;
    edgeFade?: number;
    textureSize?: number;
    multisample?: number;
    clipBias?: number;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
    renderOrder?: number;
    /** 反射面沿法线（+Y）抬升的微小间隙，防共面 Z-fighting */
    reflectGap?: number;
    /** 原地板是否接收阴影（默认 false） */
    receiveShadow?: boolean;
    name?: string;
}

export interface CreateTextOptions {
    element: string | HTMLElement;
    className?: string;
    type?: '2d' | '3d' | '3ds' | '3d-font';
    depthTest?: boolean;
    color?: string;
    position?: XYZ | THREE.Vector3;
    fontUrl?: string;
    size?: number;
    depth?: number;
}

export interface SwitchSceneOptions {
    scene: THREE.Scene;
    camera: THREE.Camera;
    /** false 表示不做过渡，直接切换 */
    transition?: false | { type?: number; duration?: number; center?: { x: number; y: number }; softness?: number };
    onComplete?: (scene: THREE.Scene, camera: THREE.Camera) => void;
    /** 是否用目标相机重建控制器（换了相机时应为 true） */
    syncControls?: boolean;
    target?: THREE.Vector3;
    /** true 继承当前场景的环境贴图，也可直接传贴图 */
    environment?: boolean | THREE.Texture;
}

export interface FBXLoadOptions {
    texturePath?: string;
    enableShadow?: boolean;
    autoPlay?: boolean;
}

export default class SceneView {
    constructor(container: HTMLElement, options?: SceneViewOptions);

    // 原生对象：可直接用 three.js API
    readonly container: HTMLElement;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | THREE.Camera | null;
    renderer: THREE.WebGLRenderer | null;
    controls: MapControls | null;
    /** @deprecated 建议外部自行 import * as THREE from 'three' */
    THREE: typeof THREE;
    params: Required<SceneViewOptions> & Record<string, unknown>;

    // 灯光
    dirLight: THREE.DirectionalLight | null;
    ambLight: THREE.AmbientLight | null;
    hemisphereLight: THREE.HemisphereLight | null;
    floor: THREE.Mesh | null;
    /** 已挂载的地板反射面记录（共享数组，实时反映） */
    floorReflectors: FloorReflectionRecord[];

    // 后期处理
    composer: object | null;
    bloomPass: object | null;
    vignettePass: object | null;
    filmPass: object | null;
    bokehPass: object | null;
    outlinePass: object | null;
    smaaPass: object | null;
    gtaoPass: object | null;
    outputPass: object | null;

    // 文本 / 交互 / 过渡
    textLayer: object | null;
    render2dText: object | null;
    render3dText: object | null;
    objEvent: Object3DEvent | null;
    transition: SceneTransition | null;

    // 加载与动画
    loaderHub: object | null;
    mixers: Array<{ mixer: THREE.AnimationMixer; actions: THREE.AnimationAction[] }>;
    mixerList: Array<{ mixer: THREE.AnimationMixer; actions: THREE.AnimationAction[] }>;

    // 环境
    lightEnvironment: THREE.Texture | null;
    environmentCallback: ((texture: THREE.Texture) => void) | null;

    // 回调与循环
    animateCallback: ((delta: number) => void) | null;
    resizeCallback: (() => void) | null;
    loadedCallback: (() => void) | null;

    // 开发工具
    stats: object | null;
    gui: object | null;
    grid: THREE.GridHelper | null;

    // 生命周期
    start(): void;
    stop(): void;
    resizeView(): void;
    clear(): void;
    dispose(): void;

    // 环境 / 灯光 / 控制器
    loadEnvironment(): Promise<THREE.Texture | null>;
    whenReady(): Promise<THREE.Texture | null>;
    updateControls(newCamera?: THREE.Camera, targetPoint?: THREE.Vector3): void;

    // 文本
    createText(options: CreateTextOptions): THREE.Object3D | Promise<THREE.Mesh | null> | null;

    // 地板反射
    addFloorReflection(mesh: THREE.Mesh, options?: FloorReflectionOptions): FloorReflector | null;
    addFloorReflections(meshes: THREE.Mesh | THREE.Mesh[], options?: FloorReflectionOptions): FloorReflector[];
    removeFloorReflections(): void;
    createFloorReflectShader(options?: FloorReflectionOptions): {
        name: string;
        uniforms: Record<string, { value: unknown }>;
        vertexShader: string;
        fragmentShader: string;
    };

    // 场景切换
    switchScene(options: SwitchSceneOptions): Promise<boolean>;
    updatePostProcessingScene(newScene: THREE.Scene, newCamera: THREE.Camera): void;

    // 渲染
    animate(time?: number): void;

    // 加载
    loadGLB(url: string, onLoad?: (gltf: unknown) => void, onProgress?: (xhr: unknown, progress: number) => void, onError?: (error: unknown) => void): void;
    glbModelLoader(url: string, callback?: (gltf: unknown) => void, progressCallback?: (xhr: unknown, progress: number) => void, errorCallback?: (error: unknown) => void): void;
    loadFBX(url: string, onLoad?: (fbx: THREE.Group, mixer: THREE.AnimationMixer | null) => void, onProgress?: (xhr: unknown, progress: number) => void, onError?: (error: unknown) => void, options?: FBXLoadOptions): void;
    fbxModelLoader(url: string, callback?: (fbx: THREE.Group, mixer: THREE.AnimationMixer | null) => void, progressCallback?: (xhr: unknown, progress: number) => void, options?: FBXLoadOptions | ((error: unknown) => void), errorCallback?: (error: unknown) => void): void;
    optimizeMaterials(root: THREE.Object3D): void;

    // 位移
    thingAnimate(target: XYZ, positions: XYZ | XYZ[], duration?: number, onUpdate?: (target: XYZ) => void): Promise<void>;
    flyTo(target: XYZ, positions: XYZ | XYZ[], duration?: number, onUpdate?: (target: XYZ) => void): Promise<void>;
    getTweenBySpeed(start: XYZ, end: XYZ, duration?: number): object;

    // 描边
    setOutlineObjects(objects: THREE.Object3D | THREE.Object3D[]): void;
    clearOutline(): void;

    // 地理投影（Web Mercator / EPSG:3857）
    projectMercator(lng: number, lat: number): { x: number; y: number };
    projectPlane(lng: number, lat: number): { x: number; y: number };
    projectToScene(lng: number, lat: number, height?: number): THREE.Vector3;

    // 导出
    setCenter(model: THREE.Object3D): void;
    exportModel(object: THREE.Object3D, format?: 'gltf' | 'glb', fileName?: string): void;
    exportGLTF(object: THREE.Object3D, format?: 'gltf' | 'glb', fileName?: string): void;
    exportScene(format?: 'gltf' | 'glb', fileName?: string): void;
    exportModelByName(name: string, format?: 'gltf' | 'glb', fileName?: string): void;

    // 开发
    setDevelopmentMode(mode: SceneViewOptions['mode']): void;
    initStats(): void;
    initGUI(): void;
    initHelper(): void;
    initGrid(size?: number, divisions?: number): void;
    addGuiMesh(mesh: THREE.Mesh): void;

    // 事件
    addEventListener(type: string, listener: (event: object) => void): this;
    removeEventListener(type: string, listener: (event: object) => void): this;
    dispatchEvent(event: { type: string; [key: string]: unknown }): this;
}
