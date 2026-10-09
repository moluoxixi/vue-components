<script setup lang="ts">
import type { ModelJsonObject, SafeExpression, SafeExpressionNode } from '@moluoxixi/config-form-model'
import { DESIGNER_EXPRESSION_EVALUATOR_KEY } from '@designer/expression'
import { useDesignerLocale } from '@designer/locale'
import { computed, inject, ref } from 'vue'

const props = defineProps<{ expression?: SafeExpression }>()
const locale = useDesignerLocale()
const evaluator = inject(DESIGNER_EXPRESSION_EVALUATOR_KEY, () => undefined)
const sample = ref('{ "values": {}, "parameters": {}, "item": {}, "result": null }')
const dependencies = computed(() => {
  const paths = new Set<string>()
  function visit(node: SafeExpressionNode): void {
    if (node.kind === 'reference') {
      paths.add(
        `${node.scope}${node.scope === 'values' && node.selector ? `:${node.selector}` : ''}.${node.path.join('.')}`,
      )
    }
    else if (node.kind === 'binary') {
      visit(node.left)
      visit(node.right)
    }
    else if (node.kind === 'unary') {
      visit(node.operand)
    }
    else if (node.kind === 'conditional') {
      visit(node.test)
      visit(node.consequent)
      visit(node.alternate)
    }
    else if (node.kind === 'call') {
      node.args.forEach(visit)
    }
    else if (node.kind === 'array') {
      node.items.forEach(visit)
    }
  }
  if (props.expression)
    visit(props.expression.ast)
  return [...paths]
})
const output = computed(() => {
  const evaluate = evaluator()
  if (!evaluate || !props.expression)
    return undefined
  try {
    const parsed = JSON.parse(sample.value) as ModelJsonObject
    return evaluate(props.expression, parsed)
  }
  catch (error) {
    return { success: false as const, message: error instanceof Error ? error.message : String(error) }
  }
})
</script>

<template>
  <details class="mx-config-form-designer__expression-playground">
    <summary>
      {{ locale.t('interaction.expression.test', 'Dependencies and test') }}<span>{{ dependencies.length }}</span>
    </summary>
    <div class="mx-config-form-designer__expression-dependencies">
      <code v-for="path in dependencies" :key="path">{{ path }}</code><span v-if="!dependencies.length">{{ locale.t('interaction.expression.constant', 'Constant expression') }}</span>
    </div>
    <template v-if="evaluator()">
      <label>{{ locale.t('interaction.expression.sample', 'Sample context JSON')
      }}<textarea
        v-model="sample"
        rows="5"
        :aria-label="locale.t('interaction.expression.sample', 'Sample context JSON')"
      /></label><output v-if="output" aria-live="polite" :data-success="output.success"><template v-if="output.success">{{ locale.t('interaction.expression.result', 'Result') }}:
        <code>{{ JSON.stringify(output.value) }}</code></template><template v-else>{{ output.message }}</template></output>
    </template>
  </details>
</template>
