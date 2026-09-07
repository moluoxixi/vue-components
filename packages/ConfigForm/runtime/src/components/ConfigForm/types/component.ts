import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { PublicProps, VNode } from 'vue'
import type { ConfigFormRendererComponentProps } from '../../../renderer'
import type { FormRuntimeOptions } from '../../../runtime'

export interface ConfigFormComponent {
  <TValues extends ConfigFormValues = ConfigFormValues>(
    props: ConfigFormRendererComponentProps<TValues> & PublicProps & { runtime?: FormRuntimeOptions },
  ): VNode
}
