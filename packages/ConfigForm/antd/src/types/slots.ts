import type {
  ConfigFormDefaultSlotContext,
  ConfigFormSlots,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'

export type AntdConfigFormDefaultSlotContext<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormDefaultSlotContext<TValues>

export type AntdConfigFormSlots<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormSlots<TValues>
