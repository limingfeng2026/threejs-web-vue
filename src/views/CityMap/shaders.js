// ==================== 长沙城市大屏着色器集合 ====================
// 统一从本文件导出，页面内不再内联 shader 字符串

// ---------- 巡游飞线：Points 流光（迁移自源案例，无 maptalks 依赖） ----------
export const flyLineVertex = /* glsl */ `
attribute float index;
attribute float current;
uniform float size;
uniform vec3 uColor;
uniform vec3 uColor1;
uniform float uRange;
uniform float uTotal;
uniform float iTime;
varying vec3 vColor;
varying float vOpacity;
void main() {
  float showNumber = uTotal * mod(iTime / 2.0, 1.0);
  float s = size;
  if (showNumber > current && showNumber < current + uRange) {
    vOpacity = 1.0;
    s *= (current + uRange - showNumber) / uRange;
  } else {
    vOpacity = 0.0;
    s = 0.0;
  }
  vColor = mix(uColor, uColor1, index);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = s * 5.0 / (-mvPosition.z);
}
`

export const flyLineFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor1;
varying vec3 vColor;
varying float vOpacity;
void main() {
  gl_FragColor = vec4(vColor, vOpacity);
}
`

// ---------- 楼体：科技风高度渐变 + 波前抠图 ----------
export const buildingVertex = /* glsl */ `
uniform float uGrow;
varying vec3 vPosition;
varying vec2 vWaveXZ;
#include <fog_pars_vertex>
void main() {
  vPosition = position;
  // 高度生长：z 是楼体的高度轴，按 uGrow 从地面往上长
  vec3 grown = position;
  grown.z *= uGrow;
  vWaveXZ = (modelMatrix * vec4(grown, 1.0)).xz;
  vec4 mvPosition = modelViewMatrix * vec4(grown, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

export const buildingFragment = /* glsl */ `
uniform vec3 uBottom;
uniform vec3 uTop;
uniform float uMaxHeight;
uniform float uWaveR;
uniform float uWaveB;
uniform vec2 uWaveC;
uniform float uWaveOn;
uniform float uSweepR;
uniform float uSweepW;
uniform vec3 uSweepColor;
uniform float uSweepOn;
varying vec3 vPosition;
varying vec2 vWaveXZ;
#include <fog_pars_fragment>
void main() {
  float t = clamp(vPosition.z / uMaxHeight, 0.0, 1.0);
  gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
  #include <fog_fragment>
  // 扩散波：只让半径 R 以内的楼体露脸，换主题时从中心往外推开
  if (uWaveOn > 0.5) {
    float d = length(vWaveXZ - uWaveC);
    gl_FragColor.a *= 1.0 - smoothstep(uWaveR - uWaveB, uWaveR + uWaveB, d);
  }
  // 扫光：一条从中心向外扩散的光带，经过的楼体被提亮
  if (uSweepOn > 0.01) {
    float d = length(vWaveXZ - uWaveC);
    float band = 1.0 - smoothstep(0.0, uSweepW, abs(d - uSweepR));
    // 远处（已吃雾）的楼不加重，否则外圈会糊成一片白
    float fade = 1.0;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        fade = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    gl_FragColor.rgb += uSweepColor * band * uSweepOn * fade;
  }
}
`

// ---------- 地铁线：THREE.Line 流光（亮核 + 身后拖尾） ----------
// 改成 Line 之后没有 uv，用累计弧长归一化的 aProgress 当流光坐标
export const metroVertex = /* glsl */ `
attribute float aProgress;
varying float vProgress;
#include <fog_pars_vertex>
void main() {
  vProgress = aProgress;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

export const metroFragment = /* glsl */ `
uniform vec3 lineColor;
uniform vec3 hiColor;
uniform float iTime;
uniform float uSpeed;
uniform float uPhase;
uniform float uCount;
uniform float uTail;
uniform float uOpacity;
uniform float uHi;      // 0/1 图例选中：整条线提亮
uniform float uBreath;  // 0..1 呼吸相位
varying float vProgress;
#include <fog_pars_fragment>
void main() {
  float u = vProgress;
  float bestCore = 0.0;
  float bestTail = 0.0;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= uCount) break;
    float head = fract(iTime * uSpeed + uPhase + float(k) / uCount);
    float ahead = fract(u - head);
    float behind = fract(head - u);
    float core = 1.0 - smoothstep(0.0, 0.05, ahead);
    float tailMask = 1.0 - smoothstep(uTail * 0.66, uTail, behind);
    float tail = exp(-behind * 6.5) * tailMask;
    bestCore = max(bestCore, core);
    bestTail = max(bestTail, tail);
  }
  vec3 col = mix(lineColor, hiColor, bestCore);
  // 选中：整条线往白里提 + 呼吸式加成；亮度冲过 1 之后由 bloom 接管，
  // 细线周围自然浮出一圈光晕，就是那条“描边”
  float pulse = uHi * (0.55 + 0.45 * uBreath);
  col = mix(col, vec3(1.0), pulse * 0.55);
  float boost = 1.0 + pulse * 1.9;
  // 线条只有 1px，底噪抬到 0.35 才不会断成一串虚线
  float alpha = clamp(0.35 + bestTail * 0.6 + bestCore * 1.2, 0.0, 1.0);
  // 不吃雾：远景线路保持亮度（材质也设了 fog: false，这里不再手动按雾气衰减）
  gl_FragColor = vec4(col * boost, alpha * uOpacity);
}
`

// ==================== 波前注入 ====================
// 瓦片（MeshBasicMaterial）和灰白楼体（MeshStandardMaterial）走 three 内置着色器，
// 用 onBeforeCompile 把同一套“离波心 > R 就裁掉”的代码塞进去。
// 两处原本各写一遍，统一放到这里，改波前只改一处。

const WAVE_FRAGMENT_DECL = /* glsl */ `
uniform float uWaveR;
uniform float uWaveB;
uniform vec2 uWaveC;
uniform float uWaveOn;
varying vec2 vWaveXZ;
`

const WAVE_VERTEX_BODY = /* glsl */ `
  vWaveXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`

const WAVE_FRAGMENT_BODY = /* glsl */ `
            if (uWaveOn > 0.5) {
              float d = length(vWaveXZ - uWaveC);
              gl_FragColor.a *= 1.0 - smoothstep(uWaveR - uWaveB, uWaveR + uWaveB, d);
            }`

// 顶点：在 begin_vertex 之后补一句世界坐标
// grow = true 时额外把 transformed.z 按 uGrow 压缩（楼体高度生长用，地面不传）
export const injectWaveVertex = (src, grow = false) =>
  `${grow ? 'uniform float uGrow;\n' : ''}varying vec2 vWaveXZ;\n${src.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>${grow ? '\n  transformed.z *= uGrow;' : ''}${WAVE_VERTEX_BODY}`,
  )}`

// 片元：声明 uniform，并在 dithering_fragment 之后按波前裁 alpha
export const injectWaveFragment = (src) =>
  `${WAVE_FRAGMENT_DECL}${src.replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>${WAVE_FRAGMENT_BODY}`,
  )}`
