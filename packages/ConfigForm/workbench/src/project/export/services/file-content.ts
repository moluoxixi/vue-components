import type { SourceFile } from '@moluoxixi/config-form-source/generator'
import { strToU8 } from 'fflate'

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_VALUES = new Map([...BASE64_ALPHABET].map((character, index) => [character, index]))

export function sourceFileBytes(file: Readonly<SourceFile>): Uint8Array {
  if (file.kind === 'text')
    return strToU8(file.content)

  const padding = file.contentBase64.endsWith('==') ? 2 : file.contentBase64.endsWith('=') ? 1 : 0
  const bytes = new Uint8Array((file.contentBase64.length / 4) * 3 - padding)
  let offset = 0
  for (let index = 0; index < file.contentBase64.length; index += 4) {
    const value = ((BASE64_VALUES.get(file.contentBase64[index]!) ?? 0) << 18)
      | ((BASE64_VALUES.get(file.contentBase64[index + 1]!) ?? 0) << 12)
      | ((BASE64_VALUES.get(file.contentBase64[index + 2]!) ?? 0) << 6)
      | (BASE64_VALUES.get(file.contentBase64[index + 3]!) ?? 0)
    if (offset < bytes.length)
      bytes[offset++] = (value >>> 16) & 0xFF
    if (offset < bytes.length)
      bytes[offset++] = (value >>> 8) & 0xFF
    if (offset < bytes.length)
      bytes[offset++] = value & 0xFF
  }
  return bytes
}
