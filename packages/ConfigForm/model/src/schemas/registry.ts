import type { ComponentContract } from '../types'
import { z } from 'zod'
import { REGISTRY_CONTRACT_SNAPSHOT_VERSION } from '../constants'
import { modelJsonObjectSchema } from './project'

const FORBIDDEN_MEMBER_NAMES = new Set(['__proto__', 'constructor', 'prototype'])
const keySchema = z.string().trim().min(1).max(128).regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
const memberNameSchema = z.string().trim().min(1).max(128).refine(
  name => !FORBIDDEN_MEMBER_NAMES.has(name),
  'Object member name is not allowed',
)
const versionSchema = z.string().trim().min(1).max(80)
const pathSchema = z.array(memberNameSchema).min(1)

export const componentContractSchema: z.ZodType<ComponentContract> = z.object({
  key: keySchema,
  version: versionSchema,
  kind: z.enum(['field', 'layout']),
  props: z.array(z.object({
    key: memberNameSchema,
    path: pathSchema,
    valueKind: z.string().trim().min(1).optional(),
    required: z.boolean().optional(),
  }).strict()),
  events: z.array(z.object({ name: memberNameSchema }).strict()),
  bindings: z.array(z.object({
    name: memberNameSchema,
    valueProp: memberNameSchema,
    trigger: memberNameSchema,
  }).strict()),
  slots: z.array(z.object({
    name: memberNameSchema,
    accepts: z.array(z.enum(['field', 'layout'])).min(1).optional(),
    components: z.array(keySchema).min(1).optional(),
  }).strict()),
  allowedParents: z.array(z.object({
    component: keySchema,
    slot: memberNameSchema,
  }).strict()),
  defaults: modelJsonObjectSchema,
}).strict()

const registryContractComponentSnapshotSchema = z.object({
  key: keySchema,
  contractVersion: versionSchema,
  fingerprint: z.string().trim().min(1),
  contract: componentContractSchema,
}).strict()

export const registryContractSnapshotSchema = z.object({
  version: z.literal(REGISTRY_CONTRACT_SNAPSHOT_VERSION),
  adapter: keySchema,
  adapterVersion: versionSchema,
  fingerprint: z.string().trim().min(1),
  components: z.array(registryContractComponentSnapshotSchema),
}).strict()
