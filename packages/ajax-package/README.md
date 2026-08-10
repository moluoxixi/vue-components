# @moluoxixi/ajax-package

基于 `axios` 的可复用 HTTP 客户端包。

## 使用

```ts
import { getHttpService } from '@moluoxixi/ajax-package'

const session = {
  token: 'token-from-app',
}

const http = getHttpService({
  baseURL: 'https://api.example.com',
  token: {
    getToken: () => session.token,
    headerName: 'Authorization',
    formatToken: token => `Bearer ${token}`,
  },
})

const users = await http.get('/users')
```

## 响应契约

默认返回 `response.data`，不会假设业务响应结构。需要解析业务包裹层时显式声明契约：

```ts
const http = getHttpService({
  responseContract: {
    codePath: 'code',
    messagePath: 'message',
    dataPath: 'data.items',
    isSuccess: code => code === 0,
  },
})
```

## 业务剥离范围

- 不导出 Vue 插件，不写入 `window.$http`。
- 不依赖 Element Plus、弹窗组件或通知组件。
- 不内置登录页跳转、localStorage token 读取、系统异常弹窗和特定业务错误码。
- HTTP 错误、axios 错误和响应契约错误都会继续抛出，调用方自行决定 UI 副作用。
