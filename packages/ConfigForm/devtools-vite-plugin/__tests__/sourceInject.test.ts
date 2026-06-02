import { describe, expect, it } from 'vitest'
import { transformDefineFieldSource } from '../src/sourceInject'

const TS_FILE = 'D:/project-new/ConfigForm/packages/ConfigForm/playground/src/examples/components/ShadcnDemoControls.ts'
const VUE_FILE = 'D:/project-new/ConfigForm/packages/ConfigForm/playground/src/examples/ElementConfigForm.vue'

describe('defineField source injection', () => {
  it('injects source metadata into imported defineField object calls', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const fields = [',
        '  defineField({',
        '    field: \'username\',',
        '    component: \'input\',',
        '  }),',
        ']',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('__source')
    expect(result?.code).toContain('file: "D:/project-new/ConfigForm/packages/ConfigForm/playground/src/examples/components/ShadcnDemoControls.ts"')
    expect(result?.code).toContain('line: 3')
    expect(result?.code).toContain('column: 15')
    expect(result?.code).not.toContain('\n    , __source')
  })

  it('preserves valid syntax for field configs with trailing commas', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const fields = [',
        '  defineField({',
        '    field: \'username\',',
        '    component: \'input\',',
        '  }),',
        ']',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('component: \'input\',')
    expect(result?.code).toContain('  __source:')
    expect(result?.code).not.toContain(', __source')
  })

  it('supports aliased defineField imports', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField as field } from \'@moluoxixi/config-form\'',
        'const item = field({ field: \'status\', component: \'input\' })',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('__source')
  })

  it('injects metadata into empty field config objects', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const item = defineField({})',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('defineField({ __source:')
  })

  it('injects metadata when defineField appears on the first script line', () => {
    const result = transformDefineFieldSource({
      code: 'import { defineField } from \'@moluoxixi/config-form\'; const item = defineField({})',
      id: TS_FILE,
    })

    expect(result?.code).toContain('line: 1')
  })

  it('ignores non-source object keys while checking existing source metadata', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const item = defineField({ 1: \'numeric\', field: \'name\', component: \'input\' })',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('__source')
  })

  it('supports custom package names', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@scope/custom-config-form\'',
        'const item = defineField({ field: \'custom\', component: \'input\' })',
      ].join('\n'),
      id: TS_FILE,
      packageNames: ['@scope/custom-config-form'],
    })

    expect(result?.code).toContain('__source')
  })

  it('does not transform unrelated local functions', () => {
    const result = transformDefineFieldSource({
      code: 'const field = defineField({ field: "local", component: "input" })',
      id: TS_FILE,
    })

    expect(result).toBeNull()
  })

  it('does not transform dynamic defineField inputs', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const config = { field: "dynamic", component: "input" }',
        'defineField(config)',
        'defineField()',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result).toBeNull()
  })

  it('does not transform unsupported file extensions', () => {
    const result = transformDefineFieldSource({
      code: 'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({})',
      id: 'D:/project-new/ConfigForm/README.md',
    })

    expect(result).toBeNull()
  })

  it('does not transform Vite submodule requests with query strings', () => {
    const result = transformDefineFieldSource({
      code: 'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({})',
      id: `${VUE_FILE}?vue&type=style&index=0&lang.scss`,
    })

    expect(result).toBeNull()
  })

  it('throws when a field already contains __source', () => {
    expect(() => transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'defineField({ field: \'name\', component: \'input\', __source: {} })',
      ].join('\n'),
      id: TS_FILE,
    })).toThrow(/already contains __source/)
  })

  it('throws when a field already contains quoted __source', () => {
    expect(() => transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'defineField({ field: \'name\', component: \'input\', "__source": {} })',
      ].join('\n'),
      id: TS_FILE,
    })).toThrow(/already contains __source/)
  })

  it('throws parser errors with file context', () => {
    expect(() => transformDefineFieldSource({
      code: 'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({',
      id: TS_FILE,
    })).toThrow(/Failed to parse/)
  })

  it('injects source metadata inside Vue script setup blocks', () => {
    const result = transformDefineFieldSource({
      code: [
        '<template><div /></template>',
        '<script setup lang="ts">',
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const item = defineField({ field: \'email\', component: \'input\' })',
        '</script>',
      ].join('\n'),
      id: VUE_FILE,
    })

    expect(result?.code).toContain('<template><div /></template>')
    expect(result?.code).toContain('__source')
    expect(result?.code).toContain('file: "D:/project-new/ConfigForm/packages/ConfigForm/playground/src/examples/ElementConfigForm.vue"')
    expect(result?.code).toContain('line: 4')
  })

  it('injects source metadata into nested slot container and input nodes', () => {
    const result = transformDefineFieldSource({
      code: [
        '<script setup lang="ts">',
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const fields = [',
        '  defineField({',
        '    component: OuterContainer,',
        '    slots: {',
        '      default: [',
        '        defineField({',
        '          component: InnerContainer,',
        '          slots: {',
        '            default: [',
        '              defineField({ field: \'nestedInput\', component: Input })',
        '            ],',
        '          },',
        '        }),',
        '      ],',
        '    },',
        '  }),',
        ']',
        '</script>',
      ].join('\n'),
      id: VUE_FILE,
    })

    expect(result?.code.match(/__source/g)).toHaveLength(3)
    expect(result?.code).toContain('line: 4')
    expect(result?.code).toContain('line: 8')
    expect(result?.code).toContain('line: 12')
  })

  it('injects source metadata for inline render functions inside defineField configs', () => {
    const result = transformDefineFieldSource({
      code: [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const fields = [',
        '  defineField({',
        '    field: \'name\',',
        '    component: (context) => context.getValue(\'name\'),',
        '    slots: {',
        '      default: (context, slotProps) => slotProps.label,',
        '    },',
        '  }),',
        ']',
      ].join('\n'),
      id: TS_FILE,
    })

    expect(result?.code).toContain('line: 5')
    expect(result?.code).toContain('line: 7')
  })

  it('returns null for Vue files without script blocks', () => {
    const result = transformDefineFieldSource({
      code: '<template><div /></template>',
      id: VUE_FILE,
    })

    expect(result).toBeNull()
  })

  it('throws Vue parser errors with file context', () => {
    expect(() => transformDefineFieldSource({
      code: '<template><div></template>',
      id: VUE_FILE,
    })).toThrow(/Failed to parse Vue SFC/)
  })
})
