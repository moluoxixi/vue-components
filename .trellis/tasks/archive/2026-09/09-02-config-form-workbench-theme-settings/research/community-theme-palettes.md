# 社区主题候选与产品化约束

## 1. 研究目的

本研究回答两个问题：哪些非蓝色主题具有可复核的社区采用信号；如何把编辑器 palette 转成适合高密度 Workbench 的 Light/Dark 产品语义色。采用量只用于筛选候选，不代替可访问性和真实界面测试。

核验日期：2026-09-02。

## 2. 社区采用信号

| 主题 | 公开采用信号 | 结论 |
| --- | --- | --- |
| Catppuccin | VS Code 约 1,385,319 安装，评分约 4.965；Open VSX 约 510,213 下载 | 高采用，Latte/Mocha 层级完整，默认候选 |
| Gruvbox | VS Code 约 1,051,103 安装；主题仓库约 15,723 stars | 跨编辑器影响强，暖中性候选 |
| Kanagawa | Neovim 主题仓库约 6,368 stars | 灰墨与朱红方向明确 |
| Rosé Pine | VS Code 约 333,639 安装；Open VSX 约 98,000 下载 | 非蓝色玫瑰强调，Light/Dark 配对清楚 |

查询入口：

- VS Code Marketplace Extension Query API：`https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`
- Open VSX API：`https://open-vsx.org/api/{namespace}/{extension}`
- GitHub Repository API：`https://api.github.com/repos/{owner}/{repo}`

GitHub Theme、One Dark Pro、Tokyo Night、Nord 的主强调色明显偏蓝；Dracula 主 accent 偏青。它们虽有更高采用量，但不满足用户的非蓝色偏好，故不进入最终四套。

## 3. 官方来源与配对

| 家族 | Light/Dark | 官方 palette 来源 |
| --- | --- | --- |
| Catppuccin | Latte / Mocha | `https://raw.githubusercontent.com/catppuccin/palette/main/palette.json` |
| Kanagawa | Lotus / Wave | `https://github.com/rebelot/kanagawa.nvim/blob/master/lua/kanagawa/colors.lua` |
| Gruvbox Material | Light Medium Material / Dark Medium Material | `https://github.com/sainnhe/gruvbox-material/blob/master/autoload/gruvbox_material.vim` |
| Rosé Pine | Dawn / Main | `https://github.com/rose-pine/neovim/blob/main/lua/rose-pine/palette.lua` |

Rosé Pine 的默认 Dark 是 Main，不使用 Moon 替代。Gruvbox 采用 Material foreground + medium background 组合。

## 4. 非蓝色原始 seed

以下仅是 palette 来源 seed，不是最终产品 token。最终值必须通过实际 foreground/background 对比度门禁。

| 配对 | workspace | panel | text | non-blue accent |
| --- | --- | --- | --- | --- |
| Catppuccin Latte | `#eff1f5` | `#e6e9ef` | `#4c4f69` | mauve `#8839ef` |
| Catppuccin Mocha | `#1e1e2e` | `#313244` | `#cdd6f4` | mauve `#cba6f7` |
| Kanagawa Lotus | `#dcd5ac` | `#e5ddb0` | `#545464` | lotus red `#c84053` |
| Kanagawa Wave | `#16161d` | `#1f1f28` | `#dcd7ba` | sakura pink `#e46876` |
| Gruvbox Light | `#ebdbb2` | `#eddeb5` | `#654735` | purple `#945e80` |
| Gruvbox Dark | `#282828` | `#32302f` | `#d4be98` | purple `#d3869b` |
| Rosé Pine Dawn | `#faf4ed` | `#fffaf3` | `#464261` | love `#b4637a` |
| Rosé Pine Main | `#191724` | `#1f1d2e` | `#e0def4` | love `#eb6f92` |

## 5. 对比度事实与风险

对比度按 WCAG sRGB relative luminance `(L1 + 0.05) / (L2 + 0.05)` 计算。普通/小号文字至少 4.5:1；关键控件边界和非文本状态至少 3:1。

- 原主题相邻 surface 普遍不够作为控件边界。例如 Catppuccin Latte `surface0/mantle` 约 1.27:1、Mocha 约 1.40:1；Gruvbox Material 相邻 Light surface 约 1.19:1。
- Kanagawa Wave 原 `line #54546d` 对 workspace 约 2.46:1，低于 3:1。
- Catppuccin Latte、Kanagawa Lotus、Gruvbox Light、Rosé Pine Dawn 的若干 accent/status 对背景低于 4.5:1，不能直接承担小号彩色正文。
- Light 主题的 accent foreground 和 filled action foreground 必须按实际组合重新选择，不能默认取 workspace 或纯白。

因此每套主题都必须新增独立的：

- `visible-border` / `control-border`
- `accent-foreground` / `filled-action-foreground`
- `success|warning|danger-foreground`
- `focus-ring`

这些是产品化语义修正，不是逐色复制语法主题。

## 6. 验证策略

- 4 palette × 2 resolved scheme = 8 套 token contract。
- 每套验证正文、muted text、control border、focus、filled action 与 status foreground。
- 8 套实际 DOM 状态运行 axe；system 只验证解析，不复制视觉组合。
- Runtime iframe 不使用这些 token，并以 Element Plus/Ant Design Vue computed-style 指纹证明隔离。
