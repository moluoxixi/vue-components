import type { BaseApiConfig } from './types'
import BaseApi from './BaseApi'

export function createHttpService(config: BaseApiConfig = {}): BaseApi {
  return new BaseApi(config)
}

export function getHttpService(config: BaseApiConfig = {}): BaseApi {
  return createHttpService(config)
}
