function diagnosticKey(diagnostic) {
  return JSON.stringify([
    diagnostic.rule,
    diagnostic.path,
    [...(diagnostic.owners ?? [])].sort(),
  ])
}

function debtKey(debt) {
  return JSON.stringify([
    debt.rule,
    debt.path,
    [...(debt.owners ?? [])].sort(),
  ])
}

function ownersMatch(diagnostic, exception) {
  if (!diagnostic.owners?.length)
    return true
  return JSON.stringify([...diagnostic.owners].sort())
    === JSON.stringify([...exception.owners].sort())
}

function matchesComponentException(diagnostic, exception) {
  return exception.component === diagnostic.path
    && exception.rules.includes(diagnostic.rule)
    && ownersMatch(diagnostic, exception)
}

function isExcepted(diagnostic, manifest) {
  const pathException = manifest.pathExceptions.some(exception => (
    diagnostic.path === exception.path || diagnostic.path.startsWith(`${exception.path}/`)
  ))
  if (pathException)
    return true
  const packageException = manifest.packageExceptions.some(exception => (
    exception.package === diagnostic.package && exception.rules.includes(diagnostic.rule)
  ))
  if (packageException)
    return true
  return diagnostic.rule.startsWith('component.')
    && manifest.componentExceptions.some(exception => matchesComponentException(diagnostic, exception))
}

export function reconcilePackageArchitectureDiagnostics(diagnostics, manifest) {
  const usedPathExceptions = new Set()
  const usedPackageExceptions = new Set()
  const usedComponentExceptions = new Set()
  for (const diagnostic of diagnostics) {
    manifest.pathExceptions.forEach((exception, index) => {
      if (diagnostic.path === exception.path || diagnostic.path.startsWith(`${exception.path}/`))
        usedPathExceptions.add(index)
    })
    manifest.packageExceptions.forEach((exception, index) => {
      if (exception.package === diagnostic.package && exception.rules.includes(diagnostic.rule))
        usedPackageExceptions.add(`${index}:${diagnostic.rule}`)
    })
    manifest.componentExceptions.forEach((exception, index) => {
      if (diagnostic.rule.startsWith('component.') && matchesComponentException(diagnostic, exception))
        usedComponentExceptions.add(`${index}:${diagnostic.rule}`)
    })
  }
  const active = diagnostics.filter(diagnostic => !isExcepted(diagnostic, manifest))
  const diagnosticsByKey = new Map(active.map(diagnostic => [diagnosticKey(diagnostic), diagnostic]))
  const debtEntries = manifest.debt.map(debt => [debtKey(debt), debt])
  const debtByKey = new Map(debtEntries)
  if (debtByKey.size !== debtEntries.length)
    throw new Error('Package architecture manifest debt entries must be unique by rule, path, and owners.')
  return {
    active,
    staleExceptions: [
      ...manifest.pathExceptions.flatMap((exception, index) => (
        usedPathExceptions.has(index)
          ? []
          : [{ path: exception.path, reason: exception.reason, rule: 'path.exception' }]
      )),
      ...manifest.packageExceptions.flatMap((exception, index) => exception.rules
        .filter(rule => !usedPackageExceptions.has(`${index}:${rule}`))
        .map(rule => ({
          path: exception.package,
          reason: exception.reason,
          rule,
        }))),
      ...manifest.componentExceptions.flatMap((exception, index) => exception.rules
        .filter(rule => !usedComponentExceptions.has(`${index}:${rule}`))
        .map(rule => ({
          owners: exception.owners,
          path: exception.component,
          reason: exception.reason,
          rule,
        }))),
    ],
    staleDebt: [...debtByKey.entries()]
      .filter(([key]) => !diagnosticsByKey.has(key))
      .map(([, debt]) => debt),
    unknown: [...diagnosticsByKey.entries()]
      .filter(([key]) => !debtByKey.has(key))
      .map(([, diagnostic]) => diagnostic),
  }
}
