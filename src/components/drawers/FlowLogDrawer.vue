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

const filteredMessages = computed(() => {
  let result = props.messages

  if (filterLevel.value !== 'all') {
    result = result.filter((m) => m.level === filterLevel.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((m) =>
      m.message.toLowerCase().includes(q) ||
      m.stage?.toLowerCase().includes(q) ||
      m.nodeTitle?.toLowerCase().includes(q)
    )
  }

  return result
})

const levelCounts = computed(() => {
  const counts: Record<LogLevel | 'all', number> = { all: props.messages.length, info: 0, warn: 0, error: 0, debug: 0, success: 0 }
  for (const m of props.messages) {
    counts[m.level] = (counts[m.level] ?? 0) + 1
  }
  return counts
})

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

function toggleExpand(msg: FlowLogMessage) {
  ;(msg as any)._expanded = !(msg as any)._expanded
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
        </div>

        <div class="log-header-actions">
          <!-- Filter -->
          <select v-model="filterLevel" class="log-filter" title="Filter by level">
            <option value="all">All ({{ levelCounts.all }})</option>
            <option value="info">Info ({{ levelCounts.info }})</option>
            <option value="success">Success ({{ levelCounts.success }})</option>
            <option value="warn">Warn ({{ levelCounts.warn }})</option>
            <option value="error">Error ({{ levelCounts.error }})</option>
            <option value="debug">Debug ({{ levelCounts.debug }})</option>
          </select>

          <!-- Search -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search…"
            class="log-search"
          />

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

        <div
          v-for="msg in filteredMessages"
          :key="msg.id"
          class="log-item"
          :class="[levelClass(msg.level), { expandable: msg.data !== undefined }]"
          @click="msg.data !== undefined && toggleExpand(msg)"
        >
          <div class="log-item-main">
            <span class="log-time">{{ formatTime(msg.timestamp) }}</span>
            <span class="log-level-icon" :class="levelClass(msg.level)">{{ levelIcon(msg.level) }}</span>
            <span v-if="msg.stage" class="log-stage">{{ msg.stage }}</span>
            <span v-if="msg.nodeTitle" class="log-node">{{ msg.nodeTitle }}</span>
            <span class="log-message">{{ msg.message }}</span>
          </div>
          <div v-if="msg.data && (msg as any)._expanded" class="log-item-data">
            <pre>{{ JSON.stringify(msg.data, null, 2) }}</pre>
          </div>
        </div>
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
