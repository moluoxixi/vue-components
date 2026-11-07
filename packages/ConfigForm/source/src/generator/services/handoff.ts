import type { SourceStyleTarget } from '../types'

/** Instructions travel with browser, SDK and CLI exports. */
export function sourceHandoffReadme(kind: 'raw-source' | 'config-bindings', style: SourceStyleTarget): string {
  const raw = kind === 'raw-source'
  return `# ${raw ? 'Vue source project' : 'ConfigForm binding code'}

${raw
  ? 'This is an editable Vue application. It uses Vue, Vue Router and the selected UI library, and runs without ConfigForm.'
  : 'This is a ConfigForm integration library for an existing Vue application. It has no app entry or standalone preview page.'}

## ${raw ? 'Run the application' : 'Check and build the library'}

\`\`\`sh
pnpm install
${raw ? 'pnpm dev\n' : ''}pnpm typecheck
pnpm build
\`\`\`

## Continue development

${raw
  ? '- Start with the generated page Vue components. Their values, validation and supported local interactions are ordinary source code.\n- When copying a page into an existing application, include its imported helpers, resources and styles, and register the UI library as shown in src/main.ts.'
  : '- Start with each page\'s config.ts and Vue component. src/bindings.ts exports field factories, initial values and form configuration.\n- Install the runtime dependencies listed in package.json and import the generated styles. The Vue components demonstrate model creation and field bindings.\n- For pages with navigation or overlays, implement the actions contract from src/host.ts in your application.'}
- ${style === 'tailwind-v4' ? 'This export uses Tailwind CSS v4. Keep the generated Vite plugin and styles, or enable Tailwind v4 in the consuming application.' : 'This export uses regular CSS. Include the generated stylesheet in the consuming application.'}
- Datasets come from the design project. Connect production APIs, authentication, persistence and submit handlers in your application code.

## Keep the editable design

Save the design JSON separately to reopen it in the designer. This source export cannot be imported back into a design project. Regenerating source does not merge manual code changes; compare new output before integrating it.
`
}
