# I18n Tool 结构调研

## Debt 与热点

- 24 条 debt：5 UI single-parent、3 config root、8 core root、8 server root。
- 无 P0/P1；最大 `ServerContext` 471 行、App 317、json adapter 270、protocol 274，均为单一责任或编排边界。
- 当前 production relative import graph 无 cycle；动态加载仅 Jiti config import。

## Stable Surface

- exports：`.`, `./core`, `./config`, `./protocol`, `./server`；bin：`i18n-tool`。
- build entries：`index/core/config/protocol/server/cli`，UI：`dist/ui`。
- browser public entry 仅 `./protocol`；config/core/server 为 Node runtime entries。

## 目标结构

- UI 私有内容全部归入 `App/{components,services,state}`。
- Config 使用 schemas/services/types。
- Core 使用 adapters/constants/services/utils/types；diagnostic constants 与类型拆开。
- Server 使用 runtime/resources/filesystem/http domain，每个 domain 再使用 services/adapters；stable error放 errors。

## 依赖约束

- config -> core type-only；shared protocol -> core constants/types。
- server -> config/core/shared；http -> runtime；runtime -> resources/filesystem/errors。
- UI -> shared protocol + browser-safe core token helper；不依赖 server/config。
