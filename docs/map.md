# 项目文档地图

## 文档入口

| 目录 | 索引 | 用途 |
|---|---|---|
| architecture | [架构文档索引](architecture/index.md) | 记录项目架构、模块边界、分层、数据流、权限模型、部署关系和架构决策。 |
| api | [接口文档索引](api/index.md) | 记录全局接口协议、业务接口契约、联调状态、请求响应示例、错误码和上下游依赖。 |
| components | [外部组件库消费文档索引](components/index.md) | 记录当前项目消费外部组件库、Design System、UI SDK 或组件自动导入工具的约束。 |
| out-components | [组件库对外文档索引](out-components/index.md) | 记录当前项目提供给外部消费方复用的组件契约。 |
| prds | [需求文档索引](prds/index.md) | 记录业务背景、目标、范围、流程、字段口径、验收标准和变更历史。 |
| test | [测试文档索引](test/index.md) | 记录测试策略、用例矩阵、数据准备、联调验证、回归范围和风险。 |
| other | [其它文档索引](other/index.md) | 登记初始化前已存在但尚未归入架构、接口、需求、组件库或测试目录的项目文档。 |

## 当前组件库对外契约

| 组件 | 文档 | 来源 |
|---|---|---|
| DateRangePicker | [DateRangePicker](out-components/DateRangePicker.md) | `packages/components/src/DateRangePicker` |
| EnterNextContainer | [EnterNextContainer](out-components/EnterNextContainer.md) | `packages/components/src/EnterNextContainer` |
| PopoverTableSelect | [PopoverTableSelect](out-components/PopoverTableSelect.md) | `packages/components/src/PopoverTableSelect` |
| ElementConfigForm | [ElementConfigForm](out-components/ElementConfigForm.md) | `packages/ConfigForm/element` |
| AntdConfigForm | [AntdConfigForm](out-components/AntdConfigForm.md) | `packages/ConfigForm/antd` |
| ShadcnConfigForm | [ShadcnConfigForm](out-components/ShadcnConfigForm.md) | `packages/ConfigForm/shadcn` |
| RuntimeConfigForm | [RuntimeConfigForm](out-components/RuntimeConfigForm.md) | `packages/ConfigForm/runtime` |
| ConfigFormInternalComponents | [ConfigFormInternalComponents](out-components/ConfigFormInternalComponents.md) | `packages/ConfigForm/*/src/components` |

## 外部组件库消费约束

| 组件库/工具 | 文档 | 本仓库用途 |
|---|---|---|
| Ant Design Vue | [AntDesignVue](components/AntDesignVue.md) | Antd 版 ConfigForm、运行时适配插件和 playground 示例 |
| Element Plus | [ElementPlus](components/ElementPlus.md) | Element 版 ConfigForm、基础组件封装、自动导入 Resolver 和 playground 示例 |
| shadcn-vue 本地组件协议 | [ShadcnVue](components/ShadcnVue.md) | 本地生成组件注册、字段绑定和只读展示适配 |
| unplugin-vue-components | [UnpluginVueComponents](components/UnpluginVueComponents.md) | playground 自动导入 Element Plus 组件 |

## 需求模块导航

| 需求模块 | PRD | 架构 | API | 组件 | 测试 |
|---|---|---|---|---|---|
| 组件AI文档与调试助手 | [PRD](prds/组件AI文档与调试助手.md)（已定稿） | [架构概览](architecture/overview.md)（已定稿） | [BFF接口](out-api/ai-debug-assistant.md)（契约设计/planned） | 源码公共契约（Props/Emits/Slots/Model/类型与注释） | [测试设计](test/组件AI文档与调试助手.md)（已定稿） |

## 维护约定

- 新增业务文档时，使用稳定业务名作为文件名，例如 `采购订单.md`。
- 架构文档放入 `docs/architecture/`，接口文档放入 `docs/api/`，需求文档放入 `docs/prds/`，测试文档放入 `docs/test/`，当前组件库对外契约放入 `docs/out-components/`，外部组件库消费约束放入 `docs/components/`。
- 初始化前已存在的旧文档归档到 `docs/other/imported/`；整理时先评估归属，再转换为标准分类文档。
- 全局接口协议维护在 `docs/api/_protocol.md`；业务接口文档不得重复定义冲突协议。
- 新增或改名文档后，同步更新对应目录的 `index.md` 和本文件。
- 文档只记录已确认事实；缺失信息标记为 `MISSING`，不得用代码推断伪造业务结论。

## 知识源入口

| 文件 | 用途 | 状态 |
|---|---|---|
| [airules.knowledge.json](../airules.knowledge.json) | 登记可被 AI 检索的项目知识源；当前仅支持文件系统来源，非文件系统来源必须先实现安装、查询和校验合同。 | managed |
