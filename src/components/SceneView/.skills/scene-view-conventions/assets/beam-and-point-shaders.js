/**
 * 可复用 Shader 片段（点位圆盘 / 光柱）
 * 配套 ShaderMaterial：transparent 按需；发光体 AdditiveBlending + depthWrite:false
 */

// 通用顶点：传 vUv
export const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// 点位圆盘：内圆实心 + 静态外环 + 选中时两圈错位脉冲波纹
export const pointSpread = `
  uniform float iTime;
  varying vec2 vUv;
  uniform vec3 color;
  uniform bool animate;
  void main(void) {
      float d = length(vUv - vec2(0.5));

      // 内圆实心：窄过渡带，边缘清晰不发虚
      float core = 1.0 - smoothstep(0.088, 0.099, d);
      // 静态基础外环：半径 0.26，环宽半幅 0.028
      float baseRing = 1.0 - smoothstep(0.0, 0.028, abs(d - 0.26));

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
  }
`

// 光柱体：底部实、顶部渐隐，沿柱身缓慢上升流光
export const beamColumn = `
  uniform vec3 color;
  uniform float iTime;
  varying vec2 vUv;
  void main() {
    float vert = 1.0 - vUv.y;
    vert = pow(clamp(vert, 0.0, 1.0), 1.3);
    float flow = 0.5 + 0.5 * sin(vUv.y * 18.0 - iTime * 2.5);
    float alpha = vert * (0.45 + 0.30 * flow);
    gl_FragColor = vec4(color, alpha);
  }
`
