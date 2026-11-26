# 场景搭建套路（灯光 / 反射 / 光柱 / 标签 / Shader）

## 灯光

- 优先用 `options.ambLight / hemiLight / dirLight` 配置，组件 `initLight()` 已完成挂载；页面不要重复 `new` 环境灯。
- 阴影发灰、发死：先调 `environmentIntensity` 与 `dirLight.intensity`，再查阴影相机范围是否把长影子裁掉。
- 平行光低角度 → 投影更长，需同步放大 `shadowCamera*` 范围；`normalBias / bias` 用来消阴影 acne。
- 夜景（`isNight`）下组件跳过常规日光初始化。

## 地板反射

- 接口：`addFloorReflection(mesh, options?)` / `addFloorReflections(meshes, options?)`，直接传要叠加反射的 Mesh，不靠名称匹配。
- 反射面沿 +Y 抬升 `reflectGap` 微小间隙，避免与原地板顶面共面 Z-fighting；叠加反射后原地板 `receiveShadow` 默认关，防阴影叠在倒影上发脏。
- 反射参数（色调/强度/菲涅尔/模糊/边缘淡出）见 `options-reference.md` 的 floorReflection 段。

## 点位分组结构（既有约定）

每个点位一个 `THREE.Group`，子级固定为三类，引用统一存 `group.userData`：

```
newObj (Group)
├── mesh   圆盘点位（CircleGeometry，rotation.x = -π/2），name = businessCode
├── beam   光柱体，name = 'beam_' + businessCode，position.y = 0
└── tip    标签（createText 返回的 Object3D）
userData = { mesh, beam, tip }
```

世界坐标映射：直接 `sceneView.projectToScene(lng, lat, 高度)` 取 `Vector3(x, 高度, -y)`；只要平面坐标时用 `projectPlane(lng, lat)`。

## 经纬度 → 世界坐标（Web Mercator / EPSG:3857）

组件库内置地理投影，业务页面不要手写经纬度换算。

- **配置**（`options.geo`）：
  - `center: [lng, lat]`：投影中心，作为场景坐标原点对应的经纬度基准；
  - `worldScale: number`：墨卡托米制 → 场景世界单位的统一缩放，仅控制地图整体大小；x/y 同系数保形，不承担对齐标定。
- **三个实例方法**：
  - `sceneView.projectMercator(lng, lat)` → 米制墨卡托坐标 `{ x, y }`；
  - `sceneView.projectPlane(lng, lat)` → 相对 `center` 的平面坐标 `{ x, y }`；
  - `sceneView.projectToScene(lng, lat, height = 5.5)` → 世界 `Vector3(x, height, -y)`，z 取负平面 y。
- 点位、GeoJSON 边框/多边形统一走这组方法；**不要**在业务代码里手写经差乘经验系数这类线性近似。
- 投影只保证同源重合（点位/边框/地面共用同一套坐标）；把贴图或现成建模模型对齐到画面属于另外的场景标定，不在投影方法内处理。
- 换城市或范围只改 `geo.center` 与 `geo.worldScale`，投影公式不动。

## 光柱体

- 几何：共享一个 `CylinderGeometry(下半径, 上半径, 高, 16, 1, true)`，并 `translate(0, 高/2, 0)`，使**底面落在局部 y=0**——缩放围绕底面向上生长。注意别 translate 到 `-高/2`，否则往地下钻。
- 材质：每点位独立 `ShaderMaterial`，`transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending`。
- 升起动画：初始 `beam.scale.set(1, 0, 1)`、`visible=false`；用 TWEEN 把 `scale.y` 从 0 → 1（`Quintic.Out`），错峰 `delay`。升起完成且圆盘仍可见，才渐显标签。

## 标签（createText）

| type | 类型 | 行为 |
| --- | --- | --- |
| `2d` | CSS2DObject | 始终贴屏、不随透视缩放 |
| `3ds` | CSS3DSprite | 始终面向相机（billboard），可做缩放动画 |
| `3d` | CSS3DObject | 普通 3D 对象，角度固定，不 billboard |
| `3d-font` | 文本 Mesh | 走字体文件 |

- 标签显隐：CSS3DRenderer 只按图层设 `display`，**不读 `object.visible`**；实际显隐靠 DOM `style.opacity` 控制。
- DOM 元素挂在返回对象的 `element` 属性上（不是 `dom`）。
- 渐显套路：opacity 0→1 + scale 0.8→1，`Quintic.Out`；隐藏时复位 opacity=0、scale=0.8、`visible=false`。
- 入场时序：`flyTo` 落地后，先显现区名标签，再错峰 `revealBeam`，最后背景三圈扩散。

## Shader 写法约定

- 顶点着色器统一传 `vUv = uv` 与 `modelViewMatrix / projectionMatrix`；片元从 `vUv` 取坐标。
- 常用 uniform：`iTime`（秒）、`color`（`THREE.Color`）、`animate`（bool）。
- **未提供的 uniform 读取为默认 0**，可能整层不渲染且不报 shader 编译错；加新 shader 先核对所有 uniform 都已赋值。
- 透明发光体用 `AdditiveBlending + depthWrite:false`；边缘清晰用 `smoothstep` 窄过渡带，避免发虚。
- 可复用片段见 `assets/beam-and-point-shaders.js`（点位圆盘 `pointSpread`、光柱 `beamColumn`、背景环 `bgPlane`）。

## 动画与时序

- TWEEN：`new TWEEN.Tween(target, true)`，第二参 `true` 注册默认 Group；组件渲染循环内 `TWEEN.update` 驱动，页面不要再起独立 RAF。
- 飞行（`flyTo / thingAnimate`）期间 `_animateLocks` 计数 +1、`controls.enabled=false`，落地后 `controls.update()` 再放开；飞行期间不要做边界钳制或反推朝向，避免抖动。
- 分类切换：隐藏分支先 `hideTip` + 光柱复位 `visible=false, scale.set(1,0,1)`；显示分支就位后，若场景已入场再 `revealBeam`。
