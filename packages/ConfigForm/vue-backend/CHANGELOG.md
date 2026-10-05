# @moluoxixi/config-form-vue-backend

## 0.2.0

### Minor Changes

- 9d21019: 完成 ConfigForm Studio 的本地 Demo 创作主链：项目与 Surface/Dataset/Resource 资产、
  主题和业务物料、字段 Required、声明式状态和值联动、Page/Dialog/Drawer 原型交互，
  以及 Design/Experience 和源码导出均使用同一套严格 JSON-safe 合同。

  Dataset 引用新增结构化 filter/sort/page query，ProjectDocument、SurfaceGraph、Canonical
  IR 与 Compiler 分别硬切到 8、3、7 和 8.0.0；旧、未来、缺失和混合版本不兼容读取。

- 6d49398: 将 ConfigForm 定型为 Runtime-first 表单方案，完整删除事件编辑、事件转发与 Flow 编排合同，Designer 收敛为 properties 与 validation 两个默认区域。复杂组件事件由宿主在运行时 config 的 `props.onX` 中直接维护；持久化、编译、Preview 与 Source 合同同步硬切到无事件编排的当前版本。
- ea79574: 将 Required 提升为字段级 `required` / `requiredMessage` 合同，并把通用校验硬切到
  RuleSet v2、ProjectDocument v7、SurfaceGraph v2、Canonical IR v6 与 Compiler 7.0.0。
  Designer 按字段类型提供合法规则、回滚被拒绝的属性输入；时间物料不再伪装成日期
  校验，Select options、已有 enum/literal validation 与失效默认值由一个命令和一个
  Undo 历史项共同维护。

  Raw Vue 现在生成不依赖 ConfigForm、Zod 或内部包的本地校验源码；组件解析与
  ConfigForm binding 解析职责分离，Raw 与 ConfigForm binding 可独立生成和报告失败。

- 9772a58: Surface Foundation 将 ConfigForm 的持久化、编译和运行身份切换为严格的
  ProjectDocument v6 / SurfaceGraph v1 合同，加入 Dataset/Resource 基础引用、
  Project/Surface transfer、Surface-aware Vue backend，并发布共享 Prototype Runtime
  的无 DOM session 与 Vue overlay host。旧 Page-only、事件编排、事件转发和 Flow 合同
  不提供兼容读取器。

### Patch Changes

- Updated dependencies [06f0677]
- Updated dependencies [9d21019]
- Updated dependencies [6d49398]
- Updated dependencies [038271f]
- Updated dependencies [ea79574]
- Updated dependencies [9772a58]
  - @moluoxixi/config-form-core@0.3.0
  - @moluoxixi/config-form-model@0.2.0
  - @moluoxixi/config-form-compiler@0.2.0
  - @moluoxixi/config-form@0.3.0
  - @moluoxixi/zod3-to-rule@0.2.0

## 0.1.3

### Patch Changes

- Automatically release packages changed in 8a0a9f830270.
- Updated dependencies
  - @moluoxixi/config-form@0.2.5
  - @moluoxixi/config-form-compiler@0.1.3
  - @moluoxixi/config-form-core@0.2.6

## 0.1.2

### Patch Changes

- Updated dependencies
  - @moluoxixi/zod3-to-rule@0.1.3
  - @moluoxixi/config-form-compiler@0.1.2

## 0.1.1

### Patch Changes

- Automatically release packages changed in b0d4a5d86281.
- Updated dependencies
  - @moluoxixi/config-form@0.2.4
  - @moluoxixi/config-form-compiler@0.1.1
  - @moluoxixi/config-form-core@0.2.5
