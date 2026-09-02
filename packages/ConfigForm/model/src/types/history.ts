import type { ApplyProjectTransactionOptions } from './transactions'

export interface CreateProjectHistoryOptions {
  editVersion?: number
  limit?: number
  mergeWindowMs?: number
}

export interface ApplyProjectHistoryOptions extends ApplyProjectTransactionOptions {
  nowMs?: () => number
}
