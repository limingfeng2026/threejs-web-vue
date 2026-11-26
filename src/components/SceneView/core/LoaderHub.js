/**
 * 模型加载中心
 *
 * 目标：与 three.js 原生 Loader 一致的四参回调 load(url, onLoad, onProgress, onError)，
 * 并且整个实例只创建一套 GLTF/DRACO/FBX/HDR Loader（避免每加载一个模型就新建一批 Draco worker）。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/** 百分比进度只在这一份里算，避免各 loader 重复计算口径 */
function createProgressReporter(onProgress) {
    if (typeof onProgress !== 'function') return undefined;
    return (xhr) => {
        if (!xhr || !(xhr.total > 0)) return;
        const progress = Math.round((xhr.loaded / xhr.total) * 100);
        onProgress(xhr, progress);
    };
}

export class LoaderHub {
    /**
     * @param {object} params SceneView 参数
     * @param {{ optimizeMaterials?: (root: THREE.Object3D) => void }} [hooks]
     */
    constructor(params, hooks = {}) {
        this.params = params;
        this.hooks = hooks;
        /** 所有 FBX/GLB 动画混合器：{ mixer, actions } */
        this.mixers = [];

        // GLTF：Draco + Meshopt 各只装一次
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(params.dracoPath);
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(dracoLoader);
        this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        this.dracoLoader = dracoLoader;

        this.fbxLoader = new FBXLoader();
        this.hdrLoader = new HDRLoader();
    }

    /**
     * 加载 GLB / GLTF
     * @param {string} url
     * @param {(gltf: object) => void} [onLoad]
     * @param {(xhr: XMLHttpRequest, progress: number) => void} [onProgress]
     * @param {(error: unknown) => void} [onError]
     */
    loadGLB(url, onLoad, onProgress, onError) {
        this.gltfLoader.load(
            url,
            (gltf) => {
                if (this.hooks.optimizeMaterials) this.hooks.optimizeMaterials(gltf.scene);
                if (typeof onLoad === 'function') onLoad(gltf);
            },
            createProgressReporter(onProgress),
            (error) => {
                console.error('[SceneView] GLB 加载失败:', url, error);
                if (typeof onError === 'function') onError(error);
            }
        );
    }

    /**
     * 加载 FBX
     * @param {string} url
     * @param {(fbx: THREE.Group, mixer: THREE.AnimationMixer|null) => void} [onLoad]
     * @param {(xhr: XMLHttpRequest, progress: number) => void} [onProgress]
     * @param {(error: unknown) => void} [onError]
     * @param {{ texturePath?: string, enableShadow?: boolean, autoPlay?: boolean }} [options]
     */
    loadFBX(url, onLoad, onProgress, onError, options = {}) {
        const { texturePath, enableShadow = true, autoPlay = true } = options;
        if (texturePath) this.fbxLoader.setResourcePath(texturePath);

        this.fbxLoader.load(
            url,
            (fbx) => {
                if (texturePath) this.fbxLoader.setResourcePath('');

                if (enableShadow) {
                    fbx.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }

                // 有动画就建混合器，交给 SceneView 的主循环统一 update
                let mixer = null;
                if (fbx.animations && fbx.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(fbx);
                    const actions = fbx.animations.map((clip) => mixer.clipAction(clip));
                    if (autoPlay) actions.forEach((action) => action.play());
                    this.mixers.push({ mixer, actions });
                }

                if (typeof onLoad === 'function') onLoad(fbx, mixer);
            },
            createProgressReporter(onProgress),
            (error) => {
                if (texturePath) this.fbxLoader.setResourcePath('');
                console.error('[SceneView] FBX 加载失败:', url, error);
                if (typeof onError === 'function') onError(error);
            }
        );
    }

    /**
     * 加载 HDR 环境贴图（返回原始 equirectangular 纹理，PMREM 由调用方处理）
     * @param {string} url
     * @param {(texture: THREE.Texture) => void} onLoad
     * @param {(error: unknown) => void} [onError]
     */
    loadHDR(url, onLoad, onError) {
        this.hdrLoader.load(
            url,
            (texture) => {
                if (typeof onLoad === 'function') onLoad(texture);
            },
            undefined,
            (error) => {
                console.warn('[SceneView] HDR 加载失败，将使用备用天空盒:', url);
                if (typeof onError === 'function') onError(error);
            }
        );
    }

    /** 逐帧更新所有混合器 */
    updateMixers(delta) {
        for (const item of this.mixers) {
            const mixer = item && item.mixer ? item.mixer : item;
            if (mixer && typeof mixer.update === 'function') mixer.update(delta);
        }
    }

    dispose() {
        if (this.dracoLoader) {
            this.dracoLoader.dispose();
            this.dracoLoader = null;
        }
        this.mixers = [];
        this.gltfLoader = null;
        this.fbxLoader = null;
        this.hdrLoader = null;
    }
}
