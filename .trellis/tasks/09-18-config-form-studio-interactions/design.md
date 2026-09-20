# Studio 原型交互与体验模式技术设计

## 当前差距

Model 已有 `StateProjectionRule`、`ValueChangeRule`、`PrimaryUiActionBinding`、safe expression schema 和 Prototype Runtime reducer；Designer 属性面板只有 Properties/Validation 两个 tab，Workbench renderer/adapter 只监听 `activate`/`submit`，因此联动合同存在但作者入口与部分 semantic trigger 不可达。

## 边界与所有权

- Model/Prototype Runtime 继续拥有 AST 校验、确定求值、状态投影、值事务、页面历史和 overlay instance 栈。
- Designer 增加 Interaction 作者区域，提供显隐/禁用/只读/动态必填、值 set/copy/clear 和单一主要 UI 动作编辑；不提供事件编排、任意函数、HTTP 或事件转发。
- Workbench Experience 只调用共享 reducer；Runtime Host 增加 row/item semantic source；Source resolver 仅映射既有语义 listener。
- 所有编辑走 `surface.interactions` 单命令/history/autosave；非法草稿保留并阻止 Experience/Source。

## 运行语义

状态规则持续计算白名单状态/属性，动态值覆盖静态 baseline；值动作只在依赖字段变化后按声明顺序执行，初始化不执行，多写 warning、循环 abort。主要动作执行前可选 validation gate，支持 navigate/back/open/close-current/close-all；open 参数/结果使用安全表达式并原子写回。Dialog/Drawer 可由用户动作无限重复/嵌套，每次为独立 instance，ESC/mask/button 只关闭栈顶并恢复 opener focus。

## 验证

补 Designer interaction tab、Model/Runtime/Compiler/Source parity 单测和 Workbench Playwright：静态/动态必填、显隐、禁用、只读、值联动、页面跳转、Page->Dialog->Drawer->Dialog、循环诊断、焦点恢复、390/900/1440 布局。确认没有任何事件编辑器、事件转发或函数桩回归。
