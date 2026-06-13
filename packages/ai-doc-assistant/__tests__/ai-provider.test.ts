// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ENV_KEYS, loadProviderConfig, providerStatusOf } from '../src/server/ai-provider'

describe('loadProviderConfig（环境变量边界校验）', () => {
  it('密钥齐全时返回完整配置', () => {
    const config = loadProviderConfig({
      [ENV_KEYS.chatApiKey]: 'sk-chat',
      [ENV_KEYS.embeddingApiKey]: 'sk-embed',
    })
    expect(config).toBeTruthy()
    expect(config!.chatApiKey).toBe('sk-chat')
    expect(config!.embeddingApiKey).toBe('sk-embed')
    // 非密钥项回落默认
    expect(config!.chatModel).toBe('gpt-4o-mini')
    expect(config!.embeddingModel).toBe('text-embedding-3-small')
  })

  it('自定义非密钥项覆盖默认', () => {
    const config = loadProviderConfig({
      [ENV_KEYS.chatApiKey]: 'k1',
      [ENV_KEYS.embeddingApiKey]: 'k2',
      [ENV_KEYS.chatBaseUrl]: 'https://custom/v1',
      [ENV_KEYS.chatModel]: 'claude-x',
      [ENV_KEYS.embeddingModel]: 'embed-x',
    })
    expect(config!.chatBaseUrl).toBe('https://custom/v1')
    expect(config!.chatModel).toBe('claude-x')
    expect(config!.embeddingModel).toBe('embed-x')
  })

  it('缺 chat 密钥返回 null（不静默用空串伪装已配置）', () => {
    expect(loadProviderConfig({ [ENV_KEYS.embeddingApiKey]: 'k' })).toBeNull()
  })

  it('缺 embedding 密钥仍返回配置（embedding 走本地模型，非核心边界）', () => {
    // ADR-0007：embedding 由本地模型完成，无需 provider key；只有 chat key 是核心边界。
    const config = loadProviderConfig({ [ENV_KEYS.chatApiKey]: 'k' })
    expect(config).toBeTruthy()
    expect(config!.chatApiKey).toBe('k')
    expect(config!.embeddingApiKey).toBe('')
  })

  it('全空返回 null', () => {
    expect(loadProviderConfig({})).toBeNull()
  })
})

describe('providerStatusOf（健康态不暴露密钥值）', () => {
  it('null 配置 → 全 missing', () => {
    expect(providerStatusOf(null)).toEqual({ chat: 'missing', embedding: 'missing' })
  })

  it('完整配置 → 全 configured', () => {
    const status = providerStatusOf({
      chatBaseUrl: 'x',
      chatApiKey: 'sk-secret',
      chatModel: 'm',
      embeddingBaseUrl: 'x',
      embeddingApiKey: 'sk-secret2',
      embeddingModel: 'm',
    })
    expect(status).toEqual({ chat: 'configured', embedding: 'configured' })
    // 断言：状态对象绝不含密钥值
    expect(JSON.stringify(status)).not.toContain('sk-secret')
  })
})
