<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../../api/client'
import { useApiMutation } from '../../api/hooks'
import CodeEditor from '../common/CodeEditor.vue'
import JsonTreeTable from '../common/JsonTreeTable.vue'
import type { SpaceSummary, SpacePolicyImport, SpacePolicyExport } from '../../api/types'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isNew = computed(() => !props.id)
const spaceId = computed(() => props.id ?? '')

const loading = ref(false)
const error = ref<string | null>(null)

// Space data (for view mode)
const space = ref<SpaceSummary | null>(null)

// Edit / New form state
const editName = ref('')

// Policy arrays
const imports = ref<SpacePolicyImport[]>([])
const exports = ref<SpacePolicyExport[]>([])

// View toggle for raw data
const activeView = ref<'table' | 'json'>('table')

// Credential modal (create)
// const showCredentialModal = ref(false)
// const credName = ref('')
// const credSubAllow = ref('')
// const credSubDeny = ref('')
// const credPubAllow = ref('')
// const credPubDeny = ref('')
// const credLoading = ref(false)
// const credResult = ref<string | null>(null)
// const credError = ref<string | null>(null)

// Get Credential result
// const showGetCredModal = ref(false)
// const getCredLoading = ref(false)
// const getCredResult = ref<string | null>(null)
// const getCredError = ref<string | null>(null)

// Computed
const isBuiltin = computed(() => space.value?.spec?.builtin === true)

const hasPolicy = computed(() => imports.value.length > 0 || exports.value.length > 0)

function resetForm() {
  editName.value = ''
  imports.value = []
  exports.value = []
}

function loadFromSpace(s: SpaceSummary) {
  editName.value = s.name || ''
  imports.value = s.policy?.imports ? JSON.parse(JSON.stringify(s.policy.imports)) : []
  exports.value = s.policy?.exports ? JSON.parse(JSON.stringify(s.policy.exports)) : []
}

async function fetchSpace() {
  if (isNew.value) return
  loading.value = true
  error.value = null
  try {
        let accountIndex=spaceId.value
    if (accountIndex.split(":").length>1){
      const captureIdOnly=accountIndex.split(":")
      accountIndex = captureIdOnly[captureIdOnly.length-1]
    }
    const res = await apiClient.get<unknown>(`/infra/account/id/${accountIndex}`)
    const body = res.data as Record<string, any> | null
    if (body && body.data) {
      space.value = body.data as SpaceSummary
      loadFromSpace(space.value)
    }
  } catch (err: any) {
    error.value = err?.response?.data?.error || err?.message || 'Failed to load space'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!isNew.value) {
    fetchSpace()
  } else {
    resetForm()
  }
})

function goBack() {
  router.push({ name: 'spaces' })
}

// Import / Export helpers
function addImport() {
  imports.value.push({ account: '', name: '', subject: '', type: 'service' })
}

function removeImport(idx: number) {
  imports.value.splice(idx, 1)
}

function addExport() {
  exports.value.push({ name: '', subject: '', type: 'service' })
}

function removeExport(idx: number) {
  exports.value.splice(idx, 1)
}

const typeOptions = ['service', 'stream']

// Save
const { loading: saving } = useApiMutation<unknown>('POST', '/infra/account')

async function handleSave() {
  const body: Record<string, any> = {
    name: editName.value || 'Unnamed',
  }

  if (hasPolicy.value) {
    body.policy = {
      imports: imports.value,
      exports: exports.value,
    }
  }

  if (isNew.value) {
    await apiClient.post('/infra/account/new', body)
    router.push({ name: 'spaces' })
  } else {
    await apiClient.post(`/infra/account/${spaceId.value}`, body)
    await fetchSpace()
  }
}

// Credential create
// function openCredentialModal() {
//   showCredentialModal.value = true
//   credName.value = ''
//   credSubAllow.value = ''
//   credSubDeny.value = ''
//   credPubAllow.value = ''
//   credPubDeny.value = ''
//   credResult.value = null
//   credError.value = null
// }

// function closeCredentialModal() {
//   showCredentialModal.value = false
// }

// function parseSubjectList(value: string): string[] {
//   return value
//     .split('\n')
//     .map((s: string) => s.trim())
//     .filter((s: string) => s.length > 0)
// }

// async function handleCreateCredential() {
//   if (!spaceId.value) return
//   credLoading.value = true
//   credResult.value = null
//   credError.value = null

//   try {
//     const body = {
//       name: credName.value || 'global-user',
//       sub: {
//         allow: parseSubjectList(credSubAllow.value),
//         deny: parseSubjectList(credSubDeny.value),
//       },
//       pub: {
//         allow: parseSubjectList(credPubAllow.value),
//         deny: parseSubjectList(credPubDeny.value),
//       },
//     }
//     let accountIndex=spaceId.value
//     if (accountIndex.split(":").length>1){
//       const captureIdOnly=accountIndex.split(":")
//       console.log(captureIdOnly)
//       accountIndex = captureIdOnly[captureIdOnly.length-1]
//     }
//     const res = await apiClient.post<unknown>(`/infra/account/cred/${accountIndex}`, body)
//     credResult.value = JSON.stringify(res.data, null, 2)
//   } catch (err) {
//     credError.value = err instanceof Error ? err.message : 'Failed to create credential'
//   } finally {
//     credLoading.value = false
//   }
// }

// Get Credential
// function openGetCredModal() {
//   showGetCredModal.value = true
//   getCredResult.value = null
//   getCredError.value = null
// }

// function closeGetCredModal() {
//   showGetCredModal.value = false
// }

// async function handleGetCredential() {
//   if (!spaceId.value) return
//   getCredLoading.value = true
//   getCredResult.value = null
//   getCredError.value = null

//   try {
//     const res = await apiClient.get<unknown>(`/infra/account/cred/${spaceId.value}`)
//     getCredResult.value = JSON.stringify(res.data, null, 2)
//   } catch (err) {
//     getCredError.value = err instanceof Error ? err.message : 'Failed to get credential'
//   } finally {
//     getCredLoading.value = false
//   }
// }

const isBusy = computed(() => loading.value || saving.value)
</script>

<template>
  <div class="space-detail-view">
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
        <h2>{{ isNew ? 'New Space' : (space?.name || 'Space Detail') }}</h2>
        <div v-if="!isNew && space?.id" class="header-id">ID: {{ space.id }}</div>
        <div v-else-if="!isNew && spaceId" class="header-id">ID: {{ spaceId }}</div>
      </div>
      <button
        class="save-btn"
        :disabled="isBusy"
        @click="handleSave"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        {{ isNew ? 'Create' : 'Save' }}
      </button>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading && !isNew" class="state-message">Loading space…</div>
    <div v-else-if="error" class="state-message error">
      <span>{{ error }}</span>
      <button class="retry-btn" @click="fetchSpace">Retry</button>
    </div>

    <div v-else class="detail-body">
      <!-- Basic Info -->
      <div class="section-card">
        <div class="section-title">Space Information</div>
        <div class="meta-row">
          <div class="meta-field">
            <label>Name</label>
            <input v-model="editName" placeholder="Space name" />
          </div>
        </div>

        <!-- View-only info for existing spaces -->
        <div v-if="!isNew && space" class="info-grid">
          <div class="info-item">
            <span class="info-label">ID</span>
            <span class="info-value mono">{{ space.id || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Public Key</span>
            <span class="info-value mono">{{ space.pub }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Seed</span>
            <span class="info-value mono">{{ space.seed }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Type</span>
            <span class="info-value">
              <span class="type-badge" :class="isBuiltin ? 'badge-builtin' : 'badge-custom'">
                {{ isBuiltin ? 'Builtin' : 'Custom' }}
              </span>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value">
              <span class="status-badge" :class="space.status === 1 ? 'status-active' : 'status-inactive'">
                {{ space.status === 1 ? 'Active' : 'Inactive' }}
              </span>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Created At</span>
            <span class="info-value">{{ space.createdAt ? new Date(space.createdAt * 1000).toLocaleString() : '-' }}</span>
          </div>
        </div>
      </div>

      <!-- Action buttons for existing space -->
      <!-- <div v-if="!isNew && space" class="section-card action-card">
        <div class="section-title">Actions</div>
        <div class="action-row">
          <button class="action-btn cred-btn" @click="openCredentialModal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Create Credential
          </button>
          <button class="action-btn get-cred-btn" @click="openGetCredModal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Get Credential
          </button>
        </div>
      </div> -->

      <!-- Policy: Imports -->
      <div class="section-card">
        <div class="section-title">
          Imports
          <button class="icon-btn add-btn" @click="addImport" title="Add Import">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <div v-if="imports.length === 0" class="empty-hint">No imports defined.</div>
        <div v-else class="policy-list">
          <div v-for="(imp, idx) in imports" :key="idx" class="policy-row">
            <div class="policy-fields">
              <div class="policy-field">
                <label>Name</label>
                <input v-model="imp.name" placeholder="Import name" />
              </div>
              <div class="policy-field">
                <label>Subject</label>
                <input v-model="imp.subject" placeholder="inflow.plugin.event.>" />
              </div>
              <div class="policy-field">
                <label>Account</label>
                <input v-model="imp.account" placeholder="Public key of account" />
              </div>
              <div class="policy-field small">
                <label>Type</label>
                <select v-model="imp.type">
                  <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>
            <button class="icon-btn remove-btn" @click="removeImport(idx)" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Policy: Exports -->
      <div class="section-card">
        <div class="section-title">
          Exports
          <button class="icon-btn add-btn" @click="addExport" title="Add Export">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <div v-if="exports.length === 0" class="empty-hint">No exports defined.</div>
        <div v-else class="policy-list">
          <div v-for="(exp, idx) in exports" :key="idx" class="policy-row">
            <div class="policy-fields">
              <div class="policy-field">
                <label>Name</label>
                <input v-model="exp.name" placeholder="Export name" />
              </div>
              <div class="policy-field">
                <label>Subject</label>
                <input v-model="exp.subject" placeholder="inflow.v1.>" />
              </div>
              <div class="policy-field small">
                <label>Type</label>
                <select v-model="exp.type">
                  <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>
            <button class="icon-btn remove-btn" @click="removeExport(idx)" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Policy JSON Preview (view mode for existing) -->
      <div v-if="!isNew && space?.policy" class="section-card">
        <div class="section-title">Policy Preview</div>
        <div class="view-tabs">
          <button class="tab-btn" :class="{ active: activeView === 'table' }" @click="activeView = 'table'">Table View</button>
          <button class="tab-btn" :class="{ active: activeView === 'json' }" @click="activeView = 'json'">JSON</button>
        </div>
        <div class="policy-panel">
          <div v-show="activeView === 'table'" class="view-panel table-panel">
            <div class="tree-wrapper">
              <JsonTreeTable
                v-for="[k, v] in Object.entries(space.policy as Record<string, unknown>)"
                :key="k"
                :field="k"
                :value="v"
                :depth="0"
                :path="k"
              />
            </div>
          </div>
          <div v-show="activeView === 'json'" class="view-panel json-panel">
            <CodeEditor
              :model-value="JSON.stringify(space.policy, null, 2) + '\n'"
              language="javascript"
              readonly
            />
          </div>
        </div>
      </div>

      <!-- Spec Display (for builtin spaces) -->
      <div v-if="!isNew && space?.spec" class="section-card">
        <div class="section-title">Specification</div>
        <div class="view-tabs">
          <button class="tab-btn" :class="{ active: activeView === 'table' }" @click="activeView = 'table'">Table View</button>
          <button class="tab-btn" :class="{ active: activeView === 'json' }" @click="activeView = 'json'">JSON</button>
        </div>
        <div class="policy-panel">
          <div v-show="activeView === 'table'" class="view-panel table-panel">
            <div class="tree-wrapper">
              <JsonTreeTable
                v-for="[k, v] in Object.entries(space.spec as Record<string, unknown>)"
                :key="k"
                :field="k"
                :value="v"
                :depth="0"
                :path="k"
              />
            </div>
          </div>
          <div v-show="activeView === 'json'" class="view-panel json-panel">
            <CodeEditor
              :model-value="JSON.stringify(space.spec, null, 2) + '\n'"
              language="javascript"
              readonly
            />
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<style scoped>
.space-detail-view {
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
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
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

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.state-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--text, #6b6375);
  font-size: 14px;
}

.state-message.error {
  color: #dc3545;
  flex-direction: column;
}

.retry-btn {
  padding: 6px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  cursor: pointer;
  font-size: 13px;
}

.retry-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 10px;
  padding: 16px;
  background: var(--bg, #fff);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h, #08060d);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ---- Meta fields ---- */
.meta-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
.meta-field textarea,
.meta-field select {
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
.meta-field textarea:focus,
.meta-field select:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

/* ---- Info grid (view only) ---- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e4e7);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.info-value.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
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

/* ---- Action card ---- */
.action-card {
  background: var(--accent-bg, rgba(170, 59, 255, 0.03));
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
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

.action-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.cred-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.get-cred-btn:hover {
  border-color: #10b981;
  color: #10b981;
}

.cancel-btn:hover {
  border-color: #dc3545;
  color: #dc3545;
}

/* ---- Policy list ---- */
.empty-hint {
  font-size: 13px;
  color: var(--text-muted, #8f8a99);
  padding: 8px 0;
}

.policy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.policy-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  background: var(--bg, #fff);
}

.policy-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
}

.policy-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 160px;
}

.policy-field.small {
  min-width: 100px;
  flex: 0 0 120px;
}

.policy-field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #8f8a99);
}

.policy-field input,
.policy-field select {
  padding: 6px 10px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 13px;
  transition: border-color 0.15s;
  font-family: inherit;
}

.policy-field input:focus,
.policy-field select:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.add-btn {
  background: rgba(170, 59, 255, 0.1);
  color: var(--accent, #aa3bff);
}

.add-btn:hover {
  background: var(--accent, #aa3bff);
  color: #fff;
}

.remove-btn:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

/* ---- View Tabs ---- */
.view-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 6px 14px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.tab-btn.active {
  background: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
  color: #fff;
}

.policy-panel {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg, #fff);
}

.view-panel {
  min-height: 200px;
}

.table-panel {
  overflow: auto;
  padding: 8px 0;
}

.tree-wrapper {
  display: flex;
  flex-direction: column;
}

.json-panel {
  display: flex;
  flex-direction: column;
}

.json-panel :deep(.code-editor) {
  border: none;
  border-radius: 0;
}

.json-panel :deep(.cm-editor) {
  min-height: 200px;
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

/* ---- Permission sections in modal ---- */
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
