import type { AiDocUIMessage, ExampleBlock, SourceRef } from '../../../../../shared/protocol'
import type { ChatTurn } from '../types'
import { splitAnswerSegments } from '../../../../../core'

export function textOf(message: AiDocUIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

export function sourcesOf(message: AiDocUIMessage): SourceRef[] {
  const part = message.parts.find(item => item.type === 'data-sources')
  return part?.type === 'data-sources' ? part.data : []
}

export function exampleBlocksOf(message: AiDocUIMessage): ExampleBlock[] {
  const part = message.parts.find(item => item.type === 'data-example')
  return part?.type === 'data-example' ? part.data.blocks : []
}

function normalizeSource(source: string): string {
  return source.trim()
}

function blockForSource(turn: ChatTurn, source: string): ExampleBlock | undefined {
  const normalized = normalizeSource(source)
  return turn.exampleBlocks.find(block => normalizeSource(block.ts) === normalized)
}

export function jsForSource(turn: ChatTurn, source: string): string | undefined {
  return blockForSource(turn, source)?.js
}

export function renderableForSource(turn: ChatTurn, source: string, fallback: boolean): boolean {
  return blockForSource(turn, source)?.renderable ?? fallback
}

export function reasonForSource(turn: ChatTurn, source: string, fallback?: string): string | undefined {
  return blockForSource(turn, source)?.reason ?? fallback
}

export function segmentsFor(turn: ChatTurn): ReturnType<typeof splitAnswerSegments> {
  return splitAnswerSegments(turn.answer)
}

export function fallbackExampleBlocksFor(turn: ChatTurn): ExampleBlock[] {
  const inlineSources = new Set(
    segmentsFor(turn)
      .filter(segment => segment.kind === 'vue')
      .map(segment => normalizeSource(segment.source)),
  )
  return turn.exampleBlocks.filter(block => !inlineSources.has(normalizeSource(block.ts)))
}
