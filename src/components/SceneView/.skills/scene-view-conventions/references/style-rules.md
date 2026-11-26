# 编码风格约束与避坑清单

## 配色

- 整体冷科技蓝暗调；场景背景暗蓝 `#0a1929`，雾色按场景压暗。
- 类别色固定三组，按 `bizType - 1` 取色，不要另起颜色：

| 索引 | bizType | 类别 | 色值 |
| --- | --- | --- | --- |
| 0 | 1 | 水厂 | `#00FFF6`（青） |
| 1 | 2 | 水质净化厂 | `#FEDA33`（黄） |
| 2 | 3 | 泵站 | `#2BA7FF`（蓝） |

- 边框/扫光：常态冷光科技蓝、悬停高亮冰蓝 `0x8fe6ff`；边框透明度 0~1，越低越淡。
- 信息框卡片：底色深色毛玻璃、8px 圆角、类别色左右描边、双层阴影；类别色通过 CSS 变量 `--note-color` 注入，箭头用跟随类别色的 CSS 三角，不用位图箭头。
- 描边色（outlinePass）跟随当前类别色：`visibleEdgeColor.set(new THREE.Color(categoryColor[i]))`。

## Element Plus 与页面交互

- 沿用项目暗色主题变量与 CSS 变量层，不硬编码覆盖组件原生色；交互态（hover/active）用 `transition: background-color 0.2s ease` 这类短过渡。
- 分类导航按钮选中态用类别色渐变/描边，未选中态用半透明底。
- 列表/卡片与 3D 画布分区清晰，3D 容器占满、遮罩层 `v-if` 控制显隐。

## 贴图与资源规格

- 模型/贴图/字体等静态资源放 `public/3d/...`，代码内路径以 `/3d/` 开头；Draco 解压路径 `dracoPath` 与配置一致。
- 可平铺纹理必须无缝、边缘不接缝；优先 power-of-two 尺寸；各向异性过滤由 `quality.anisotropy` 控制。
- 纹理用 `THREE.TextureLoader` 预加载并纳入加载计数，下载完成后原地填充占位对象。
- 材质金属度/粗糙度按模型类型调：地面高粗糙低金属，模型可加自发光提升暗部可读性。

## 避坑清单（踩过的死路）

- **标签类型判断**：遍历子级判断标签时用 `child.isCSS3DObject`，不要写死 `isCSS3DSprite`；否则 `type:'3d'` 的对象被跳过、scale 卡 0 导致不可见。
- **CSS3D 显隐**：CSS3DRenderer 只按图层设 `display`，不读 `object.visible`；显隐必须改 DOM `style.opacity`。DOM 元素在 `object.element` 属性上。
- **3d 对象不 billboard**：`type:'3d'`（CSS3DObject）角度固定，绕到侧面不会自动转正；需要始终朝相机用 `3ds`。
- **模板单行 if-else**：`if (show) showTip() else hideTip()` 会被 `compiler-sfc` 报 `Missing semicolon`，写成带大括号的语句块。
- **Shader 缺 uniform**：未提供的 uniform 读取为默认 0，可能整层不渲染且不报编译错；新 shader 先核对 uniform 全部赋值。
- **HMR 串旧模块**：改完偶发行为不生效，清 `node_modules/.vite` 重启 dev；必要时硬刷新。
- **反射共面**：反射面与原地板共面会 Z-fighting，靠 `reflectGap` 沿 +Y 抬升，不要叠在同一平面。
- **调试可见性**：隔离浏览器读不到 Vue 闭包和后挂的 window 全局；判定 DOM 显隐用 `style.display / style.opacity`，不要依赖闭包变量。
- **飞行与控制器互斥**：补间直接写相机位置时，飞行期间必须锁控制器；不要在 `controls.update()` 之外反推 spherical，否则视角抖动。

## 改动纪律

- 严格按既定配色、组件行为与贴图规格执行，不擅自突破约束或改组件库默认行为。
- 新增配置项先在 `config.js` 给默认值（`enabled:false` 不影响现有场景），再在 `index.js` 接入；类型契约同步更新 `index.d.ts`。
- 改完跑 `vite build` 校验编译；交互/显隐类改动在浏览器实测后再交付。
