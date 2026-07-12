<script setup lang="ts">
import { computed } from 'vue'
import type { RunningProcess } from '../../composables/useRunningProcesses'

const props = defineProps<{
  processes: RunningProcess[]
  stoppingPids: Set<string>
}>()

const emit = defineEmits<{
  (e: 'stop', pid: string): void
}>()

const hasProcesses = computed(() => props.processes.length > 0)

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatResource(res: Record<string, any>): string {
  if (!res || typeof res !== 'object') return '—'
  // Try to show a meaningful label
  const label = res.name ?? res.title ?? res.id ?? res.label ?? res.type ?? ''
  if (label) return String(label)
  const keys = Object.keys(res)
  if (keys.length === 0) return '—'
  return keys.slice(0, 2).join(', ')
}

function handleStop(pid: string) {
  emit('stop', pid)
}
</script>

<template>
  <transition name="panel-slide">
    <div v-if="hasProcesses" class="running-processes-panel">
      <div class="panel-header">
        <span class="panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Running Processes ({{ processes.length }})
        </span>
      </div>
      <div class="panel-body">
        <div
          v-for="proc in processes"
          :key="proc.pid"
          class="process-row"
        >
          <div class="process-info">
            <div class="process-meta">
              <span class="process-time" :title="new Date(proc.startTime).toLocaleString()">
                {{ formatTime(proc.startTime) }}
              </span>
              <span class="process-pid">PID: {{ proc.pid.slice(0, 8) }}…</span>
            </div>
            <div class="process-resource" :title="JSON.stringify(proc.selectedResource, null, 2)">
              {{ formatResource(proc.selectedResource) }}
            </div>
          </div>
          <button
            class="stop-btn"
            :class="{ running: stoppingPids.has(proc.pid) }"
            :disabled="stoppingPids.has(proc.pid)"
            title="Stop Process"
            @click="handleStop(proc.pid)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.running-processes-panel {
  position: absolute;
  bottom: 16px;
  left: 16px;
  min-width: 260px;
  max-width: 320px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  z-index: 50;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent, #aa3bff);
}

.panel-title svg {
  color: var(--accent, #aa3bff);
}

.panel-body {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.process-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg, #fff);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.process-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  border-color: var(--border, #e5e4e7);
}

.process-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.process-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text, #6b6375);
}

.process-time {
  font-weight: 600;
  color: var(--text-h, #08060d);
  white-space: nowrap;
}

.process-pid {
  font-family: monospace;
  font-size: 10px;
  opacity: 0.8;
}

.process-resource {
  font-size: 11px;
  color: var(--text, #6b6375);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #ef4444;
  border-radius: 5px;
  background: #ef4444;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.stop-btn:hover {
  background: #dc2626;
  border-color: #dc2626;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.stop-btn:disabled,
.stop-btn.running {
  opacity: 0.6;
  cursor: wait;
}

/* Slide transition */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
