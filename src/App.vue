<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useSidebar } from '@/composables/useSidebar'
import { useResponsive } from '@/composables/useResponsive'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { navMenus, placeholderMenus } from '@/config/menus'

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const { isCollapse, toggleSidebar } = useSidebar()
const { isMobile } = useResponsive()
const { navOpen, openNav, closeNav } = useNavDrawer()

// 场景页（3D / 大屏）：隐藏顶部横向菜单与左侧栏，只在 header 留一个返回入口
const isScenePage = computed(() => route.meta.scene === true)

// 移动端：按钮打开导航抽屉；桌面端：按钮折叠侧边栏
const onHeaderMenuClick = () => {
  if (isMobile.value) openNav()
  else toggleSidebar()
}

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="app-wrapper">
    <el-header class="app-header" :class="{ 'is-scene': isScenePage }">
      <!-- 场景页：只留返回入口，不再显示站内菜单 -->
      <el-button v-if="isScenePage" class="back-btn" text @click="goHome">
        <el-icon :size="16"><ArrowLeft /></el-icon>
        <span class="back-text">返回列表</span>
      </el-button>

      <!-- 目录页：移动端开抽屉，桌面端折叠侧栏 -->
      <el-button v-else class="collapse-btn" circle text @click="onHeaderMenuClick">
        <el-icon :size="18">
          <Menu v-if="isMobile" />
          <Fold v-else-if="!isCollapse" />
          <Expand v-else />
        </el-icon>
      </el-button>

      <div class="logo" @click="goHome">
        <el-icon color="#409eff"><Platform /></el-icon>
        <span class="logo-text">Vue3 Element App</span>
      </div>

      <el-menu
        v-if="!isMobile && !isScenePage"
        :default-active="route.path"
        class="app-menu"
        mode="horizontal"
        router
        :ellipsis="false"
      >
        <el-menu-item index="/">项目列表</el-menu-item>
        <el-menu-item index="/about">关于</el-menu-item>
      </el-menu>

      <div class="header-right">
        <el-tooltip :content="isDark ? '切换到浅色' : '切换到深色'" placement="bottom">
          <el-button class="theme-btn" circle text @click="toggleTheme">
            <el-icon :size="18">
              <Sunny v-if="isDark" />
              <Moon v-else />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </el-header>

    <el-main class="app-main">
      <router-view />
    </el-main>

    <!-- 移动端导航抽屉（仅目录页需要导航） -->
    <el-drawer
      v-if="!isScenePage"
      v-model="navOpen"
      direction="ltr"
      size="min(264px, 82vw)"
      :with-header="false"
      class="nav-drawer"
    >
      <div class="nav-drawer-brand">
        <el-icon color="#409eff" :size="20"><Platform /></el-icon>
        <span>Vue3 Element App</span>
      </div>
      <el-menu
        :default-active="route.path"
        class="nav-drawer-menu"
        router
        :ellipsis="false"
        @select="closeNav"
      >
        <el-menu-item v-for="m in navMenus" :key="m.index" :index="m.index">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
        <el-menu-item
          v-for="m in placeholderMenus"
          :key="m.index"
          :index="m.index"
          class="placeholder-item"
        >
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.app-wrapper {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: relative;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 20px;
  height: $header-height;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  padding: 0 24px;
}

.collapse-btn {
  color: var(--text-primary);
  flex-shrink: 0;

  &:hover {
    color: $primary-color;
  }
}

// 场景页的返回入口
.back-btn {
  flex-shrink: 0;
  gap: 4px;
  padding: 0 6px;
  color: var(--text-primary);

  &:hover {
    color: $primary-color;
  }

  .back-text {
    font-size: 14px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    opacity: 0.82;
  }
}

.app-menu {
  flex: 1;
  border-bottom: none;
  background: var(--bg-card);
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.theme-btn {
  color: var(--text-primary);

  &:hover {
    color: $primary-color;
  }
}

.app-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

// ============ 移动端 ============
@media (max-width: 768px) {
  .app-header {
    gap: 8px;
    height: 52px;
    padding: 0 10px;
    // 刘海屏 + 横屏安全区
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
  }

  .logo {
    gap: 6px;
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 400px) {
  .logo {
    font-size: 13px;
  }

  .logo-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
