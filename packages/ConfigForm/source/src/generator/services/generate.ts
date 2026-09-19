import type { ContractResult, ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  ConfigBindingFileSetV1,
  GenerateConfigFormBindingsResult,
  GenerateSourceInput,
  GenerateVueSourceResult,
  RawSourceFileSetV1,
} from '../types'
import { emitBindingProject, emitRawProject } from './emitter'
import {
  resolveConfigFormBinding,
  resolveSourceComponents,
  validateResolverIdentity,
} from './resolution'
import { collectSourceResources } from './resources'
import { compileSourceValidationPlan } from './validation'

function inputFailure<T>(message: string, context?: Record<string, unknown>): ContractResult<T> {
  return {
    success: false,
    diagnostics: [{ code: 'source_input_invalid', message, ...(context ? { context } : {}) }],
  }
}

function validateInput(input: GenerateSourceInput): ContractResult<true> {
  if (!input || typeof input !== 'object')
    return inputFailure('Source generation input must be an object.')
  const compilation = input.compilation
  if (
    !compilation
    || typeof compilation !== 'object'
    || !compilation.key
    || !compilation.ir
    || !Array.isArray(compilation.ir.surfaceOrder)
    || !compilation.ir.surfacesById
    || typeof compilation.ir.surfacesById !== 'object'
    || !compilation.ir.resources
    || typeof compilation.ir.resources !== 'object'
  ) {
    return inputFailure('Source generation requires a complete ProjectCompilation.')
  }
  if (!input.providerResolver || typeof input.providerResolver.resolveComponent !== 'function')
    return inputFailure('Source generation requires a provider resolver.')
  if (typeof input.providerResolver.resolveConfigFormBinding !== 'function')
    return inputFailure('Source generation requires a ConfigForm binding resolver.')
  if (!input.resourceReader || typeof input.resourceReader.readEmbedded !== 'function')
    return inputFailure('Source generation requires an embedded Resource reader.')
  return { success: true, data: true, diagnostics: [] }
}

function generatorFailure<T>(diagnostics: ModelDiagnostic[]): ContractResult<T> {
  return { success: false, diagnostics }
}

export async function generateVueSource(input: GenerateSourceInput): GenerateVueSourceResult {
  const valid = validateInput(input)
  if (!valid.success)
    return valid
  const identity = validateResolverIdentity(input.compilation, input.providerResolver)
  if (!identity.success)
    return generatorFailure(identity.diagnostics)
  const components = resolveSourceComponents(input.compilation, input.providerResolver)
  if (!components.success)
    return generatorFailure(components.diagnostics)
  const validation = compileSourceValidationPlan(input.compilation)
  if (!validation.success)
    return generatorFailure(validation.diagnostics)
  const resources = await collectSourceResources(input.compilation, input.resourceReader)
  if (!resources.success)
    return generatorFailure(resources.diagnostics)
  try {
    const data: RawSourceFileSetV1 = emitRawProject(
      input.compilation,
      components.data.byKey,
      components.data.dependencies,
      resources.data,
      validation.data,
    )
    return { success: true, data, diagnostics: [] }
  }
  catch (error) {
    return inputFailure('Raw Vue source could not be assembled.', {
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function generateConfigFormBindings(
  input: GenerateSourceInput,
): GenerateConfigFormBindingsResult {
  const valid = validateInput(input)
  if (!valid.success)
    return valid
  const identity = validateResolverIdentity(input.compilation, input.providerResolver)
  if (!identity.success)
    return generatorFailure(identity.diagnostics)
  const components = resolveSourceComponents(input.compilation, input.providerResolver)
  if (!components.success)
    return generatorFailure(components.diagnostics)
  const binding = resolveConfigFormBinding(input.providerResolver)
  if (!binding.success)
    return generatorFailure(binding.diagnostics)
  const validation = compileSourceValidationPlan(input.compilation)
  if (!validation.success)
    return generatorFailure(validation.diagnostics)
  const resources = await collectSourceResources(input.compilation, input.resourceReader)
  if (!resources.success)
    return generatorFailure(resources.diagnostics)
  try {
    const data: ConfigBindingFileSetV1 = emitBindingProject(
      input.compilation,
      components.data.byKey,
      binding.data,
      resources.data,
      validation.data,
    )
    return { success: true, data, diagnostics: [] }
  }
  catch (error) {
    return inputFailure('ConfigForm binding source could not be assembled.', {
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}
