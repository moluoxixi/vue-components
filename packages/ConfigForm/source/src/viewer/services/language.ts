import type { SourceFile } from '../../generator'

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  css: 'CSS',
  json: 'JSON',
  scss: 'SCSS',
  text: 'Plain text',
  typescript: 'TypeScript',
  vue: 'Vue',
}

export function sourceLanguageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language
}

export function monacoLanguage(language: string): string {
  if (language === 'text')
    return 'plaintext'
  if (language === 'json')
    return 'javascript'
  if (language === 'vue')
    return 'html'
  return language
}

export function sourceFileIconKind(file: SourceFile): 'binary' | 'code' | 'data' | 'text' {
  if (file.kind === 'binary')
    return 'binary'
  if (file.language === 'json')
    return 'data'
  if (file.language === 'text')
    return 'text'
  return 'code'
}

export function decodedBase64ByteLength(contentBase64: string): number {
  if (!contentBase64)
    return 0
  const padding = contentBase64.endsWith('==') ? 2 : contentBase64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(contentBase64.length * 3 / 4) - padding)
}
