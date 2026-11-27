// ==================== 地球场景着色器集合 ====================
// 统一从本文件导出，页面内不再内联 shader 字符串

// 通用顶点：输出 UV 与模型空间坐标
export const baseVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vPosition = position;
  }
`

// 光柱底部扩散脉冲环（静态外环 + 两圈错位向外扩散波纹）
export const effect35Frag = /* glsl */ `
  uniform float iTime;
  uniform vec3 color;
  varying vec2 vUv;
  void main(void) {
    float d = length(vUv - vec2(0.5));
    // 静态基础外环
    float baseRing = 1.0 - smoothstep(0.0, 0.03, abs(d - 0.30));
    // 两圈错位相位：由内向外扩大并渐隐
    float pulse = 0.0;
    for (int k = 0; k < 2; k++) {
      float phase = fract(iTime / 2.2 + float(k) * 0.5);
      float pr = mix(0.10, 0.48, phase);
      float pw = 0.02 + phase * 0.03;
      float ringK = 1.0 - smoothstep(0.0, pw, abs(d - pr));
      pulse += (1.0 - phase) * ringK * (k == 0 ? 0.6 : 0.35);
    }
    float alpha = clamp(baseRing * 0.85 + pulse, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`

// 中国边界流光管片元（亮核 + 身后拖尾，多流光巡游，参照 MapThree edgeFlow）
export const boundaryFrag = /* glsl */ `
  uniform vec3 lineColor;
  uniform vec3 hiColor;
  uniform float iTime;
  uniform float uSpeed;
  uniform float uPhase;
  uniform float uCount;
  uniform float uTail;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float u = vUv.x;
    float bestCore = 0.0;
    float bestTail = 0.0;
    for (int k = 0; k < 32; k++) {
      if (float(k) >= uCount) break;
      float head = fract(iTime * uSpeed + uPhase + float(k) / uCount);
      float ahead  = fract(u - head);
      float behind = fract(head - u);
      float core = 1.0 - smoothstep(0.0, 0.05, ahead);
      float tailMask = 1.0 - smoothstep(uTail * 0.66, uTail, behind);
      float tail = exp(-behind * 6.5) * tailMask;
      bestCore = max(bestCore, core);
      bestTail = max(bestTail, tail);
    }
    vec3 col = mix(lineColor, hiColor, bestCore);
    float alpha = clamp(0.10 + bestTail * 0.6 + bestCore * 1.2, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`

// 卫星轨迹流光环：顶点
export const moonVertexShader = /* glsl */ `
  attribute float index;
  uniform vec3 color;
  uniform vec3 color1;
  uniform float iTime;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    vColor = color1;
    float show = 1000.0 * mod(iTime/20.0, 1.0);
    float size = 20.0;
    if(show > index && show < index + 30.0) {
      vColor = color;
      vOpacity = 1.0;
      size *= (index + 30.0 - show)*2.0;
    } else {
      vOpacity = 1.0;
      vColor = color1;
      size = 1.0;
    }
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size / (-mvPosition.z);
  }
`

// 卫星轨迹流光环：片元
export const moonFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`

// 城市飞线：顶点（透传路径进度 UV）
export const flyLineVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// 城市飞线：片元（沿路径巡游的亮核 + 拖尾 + 基础微光边线）
export const flyLineSweepFrag = /* glsl */ `
  uniform vec3 lineColor;
  uniform vec3 hiColor;
  uniform float iTime;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uTail;      // 拖尾长度（弧长占比 0~1）
  uniform float uReverse;   // 方向开关：1 翻转（终点→起点），0 起点→终点
  varying vec2 vUv;
  void main() {
    float u = vUv.x;
    if (uReverse > 0.5) u = 1.0 - u;
    float head = fract(iTime * uSpeed);
    // ahead：头部前方距离；behind：头部身后距离（环形 0~1）
    float ahead  = fract(u - head);
    float behind = fract(head - u);
    // 头部亮核：前方贴近头部处最亮
    float core = 1.0 - smoothstep(0.0, 0.05, ahead);
    // 身后拖尾：指数衰减，尾长限制在 uTail 弧长内
    float tailMask = 1.0 - smoothstep(uTail * 0.66, uTail, behind);
    float tail = exp(-behind * 6.0) * tailMask;
    vec3 col = mix(lineColor, hiColor, core);
    float alpha = clamp(0.10 + tail * 0.6 + core * 1.2, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`

// 大气辉光壳：顶点（世界空间法线 + 世界坐标）
export const glowVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// 大气辉光壳：片元（视线夹角 Fresnel 边缘发光，强度克制避免 HDR 爆亮）
export const glowFrag = /* glsl */ `
  uniform vec3 glowColor;
  uniform float c;
  uniform float p;
  uniform float uIntensity;  // 辉光强度倍率
  uniform float uOpacity;    // 整体透明度
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float intensity = pow(clamp(c - dot(vNormal, viewDir), 0.0, 1.0), p) * uIntensity;
    gl_FragColor = vec4(glowColor * intensity, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

// 球体正面菲涅尔 rim 边缘光：中心透明，轮廓边缘提亮（世界空间法线/视角方向）
export const rimFrag = /* glsl */ `
  uniform vec3 rimColor;
  uniform float uPower;    // 边缘宽度：值越大亮边越窄
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndv = dot(normalize(vNormal), viewDir);
    float fresnel = pow(clamp(1.0 - ndv, 0.0, 1.0), uPower);
    gl_FragColor = vec4(rimColor, fresnel * uOpacity);
  }
`

// 外层光波罩：顶点（模型空间坐标 + 世界法线/坐标）
export const sweepShellVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vPosition = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// 外层光波罩：片元（平时壳面透明；光带从上往下扫，拖尾留在头部上方反方向一侧，头部亮、尾迹渐暗）
export const sweepShellFrag = /* glsl */ `
  uniform vec3 sweepColor;
  uniform float iTime;
  uniform float uSpeed;       // 扫描周期：0~1 循环进度的速度
  uniform float uBandWidth;    // 头部亮核纬度宽度
  uniform float uTrailDecay;  // 拖尾衰减系数：越大尾迹越短
  uniform float uOpacity;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vPosition);
    float lat = n.y;                        // -1（底部）~ 1（顶部）
    float head = fract(iTime * uSpeed);      // 0 → 1 循环
    float bandY = mix(1.0, -1.0, head);     // 顶部 → 底部，从上往下扫

    // 头部上方 = 已扫一侧（拖尾/反方向）；头部下方 = 未扫前方
    float above = lat - bandY;               // >0 表示在头部上方
    float backMask = step(bandY, lat);      // lat >= bandY：头部及上方一侧

    // 头部亮核：细亮线，仅限头部及上方，下方前方清零
    float core = (1.0 - smoothstep(0.0, uBandWidth, abs(lat - bandY))) * backMask;

    // 拖尾：只留在头部上方（反方向），随高度差指数衰减，前亮后暗
    float trail = step(0.0, above) * exp(-above * uTrailDecay);

    // 接近底部整体淡出，避免回到顶部时硬切
    float fade = 1.0 - smoothstep(0.85, 1.0, head);
    float alpha = (core * 0.7 + trail * 0.6) * uOpacity * fade;
    gl_FragColor = vec4(sweepColor, clamp(alpha, 0.0, 1.0));
  }
`
