import { withInstall } from '../utils'
import DateRangePickerSource from './src/index.vue'

export type * from './src/types'

export const DateRangePicker = withInstall(DateRangePickerSource)

export default DateRangePicker
