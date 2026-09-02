import type {
  ModelJsonObject,
  RegistryContractComponentSnapshot,
} from '@moluoxixi/config-form-model'
import { cloneJsonObject } from './immutable'

export function mergeComponentProps(
  defaults: RegistryContractComponentSnapshot['contract']['defaults'],
  configured: ModelJsonObject,
): ModelJsonObject {
  return cloneJsonObject({ ...defaults, ...configured })
}
