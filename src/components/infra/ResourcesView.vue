<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiQuery } from '../../api/hooks'
import { apiClient } from '../../api/client'
import type { PaginatedResponse, Portal, PortalUpdateRequest } from '../../api/types'

const router = useRouter()
const pageSize = ref(10)
const cursorHistory = ref<string[]>([])
const currentCursor = ref('')

const { data, loading, error, refresh } = useApiQuery<PaginatedResponse<Portal>>('/infra/inflow/portal', {
  params: { cursor: currentCursor.value, per_page: pageSize.value },
})

const portals = computed(() => data.value?.data.list ?? [])
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

function goView(id: string) {
  router.push({ name: 'portal-view', params: { id } })
}

function goNew() {
  showNewModal.value = true
  resetNewForm()
}

// New portal modal
const showNewModal = ref(false)
const newLoading = ref(false)
const newError = ref<string | null>(null)

const newTitle = ref('')
const newPath = ref('')
const newAccountId = ref('')
const newSubscribePrefix = ref('inflow.events')
const newJwtSecret = ref('')
const newTags = ref('default')
const newStatus = ref(1)

function resetNewForm() {
  newTitle.value = ''
  newPath.value = ''
  newAccountId.value = ''
  newSubscribePrefix.value = 'inflow.events'
  newJwtSecret.value = ''
  newTags.value = 'default'
  newStatus.value = 1
  newError.value = null
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
}

function validatePath(path: string): string | null {
  if (!path) return 'Path is required'
  if (/\s/.test(path)) return 'Path must not contain spaces'
  return null
}

async function handleCreatePortal() {
  const pathError = validatePath(newPath.value)
  if (pathError) {
    newError.value = pathError
    return
  }

  newLoading.value = true
  newError.value = null

  try {
    const body = {
      title: newTitle.value,
      path: newPath.value,
      accountId: newAccountId.value,
      subscribe_prefix: newSubscribePrefix.value,
      jwt_secret: newJwtSecret.value,
      config: null,
      tags: parseTags(newTags.value),
      status: Number(newStatus.value),
    }
    await apiClient.post('/infra/inflow/portal', body)
    showNewModal.value = false
    await refresh()
  } catch (err: any) {
    newError.value = err?.response?.data?.error || err?.message || 'Failed to create portal'
  } finally {
    newLoading.value = false
  }
}

function closeNewModal() {
  showNewModal.value = false
}

// Resource Installation
const showInstallModal = ref(false)
const installLoading = ref(false)
const installError = ref<string | null>(null)
const installCommand = ref('')

function getPortalIdLastPart(portalId: string): string {
  const parts = portalId.split(':')
  return parts[parts.length - 1]
}

async function openInstallModal(portal: Portal) {
  const portalIdLastPart = getPortalIdLastPart(portal.id)
  showInstallModal.value = true
  installLoading.value = true
  installError.value = null
  installCommand.value = ''

  try {
    const res = await apiClient.get<{ data: string }>(`/infra/inflow/oneline/${portalIdLastPart}`)
    const url = res.data?.data ?? ''
    if (url) {
      installCommand.value = `curl -fsSL ${url} | bash`
    } else {
      installError.value = 'No installation URL returned from server'
    }
  } catch (err: any) {
    installError.value = err?.response?.data?.error || err?.message || 'Failed to fetch installation URL'
  } finally {
    installLoading.value = false
  }
}

function closeInstallModal() {
  showInstallModal.value = false
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

// Delete
const deletingId = ref<string | null>(null)

async function handleDelete(id: string) {
  if (!window.confirm('Are you sure you want to delete this portal?')) return
  deletingId.value = id
  try {
    await apiClient.delete(`/infra/inflow/portal/${id}`)
    await refresh()
  } catch {
    // silently handled
  } finally {
    deletingId.value = null
  }
}

// Edit portal modal
const showEditModal = ref(false)
const editLoading = ref(false)
const editError = ref<string | null>(null)
const editingPortalId = ref('')

const editTitle = ref('')
const editPath = ref('')
const editAccountId = ref('')
const editSubscribePrefix = ref('')
const editJwtSecret = ref('')
const editStatus = ref(1)
const editTags = ref<string[]>([])
const editConfig = ref<{ key: string; value: string }[]>([])
const newTagInput = ref('')

function openEditModal(portal: Portal) {
  editingPortalId.value = portal.id
  editTitle.value = portal.title || ''
  editPath.value = portal.path || ''
  editAccountId.value = function(portalId :string):string{
    const captureOnlyId= portalId.split(":")
    return captureOnlyId[captureOnlyId.length-1]
  }(portal.account?.id) || ''
  editSubscribePrefix.value = portal.subscribe_prefix || ''
  editJwtSecret.value = portal.jwt_secret || ''
  editStatus.value = portal.status
  editTags.value = portal.tags ? [...portal.tags] : []
  const cfg = portal.config
  if (cfg && typeof cfg === 'object') {
    editConfig.value = Object.entries(cfg).map(([k, v]) => ({
      key: k,
      value: typeof v === 'string' ? v : JSON.stringify(v),
    }))
  } else {
    editConfig.value = []
  }
  editError.value = null
  newTagInput.value = ''
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

function addTag() {
  const t = newTagInput.value.trim()
  if (t && !editTags.value.includes(t)) {
    editTags.value.push(t)
  }
  newTagInput.value = ''
}

function removeTag(tag: string) {
  editTags.value = editTags.value.filter((x) => x !== tag)
}

function addConfigEntry() {
  editConfig.value.push({ key: '', value: '' })
}

function removeConfigEntry(idx: number) {
  editConfig.value.splice(idx, 1)
}

function buildConfigObject(): Record<string, unknown> | null {
  if (editConfig.value.length === 0) return null
  const result: Record<string, unknown> = {}
  for (const entry of editConfig.value) {
    if (entry.key.trim()) {
      result[entry.key.trim()] = entry.value
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

async function handleUpdatePortal() {
  editLoading.value = true
  editError.value = null

  try {
    const body: PortalUpdateRequest = {
      title: editTitle.value,
      accountId: editAccountId.value,
      subscribe_prefix: editSubscribePrefix.value,
      jwt_secret: editJwtSecret.value,
      status: Number(editStatus.value),
      tags: editTags.value,
      config: buildConfigObject(),
    }
    await apiClient.patch(`/infra/inflow/portal/${editingPortalId.value}`, body)
    showEditModal.value = false
    await refresh()
  } catch (err: any) {
    editError.value = err?.response?.data?.error || err?.message || 'Failed to update portal'
  } finally {
    editLoading.value = false
  }
}
</script>

<template>
  <div class="portal-list-view">
    <div class="list-header">
      <h2>Portals</h2>
      <button class="new-portal-btn" @click="goNew">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Portal
      </button>
    </div>

    <div class="list-body">
      <div v-if="loading" class="state-message">Loading portals…</div>
      <div v-else-if="error" class="state-message error">
        <span>Error loading portals.</span>
        <button class="retry-btn" @click="refresh()">Retry</button>
      </div>
      <div v-else-if="portals.length === 0" class="state-message">No portals found.</div>

      <table v-else class="portal-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Path</th>
            <th>Subscribe Prefix</th>
            <th>Account</th>
            <th>Tags</th>
            <th>Status</th>
            <th style="width: 80px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="portal in portals"
            :key="portal.id"
            class="portal-row"
          >
            <td class="cell-id" :title="portal.id">{{ portal.id }}</td>
            <td class="cell-title">{{ portal.title || '-' }}</td>
            <td class="cell-path">{{ portal.path || '-' }}</td>
            <td class="cell-prefix">{{ portal.subscribe_prefix || '-' }}</td>
            <td class="cell-account">{{ portal.account?.name || '-' }}</td>
            <td>
              <span v-for="tag in portal.tags" :key="tag" class="tag-badge">{{ tag }}</span>
            </td>
            <td>
              <span class="status-badge" :class="portal.status === 1 ? 'status-active' : 'status-inactive'">
                {{ portal.status === 1 ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions-cell">
              <button
                class="action-btn view-btn"
                @click="goView(portal.id)"
                title="View Resources"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button
                class="action-btn edit-btn"
                @click.stop="openEditModal(portal)"
                title="Edit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="action-btn install-btn"
                @click.stop="openInstallModal(portal)"
                title="Resource Installation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                class="action-btn delete-btn"
                :disabled="deletingId === portal.id"
                @click.stop="handleDelete(portal.id)"
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

    <!-- Edit Portal Modal -->
    <transition name="modal-fade">
      <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
        <div class="modal-panel">
          <div class="modal-header">
            <span class="modal-title">Edit Portal</span>
            <button class="modal-close" @click="closeEditModal">×</button>
          </div>
          <div class="modal-body">
            <div class="meta-field">
              <label>Title</label>
              <input v-model="editTitle" placeholder="Premium Portal" />
            </div>
            <div class="meta-row">
              <div class="meta-field">
                <label>Path (read-only)</label>
                <input v-model="editPath" readonly class="readonly-field" />
              </div>
              <div class="meta-field">
                <label>Account ID</label>
                <input v-model="editAccountId" placeholder="" />
              </div>
            </div>
            <div class="meta-row">
              <div class="meta-field">
                <label>Subscribe Prefix</label>
                <input v-model="editSubscribePrefix" placeholder="inflow.events" />
              </div>
              <div class="meta-field">
                <label>Status</label>
                <select v-model="editStatus">
                  <option :value="1">Active</option>
                  <option :value="0">Inactive</option>
                </select>
              </div>
            </div>
            <div class="meta-field">
              <label>JWT Secret</label>
              <input v-model="editJwtSecret" placeholder="" />
            </div>

            <!-- Tags Editor -->
            <div class="meta-field">
              <label>Tags</label>
              <div class="tags-editor">
                <div v-for="tag in editTags" :key="tag" class="tag-chip">
                  <span>{{ tag }}</span>
                  <button class="tag-remove" @click="removeTag(tag)" title="Remove tag">×</button>
                </div>
                <div class="tag-add-row">
                  <input
                    v-model="newTagInput"
                    placeholder="Add tag…"
                    @keydown.enter.prevent="addTag"
                  />
                  <button class="tag-add-btn" @click="addTag">+</button>
                </div>
              </div>
            </div>

            <!-- Config Editor -->
            <div class="meta-field">
              <label>Config</label>
              <div class="config-editor">
                <div v-for="(entry, idx) in editConfig" :key="idx" class="config-row">
                  <input v-model="entry.key" placeholder="Key" />
                  <input v-model="entry.value" placeholder="Value" />
                  <button class="config-remove" @click="removeConfigEntry(idx)" title="Remove">×</button>
                </div>
                <button class="config-add-btn" @click="addConfigEntry">
                  + Add Config Entry
                </button>
              </div>
            </div>

            <div v-if="editError" class="form-error">{{ editError }}</div>
            <div class="modal-actions">
              <button class="cancel-btn" @click="closeEditModal">Cancel</button>
              <button class="save-btn" :disabled="editLoading" @click="handleUpdatePortal">
                <span v-if="editLoading">Saving…</span>
                <span v-else>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- New Portal Modal -->
    <transition name="modal-fade">
      <div v-if="showNewModal" class="modal-overlay" @click.self="closeNewModal">
        <div class="modal-panel">
          <div class="modal-header">
            <span class="modal-title">New Portal</span>
            <button class="modal-close" @click="closeNewModal">×</button>
          </div>
          <div class="modal-body">
            <div class="meta-field">
              <label>Title</label>
              <input v-model="newTitle" placeholder="Premium Config" />
            </div>
            <div class="meta-row">
              <div class="meta-field">
                <label>Path</label>
                <input v-model="newPath" placeholder="prime" />
              </div>
              <div class="meta-field">
                <label>Account ID</label>
                <input v-model="newAccountId" placeholder="" />
              </div>
            </div>
            <div class="meta-row">
              <div class="meta-field">
                <label>Subscribe Prefix</label>
                <input v-model="newSubscribePrefix" placeholder="inflow.events" />
              </div>
              <div class="meta-field">
                <label>Status</label>
                <select v-model="newStatus">
                  <option :value="1">Active</option>
                  <option :value="0">Inactive</option>
                </select>
              </div>
            </div>
            <div class="meta-field">
              <label>JWT Secret</label>
              <input v-model="newJwtSecret" placeholder="" />
            </div>
            <div class="meta-field">
              <label>Tags (comma separated)</label>
              <input v-model="newTags" placeholder="default" />
            </div>
            <div v-if="newError" class="form-error">{{ newError }}</div>
            <div class="modal-actions">
              <button class="cancel-btn" @click="closeNewModal">Cancel</button>
              <button class="save-btn" :disabled="newLoading" @click="handleCreatePortal">
                <span v-if="newLoading">Creating…</span>
                <span v-else>Create Portal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Resource Installation Modal -->
    <transition name="modal-fade">
      <div v-if="showInstallModal" class="modal-overlay" @click.self="closeInstallModal">
        <div class="modal-panel">
          <div class="modal-header">
            <span class="modal-title">Resource Installation</span>
            <button class="modal-close" @click="closeInstallModal">×</button>
          </div>
          <div class="modal-body">
            <div v-if="installLoading" class="state-message">Loading installation URL…</div>
            <div v-else-if="installError" class="form-error">{{ installError }}</div>
            <template v-else>
              <div class="meta-field">
                <label>One-line install command</label>
                <div class="command-row">
                  <code class="command-box">{{ installCommand }}</code>
                  <button
                    class="copy-btn"
                    title="Copy to clipboard"
                    @click="copyToClipboard(installCommand)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            </template>
            <div class="modal-actions">
              <button class="cancel-btn" @click="closeInstallModal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.portal-list-view {
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

.new-portal-btn {
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

.new-portal-btn:hover {
  background: #9332e0;
}

.new-portal-btn:active {
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

.portal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.portal-table th,
.portal-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.portal-table th {
  font-weight: 600;
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  position: sticky;
  top: 0;
}

.portal-row {
  cursor: default;
  transition: background 0.15s;
}

.portal-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
}

.cell-id {
  color: var(--text, #6b6375);
  font-family: monospace;
  font-size: 12px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-title {
  font-weight: 500;
  color: var(--text-h, #08060d);
}

.cell-path,
.cell-prefix,
.cell-account {
  color: var(--text, #6b6375);
  font-size: 13px;
}

.actions-cell {
  display: flex;
  gap: 4px;
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

.edit-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.delete-btn:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.install-btn:hover {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.readonly-field {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05)) !important;
  color: var(--text-muted, #8f8a99) !important;
  cursor: not-allowed;
}

/* ---- Tags Editor ---- */
.tags-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(170, 59, 255, 0.1);
  color: var(--accent, #aa3bff);
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
  background: rgba(220, 53, 69, 0.15);
  color: #dc3545;
}

.tag-add-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tag-add-row input {
  padding: 4px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 12px;
  width: 120px;
  font-family: inherit;
}

.tag-add-row input:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.tag-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--accent, #aa3bff);
  border-radius: 4px;
  background: var(--accent, #aa3bff);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
  padding: 0;
}

.tag-add-btn:hover {
  background: #9332e0;
}

/* ---- Config Editor ---- */
.config-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.config-row input {
  padding: 6px 10px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 13px;
  font-family: inherit;
  flex: 1;
}

.config-row input:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.config-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #6b6375;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
}

.config-remove:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.config-add-btn {
  padding: 6px 12px;
  border: 1px dashed var(--border, #e5e4e7);
  border-radius: 6px;
  background: transparent;
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.config-add-btn:hover {
  border-style: solid;
  background: rgba(170, 59, 255, 0.05);
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
  max-width: 520px;
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
.meta-field select {
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  transition: border-color 0.15s;
  font-family: inherit;
}

.meta-field input:focus,
.meta-field select:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.meta-row {
  display: flex;
  gap: 12px;
}

.form-error {
  font-size: 13px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
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

/* ---- Command Display ---- */
.command-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.command-box {
  flex: 1;
  display: block;
  padding: 10px 12px;
  border-radius: 6px;
  background: #1e1e2e;
  color: #a6e3a1;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  word-break: break-all;
  line-height: 1.5;
}

.copy-btn {
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
  white-space: nowrap;
}

.copy-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
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
