import { docsProject } from '../../.vitepress/catalog'

const repositoryUrl = 'https://github.com/moluoxixi/vue-components'
const headSha = 'a'.repeat(40)
const commitSha = 'b'.repeat(40)
const login = 'fixture-user'
const profile = {
  avatarUrl: 'https://avatars.githubusercontent.com/u/1',
  login,
  name: 'Fixture User',
  profileUrl: `https://github.com/${login}`,
}

export default {
  schemaVersion: 1,
  generatedAt: '2026-08-24T00:00:00.000Z',
  repository: {
    defaultBranch: 'main',
    headSha,
    name: 'vue-components',
    openIssueCount: 0,
    owner: 'moluoxixi',
  },
  profiles: { [login]: profile },
  components: Object.fromEntries(
    docsProject.components.flatMap(group => group.items).map(component => [
      component.name,
      {
        commits: [{
          author: profile,
          date: '2026-08-23T00:00:00.000Z',
          message: `docs: fixture ${component.name}`,
          sha: commitSha,
          shortSha: commitSha.slice(0, 7),
          url: `${repositoryUrl}/commit/${commitSha}`,
        }],
        contributors: [{ contributions: 1, login }],
        openIssueCount: 0,
        openIssues: [],
        path: component.repositorySourcePath,
      },
    ]),
  ),
}
