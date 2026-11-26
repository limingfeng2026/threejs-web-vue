/**
 * FloorReflection —— 地板反射叠加层
 *
 * 设计说明：
 * 1. 不替换原地板：原地板继续走 PBR 受光材质（保留漫反射、贴图、AO），
 *    本模块只在同一位置叠一层「菲涅尔反射 + 9 采样柔化模糊」的低分辨率反射面。
 * 2. 反射面尺寸由原地板的包围盒推出（世界空间 X/Z），与原地板严格同位置同朝向，
 *    因此模型整体旋转/位移后，反射层跟着一起转，不会立起来或错位。
 * 3. 反射层关深度写入 + 负 polygonOffset，避免与原地板 Z-Fighting。
 * 4. 全部参数来自 config.js 的 `floorReflection`，可在构造函数 options 里深合并覆盖，
 *    也可在单次 add() 时按需微调。
 */
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { deepMerge } from '../config.js';

export const FLOOR_REFLECT_SHADER_NAME = 'FloorReflectOverlay';

/**
 * 生成地板反射用的 Shader（结构完全对齐 Reflector 的约定）
 * @param {object} [options] 见 config.floorReflection
 * @returns {{ name: string, uniforms: object, vertexShader: string, fragmentShader: string }}
 */
export function createFloorReflectShader(options = {}) {
    const {
        color = 0xbcd6ff,
        reflectStrength = 0.6,
        fresnelPower = 1.5,
        texelSize = 512,
        blur = 1.0,
        edgeFade = 0.6,
        name = FLOOR_REFLECT_SHADER_NAME,
    } = options;

    return {
        name,
        uniforms: {
            'color': { value: new THREE.Color(color) },
            'tDiffuse': { value: null },
            'textureMatrix': { value: null },
            'uReflectStrength': { value: reflectStrength },
            'uFresnelPower': { value: fresnelPower },
            'uTexel': { value: new THREE.Vector2(1 / texelSize, 1 / texelSize) },
            'uBlur': { value: blur },
            'uEdgeFade': { value: edgeFade },
        },
        vertexShader: /* glsl */`
            uniform mat4 textureMatrix;
            varying vec4 vUv;
            varying vec3 vWorldPos;
            varying vec3 vNormalW;
            void main() {
              vUv = textureMatrix * vec4(position, 1.0);
              vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
              vNormalW = normalize(mat3(modelMatrix) * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color;
            uniform sampler2D tDiffuse;
            uniform float uReflectStrength;
            uniform float uFresnelPower;
            uniform vec2 uTexel;
            uniform float uBlur;
            uniform float uEdgeFade;
            varying vec4 vUv;
            varying vec3 vWorldPos;
            varying vec3 vNormalW;
            void main() {
              vec3 reflectColor = vec3(0.0);
              float strength = 0.0;

              if (vUv.w > 0.0) {
                vec2 projUv = vUv.xy / vUv.w;
                // 越界区域淡出，避免拉伸涂抹和黑边
                vec2 fade = smoothstep(0.0, uEdgeFade, projUv) * smoothstep(0.0, uEdgeFade, 1.0 - projUv);
                float valid = fade.x * fade.y;

                if (valid > 0.0) {
                  // 9 采样柔化模糊，避免镜面般锐利的反射
                  vec3 sum = vec3(0.0);
                  float weightSum = 0.0;
                  for (int i = -1; i <= 1; i++) {
                    for (int j = -1; j <= 1; j++) {
                      vec2 off = vec2(float(i), float(j)) * uTexel * uBlur;
                      float w = 1.0 / (1.0 + float(i * i + j * j));
                      sum += texture2D(tDiffuse, projUv + off).rgb * w;
                      weightSum += w;
                    }
                  }
                  reflectColor = (sum / weightSum) * color;

                  // 菲涅尔：正视几乎不反光，视线越贴近地面反光越强
                  vec3 viewDir = normalize(cameraPosition - vWorldPos);
                  float fres = pow(1.0 - clamp(dot(viewDir, vNormalW), 0.0, 1.0), uFresnelPower);
                  strength = uReflectStrength * fres * valid;
                }
              }

              gl_FragColor = vec4(reflectColor, strength);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
        `,
    };
}

/**
 * 地板反射层管理器
 *
 * - `items` 里保存每个反射面的记录（reflector / sourceMesh / parent），便于外部排查与卸载
 * - 默认参数取自 SceneView 的 `params.floorReflection`，单次调用可再覆盖
 */
export class FloorReflectionLayer {
    /**
     * @param {() => object} getDefaults 返回当前默认配置（通常是 () => params.floorReflection）
     */
    constructor(getDefaults) {
        this.getDefaults = typeof getDefaults === 'function' ? getDefaults : () => ({});
        /** @type {Array<{ reflector: Reflector, sourceMesh: THREE.Mesh, parent: THREE.Object3D }>} */
        this.items = [];
    }

    /** 合并后的有效配置 */
    resolveOptions(options = {}) {
        return deepMerge(this.getDefaults() || {}, options || {});
    }

    /**
     * 给单块地板叠加反射层
     * @param {THREE.Mesh} mesh 原地板网格
     * @param {object} [options] 覆盖 floorReflection 配置
     * @returns {Reflector|null}
     */
    add(mesh, options = {}) {
        if (!mesh || !mesh.isMesh) {
            console.warn('[FloorReflection] add() 需要传入 Mesh');
            return null;
        }

        const cfg = this.resolveOptions(options);
        if (!cfg.enabled) return null;

        // 同一块地板只允许叠一层：加载流程跑两遍、或同名地板被重复传进来时，
        // 再叠一层就会出现"两个反光源/双影"，这里直接拦掉
        if (mesh.userData && mesh.userData.__floorReflector) {
            console.warn('[FloorReflection] 该地板已有反射层，跳过重复叠加:', mesh.name);
            return null;
        }

        // 世界矩阵必须是最新的，否则包围盒会是旧位置（之前"地板立起来/被缩小"的坑就在这）
        mesh.updateWorldMatrix(true, false);

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 原地板保持受光材质（保留漫反射与贴图），按需关闭接收阴影
        mesh.receiveShadow = cfg.receiveShadow;
        if (mesh.material) mesh.material.needsUpdate = true;

        const shader = createFloorReflectShader(cfg);
        const geometry = new THREE.PlaneGeometry(
            Math.max(size.x, 1e-4),
            Math.max(size.z, 1e-4)
        );

        const reflector = new Reflector(geometry, {
            clipBias: cfg.clipBias,
            textureWidth: cfg.textureSize,
            textureHeight: cfg.textureSize,
            color: cfg.color,
            multisample: cfg.multisample,
            shader,
        });

        reflector.name = cfg.name || FLOOR_REFLECT_SHADER_NAME;
        // 贴到地板顶面（box.max.y）而非包围盒中心，避免反射面埋进有厚度的地板盒；
        // 再沿法线抬升一个微小间隙，与原地板顶面错开，消除共面 Z-fighting
        reflector.position.set(center.x, box.max.y + (cfg.reflectGap || 0), center.z);
        reflector.rotation.x = -Math.PI / 2;
        reflector.material.transparent = true;
        reflector.material.depthWrite = false;
        reflector.material.polygonOffset = true;
        reflector.material.polygonOffsetFactor = cfg.polygonOffsetFactor;
        reflector.material.polygonOffsetUnits = cfg.polygonOffsetUnits;
        reflector.renderOrder = cfg.renderOrder;
        reflector.userData = Object.assign({}, reflector.userData, {
            isFloorReflection: true,
            sourceMesh: mesh.uuid,
        });

        const parent = mesh.parent || mesh;
        parent.add(reflector);
        mesh.userData.__floorReflector = reflector;

        this.items.push({ reflector, sourceMesh: mesh, parent });
        return reflector;
    }

    /**
     * 给一块或多块地板叠加反射层
     *
     * 直接由调用方把目标 Mesh 传进来，封装不再遍历模型树、不按名称匹配；
     * 传入单个 Mesh 或 Mesh 数组均可，非 Mesh 会被跳过并告警。
     *
     * @param {THREE.Mesh|THREE.Mesh[]} meshes 地板网格
     * @param {object} [options] 覆盖 floorReflection 配置
     * @returns {Reflector[]} 本次成功创建的反射面
     */
    addList(meshes, options = {}) {
        const list = Array.isArray(meshes) ? meshes : (meshes ? [meshes] : []);

        const created = [];
        for (const mesh of list) {
            const reflector = this.add(mesh, options);
            if (reflector) created.push(reflector);
        }
        return created;
    }

    /** 移除并释放所有反射层 */
    dispose() {
        for (const item of this.items) {
            this._disposeReflector(item.reflector, item.parent, item.sourceMesh);
        }
        this.items.length = 0;
        return this;
    }

    _disposeReflector(reflector, parent, sourceMesh) {
        if (!reflector) return;
        if (parent && reflector.parent === parent) parent.remove(reflector);
        else if (reflector.parent) reflector.parent.remove(reflector);

        // 解开去重标记，下次还能重新挂
        if (sourceMesh && sourceMesh.userData && sourceMesh.userData.__floorReflector === reflector) {
            delete sourceMesh.userData.__floorReflector;
        }

        if (reflector.geometry) reflector.geometry.dispose();
        if (reflector.material) reflector.material.dispose();

        // Reflector 内部持有 WebGLRenderTarget，不释放会漏显存
        if (typeof reflector.getRenderTarget === 'function') {
            const target = reflector.getRenderTarget();
            if (target && typeof target.dispose === 'function') target.dispose();
        }
    }
}

export default FloorReflectionLayer;
