export function createConfigFormBem(namespace: () => string) {
  return {
    /** @example b('form') => 'cf-form' */
    b: (block: string): string => `${namespace()}-${block}`,
    /** @example e('form', 'label') => 'cf-form__label' */
    e: (block: string, element: string): string => `${namespace()}-${block}__${element}`,
    /** @example m('form', 'inline') => 'cf-form--inline' */
    m: (block: string, modifier: string): string => `${namespace()}-${block}--${modifier}`,
  }
}
