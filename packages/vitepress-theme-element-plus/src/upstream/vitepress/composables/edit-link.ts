import { useData } from 'vitepress'
import { computed } from 'vue'
import editLinkMessages from '../../../i18n/component/edit-link.json'
import { createGitHubUrl } from '../utils'
import { useLocale } from './locale'

export function useEditLink() {
  const { page, theme, frontmatter } = useData()
  const editLinkLocale = useLocale(editLinkMessages)

  const url = computed(() => {
    const {
      repo,
      docsDir = '',
      docsBranch = 'main',
      docsRepo = repo,
      editLinks,
    } = theme.value
    const showEditLink = frontmatter.value.editLink ?? editLinks
    const { relativePath } = page.value
    if (!showEditLink || !relativePath || !docsRepo)
      return null
    return createGitHubUrl(docsRepo, docsDir, docsBranch, relativePath, '', '')
  })
  const text = computed(() => editLinkLocale.value['edit-on-github'])

  return { url, text }
}
