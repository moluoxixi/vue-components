import type { AddonContext } from '../types'

export async function callDefaultFactory<TOptions, TResult>(
  ctx: AddonContext,
  owner: string,
  specifier: string,
  options?: TOptions,
): Promise<TResult> {
  const mod = await ctx.importRequired<{ default?: (options?: TOptions) => TResult }>(owner, specifier)
  if (typeof mod.default !== 'function')
    throw new TypeError(`[ViteConfig] ${owner} expected ${specifier} to expose a default plugin factory`)

  return mod.default(options)
}
