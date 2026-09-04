# Packages 全仓结构治理技术设计

## 1. 治理模型

父任务只拥有全局合同、子任务地图、跨批次依赖和最终审计。每个子任务拥有一个可独立验证的包或稳定包族，不在一个提交中同时拆多个高风险状态机。

```text
package inventory
  -> architecture collector
  -> ownership/exception/debt manifest
  -> no-new-debt gate
  -> package migration batches
  -> debt deletion
  -> final zero-debt gate
```

## 2. 包入口

- 包根 `index.ts` 是源码公共入口，并显式导出 `src/<feature>`。
- `src/index.ts` 不再作为包级镜像入口；Feature 自己的 `index.ts` 仍可作为局部边界。
- `package.json` source/types/import、Vite lib entry、声明生成和独立 consumer 测试必须指向同一入口模型。
- framework/CLI/private app 例外由 manifest 声明，不通过隐式约定绕过。

## 3. 组件所有权

- Collector 解析 `.vue/.tsx/.ts` 的静态 import、动态 import 和 barrel re-export，生成可追溯引用边。
- 单父组件必须位于父组件目录的 `components/`；单 Feature 组件必须位于 Feature 的 `components/`。
- Shared 组件需要至少两个独立 Feature owner。Public/dynamic/framework 组件使用窄例外记录，包含路径、kind、owners 和 reason。
- 当前历史债务进入独立 debt 列表，必须带目标子任务；门禁拒绝新增债务，后续迁移逐项删除，父任务完成时列表必须为空。

## 4. 巨型文件

- 行数只触发审计：P0 >1200，P1 >800，P2 >500 或所有权异常。
- Vue 生命周期状态进入 composables，纯算法进入 services/utils，视觉区域进入 owner/components，入口保留编排。
- 拆分前先为关键状态机补行为测试；不通过转发文件保留旧私有路径。

## 5. 兼容与回滚

- 非 ConfigForm 稳定 API 变化必须单独确认；私有实现移动不保留 compatibility shim。
- ConfigForm 使用 current-contract-only hard cut，同一批更新 producer、consumer、README、spec 和 package smoke。
- 每批独立提交，失败时回滚该批，不回滚已经通过的基础门禁或其他包治理。
