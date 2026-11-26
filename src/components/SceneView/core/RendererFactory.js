/**
 * 渲染器 / 后期处理管线工厂
 *
 * 只做"创建、尺寸同步、释放"三件事，不持有业务状态。
 * 所有 pass 统一由本模块按固定顺序装配：
 * Render → GTAO → Bloom → SMAA → Vignette → Film → Bokeh → Outline → Output
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** 暗角：四角压暗，中心保持原亮度 */
const VIGNETTE_SHADER = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.6 },
        darkness: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D( tDiffuse, vUv );
            vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );
            float vignette = 1.0 - darkness * dot( uv, uv );
            gl_FragColor = vec4( texel.rgb * vignette, texel.a );
        }
    `,
};

/**
 * 创建 WebGLRenderer 并挂到容器
 * @param {{ container: HTMLElement, params: object }} options
 * @returns {{ renderer: THREE.WebGLRenderer, maxAnisotropy: number }}
 */
export function createRenderer({ container, params }) {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,           // 抗锯齿交给 SMAA，省一份 MSAA 开销
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
    });

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, params.quality.maxPixelRatio));
    renderer.setSize(width, height);

    // 颜色管理：线性工作流 + sRGB 输出 + ACES 电影级色调映射
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 阴影：PCF 比 VSM 更实、对比更强（VSM 会过度模糊导致阴影发灰）
    // 注意：r185 起 PCFSoftShadowMap 已弃用，three 内部会静默降级成 PCFShadowMap。
    // 这里直接显式给 PCFShadowMap，行为不变、还少一条控制台警告。
    renderer.shadowMap.enabled = params.shadowMapEnabled !== false;
    renderer.shadowMap.type = params.shadowMapType ?? THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    return { renderer, maxAnisotropy };
}

/**
 * 创建后期处理管线
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, params: object }} options
 * @returns {object} 各 pass 引用集合（未启用的为 null）
 */
export function createPostProcessing({ renderer, scene, camera, params, width, height }) {
    const pp = params.postProcessing;
    const result = {
        composer: null,
        renderPass: null,
        gtaoPass: null,
        bloomPass: null,
        smaaPass: null,
        vignettePass: null,
        filmPass: null,
        bokehPass: null,
        outlinePass: null,
        outputPass: null,
    };
    if (!pp.enabled) return result;

    const w = Math.max(width || renderer.domElement.clientWidth || 1, 1);
    const h = Math.max(height || renderer.domElement.clientHeight || 1, 1);
    const size = new THREE.Vector2(w, h);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, params.quality.maxPixelRatio));
    composer.setSize(size.x, size.y);
    result.composer = composer;

    // 1. 场景渲染
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    result.renderPass = renderPass;

    // 2. GTAO 环境光遮蔽（物体接触处的柔和暗部）
    if (pp.gtao && pp.gtao.enabled) {
        const gtaoPass = new GTAOPass(scene, camera, size.x, size.y);
        gtaoPass.output = GTAOPass.OUTPUT.Default;
        gtaoPass.blendIntensity = pp.gtao.blendIntensity;
        gtaoPass.updateGtaoMaterial({
            radius: pp.gtao.radius,
            distanceExponent: pp.gtao.distanceExponent,
            thickness: pp.gtao.thickness,
            scale: pp.gtao.scale,
            samples: pp.gtao.samples,
            distanceFallOff: pp.gtao.distanceFallOff,
        });
        gtaoPass.updatePdMaterial({
            lumaPhi: pp.gtao.lumaPhi,
            depthPhi: pp.gtao.depthPhi,
            normalPhi: pp.gtao.normalPhi,
            radius: pp.gtao.denoiseRadius,
            rings: pp.gtao.denoiseRings,
            samples: pp.gtao.denoiseSamples,
        });
        composer.addPass(gtaoPass);
        result.gtaoPass = gtaoPass;
    }

    // 3. 泛光
    if (pp.bloom && pp.bloom.enabled) {
        const bloomPass = new UnrealBloomPass(size, pp.bloom.strength, pp.bloom.radius, pp.bloom.threshold);
        composer.addPass(bloomPass);
        result.bloomPass = bloomPass;
    }

    // 4. SMAA 抗锯齿（r185 构造函数无参，尺寸由 composer.setSize 统一分发）
    if (pp.smaa && pp.smaa.enabled) {
        const smaaPass = new SMAAPass();
        composer.addPass(smaaPass);
        result.smaaPass = smaaPass;
    }

    // 5. 暗角
    if (pp.vignette && pp.vignette.enabled) {
        const vignettePass = new ShaderPass(VIGNETTE_SHADER);
        vignettePass.uniforms.offset.value = pp.vignette.offset;
        vignettePass.uniforms.darkness.value = pp.vignette.darkness;
        composer.addPass(vignettePass);
        result.vignettePass = vignettePass;
    }

    // 6. 胶片噪点
    if (pp.film && pp.film.enabled) {
        const filmPass = new FilmPass(
            pp.film.noiseIntensity,
            pp.film.scanlinesIntensity,
            pp.film.scanlinesCount,
            false
        );
        composer.addPass(filmPass);
        result.filmPass = filmPass;
    }

    // 7. 景深
    if (pp.bokeh && pp.bokeh.enabled) {
        const bokehPass = new BokehPass(scene, camera, {
            focus: pp.bokeh.focus,
            aperture: pp.bokeh.aperture,
            maxblur: pp.bokeh.maxblur,
        });
        composer.addPass(bokehPass);
        result.bokehPass = bokehPass;
    }

    // 8. 描边
    if (pp.outline && pp.outline.enabled) {
        const outlinePass = new OutlinePass(new THREE.Vector2(size.x, size.y), scene, camera);
        outlinePass.edgeStrength = pp.outline.edgeStrength;
        outlinePass.edgeGlow = pp.outline.edgeGlow;
        outlinePass.edgeThickness = pp.outline.edgeThickness;
        outlinePass.pulsePeriod = pp.outline.pulsePeriod;
        outlinePass.visibleEdgeColor.copy(pp.outline.visibleEdgeColor);
        outlinePass.hiddenEdgeColor.copy(pp.outline.hiddenEdgeColor);
        composer.addPass(outlinePass);
        result.outlinePass = outlinePass;
    }

    // 9. 最终输出（色调映射 + 色彩空间）
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    result.outputPass = outputPass;

    // pass 全部装配完再统一尺寸，保证后加入的 pass 也拿到正确分辨率
    composer.setPixelRatio(Math.min(window.devicePixelRatio, params.quality.maxPixelRatio));
    composer.setSize(size.x, size.y);

    applyToneMapping(renderer, pp);
    return result;
}

/** 应用 OutputPass 对应的色调映射与曝光 */
export function applyToneMapping(renderer, postProcessing) {
    const output = postProcessing && postProcessing.output;
    if (!output) return;
    if (output.toneMapping !== undefined) renderer.toneMapping = output.toneMapping;
    if (output.toneMappingExposure !== undefined) renderer.toneMappingExposure = output.toneMappingExposure;
}

/** 尺寸变化时同步所有 pass 与合成器 */
export function resizePostProcessing(context, width, height, pixelRatio) {
    if (!context || !context.composer) return;
    context.composer.setPixelRatio(pixelRatio);
    context.composer.setSize(width, height);
    if (context.outlinePass) context.outlinePass.setSize(width, height);
    if (context.gtaoPass) context.gtaoPass.setSize(width, height);
}

/** 释放后期管线 */
export function disposePostProcessing(context) {
    if (!context) return;
    if (context.gtaoPass) {
        context.gtaoPass.dispose();
        context.gtaoPass = null;
    }
    if (context.composer) {
        context.composer.dispose();
        context.composer = null;
    }
    context.renderPass = null;
    context.bloomPass = null;
    context.smaaPass = null;
    context.vignettePass = null;
    context.filmPass = null;
    context.bokehPass = null;
    context.outlinePass = null;
    context.outputPass = null;
}
