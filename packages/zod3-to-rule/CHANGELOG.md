# @moluoxixi/zod3-to-rule

## 0.2.0

### Minor Changes

- ea79574: 将 Required 提升为字段级 `required` / `requiredMessage` 合同，并把通用校验硬切到
  RuleSet v2、ProjectDocument v7、SurfaceGraph v2、Canonical IR v6 与 Compiler 7.0.0。
  Designer 按字段类型提供合法规则、回滚被拒绝的属性输入；时间物料不再伪装成日期
  校验，Select options、已有 enum/literal validation 与失效默认值由一个命令和一个
  Undo 历史项共同维护。

  Raw Vue 现在生成不依赖 ConfigForm、Zod 或内部包的本地校验源码；组件解析与
  ConfigForm binding 解析职责分离，Raw 与 ConfigForm binding 可独立生成和报告失败。

## 0.1.3

### Patch Changes

- Retry publishing the package with a new patch version.

## 0.1.2

### Patch Changes

- Automatically release packages changed in 2c31e9a8f75f.

## 0.1.1

### Patch Changes

- Automatically release packages changed in 12fb7e116a5e.
