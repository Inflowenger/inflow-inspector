<script setup lang="ts">
import { ref, computed, watch, onMounted, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../../api/client'
import { useApiMutation } from '../../api/hooks'
import CodeEditor from '../common/CodeEditor.vue'
import { Icon } from '@iconify/vue'
import { iconCollections, DEFAULT_ICON_CLASS, DEFAULT_ICON_NAME } from '../../data/iconCatalog'
import type { ExtensionRecord, ExtensionType,  } from '../../api/types'

// JsonForms imports for preview
import { JsonForms } from '@jsonforms/vue'
import { vanillaRenderers } from '@jsonforms/vue-vanilla'
import {
  InflowControlRenderer,
  InflowLayoutRenderer,
  inflowControlTester,
  inflowLayoutTester
} from '@inflowenger/inflow-ui'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isNew = computed(() => !props.id)
const extensionId = computed(() => props.id ?? '')

const loading = ref(false)
const error = ref<string | null>(null)

// Form state
const name = ref('')
const description = ref('')
const type = ref<ExtensionType>('extrinsic')
const iconClass = ref(DEFAULT_ICON_CLASS)
const iconName = ref(DEFAULT_ICON_NAME)

// BindTo state (for extrinsic type)
const bindToTopicKey = ref('')
const bindToValues = ref<Record<string, string>>({})
const extrinsicsMap = ref<Record<string, string>>({})
const extrinsicsLoading = ref(false)
const extrinsicsError = ref<string | null>(null)

// JSON editors state
const schemaJson = ref('{}\n')
const uiSchemaJson = ref('{}\n')
const schemaError = ref<string | null>(null)
const uiSchemaError = ref<string | null>(null)

// Preview modal
const showPreview = ref(false)
const previewData = ref<Record<string, any>>({})

// markRaw every renderer component: JSON Forms stores the renderers array in a
// reactive() context, which would otherwise wrap each component in a Proxy —
// destabilising component identity and breaking value reflection (e.g. the enum
// <select> not showing its data). markRaw must be per-component because our
// InflowControlRenderer rebuilds a filtered array for its inner DispatchRenderer.
const renderers = [
  { tester: inflowControlTester, renderer: markRaw(InflowControlRenderer) },
  { tester: inflowLayoutTester, renderer: markRaw(InflowLayoutRenderer) },
  ...vanillaRenderers.map((r) => ({ tester: r.tester, renderer: markRaw(r.renderer) })),
]

// Icon picker — icons come from real collections (mdi, lucide, heroicons,
// brands) rendered via @iconify/vue. We store `icon.class` = collection id and
// `icon.name` = icon name; `<Icon>` addresses them as `class:name`.
const showIconPicker = ref(false)
const iconSearch = ref('')
const activeCollection = ref(DEFAULT_ICON_CLASS)

// Full Iconify id for the currently selected icon (e.g. "mdi:web").
const selectedIconId = computed(() => `${iconClass.value}:${iconName.value}`)

const activeIcons = computed(() => {
  const collection = iconCollections.find((c) => c.id === activeCollection.value)
  if (!collection) return []
  const q = iconSearch.value.trim().toLowerCase()
  const names = q ? collection.icons.filter((n) => n.includes(q)) : collection.icons
  return names.map((name) => ({ name, id: `${collection.id}:${name}` }))
})

function selectIcon(collectionId: string, name: string) {
  iconClass.value = collectionId
  iconName.value = name
  showIconPicker.value = false
}

// ---------------------------------------------------------------------------
// Extrinsics / BindTo
// ---------------------------------------------------------------------------

async function fetchExtrinsics() {
  extrinsicsLoading.value = true
  extrinsicsError.value = null
  try {
    const res = await apiClient.get<unknown>('/extension/extrinsics')
    const body = res.data as Record<string, any> | null
    if (body && body.data) {
      extrinsicsMap.value = body.data as Record<string, string>
    } else {
      extrinsicsMap.value = {}
    }
  } catch (err) {
    extrinsicsError.value = err instanceof Error ? err.message : 'Failed to load extrinsics'
    extrinsicsMap.value = {}
  } finally {
    extrinsicsLoading.value = false
  }
}

const extrinsicKeys = computed(() => Object.keys(extrinsicsMap.value))

const selectedSubject = computed(() => {
  if (!bindToTopicKey.value) return ''
  return extrinsicsMap.value[bindToTopicKey.value] || ''
})

// Parse variables from subject string, e.g. "svc.add.rec.{COLLECTION_NAME}"
const subjectVariables = computed(() => {
  const subject = selectedSubject.value
  if (!subject) return []
  const matches = subject.matchAll(/\{([^}]+)\}/g)
  return Array.from(matches).map(m => m[1])
})

// Reset bindTo values when topicKey changes, preserving existing values where possible
watch(bindToTopicKey, () => {
  const newVars = subjectVariables.value
  const newValues: Record<string, string> = {}
  for (const v of newVars) {
    newValues[v] = bindToValues.value[v] || ''
  }
  bindToValues.value = newValues
})

// Fetch extrinsics when type becomes 'extrinsic'
watch(type, (val) => {
  if (val === 'extrinsic') {
    fetchExtrinsics()
  }
})

// Validate JSON on change
watch(schemaJson, (val) => {
  try {
    JSON.parse(val)
    schemaError.value = null
  } catch (e) {
    schemaError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
})

watch(uiSchemaJson, (val) => {
  try {
    JSON.parse(val)
    uiSchemaError.value = null
  } catch (e) {
    uiSchemaError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
})

const parsedSchema = computed(() => {
  try {
    return JSON.parse(schemaJson.value)
  } catch {
    return {}
  }
})

const parsedUiSchema = computed(() => {
  try {
    return JSON.parse(uiSchemaJson.value)
  } catch {
    return {}
  }
})

// Build an initial data object from the schema's `default`s (incl. nested
// objects). JSON Forms does not inject schema defaults into empty data on its
// own, so we seed them here for the preview. Kept as a plain schema walk so it
// stays independent of JSON Forms internals / versions.
function buildDefaults(schema: any): any {
  if (!schema || typeof schema !== 'object') return undefined
  if ('default' in schema) return schema.default
  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, any> = {}
    for (const [key, sub] of Object.entries<any>(schema.properties)) {
      const val = buildDefaults(sub)
      if (val !== undefined) obj[key] = val
    }
    return Object.keys(obj).length ? obj : undefined
  }
  return undefined
}

function openPreview() {
  previewData.value = buildDefaults(parsedSchema.value) ?? {}
  showPreview.value = true
}

function onPreviewChange(event: any) {
  previewData.value = event.data
}

async function fetchExtension() {
  if (isNew.value) return
  loading.value = true
  error.value = null
  try {
    const res = await apiClient.get<unknown>(`/extension/id/${extensionId.value}`)
    const body = res.data as Record<string, any> | null
    if (body && body.data) {
      const ext = body.data as ExtensionRecord
      name.value = ext.name || ''
      description.value = ext.description || ''
      type.value = ext.type || 'plugin'
      if (ext.icon) {
        iconClass.value = ext.icon.class || DEFAULT_ICON_CLASS
        iconName.value = ext.icon.name || DEFAULT_ICON_NAME
        activeCollection.value = iconClass.value
      }
      if (ext.params) {
        schemaJson.value = JSON.stringify(ext.params.schema || {}, null, 2) + '\n'
        uiSchemaJson.value = JSON.stringify(ext.params.ui || {}, null, 2) + '\n'
      }
      if (ext.type === 'extrinsic') {
        await fetchExtrinsics()
      }
      if (ext.bindTo) {
        bindToTopicKey.value = ext.bindTo.topic_key || ''
        bindToValues.value = { ...(ext.bindTo.values || {}) }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load extension'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!isNew.value) {
    fetchExtension()
  } else {
    schemaJson.value = JSON.stringify({
  "type": "object",
  "title": "Jira Connector",
  "properties": {
    "connection": {
      "type": "object",
      "title": "Connection",
      "properties": {
        "protocol": {
          "type": "string",
          "title": "Protocol",
          "enum": ["http", "https", "ws", "wss"],
          "default": "https"
        },
        "host": { "type": "string", "title": "Host", "default": "localhost" },
        "port": { "type": "integer", "title": "Port", "minimum": 1, "maximum": 65535, "default": 443 },
        "secure": { "type": "boolean", "title": "Use TLS", "default": true }
      },
      "required": ["protocol", "host"]
    },
    "project": {
      "type": "string",
      "title": "Project",
      "enum": ["ENG", "OPS", "MARKETING"]
    },
    "labels": {
      "type": "array",
      "title": "Labels",
      "items": { "type": "string" }
    },
    "authentication": {
      "title": "Authentication",
      "oneOf": [
        {
          "title": "API Key",
          "type": "object",
          "properties": {
            "kind": { "type": "string", "const": "apiKey" },
            "apiKey": { "type": "string", "title": "API Key", "format": "password" }
          },
          "required": ["apiKey"]
        },
        {
          "title": "OAuth2",
          "type": "object",
          "properties": {
            "kind": { "type": "string", "const": "oauth2" },
            "clientId": { "type": "string", "title": "Client ID" },
            "clientSecret": { "type": "string", "title": "Client Secret", "format": "password" }
          },
          "required": ["clientId", "clientSecret"]
        }
      ]
    }
  },
  "required": ["project"]
}, null, 2) + '\n'
    uiSchemaJson.value = JSON.stringify({
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Group",
      "label": "Connection",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/connection/properties/protocol",
          "label": "Protocol",
          "x-inflow-ui": {
            "action": { "name": "refreshForm" },
            "button": { "position": "append", "icon": "↻", "label": "Reload" }
          }
        },
        {
          "type": "HorizontalLayout",
          "elements": [
            { "type": "Control", "scope": "#/properties/connection/properties/host", "label": "Host" },
            { "type": "Control", "scope": "#/properties/connection/properties/port", "label": "Port" }
          ]
        },
        { "type": "Control", "scope": "#/properties/connection/properties/secure", "label": "Use TLS" }
      ]
    },
    {
      "type": "Group",
      "label": "Issue",
      "elements": [
        { "type": "Control", "scope": "#/properties/project", "label": "Project" },
        { "type": "Control", "scope": "#/properties/labels", "label": "Labels" }
      ]
    },
    {
      "type": "Group",
      "label": "Authentication",
      "elements": [
        { "type": "Control", "scope": "#/properties/authentication" }
      ]
    }
  ]
}, null, 2) + '\n'
    if (type.value === 'extrinsic') {
      fetchExtrinsics()
    }
  }
})

const { loading: saving, mutate: saveExtension } = useApiMutation<{ id: string }>('POST',
  '/extension',
)

async function handleSave() {
  if (schemaError.value || uiSchemaError.value) {
    return
  }
  const body: Record<string, any> = {
    id: props.id || '',
    name: name.value || 'Unnamed',
    description: description.value,
    type: type.value,
    icon: {
      class: iconClass.value,
      name: iconName.value,
      meta: {},
    },
    params: {
      schema: parsedSchema.value,
      ui: parsedUiSchema.value,
    },
  }

  if (type.value === 'extrinsic') {
    body.bindTo = {
      topic_key: bindToTopicKey.value,
      values: { ...bindToValues.value },
    }
  }

  const res = await saveExtension(body)
  if (res?.data && typeof res.data === 'object' && 'id' in res.data) {
    router.push({ name: 'extension-view', params: { id: (res.data as { id: string }).id } })
  } else if (isNew.value) {
    router.push({ name: 'extensions' })
  } else {
    await fetchExtension()
  }
}

function goBack() {
  router.push({ name: 'extensions' })
}

const isBusy = computed(() => loading.value || saving.value)
const hasJsonErrors = computed(() => !!schemaError.value || !!uiSchemaError.value)
</script>

<template>
  <div class="extension-detail-view">
    <!-- Header -->
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      <h2>{{ isNew ? 'New Extension' : 'Edit Extension' }}</h2>
      <button
        class="save-btn"
        :disabled="isBusy || hasJsonErrors"
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
    <div v-if="loading && !isNew" class="state-message">Loading extension…</div>
    <div v-else-if="error" class="state-message error">
      <span>{{ error }}</span>
      <button class="retry-btn" @click="fetchExtension">Retry</button>
    </div>

    <div v-else class="detail-body">
      <!-- Basic Info -->
      <div class="section-card">
        <div class="section-title">Basic Information</div>
        <div class="meta-row">
          <div class="meta-field">
            <label>Name</label>
            <input v-model="name" placeholder="Extension name" />
          </div>
          <div class="meta-field">
            <label>Type</label>
            <select v-model="type">
              <option value="plugin">Plugin</option>
              <option value="extrinsic">Extrinsic</option>
            </select>
          </div>
        </div>
        <div class="meta-field full-width">
          <label>Description</label>
          <textarea v-model="description" placeholder="Extension description" rows="3"></textarea>
        </div>
      </div>

      <!-- BindTo (only for extrinsic) -->
      <div v-if="type === 'extrinsic'" class="section-card">
        <div class="section-title">Bind To</div>
        <div class="meta-row">
          <div class="meta-field">
            <label>Select A Defined Service In Backend</label>
            <select v-model="bindToTopicKey" :disabled="extrinsicsLoading">
              <option value="">-- Select --</option>
              <option v-for="key in extrinsicKeys" :key="key" :value="key">{{ key }}</option>
            </select>
            <div v-if="extrinsicsLoading" class="bind-hint">Loading extrinsics…</div>
            <div v-else-if="extrinsicsError" class="bind-error">{{ extrinsicsError }}</div>
          </div>
        </div>

        <div v-if="selectedSubject" class="subject-display">
          <span class="subject-label">Subject:</span>
          <code class="subject-value">{{ selectedSubject }}</code>
        </div>

        <div v-if="subjectVariables.length > 0" class="variables-row">
          <div v-for="v in subjectVariables" :key="v" class="meta-field">
            <label>{{ v }}</label>
            <input v-model="bindToValues[v]" :placeholder="'Enter ' + v" />
          </div>
        </div>
      </div>

      <!-- Icon Picker -->
      <div class="section-card">
        <div class="section-title">Icon</div>
        <div class="icon-picker">
          <div class="icon-collections">
            <button
              v-for="col in iconCollections"
              :key="col.id"
              type="button"
              class="icon-collection-tab"
              :class="{ active: activeCollection === col.id }"
              @click="activeCollection = col.id"
            >
              {{ col.label }}
            </button>
          </div>

          <input
            v-model="iconSearch"
            type="text"
            class="icon-search"
            placeholder="Search icons in this collection…"
          />

          <div class="icon-grid">
            <div
              v-for="icon in activeIcons"
              :key="icon.id"
              class="icon-option"
              :class="{ active: selectedIconId === icon.id }"
              :title="icon.id"
              @click="selectIcon(activeCollection, icon.name)"
            >
              <Icon :icon="icon.id" width="20" height="20" />
              <span class="icon-label">{{ icon.name }}</span>
            </div>
            <div v-if="activeIcons.length === 0" class="icon-empty">No icons match “{{ iconSearch }}”.</div>
          </div>
        </div>
      </div>

      <!-- Parameters (JSON Schema + UI Schema) -->
      <div class="section-card">
        <div class="section-title">Parameters</div>
        <div class="schema-tabs">
          <div class="schema-col">
            <div class="schema-header">
              <span class="schema-label">JSON Schema</span>
              <span v-if="schemaError" class="error-badge">{{ schemaError }}</span>
              <span v-else class="ok-badge">Valid JSON</span>
            </div>
            <div class="schema-editor">
              <CodeEditor v-model="schemaJson" language="javascript" />
            </div>
          </div>
          <div class="schema-col">
            <div class="schema-header">
              <span class="schema-label">UI Schema</span>
              <span v-if="uiSchemaError" class="error-badge">{{ uiSchemaError }}</span>
              <span v-else class="ok-badge">Valid JSON</span>
            </div>
            <div class="schema-editor">
              <CodeEditor v-model="uiSchemaJson" language="javascript" />
            </div>
          </div>
        </div>

        <div class="preview-bar">
          <button
            class="preview-btn"
            :disabled="hasJsonErrors"
            @click="openPreview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview Form
          </button>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <transition name="preview-fade">
      <div v-if="showPreview" class="preview-overlay" @click.self="showPreview = false">
        <div class="preview-panel">
          <div class="preview-header">
            <span class="preview-title">Form Preview</span>
            <button class="preview-close" @click="showPreview = false">×</button>
          </div>
          <div class="preview-body">
            <JsonForms
              :data="previewData"
              :schema="parsedSchema"
              :uischema="parsedUiSchema"
              :renderers="renderers"
              @change="onPreviewChange"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.extension-detail-view {
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
}

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

.meta-field.full-width {
  width: 100%;
  flex: none;
}

.meta-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.meta-field input,
.meta-field select,
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
.meta-field select:focus,
.meta-field textarea:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
}

/* ---- BindTo ---- */
.bind-hint {
  font-size: 12px;
  color: var(--text, #6b6375);
  margin-top: 4px;
}

.bind-error {
  font-size: 12px;
  color: #dc3545;
  margin-top: 4px;
}

.subject-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  border-radius: 6px;
  border: 1px solid var(--border, #e5e4e7);
}

.subject-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.subject-value {
  font-size: 13px;
  color: var(--accent, #aa3bff);
  font-family: monospace;
  background: transparent;
}

.variables-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* ---- Icon Picker ---- */
.icon-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-icon {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
  color: var(--accent, #aa3bff);
}

.selected-icon:hover {
  border-color: var(--accent, #aa3bff);
}

.icon-name {
  font-size: 13px;
  color: var(--text-h, #08060d);
  font-weight: 500;
}

.pick-icon-btn {
  padding: 6px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.pick-icon-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.icon-picker {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e4e7);
}

.icon-collections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.icon-collection-tab {
  padding: 4px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 999px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.icon-collection-tab:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.icon-collection-tab.active {
  border-color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.icon-search {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  margin-bottom: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.icon-search:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.icon-empty {
  grid-column: 1 / -1;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text, #6b6375);
}

.icon-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text, #6b6375);
}

.icon-option:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
}

.icon-option.active {
  border-color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.icon-label {
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ---- Schema Editors ---- */
.schema-tabs {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.schema-col {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schema-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.schema-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.error-badge {
  font-size: 11px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.ok-badge {
  font-size: 11px;
  color: #28a745;
  font-weight: 500;
  background: rgba(40, 167, 69, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.schema-editor {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
  min-height: 240px;
}

.schema-editor :deep(.code-editor) {
  border: none;
  border-radius: 0;
}

.schema-editor :deep(.cm-editor) {
  min-height: 240px;
}

.preview-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e4e7);
}

.preview-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  background: var(--bg, #fff);
  color: var(--accent, #aa3bff);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-btn:hover:not(:disabled) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-color: var(--accent, #aa3bff);
}

.preview-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Preview Modal ---- */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.preview-panel {
  background: var(--bg, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.preview-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.preview-close {
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

.preview-close:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.preview-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.25s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

.preview-fade-enter-active .preview-panel,
.preview-fade-leave-active .preview-panel {
  transition: transform 0.25s ease;
}

.preview-fade-enter-from .preview-panel,
.preview-fade-leave-to .preview-panel {
  transform: scale(0.96);
}
</style>
