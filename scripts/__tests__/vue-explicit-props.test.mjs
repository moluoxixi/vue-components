import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const filePath = 'packages/ConfigForm/workbench/src/PropsRuleFixture.vue'
const lint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === 'project-vue/explicit-props' })
const fix = new ESLint({ fix: true, ruleFilter: ({ ruleId }) => ruleId === 'project-vue/explicit-props' })

describe('explicit Vue props convention', () => {
  it('qualifies template references, shorthand bindings and script references', async () => {
    const source = `<script setup lang="ts">const props = defineProps<{ title: string }>(); console.log(title)</script><template><div :title="title" :class="{ title }">{{ title }}</div></template>`
    const [result] = await fix.lintText(source, { filePath })
    expect(result.errorCount).toBe(0)
    expect(result.output).toContain('console.log(props.title)')
    expect(result.output).toContain('{ title: props.title }')
    expect(result.output).toContain('{{ props.title }}')
  }, 30_000)
  it('respects v-for, slot parameters and derived component state', async () => {
    const source = `<script setup lang="ts">const props = defineProps<{ title: string }>(); const items = ['a']; const derived = () => props.title.toUpperCase()</script><template><p v-for="title in items" :key="title">{{ title }} {{ props.title }}</p><slot :title="derived()"/><Comp v-slot="{ title }">{{ title }}</Comp></template>`
    const [result] = await lint.lintText(source, { filePath })
    expect(result.messages).toEqual([])
  })
  it('rejects destructuring and aliases rather than hiding inputs', async () => {
    for (const setup of ['const { title } = defineProps<{title:string}>()', 'const input = defineProps<{title:string}>()', 'const props = defineProps<{title:string}>(); const title = props.title']) {
      const [result] = await lint.lintText(`<script setup lang="ts">${setup}</script>`, { filePath })
      expect(result.messages.some(message => message.messageId === 'binding')).toBe(true)
    }
  })
})
