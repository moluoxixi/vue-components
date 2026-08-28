export interface Link {
  text: string
  link: string
  promotion?: string
  activeMatch?: string
}

export interface TocLinkItem {
  children?: TocLinkItem[]
  link: string
  text: string
}
