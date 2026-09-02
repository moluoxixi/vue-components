export type ProjectPageAction
  = | { type: 'page.rename', pageId: string, name: string }
    | { type: 'page.route', pageId: string, route: string }
    | { type: 'page.home', pageId: string }
    | { type: 'page.move', pageId: string, index: number }
    | { type: 'page.duplicate', pageId: string }
    | { type: 'page.remove', pageId: string }
