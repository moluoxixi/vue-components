# Studio 业务物料与视觉系统技术设计

## 当前差距

Registry v3、`required` 独立字段、Grid/Flex 和 ProjectTheme Model schema 已存在；两套 adapter 仍以 field/layout 为主，没有共同 element 物料、Dataset/Resource capability、Table/List/分页渲染或 Theme 编辑 UI。完整实现依赖 Dataset query service，但基础展示物料、主题表单和响应式配置可并行。

## 边界与所有权

- 双 Provider `src/materials/*.ts` 声明共同物料矩阵、运行组件、source binding、semantic trigger 和 dataset/resource capability；Designer 只投影 capability，不定义第二套合同。
- Model/Compiler 保持既有 `ProjectThemeV1`、Registry v3、ResponsiveLength wire shape；Workbench 拥有主题编辑命令和预览投影。
- Table/List/Select 只消费 Model Dataset view；选择状态由物料/Experience 层拥有，不能在组件内复制过滤、排序或分页算法。
- 不恢复事件编排、任意事件、接口和函数；交互只使用已固定的 semantic trigger 与 safe expression。

## 共同物料矩阵

两套 adapter 至少对称提供 Text、Title、Icon、Image、Divider、Button、Link、Tag、Alert、Table、List、Empty、Pagination、Grid、Flex。Table/List 具备 `datasetBindings`，Button/Link/行/项只声明受限语义触发器；element 不伪造 field。Row/item 激活由 Workbench Runtime Host 和 Source resolver 映射为 `rowActivate`/`itemActivate`。

## 主题与响应式

ProjectTheme 编辑器使用颜色、字体、间距、边框、圆角、阴影的结构化控件，提交 `project.theme` 单命令；Design/Preview 通过显式 CSS variables 投影，Source 输出完整 theme 字段，禁止任意 CSS 文本。Grid/Flex 物料使用结构化 ResponsiveLength 与断点配置，桌面/平板/手机保持稳定尺寸和无溢出。

## 验证

共同物料清单、capability、projection kind、binding key、element/field kind 做双 Provider 对称测试；运行 Designer、双 Provider、Compiler、Runtime、Source、Workbench 测试/typecheck/build 和 1440/900/390 Playwright。主题变化不得污染编辑器外的 Runtime iframe。
