import type { ProjectDocument, ProjectOperation } from '../../../types'
import type { OperationResult } from '../types'
import { formSettingsSchema, modelJsonObjectSchema, projectPageSchema } from '../../../schemas'
import { invalid } from '../errors'
import { requireParsedValue } from '../validation'
import { changed, cloneModelValue, semanticallyEqual, unchanged } from './changes'
import { assertInsertIndex, requirePage } from './graph'

type ProjectPageOperation = Extract<ProjectOperation, { type:
  | 'page.add'
  | 'page.form'
  | 'page.move'
  | 'page.props'
  | 'page.remove'
  | 'page.rename'
  | 'page.route'
  | 'project.home'
  | 'project.settings' }>

export function applyProjectPageOperation(
  document: ProjectDocument,
  operation: ProjectPageOperation,
): OperationResult {
  switch (operation.type) {
    case 'page.add': {
      const parsedPage = projectPageSchema.safeParse(operation.page)
      if (!parsedPage.success) {
        invalid(
          'PROJECT_PAGE_INVALID',
          parsedPage.error.issues[0]?.message ?? 'Added page is invalid.',
          operation.page.id,
        )
      }
      const page = parsedPage.data
      if (Object.hasOwn(document.pagesById, page.id))
        invalid('PROJECT_PAGE_ID_DUPLICATE', `Page already exists: ${page.id}`, page.id)
      if (Object.values(document.pagesById).some(candidate => candidate.route === page.route))
        invalid('PROJECT_PAGE_ROUTE_DUPLICATE', `Page route already exists: ${page.route}`, page.id)
      const index = operation.index ?? document.pageOrder.length
      assertInsertIndex(index, document.pageOrder.length, 'PROJECT_PAGE_INDEX_INVALID')
      document.pagesById[page.id] = page
      document.pageOrder.splice(index, 0, page.id)
      return changed([{ type: 'page.remove', pageId: page.id }], [page.id], [], true)
    }
    case 'page.remove': {
      const page = requirePage(document, operation.pageId)
      if (document.pageOrder.length === 1)
        invalid('PROJECT_FINAL_PAGE_REMOVE', 'The final project page cannot be removed.', operation.pageId)
      const index = document.pageOrder.indexOf(operation.pageId)
      document.pageOrder.splice(index, 1)
      delete document.pagesById[operation.pageId]
      const inverse: ProjectOperation[] = [{ type: 'page.add', page: cloneModelValue(page), index }]
      if (document.homePageId === operation.pageId) {
        const previousHomePageId = document.homePageId
        document.homePageId = document.pageOrder[Math.min(index, document.pageOrder.length - 1)]!
        inverse.push({ type: 'project.home', pageId: previousHomePageId })
      }
      return changed(inverse, [operation.pageId], [], true)
    }
    case 'page.move': {
      requirePage(document, operation.pageId)
      const previousIndex = document.pageOrder.indexOf(operation.pageId)
      assertInsertIndex(operation.index, document.pageOrder.length - 1, 'PROJECT_PAGE_INDEX_INVALID')
      if (previousIndex === operation.index)
        return unchanged()
      document.pageOrder.splice(previousIndex, 1)
      document.pageOrder.splice(operation.index, 0, operation.pageId)
      return changed([{ type: 'page.move', pageId: operation.pageId, index: previousIndex }], [operation.pageId], [], true)
    }
    case 'page.rename': {
      const page = requirePage(document, operation.pageId)
      const name = operation.name.trim()
      if (!name)
        invalid('PROJECT_PAGE_NAME_INVALID', 'Page names cannot be empty.', operation.pageId)
      if (name.length > 160)
        invalid('PROJECT_PAGE_NAME_INVALID', 'Page names cannot exceed 160 characters.', operation.pageId)
      const previous = page.name
      if (previous === name)
        return unchanged()
      page.name = name
      return changed([{ type: 'page.rename', pageId: page.id, name: previous }], [page.id])
    }
    case 'page.route': {
      const page = requirePage(document, operation.pageId)
      if (!operation.route.startsWith('/') || operation.route.length > 300)
        invalid('PROJECT_PAGE_ROUTE_INVALID', 'Page routes must start with /.', operation.pageId)
      if (Object.values(document.pagesById).some(candidate => candidate.id !== page.id && candidate.route === operation.route))
        invalid('PROJECT_PAGE_ROUTE_DUPLICATE', `Page route already exists: ${operation.route}`, operation.pageId)
      const previous = page.route
      if (previous === operation.route)
        return unchanged()
      page.route = operation.route
      return changed([{ type: 'page.route', pageId: page.id, route: previous }], [page.id])
    }
    case 'project.home': {
      requirePage(document, operation.pageId)
      const previous = document.homePageId
      if (previous === operation.pageId)
        return unchanged()
      document.homePageId = operation.pageId
      return changed([{ type: 'project.home', pageId: previous }], [operation.pageId], [], true)
    }
    case 'project.settings': {
      const previous = cloneModelValue(document.settings)
      const settings = requireParsedValue(
        modelJsonObjectSchema.safeParse(operation.settings),
        'PROJECT_SETTINGS_INVALID',
        'Project settings are invalid.',
      )
      if (semanticallyEqual(previous, settings))
        return unchanged()
      document.settings = settings
      return changed([{ type: 'project.settings', settings: previous }], [], [], true)
    }
    case 'page.props': {
      const page = requirePage(document, operation.pageId)
      const previous = cloneModelValue(page.graph.props)
      const props = requireParsedValue(
        modelJsonObjectSchema.safeParse(operation.props),
        'PROJECT_PAGE_PROPS_INVALID',
        'Page properties are invalid.',
        page.id,
      )
      if (semanticallyEqual(previous, props))
        return unchanged()
      page.graph.props = props
      return changed([{ type: 'page.props', pageId: page.id, props: previous }], [page.id])
    }
    case 'page.form': {
      const page = requirePage(document, operation.pageId)
      const previous = cloneModelValue(page.graph.form)
      const form = requireParsedValue(
        formSettingsSchema.safeParse(operation.form),
        'PROJECT_PAGE_FORM_INVALID',
        'Page form settings are invalid.',
        page.id,
      )
      if (semanticallyEqual(previous, form))
        return unchanged()
      page.graph.form = form
      return changed([{ type: 'page.form', pageId: page.id, form: previous }], [page.id])
    }
  }
}
