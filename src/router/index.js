import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: () => import('@/views/ProjectList.vue'),
    meta: { title: '项目列表' },
  },
  {
    path: '/three-scene',
    name: 'ThreeScene',
    component: () => import('@/views/ThreeScene.vue'),
    meta: { title: '智慧仓储 3D 场景' },
  },
  {
    path: '/car-scene',
    name: 'CarScene',
    component: () => import('@/views/CarScene.vue'),
    meta: { title: '汽车材质演示' },
  },
  {
    path: '/map-three',
    name: 'MapThree',
    component: () => import('@/views/MapThree/index.vue'),
    meta: { title: '深圳水务 3D 地图' },
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于' },
  },
  {
    // 兜底重定向
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局前置守卫：设置页面标题
router.beforeEach((to, _from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - Vue3 Element App` : 'Vue3 Element App'
  next()
})

export default router
