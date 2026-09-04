export function quote(value: string): string {
  return scriptJson(value)
}

/**
 * JSON embedded in a Vue SFC's script block must not contain a literal closing
 * tag. The SFC parser terminates the block before JavaScript parses string
 * literals, so escaping HTML-sensitive characters keeps arbitrary JSON-safe
 * user values (for example `</script>`) buildable in the generated project.
 */
export function scriptJson(value: unknown, space?: number): string {
  return (JSON.stringify(value, null, space) ?? 'undefined')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function escapeHtml(value: string): string {
  const entities = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    [String.fromCharCode(34), '&quot;'],
    [String.fromCharCode(39), '&#39;'],
  ])
  return value.replace(/[&<>'"]/g, character => entities.get(character)!)
}
