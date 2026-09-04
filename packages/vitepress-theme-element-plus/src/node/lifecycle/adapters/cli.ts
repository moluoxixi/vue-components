#!/usr/bin/env node

import process from 'node:process'
import {
  elementPlusDocsCliUsage,
  redactElementPlusDocsCliError,
  runElementPlusDocsCli,
} from '..'

async function main(): Promise<void> {
  if (process.argv.slice(2).some(argument => argument === '--help' || argument === '-h')) {
    console.log(elementPlusDocsCliUsage)
    return
  }
  try {
    await runElementPlusDocsCli(process.argv.slice(2))
  }
  catch (error) {
    const tokens = [process.env.GITHUB_TOKEN, process.env.GITLAB_TOKEN, process.env.GITEE_TOKEN, process.env.YUNXIAO_TOKEN]
    console.error(redactElementPlusDocsCliError(error, tokens))
    process.exitCode = error && typeof error === 'object' && 'exitCode' in error
      ? Number((error as { exitCode: unknown }).exitCode) || 1
      : 1
  }
}

void main()
