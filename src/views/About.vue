<script setup>
const features = [
  'Vue 3 组合式 API（<script setup>）',
  'Element Plus 组件库全量引入',
  'Vue Router 4 history 模式路由',
  'SCSS 预处理器 + 全局变量注入',
  '@ 别名指向 src 目录',
]
</script>

<template>
  <div class="page-container about">
    <el-card shadow="never" class="about-card">
      <template #header>
        <div class="card-title">项目技术栈</div>
      </template>
      <ul class="feature-list">
        <li v-for="item in features" :key="item">
          <el-icon color="#409eff"><Check /></el-icon>
          <span>{{ item }}</span>
        </li>
      </ul>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.about {
  .about-card {
    max-width: 720px;
    margin: 0 auto;
    border-radius: $border-radius;
  }

  .card-title {
    font-size: 18px;
    font-weight: 600;
  }
}

.feature-list {
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--text-regular);
  }
}
</style>
