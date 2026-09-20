import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ContractResult, ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  ConfigBindingFileSetV1,
  GenerateConfigFormBindingsInput,
  GenerateConfigFormBindingsResult,
  GenerateVueSourceInput,
  GenerateVueSourceResult,
  RawSourceFileSetV1,
  SourceStyleTarget,
} from '../types'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
  hasOnlyCurrentCanonicalSurfaceKeys,
} from '@moluoxixi/config-form-compiler'
import { parseProjectCompilationSnapshot } from '@moluoxixi/config-form-model'
import { collectSourceDatasets } from './datasets'
import { emitBindingProject, emitRawProject } from './emitter'
import {
  resolveConfigFormBinding,
  resolveSourceComponents,
  validateResolverIdentity,
} from './resolution'
import { collectSourceResources } from './resources'
import { createSourceStyleBackend, isSourceStyleTarget } from './style-backend'
import { compileSourceValidationPlan } from './validation'

function inputFailure<T>(message: string, context?: Record<string, unknown>): ContractResult<T> {
  return {
    success: false,
    diagnostics: [{ code: 'source_input_invalid', message, ...(context ? { context } : {}) }],
  }
}

function validateCompilationContract(compilation: ProjectCompilation): ContractResult<true> {
  if (compilation.ir.version !== CANONICAL_PROJECT_IR_VERSION) {
    return inputFailure('Source generation requires the current Canonical Project IR version.', {
      actual: compilation.ir.version,
      expected: CANONICAL_PROJECT_IR_VERSION,
      path: ['compilation', 'ir', 'version'],
    })
  }
  const compilerVersions = [
    { path: ['compilation', 'key', 'compilerVersion'], value: compilation.key.compilerVersion },
    { path: ['compilation', 'ir', 'identity', 'compilerVersion'], value: compilation.ir.identity.compilerVersion },
  ]
  for (const { path, value } of compilerVersions) {
    if (value !== CONFIG_FORM_COMPILER_VERSION) {
      return inputFailure('Source generation requires the current ConfigForm compiler version.', {
        actual: value,
        expected: CONFIG_FORM_COMPILER_VERSION,
        path,
      })
    }
  }
  const snapshot = parseProjectCompilationSnapshot(compilation.snapshot)
  if (!snapshot.success) {
    return inputFailure('Source generation requires a current ProjectCompilation snapshot.', {
      reason: snapshot.diagnostics[0]?.code ?? 'PROJECT_SNAPSHOT_INVALID',
      path: snapshot.diagnostics[0]?.path ?? ['compilation', 'snapshot'],
    })
  }
  for (const [surfaceId, surface] of Object.entries(compilation.ir.surfacesById)) {
    if (!hasOnlyCurrentCanonicalSurfaceKeys(surface)) {
      return inputFailure('Source generation requires the current Canonical Surface contract.', {
        path: ['compilation', 'ir', 'surfacesById', surfaceId],
      })
    }
  }
  return { success: true, data: true, diagnostics: [] }
}

function validateInput(input: GenerateVueSourceInput): ContractResult<SourceStyleTarget> {
  if (!input || typeof input !== 'object')
    return inputFailure('Source generation input must be an object.')
  const styleTarget = input.styleTarget ?? 'css'
  if (!isSourceStyleTarget(styleTarget)) {
    return inputFailure('Source generation style target must be "css" or "tailwind-v4".', {
      actual: styleTarget,
      expected: ['css', 'tailwind-v4'],
      path: ['styleTarget'],
    })
  }
  const compilation = input.compilation
  if (
    !compilation
    || typeof compilation !== 'object'
    || !compilation.key
    || typeof compilation.key !== 'object'
    || !compilation.ir
    || typeof compilation.ir !== 'object'
    || !compilation.ir.identity
    || typeof compilation.ir.identity !== 'object'
    || !Array.isArray(compilation.ir.surfaceOrder)
    || !compilation.ir.surfacesById
    || typeof compilation.ir.surfacesById !== 'object'
    || !compilation.ir.resources
    || typeof compilation.ir.resources !== 'object'
  ) {
    return inputFailure('Source generation requires a complete ProjectCompilation.')
  }
  const contract = validateCompilationContract(compilation)
  if (!contract.success)
    return contract
  if (!input.componentResolver || typeof input.componentResolver.resolveComponent !== 'function')
    return inputFailure('Source generation requires a component resolver.')
  if (!input.resourceReader || typeof input.resourceReader.readEmbedded !== 'function')
    return inputFailure('Source generation requires an embedded Resource reader.')
  return { success: true, data: styleTarget, diagnostics: [] }
}

function generatorFailure<T>(diagnostics: ModelDiagnostic[]): ContractResult<T> {
  return { success: false, diagnostics }
}

export async function generateVueSource(input: GenerateVueSourceInput): GenerateVueSourceResult {
  const valid = validateInput(input)
  if (!valid.success)
    return valid
  const style = createSourceStyleBackend({ target: valid.data })
  const identity = validateResolverIdentity(input.compilation, input.componentResolver)
  if (!identity.success)
    return generatorFailure(identity.diagnostics)
  const components = resolveSourceComponents(input.compilation, input.componentResolver)
  if (!components.success)
    return generatorFailure(components.diagnostics)
  const validation = compileSourceValidationPlan(input.compilation)
  if (!validation.success)
    return generatorFailure(validation.diagnostics)
  const datasets = collectSourceDatasets(input.compilation)
  if (!datasets.success)
    return generatorFailure(datasets.diagnostics)
  const resources = await collectSourceResources(input.compilation, input.resourceReader)
  if (!resources.success)
    return generatorFailure(resources.diagnostics)
  try {
    const data: RawSourceFileSetV1 = emitRawProject(
      input.compilation,
      components.data.byKey,
      components.data.dependencies,
      datasets.data,
      resources.data,
      validation.data,
      style,
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
  input: GenerateConfigFormBindingsInput,
): GenerateConfigFormBindingsResult {
  const valid = validateInput(input)
  if (!valid.success)
    return valid
  const style = createSourceStyleBackend({ target: valid.data })
  if (!input.bindingResolver || typeof input.bindingResolver.resolveConfigFormBinding !== 'function')
    return inputFailure('ConfigForm binding generation requires a binding resolver.')
  const identity = validateResolverIdentity(input.compilation, input.componentResolver)
  if (!identity.success)
    return generatorFailure(identity.diagnostics)
  const components = resolveSourceComponents(input.compilation, input.componentResolver)
  if (!components.success)
    return generatorFailure(components.diagnostics)
  const binding = resolveConfigFormBinding(input.bindingResolver)
  if (!binding.success)
    return generatorFailure(binding.diagnostics)
  const validation = compileSourceValidationPlan(input.compilation)
  if (!validation.success)
    return generatorFailure(validation.diagnostics)
  const datasets = collectSourceDatasets(input.compilation)
  if (!datasets.success)
    return generatorFailure(datasets.diagnostics)
  const resources = await collectSourceResources(input.compilation, input.resourceReader)
  if (!resources.success)
    return generatorFailure(resources.diagnostics)
  try {
    const data: ConfigBindingFileSetV1 = emitBindingProject(
      input.compilation,
      components.data.byKey,
      binding.data,
      datasets.data,
      resources.data,
      validation.data,
      style,
    )
    return { success: true, data, diagnostics: [] }
  }
  catch (error) {
    return inputFailure('ConfigForm binding source could not be assembled.', {
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}
