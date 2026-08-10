# @moluoxixi/utils

跨框架的 TypeScript 工具包，主打 **ESM 优先、纯函数优先、契约显式**。通用函数从包根导入，依赖 Node.js 的项目清单能力从 `@moluoxixi/utils/node` 导入。

```ts
import { deepClone, isEmpty, readValueByPath } from '@moluoxixi/utils'
import { detectDependencies, readPackageJSON } from '@moluoxixi/utils/node'
```

## 依赖检测 API 约定

`detectDependencies()` 会分别返回：

- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`
- `addonDeps`：`dependencies + devDependencies + peerDependencies + optionalDependencies`
- `runtimeDeps`：`dependencies + peerDependencies + optionalDependencies`
- `deps`：`runtimeDeps + devDependencies`

其中：

- `addonDeps` 适合用于 Vite 插件、测试框架、构建工具等 build-time addon 判断。
- `runtimeDeps` 适合用于运行时能力判断。
- `deps` 适合用于更宽泛的“项目是否声明过该包”场景。
- 各依赖字段返回的是浅拷贝快照，调用方修改返回值不会影响后续重新读取的结果。

## package.json 读取契约

- `readPackageJSON()` 在以下情况会显式失败：
  - 文件缺失
  - JSON 解析失败
  - 根结构不是对象
  - 依赖字段存在但不是 `Record<string, string>` 形态
- 该函数不会静默兼容非法 manifest 结构。

## deepClone 支持矩阵

已保证支持：

- Primitive 值透传
- `Object`
- `Array`
- `Date`
- `RegExp`
- `Map`
- `Set`
- Symbol 自有属性
- 循环引用
- 自有属性描述符与原型链保留

显式不支持：

- `WeakMap`
- `WeakSet`

未声明兼容保证：

- `Promise`
- `Error`
- `ArrayBuffer` / TypedArray / `DataView`
- DOM 对象
- 依赖内部槽位的特殊内建对象

## 1. 坚持纯净的 ESModule
- **标准导入导出模型**：内部及外部所有的数据流转和模块引入强制使用现代化的 `import / export` 语法（拒绝历史遗留的 CommonJS `require / module.exports` 规范）。在 Node 或者浏览器环境中提供原生的加载效率和支持。
- **消除副作用 (Side-Effects)**：保证通用工具代码中除了显式的 `export` 输出外，不在全局空间中做对象挂载、不主动进行立即执行的初始化副作用。并且要在其对应 `package.json` 内声明 `"sideEffects": false`，使得打包器可以放心地静态分析。

## 2. Tree-Shaking 友好与原子化设计
- **按需打包**：基于纯正的 ESM 优势，通过 Vite/Rollup 等构建体系在使用该包时，能够配合做到 Tree-Shaking。开发者在使用时，优先使用具名导入 (`import { deepClone } from '@moluoxixi/utils'`)。
- **保持函数的高内聚、低耦合**：每个核心函数都保证单一职责，足够细化和原子化。不包含 UI 逻辑依赖或特定框架上下文。

## 3. 严格的类型推导与测试机制（Type & Test）
- **TypeScript First 设计**：作为一个核心函数层，向外部输出必须拥有准确的数据结构定义和泛型推导机制，以在编译态拦截不合理的函数调用。
- **用例覆盖 (Coverage)**：由于它是下沉到最底部的基础设施，每一次函数加入都应该有对应的单元测试覆盖边界情况，保证整个应用生态的稳定性。
