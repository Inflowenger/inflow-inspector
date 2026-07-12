<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiQuery } from '../../api/hooks'
import { apiClient } from '../../api/client'
import type { PaginatedResponse } from '../../api/types'

export interface WorkflowSummary {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

const router = useRouter()

function selectWorkflow(workflow: WorkflowSummary) {
  router.push({ name: 'workflow-edit', params: { id: workflow.id } })
}

function createNewWorkflow() {
  router.push({ name: 'workflow-new' })
}

const pageSize = ref(5)
const cursorHistory = ref<string[]>([])
const currentCursor = ref("")

const { data, loading, error, refresh } = useApiQuery<PaginatedResponse<WorkflowSummary>>('/flow', {
  params: { cursor: currentCursor.value, per_page: pageSize.value },
})

const workflows = computed(() => data.value?.data.list ?? [])
const nextCursor = computed(() => data.value?.data.next ?? "")

const hasPrevious = computed(() => cursorHistory.value.length > 0)
const hasNext = computed(() => nextCursor.value !== "")

async function goNext() {
  // Save current cursor before moving forward
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

const deletingId = ref<string | null>(null)

async function handleDelete(id: string) {
  if (!window.confirm('Are you sure you want to delete this workflow?')) return
  deletingId.value = id
  try {
    await apiClient.delete(`/flow/id/${id}`)
    await refresh()
  } catch {
    // silently handled; could show toast in real app
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="workflow-list-view">
    <div class="list-header">
      <h2>Workflows</h2>
        <button class="new-workflow-btn" @click="createNewWorkflow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Workflow
      </button>
    </div>

    <div class="list-body">
      <div v-if="loading" class="state-message">Loading workflows…</div>
      <div v-else-if="error" class="state-message error">
        <span>Error loading workflows.</span>
        <button class="retry-btn" @click="refresh()">Retry</button>
      </div>
      <div v-else-if="workflows.length === 0" class="state-message">No workflows found.</div>

      <table v-else class="workflow-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Created</th>
            <th>Updated</th>
            <th style="width: 40px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="workflow in workflows"
            :key="workflow.id"
            class="workflow-row"
            @click="selectWorkflow(workflow)"
          >
            <td class="cell-title">{{ workflow.title || 'Untitled' }}</td>
            <td>{{ formatDate(workflow.createdAt) }}</td>
            <td>{{ formatDate(workflow.updatedAt) }}</td>
            <td>
              <button
                class="delete-btn"
                :disabled="deletingId === workflow.id"
                @click.stop="handleDelete(workflow.id)"
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
.workflow-list-view {
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

.new-workflow-btn {
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

.new-workflow-btn:hover {
  background: #9332e0;
}

.new-workflow-btn:active {
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

.workflow-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.workflow-table th,
.workflow-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.workflow-table th {
  font-weight: 600;
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  position: sticky;
  top: 0;
}

.workflow-row {
  cursor: pointer;
  transition: background 0.15s;
}

.workflow-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
}

.cell-title {
  font-weight: 500;
  color: var(--text-h, #08060d);
}

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

.page-info {
  font-size: 13px;
  color: var(--text, #6b6375);
  min-width: 110px;
  text-align: center;
}
</style>
