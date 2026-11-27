import { ref } from 'vue'

// 移动端导航抽屉：模块级单例，header 按钮打开、抽屉菜单选中后关闭
const navOpen = ref(false)

const openNav = () => {
  navOpen.value = true
}

const closeNav = () => {
  navOpen.value = false
}

const toggleNav = () => {
  navOpen.value = !navOpen.value
}

export function useNavDrawer() {
  return { navOpen, openNav, closeNav, toggleNav }
}
