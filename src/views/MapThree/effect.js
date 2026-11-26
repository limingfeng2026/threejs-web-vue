/*
 * @Author: 1179373677@qq.com
 * @Date: 2022-06-16 11:40:34
 * @LastEditors: 1179373677@qq.com
 * @LastEditTime: 2022-06-29 10:55:13
 * @Description:
 */

export const vertexShader = `
varying vec3 vPosition;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vPosition = position;
}
`
export const pointSpread = `
  uniform float iTime;
  varying vec2 vUv;
  uniform vec3 color;
  uniform bool animate;
  void main(void) {
      float d = length(vUv - vec2(0.5));

      // 内圆实心：窄过渡带，边缘清晰不发虚
      float core = 1.0 - smoothstep(0.088, 0.099, d);

      // 静态基础外环：半径 0.26，环宽半幅 0.028，边缘清晰
      float baseRing = 1.0 - smoothstep(0.0, 0.028, abs(d - 0.26));

      // 向外扩散的脉冲波纹（animate 选中时）：两圈错位相位，由内向外扩大并渐隐
      float pulse = 0.0;
      if (animate) {
        for (int k = 0; k < 2; k++) {
          float phase = fract(iTime / 2.5 + float(k) * 0.5);
          float pr = mix(0.12, 0.45, phase);
          float pw = 0.025 + phase * 0.035;
          float ringK = 1.0 - smoothstep(0.0, pw, abs(d - pr));
          pulse += (1.0 - phase) * ringK * (k == 0 ? 0.6 : 0.35);
        }
      }

      float alpha = clamp(core + baseRing * 0.85 + pulse, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
  }`
// ============ 点位光柱体 ============
export const beamColumn = `
  uniform vec3 color;
  uniform float iTime;
  varying vec2 vUv;
  void main() {
    // 纵向：底部实、顶部渐隐
    float vert = 1.0 - vUv.y;
    vert = pow(clamp(vert, 0.0, 1.0), 1.3);
    // 沿光柱缓慢上升的流光
    float flow = 0.5 + 0.5 * sin(vUv.y * 18.0 - iTime * 2.5);
    float alpha = vert * (0.45 + 0.30 * flow);
    gl_FragColor = vec4(color, alpha);
  }
`
// ============ 边框高亮线 ============
export const borderLineVertex = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const borderSweep = `
  uniform vec3 lineColor;    // 高亮边框颜色
  uniform float uOpacity;    // 边框透明度（1.0 实心，越低越淡、半透明）
  void main() {
    gl_FragColor = vec4(lineColor, uOpacity);
  }
`
export const bgPlane = `
#define PI 3.14159265359

// ================= 可配置参数 =================
const float R_OUTER = 360.0;   // 最外层半径（像素）
const float EDGE_SOFT = 3.0;   // 环带径向边缘柔化（像素）
const float GAP_SOFT  = 0.04;  // 缺口端点柔化（弧度）

// 外圈（索引 0）：半径 R，4 缺口，线宽 30，缺口弧长 180，透明度 0.3，冷蓝
const float O_LINE = 30.0;
const float O_GAP  = 180.0;
const float O_ALPHA = 0.3;
const float O_GAP_COUNT = 4.0;
const float O_SPEED = 0.15;    // 外圈切口转速（弧度/秒，正负=方向）
const float O_PHASE = 0.0;    // 外圈切口初始相位（弧度）

// 中圈（索引 1）：半径 2/3 R，4 缺口，线宽 10，缺口弧长 200，透明度 0.8，高亮冷蓝
const float M_RADIUS = 2.0 / 3.0;
const float M_LINE = 10.0;
const float M_GAP  = 200.0;
const float M_ALPHA = 0.8;
const float M_GAP_COUNT = 4.0;
const float M_SPEED = -0.10;  // 中圈切口转速（反向）
const float M_PHASE = 1.2;

// 内圈（索引 2）：半径 1/3 R，无缺口，线宽 100，透明度 0.5，冷蓝
const float I_RADIUS = 1.0 / 3.0;
const float I_LINE = 100.0;
const float I_ALPHA = 0.5;
const float I_GAP_COUNT = 0.0;
const float I_SPEED = 0.08;
const float I_PHASE = 2.4;

// 中心向外扩散的脉冲波纹（参数直接配置在 shader 内）
const vec3  PULSE_COLOR  = vec3(0.0, 0.93, 1.0);  // 扩散圈颜色
const float PULSE_WIDTH  = 4.0;    // 环粗（中心带半幅）
const float PULSE_EDGE   = 1.5;    // 边缘柔化半幅（越小越清晰）
const float PULSE_ALPHA  = 0.65;  // 峰值透明度
const float PULSE_SPEED  = 60.0;   // 扩散速度（半径/秒）
const float PULSE_COUNT   = 3.0;   // 同时跑几圈错位波纹
// =============================================

uniform vec3 baseColor;   // 冷蓝（外/内圈）
uniform vec3 hiColor;     // 高亮冷蓝（中圈）
uniform float iTime;
uniform vec2 iResolution;
uniform float uReveal;    // 扩散进度 0~1：三圈从中心向外展开并渐显
varying vec2 vUv;

void main() {
  vec2 uv = vec2(vUv.x * iResolution.x, vUv.y * iResolution.y);
  vec2 c = iResolution * 0.5;
  vec2 d = uv - c;
  float r = length(d);
  float theta = atan(d.y, d.x);

  float radii[3];
  radii[0] = R_OUTER;
  radii[1] = R_OUTER * M_RADIUS;
  radii[2] = R_OUTER * I_RADIUS;

  float lineW[3];  lineW[0] = O_LINE;  lineW[1] = M_LINE;  lineW[2] = I_LINE;
  float gapArc[3]; gapArc[0] = O_GAP;  gapArc[1] = M_GAP;  gapArc[2] = 0.0;
  float gapCnt[3]; gapCnt[0] = O_GAP_COUNT; gapCnt[1] = M_GAP_COUNT; gapCnt[2] = I_GAP_COUNT;
  float alpha[3];  alpha[0] = O_ALPHA; alpha[1] = M_ALPHA; alpha[2] = I_ALPHA;
  float speed[3];  speed[0] = O_SPEED; speed[1] = M_SPEED; speed[2] = I_SPEED;
  float phase[3];  phase[0] = O_PHASE; phase[1] = M_PHASE; phase[2] = I_PHASE;
  float hi[3];     hi[0] = 0.0;        hi[1] = 1.0;        hi[2] = 0.0;

  vec3 col = vec3(0.0);
  float alphaSum = 0.0;

  for (int i = 0; i < 3; i++) {
    float radius = radii[i] * uReveal;
    float halfW = lineW[i] * 0.5;
    float e0 = max(0.0, halfW - EDGE_SOFT);
    float e1 = halfW + EDGE_SOFT;
    float band = 1.0 - smoothstep(e0, e1, abs(r - radius));

    float mask = band;
    if (gapCnt[i] > 0.5) {
      float rot = iTime * speed[i] + phase[i];
      float sector = 2.0 * PI / gapCnt[i];
      float local = mod(theta - rot, sector);
      float ad = abs(local - sector * 0.5);
      float gapHalf = (gapArc[i] / radius) * 0.5;
      float gap = smoothstep(gapHalf, gapHalf + GAP_SOFT, ad);
      mask = band * gap;
    }

    vec3 ringCol = mix(baseColor, hiColor, hi[i]);
    float ringAlpha = mask * alpha[i] * uReveal;
    col += ringCol * ringAlpha;
    alphaSum += ringAlpha;
  }

  // 中心向外扩散的脉冲波纹：多圈错位相位，由内向外扩大并渐隐
  for (int k = 0; k < 2; k++) {
    if (float(k) >= PULSE_COUNT) break;
    float offset = float(k) * R_OUTER / PULSE_COUNT;
    float pr = mod(iTime * PULSE_SPEED + offset, R_OUTER);
    float bandP = 1.0 - smoothstep(PULSE_WIDTH - PULSE_EDGE, PULSE_WIDTH + PULSE_EDGE, abs(r - pr));
    float fade = 1.0 - pr / R_OUTER;
    float pulseAlphaV = bandP * fade * PULSE_ALPHA * uReveal;
    col += PULSE_COLOR * pulseAlphaV;
    alphaSum += pulseAlphaV;
  }

  gl_FragColor = vec4(col, clamp(alphaSum, 0.0, 1.0));
}
`
