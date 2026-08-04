# EnterNextContainer

回车 / 方向键智能跳转容器，按下 Enter 自动聚焦下一个输入控件，适用于快速录入场景。

## 基础用法

:::demo 将输入控件放入容器，按 Enter 键自动跳到下一个。
```vue
<template>
  <EnterNextContainer>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <el-input placeholder="姓名（回车跳下一项）" />
      <el-input placeholder="手机号" />
      <el-input placeholder="邮箱" />
      <el-input placeholder="备注" type="textarea" :rows="2" />
    </div>
  </EnterNextContainer>
</template>
```
:::

## 初始聚焦

:::demo 通过 `focusNum` 指定挂载后默认聚焦的控件序号（从 1 开始）。
```vue
<template>
  <EnterNextContainer :focus-num="2">
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <el-input placeholder="第1项" />
      <el-input placeholder="第2项（默认聚焦）" />
      <el-input placeholder="第3项" />
    </div>
  </EnterNextContainer>
</template>
```
:::
