// @vitest-environment node
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMetaChecker, extractContract, extractContracts, extractContractWithChecker } from '../src/core/extraction'

/**
 * Extractor 端到端测试（vue-component-meta 引擎）。
 *
 * vue-component-meta 需要被分析的 SFC 落在 tsconfig program 内（临时目录里无法解析 vue 类型），
 * 故测试输入为包内固定 fixtures（__tests__/fixtures/**），用 tsconfig.fixtures.json 建 program。
 * 不 mock checker，验证真实类型解析、类型展开、动态插槽/转发/attrs/exposed 后处理与体积边界。
 */

const FIXTURES_TSCONFIG = resolve(__dirname, '../tsconfig.fixtures.json')
const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const COMPONENTS_TSCONFIG = resolve(WORKSPACE_ROOT, 'packages/components/tsconfig.app.json')
const CONFIG_FORM_ANTD_TSCONFIG = resolve(WORKSPACE_ROOT, 'packages/ConfigForm/antd/tsconfig.app.json')
const fx = (rel: string): string => resolve(__dirname, 'fixtures', rel)
const component = (rel: string): string => resolve(WORKSPACE_ROOT, 'packages/components/src', rel)
const antdConfigForm = (rel: string): string => resolve(WORKSPACE_ROOT, 'packages/ConfigForm/antd/src', rel)
let fixtureChecker: ReturnType<typeof createMetaChecker> | undefined

function extractFixtureContract(
  relativePath: string,
  exportName: string,
  packageName = '@test/pkg',
  workspaceRoot?: string,
) {
  fixtureChecker ??= createMetaChecker(FIXTURES_TSCONFIG)
  return extractContractWithChecker(
    fx(relativePath),
    packageName,
    fixtureChecker,
    exportName,
    workspaceRoot,
  )
}

describe('extractContract — vue-component-meta 引擎', () => {
  it('解析 defineProps 导入接口的真实类型并展开可达类型（含传递闭包）', async () => {
    const c = await extractContract(
      fx('TableSelect/src/index.vue'),
      '@test/pkg',
      'TableSelect',
      FIXTURES_TSCONFIG,
    )
    expect(c.name).toBe('TableSelect')
    const columns = c.props.find(p => p.name === 'columns')
    expect(columns).toBeTruthy()
    // 关键：类型不再是 unknown，保留元素类型
    expect(columns!.type).toContain('TableColumn')
    expect(columns!.typeRefs).toContain('TableColumn')
    // 传递闭包：columns→TableColumn→TableRow 全部纳入
    const defNames = c.typeDefs.map(t => t.name)
    expect(defNames).toContain('TableColumn')
    expect(defNames).toContain('TableRow')
    // 字段说明从 JSDoc 解析
    const col = c.typeDefs.find(t => t.name === 'TableColumn')
    const field = col!.fields.find(f => f.name === 'field')
    expect(field).toBeTruthy()
  }, 15_000)

  it('defineProps 内联 Omit 别名由 checker 直接解析字段（无需手写工具类型模拟）', async () => {
    const c = await extractFixtureContract('TableSelect/src/index.vue', 'TableSelect')
    // props.ts 的 TableSelectProps 含 placeholder（可选），columns（必填）
    const placeholder = c.props.find(p => p.name === 'placeholder')
    expect(placeholder).toBeTruthy()
    expect(placeholder!.required).toBe(false)
  })

  it('props 引用非对象 type alias 时仍纳入 typeDefs.raw，避免知识库只剩类型名', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    const virtualRef = c.props.find(p => p.name === 'virtualRef')
    expect(virtualRef).toBeTruthy()
    expect(virtualRef!.typeRefs).toContain('VirtualRef')

    const def = c.typeDefs.find(t => t.name === 'VirtualRef')
    expect(def).toBeTruthy()
    expect(def!.kind).toBe('type')
    expect(def!.fields).toEqual([])
    expect(def!.raw).toContain('ComponentPublicInstance | ComponentInternalInstance | HTMLElement | null')
  })

  it('组件位于内层 src 时跟随相对 import 收集包级共享类型别名', async () => {
    const c = await extractFixtureContract('SharedRequestPackage/src/Component/src/index.vue', 'Component')
    const query = c.props.find(p => p.name === 'query')
    expect(query).toBeTruthy()
    expect(query!.typeRefs).toEqual(expect.arrayContaining(['RequestParamsRecord', 'RequestOptionRecord']))

    const paramsDef = c.typeDefs.find(t => t.name === 'RequestParamsRecord')
    expect(paramsDef).toMatchObject({ kind: 'type', fields: [] })
    expect(paramsDef!.raw).toContain('type RequestParamsRecord = Record<string, unknown>')

    const optionDef = c.typeDefs.find(t => t.name === 'RequestOptionRecord')
    expect(optionDef).toMatchObject({ kind: 'type', fields: [] })
    expect(optionDef!.raw).toContain('type RequestOptionRecord = Record<string, any>')
  })

  it('emits、slots、exposed 引用本地 type alias 时也纳入 typeDefs.raw', async () => {
    const macro = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    const pickEmit = macro.emits.find(e => e.name === 'pick')!
    expect(pickEmit.payloadType).toContain('PickPayload')
    // emit.typeRefs 与 prop 同口径填充，作为 typeDefs 闭包根
    expect(pickEmit.typeRefs).toContain('PickPayload')
    const getStatus = macro.exposed!.find(e => e.name === 'getStatus')!
    expect(getStatus.type).toContain('ExposedStatus')
    expect(getStatus.typeRefs).toContain('ExposedStatus')

    const slot = await extractFixtureContract('SlotComp/src/index.vue', 'SlotComp')
    const footerSlot = slot.slots.find(s => s.name === 'footer')!
    expect(footerSlot.scopeType).toContain('FooterSlotScope')
    expect(footerSlot.typeRefs).toContain('FooterSlotScope')

    const defs = [...macro.typeDefs, ...slot.typeDefs]
    expect(defs.find(t => t.name === 'PickPayload')!.raw).toContain('type PickPayload = ProbeItem | null')
    expect(defs.find(t => t.name === 'ProbeItem')!.raw).toContain('interface ProbeItem')
    expect(defs.find(t => t.name === 'ExposedStatus')!.raw).toContain('type ExposedStatus = \'idle\' | \'busy\'')
    expect(defs.find(t => t.name === 'FooterSlotScope')!.raw).toContain('interface FooterSlotScope')
  }, 15_000)

  it('printer 输出的中文默认值被解回真字符（不残留 \\uXXXX 转义）', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    const placeholder = c.props.find(p => p.name === 'placeholder')!
    expect(placeholder.defaultValue).toContain('请选择')
    expect(placeholder.defaultValue).not.toContain('\\u')
  })

  it('从 <Comp>Slots 契约派生动态插槽 [dynamic]，并保留 meta 具名插槽', async () => {
    const c = await extractFixtureContract('SlotComp/src/index.vue', 'SlotComp')
    const slotNames = c.slots.map(s => s.name)
    expect(slotNames).toContain('default')
    expect(slotNames).toContain('[dynamic]')
    const dynamicSlot = c.slots.find(s => s.name === '[dynamic]')!
    expect(dynamicSlot.scopeType).toBe('{ row: { id: string }, columnIndex: number }')
    expect(dynamicSlot.typeRefs).toEqual([])
    // 不出现 vue-docgen 旧引擎误判的伪插槽 name
    expect(slotNames).not.toContain('name')
  })

  it('合并 v-bind="$attrs" 定向转发的子组件 props 并打 forwardedFrom 角标', async () => {
    const c = await extractFixtureContract('ForwardComp/src/index.vue', 'ForwardComp')
    expect(c.name).toBe('ForwardComp')
    const names = c.props.map(p => p.name)
    expect(names).toContain('placeholder') // 父自身
    expect(names).toContain('columns') // 转发自 base
    const columns = c.props.find(p => p.name === 'columns')
    expect(columns!.forwardedFrom).toBeTruthy()
    // 父自身 prop 无 forwardedFrom
    const placeholder = c.props.find(p => p.name === 'placeholder')
    expect(placeholder!.forwardedFrom).toBeUndefined()
  })

  it('无 $attrs 透传时不合并子组件 props', async () => {
    const c = await extractFixtureContract('NoForward/src/index.vue', 'NoForward')
    const names = c.props.map(p => p.name)
    expect(names).toContain('visible')
    expect(names).not.toContain('secret')
  })

  it('父 import 多个子组件时只合并真正接收 $attrs 的那个', async () => {
    const c = await extractFixtureContract('MultiChild/src/index.vue', 'MultiChild')
    const names = c.props.map(p => p.name)
    expect(names).toContain('own')
    expect(names).toContain('forwarded')
    expect(names).not.toContain('leaked')
  })

  it('defineModel 体现为 props + update emits + models 派生', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    expect(c.props.some(p => p.name === 'open')).toBe(true)
    expect(c.emits.some(e => e.name === 'update:open')).toBe(true)
    expect(c.models.some(m => m.name === 'open')).toBe(true)
  })

  it('defineEmits 携带 payload 类型', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    const pick = c.emits.find(e => e.name === 'pick')
    expect(pick).toBeTruthy()
    expect(pick!.payloadType).toContain('PickPayload')
  })

  it('defineAttrs<T> 提取为独立 attrs 段（meta 不体现，靠后处理）', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    expect(c.attrs).toBeTruthy()
    const attrNames = c.attrs!.map(a => a.name)
    expect(attrNames).toContain('placeholder')
    expect(attrNames).toContain('maxlength')
  })

  it('defineExpose 成员体现为 exposed', async () => {
    const c = await extractFixtureContract('MacroProbe/src/index.vue', 'MacroProbe')
    expect(c.exposed).toBeTruthy()
    const exposedNames = c.exposed!.map(e => e.name)
    expect(exposedNames).toEqual(['items', 'focus', 'reset', 'getStatus'])
    expect(exposedNames).not.toContain('$slots')
    expect(exposedNames).not.toContain('placeholder')
  })

  it('无 defineExpose 时不产生伪 exposed 成员', async () => {
    const c = await extractFixtureContract('NoForward/src/index.vue', 'NoForward')
    expect(c.exposed).toBeUndefined()
  })

  it('契约序列化体积受控（schema.ignore 边界裁剪护栏，< 50KB）', async () => {
    const c = await extractFixtureContract('TableSelect/src/index.vue', 'TableSelect')
    const bytes = Buffer.byteLength(JSON.stringify(c))
    expect(bytes).toBeLessThan(50_000)
  })

  it('extractContracts 批量复用 checker 并保留各组件契约', async () => {
    const results = await extractContracts(
      [
        { filePath: fx('TableSelect/src/index.vue'), packageName: '@test/pkg', exportName: 'TableSelect' },
        { filePath: fx('SlotComp/src/index.vue'), packageName: '@test/pkg', exportName: 'SlotComp' },
      ],
      FIXTURES_TSCONFIG,
    )
    expect(results).toHaveLength(2)
    expect(results.map(c => c.name)).toEqual(expect.arrayContaining(['TableSelect', 'SlotComp']))
  })

  it('kebab-case 标签 <sub-comp> 归一为 PascalCase 并匹配 import 绑定，正确合并转发 props', async () => {
    const c = await extractFixtureContract('KebabForward/src/index.vue', 'KebabForward')
    const names = c.props.map(p => p.name)
    expect(names).toContain('placeholder') // 父自身
    expect(names).toContain('columns') // 转发自 kebab 标签对应的子组件
    const columns = c.props.find(p => p.name === 'columns')
    expect(columns!.forwardedFrom).toBeTruthy()
  })

  it('原生元素 <div v-bind="$attrs"> 不触发转发合并、不抛错（透传到 DOM，无子组件契约）', async () => {
    const c = await extractFixtureContract('NativeAttrs/src/index.vue', 'NativeAttrs')
    const names = c.props.map(p => p.name)
    expect(names).toContain('label')
    // 原生元素透传不引入任何 forwardedFrom 角标
    expect(c.props.every(p => !p.forwardedFrom)).toBe(true)
  })

  it('第三方组件 <ElDatePicker v-bind="$attrs"> 转发跳过合并、不抛错（meta 无法跨包解析其 props）', async () => {
    const c = await extractFixtureContract('ThirdPartyForward/src/index.vue', 'ThirdPartyForward')
    const names = c.props.map(p => p.name)
    expect(names).toContain('placeholder') // 父自身保留
    // 第三方裸模块/全局组件无法定位本地契约，转发跳过，不引入 forwardedFrom，也不抛错
    expect(c.props.every(p => !p.forwardedFrom)).toBe(true)
  })

  it('default import 第三方/别名组件 <SomeWidget v-bind="$attrs"> 跳过合并、不抛错（specifier 捕获但非相对 .vue）', async () => {
    const c = await extractFixtureContract('AliasForward/src/index.vue', 'AliasForward')
    const names = c.props.map(p => p.name)
    expect(names).toContain('title') // 父自身保留
    // specifier='some-widget-lib' 被捕获但不匹配相对 .vue，命中正则否定分支跳过，不抛错
    expect(c.props.every(p => !p.forwardedFrom)).toBe(true)
  })

  it('解析失败时抛出带上下文的错误', async () => {
    await expect(
      extractContract(fx('NotExist/src/index.vue'), '@test/pkg', 'NotExist', FIXTURES_TSCONFIG),
    ).rejects.toThrow()
  })

  it('解析 paths workspace 类型闭包，并处理共用泛型、循环、缺失模块和外部依赖边界', async () => {
    const c = await extractFixtureContract(
      'WorkspaceTypeGraph/packages/consumer/src/index.vue',
      'WorkspaceTypeGraph',
      '@fixture/consumer',
      WORKSPACE_ROOT,
    )

    expect(c.props.find(p => p.name === 'shared')?.typeRefs).toContain('SharedWorkspaceType')
    expect(c.emits.find(e => e.name === 'change')?.typeRefs).toContain('SharedWorkspaceType')
    expect(c.slots.find(s => s.name === 'default')?.typeRefs).toContain('SharedWorkspaceType')
    expect(c.exposed?.find(e => e.name === 'inspect')?.typeRefs).toEqual(
      expect.arrayContaining(['SharedWorkspaceType', 'CycleA']),
    )

    const defNames = c.typeDefs.map(def => def.name)
    expect(defNames).toEqual(expect.arrayContaining([
      'CycleA',
      'CycleB',
      'SharedWorkspaceType',
      'WorkspaceEnvelope',
      'WorkspaceLeaf',
      'WorkspacePage',
    ]))
    for (const name of new Set(defNames))
      expect(defNames.filter(defName => defName === name)).toHaveLength(1)

    expect(defNames).not.toContain('ComponentPublicInstance')
    expect(defNames).not.toContain('MissingWorkspaceType')
    expect(c.props.find(p => p.name === 'missing')).toBeTruthy()
  })
})

describe('extractContracts — real workspace package types', () => {
  let contracts: Awaited<ReturnType<typeof extractContracts>>

  beforeAll(async () => {
    const antdContracts = await extractContracts(
      [
        {
          exportName: 'AntdConfigForm',
          filePath: antdConfigForm('services/components/AntdConfigForm/index.vue'),
          packageName: '@moluoxixi/config-form-antd-vue',
        },
      ],
      CONFIG_FORM_ANTD_TSCONFIG,
    )
    const componentContracts = await extractContracts(
      [
        {
          exportName: 'PopoverTableSelect',
          filePath: component('PopoverTableSelect/components/index.vue'),
          packageName: '@moluoxixi/components',
        },
      ],
      COMPONENTS_TSCONFIG,
    )
    contracts = [...antdContracts, ...componentContracts]
  })

  it('展开 ConfigForm 泛型 emit payload 的字段与依赖定义', () => {
    const contract = contracts.find(item => item.name === 'AntdConfigForm')!
    const fieldChange = contract.emits.find(item => item.name === 'fieldChange')!
    expect(fieldChange.typeRefs).toContain('ConfigFormFieldChangePayload')

    const payload = contract.typeDefs.find(item => item.name === 'ConfigFormFieldChangePayload')
    expect(payload?.raw).toContain('ConfigFormFieldChangePayload<TValues extends ConfigFormValues')
    expect(payload?.fields.map(field => field.name)).toEqual(['field', 'value', 'values'])
    expect(contract.typeDefs.map(item => item.name)).toEqual(
      expect.arrayContaining(['ConfigFormFieldKey', 'ConfigFormValues']),
    )
  })

  it('展开 hooks workspace 包的查询泛型闭包且不收集框架类型', () => {
    const contract = contracts.find(item => item.name === 'PopoverTableSelect')!
    expect(contract.typeDefs.map(item => item.name)).toEqual(expect.arrayContaining([
      'QueryKeyBase',
      'RequestTablePageParams',
      'RequestTableQuery',
      'RequestTableResult',
    ]))
    expect(contract.typeDefs.map(item => item.name)).not.toEqual(expect.arrayContaining([
      'ComponentPublicInstance',
      'PopoverProps',
      'Ref',
    ]))
  })
})

describe('extractContractWithChecker — 复用单一 checker', () => {
  it('同一 checker 连续提取多个组件', () => {
    const checker = fixtureChecker ??= createMetaChecker(FIXTURES_TSCONFIG)
    const a = extractContractWithChecker(fx('TableSelect/src/index.vue'), '@test/pkg', checker, 'TableSelect')
    const b = extractContractWithChecker(fx('MacroProbe/src/index.vue'), '@test/pkg', checker, 'MacroProbe')
    expect(a.name).toBe('TableSelect')
    expect(b.name).toBe('MacroProbe')
  })
})
