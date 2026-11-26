/**
 * 开发调试工具：Stats / lil-gui / 灯光辅助 / 网格
 *
 * 只在开发模式挂载，不参与正式渲染链路。
 * 这里集中处理"改参数 → 立刻作用到 three 对象"的绑定，避免污染主类。
 */
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

export class DevTools {
    /** @param {object} view SceneView 实例（只读取其公开成员） */
    constructor(view) {
        this.view = view;
        this.stats = null;
        this.gui = null;
        this.directionalLightHelper = null;
        this.hemisphereLightHelper = null;
        this.axesHelper = null;
        this.grid = null;
        /** 已添加过 GUI 面板的 mesh 标识，替代读取 lil-gui 的私有 _title */
        this.meshFolders = new Set();
    }

    initStats() {
        if (this.stats) return;
        this.stats = new Stats();
        const host = document.getElementById('stats') || this.view.container;
        host.appendChild(this.stats.dom);
    }

    initHelper() {
        const view = this.view;
        if (view.dirLight && !this.directionalLightHelper) {
            this.directionalLightHelper = new THREE.DirectionalLightHelper(view.dirLight, 5);
            view.scene.add(this.directionalLightHelper);
        }
        if (view.hemisphereLight && !this.hemisphereLightHelper) {
            this.hemisphereLightHelper = new THREE.HemisphereLightHelper(view.hemisphereLight, 0.5);
            view.scene.add(this.hemisphereLightHelper);
        }
        if (!this.axesHelper) {
            this.axesHelper = new THREE.AxesHelper(10);
            this.axesHelper.material.depthWrite = false;
            this.axesHelper.material.depthTest = false;
            this.axesHelper.material.transparent = true;
            view.scene.add(this.axesHelper);
        }
    }

    initGrid(size = 1000, divisions = 100) {
        if (this.grid) return;
        this.grid = new THREE.GridHelper(size, divisions);
        this.grid.material.opacity = 0.2;
        this.grid.material.depthWrite = false;
        this.grid.material.transparent = true;
        this.view.scene.add(this.grid);
    }

    initGUI() {
        if (this.gui) return;
        const view = this.view;
        const params = view.params;
        const gui = new GUI();
        this.gui = gui;
        gui.$title.innerHTML = '场景设置';

        // 迷雾
        if (params.fog.enabled) {
            if (params.fog.type === 'Fog') {
                gui.add(params.fog, 'near', 0, 1200).name('迷雾最近').onChange((value) => {
                    if (view.scene.fog) view.scene.fog.near = value;
                });
                gui.add(params.fog, 'far', 0, 2000).name('迷雾最远').onChange((value) => {
                    if (view.scene.fog) view.scene.fog.far = value;
                });
            } else {
                gui.add(params.fog, 'density', 0, 50).name('迷雾浓度').onChange((value) => {
                    if (view.scene.fog) view.scene.fog.density = value;
                });
            }
            gui.addColor(params.fog, 'color').name('迷雾颜色').onChange((value) => {
                if (view.scene.fog) view.scene.fog.color.set(value);
            });
        }

        // 灯光
        const lightFolder = gui.addFolder('灯光设置');
        if (view.dirLight) {
            lightFolder.addColor(params.dirLight, 'color').name('平行光颜色').onChange((value) => {
                view.dirLight.color.set(value);
            });
            lightFolder.add(params.dirLight, 'intensity', 0, 12).name('平行光强度').onChange((value) => {
                view.dirLight.intensity = value;
            });
            lightFolder.add(params.dirLight.position, 'x', -200, 200).name('平行光位置X').onChange((value) => {
                view.dirLight.position.x = value;
            });
            lightFolder.add(params.dirLight.position, 'y', -200, 200).name('平行光位置Y').onChange((value) => {
                view.dirLight.position.y = value;
            });
            lightFolder.add(params.dirLight.position, 'z', -200, 200).name('平行光位置Z').onChange((value) => {
                view.dirLight.position.z = value;
            });
            lightFolder.add(params.dirLight, 'shadowIntensity', 0, 1).name('阴影浓度').onChange((value) => {
                view.dirLight.shadow.intensity = value;
                if (view.renderer) view.renderer.shadowMap.needsUpdate = true;
            });
            lightFolder.add(params.quality, 'envMapIntensity', 0, 2).name('环境反射强度').onChange((value) => {
                view.scene.traverse((child) => {
                    if (!child.isMesh) return;
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => {
                        if (material && (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) {
                            material.envMapIntensity = value;
                        }
                    });
                });
            });

            if (view.ambLight) {
                lightFolder.addColor(params.ambLight, 'color').name('环境光颜色').onChange((value) => {
                    view.ambLight.color.set(value);
                });
                lightFolder.add(params.ambLight, 'intensity', 0, 5).name('环境光强度').onChange((value) => {
                    view.ambLight.intensity = value;
                });
            }

            if (view.hemisphereLight) {
                lightFolder.addColor(params.hemiLight, 'skyColor').name('半球光天空色').onChange((value) => {
                    view.hemisphereLight.color.set(value);
                });
                lightFolder.addColor(params.hemiLight, 'groundColor').name('半球光地面色').onChange((value) => {
                    view.hemisphereLight.groundColor.set(value);
                });
                lightFolder.add(params.hemiLight, 'intensity', 0, 3).name('半球光强度').onChange((value) => {
                    view.hemisphereLight.intensity = value;
                });
            }
        }

        // 后期处理
        if (params.postProcessing.enabled) {
            const pp = params.postProcessing;
            const ppFolder = gui.addFolder('后期处理');

            const bloomFolder = ppFolder.addFolder('泛光 Bloom');
            bloomFolder.add(pp.bloom, 'enabled').name('启用').onChange((value) => {
                if (view.bloomPass) view.bloomPass.enabled = value;
            });
            bloomFolder.add(pp.bloom, 'strength', 0, 3).name('强度').onChange((value) => {
                if (view.bloomPass) view.bloomPass.strength = value;
            });
            bloomFolder.add(pp.bloom, 'radius', 0, 1).name('半径').onChange((value) => {
                if (view.bloomPass) view.bloomPass.radius = value;
            });
            bloomFolder.add(pp.bloom, 'threshold', 0, 1).name('阈值').onChange((value) => {
                if (view.bloomPass) view.bloomPass.threshold = value;
            });

            const vigFolder = ppFolder.addFolder('暗角 Vignette');
            vigFolder.add(pp.vignette, 'enabled').name('启用').onChange((value) => {
                if (view.vignettePass) view.vignettePass.enabled = value;
            });
            vigFolder.add(pp.vignette, 'offset', 0, 2).name('偏移').onChange((value) => {
                if (view.vignettePass) view.vignettePass.uniforms.offset.value = value;
            });
            vigFolder.add(pp.vignette, 'darkness', 0, 1).name('暗度').onChange((value) => {
                if (view.vignettePass) view.vignettePass.uniforms.darkness.value = value;
            });

            const filmFolder = ppFolder.addFolder('胶片 Film');
            filmFolder.add(pp.film, 'enabled').name('启用').onChange((value) => {
                if (view.filmPass) view.filmPass.enabled = value;
            });
            filmFolder.add(pp.film, 'noiseIntensity', 0, 2).name('噪点强度').onChange((value) => {
                if (view.filmPass) view.filmPass.uniforms.nIntensity.value = value;
            });

            const bokehFolder = ppFolder.addFolder('景深 Bokeh');
            bokehFolder.add(pp.bokeh, 'enabled').name('启用').onChange((value) => {
                if (view.bokehPass) view.bokehPass.enabled = value;
            });
            bokehFolder.add(pp.bokeh, 'focus', 0, 10).name('焦距').onChange((value) => {
                if (view.bokehPass) view.bokehPass.uniforms.focus.value = value;
            });
            bokehFolder.add(pp.bokeh, 'aperture', 0, 0.01).name('光圈').onChange((value) => {
                if (view.bokehPass) view.bokehPass.uniforms.aperture.value = value;
            });

            const outputFolder = ppFolder.addFolder('色调映射');
            outputFolder.add(pp.output, 'toneMappingExposure', 0, 3).name('曝光度').onChange((value) => {
                if (view.renderer) view.renderer.toneMappingExposure = value;
            });

            const outlineFolder = ppFolder.addFolder('描边 Outline');
            outlineFolder.add(pp.outline, 'enabled').name('启用').onChange((value) => {
                if (view.outlinePass) view.outlinePass.enabled = value;
            });
            outlineFolder.add(pp.outline, 'edgeStrength', 0, 20).name('边缘强度').onChange((value) => {
                if (view.outlinePass) view.outlinePass.edgeStrength = value;
            });
            outlineFolder.add(pp.outline, 'edgeGlow', 0, 5).name('辉光').onChange((value) => {
                if (view.outlinePass) view.outlinePass.edgeGlow = value;
            });
            outlineFolder.add(pp.outline, 'edgeThickness', 0, 5).name('边缘厚度').onChange((value) => {
                if (view.outlinePass) view.outlinePass.edgeThickness = value;
            });
            outlineFolder.add(pp.outline, 'pulsePeriod', 0, 5).name('闪烁周期').onChange((value) => {
                if (view.outlinePass) view.outlinePass.pulsePeriod = value;
            });
        }

        // 控制器
        if (view.controls) {
            gui.add(params.control, 'autoRotate').name('自动旋转').onChange((value) => {
                view.controls.autoRotate = value;
            });
            gui.add(params.control, 'enableDamping').name('启用阻尼').onChange((value) => {
                view.controls.enableDamping = value;
            });
        }
    }

    /**
     * 给单个模型加材质面板
     * 注意：THREE.Color 没有 .value，必须用 color.set()
     */
    addGuiMesh(mesh) {
        if (!this.gui || !mesh || !mesh.material) return;
        const material = mesh.material;
        const key = `${mesh.name}__${material.uuid || material.name || ''}`;
        if (this.meshFolders.has(key)) return;
        this.meshFolders.add(key);

        const folder = this.gui.addFolder(`${mesh.name}材质设置(${material.name || ''})`);

        if (material.isFresnelMaterial) {
            if (material.metalness !== undefined) {
                folder.add(material, 'metalness', 0, 1).name('金属度metalness').onChange((value) => {
                    material.metalness = value;
                });
            }
            if (material.roughness !== undefined) {
                folder.add(material, 'roughness', 0, 1).name('粗糙度roughness').onChange((value) => {
                    material.roughness = value;
                });
            }
            return;
        }

        if (material.color) {
            folder.addColor(material, 'color').name('颜色').onChange((value) => {
                material.color.set(value);
            });
        }
        if (material.roughness !== undefined) {
            folder.add(material, 'roughness', 0, 1).name('粗糙度roughness').onChange((value) => {
                material.roughness = value;
            });
        }
        if (material.metalness !== undefined) {
            folder.add(material, 'metalness', 0, 1).name('金属度metalness').onChange((value) => {
                material.metalness = value;
            });
        }
        if (material.isMeshPhysicalMaterial) {
            folder.add(material, 'reflectivity', 0, 1).name('反射率reflectivity').onChange((value) => {
                material.reflectivity = value;
            });
            folder.add(material, 'transmission', 0, 1).name('透射率transmission').onChange((value) => {
                material.transmission = value;
            });
            folder.add(material, 'ior', 0, 3).name('折射率ior').onChange((value) => {
                material.ior = value;
            });
            folder.add(material, 'thickness', 0, 1).name('厚度thickness').onChange((value) => {
                material.thickness = value;
            });
        }
    }

    /** 每帧更新 Stats */
    update() {
        if (this.stats) this.stats.update();
    }

    dispose() {
        if (this.gui) {
            this.gui.destroy();
            this.gui = null;
        }
        if (this.stats && this.stats.dom && this.stats.dom.parentNode) {
            this.stats.dom.parentNode.removeChild(this.stats.dom);
        }
        this.stats = null;
        for (const object of [this.directionalLightHelper, this.hemisphereLightHelper, this.axesHelper, this.grid]) {
            if (object && object.parent) object.parent.remove(object);
        }
        this.directionalLightHelper = null;
        this.hemisphereLightHelper = null;
        this.axesHelper = null;
        this.grid = null;
        this.meshFolders.clear();
    }
}
