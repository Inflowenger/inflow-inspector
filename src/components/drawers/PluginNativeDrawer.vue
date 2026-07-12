<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Node } from '@vue-flow/core'

const props = defineProps<{
  modelValue: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Form fields matching backend PluginRule model
const subjectPrefix = ref('inflow.cpu')
const request = ref('')
const idleMin = ref<number | undefined>(undefined)
const bodyJson = ref('')
const bodyError = ref('')
const account = ref('')

// Hardcoded accounts for now — replace with API call in future
const accounts = ref<string[]>([
  'plugins-default',
])

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function validateBodyJson(): boolean {
  const raw = bodyJson.value.trim()
  if (!raw) {
    bodyError.value = ''
    return true
  }
  try {
    JSON.parse(raw)
    bodyError.value = ''
    return true
  } catch (e: any) {
    bodyError.value = e instanceof Error ? e.message : 'Invalid JSON'
    return false
  }
}

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return ''
  }
}

// Sync from node data whenever the node changes
watch(
  () => props.node,
  (node) => {
    if (node?.data) {
      subjectPrefix.value = (node.data.subject_prefix as string) || ''
      request.value = (node.data.request as string) || ''
      idleMin.value = typeof node.data.idle_min === 'number' ? node.data.idle_min : undefined

      const body = node.data.body as Record<string, any> | undefined
      bodyJson.value = body ? safeStringify(body) : ''
      bodyError.value = ''

      const infra = node.data.infra_isolated as Record<string, any> | undefined
      account.value = infra?.account || ''
    }
  },
  { immediate: true }
)

function saveAndClose() {
  if (!props.node) {
    showDrawer.value = false
    return
  }

  const isBodyValid = validateBodyJson()
  if (!isBodyValid) {
    // Don't close if body JSON is invalid — give user a chance to fix it
    return
  }

  let parsedBody: Record<string, any> | undefined
  const rawBody = bodyJson.value.trim()
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = undefined
    }
  }

  props.node.data.subject_prefix = subjectPrefix.value.trim() || undefined
  props.node.data.request = request.value.trim() || undefined
  props.node.data.idle_min = typeof idleMin.value === 'number' ? idleMin.value : undefined
  props.node.data.body = parsedBody

  props.node.data.infra_isolated = account.value
    ? {
        account: account.value,
        seed: '',
        cred: '',
        url: '',
      }
    : undefined

  showDrawer.value = false
}
</script>

<template>
  <transition name="plugin-native-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="plugin-native-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>
              <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/>
            </svg>
            <span>Plugin Native</span>
          </div>
          <button class="drawer-close" @click="saveAndClose" aria-label="Close drawer">×</button>
        </div>

        <div class="drawer-body">
          <div v-if="node" class="drawer-subtitle">
            <strong>{{ node.data?.title }}</strong>
          </div>

          <!-- Topic Prefix (Subject Prefix) -->
          <div class="field-group">
            <label class="field-label">
              Topic Prefix
              <span class="help-text">NATS subject prefix for this plugin , it includes InflowV1 protocol prefix `inflow.cpu` with Plugin UniqueId </span>
            </label>
            <input
              v-model="subjectPrefix"
              type="text"
              placeholder="e.g., inflow.cpu.uuid-aa-bbb-cccc-ddddd"
              class="field-input"
            />
          </div>

          <!-- Request -->
          <div class="field-group">
            <label class="field-label">
              Request
              <span class="help-text">Request identifier or path</span>
            </label>
            <input
              v-model="request"
              type="text"
              placeholder="e.g., create_order, get_user"
              class="field-input"
            />
          </div>

          <!-- Idle for get signal (idle_min) -->
          <div class="field-group">
            <label class="field-label">
              Idle for get signal
              <span class="help-text">Cancel after idle minutes</span>
            </label>
            <input
              v-model.number="idleMin"
              type="number"
              placeholder="e.g., 5"
              class="field-input"
              min="0"
            />
          </div>

          <!-- Body (JSON viewer / editor) -->
          <div class="field-group">
            <label class="field-label">
              Body
              <span class="help-text">Must be a valid JSON object</span>
            </label>
            <textarea
              v-model="bodyJson"
              rows="8"
              placeholder='{"key": "value"}'
              class="field-input json-textarea"
              :class="{ 'json-invalid': !!bodyError }"
              @input="validateBodyJson"
            />
            <div v-if="bodyError" class="json-error">{{ bodyError }}</div>
            <div v-else-if="bodyJson.trim()" class="json-valid">Valid JSON ✓</div>
          </div>

          <!-- Space (InfraIsolated) — Account select -->
          <div class="field-group">
            <label class="field-label">
              Space
              <span class="help-text">Select an account (InfraIsolated)</span>
            </label>
            <select v-model="account" class="field-input">
              <option value="">— Select Account —</option>
              <option v-for="a in accounts" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.drawer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  z-index: 99;
  display: flex;
  justify-content: flex-end;
}

.plugin-native-drawer {
  position: relative;
  top: 0;
  right: 0;
  width: 380px;
  height: 100%;
  background: var(--bg, #fff);
  border-left: 1px solid var(--border, #e5e4e7);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
  flex-shrink: 0;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.drawer-title svg {
  color: var(--accent, #aa3bff);
}

.drawer-close {
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

.drawer-close:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.drawer-subtitle {
  margin-bottom: 16px;
  padding-bottom: 8px;
  font-size: 13px;
  color: var(--accent, #aa3bff);
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.field-group {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  margin-bottom: 8px;
}

.help-text {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: var(--text, #6b6375);
  margin-top: 2px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.field-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.field-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.6;
}

.json-textarea {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
}

.json-textarea.json-invalid {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
}

.json-error {
  margin-top: 6px;
  font-size: 11px;
  color: #ef4444;
  font-family: 'JetBrains Mono', monospace;
}

.json-valid {
  margin-top: 6px;
  font-size: 11px;
  color: #10b981;
  font-family: inherit;
}

select.field-input {
  appearance: auto;
}

@media (max-width: 640px) {
  .plugin-native-drawer {
    width: 100%;
  }
}

/* Drawer fade transition */
.plugin-native-drawer-fade-enter-active,
.plugin-native-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.plugin-native-drawer-fade-enter-from,
.plugin-native-drawer-fade-leave-to {
  opacity: 0;
}

.plugin-native-drawer-fade-enter-active .plugin-native-drawer,
.plugin-native-drawer-fade-leave-active .plugin-native-drawer {
  transition: transform 0.3s ease;
}

.plugin-native-drawer-fade-enter-from .plugin-native-drawer,
.plugin-native-drawer-fade-leave-to .plugin-native-drawer {
  transform: translateX(100%);
}
</style>
