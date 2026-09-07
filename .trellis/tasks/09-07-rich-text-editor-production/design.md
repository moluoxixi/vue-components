# 技术设计

## 职责

services 声明命令、扩展和内容策略；controller 管理实例和 props；状态 composable 订阅 transaction/update/destroy，比较快照并清理监听器。执行前实时检查能力，UI/slot 只消费快照和高层命令，不使用手动版本计数。

## 内容

modelValue 保留 string；jsonValue 存在时 JSON 是唯一来源，同时输出 HTML/JSON，取消时恢复 HTML。通过 ProseMirror Node.eq 比较规范化内容；外部更新不发事件且不加入本地 undo 历史。非法 JSON 发 contentError 并保留当前文档。原始 Editor 保留兼容 escape hatch。

## 扩展与链接

使用 TipTap Extensions 类型支持 Node/Mark，创建后不热重建。递归检测重复扩展名，防止静默覆盖。链接允许 http/https/mailto/tel、锚点、同源根路径，拒绝协议相对 URL、反斜杠和控制字符。isAllowedUri 复用协议政策，覆盖粘贴/导入。

## UI

子组件放到 RichTextEditor/components，保留类名和 CSS variables。包内没有 UI 框架，原生 select/input/button 已满足本次需求；链接区域用 group 避免 form 嵌套，处理 Enter/Escape 和焦点。toolbar-before/after 增量插槽及 toolbarItems 选择内置项。

## 验证

复用发布 smoke 的 Node/type 生成器，包专属 tarball fixture 运行 Vite 和浏览器交互，断言实际样式。TipTap 3.29.0 下界和 3.29.2 基线使用完整同版本依赖元组，增加 minor 前先验证矩阵。
