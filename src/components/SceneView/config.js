/**
 * SceneView 默认配置与合并工具
 *
 * 规则：
 * 1. 默认值由工厂函数每次返回全新对象，避免多实例共享同一份嵌套配置。
 * 2. options 使用深合并，支持只覆盖 `postProcessing.bloom.strength` 这类深层字段。
 * 3. THREE 的 Color / Vector / Euler / Texture 等实例只克隆不深挖，保证引用语义正确。
 */
import * as THREE from 'three';

const PLAIN_OBJECT_TAG = '[object Object]';

/** 是否是"普通对象"（排除 THREE 的各类实例与数组） */
function isPlainObject(value) {
    if (Object.prototype.toString.call(value) !== PLAIN_OBJECT_TAG) return false;
    return !(
        value.isColor ||
        value.isVector2 ||
        value.isVector3 ||
        value.isVector4 ||
        value.isEuler ||
        value.isQuaternion ||
        value.isMatrix3 ||
        value.isMatrix4 ||
        value.isTexture ||
        value.isObject3D
    );
}

/** 深拷贝：THREE 实例走 clone()，普通对象/数组递归，其余原样返回 */
export function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
        if (
            value.isColor ||
            value.isVector2 ||
            value.isVector3 ||
            value.isVector4 ||
            value.isEuler ||
            value.isQuaternion ||
            value.isMatrix3 ||
            value.isMatrix4
        ) {
            return value.clone();
        }
        if (value.isTexture || value.isObject3D) return value;
        if (isPlainObject(value)) {
            const out = {};
            for (const key of Object.keys(value)) out[key] = cloneValue(value[key]);
            return out;
        }
    }
    return value;
}

/**
 * 深合并：base 为默认值，override 为用户配置。
 * 只对"两边都是普通对象"的键递归，其余直接覆盖（覆盖前会 cloneValue）。
 */
export function deepMerge(base, override) {
    const out = cloneValue(base);
    if (!isPlainObject(override)) return out;
    for (const key of Object.keys(override)) {
        const next = override[key];
        if (isPlainObject(next) && isPlainObject(out[key])) {
            out[key] = deepMerge(out[key], next);
        } else {
            out[key] = cloneValue(next);
        }
    }
    return out;
}

/** 默认参数（每次调用返回全新对象） */
export function createDefaultParams() {
    return {
        /** 开发模式：'' | 'development' | { stats, gui, helper, grid } */
        mode: '',
        /** 是否夜景（影响雾色与背景） */
        isNight: false,
        /** 未启用环境贴图时的背景色 */
        bgColor: 0x333333,
        /** 是否加载 HDR 环境贴图 */
        environment: true,
        /** IBL 环境光照强度，阴影发灰/发死的主要调节项 */
        environmentIntensity: 0.5,
        backgroundIntensity: 1.0,
        /** 是否启用阴影贴图 */
        shadowMapEnabled: true,
        /**
         * 阴影算法类型。r185 已弃用 PCFSoftShadowMap（内部自动降级为 PCFShadowMap），
         * 默认直接给 PCFShadowMap，想要更硬可传 THREE.BasicShadowMap。
         */
        shadowMapType: THREE.PCFShadowMap,
        /** 夜景环境贴图（可选，默认沿用 sky_1.hdr） */
        nightEnvironmentUrl: '',

        floor: {
            enabled: false,
            color: 0x333333,
            width: 500,
            height: 500,
            depth: 0.2,
            roughness: 0.92,
            metalness: 0.0,
        },

        /**
         * 地板反射叠加层（保留原地板材质，额外叠一层菲涅尔反射）
         * 参数默认值与原 threeScene.vue 内联 shader 完全一致，改这里即可全局调参
         */
        floorReflection: {
            enabled: true,
            /** 反射色调 */
            color: 0xbcd6ff,
            /** 整体反射强度 */
            reflectStrength: 0.8,
            /** 菲涅尔指数：越大越"只在掠射角反光" */
            fresnelPower: 1.5,
            /** 9 采样模糊的采样步长基准（同时决定 uTexel = 1/texelSize） */
            texelSize: 512,
            /** 模糊倍率，1 为基准；越小倒影越锐利 */
            blur: 1.5,
            /** 反射面边缘淡出范围（0~0.5） */
            edgeFade: 0.6,
            /** 反射渲染目标分辨率 */
            textureSize: 512,
            /** 反射渲染目标 MSAA 采样数 */
            multisample: 4,
            clipBias: 0.003,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
            renderOrder: 1,
            /** 反射面沿法线（+Y）抬升的微小间隙，避免与原地板顶面共面 Z-fighting */
            reflectGap: 0.1,
            /** 原地板是否接收阴影（叠加反射后默认关闭，避免阴影叠在反射上发脏） */
            receiveShadow: false,
            /** 反射面名称 */
            name: 'FloorReflectOverlay',
        },

        fog: {
            enabled: true,
            type: 'Fog',
            color: 0xcbc3ae,
            density: 0.02,
            near: 220,
            far: 700,
        },

        control: {
            enabled: true,
            autoRotate: false,
            enableDamping: true,
            dampingFactor: 0.45,
            autoRotateSpeed: 0.5,
            minDistance: 0.01,
            maxDistance: 200,
            minPolarAngle: THREE.MathUtils.degToRad(0),
            maxPolarAngle: THREE.MathUtils.degToRad(80),
            enableZoom: true,
            enablePan: true,
            /** 滚轮缩放灵敏度：1.0 为默认，越大每格推拉幅度越大 */
            zoomSpeed: 1.5,
            /**
             * 平移（相机目标点）xyz 方向范围限制。
             * enabled=true 后，平移不会把 target 推出 min/max 围成的盒；
             * 某轴不给边界则该轴不限制。示例：
             * panLimit: { enabled: true, min: { x: -60, z: -60 }, max: { x: 60, z: 60 } }
             */
            panLimit: {
                enabled: false,
                min: { x: -Infinity, y: -Infinity, z: -Infinity },
                max: { x: Infinity, y: Infinity, z: Infinity },
            },
        },

        ambLight: {
            enabled: true,
            color: 0xeeeeee,
            intensity: 0.15,
        },

        hemiLight: {
            enabled: true,
            skyColor: 0x82abf7,
            groundColor: 0x6ccaf9,
            intensity: 0.42,
        },

        dirLight: {
            enabled: true,
            // 下午三四点的日光：色温偏暖金，太阳高度角约 20°
            color: 0xffdfa8,
            intensity: 13,
            position: new THREE.Vector3(130, 64, 108),
            target: new THREE.Vector3(0, 0, 0),
            castShadow: true,
            // 太阳角度低 → 投影更长，阴影相机范围相应放大，避免长影子被裁掉
            shadowCameraLeft: -240,
            shadowCameraRight: 240,
            shadowCameraTop: 240,
            shadowCameraBottom: -240,
            shadowCameraNear: 10,
            shadowCameraFar: 600,
            shadowRadius: 2,
            shadowIntensity: 1,
            normalBias: 0.02,
            bias: -0.0005,
            blurSamples: 8,
            shadowCameraMapSize: { width: 2048, height: 2048 },
        },

        quality: {
            maxPixelRatio: 2,
            anisotropy: true,
            dithering: true,
            envMapIntensity: 0.4,
        },

        postProcessing: {
            enabled: true,
            smaa: { enabled: true },
            gtao: {
                enabled: true,
                distanceExponent: 1.0,
                thickness: 0.25,
                scale: 1.0,
                distanceFallOff: 1.0,
                lumaPhi: 10,
                depthPhi: 2,
                normalPhi: 3,
                denoiseRings: 2,
                radius: 1.0,          // 1.2 → 0.8，暗部别往外晕
                denoiseRadius: 5,    // 8 → 5，降噪少抹细节
                samples: 24,          // 16 → 24，压颗粒
                denoiseSamples: 24,   // 16 → 24，降噪更干净
                blendIntensity: 1.25 // 深浅保持
            },
            bloom: {
                enabled: true,
                strength: 0.18,
                radius: 0.3,
                threshold: 1.05,
            },
            vignette: {
                enabled: true,
                offset: 1.6,
                darkness: 0.75,
            },
            film: {
                enabled: false,
                noiseIntensity: 0.15,
                scanlinesIntensity: 0.01,
                scanlinesCount: 64,
            },
            bokeh: {
                enabled: false,
                focus: 1.0,
                aperture: 0.00025,
                maxblur: 0.01,
            },
            output: {
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 0.9,
            },
            outline: {
                enabled: true,
                edgeStrength: 8.0,
                edgeGlow: 0.0,
                edgeThickness: 1.0,
                pulsePeriod: 0,
                visibleEdgeColor: new THREE.Color(0x41dd9c),
                hiddenEdgeColor: new THREE.Color(0x41dd9c),
            },
        },

        /**
         * 地理投影配置（Web Mercator / EPSG:3857）
         * center：投影中心 [经度, 纬度]，作为场景坐标原点的经纬度基准；
         * worldScale：墨卡托米制 → 场景世界单位的统一缩放，仅控整体尺度，x/y 同系数保形。
         */
        geo: {
            center: [114.19, 22.63],
            worldScale: 0.0012,
        },

        /** GLB 解压依赖路径 */
        dracoPath: '/3d/draco/',
        /** 默认环境贴图 */
        environmentUrl: '/3d/environment/sky_1.hdr',
        /** 环境贴图失败时的立方体天空盒 */
        fallbackCubeUrls: [
            '/3d/BlueSky/posx.jpg', '/3d/BlueSky/negx.jpg',
            '/3d/BlueSky/posy.jpg', '/3d/BlueSky/negy.jpg',
            '/3d/BlueSky/posz.jpg', '/3d/BlueSky/negz.jpg',
        ],
        /** createText({ type: '3d-font' }) 的字体文件 */
        fontUrl: '/font/gentilis_regular.typeface.json',
    };
}

/** 已移除的自定义滚轮/极角控制参数（保留提示，避免用户以为还在生效） */
const LEGACY_CONTROL_KEYS = [
    'fixPolarAngle',
    'wheelControlsPolar',
    'wheelPolarStep',
    'polarMin',
    'polarMax',
    'wheelPolarDuration',
    'wheelControlsPitch',
    'pitchSensitivity',
];
let legacyControlWarned = false;

function stripLegacyControlKeys(options = {}) {
    if (!isPlainObject(options.control)) return options;
    const control = { ...options.control };
    let hit = false;
    for (const key of LEGACY_CONTROL_KEYS) {
        if (key in control) {
            delete control[key];
            hit = true;
        }
    }
    if (hit && !legacyControlWarned) {
        legacyControlWarned = true;
        console.warn(
            '[SceneView] fixPolarAngle / wheelControlsPitch / wheelControlsPolar 等自定义滚轮参数已移除，' +
            '现已统一使用 MapControls 原生行为。' + LEGACY_CONTROL_KEYS.join(', ')
        );
    }
    return { ...options, control };
}

/**
 * 生成实例参数：默认值 + 用户配置深合并
 * @param {object} options
 * @returns {object}
 */
export function createParams(options = {}) {
    const cleanOptions = stripLegacyControlKeys(options || {});
    const params = deepMerge(createDefaultParams(), cleanOptions);

    // 数值兜底：容器尺寸为 0 时避免 aspect 出现 NaN
    if (params.quality.maxPixelRatio <= 0) params.quality.maxPixelRatio = 1;

    return params;
}
