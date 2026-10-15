import type { StudioPresetId } from '@moluoxixi/config-form-studio'
import type { PreviewSessionAcceptInput } from '../../session'

export interface RevisionPreviewCapture extends PreviewSessionAcceptInput { preset: StudioPresetId, name: string }
