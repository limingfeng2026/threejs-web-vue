<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useSidebar } from '@/composables/useSidebar'

const router = useRouter()
const route = useRoute()

// 折叠状态与顶部按钮共享
const { isCollapse } = useSidebar()

// 可跳转的真实路由菜单
const menus = [
  { index: '/', title: '项目列表', icon: 'HomeFilled' },
  { index: '/three-scene', title: '3D 场景', icon: 'Box' },
  { index: '/car-scene', title: '汽车演示', icon: 'Van' },
  { index: '/map-three', title: '水务地图', icon: 'MapLocation' },
  { index: '/about', title: '关于', icon: 'InfoFilled' },
]

// 业务占位菜单（暂不绑定路由）
const placeholders = [
  { index: 'ph-warehouse', title: '仓库管理', icon: 'List' },
  { index: 'ph-monitor', title: '设备监控', icon: 'Monitor' },
  { index: 'ph-alarm', title: '告警中心', icon: 'Bell' },
  { index: 'ph-setting', title: '系统设置', icon: 'Setting' },
]

const onSelect = (index) => {
  if (index.startsWith('/')) {
    router.push(index)
  }
}

// 项目列表：点击卡片进入对应页面
const projects = [
  {
    path: '/three-scene',
    title: '智慧仓储 3D 场景',
    description:
      '基于 three.js 与 SceneView 封装的仓储园区三维可视化，包含模型加载、内外场景切换、地板反射、文本标注与后期处理管线。',
    tags: ['Three.js', 'SceneView', '仓储可视化'],
    icon: 'Box',
  },
  {
    path: '/car-scene',
    title: '汽车材质演示',
    description:
      'PBR 材质跑车演示：清漆金属车身、抛光轮毂、透射玻璃，配合环境反射、接地阴影与车轮滚动动画，带 3D 文本标注。',
    tags: ['PBR 材质', 'GLB', '车轮动画'],
    icon: 'Van',
  },
  {
    path: '/map-three',
    title: '深圳水务 3D 地图',
    description:
      '从 three2022 迁移的城市地块三维地图：OBJ 地形模型、GeoJSON 地块描边、类别点位扩散光环、区域标签与 hover 描边，接入 SceneView 渲染管线。',
    tags: ['OBJ', 'GeoJSON', '点位标注'],
    icon: 'MapLocation',
  },
]

const openProject = (item) => {
  router.push(item.path)
}
</script>

<template>
  <div class="project-layout">
    <!-- 左侧可折叠菜单 -->
    <aside class="sidebar" :class="{ collapsed: isCollapse }">
      <el-menu
        :collapse="isCollapse"
        :collapse-transition="false"
        :default-active="route.path"
        class="side-menu"
        @select="onSelect"
      >
        <el-menu-item v-for="m in menus" :key="m.index" :index="m.index">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
        <el-menu-item
          v-for="m in placeholders"
          :key="m.index"
          :index="m.index"
          class="placeholder-item"
        >
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </aside>

    <!-- 右侧内容区 -->
    <main class="sidebar-main">
      <div class="list-header">
        <h2 class="list-title">项目列表</h2>
        <p class="list-subtitle">点击卡片进入对应项目页面</p>
      </div>

      <el-row :gutter="20">
        <el-col v-for="item in projects" :key="item.path" :xs="24" :sm="12" :md="8">
          <el-card class="project-card" shadow="hover" @click="openProject(item)">
            <div class="card-icon">
              <el-icon :size="28"><component :is="item.icon" /></el-icon>
            </div>
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-desc">{{ item.description }}</p>
            <div class="card-tags">
              <el-tag v-for="tag in item.tags" :key="tag" size="small" type="info">
                {{ tag }}
              </el-tag>
            </div>
            <el-button class="card-btn" type="primary" plain>进入项目</el-button>
          </el-card>
        </el-col>
      </el-row>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.project-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

// ============ 侧边栏 ============
.sidebar {
  width: $sidebar-width;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  transition: width 0.25s ease;

  &.collapsed {
    width: 64px;
  }
}

.side-menu {
  flex: 1;
  border-right: none;
  background: var(--bg-sidebar);

  :deep(.el-menu-item) {
    color: var(--text-regular);

    &.is-active {
      color: $primary-color;
      background: rgba(64, 158, 255, 0.12);
    }
  }
}

// ============ 右侧内容 ============
.sidebar-main {
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

.list-header {
  margin-bottom: 24px;
}

.list-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.list-subtitle {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 14px;
}

.project-card {
  height: 100%;
  cursor: pointer;
  border-radius: $border-radius;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-4px);
  }

  .card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: $primary-color;
    background: rgba(64, 158, 255, 0.12);
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .card-desc {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-regular);
    min-height: 66px;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 16px;
  }

  .card-btn {
    width: 100%;
  }
}
</style>
