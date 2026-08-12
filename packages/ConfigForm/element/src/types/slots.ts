import type {
  ConfigFormDefaultSlotContext,
  ConfigFormSlots,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'

export type ElementConfigFormDefaultSlotContext<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormDefaultSlotContext<TValues>

export type ElementConfigFormSlots<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormSlots<TValues>
