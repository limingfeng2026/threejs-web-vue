<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSidebar } from '@/composables/useSidebar'
import { useResponsive } from '@/composables/useResponsive'
import { navMenus, placeholderMenus } from '@/config/menus'

const router = useRouter()
const route = useRoute()

// 折叠状态与顶部按钮共享
const { isCollapse } = useSidebar()
// 移动端不渲染左侧栏，改由 header 抽屉导航
const { isMobile } = useResponsive()

const menus = navMenus
const placeholders = placeholderMenus

// 手机端卡片间距收紧
const gutter = computed(() => (isMobile.value ? 12 : 16))

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
  {
    path: '/earth-scene',
    title: '地球大屏可视化',
    description:
      '球面地球可视化大屏：地表与云层双层球、大气菲涅尔辉光、城市光柱与标签、贝塞尔飞线、卫星轨迹流环、星空粒子与中国边界流光轮廓，接入 SceneView 渲染管线。',
    tags: ['球面地球', '飞线', '流光轨迹'],
    icon: 'Sunny',
  },
  {
    path: '/city-map',
    title: '长沙城市点位',
    description:
      '迁移自 maptalks 城市点位案例：去除地图库，改用 SceneView 内置 Web Mercator 投影摆放长沙五处经纬度点位，锥体点位上下浮动与自转、随动标签、贝塞尔汇聚飞线流光。',
    tags: ['墨卡托投影', '点位标注', '汇聚飞线'],
    icon: 'Place',
  },
  {
    path: '/acs-three',
    title: '门禁三维数字孪生',
    description:
      '从 three2024 迁移的门禁出入管理场景：办公楼 GLB 模型与玻璃材质、6 个房间门禁设备标签、刷卡开门动画、人员轨迹演示与相机跟随漫游、多视角快速切换。',
    tags: ['门禁孪生', '轨迹演示', '多视角切换'],
    icon: 'Lock',
  },
]

const openProject = (item) => {
  router.push(item.path)
}
</script>

<template>
  <div class="project-layout">
    <!-- 左侧可折叠菜单（移动端隐藏，用 header 抽屉导航） -->
    <aside v-if="!isMobile" class="sidebar" :class="{ collapsed: isCollapse }">
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

      <el-row :gutter="gutter">
        <el-col
          v-for="item in projects"
          class="project-col"
          :key="item.path"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="8"
          :xl="6"
        >
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

.project-col {
  margin-bottom: 16px;
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
  -webkit-tap-highlight-color: transparent;

  // 只在真正支持 hover 的指针设备上抬升，触屏点击后不会残留 hover 态
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: translateY(-4px);
    }
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

// ============ 移动端适配（<= 768px） ============
@media (max-width: 768px) {
  // 侧边栏隐藏后，内容区独占整宽，底部留安全区
  .sidebar-main {
    padding: 14px 12px calc(20px + env(safe-area-inset-bottom));
  }

  .list-header {
    margin-bottom: 14px;
  }

  .list-title {
    font-size: 19px;
  }

  .list-subtitle {
    margin-top: 4px;
    font-size: 13px;
  }

  .project-col {
    margin-bottom: 12px;
  }

  .project-card {
    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      margin-bottom: 12px;

      :deep(.el-icon) {
        font-size: 22px;
      }
    }

    .card-title {
      font-size: 16px;
      margin-bottom: 6px;
    }

    .card-desc {
      font-size: 13px;
      line-height: 1.55;
      min-height: 0;
      // 手机上一屏塞更多卡片，描述最多三行
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-tags {
      gap: 6px;
      margin: 10px 0 12px;

      :deep(.el-tag) {
        font-size: 11px;
      }
    }

    .card-btn {
      height: 36px;
    }
  }

  // 卡片内边距收紧，避免手机上左右太空
  :deep(.el-card__body) {
    padding: 14px;
  }
}

// 窄屏（<= 400px）进一步压缩，保证标题不换行太多
@media (max-width: 400px) {
  .sidebar-main {
    padding: 10px 10px calc(18px + env(safe-area-inset-bottom));
  }

  .list-title {
    font-size: 17px;
  }

  .project-card {
    .card-desc {
      -webkit-line-clamp: 2;
    }
  }

  :deep(.el-card__body) {
    padding: 12px;
  }
}
</style>
