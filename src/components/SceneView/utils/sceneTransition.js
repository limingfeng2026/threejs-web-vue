import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// ============ Shader 代码 ============
const transitionVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const transitionFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse1;
  uniform sampler2D tDiffuse2;
  uniform float mixRatio;
  uniform int transitionType;
  uniform vec2 resolution;
  uniform float edgeSoftness;
  uniform vec2 center;        // ★ 新增：圆形中心位置 (UV坐标 0~1)
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec4 color1 = texture2D(tDiffuse1, vUv);
    vec4 color2 = texture2D(tDiffuse2, vUv);
    float blend = mixRatio;

    if (transitionType == 0) {
      gl_FragColor = mix(color1, color2, blend);
    }
    else if (transitionType == 1) {
      float noise = random(vUv * resolution.xy * 0.5);
      float threshold = blend;
      float mask = step(threshold, noise);
      float softEdge = smoothstep(threshold - edgeSoftness, threshold + edgeSoftness, noise);
      mask = mix(mask, softEdge, 0.3);
      gl_FragColor = mix(color2, color1, mask);
    }
    else if (transitionType == 2) {
      float edge = blend;
      float mask = step(edge, vUv.x);
      float softEdge = smoothstep(edge - edgeSoftness, edge + edgeSoftness, vUv.x);
      mask = mix(mask, softEdge, 0.5);
      gl_FragColor = mix(color2, color1, mask);
    }
    else if (transitionType == 3) {
      float edge = blend;
      float mask = step(edge, vUv.y);
      float softEdge = smoothstep(edge - edgeSoftness, edge + edgeSoftness, vUv.y);
      mask = mix(mask, softEdge, 0.5);
      gl_FragColor = mix(color1, color2, mask);
    }else if (transitionType == 4 || transitionType == 5) {
      vec2 uvCorrected = (vUv - center);
      uvCorrected.x *= resolution.x / resolution.y;
      float dist = length(uvCorrected);
      float aspect = resolution.x / resolution.y;
      float maxRadius = 0.5 * sqrt(aspect * aspect + 1.0);
      
      float r = transitionType == 4 ? blend * maxRadius : (1.0 - blend) * maxRadius;
      
      // 1. 基础圆形混合（宽柔和边缘）
      float softness = edgeSoftness * maxRadius * 3.0;
      float innerMask = smoothstep(r - softness, r, dist);
      vec4 baseColor = transitionType == 4
        ? mix(color2, color1, innerMask)
        : mix(color1, color2, innerMask);
      
      // ★ 2. 外圈大白环（向外扩散 + 向内渐变透明）
      float outerWidth = softness * 2.5;
      float outerDist = abs(dist - r);
      float outerGlow = 1.0 - smoothstep(0.0, outerWidth, outerDist);
      outerGlow = pow(outerGlow, 1.5);
      
      // ★ 3. 内圈小白环（在主圆内侧 15% 处）
      float innerR = r * 0.85;
      float innerWidth = softness * 1.2;
      float innerRingDist = abs(dist - innerR);
      float innerGlow = 1.0 - smoothstep(0.0, innerWidth, innerRingDist);
      innerGlow = pow(innerGlow, 2.5);
      
      // 4. 发光颜色
      vec3 glowColor = vec3(0.5, 0.95, 1.0);
      
      // ★ 5. 径向渐变：圆内从中心向外渐暗
      float radialFade = 1.0 - (dist / maxRadius) * 0.2;
      
      // 6. 合成：基础色 + 外圈光 + 内圈光
      vec3 result = baseColor.rgb * radialFade
        + glowColor * outerGlow * 0.8
        + glowColor * innerGlow * 0.4;
      gl_FragColor = vec4(result, baseColor.a);
    }
    else {
      gl_FragColor = mix(color1, color2, blend);
    }
  }
`;

// ============ TransitionPass (直接继承 Pass，绕过 UniformsUtils.clone) ============
class TransitionPass extends Pass {
  constructor(uniforms) {
    super();
    this.uniforms = uniforms;
    this.material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: transitionVertexShader,
      fragmentShader: transitionFragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }

  render(renderer, writeBuffer, readBuffer) {
    this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      this.fsQuad.render(renderer);
    }
  }

  dispose() {
    this.material.dispose();
    // 注意：不要调用 this.fsQuad.dispose()，因为它会 dispose 共享的全屏四边形几何体
  }
}

// ============ SceneTransition 类 ============
export class SceneTransition {
  constructor(renderer, composer, options = {}) {
    this.renderer = renderer;
    this.composer = composer;

    const pr = window.devicePixelRatio || 1;
    this.width = (options.width || window.innerWidth) * pr;
    this.height = (options.height || window.innerHeight) * pr;
    this.transitionDuration = options.duration || 1.0;
    this.transitionType = options.type ?? 0;
    this.edgeSoftness = options.softness ?? 0.04;
    this.onComplete = options.onComplete || null;

    this.currentScene = null;
    this.currentCamera = null;
    this.nextScene = null;
    this.nextCamera = null;

    // 离屏渲染目标
    this.renderTarget1 = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.renderTarget2 = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    // 过渡 Shader 的 uniforms
    this._uniforms = {
      tDiffuse1: { value: this.renderTarget1.texture },
      tDiffuse2: { value: this.renderTarget2.texture },
      mixRatio: { value: 0.0 },
      transitionType: { value: this.transitionType },
      resolution: { value: new THREE.Vector2(this.width, this.height) },
      edgeSoftness: { value: this.edgeSoftness },
      center: { value: new THREE.Vector2(0.5, 0.5) },  // ★ 新增，默认屏幕中心
    };

    // 创建 TransitionPass（ShaderPass 会 clone 上面的 uniforms）
    this.transitionPass = new TransitionPass(this._uniforms);
    // 保存 clone 后的 uniforms 引用
    this._passUniforms = this.transitionPass.uniforms;

    // 保存 composer 原始第一个 pass，过渡结束后恢复
    this._originalFirstPass = null;
    // 场景同步回调：由 SceneView 注入，避免这里和 SceneSwitcher 各 patch 一遍 pass
    this.onSceneSync = null;

    this.isTransitioning = false;
    this.progress = 0.0;
    this.elapsedTime = 0.0;
    this.previousTime = 0.0;
  }

  setCurrentScene(scene, camera) {
    this.currentScene = scene;
    this.currentCamera = camera;
  }

  /**
   * 注册场景同步回调：过渡结束时把新场景/相机交给外部统一处理
   * @param {(scene, camera, transition) => void} handler
   */
  setOnSceneSync(handler) {
    this.onSceneSync = typeof handler === 'function' ? handler : null;
  }

  /** 过渡期间被临时顶替的 RenderPass，外部同步 pass 时需要它 */
  getPendingRenderPass() {
    return this._originalFirstPass;
  }

  transitionTo(nextScene, nextCamera, options = {}) {
    if (this.isTransitioning) {
      console.warn('[SceneTransition] 正在过渡中，请稍候再试');
      return;
    }

    if (!this.currentScene) {
      this.currentScene = nextScene;
      this.currentCamera = nextCamera;
      return;
    }

    this.nextScene = nextScene;
    this.nextCamera = nextCamera;
    this.transitionType = options.type ?? this.transitionType;
    this.transitionDuration = options.duration ?? this.transitionDuration;
    this.edgeSoftness = options.softness ?? this.edgeSoftness;
    this.onComplete = options.onComplete || null;

    // 更新 pass 的 uniforms
    this._passUniforms.transitionType.value = this.transitionType;
    this._passUniforms.edgeSoftness.value = this.edgeSoftness;

     // ★ 新增：设置圆形中心位置
    if (options.center) {
      this._passUniforms.center.value.set(options.center.x, options.center.y);
    } else {
      this._passUniforms.center.value.set(0.5, 0.5);
    }

    this.isTransitioning = true;
    this.progress = 0.0;
    this.elapsedTime = 0.0;
    this.previousTime = performance.now();

    // ★ 核心：替换 composer 的第一个 pass (RenderPass) 为 TransitionPass
    // 这样后期处理（Bloom, Vignette 等）依然正常工作
    this._originalFirstPass = this.composer.passes[0];
    this.composer.passes[0] = this.transitionPass;
  }

  update(currentTime) {
    if (!this.isTransitioning) return;

    const delta = (currentTime - this.previousTime) / 1000;
    this.previousTime = currentTime;
    this.elapsedTime += delta;

    let t = Math.min(this.elapsedTime / this.transitionDuration, 1.0);
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.progress = t;

    this._passUniforms.mixRatio.value = this.progress;

    if (this.progress >= 1.0) {
      this._finishTransition();
    }
  }

  /**
   * 在 composer.render() 之前调用：
   * 将两个场景渲染到离屏 RT，供 TransitionPass 混合
   */
  preRender() {
    const renderer = this.renderer;

    if (this.currentScene && this.currentCamera) {
      renderer.setRenderTarget(this.renderTarget1);
      renderer.render(this.currentScene, this.currentCamera);
    }

    if (this.isTransitioning && this.nextScene && this.nextCamera) {
      renderer.setRenderTarget(this.renderTarget2);
      renderer.render(this.nextScene, this.nextCamera);
    }

    renderer.setRenderTarget(null);

    this._passUniforms.tDiffuse1.value = this.renderTarget1.texture;
    this._passUniforms.tDiffuse2.value = this.renderTarget2.texture;
  }
_finishTransition() {
    this.isTransitioning = false;

    const newScene = this.nextScene;
    const newCamera = this.nextCamera;

    if (this.composer) {
      // ★ 0. 同步相机 projectionMatrix（防止矩阵不一致）
      if (newCamera) {
        newCamera.updateProjectionMatrix();
      }

      // ★ 1/2. 场景与 pass 同步：优先交给外部注入的统一入口，避免两处各改一遍
      if (typeof this.onSceneSync === 'function') {
        this.onSceneSync(newScene, newCamera, this);
      } else {
        if (this._originalFirstPass) {
          this._originalFirstPass.scene = newScene;
          this._originalFirstPass.camera = newCamera;
        }
        this.composer.passes.forEach(pass => {
          if (pass.scene !== undefined && pass !== this.transitionPass) {
            pass.scene = newScene;
          }
          if (pass.camera !== undefined && pass.camera.type !== 'OrthographicCamera') {
            pass.camera = newCamera;
          }
          if (pass.renderScene !== undefined) {
            pass.renderScene = newScene;
          }
        });
      }

      // ★ 3. 恢复 _originalFirstPass
      if (this._originalFirstPass) {
        this.composer.passes[0] = this._originalFirstPass;
        this._originalFirstPass = null;
      }
    }

    this.currentScene = newScene;
    this.currentCamera = newCamera;
    this.nextScene = null;
    this.nextCamera = null;
    this.progress = 0.0;
    this._passUniforms.mixRatio.value = 0.0;

    if (typeof this.onComplete === 'function') {
      const cb = this.onComplete;
      this.onComplete = null;
      cb(newScene, newCamera);
    }
  }

  resize(width, height) {
    const pr = window.devicePixelRatio || 1;
    const w = width * pr;
    const h = height * pr;
    // 先释放旧的 GL 资源，再 setSize（setSize 内部会触发 WebGLRenderer 重新分配）
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1.setSize(w, h);
    this.renderTarget2.setSize(w, h);
    this.width = w;
    this.height = h;
    this._passUniforms.resolution.value.set(w, h);
  }

  dispose() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.transitionPass.dispose();
    this._originalFirstPass = null;
  }
}