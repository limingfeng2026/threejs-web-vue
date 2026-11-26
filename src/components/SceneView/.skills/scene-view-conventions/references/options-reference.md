# 配置项与公共 API 参考

> 配置与 `config.js` 默认值深合并；THREE 的 Color/Vector/Euler/Texture 等实例只克隆不深挖。页面只覆盖需要改的字段。

## 顶层配置

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `mode` | `'' \| 'development' \| {stats,gui,helper,grid}` | `''` | 开发面板开关 |
| `isNight` | boolean | `false` | 夜景：影响雾色与背景 |
| `bgColor` | number/Color | `0x333333` | 未启用环境贴图时的背景色 |
| `environment` | boolean | `true` | 是否加载 HDR 环境贴图 |
| `environmentIntensity` | number | `0.5` | IBL 环境光强度；阴影发灰/发死主要调这项 |
| `backgroundIntensity` | number | `1.0` | 背景贴图亮度 |
| `shadowMapEnabled` | boolean | `true` | 阴影贴图开关 |
| `shadowMapType` | number | `PCFShadowMap` | r185 起 `PCFSoftShadowMap` 已弃用，会自动降级 |
| `dracoPath` | string | `/3d/draco/` | GLB 解压依赖路径 |
| `environmentUrl` | string | `/3d/environment/sky_1.hdr` | 默认环境贴图 |
| `fontUrl` | string | `/font/gentilis_regular.typeface.json` | `3d-font` 字体 |

## floor（地面）

`enabled / color / width / height / depth / roughness / metalness`。默认 `enabled:false`。

## floorReflection（地板反射叠加层）

保留原地板材质，额外叠一层菲涅尔反射。关键字段：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 反射层开关 |
| `color` | `0xbcd6ff` | 反射色调 |
| `reflectStrength` | `0.8` | 整体反射强度 |
| `fresnelPower` | `1.5` | 菲涅尔指数，越大越只在掠射角反光 |
| `texelSize` | `512` | 9 采样模糊步长基准（同时决定 uTexel） |
| `blur` | `1.5` | 模糊倍率，1 为基准；越小倒影越锐利 |
| `edgeFade` | `0.6` | 反射面边缘淡出范围 0~0.5 |
| `textureSize` | `512` | 反射渲染目标分辨率 |
| `multisample` | `4` | 渲染目标 MSAA 采样数 |
| `reflectGap` | `0.1` | 反射面沿 +Y 抬升间隙，防与原地板共面 Z-fighting |
| `receiveShadow` | `false` | 原地板是否接收阴影（叠加反射后默认关，防阴影叠在反射上发脏） |

## fog（雾）

`enabled / type('Fog'|'FogExp2') / color / density / near / far`。`FogExp2` 用 `density`，`Fog` 用 `near/far`。

## control（控制器，MapControls）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 控制器总开关 |
| `autoRotate` | `false` | 自动环绕 |
| `autoRotateSpeed` | `0.5` | 环绕速度 |
| `enableDamping` | `true` | 阻尼惯性 |
| `dampingFactor` | `0.45` | 阻尼系数 |
| `minDistance` | `0.01` | 缩放最近距离 |
| `maxDistance` | `200` | 缩放最远距离 |
| `minPolarAngle` | `0` | 最小俯仰角（弧度） |
| `maxPolarAngle` | `80°` | 最大俯仰角（弧度） |
| `enableZoom` | `true` | 滚轮缩放开关 |
| `enablePan` | `true` | 平移开关 |
| `zoomSpeed` | `1.5` | 滚轮缩放灵敏度，1.0 为原生基准 |
| `panLimit` | 见下 | 平移目标点 xyz 盒范围限制 |

### control.panLimit

限制平移把 `controls.target` 推出包围盒；`enabled:false` 时完全不生效。某轴未给边界则该轴不限制。钳制后被推回的差值会同步补偿给相机位置，保持视角偏移。

```js
panLimit: {
  enabled: true,
  min: { x: -60, z: -60 },      // 缺省轴 = -Infinity
  max: { x: 60,  z: 60 },       // 缺省轴 =  Infinity
}
```

> 注意：这是平移（pan）目标点范围，不是相机位置限制；缩放距离看 `minDistance/maxDistance`，俯仰角看 `minPolarAngle/maxPolarAngle`。

**已移除的旧参数**（传入会被剔除并告警，勿再使用）：`fixPolarAngle, wheelControlsPolar, wheelPolarStep, polarMin, polarMax, wheelPolarDuration, wheelControlsPitch, pitchSensitivity`。

## 灯光

- `ambLight`：`enabled / color / intensity`（默认 `0xeeeeee / 0.15`）。
- `hemiLight`：`enabled / skyColor / groundColor / intensity`（默认 `0x82abf7 / 0x6ccaf9 / 0.42`）。
- `dirLight`：平行光带阴影。关键字段 `color / intensity / position(Vector3) / target(Vector3) / castShadow`；阴影相机 `shadowCameraLeft/Right/Top/Bottom/Near/Far`、`shadowRadius / shadowIntensity / normalBias / bias / blurSamples / shadowCameraMapSize{width,height}`。太阳角度低时长影子要相应放大阴影相机范围。

## geo（地理投影，Web Mercator / EPSG:3857）

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `center` | `[number, number]` | `[114.19, 22.63]` | 投影中心 `[经度, 纬度]`，场景坐标原点对应的经纬度基准 |
| `worldScale` | number | `0.0012` | 墨卡托米制 → 场景世界单位的统一缩放，仅控整体大小；x/y 同系数保形，不做分轴标定 |

## quality（渲染质量）

`maxPixelRatio`（≤0 兜底为 1）、`anisotropy`、`dithering`、`envMapIntensity`。

## postProcessing（后期）

| 通道 | 关键字段 |
| --- | --- |
| `smaa` | `enabled` 抗锯齿 |
| `gtao` | `enabled / blendIntensity / radius / thickness / samples / denoiseSamples / denoiseRadius / denoiseRings / distanceExponent` 等环境光遮蔽 |
| `bloom` | `enabled / strength / radius / threshold` 辉光 |
| `vignette` | `enabled / offset / darkness` 暗角 |
| `film` | `enabled / noiseIntensity / scanlinesIntensity / scanlinesCount` 胶片噪点（默认关） |
| `bokeh` | `enabled / focus / aperture / maxblur` 景深（默认关） |
| `output` | `toneMapping / toneMappingExposure`，默认 ACES |
| `outline` | `enabled / edgeStrength / edgeGlow / edgeThickness / pulsePeriod / visibleEdgeColor / hiddenEdgeColor` 描边 |

## 公共方法（契约摘要）

**生命周期**：`start() / stop() / resizeView() / clear() / dispose()`。

**环境与控制器**：`loadEnvironment(): Promise`、`whenReady(): Promise`、`updateControls(newCamera?, targetPoint?)`。

**地理投影**：`projectMercator(lng, lat)` → `{x, y}`（米制墨卡托）；`projectPlane(lng, lat)` → `{x, y}`（相对中心平面坐标）；`projectToScene(lng, lat, height = 5.5)` → `THREE.Vector3`（世界坐标，z 取负平面 y）。

**文本**：`createText(options)`，`type: '2d' | '3d' | '3ds' | '3d-font'`。`options.element` 为字符串或 DOM；另有 `className / depthTest / color / position / fontUrl / size / depth`。

**反射**：`addFloorReflection(mesh, options?)`、`addFloorReflections(meshes, options?)`、`removeFloorReflections()`、`createFloorReflectShader(options?)`。

**场景切换**：`switchScene(options): Promise<boolean>`、`updatePostProcessingScene(newScene, newCamera)`。

**加载**：`loadGLB(url, onLoad?, onProgress?, onError?)`、`loadFBX(url, onLoad?, onProgress?, onError?, options?)`、`optimizeMaterials(root)`。

**位移动画**：`flyTo(target, positions, duration?, onUpdate?)`、`thingAnimate(target, positions, duration?, onUpdate?)`，均返回 `Promise`；飞行期间控制器锁定，落地后恢复。`getTweenBySpeed(start, end, duration?)`。

**描边**：`setOutlineObjects(objects)`、`clearOutline()`。

**导出**：`setCenter(model)`、`exportModel/exportGLTF/exportScene/exportModelByName(object, format, fileName)`。

**事件**：`addEventListener(type, listener) / removeEventListener / dispatchEvent`。点位拾取经 `objEvent`，事件类型如 `hover / click`。

**可直接读写的实例属性**：`scene, camera, renderer, controls, dirLight, ambLight, hemisphereLight, floor, floorReflectors, outlinePass, textLayer, mixers, animateCallback, resizeCallback, loadedCallback`。
