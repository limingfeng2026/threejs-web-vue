# Vue3 + Element Plus + Router + SCSS 项目

基于 Vite 8 搭建的 Vue 3 前端工程模板，内置 Element Plus 组件库、Vue Router 路由与 SCSS 样式体系。

## 技术栈

- Vue 3.5（`<script setup>` 组合式 API）
- Vite 8
- Element Plus 2.x（全量引入，图标全局注册）
- Vue Router 4（history 模式）
- SCSS（sass，全局变量自动注入）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173，自动打开浏览器）
npm run dev

# 生产构建
npm run build

# 预览生产构建产物
npm run preview
```

## 目录结构

```
vue3-element-app/
├── index.html
├── vite.config.js          # 别名 @、SCSS 全局变量注入、dev 端口
├── public/
└── src/
    ├── main.js             # 入口：注册 Router / Element Plus / 图标
    ├── App.vue             # 根组件：顶部导航 + router-view
    ├── router/
    │   └── index.js        # 路由表 + 全局守卫（页面标题）
    ├── views/              # 页面级组件
    │   ├── Home.vue
    │   └── About.vue
    ├── styles/
    │   ├── variables.scss  # 全局 SCSS 变量（自动注入，无需手动引入）
    │   └── index.scss      # 全局基础样式
    └── assets/             # 静态资源
```

## 关键配置说明

### 路径别名 `@`

指向 `src` 目录，在 `vite.config.js` 中配置：

```js
resolve: {
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
}
```

### SCSS 全局变量

`src/styles/variables.scss` 通过 `additionalData` 自动注入到每个组件，组件 `<style lang="scss">` 中可直接使用 `$primary-color`、`$border-radius` 等变量。

### 路由

- history 模式：`createWebHistory()`
- 页面组件采用动态 `import()` 懒加载，自动分包
- 未匹配路径兜底重定向到首页

## 后续可扩展

- Element Plus 按需自动导入（`unplugin-vue-components` + `unplugin-auto-import`）以减小产物体积
- 引入 Pinia 状态管理
- 配置 ESLint / Prettier
- 封装 Axios 请求层与通用布局组件
