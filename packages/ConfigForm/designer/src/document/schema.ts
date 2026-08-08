import type { RuleJsonValue } from '@moluoxixi/zod3-to-rule'
import type { DesignerConditionExpression, DesignerConditionOperand } from '../condition'
import type { DesignerDocument, DesignerNode } from './types'
import { ruleSetSchema } from '@moluoxixi/zod3-to-rule'
import { z } from 'zod'
import { DESIGNER_DOCUMENT_VERSION } from '../constants'

const jsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
export const designerJsonValueSchema: z.ZodType<RuleJsonValue> = z.lazy(() => z.union([
  jsonPrimitiveSchema,
  z.array(designerJsonValueSchema),
  z.record(z.string(), designerJsonValueSchema),
]))

const conditionOperandSchema: z.ZodType<DesignerConditionOperand> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), field: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('literal'), value: designerJsonValueSchema }).strict(),
])

export const designerConditionSchema: z.ZodType<DesignerConditionExpression> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.boolean() }).strict(),
  z.object({
    kind: z.literal('compare'),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
    left: conditionOperandSchema,
    right: conditionOperandSchema,
  }).strict(),
  z.object({ kind: z.literal('and'), expressions: z.array(designerConditionSchema).min(1) }).strict(),
  z.object({ kind: z.literal('or'), expressions: z.array(designerConditionSchema).min(1) }).strict(),
  z.object({ kind: z.literal('not'), expression: designerConditionSchema }).strict(),
]))

const conditionsSchema = z.object({
  visible: designerConditionSchema.optional(),
  hidden: designerConditionSchema.optional(),
  required: designerConditionSchema.optional(),
  disabled: designerConditionSchema.optional(),
  readonly: designerConditionSchema.optional(),
}).strict()

const responsiveLayoutOverrideSchema = z.object({
  columns: z.number().int().min(1).max(24).optional(),
  fieldSpan: z.number().int().min(1).max(24).optional(),
}).strict()

const nodeBaseShape = {
  id: z.string().min(1),
  material: z.string().min(1),
  props: z.record(z.string(), designerJsonValueSchema).optional(),
  span: z.number().int().positive().optional(),
  conditions: conditionsSchema.optional(),
}

export const designerNodeSchema: z.ZodType<DesignerNode> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({
    ...nodeBaseShape,
    kind: z.literal('field'),
    field: z.string().min(1),
    label: z.string().optional(),
    defaultValue: designerJsonValueSchema.optional(),
    validation: ruleSetSchema.optional(),
    validateOn: z.union([
      z.enum(['submit', 'blur', 'change']),
      z.array(z.enum(['submit', 'blur', 'change'])).min(1),
    ]).optional(),
  }).strict(),
  z.object({
    ...nodeBaseShape,
    kind: z.literal('container'),
    slots: z.record(z.string().min(1), z.array(designerNodeSchema)),
  }).strict(),
]))

export const designerDocumentSchema: z.ZodType<DesignerDocument> = z.object({
  version: z.literal(DESIGNER_DOCUMENT_VERSION),
  form: z.object({
    readonly: z.boolean().optional(),
    inline: z.boolean().optional(),
    columns: z.number().int().positive().optional(),
    gap: z.string().min(1).optional(),
    fieldSpan: z.number().int().positive().optional(),
    labelPosition: z.enum(['left', 'top']).optional(),
    responsive: z.object({
      tablet: responsiveLayoutOverrideSchema.optional(),
      mobile: responsiveLayoutOverrideSchema.optional(),
    }).strict().optional(),
  }).strict(),
  nodes: z.array(designerNodeSchema),
}).strict()
