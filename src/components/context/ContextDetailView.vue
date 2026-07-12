<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../../api/client'
import { useApiMutation } from '../../api/hooks'
import CodeEditor from '../common/CodeEditor.vue'
import JsonTreeTable from '../common/JsonTreeTable.vue'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()

const isNew = computed(() => !props.id)
const contextId = computed(() => props.id ?? '')

const loading = ref(false)
const error = ref<string | null>(null)

// Raw JSON state for context
const rawJson = ref('{}\n')
const jsonError = ref<string | null>(null)

// Raw JSON state for header
const rawHeader = ref('{}\n')
const headerError = ref<string | null>(null)

// Name metadata
const name = ref('')

// View toggle: 'table' | 'json'
const activeView = ref<'table' | 'json'>('json')

// Header panel toggle
const showHeader = ref(false)

// Computed parsed JSON for table view (context)
const parsedData = computed(() => {
  try {
    const parsed = JSON.parse(rawJson.value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { value: parsed }
  } catch {
    return null
  }
})

// Computed parsed JSON for table view (header)
const parsedHeaderData = computed(() => {
  try {
    const parsed = JSON.parse(rawHeader.value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { value: parsed }
  } catch {
    return null
  }
})

// Validate JSON on change (context)
watch(rawJson, (val) => {
  try {
    JSON.parse(val)
    jsonError.value = null
  } catch (e) {
    jsonError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
})

// Validate JSON on change (header)
watch(rawHeader, (val) => {
  try {
    JSON.parse(val)
    headerError.value = null
  } catch (e) {
    headerError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
})

async function fetchContext() {
  if (isNew.value) return
  loading.value = true
  error.value = null
  try {
    const { data: res } = await apiClient.get<unknown>(`/context/id/${contextId.value}`)
    const resBody = res as Record<string, any> | null
    if (resBody) {
      name.value = String(resBody.data?.title ?? '')

      // Parse context
      let context = resBody?.data?.context ?? '{}'
      let contextStr = typeof context === 'string' ? context : JSON.stringify(context)
      try {
        const parsed = JSON.parse(contextStr)
        rawJson.value = JSON.stringify(parsed, null, 2)
        jsonError.value = null
      } catch (e) {
        rawJson.value = contextStr
        jsonError.value = e instanceof Error ? e.message : 'Invalid JSON from server'
      }

      // Parse header
      let header = resBody?.data?.header ?? '{}'
      let headerStr = typeof header === 'string' ? header : JSON.stringify(header)
      try {
        const parsed = JSON.parse(headerStr)
        rawHeader.value = JSON.stringify(parsed, null, 2)
        headerError.value = null
      } catch (e) {
        rawHeader.value = headerStr
        headerError.value = e instanceof Error ? e.message : 'Invalid JSON from server'
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load context'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!isNew.value) {
    fetchContext()
  } else {
    rawJson.value = JSON.stringify({ name: '', type: '', data: {} }, null, 2) + '\n'
    rawHeader.value = '{}\n'
  }
})

const { loading: saving, mutate: saveContext } = useApiMutation<{ id: string }>('POST',
  '/context',
)

const { loading: updating, mutate: updateContext } = useApiMutation<unknown>(
  'POST',
  `/context`,
)

async function handleSave() {
  if (jsonError.value || headerError.value) {
    if (jsonError.value) jsonError.value = 'Cannot save with invalid JSON'
    if (headerError.value) headerError.value = 'Cannot save with invalid JSON'
    return
  }
  const body = {
    id: props.id || '',
    title: name.value || 'Unnamed',
    context: rawJson.value,
    header: JSON.parse(rawHeader.value),
  }

  if (isNew.value) {
    const res = await saveContext(body)
    if (res?.data && typeof res.data === 'object' && 'id' in res.data) {
      router.push({ name: 'context-view', params: { id: (res.data as { id: string }).id } })
    } else {
      router.push({ name: 'contexts' })
    }
  } else {
    await updateContext(body)
    await fetchContext()
  }
}

function goBack() {
  router.push({ name: 'contexts' })
}

const isBusy = computed(() => loading.value || saving.value || updating.value)
const hasAnyError = computed(() => !!jsonError.value || !!headerError.value)
</script>

<template>
  <div class="context-detail-view">
    <!-- Header -->
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      <h2>{{ isNew ? 'New Context' : 'View Context' }}</h2>
      <button
        class="save-btn"
        :disabled="isBusy || hasAnyError"
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
    <div v-if="loading && !isNew" class="state-message">Loading context…</div>
    <div v-else-if="error" class="state-message error">
      <span>{{ error }}</span>
      <button class="retry-btn" @click="fetchContext">Retry</button>
    </div>

    <div v-else class="detail-body">
      <!-- Meta Fields -->
      <div class="meta-row">
        <div class="meta-field">
          <label>Title</label>
          <input v-model="name" placeholder="Context Title" />
        </div>
      </div>

      <!-- View Toggle -->
      <div class="view-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeView === 'table' }"
          @click="activeView = 'table'"
        >
          Table View
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeView === 'json' }"
          @click="activeView = 'json'"
        >
          JSON Editor
        </button>
        <button
          class="tab-btn header-toggle"
          :class="{ active: showHeader }"
          @click="showHeader = !showHeader"
        >
          {{ showHeader ? 'Hide Header' : 'Show Header' }}
        </button>

        <span v-if="hasAnyError" class="json-error-badge">Invalid JSON</span>
        <span v-else-if="activeView === 'json'" class="json-ok-badge">Valid JSON</span>
      </div>

      <!-- Content Panels -->
      <div :class="['panels-wrapper', { 'two-column': showHeader }]">
        <!-- Context Panel -->
        <div class="panel">
          <div v-if="showHeader" class="panel-label">Context</div>
          <!-- Table View -->
          <div v-show="activeView === 'table'" class="view-panel table-panel">
            <div v-if="parsedData" class="tree-wrapper">
              <JsonTreeTable
                v-for="[k, v] in Object.entries(parsedData)"
                :key="k"
                :field="k"
                :value="v"
                :depth="0"
                :path="k"
              />
            </div>
            <div v-else class="state-message">Invalid JSON — switch to JSON Editor to fix.</div>
          </div>
          <!-- JSON View -->
          <div v-show="activeView === 'json'" class="view-panel json-panel">
            <CodeEditor v-model="rawJson" language="javascript" />
          </div>
          <div v-if="jsonError" class="panel-error">{{ jsonError }}</div>
        </div>

        <!-- Header Panel -->
        <div v-if="showHeader" class="panel">
          <div class="panel-label">Header</div>
          <!-- Table View -->
          <div v-show="activeView === 'table'" class="view-panel table-panel">
            <div v-if="parsedHeaderData" class="tree-wrapper">
              <JsonTreeTable
                v-for="[k, v] in Object.entries(parsedHeaderData)"
                :key="k"
                :field="k"
                :value="v"
                :depth="0"
                :path="k"
              />
            </div>
            <div v-else class="state-message">Invalid JSON — switch to JSON Editor to fix.</div>
          </div>
          <!-- JSON View -->
          <div v-show="activeView === 'json'" class="view-panel json-panel">
            <CodeEditor v-model="rawHeader" language="javascript" />
          </div>
          <div v-if="headerError" class="panel-error">{{ headerError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-detail-view {
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
  flex: 1;
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
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.meta-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
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

.meta-field input {
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  transition: border-color 0.15s;
}

.meta-field input:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

.view-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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

.header-toggle {
  margin-left: auto;
}

.json-error-badge {
  font-size: 12px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.json-ok-badge {
  font-size: 12px;
  color: #28a745;
  font-weight: 500;
  background: rgba(40, 167, 69, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.panels-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
  flex-direction: column;
}

.panels-wrapper.two-column {
  flex-direction: row;
}

.panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 6px;
}

.panel-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  padding: 4px 0;
}

.panel-error {
  font-size: 12px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.view-panel {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg, #fff);
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
  flex: 1;
}

.json-panel :deep(.cm-editor) {
  min-height: 100%;
  height: 100%;
}
</style>
