# ConfigForm Headless

`@moluoxixi/config-form-headless` 是 ConfigForm 的无 UI 协议与控制层。

它提供跨 UI 实现复用的节点类型、slot 配置、字段定义 helper、条件与节点工具，以及不依赖具体表单组件的模型 controller。Ant Design Vue、Element Plus 或其他渲染器只需要负责布局、字段壳、校验适配和真实组件绑定。

```ts
import { createConfigFormController, defineFields } from '@moluoxixi/config-form-headless'
```

该包不渲染 DOM，也不依赖任何具体 UI 组件库。
