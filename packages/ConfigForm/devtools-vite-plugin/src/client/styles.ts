import {
  BUBBLE_HIDE_OFFSET,
  BUBBLE_MARGIN,
  PANEL_MAX_HEIGHT,
  STYLE_ID,
} from './constants'

/**
 * 确保 devtools overlay 样式只注入一次。
 *
 * 已存在 STYLE_ID 时直接复用页面样式，避免热更新重复插入样式标签。
 */
export function ensureStyle() {
  if (document.getElementById(STYLE_ID))
    return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .cf-devtools-root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; font-family: ui-sans-serif, system-ui, sans-serif; }
    .cf-devtools-bubble { position: fixed; width: 42px; height: 42px; border: 0; border-radius: 50%; background: #111827; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.22); cursor: grab; pointer-events: auto; font-size: 16px; transition: transform .16s ease; user-select: none; }
    .cf-devtools-bubble:active { cursor: grabbing; }
    .cf-devtools-bubble.is-left-edge { transform: translateX(-${BUBBLE_HIDE_OFFSET}px); }
    .cf-devtools-bubble.is-right-edge { transform: translateX(${BUBBLE_HIDE_OFFSET}px); }
    .cf-devtools-bubble.is-left-edge:hover, .cf-devtools-bubble.is-right-edge:hover, .cf-devtools-bubble.is-dragging { transform: translateX(0); }
    .cf-devtools-panel { position: fixed; right: 16px; bottom: 68px; box-sizing: border-box; width: min(420px, calc(100vw - 32px)); max-height: min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${BUBBLE_MARGIN * 2}px)); display: none; flex-direction: column; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 16px 48px rgba(0,0,0,.22); pointer-events: auto; }
    .cf-devtools-panel.is-open { display: flex; }
    .cf-devtools-header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; background: #fff; cursor: move; font-weight: 600; user-select: none; }
    .cf-devtools-title { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cf-devtools-pick { width: 26px; height: 26px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #374151; cursor: crosshair; font-size: 14px; line-height: 1; }
    .cf-devtools-pick.is-active { border-color: #2563eb; background: #dbeafe; color: #1d4ed8; }
    .cf-devtools-body { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; overflow: hidden; padding: 8px; }
    .cf-devtools-empty { padding: 16px; color: #6b7280; font-size: 13px; }
    .cf-devtools-node { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; min-height: 30px; border: 0; border-radius: 6px; background: transparent; padding: 5px 6px; color: inherit; text-align: left; font: inherit; cursor: pointer; }
    .cf-devtools-node:hover { background: #f3f4f6; }
    .cf-devtools-node.is-selected { background: #eef2ff; box-shadow: inset 0 0 0 1px #c7d2fe; }
    .cf-devtools-node-main { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 6px; align-items: start; min-width: 0; }
    .cf-devtools-node-kind { color: #4b5563; font-size: 11px; font-weight: 700; line-height: 16px; text-align: center; }
    .cf-devtools-node-kind.is-component { color: #7c3aed; }
    .cf-devtools-node-kind.is-field { color: #047857; }
    .cf-devtools-node-kind.is-render { color: #b45309; }
    .cf-devtools-node-text { min-width: 0; }
    .cf-devtools-node-key { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cf-devtools-node-meta { color: #6b7280; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cf-devtools-layout { min-height: 0; flex: 1 1 auto; display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 8px; }
    .cf-devtools-layout.is-single { grid-template-columns: minmax(0, 1fr); }
    .cf-devtools-nav { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid #e5e7eb; padding-right: 8px; }
    .cf-devtools-nav-item { width: 100%; min-height: 42px; border: 1px solid transparent; border-radius: 6px; background: transparent; padding: 6px; color: inherit; cursor: pointer; text-align: left; font: inherit; }
    .cf-devtools-nav-item:hover { background: #f3f4f6; }
    .cf-devtools-nav-item.is-active { border-color: #c7d2fe; background: #eef2ff; color: #1e3a8a; }
    .cf-devtools-nav-item:disabled { opacity: .42; cursor: not-allowed; }
    .cf-devtools-nav-item.is-disabled:hover { background: transparent; }
    .cf-devtools-nav-title { display: block; overflow: hidden; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .cf-devtools-nav-meta { display: block; overflow: hidden; margin-top: 2px; color: #6b7280; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .cf-devtools-source-search-box { flex: 0 0 auto; padding: 0 0 8px; }
    .cf-devtools-source-search { box-sizing: border-box; width: 100%; height: 30px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #111827; padding: 0 8px; font: inherit; font-size: 12px; }
    .cf-devtools-source-search:disabled { opacity: .55; cursor: not-allowed; }
    .cf-devtools-source-results { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
    .cf-devtools-source-result { width: 100%; min-height: 28px; border: 1px solid transparent; border-radius: 6px; background: #fff; padding: 4px 6px; color: inherit; cursor: pointer; text-align: left; font: inherit; font-size: 12px; }
    .cf-devtools-source-result:hover, .cf-devtools-source-result.is-selected { border-color: #c7d2fe; background: #eef2ff; }
    .cf-devtools-source-empty { padding: 4px 6px; color: #6b7280; font-size: 12px; }
    .cf-devtools-tree { min-height: 0; overflow: auto; min-width: 0; }
    .cf-devtools-timings { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-variant-numeric: tabular-nums; font-size: 11px; line-height: 1.15; }
    .cf-devtools-timing { white-space: nowrap; }
    .cf-devtools-timing.is-render { color: #047857; }
    .cf-devtools-timing.is-sync { color: #2563eb; }
    .cf-devtools-open { width: 24px; height: 24px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; }
    .cf-devtools-open:disabled { opacity: .35; cursor: not-allowed; }
    .cf-devtools-highlight { position: fixed; display: none; box-sizing: border-box; border: 2px solid #38bdf8; background: rgba(56,189,248,.12); box-shadow: 0 0 0 9999px rgba(15,23,42,.08); pointer-events: none; border-radius: 4px; }
    .cf-devtools-error { flex: 0 0 auto; padding: 0 12px 10px; background: #fff; color: #b91c1c; font-size: 12px; }
  `
  document.head.append(style)
}
