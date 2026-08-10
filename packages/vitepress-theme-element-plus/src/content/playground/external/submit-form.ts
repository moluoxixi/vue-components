export interface ElementPlusDocsProjectFormOptions {
  document?: Document
  target?: string
}

export function submitElementPlusDocsProjectForm(
  action: string,
  fields: Readonly<Record<string, string>>,
  options: ElementPlusDocsProjectFormOptions = {},
): void {
  const ownerDocument = options.document ?? document
  const form = ownerDocument.createElement('form')
  form.action = action
  form.method = 'POST'
  form.target = options.target ?? '_blank'
  form.setAttribute('rel', 'noopener')
  form.style.display = 'none'

  for (const [name, value] of Object.entries(fields)) {
    const input = ownerDocument.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }

  ownerDocument.body.append(form)
  try {
    form.submit()
  }
  finally {
    form.remove()
  }
}
