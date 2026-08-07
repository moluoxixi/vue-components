<script lang="ts" setup>
import { useData } from 'vitepress'

defineProps<{ isHome?: boolean }>()
const { theme } = useData()
</script>

<template>
  <footer class="footer" :class="{ 'is-home': isHome }">
    <div class="footer-main">
      <h4>Documentation</h4>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Repository
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Source code
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Issues
      </a>
      <a
        href="/sitemap.xml"
        class="footer-main-link"
        target="_blank"
      >
        Sitemap
      </a>
    </div>

    <div class="footer-main">
      <h4>Community</h4>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        GitHub
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Discussions
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Issues
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Contributing
      </a>
      <a
        :href="String(theme.repository || '/')"
        class="footer-main-link"
        target="_blank"
      >
        Discussions
      </a>
    </div>
  </footer>
</template>

<style lang="scss">
.dark .footer {
  background-color: var(--el-fill-color-lighter);
}
.footer {
  background-color: #f5f7fa;
  box-sizing: border-box;
  padding: 42px 64px 64px;

  &.is-home {
    background-color: var(--bg-color);
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 0;
  }

  .container {
    box-sizing: border-box;
    width: auto;
  }

  .footer-main {
    font-size: 0;
    display: inline-block;
    vertical-align: top;
    margin-right: 130px;

    h4 {
      font-size: 18px;
      line-height: 1;
      margin: 0 0 15px;
      font-weight: 400;
      color: var(--el-text-color-primary);
    }

    .footer-main-link {
      display: block;
      margin: 0;
      line-height: 2;
      font-size: 14px;
      color: var(--text-color-light);

      &:hover {
        color: var(--text-color);
      }
    }
  }

}

@media (max-width: 1140px) {
  .footer {
    height: auto;
  }
}

@media (max-width: 768px) {
  .footer {
    .footer-main {
      margin-bottom: 30px;
    }
  }
}
</style>
