# 扩充 Studio 业务物料与视觉系统

## 目标

把现有以输入控件为主的物料库扩展为表单驱动的业务界面 Demo 物料体系，同时保持 Element Plus 与 Ant Design Vue 的共同语义基线和可维护源码输出。

## 前置条件

- `config-form-studio-contracts`、`config-form-surface-foundation` 与 `config-form-studio-datasets` 已完成。基础物料、布局和 Design Token 可在 Dataset 稳定前准备，但完整验收不得提前。

## 需求

- R1：两套适配器至少提供文本、标题、图标、图片、分割线、按钮、链接、标签、提示、表格、列表、空状态和分页外观。
- R2：Button、Link、Table row、List item 等通过物料能力声明受限语义触发器，不暴露原始 DOM 事件表。
- R3：Table/List 可绑定 Dataset 投影，并为行/项交互提供只读 `item` 表达式上下文。
- R4：提供 Grid、Flex、分栏、间距、尺寸、对齐和响应式断点，不增加绝对定位自由画布。
- R5：提供项目级 Design Token 与受控局部视觉属性，覆盖颜色、字体、间距、边框、圆角、阴影和背景。
- R6：项目创建时锁定 adapter；共同基础物料行为一致，专属物料显式标识且不参与自动转换。
- R7：必填在常用属性中提供直接开关，并继续编辑统一 validation `required` 规则。
- R8：Table/List/Select 复用 Dataset 提供的纯查询/投影合同；本任务只拥有组件渲染、视觉、选择状态和语义激活器。
- R9：主题编辑与双 adapter 投影消费 foundation 已固定的 `ProjectThemeV1`、结构化 `ResponsiveLength` 和 Registry snapshot v3；本任务不扩宽、替换或兼容读取这些 wire shape，也不再次提升 Registry 版本。
- R10：按 foundation 已固定的 Registry v3 capability 扩充物料条目、编辑 UI 和 adapter 映射；Text/Button/Table/List 等非值物料使用 element，不伪造 field，semantic trigger、状态投影属性、Dataset/Resource binding key 与 projection/media type 必须匹配既有 capability 合同，不发明第二套字段。

## 验收标准

- [ ] AC1：两套 adapter 的共同物料清单、能力标识和基础交互通过对称测试。
- [ ] AC2：设计、体验、Runtime 与生成源码对相同物料使用同一属性和 Dataset 投影语义。
- [ ] AC3：Table/List 的本地筛选、排序、分页、选择和 item 激活可由静态数据驱动。
- [ ] AC4：桌面、平板、手机 viewport 中布局稳定，无文本溢出或控件重叠。
- [ ] AC5：主题 Token 与局部视觉覆盖可序列化、可预览、可导出，不允许任意 CSS 文本。
- [ ] AC6：适配包单测、类型检查、构建和生成模板验证通过。
- [ ] AC7：共同物料的 field/layout/element kind 与 Dataset/Resource/trigger capability 在两套 adapter 中对称；未知 binding key、错误 projection kind 和把 element 当 field 均被拒绝。

## 范围外

- 不做官网、海报、动画时间线或像素级自由画布。
- 不实现项目级自定义组件、任意插槽脚本或组件库自动转换。
