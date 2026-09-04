import type { Plugin } from 'vite'
import type { ServerContext } from '../../runtime'
import { dispatch } from './router'

export function i18nToolServerPlugin(context: ServerContext): Plugin {
  return {
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          if (!(await dispatch(context, request, response)))
            next()
        }
        catch (error) {
          next(error as Error)
        }
      })
    },
    name: 'moluoxixi:i18n-tool-server',
  }
}
