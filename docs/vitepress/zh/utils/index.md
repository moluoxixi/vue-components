---
title: 工具库
description: MoluoXixi 的运行时工具与工程配置包
---

# 工具库

工具包与组件共享同一个 pnpm workspace、Changesets 发布流程和 VitePress 站点，同时保持独立安装，避免把无关运行环境和依赖绑定到一起。

## 运行时工具

- [@moluoxixi/utils](./utils)：跨环境通用函数与 Node.js 项目清单工具
- [@moluoxixi/ajax-package](./ajax-package)：基于 Axios 的 HTTP 客户端
- [@moluoxixi/excel](./excel)：Excel 与 CSV 数据导入导出
- [@moluoxixi/indexed-db](./indexed-db)：IndexedDB key-value 存储

## 工程工具

- [@moluoxixi/eslint-config](./eslint-config)：共享 ESLint 配置工厂
- [@moluoxixi/postcss-selector-prefix](./postcss-selector-prefix)：选择器前缀替换插件
- [@moluoxixi/vite-config](./vite-config)：按依赖图装配插件的 Vite 配置预设
