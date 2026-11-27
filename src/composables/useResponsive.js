import { ref } from 'vue'

// 移动端断点，与样式里的 @media (max-width: 768px) 保持一致
export const MOBILE_MAX_WIDTH = 768

const query =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    : null

// 模块级单例：整站共享同一份移动端状态
const isMobile = ref(query ? query.matches : false)

if (query) {
  const onChange = (e) => {
    isMobile.value = e.matches
  }
  if (query.addEventListener) query.addEventListener('change', onChange)
  else if (query.addListener) query.addListener(onChange)
}

export function useResponsive() {
  return { isMobile }
}
