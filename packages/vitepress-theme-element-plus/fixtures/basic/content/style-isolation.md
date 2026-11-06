# Style isolation

Document prose keeps its heading scale, list markers and code highlighting.
The same elements inside an example keep their native or component styles.

## Document heading

- Document list item
- Another item with `inline code`

| Property | Description         |
| -------- | ------------------- |
| value    | Document table cell |

```ts
const highlighted = 'document source'
```

::: code-group

```sh [pnpm]
pnpm add example
```

```sh [npm]
npm install example
```

:::

## Native elements

:::demo Native component content

```vue
<template>
  <section data-testid="native-elements">
    <h2 data-probe="heading">Component heading</h2>
    <p data-probe="paragraph">Component paragraph with <a data-probe="link" href="#native-elements">a link</a>.</p>
    <ul data-probe="list">
      <li>Native list item</li>
    </ul>
    <code data-probe="code">component code</code>
    <div class="language-text" data-probe="code-block"><pre data-probe="pre">component source</pre></div>
    <table data-probe="table">
      <tbody>
        <tr>
          <td data-probe="cell">Component cell</td>
        </tr>
      </tbody>
    </table>
    <input data-probe="input" aria-label="Native input" value="Editable value" />
    <button data-probe="button" type="button">Native button</button>
    <details open>
      <summary data-probe="summary">Component details</summary>
      Details content
    </details>
    <div class="footer" data-probe="footer">Consumer footer</div>
    <div class="overview-page"><h1 data-probe="overview-heading">Consumer overview</h1></div>
    <div class="component-doc-meta" data-probe="component-doc-meta">Consumer metadata</div>
    <div class="epdocs:flex epdocs:gap-1" data-probe="tailwind-collision">Consumer Tailwind class</div>
    <button class="epd-button" data-probe="ep-namespace-collision">Consumer namespace collision</button>
    <div class="overlay" data-probe="overlay">Component overlay class</div>
    <div class="navbar" data-probe="navbar">Component navbar class</div>
    <div class="navbar-wrapper" data-probe="navbar-wrapper">Component navbar wrapper</div>
    <div class="navbar-menu" data-probe="navbar-menu">Component menu</div>
    <div class="sub-nav" data-probe="sub-nav">Component subnavigation</div>
    <div class="page-content" data-probe="page-content">Component page</div>
    <div class="hero-content" data-probe="hero-content">Component hero</div>
    <div class="doc-content-wrapper" data-probe="doc-content-wrapper">Component content wrapper</div>
    <div class="switch" data-probe="switch">Component switch</div>
    <div class="switch__action" data-probe="switch-action">Component switch action</div>
    <div class="menu-hamburger" data-probe="menu-hamburger">Component menu trigger</div>
    <div class="bg-transparent" data-probe="bg-transparent">Component background</div>
    <div class="visually-hidden" data-probe="visually-hidden">Component utility class</div>
  </section>
</template>
```

:::

## Authored styles and teleports

:::demo Scoped styles remain authoritative

```vue
<script setup>
import { ref } from 'vue'
const open = ref(false)
</script>

<template>
  <section class="custom-component">
    <h2 data-testid="authored-heading">Authored heading</h2>
    <p data-testid="authored-paragraph">Authored paragraph</p>
    <button type="button" @click="open = !open">Toggle component overlay</button>
    <Teleport to="body">
      <section v-if="open" class="custom-overlay" role="dialog" aria-label="Component overlay">
        <h2 data-testid="teleported-heading">Overlay heading</h2>
        <p data-testid="teleported-paragraph">Overlay paragraph</p>
        <button type="button" @click="open = false">Close component overlay</button>
      </section>
    </Teleport>
  </section>
</template>

<style scoped>
h2 {
  display: block;
  margin: 3px 0;
  padding: 0;
  font-size: 18px;
  line-height: 27px;
  font-weight: 400;
}
p {
  margin: 5px 0;
  line-height: 21px;
}
.custom-overlay {
  position: fixed;
  inset: 25% 20%;
  z-index: 100;
  padding: 24px;
  border: 1px solid;
  background: var(--el-bg-color);
}
</style>
```

:::

## Custom Markdown content

<div class="vp-raw" data-testid="manual-raw">
  <h2>Raw heading</h2>
  <p>Raw paragraph</p>
  <el-button data-testid="manual-ep-control">Direct Markdown component</el-button>
</div>
