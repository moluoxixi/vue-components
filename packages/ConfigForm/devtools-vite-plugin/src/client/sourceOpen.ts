import type { SetDevtoolsMessage, StoredNode } from './types'

/**
 * 请求开发服务器打开节点源码位置。
 *
 * 成功时不展示编辑器命令；HTTP 失败会把服务端错误展示到面板。
 */
export async function openNodeSource(node: StoredNode, setMessage: SetDevtoolsMessage): Promise<void> {
  const source = node.source
  if (!source) {
    setMessage('No source location for selected field/component')
    return
  }

  const response = await fetch('/__config-form-devtools/open', {
    body: JSON.stringify({
      column: source.column,
      file: source.file,
      line: source.line,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const payload = JSON.parse(text) as { error?: unknown }
      setMessage(typeof payload.error === 'string' ? payload.error : text)
    }
    catch {
      setMessage(text)
    }
    return
  }

  setMessage('')
}
