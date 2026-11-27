<!--
  SceneLoading —— 3D 场景通用加载遮罩
  用法：
    <SceneLoading :visible="loading" :progress="progress" title="整车模型" status="正在加载模型资源" />
  props 全部可选，不传就是一套中性科技风的兜底文案。
-->
<template>
  <Transition name="sl-fade">
    <div
      v-if="visible"
      class="sl-mask"
      :class="`sl-${theme}`"
      :style="{ '--sl-accent': accent, '--sl-accent-2': accent2 }"
    >
      <!-- 背景层：径向辉光 + 透视网格 + 暗角 + 扫描线 -->
      <div class="sl-bg-glow" />
      <div class="sl-bg-grid" />
      <div class="sl-bg-vignette" />
      <div class="sl-scanline" />
      <!-- 四角 HUD 框 -->
      <i class="sl-corner sl-tl" />
      <i class="sl-corner sl-tr" />
      <i class="sl-corner sl-bl" />
      <i class="sl-corner sl-br" />

      <div class="sl-core">
        <div v-if="brand" class="sl-brand">
          <span class="sl-brand-text">{{ brand }}</span>
        </div>

        <div class="sl-title-row">
          <i class="sl-rule" />
          <span class="sl-title">{{ title }}</span>
          <i class="sl-rule" />
        </div>

        <!-- 环形仪表：刻度环 + 进度弧 + 旋转光环 + 中心读数 -->
        <div class="sl-gauge">
          <div class="sl-halo" />
          <svg class="sl-ring" viewBox="0 0 240 240" aria-hidden="true">
            <circle class="sl-ring-track" cx="120" cy="120" r="104" />
            <circle
              class="sl-ring-arc"
              cx="120"
              cy="120"
              r="104"
              :stroke-dasharray="CIRCUM"
              :stroke-dashoffset="CIRCUM * (1 - pct / 100)"
            />
          </svg>
          <div class="sl-tick-ring">
            <i
              v-for="i in TICKS"
              :key="i"
              class="sl-tick"
              :class="{ on: i / TICKS <= pct / 100 }"
              :style="{ transform: `rotate(${(i * 360) / TICKS}deg) translateY(-112px)` }"
            />
          </div>

          <div class="sl-readout">
            <div class="sl-num-row">
              <span class="sl-num">{{ display }}</span>
              <span class="sl-unit">%</span>
            </div>
            <span class="sl-caption">{{ pct >= 100 ? 'READY' : 'LOADING' }}</span>
          </div>
        </div>

        <!-- 线性进度条 -->
        <div class="sl-bar">
          <div class="sl-bar-inner" :style="{ width: `${pct}%` }">
            <i class="sl-bar-head" />
          </div>
        </div>

        <div class="sl-status">
          <span class="sl-dot" />
          <span class="sl-status-text">{{ status }}</span>
        </div>

        <slot />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
  title: { type: String, default: '场景加载中' },
  brand: { type: String, default: '' },
  status: { type: String, default: '正在准备渲染资源' },
  theme: { type: String, default: 'dark' }, // dark | light
  accent: { type: String, default: '#4fd1ff' },
  accent2: { type: String, default: '#7cf7c4' },
})

const TICKS = 48
// 圆周长：2πr，r=104 → 与 stroke-dasharray 对齐，不依赖 pathLength 的兼容性
const CIRCUM = +(2 * Math.PI * 104).toFixed(3)
const pct = computed(() => Math.min(100, Math.max(0, props.progress)))
const display = computed(() => String(Math.round(pct.value)).padStart(2, '0'))
</script>

<style lang="scss" scoped>
.sl-mask {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #060a12;
  color: #eaf2ff;
  user-select: none;
  --sl-accent: #4fd1ff;
  --sl-accent-2: #7cf7c4;
}
.sl-light {
  background: #eef3f8;
  color: #0d2438;
}

/* ---------- 背景 ---------- */
.sl-bg-glow {
  position: absolute;
  inset: -20% -10%;
  background:
    radial-gradient(50% 45% at 50% 48%, color-mix(in srgb, var(--sl-accent) 22%, transparent), transparent 70%),
    radial-gradient(26% 20% at 80% 18%, color-mix(in srgb, var(--sl-accent-2) 7%, transparent), transparent 72%);
  filter: blur(6px);
  animation: sl-breathe 6s ease-in-out infinite;
}
.sl-bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--sl-accent) 12%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--sl-accent) 12%, transparent) 1px, transparent 1px);
  background-size: 64px 64px, 64px 64px;
  -webkit-mask-image: radial-gradient(70% 60% at 50% 50%, #000 30%, transparent 100%);
  mask-image: radial-gradient(70% 60% at 50% 50%, #000 30%, transparent 100%);
  opacity: 0.55;
  animation: sl-grid-drift 12s linear infinite;
}
.sl-bg-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 100% at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.72) 100%);
}
.sl-scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 8vh;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    color-mix(in srgb, var(--sl-accent) 5%, transparent) 45%,
    color-mix(in srgb, var(--sl-accent) 9%, transparent) 60%,
    transparent 100%
  );
  animation: sl-scan 5.5s cubic-bezier(0.6, 0, 0.4, 1) infinite;
}
/* 1px 亮芯，让扫描线更“锐” */
.sl-scanline::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 58%;
  height: 1px;
  background: color-mix(in srgb, var(--sl-accent) 34%, transparent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--sl-accent) 30%, transparent);
}

/* ---------- 四角 ---------- */
.sl-corner {
  position: absolute;
  width: 46px;
  height: 46px;
  border: 1px solid color-mix(in srgb, var(--sl-accent) 55%, transparent);
  opacity: 0.7;
}
.sl-tl { top: 28px; left: 28px; border-right: 0; border-bottom: 0; }
.sl-tr { top: 28px; right: 28px; border-left: 0; border-bottom: 0; }
.sl-bl { bottom: 28px; left: 28px; border-right: 0; border-top: 0; }
.sl-br { bottom: 28px; right: 28px; border-left: 0; border-top: 0; }

/* ---------- 主体 ---------- */
.sl-core {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.sl-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--sl-accent) 78%, #fff 22%);
  opacity: 0.85;
}
.sl-brand::before,
.sl-brand::after {
  content: '';
  width: 34px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--sl-accent));
  opacity: 0.7;
}
.sl-brand::after {
  background: linear-gradient(90deg, var(--sl-accent), transparent);
}

.sl-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.sl-title {
  font-size: 26px;
  font-weight: 300;
  letter-spacing: 0.32em;
  text-indent: 0.32em;
  background: linear-gradient(100deg, #ffffff 10%, var(--sl-accent) 55%, #ffffff 92%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: sl-title 3.6s linear infinite;
}
.sl-rule {
  width: 72px;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sl-accent) 70%, transparent));
}
.sl-rule:last-child {
  background: linear-gradient(90deg, color-mix(in srgb, var(--sl-accent) 70%, transparent), transparent);
}

/* ---------- 环形仪表 ---------- */
.sl-gauge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 240px;
  height: 240px;
  margin-top: 6px;
}
.sl-halo {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background: repeating-conic-gradient(
    from 0deg,
    color-mix(in srgb, var(--sl-accent) 22%, transparent) 0deg 1.2deg,
    transparent 1.2deg 6deg
  );
  -webkit-mask-image: radial-gradient(circle, transparent 63%, #000 64%, #000 71%, transparent 72%);
  mask-image: radial-gradient(circle, transparent 63%, #000 64%, #000 71%, transparent 72%);
  opacity: 0.55;
  animation: sl-spin 18s linear infinite;
}
.sl-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* 让弧线起点对齐顶部，与刻度环同起点同方向 */
  transform: rotate(-90deg);
}
.sl-ring-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 2;
}
.sl-ring-arc {
  fill: none;
  stroke: var(--sl-accent);
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--sl-accent) 70%, transparent));
  transition: stroke-dashoffset 0.35s ease;
}
.sl-tick-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sl-tick {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 9px;
  margin: -4.5px 0 0 -1px;
  background: rgba(255, 255, 255, 0.13);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}
.sl-tick.on {
  background: color-mix(in srgb, var(--sl-accent) 80%, #fff 20%);
  box-shadow: 0 0 8px color-mix(in srgb, var(--sl-accent) 60%, transparent);
}

.sl-readout {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sl-num-row {
  display: flex;
  align-items: flex-start;
  line-height: 1;
}
.sl-num {
  font-family: 'DIN Alternate', 'Bahnschrift', 'Segoe UI', monospace;
  font-size: 66px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  text-shadow: 0 0 24px color-mix(in srgb, var(--sl-accent) 60%, transparent);
  font-variant-numeric: tabular-nums;
}
.sl-unit {
  margin-top: 12px;
  margin-left: 4px;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--sl-accent) 85%, #fff 15%);
}
.sl-caption {
  margin-top: 12px;
  font-size: 10px;
  letter-spacing: 0.36em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
}

/* ---------- 进度条 ---------- */
.sl-bar {
  position: relative;
  width: 320px;
  height: 2px;
  margin-top: 2px;
  background: rgba(255, 255, 255, 0.1);
}
.sl-bar::after {
  content: '';
  position: absolute;
  inset: -6px 0;
  background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 32px);
  opacity: 0.5;
}
.sl-bar-inner {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, var(--sl-accent), var(--sl-accent-2));
  box-shadow: 0 0 12px color-mix(in srgb, var(--sl-accent) 65%, transparent);
  transition: width 0.3s ease;
}
.sl-bar-head {
  position: absolute;
  right: -1px;
  top: 50%;
  width: 2px;
  height: 10px;
  transform: translateY(-50%);
  background: #fff;
  box-shadow: 0 0 10px var(--sl-accent);
}

/* ---------- 状态行 ---------- */
.sl-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
}
.sl-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sl-accent-2);
  box-shadow: 0 0 10px var(--sl-accent-2);
  animation: sl-blink 1.1s ease-in-out infinite;
}

/* ---------- 进出场 ---------- */
.sl-fade-enter-active { transition: opacity 0.35s ease; }
.sl-fade-leave-active { transition: opacity 0.55s ease, transform 0.55s ease, filter 0.55s ease; }
.sl-fade-enter-from { opacity: 0; }
.sl-fade-leave-to { opacity: 0; transform: scale(1.03); filter: blur(6px); }

/* ---------- 动画 ---------- */
@keyframes sl-breathe {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}
@keyframes sl-grid-drift {
  0% { background-position: 0 0, 0 0; }
  100% { background-position: 64px 64px, 64px 64px; }
}
@keyframes sl-scan {
  0% { transform: translateY(-20vh); opacity: 0; }
  12% { opacity: 0.75; }
  88% { opacity: 0.75; }
  100% { transform: translateY(105vh); opacity: 0; }
}
@keyframes sl-spin {
  to { transform: rotate(360deg); }
}
@keyframes sl-title {
  0% { background-position: 180% 0; }
  100% { background-position: -60% 0; }
}
@keyframes sl-blink {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}
</style>
