import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { DefaultLoadingManager } from 'three'
import App from './App.vue'
import router from './router'
import { fixUrl } from './utils/basePath'
import './styles/index.scss'

// 部署到子路径时给 '/3d/...' 这类路径补前缀：
// - three 的各个 loader（glb / fbx / hdr / 贴图 / 瓦片）都走 DefaultLoadingManager
// - 页面里直接 fetch 的 json 走下面这层包装
DefaultLoadingManager.setURLModifier(fixUrl)
const rawFetch = window.fetch?.bind(window)
if (rawFetch) {
  window.fetch = (input, init) => rawFetch(typeof input === 'string' ? fixUrl(input) : input, init)
}

const app = createApp(App)

// 全局注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router)
app.use(ElementPlus)

app.mount('#app')
