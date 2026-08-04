export interface DocContributor {
  login: string
  name: string
  avatarUrl: string
  profileUrl: string
  repositoryContributions: number
}

export interface ComponentContributor {
  login: string
  contributions: number
}

// Public profile fields and contribution counts synced from the GitHub REST API.
export const contributorProfiles: Record<string, DocContributor> = {
  moluoxixi: {
    login: 'moluoxixi',
    name: 'moluoxixi',
    avatarUrl: 'https://avatars.githubusercontent.com/u/57121471?v=4',
    profileUrl: 'https://github.com/moluoxixi',
    repositoryContributions: 182,
  },
}

export const componentContributors: Record<string, readonly ComponentContributor[]> = {
  AntdConfigForm: [{ login: 'moluoxixi', contributions: 16 }],
  ConfigTable: [{ login: 'moluoxixi', contributions: 8 }],
  CopyText: [{ login: 'moluoxixi', contributions: 3 }],
  DateRangePicker: [{ login: 'moluoxixi', contributions: 8 }],
  ElementConfigForm: [{ login: 'moluoxixi', contributions: 16 }],
  EnterNextContainer: [{ login: 'moluoxixi', contributions: 8 }],
  HeadlessCopyText: [{ login: 'moluoxixi', contributions: 3 }],
  HeadlessTable: [{ login: 'moluoxixi', contributions: 4 }],
  PopoverTableSelect: [{ login: 'moluoxixi', contributions: 16 }],
  RequestCascader: [{ login: 'moluoxixi', contributions: 3 }],
  RequestSelectV2: [{ login: 'moluoxixi', contributions: 3 }],
  RequestTreeSelect: [{ login: 'moluoxixi', contributions: 3 }],
  RichTextEditor: [{ login: 'moluoxixi', contributions: 3 }],
}
