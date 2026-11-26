import { ref } from 'vue'

// 模块级单例：侧边栏折叠状态，header 按钮与侧边栏共享
const isCollapse = ref(false)

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

export function useSidebar() {
  return { isCollapse, toggleSidebar }
}
