export type * from '../../navigation'

export interface WorkbenchRouterOptions {
  /**
   * Hash history base. Defaults to `location.pathname`, which keeps deep links
   * working for every published entry (`index.html`, `designer.html`) without a
   * server rewrite.
   */
  readonly base?: string
}
