<template>
  <div class="hero-content">
    <Content />
  </div>
  <hr class="hero-divider" />
  <div data-docs-ui class="epdocs:text-center epdocs:py-6 epdocs:text-xs">
    <p class="epdocs:mb-1">Released under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT License</a>.</p>
    <p class="epdocs:mt-1">Build your documentation with the reusable theme.</p>
  </div>
</template>

<style scoped lang="scss">
.hero-divider { margin: 24px 0 0; border: 0; border-top: 1px solid var(--ep-docs-border-color); }

.hero-content {
  padding: 40px 40px 0;
}
@media (max-width: 768px) {
  .hero-content {
    padding: 30px 10px 0;
  }
}

.docs-playground-page .hero-content { width: 100%; max-width: none; margin: 0; padding: 0; }

</style>
