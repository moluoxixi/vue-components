import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { z } from 'zod'
import { useForm } from '@/composables/useForm'
import { createFormRuntime } from '@/runtime/createFormRuntime'
import { validateFieldRules } from '../validate'

describe('validateFieldRules async schemas', () => {
  it('awaits asynchronous Zod refinements', async () => {
    const schema = z.string().refine(async value => value === 'allowed', '异步校验失败')

    await expect(
      validateFieldRules('blocked', schema, { role: 'blocked' }),
    )
      .resolves
      .toEqual(['异步校验失败'])
    await expect(
      validateFieldRules('allowed', schema, { role: 'allowed' }),
    )
      .resolves
      .toEqual([])
  })

  it('passes asynchronous Zod transform output to the custom validator', async () => {
    const schema = z.string().transform(async value => value.trim())
    const validator = vi.fn((value: unknown) => value === 'Ada' ? undefined : '未转换')

    await expect(
      validateFieldRules('  Ada  ', schema, { name: '  Ada  ' }, validator),
    )
      .resolves
      .toEqual([])
    expect(validator).toHaveBeenCalledWith('Ada', { name: '  Ada  ' })
  })

  it('writes asynchronous Zod failures into form errors', async () => {
    const runtime = createFormRuntime()
    const form = useForm({
      defaultValues: { role: 'blocked' },
      fields: ref([runtime.transformField({
        component: 'input',
        field: 'role',
        schema: z.string().refine(async value => value === 'allowed', '异步校验失败'),
      })]),
    })

    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.value).toEqual({ role: ['异步校验失败'] })
  })

  it('propagates asynchronous Zod exceptions without writing field errors', async () => {
    const runtime = createFormRuntime()
    const form = useForm({
      defaultValues: { role: 'blocked' },
      fields: ref([runtime.transformField({
        component: 'input',
        field: 'role',
        schema: z.string().refine(async () => {
          throw new Error('schema unavailable')
        }),
      })]),
    })

    await expect(form.validate()).rejects.toThrow('schema unavailable')
    expect(form.errors.value).toEqual({})
  })
})
