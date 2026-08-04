export interface DocContributor {
  id: string
  displayName: string
  initials: string
  role: string
}

export const contributorProfiles: Record<string, DocContributor> = {
  wl: {
    id: 'wl',
    displayName: 'wl',
    initials: 'WL',
    role: '组件与文档维护者',
  },
}

// This snapshot is derived from the local Git history for each public component directory.
export const componentContributorIds: Record<string, readonly string[]> = {
  AntdConfigForm: ['wl'],
  ConfigTable: ['wl'],
  CopyText: ['wl'],
  DateRangePicker: ['wl'],
  ElementConfigForm: ['wl'],
  EnterNextContainer: ['wl'],
  HeadlessCopyText: ['wl'],
  HeadlessTable: ['wl'],
  PopoverTableSelect: ['wl'],
  RequestCascader: ['wl'],
  RequestSelectV2: ['wl'],
  RequestTreeSelect: ['wl'],
  RichTextEditor: ['wl'],
}
