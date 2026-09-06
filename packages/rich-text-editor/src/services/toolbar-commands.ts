export interface RichTextToolbarCommand {
  canExecute: () => boolean
  execute: () => void
  isActive: () => boolean
}

export function createRichTextToolbarCommand(
  execute: () => void,
  options: Pick<RichTextToolbarCommand, 'canExecute' | 'isActive'> = {
    canExecute: () => true,
    isActive: () => false,
  },
): RichTextToolbarCommand {
  return { canExecute: options.canExecute, execute, isActive: options.isActive }
}
