/**
 * 场景切换器：把"过渡动画 + 主引用同步 + 所有 pass 重绑 + GTAO 相机参数 + 拾取场景"
 * 收敛成一个入口，替代外部之前手工执行的 4 步补丁。
 */
export class SceneSwitcher {
    /** @param {object} view SceneView 实例 */
    constructor(view) {
        this.view = view;
    }

    /** 把同步逻辑注册给过渡器，避免两处各自 patch pass */
    bindTransition() {
        const transition = this.view.transition;
        if (transition && typeof transition.setOnSceneSync === 'function') {
            transition.setOnSceneSync((scene, camera, transitionInstance) => {
                this.sync(scene, camera, transitionInstance);
            });
        }
    }

    /**
     * 同步主引用与所有依赖 scene/camera 的部件
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {object|null} [transition] 过渡器实例（过渡中需要补偿尚未归位的 RenderPass）
     */
    sync(scene, camera, transition = null) {
        const view = this.view;
        view.scene = scene;
        view.camera = camera;

        this.syncPasses(scene, camera, transition);
        this.syncGtaoCamera(camera);

        // 拾取对象要跟着换场景，否则射线打的还是旧场景
        if (view.objEvent) {
            if (typeof view.objEvent.setScene === 'function') {
                view.objEvent.setScene(scene);
                view.objEvent.setCamera(camera);
            } else {
                view.objEvent.scene = scene;
                view.objEvent.camera = camera;
            }
        }
    }

    /**
     * 把 composer 里所有 pass 的 scene/camera 指向新场景
     * 过渡期间 RenderPass 被临时替换，需要额外把待归位的那一个也补上
     */
    syncPasses(scene, camera, transition = null) {
        const composer = this.view.composer;
        if (!composer) return;

        const passes = composer.passes.slice();
        if (transition && typeof transition.getPendingRenderPass === 'function') {
            const pending = transition.getPendingRenderPass();
            if (pending && !passes.includes(pending)) passes.push(pending);
        }

        for (const pass of passes) {
            if (!pass || pass === (transition && transition.transitionPass)) continue;

            if (pass.scene !== undefined) pass.scene = scene;
            if (pass.camera !== undefined && !(pass.camera && pass.camera.isOrthographicCamera)) {
                pass.camera = camera;
            }
            if (pass.renderScene !== undefined) pass.renderScene = scene;
            if (pass.renderCamera !== undefined) pass.renderCamera = camera;

            // BokehPass 的 uniform 里缓存的 near/far 也跟随相机
            if (pass.uniforms && pass.uniforms.cameraNear) pass.uniforms.cameraNear.value = camera.near;
            if (pass.uniforms && pass.uniforms.cameraFar) pass.uniforms.cameraFar.value = camera.far;
        }
    }

    /** GTAO 内部缓存的 near/far 与透视标志必须跟随相机，否则深度失真 */
    syncGtaoCamera(camera) {
        const pass = this.view.gtaoPass;
        if (!pass || !camera) return;

        if (pass.gtaoMaterial && pass.gtaoMaterial.uniforms) {
            pass.gtaoMaterial.uniforms.cameraNear.value = camera.near;
            pass.gtaoMaterial.uniforms.cameraFar.value = camera.far;
            if (pass.gtaoMaterial.defines) {
                pass.gtaoMaterial.defines.PERSPECTIVE_CAMERA = camera.isPerspectiveCamera ? 1 : 0;
            }
            pass.gtaoMaterial.needsUpdate = true;
        }
        if (pass.depthRenderMaterial && pass.depthRenderMaterial.uniforms) {
            pass.depthRenderMaterial.uniforms.cameraNear.value = camera.near;
            pass.depthRenderMaterial.uniforms.cameraFar.value = camera.far;
            pass.depthRenderMaterial.needsUpdate = true;
        }
    }

    /**
     * 一站式切场景
     * @param {object} options
     * @param {THREE.Scene} options.scene 目标场景
     * @param {THREE.Camera} options.camera 目标相机
     * @param {object|false} [options.transition] 过渡参数 { type, duration, center, softness }；false 表示立即切换
     * @param {() => void} [options.onComplete] 切换完成回调
     * @param {boolean} [options.syncControls] 是否用目标相机重建控制器
     * @param {THREE.Vector3} [options.target] 重建控制器时的目标点
     * @param {boolean|THREE.Texture} [options.environment] 为 true 时继承当前环境贴图，也可直接传贴图
     * @returns {Promise<boolean>} 是否完成切换
     */
    switchScene({ scene, camera, transition, onComplete, syncControls = false, target, environment } = {}) {
        if (!scene || !camera) {
            console.warn('[SceneView] switchScene 需要 scene 与 camera');
            return Promise.resolve(false);
        }

        const view = this.view;
        const inheritedEnvironment = environment === true ? view.scene && view.scene.environment : environment;

        return new Promise((resolve) => {
            const finish = () => {
                this.sync(scene, camera);
                if (inheritedEnvironment) scene.environment = inheritedEnvironment;
                if (syncControls) view.updateControls(camera, target);
                if (typeof onComplete === 'function') onComplete(scene, camera);
                resolve(true);
            };

            const transitioner = view.transition;
            if (!transitioner || transition === false || !view.composer) {
                finish();
                return;
            }

            if (transitioner.isTransitioning) {
                console.warn('[SceneView] 正在过渡中，switchScene 已忽略本次调用');
                resolve(false);
                return;
            }

            const options = typeof transition === 'object' ? transition : {};
            transitioner.transitionTo(scene, camera, {
                ...options,
                onComplete: finish,
            });
        });
    }
}
