import type { Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

/**
 * 创建一个禁用重试、关闭缓存垃圾回收延迟的测试用 QueryClient。
 *
 * 禁用 retry 让失败用例立即进入错误态，避免测试等待指数退避。
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

/**
 * 在挂载了 VueQueryPlugin 的组件上下文中运行一个 composable，
 * 返回其结果与包装组件实例，供断言与卸载使用。
 *
 * vue-query 的 useQuery/useMutation 必须在组件 setup 内调用，
 * 该工具用最小包装组件提供合法的运行上下文。
 *
 * @param composable 待测 composable，返回值会被透出
 * @param queryClient 可选的自定义 QueryClient
 */
export function withSetup<TResult>(
  composable: () => TResult,
  queryClient: QueryClient = createTestQueryClient(),
): { result: TResult, unmount: () => void } {
  let result!: TResult
  const Wrapper: Component = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })

  const wrapper = mount(Wrapper, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { result, unmount: () => wrapper.unmount() }
}

/**
 * 轮询等待断言成立或超时。
 *
 * 用于等待异步查询/变更状态翻转（如 isLoading -> false），
 * 比固定 sleep 更稳定。
 */
export async function waitFor(
  assertion: () => boolean,
  { timeout = 1000, interval = 10 }: { timeout?: number, interval?: number } = {},
): Promise<void> {
  const start = Date.now()
  while (!assertion()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: timed out before condition was met')
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}
