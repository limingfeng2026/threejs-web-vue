<script setup>
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useSidebar } from '@/composables/useSidebar'

const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const { isCollapse, toggleSidebar } = useSidebar()
</script>

<template>
  <div class="app-wrapper">
    <el-header class="app-header">
      <el-button class="collapse-btn" circle text @click="toggleSidebar">
        <el-icon :size="18">
          <Fold v-if="!isCollapse" />
          <Expand v-else />
        </el-icon>
      </el-button>
      <div class="logo">
        <el-icon color="#409eff"><Platform /></el-icon>
        <span>Vue3 Element App</span>
      </div>
      <el-menu
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
  </div>
</template>

<style lang="scss" scoped>
.app-wrapper {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
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

  &:hover {
    color: $primary-color;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.app-menu {
  flex: 1;
  border-bottom: none;
}

.header-right {
  display: flex;
  align-items: center;
  margin-left: auto;
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
</style>
