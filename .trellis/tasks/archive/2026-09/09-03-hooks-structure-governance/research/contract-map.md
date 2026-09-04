# Hooks 契约与测试映射

## 当前覆盖

- 29 个测试：Batch 7、Detail 5、FormSubmit 5、ListPage 6、RequestOptions 3、RequestTable 3。
- 所有 hook 测试均在安装 `VueQueryPlugin` 的组件 setup 中执行。
- 覆盖主要 query keys、分页/筛选 reset、selection、create/update、invalidation、error 与 reset。

## 补充 characterization

- 根入口 exact runtime keys：六个 hook与 `normalizeQueryKey`、`invalidateQueryKeys`。
- RequestTable 外部 Ref 与内部 ref ownership、params/pageSize watch reset。
- 正整数归一化对有限性、正数、取整和 fallback 的边界。

## Consumer

- Components request adapters 消费 useRequestTable/useRequestOptions；ConfigTable/Popover 类型消费 QueryKeyBase/RequestTable contracts。
- 无 package deep import、dynamic import 或 mock literal path。
- 构建与 packed smoke 必须保持 `vue`、`@tanstack/vue-query` external和根声明可解析。
