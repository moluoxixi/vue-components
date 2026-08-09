export function formatElementPlusDocsMessage(
  template: string,
  values: Record<string, number | string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}
