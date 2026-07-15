<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import type { FlowLogMessage, LogLevel } from '../../composables/useSocketIO'

const props = defineProps<{
  modelValue: boolean
  messages: FlowLogMessage[]
  connected: boolean
  connecting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'clear'): void
  (e: 'reconnect'): void
}>()

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const drawerHeight = ref(280)
const isResizing = ref(false)
const logContainer = ref<HTMLElement | null>(null)
const filterLevel = ref<LogLevel | 'all'>('all')
const searchQuery = ref('')

function startResize(event: MouseEvent) {
  isResizing.value = true
  const startY = event.clientY
  const startHeight = drawerHeight.value

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value) return
    const delta = startY - e.clientY
    drawerHeight.value = Math.max(120, Math.min(600, startHeight + delta))
  }

  function onResizeUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeUp)
  }

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeUp)
}

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }
)

/**
 * Raw mode renders every line as the JSON the engine actually published.
 *
 * This is an inspector: the readable view is the default because it's what you
 * scan, but the unedited event has to stay one click away — a pretty summary
 * you can't check against the wire is worse than useless when you're debugging
 * the engine itself.
 */
const viewMode = ref<'pretty' | 'raw'>('pretty')
const filterKind = ref<string>('all')
const expanded = ref<Set<string>>(new Set())
const copiedId = ref<string | null>(null)

/** Kinds actually present, so the filter only ever offers real options. */
const availableKinds = computed(() => {
  const kinds = new Set<string>()
  for (const m of props.messages) if (m.kind) kinds.add(m.kind)
  return [...kinds].sort()
})

const filteredMessages = computed(() => {
  let result = props.messages

  if (filterLevel.value !== 'all') {
    result = result.filter((m) => m.level === filterLevel.value)
  }

  if (filterKind.value !== 'all') {
    result = result.filter((m) => m.kind === filterKind.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (m) =>
        m.message.toLowerCase().includes(q) ||
        m.kind?.toLowerCase().includes(q) ||
        m.src?.toLowerCase().includes(q) ||
        m.nodeTitle?.toLowerCase().includes(q) ||
        m.nodeId?.toLowerCase().includes(q) ||
        m.flow?.toLowerCase().includes(q),
    )
  }

  return result
})

const levelCounts = computed(() => {
  const counts: Record<string, number> = { all: props.messages.length, info: 0, warn: 0, error: 0, debug: 0, success: 0 }
  for (const m of props.messages) {
    counts[m.level] = (counts[m.level] ?? 0) + 1
  }
  return counts
})

const errorCount = computed(() => props.messages.filter((m) => m.level === 'error').length)

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function levelIcon(level: LogLevel): string {
  switch (level) {
    case 'info': return 'ℹ'
    case 'warn': return '⚠'
    case 'error': return '✕'
    case 'debug': return '◆'
    case 'success': return '✓'
    default: return '•'
  }
}

function levelClass(level: LogLevel): string {
  return `level-${level}`
}

/** Short label for the kind badge — the `node.`/`proc.` prefix is just noise. */
function kindLabel(kind?: string): string {
  if (!kind) return ''
  return kind.replace(/^(node|proc|edge|flow)\./, '')
}

/** Group kinds by what they mean, so the badge colour carries information. */
function kindClass(kind?: string): string {
  if (!kind) return 'kind-other'
  if (kind === 'proc.start' || kind === 'proc.finish') return 'kind-proc'
  if (kind === 'edge.select' || kind === 'flow.jump') return 'kind-route'
  if (kind.startsWith('node.')) return 'kind-node'
  if (kind === 'log') return 'kind-log'
  return 'kind-other'
}

function nodeLabel(msg: FlowLogMessage): string {
  if (!msg.nodeId) return ''
  return msg.nodeTitle ? `${msg.nodeTitle} · ${msg.nodeId}` : msg.nodeId
}

function rawJson(msg: FlowLogMessage): string {
  return msg.event ? JSON.stringify(msg.event, null, 2) : JSON.stringify({ message: msg.message }, null, 2)
}

function isExpandable(msg: FlowLogMessage): boolean {
  return msg.event !== undefined
}

function toggleExpand(msg: FlowLogMessage) {
  if (!isExpandable(msg)) return
  const next = new Set(expanded.value)
  next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id)
  expanded.value = next
}

async function copyRow(msg: FlowLogMessage) {
  try {
    await navigator.clipboard.writeText(rawJson(msg))
    copiedId.value = msg.id
    setTimeout(() => {
      if (copiedId.value === msg.id) copiedId.value = null
    }, 1200)
  } catch {
    /* clipboard unavailable — nothing useful to say */
  }
}

/** Export what's on screen, as JSONL — the shape the engine emits and tools read. */
async function copyAll() {
  const jsonl = filteredMessages.value
    .map((m) => (m.event ? JSON.stringify(m.event) : null))
    .filter(Boolean)
    .join('\n')
  try {
    await navigator.clipboard.writeText(jsonl)
    copiedId.value = '__all__'
    setTimeout(() => {
      if (copiedId.value === '__all__') copiedId.value = null
    }, 1200)
  } catch {
    /* clipboard unavailable */
  }
}
</script>

<template>
  <transition name="log-drawer-fade">
    <div v-if="showDrawer" class="log-drawer-wrapper" :style="{ height: drawerHeight + 'px' }">
      <!-- Resize handle -->
      <div class="log-resize-bar" @mousedown.stop="startResize" title="Drag to resize"></div>

      <!-- Header -->
      <div class="log-header">
        <div class="log-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span>Flow Logs</span>
          <span
            class="connection-badge"
            :class="{ connected: connected, connecting: connecting, disconnected: !connected && !connecting }"
          >
            {{ connected ? 'Live' : connecting ? 'Connecting…' : 'Offline' }}
          </span>
          <span v-if="errorCount > 0" class="error-badge" :title="`${errorCount} error events`">
            {{ errorCount }} error{{ errorCount === 1 ? '' : 's' }}
          </span>
        </div>

        <div class="log-header-actions">
          <!-- Level: severity only -->
          <select v-model="filterLevel" class="log-filter" title="Filter by severity">
            <option value="all">All levels ({{ levelCounts.all }})</option>
            <option value="info">Info ({{ levelCounts.info }})</option>
            <option value="warn">Warn ({{ levelCounts.warn }})</option>
            <option value="error">Error ({{ levelCounts.error }})</option>
            <option value="debug">Debug ({{ levelCounts.debug }})</option>
          </select>

          <!-- Kind: what happened. Orthogonal to level, so filter separately. -->
          <select
            v-if="availableKinds.length > 0"
            v-model="filterKind"
            class="log-filter"
            title="Filter by event kind"
          >
            <option value="all">All kinds</option>
            <option v-for="k in availableKinds" :key="k" :value="k">{{ k }}</option>
          </select>

          <!-- Search -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search…"
            class="log-search"
          />

          <!-- Pretty / raw -->
          <div class="view-toggle" role="group" aria-label="View mode">
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'pretty' }"
              title="Readable summaries"
              @click="viewMode = 'pretty'"
            >
              Pretty
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'raw' }"
              title="Raw JSON exactly as published"
              @click="viewMode = 'raw'"
            >
              JSON
            </button>
          </div>

          <!-- Copy visible as JSONL -->
          <button class="log-action-btn" title="Copy visible events as JSONL" @click="copyAll">
            <svg v-if="copiedId !== '__all__'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>

          <!-- Reconnect -->
          <button
            v-if="!connected && !connecting"
            class="log-action-btn"
            title="Reconnect"
            @click="$emit('reconnect')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
          </button>

          <!-- Clear -->
          <button class="log-action-btn" title="Clear logs" @click="$emit('clear')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>

          <!-- Close -->
          <button class="log-close" @click="showDrawer = false" aria-label="Close logs">×</button>
        </div>
      </div>

      <!-- Log list -->
      <div ref="logContainer" class="log-body">
        <div v-if="filteredMessages.length === 0" class="log-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <p>No logs yet</p>
          <span v-if="!connected">Socket is not connected. Start a flow to see logs.</span>
        </div>

        <!-- Raw: the events exactly as the engine published them. -->
        <template v-if="viewMode === 'raw'">
          <div
            v-for="msg in filteredMessages"
            :key="msg.id"
            class="log-raw-item"
            :class="levelClass(msg.level)"
          >
            <button class="row-copy" title="Copy this event" @click.stop="copyRow(msg)">
              {{ copiedId === msg.id ? '✓' : '⧉' }}
            </button>
            <pre>{{ rawJson(msg) }}</pre>
          </div>
        </template>

        <!-- Pretty: one scannable line per event. -->
        <template v-else>
          <div
            v-for="msg in filteredMessages"
            :key="msg.id"
            class="log-item"
            :class="[levelClass(msg.level), { expandable: isExpandable(msg), expanded: expanded.has(msg.id) }]"
            @click="toggleExpand(msg)"
          >
            <div class="log-item-main">
              <span class="log-chevron">{{ isExpandable(msg) ? (expanded.has(msg.id) ? '▾' : '▸') : '' }}</span>
              <span class="log-time">{{ formatTime(msg.timestamp) }}</span>
              <span class="log-seq" :title="`seq ${msg.seq} — the engine's ordering key`">
                {{ msg.seq !== undefined ? `#${msg.seq}` : '' }}
              </span>
              <span class="log-level-icon" :class="levelClass(msg.level)">{{ levelIcon(msg.level) }}</span>
              <span v-if="msg.kind" class="log-kind" :class="kindClass(msg.kind)">{{ kindLabel(msg.kind) }}</span>
              <span v-if="msg.src && msg.src !== 'rt'" class="log-src" :title="`emitted by ${msg.src}`">{{ msg.src }}</span>
              <span v-if="msg.nodeId" class="log-node" :title="`${msg.flow} / ${msg.nodeId}`">{{ nodeLabel(msg) }}</span>
              <span class="log-message">{{ msg.message }}</span>
              <button
                v-if="isExpandable(msg)"
                class="row-copy"
                title="Copy this event as JSON"
                @click.stop="copyRow(msg)"
              >
                {{ copiedId === msg.id ? '✓' : '⧉' }}
              </button>
            </div>
            <div v-if="expanded.has(msg.id)" class="log-item-data">
              <pre>{{ rawJson(msg) }}</pre>
            </div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.log-drawer-wrapper {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg, #fff);
  border-top: 1px solid var(--border, #e5e4e7);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

/* Resize bar at top of drawer */
.log-resize-bar {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 101;
  background: transparent;
}

.log-resize-bar:hover,
.log-resize-bar:active {
  background: var(--accent, #aa3bff);
  opacity: 0.25;
}

/* Header */
.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
  flex-shrink: 0;
  gap: 12px;
}

.log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-h, #08060d);
  white-space: nowrap;
}

.log-title svg {
  color: var(--accent, #aa3bff);
  flex-shrink: 0;
}

.connection-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.connection-badge.connected {
  background: #dcfce7;
  color: #16a34a;
}

.connection-badge.connecting {
  background: #fef3c7;
  color: #d97706;
}

.connection-badge.disconnected {
  background: #fee2e2;
  color: #dc2626;
}

.log-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-filter {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  cursor: pointer;
}

.log-filter:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.log-search {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  width: 140px;
}

.log-search:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.log-search::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.6;
}

.log-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: all 0.15s;
}

.log-action-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

.log-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.log-close:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

/* Body */
.log-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--text, #6b6375);
  opacity: 0.7;
}

.log-empty p {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.log-empty span {
  font-size: 11px;
}

/* Log items */
.log-item {
  padding: 5px 14px;
  border-left: 3px solid transparent;
  transition: background 0.1s;
}

.log-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

.log-item.expandable {
  cursor: pointer;
}

.log-item-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.log-time {
  color: var(--text, #6b6375);
  font-size: 11px;
  opacity: 0.7;
  white-space: nowrap;
}

.log-level-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}

.log-stage {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  white-space: nowrap;
}

.log-node {
  font-size: 11px;
  font-weight: 500;
  color: var(--text, #6b6375);
  white-space: nowrap;
}

.log-message {
  color: var(--text-h, #08060d);
  word-break: break-word;
}

.log-item-data {
  margin-top: 6px;
  margin-left: 52px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e4e7);
  overflow-x: auto;
}

.log-item-data pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-h, #08060d);
}

/* Level colors */
.level-info {
  border-left-color: #3b82f6;
}
.level-info .log-level-icon {
  background: #dbeafe;
  color: #2563eb;
}

.level-warn {
  border-left-color: #f59e0b;
}
.level-warn .log-level-icon {
  background: #fef3c7;
  color: #d97706;
}

.level-error {
  border-left-color: #ef4444;
}
.level-error .log-level-icon {
  background: #fee2e2;
  color: #dc2626;
}

.level-debug {
  border-left-color: #8b5cf6;
}
.level-debug .log-level-icon {
  background: #ede9fe;
  color: #7c3aed;
}

.level-success {
  border-left-color: #22c55e;
}
.level-success .log-level-icon {
  background: #dcfce7;
  color: #16a34a;
}

/* Transitions */
.log-drawer-fade-enter-active,
.log-drawer-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.log-drawer-fade-enter-from,
.log-drawer-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (max-width: 640px) {
  .log-header {
    flex-wrap: wrap;
  }
  .log-search {
    width: 100px;
  }
}
</style>

<style scoped>
/* ---- structured log viewer ---- */

.error-badge {
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(231, 76, 60, 0.12);
  color: #e74c3c;
  font-size: 10px;
  font-weight: 600;
}

/* Pretty / JSON switch */
.view-toggle {
  display: inline-flex;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 5px;
  overflow: hidden;
}

.view-toggle-btn {
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--text-muted, #8a8590);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.view-toggle-btn:hover {
  color: var(--text-h, #08060d);
}

.view-toggle-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
}

/* Row affordances */
.log-chevron {
  flex: 0 0 10px;
  color: var(--text-muted, #b9b5bf);
  font-size: 9px;
  user-select: none;
}

.log-seq {
  flex: 0 0 auto;
  min-width: 30px;
  color: var(--text-muted, #b9b5bf);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

/* Kind badge — colour carries the category, so scanning works without reading */
.log-kind {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.kind-proc {
  background: rgba(170, 59, 255, 0.14);
  color: #8a2bd6;
}

.kind-node {
  background: rgba(52, 152, 219, 0.14);
  color: #2478b5;
}

.kind-route {
  background: rgba(46, 204, 113, 0.16);
  color: #1e8449;
}

.kind-log {
  background: rgba(140, 140, 150, 0.14);
  color: #6b6375;
}

.kind-other {
  background: rgba(241, 196, 15, 0.18);
  color: #9a7d0a;
}

.log-src {
  flex: 0 0 auto;
  color: var(--accent, #aa3bff);
  font-size: 10px;
  white-space: nowrap;
}

.row-copy {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--text-muted, #b9b5bf);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s;
}

.log-item:hover .row-copy,
.log-raw-item:hover .row-copy {
  opacity: 1;
}

.row-copy:hover {
  color: var(--accent, #aa3bff);
}

.log-item.expanded {
  background: var(--bg-soft, rgba(0, 0, 0, 0.02));
}

/* Raw JSON mode */
.log-raw-item {
  position: relative;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-soft, rgba(0, 0, 0, 0.04));
}

.log-raw-item pre {
  margin: 0;
  overflow-x: auto;
  color: var(--text, #4b4553);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-raw-item.level-error pre {
  color: #c0392b;
}

.log-raw-item .row-copy {
  position: absolute;
  top: 4px;
  right: 6px;
  margin: 0;
}
</style>
