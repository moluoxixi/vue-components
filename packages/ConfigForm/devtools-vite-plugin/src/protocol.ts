/** open-in-editor middleware 的固定 HTTP 入口。 */
export const OPEN_IN_EDITOR_PATH = '/__config-form-devtools/open'

/** devtools client 必须携带的专用请求头，避免跨站表单 POST 触发本地副作用。 */
export const OPEN_IN_EDITOR_REQUEST_HEADER = 'x-config-form-devtools'

/** 专用请求头值；server 端按精确值校验。 */
export const OPEN_IN_EDITOR_REQUEST_HEADER_VALUE = 'open-in-editor'
