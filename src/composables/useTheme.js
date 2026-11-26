import { ref } from 'vue'

const STORAGE_KEY = 'app-theme'
const DARK_CLASS = 'dark'

// 模块级单例状态，整站共享
const isDark = ref(false)

const applyTheme = (dark) => {
  document.documentElement.classList.toggle(DARK_CLASS, dark)
}

const initTheme = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  // 默认浅色
  isDark.value = saved === 'dark'
  applyTheme(isDark.value)
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  applyTheme(isDark.value)
}

// 模块加载即按本地偏好初始化
initTheme()

export function useTheme() {
  return { isDark, toggleTheme }
}
