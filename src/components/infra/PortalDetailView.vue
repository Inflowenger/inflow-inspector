<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiQuery } from '../../api/hooks'
import type { PaginatedResponse, Resource, Portal } from '../../api/types'

const props = defineProps<{
  id: string
}>()

const router = useRouter()

const pageSize = ref(10)
const cursorHistory = ref<string[]>([])
const currentCursor = ref('')

// Fetch resources for this portal
const { data, loading, error, refresh } = useApiQuery<PaginatedResponse<Resource>>('infra/inflow/resource', {
  params: { per_page: pageSize.value, search: props.id, cursor: currentCursor.value },
})

const resources = computed(() => data.value?.data.list ?? [])
const nextCursor = computed(() => data.value?.data.next ?? '')

const hasPrevious = computed(() => cursorHistory.value.length > 0)
const hasNext = computed(() => nextCursor.value !== '')

async function goNext() {
  cursorHistory.value.push(currentCursor.value)
  currentCursor.value = nextCursor.value
  await refresh({ params: { per_page: pageSize.value, search: props.id, cursor: currentCursor.value } })
}

async function goPrevious() {
  const previousCursor = cursorHistory.value.pop()
  if (previousCursor !== undefined) {
    currentCursor.value = previousCursor
    await refresh({ params: { per_page: pageSize.value, search: props.id, cursor: currentCursor.value } })
  }
}

// Also try to get portal info from first resource if available
const portalInfo = computed<Portal | null>(() => {
  if (resources.value.length > 0 && resources.value[0].portal) {
    return resources.value[0].portal
  }
  return null
})

const portalTitle = computed(() => {
  return portalInfo.value?.title || props.id
})

function formatDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

function goBack() {
  router.push({ name: 'resources' })
}
</script>

<template>
  <div class="portal-detail-view">
    <!-- Header -->
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      <div class="header-title-block">
        <h2>{{ portalTitle }}</h2>
        <div class="header-id">Portal: {{ props.id }}</div>
      </div>
    </div>

    <!-- Portal Info Card -->
    <div v-if="portalInfo" class="portal-info-card">
      <div class="info-row">
        <div class="info-item">
          <span class="info-label">Path</span>
          <span class="info-value">{{ portalInfo.path || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Subscribe Prefix</span>
          <span class="info-value">{{ portalInfo.subscribe_prefix || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Account</span>
          <span class="info-value">{{ portalInfo.account?.name || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value">
            <span class="status-badge" :class="portalInfo.status === 1 ? 'status-active' : 'status-inactive'">
              {{ portalInfo.status === 1 ? 'Active' : 'Inactive' }}
            </span>
          </span>
        </div>
      </div>
      <div class="info-row">
        <div class="info-item">
          <span class="info-label">Tags</span>
          <span class="info-value">
            <span v-for="tag in portalInfo.tags" :key="tag" class="tag-badge">{{ tag }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Resources Table -->
    <div class="list-header">
      <h3>Registered Resources</h3>
    </div>

    <div class="list-body">
      <div v-if="loading" class="state-message">Loading resources…</div>
      <div v-else-if="error" class="state-message error">
        <span>Error loading resources.</span>
        <button class="retry-btn" @click="refresh()">Retry</button>
      </div>
      <div v-else-if="resources.length === 0" class="state-message">No resources registered through this portal.</div>

      <table v-else class="resource-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>URL</th>
            <th>Tags</th>
            <th>Created</th>
            <th>Last Login</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="res in resources"
            :key="res.id"
            class="resource-row"
          >
            <td class="cell-id" :title="res.id">{{ res.id }}</td>
            <td class="cell-name">{{ res.name || '-' }}</td>
            <td class="cell-url" :title="res.url">{{ res.url || '-' }}</td>
            <td>
              <span v-for="tag in res.tags" :key="tag" class="tag-badge">{{ tag }}</span>
            </td>
            <td>{{ formatDate(res.createdAt) }}</td>
            <td>{{ formatDate(res.last_login) }}</td>
            <td class="cell-count">{{ res.count ?? '-' }}</td>
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
.portal-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  gap: 16px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.detail-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.header-title-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
}

.header-id {
  font-size: 12px;
  color: var(--text-muted, #8f8a99);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.back-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.portal-info-card {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 10px;
  padding: 16px;
  background: var(--bg, #fff);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8f8a99);
}

.info-value {
  font-size: 13px;
  color: var(--text-h, #08060d);
  word-break: break-all;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h, #08060d);
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

.resource-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.resource-table th,
.resource-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.resource-table th {
  font-weight: 600;
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  position: sticky;
  top: 0;
}

.resource-row {
  cursor: default;
  transition: background 0.15s;
}

.resource-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
}

.cell-id {
  color: var(--text, #6b6375);
  font-family: monospace;
  font-size: 12px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-name {
  font-weight: 500;
  color: var(--text-h, #08060d);
}

.cell-url {
  color: var(--text, #6b6375);
  font-size: 12px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-count {
  font-weight: 600;
  color: var(--accent, #aa3bff);
  text-align: center;
}

.tag-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(170, 59, 255, 0.1);
  color: var(--accent, #aa3bff);
  margin-right: 4px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-inactive {
  background: rgba(108, 117, 125, 0.1);
  color: #6c757d;
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
