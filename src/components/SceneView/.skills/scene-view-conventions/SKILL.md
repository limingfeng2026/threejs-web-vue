---
name: scene-view-conventions
description: vue3-element-app 项目内基于 SceneView 组件库搭建 three.js 三维场景的接入流程、配置项约定与编码规范。当需要新建/改造三维地图或演示页面、给 SceneView 传 control/floor/fog/灯光/后期等配置、添加灯光、地板反射、点位光柱、标签信息框、经纬度墨卡托投影定位、自定义 shader，或遵循项目配色、Element Plus 行为、贴图规格与避坑清单时使用。覆盖 SceneView 公共 API、geo 地理投影配置与方法、MapControls 平移限制、CSS3D/2D 标签、TWEEN 动画时序等既有套路。
---

# SceneView 三维场景接入规范

本 skill 沉淀 `src/components/SceneView/` 组件库在 `vue3-element-app` 项目中的使用约定。源码入口：`index.js`（类）、`config.js`（默认配置与深合并）、`index.d.ts`（类型契约）。

## 前提

- 技术栈：Vue 3 `<script setup>` + Element Plus + three r187 + `@tweenjs/tween.js`。
- 场景必须通过 `new SceneView(container, options)` 创建，**不要**在页面里手写 `WebGLRenderer / Scene / MapControls`；原生对象从实例上取：`sceneView.scene / camera / renderer / controls`。
- 页面侧只做业务装配：挂模型、加点位、写 shader、绑事件、接回调；渲染循环由组件库内部 `setAnimationLoop` 驱动。

## 最短接入流程

1. `onMounted` 里 `new SceneView(container.value, options)`，再取 `scene / camera`。
2. （需要每帧业务更新时）挂 `sceneView.animateCallback = (delta) => {}`，最后 `sceneView.start()`。
3. 加载模型/贴图/接口，把对象 `add` 进 `scene` 或业务 `Group`。
4. `onUnmounted` 里 `sceneView.clear()` 并置空，避免残留渲染循环与事件。
5. 完整可复制样板见 `assets/bootstrap-example.js`。

## 配置项怎么传

- `options` 与 `config.js` 默认值**深合并**，可只覆盖深层字段（如 `postProcessing.bloom.strength`）。
- 全量配置字段、默认值与公共 API 签名见 `references/options-reference.md`。
- 控制器只认 MapControls 原生属性 + `panLimit`；旧的自定义滚轮/极角参数已移除，传了会被剔除并告警。

## 场景套路与素材写法

- 灯光（环境/半球/平行光阴影）、地板反射层、点位圆盘 + 光柱 + 标签、信息框、扩散圆环 shader 的既有写法与参数，见 `references/scene-patterns.md`。
- 可复制的 shader 片段见 `assets/beam-and-point-shaders.js`。

## 编码约束（必须遵守）

- 配色、Element Plus 交互行为、贴图规格、已知坑位清单见 `references/style-rules.md`。
- 改动前先读对应 reference；不擅自突破既定约束、不改组件库默认行为。

## 新建与迁移项目的硬性约定

- 所有三维场景（新建或从其他项目迁移）都必须基于 `SceneView` 搭建。页面里不允许出现 `new THREE.WebGLRenderer / new THREE.Scene / new OrbitControls / CSS2DRenderer / CSS3DRenderer`，也不允许用 `requestAnimationFrame` 自建渲染循环。
- 迁移过来的项目要按本规范改造：删掉自建渲染层 → `new SceneView(container, options)`；每帧业务逻辑放进 `animateCallback`；文本走 `sceneView.createText`；模型走 `sceneView.loadGLB`；销毁走 `sceneView.clear()`。
- 迁移时需核对两处版本差异：r150+ 的 `position/rotation/scale` 是只读访问器，只能 `.copy()` 不能整体赋值；r155+ 改为物理光照单位，老项目的光强要按约 π 倍放大才能还原亮度。
- `@tweenjs/tween.js` 升到 25.x 后，`new Tween(object)` 必须显式传第二个参数 `true`（或一个 `Group` 实例）才会被注册进更新组：`new TWEEN.Tween(obj, true)`。漏传时补间变成"孤儿"，`TWEEN.update()` 永远不推进它——表现是位置/旋转/透明度全都不动、`onUpdate`/`onComplete` 从不触发，但页面不报任何错。迁移老项目时 `new TWEEN.Tween(x)` 全部要补 `, true`。

## 资源导航

| 文件 | 何时读 |
| --- | --- |
| `references/options-reference.md` | 需要查某配置项含义/默认值、调控制器/后期/灯光，或核对公共方法签名 |
| `references/scene-patterns.md` | 加灯光、反射、光柱、标签、信息框、shader 动画、经纬度投影定位，或对齐既有时序 |
| `references/style-rules.md` | 确定配色、组件行为、贴图规格，或排查渲染/显隐类问题 |
| `assets/bootstrap-example.js` | 新建三维页面时复制的装配样板 |
| `assets/beam-and-point-shaders.js` | 复用点位圆盘/光柱 shader 片段 |
