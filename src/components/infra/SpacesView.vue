<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiQuery } from '../../api/hooks'
import { apiClient } from '../../api/client'
import type { PaginatedResponse, SpaceSummary } from '../../api/types'

const router = useRouter()
const pageSize = ref(20)
const cursorHistory = ref<string[]>([])
const currentCursor = ref('')

const { data, loading, error, refresh } = useApiQuery<PaginatedResponse<SpaceSummary>>('/infra/account/list', {
  params: { cursor: currentCursor.value, per_page: pageSize.value },
})

const spaces = computed(() => data.value?.data.list ?? [])
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

function formatDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

function goView(id: string) {
  router.push({ name: 'space-view', params: { id } })
}

function goNew() {
  router.push({ name: 'space-new' })
}

function isBuiltin(space: SpaceSummary): boolean {
  return space.spec?.builtin === true
}

// ---------------------------------------------------------------------------
// Credential modal
// ---------------------------------------------------------------------------
const showCredentialModal = ref(false)
const credSpaceId = ref('')
const credName = ref('')
const credSubAllow = ref('')
const credSubDeny = ref('')
const credPubAllow = ref('')
const credPubDeny = ref('')
const credLoading = ref(false)
const credResult = ref<string | null>(null)
const credError = ref<string | null>(null)

function openCredentialModal(spaceId: string) {
  credSpaceId.value = spaceId
  showCredentialModal.value = true
  credName.value = ''
  credSubAllow.value = ''
  credSubDeny.value = ''
  credPubAllow.value = ''
  credPubDeny.value = ''
  credResult.value = null
  credError.value = null
}

function closeCredentialModal() {
  showCredentialModal.value = false
}

function parseSubjectList(value: string): string[] {
  return value
    .split('\n')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
}

async function handleCreateCredential() {
  if (!credSpaceId.value) return
  credLoading.value = true
  credResult.value = null
  credError.value = null

  try {
    const body = {
      name: credName.value || 'global-user',
      sub: {
        allow: parseSubjectList(credSubAllow.value),
        deny: parseSubjectList(credSubDeny.value),
      },
      pub: {
        allow: parseSubjectList(credPubAllow.value),
        deny: parseSubjectList(credPubDeny.value),
      },
    }
    let accountIndex=credSpaceId.value
    if (accountIndex.split(":").length>1){
      const captureIdOnly=accountIndex.split(":")
      accountIndex = captureIdOnly[captureIdOnly.length-1]
    }
    const res = await apiClient.post<{data:any,error:any}>(`/infra/account/cred/${accountIndex}`, body)
    credResult.value = JSON.stringify(res.data.data, null, 2)
  } catch (err) {
    credError.value = err instanceof Error ? err.message : 'Failed to create credential'
  } finally {
    credLoading.value = false
  }
}
</script>

<template>
  <div class="spaces-list-view">
    <div class="list-header">
      <h2>Spaces</h2>
      <button class="new-space-btn" @click="goNew">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Space
      </button>
    </div>

    <div class="list-body">
      <div v-if="loading" class="state-message">Loading spaces…</div>
      <div v-else-if="error" class="state-message error">
        <span>Error loading spaces.</span>
        <button class="retry-btn" @click="refresh()">Retry</button>
      </div>
      <div v-else-if="spaces.length === 0" class="state-message">No spaces found.</div>

      <table v-else class="spaces-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Public Key</th>
            <th>Type</th>
            <th>Created</th>
            <th>Status</th>
            <th style="width: 120px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="space in spaces"
            :key="space.id || space.pub"
            class="space-row"
          >
            <td class="cell-id" :title="space.id || space.pub">{{ space.id || space.pub }}</td>
            <td class="cell-name">{{ space.name || 'Unnamed' }}</td>
            <td class="cell-pub" :title="space.pub">{{ space.pub }}</td>
            <td>
              <span class="type-badge" :class="isBuiltin(space) ? 'badge-builtin' : 'badge-custom'">
                {{ isBuiltin(space) ? 'Builtin' : 'Custom' }}
              </span>
            </td>
            <td>{{ formatDate(space.createdAt) }}</td>
            <td>
              <span class="status-badge" :class="space.status === 1 ? 'status-active' : 'status-inactive'">
                {{ space.status === 1 ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions-cell">
              <button
                class="action-btn view-btn"
                @click="goView(space.id || space.pub)"
                title="View / Edit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="action-btn cred-btn"
                @click="openCredentialModal(space.id || space.pub)"
                title="Create Credential"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

    <!-- Create Credential Modal -->
    <transition name="modal-fade">
      <div v-if="showCredentialModal" class="modal-overlay" @click.self="closeCredentialModal">
        <div class="modal-panel">
          <div class="modal-header">
            <span class="modal-title">Create Credential</span>
            <button class="modal-close" @click="closeCredentialModal">×</button>
          </div>
          <div class="modal-body">
            <div class="meta-field">
              <label>Credential Name</label>
              <input v-model="credName" placeholder="global-user" />
            </div>

            <!-- Subscribe Permissions -->
            <div class="perm-section">
              <div class="perm-title">Subscribe (sub)</div>
              <div class="meta-field">
                <label>Allow Subjects (one per line)</label>
                <textarea v-model="credSubAllow" rows="3" placeholder="inflow.cpu.{PLUGIN_ID}.>"></textarea>
              </div>
              <div class="meta-field">
                <label>Deny Subjects (one per line)</label>
                <textarea v-model="credSubDeny" rows="2" placeholder=""></textarea>
              </div>
            </div>

            <!-- Publish Permissions -->
            <div class="perm-section">
              <div class="perm-title">Publish (pub)</div>
              <div class="meta-field">
                <label>Allow Subjects (one per line)</label>
                <textarea v-model="credPubAllow" rows="2" placeholder=""></textarea>
              </div>
              <div class="meta-field">
                <label>Deny Subjects (one per line)</label>
                <textarea v-model="credPubDeny" rows="2" placeholder=""></textarea>
              </div>
            </div>

            <div v-if="credError" class="cred-error">{{ credError }}</div>
            <div v-if="credResult" class="cred-result">
              <div class="result-label">Result:</div>
              <pre>{{ credResult }}</pre>
            </div>
            <div class="modal-actions">
              <button class="action-btn cancel-btn" @click="closeCredentialModal">Close</button>
              <button class="save-btn" :disabled="credLoading" @click="handleCreateCredential">
                <span v-if="credLoading">Creating…</span>
                <span v-else>Create Credential</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.spaces-list-view {
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

.new-space-btn {
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

.new-space-btn:hover {
  background: #9332e0;
}

.new-space-btn:active {
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

.spaces-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.spaces-table th,
.spaces-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.spaces-table th {
  font-weight: 600;
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  position: sticky;
  top: 0;
}

.space-row {
  cursor: default;
  transition: background 0.15s;
}

.space-row:hover {
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

.cell-pub {
  color: var(--text, #6b6375);
  font-family: monospace;
  font-size: 12px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  display: flex;
  gap: 4px;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.badge-builtin {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.badge-custom {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
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

.action-btn {
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

.view-btn:hover {
  background: rgba(170, 59, 255, 0.1);
  color: var(--accent, #aa3bff);
}

.cred-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-panel {
  background: var(--bg, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 22px;
  line-height: 32px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.modal-close:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.modal-body {
  padding: 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}

.meta-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}

.meta-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.meta-field input,
.meta-field textarea {
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  transition: border-color 0.15s;
  font-family: inherit;
  resize: vertical;
}

.meta-field input:focus,
.meta-field textarea:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.perm-section {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  padding: 12px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.03));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.perm-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-h, #08060d);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cred-error {
  font-size: 13px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
}

.cred-result {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  padding: 12px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.03));
}

.result-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  margin-bottom: 8px;
}

.cred-result pre {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text, #6b6375);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.save-btn {
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

.save-btn:hover:not(:disabled) {
  background: #9332e0;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
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

.cancel-btn:hover {
  border-color: #dc3545;
  color: #dc3545;
}

/* ---- Transitions ---- */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.25s ease;
}

.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  transform: scale(0.96);
}
</style>
