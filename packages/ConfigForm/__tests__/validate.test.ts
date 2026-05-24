import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineField } from '../src/utils/field'
import { validateField, validateFieldRules, validateForm } from '../src/utils/validate'

describe('validate utils', () => {
  it('returns no errors for valid schema values', () => {
    expect(validateField('Ada', z.string().min(2))).toEqual([])
  })

  it('returns schema messages and falls back to issue paths when message is empty', () => {
    const schema = z.string().superRefine((_value, ctx) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '',
        path: ['profile', 'name'],
      })
    })

    expect(validateField('Ada', schema)).toEqual(['Validation failed: profile.name'])
  })

  it('runs async validator after schema success', async () => {
    await expect(
      validateFieldRules('Ada', z.string().min(1, '必填'), { name: 'Ada' }, async (value, values) => {
        return value === values.name ? ['自定义错误', ''] : undefined
      }),
    ).resolves.toEqual(['自定义错误'])
  })

  it('does not run custom validators when schema parsing fails', async () => {
    await expect(
      validateFieldRules(undefined, z.string().min(1, '必填'), { name: undefined }, () => {
        throw new Error('validator should not run')
      }),
    ).resolves.toEqual(['Required'])
  })

  it('passes parsed schema output to custom validators', async () => {
    await expect(
      validateFieldRules('42', z.coerce.number().min(1), { age: '42' }, (value) => {
        return value === 42 ? '已收到解析后的数字' : '未收到解析后的数字'
      }),
    ).resolves.toEqual(['已收到解析后的数字'])
  })

  it('runs explicit required checks before schema and custom validators', async () => {
    await expect(
      validateFieldRules('', z.string().min(2, '姓名至少 2 个字符'), { name: '' }, () => {
        throw new Error('validator should not run')
      }, true, '请输入姓名'),
    ).resolves.toEqual(['请输入姓名'])

    await expect(
      validateFieldRules([], undefined, { tags: [] }, undefined, values => Array.isArray(values.tags), '请选择标签'),
    ).resolves.toEqual(['请选择标签'])

    await expect(
      validateFieldRules(false, undefined, { agreed: false }, undefined, true),
    ).resolves.toEqual([])
  })

  it('validates forms by trigger and respects hidden or disabled submit opt-in', async () => {
    const fields = [
      defineField({ field: 'plain', component: 'input', defaultValue: 'skip' }),
      defineField({
        field: 'requiredOnly',
        component: 'input',
        required: true,
        requiredMessage: '请输入必填字段',
      }),
      defineField({
        field: 'name',
        component: 'input',
        schema: z.string().min(2, '姓名至少 2 个字符'),
        validateOn: 'blur',
      }),
      defineField({
        field: 'hiddenSkipped',
        component: 'input',
        visible: () => false,
        validator: () => '隐藏字段默认跳过',
      }),
      defineField({
        field: 'hiddenKept',
        component: 'input',
        visible: () => false,
        submitWhenHidden: true,
        validator: () => '隐藏字段参与提交校验',
      }),
      defineField({
        field: 'disabledSkipped',
        component: 'input',
        disabled: () => true,
        submitWhenDisabled: false,
        validator: () => '禁用字段默认跳过',
      }),
      defineField({
        field: 'disabledKept',
        component: 'input',
        disabled: () => true,
        submitWhenDisabled: true,
        validator: () => '禁用字段参与提交校验',
      }),
    ]

    const values = {
      disabledKept: '',
      disabledSkipped: '',
      hiddenKept: '',
      hiddenSkipped: '',
      name: '',
      plain: 'skip',
      requiredOnly: '',
    }

    await expect(validateForm(values, fields, 'change')).resolves.toEqual({})
    await expect(validateForm(values, fields, 'blur')).resolves.toEqual({
      name: ['姓名至少 2 个字符'],
    })
    await expect(validateForm(values, fields, 'submit')).resolves.toEqual({
      disabledKept: ['禁用字段参与提交校验'],
      hiddenKept: ['隐藏字段参与提交校验'],
      name: ['姓名至少 2 个字符'],
      requiredOnly: ['请输入必填字段'],
    })
  })
})
