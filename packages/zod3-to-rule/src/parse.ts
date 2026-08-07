import type { RuleJsonValue, RuleParseResult, RuleSet } from './types'
import { z } from 'zod'
import { RULE_SET_VERSION } from './constants'
import { formatRuleZodIssues } from './diagnostics'

const jsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
const jsonValueSchema: z.ZodType<RuleJsonValue> = z.lazy(() => z.union([
  jsonPrimitiveSchema,
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]))

const messageSchema = z.object({ message: z.string().min(1).optional() }).strict()
const baseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('string') }).strict(),
  z.object({ type: z.literal('number') }).strict(),
  z.object({ type: z.literal('boolean') }).strict(),
  z.object({ type: z.literal('date') }).strict(),
  z.object({ type: z.literal('enum'), values: z.array(z.string()).min(1) }).strict(),
  z.object({ type: z.literal('literal'), value: jsonPrimitiveSchema }).strict(),
])

const ruleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required') }).merge(messageSchema),
  z.object({ kind: z.literal('minLength'), value: z.number().int().nonnegative() }).merge(messageSchema),
  z.object({ kind: z.literal('maxLength'), value: z.number().int().nonnegative() }).merge(messageSchema),
  z.object({ kind: z.literal('length'), value: z.number().int().nonnegative() }).merge(messageSchema),
  z.object({ kind: z.literal('regex'), source: z.string().min(1), flags: z.string().optional() }).merge(messageSchema),
  z.object({ kind: z.literal('email') }).merge(messageSchema),
  z.object({ kind: z.literal('url') }).merge(messageSchema),
  z.object({ kind: z.literal('uuid') }).merge(messageSchema),
  z.object({ kind: z.literal('min'), value: z.number().finite(), inclusive: z.boolean().optional() }).merge(messageSchema),
  z.object({ kind: z.literal('max'), value: z.number().finite(), inclusive: z.boolean().optional() }).merge(messageSchema),
  z.object({ kind: z.literal('integer') }).merge(messageSchema),
  z.object({ kind: z.literal('finite') }).merge(messageSchema),
  z.object({ kind: z.literal('multipleOf'), value: z.number().finite().positive() }).merge(messageSchema),
  z.object({ kind: z.literal('dateMin'), value: z.string().datetime() }).merge(messageSchema),
  z.object({ kind: z.literal('dateMax'), value: z.string().datetime() }).merge(messageSchema),
  z.object({
    kind: z.literal('compare'),
    field: z.string().min(1),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
  }).merge(messageSchema),
  z.object({ kind: z.literal('custom'), key: z.string().min(1), params: jsonValueSchema.optional() }).merge(messageSchema),
]).superRefine((rule, context) => {
  if (rule.kind !== 'regex')
    return

  try {
    const regex = new RegExp(rule.source, rule.flags)
    void regex
  }
  catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid regular expression',
      path: ['source'],
    })
  }
})

const ruleSetSchema = z.object({
  version: z.literal(RULE_SET_VERSION),
  base: baseSchema,
  rules: z.array(ruleSchema),
  optional: z.boolean().optional(),
  nullable: z.boolean().optional(),
}).strict() as unknown as z.ZodType<RuleSet>

export function parseRuleSet(input: unknown): RuleParseResult {
  const result = ruleSetSchema.safeParse(input)
  if (!result.success)
    return { success: false, diagnostics: formatRuleZodIssues(result.error.issues) }

  return {
    success: true,
    data: result.data,
    diagnostics: [],
  }
}

export { ruleSetSchema }
