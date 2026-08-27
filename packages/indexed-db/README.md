# @moluoxixi/indexed-db

轻量 IndexedDB key-value 存储工具。

## 使用

```ts
import { createIndexDBStorage } from '@moluoxixi/indexed-db'

const storage = createIndexDBStorage({
  dbName: 'app-cache',
  storeName: 'kv',
})

await storage.setItem('profile', { name: 'Ada' })
const profile = await storage.getItem('profile')

const nextProfile = await storage.updateItem('profile', current => ({
  ...current,
  visits: (current?.visits ?? 0) + 1,
}))
```

## API

- `setItem(key, value)`
- `getItem(key)`
- `updateItem(key, updater)`：在一个 `readwrite` transaction 内读取并写回；`updater` 必须同步，返回 `null` 时删除记录。
- `removeItem(key)`
- `clear()`
- `keys()`
- `length()`
- `setItems(items)`
- `getItems(keys)`
- `close()`

## 业务剥离范围

- 不导出默认全局实例，调用方必须显式声明 `dbName` 和 `storeName`。
- 不在 IndexedDB 不可用时静默回退到 `localStorage`。
- 不包含 Web Worker 封装，避免构建工具与运行时路径黑盒。
- 参数或运行时环境不满足契约时直接抛错。
