import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  normalizeConfigFormValidateOn,
  validateConfigFormFieldRules,
} from '../src/validation'

describe('config form validation', () => {
  it('always includes submit and preserves explicit interaction triggers', () => {
    expect(normalizeConfigFormValidateOn()).toEqual(['submit'])
    expect(normalizeConfigFormValidateOn(['blur', 'change'])).toEqual(['blur', 'change', 'submit'])
  })

  it('runs required, Zod and custom validation in order', async () => {
    const validatorValues: unknown[] = []
    const options = {
      required: true,
      requiredMessage: '请输入编号',
      schema: z.string().transform(value => Number(value)),
      validator: (value: unknown) => {
        validatorValues.push(value)
        return value === 42 ? undefined : '编号错误'
      },
    }

    await expect(validateConfigFormFieldRules('', {}, options)).resolves.toEqual(['请输入编号'])
    await expect(validateConfigFormFieldRules('nope', {}, options)).resolves.toEqual(['编号错误'])
    await expect(validateConfigFormFieldRules('42', {}, options)).resolves.toEqual([])
    expect(validatorValues).toEqual([Number.NaN, 42])
  })

  it('supports async Zod refinements', async () => {
    const schema = z.string().refine(async value => value === 'ok', '异步校验失败')

    await expect(validateConfigFormFieldRules('bad', {}, { schema })).resolves.toEqual(['异步校验失败'])
  })
})
