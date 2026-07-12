<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiQuery } from '../../api/hooks'
import { apiClient } from '../../api/client'
import type { PaginatedResponse } from '../../api/types'

export interface ContextSummary {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

const router = useRouter()
const pageSize = ref(10)
const cursorHistory = ref<string[]>([])
const currentCursor = ref('')

const { data, loading, error, refresh } = useApiQuery<PaginatedResponse<ContextSummary>>('/context', {
  params: { cursor: currentCursor.value, per_page: pageSize.value },
})

const contexts = computed(() => data.value?.data.list ?? [])
const nextCursor = computed(() => data.value?.data.next ?? '')

const hasPrevious = computed(() => cursorHistory.value.length > 0)
const hasNext = computed(() => nextCursor.value !== '')

async function goNext() {
  cursorHistory.value.push(currentCursor.value)
  currentCursor.value = nextCursor.value
  await refresh({ params: { cursor: currentCursor.value, per_page: pageSize.value } })
}

async function goPrevious() {
  const previousCursor = cursorHistory.value.pop()
  if (previousCursor !== undefined) {
    currentCursor.value = previousCursor
    await refresh({ params: { cursor: currentCursor.value, per_page: pageSize.value } })
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

function goNew() {
  router.push({ name: 'context-new' })
}

function goView(id: string) {
  router.push({ name: 'context-view', params: { id } })
}

const deletingId = ref<string | null>(null)

async function handleDelete(id: string) {
  if (!window.confirm('Are you sure you want to delete this context?')) return
  deletingId.value = id
  try {
    await apiClient.delete(`/context/id/${id}`)
    await refresh()
  } catch {
    // silently handled; could show toast in real app
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="context-list-view">
    <div class="list-header">
      <h2>Contexts</h2>
      <button class="new-context-btn" @click="goNew">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Context
      </button>
    </div>

    <div class="list-body">
      <div v-if="loading" class="state-message">Loading contexts…</div>
      <div v-else-if="error" class="state-message error">
        <span>Error loading contexts.</span>
        <button class="retry-btn" @click="refresh()">Retry</button>
      </div>
      <div v-else-if="contexts.length === 0" class="state-message">No contexts found.</div>

      <table v-else class="context-table">
        <thead>
          <tr>
            <th>Name</th>
            <!-- <th>Type</th> -->
            <th>Created</th>
            <th>Updated</th>
            <th style="width: 40px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ctx in contexts"
            :key="ctx.id"
            class="context-row"
            @click="goView(ctx.id)"
          >
            <td class="cell-name">{{ ctx.title || 'Unnamed' }}</td>
            <!-- <td><span class="type-badge">{{ ctx.type || '-' }}</span></td> -->
            <td>{{ formatDate(ctx.createdAt) }}</td>
            <td>{{ formatDate(ctx.updatedAt) }}</td>
            <td>
              <button
                class="delete-btn"
                :disabled="deletingId === ctx.id"
                @click.stop="handleDelete(ctx.id)"
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button
        class="page-btn"
        :disabled="!hasPrevious"
        @click="goPrevious"
      >
        ← Previous
      </button>
      <button
        class="page-btn"
        :disabled="!hasNext"
        @click="goNext"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<style scoped>
.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b6375;
  cursor: pointer;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.context-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  gap: 16px;
  overflow-y: auto;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.list-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.new-context-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #aa3bff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.new-context-btn:hover {
  background: #9332e0;
}

.new-context-btn:active {
  transform: scale(0.98);
}

.list-body {
  flex: 1;
  min-height: 0;
}

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text, #6b6375);
  gap: 8px;
  font-size: 14px;
}

.retry-btn {
  padding: 6px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s;
}

.retry-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.context-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.context-table th,
.context-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.context-table th {
  font-weight: 600;
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  position: sticky;
  top: 0;
}

.context-row {
  cursor: pointer;
  transition: background 0.15s;
}

.context-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
}

.cell-name {
  font-weight: 500;
  color: var(--text-h, #08060d);
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 500;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 8px;
  flex-shrink: 0;
}

.page-btn {
  padding: 6px 14px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
