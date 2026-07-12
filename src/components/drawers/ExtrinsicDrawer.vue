<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Node } from '@vue-flow/core'

interface KeyValuePair {
  key: string
  value: string
}

const props = defineProps<{
  modelValue: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const serviceTopic = ref('')
const timeout = ref<number | undefined>(undefined)
const operationData = ref<KeyValuePair[]>([])

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function recordToPairs(record: Record<string, string> | undefined): KeyValuePair[] {
  if (!record) return []
  return Object.entries(record).map(([k, v]) => ({ key: k, value: v }))
}

function pairsToRecord(pairs: KeyValuePair[]): Record<string, string> | undefined {
  const valid = pairs.filter((p) => p.key.trim() !== '')
  if (valid.length === 0) return undefined
  const record: Record<string, string> = {}
  for (const p of valid) {
    record[p.key.trim()] = p.value
  }
  return record
}

// Sync from node data whenever the node changes
watch(
  () => props.node,
  (node) => {
    if (node?.data) {
      serviceTopic.value = (node.data.serviceTopic as string) || ''
      timeout.value = typeof node.data.timeout === 'number' ? node.data.timeout : undefined
      operationData.value = recordToPairs(node.data.operationData as Record<string, string> | undefined)
    }
  },
  { immediate: true }
)

function addPair() {
  operationData.value.push({ key: '', value: '' })
}

function removePair(index: number) {
  operationData.value.splice(index, 1)
}

function saveAndClose() {
  if (props.node) {
    props.node.data.serviceTopic = serviceTopic.value.trim() || undefined
    props.node.data.timeout = typeof timeout.value === 'number' ? timeout.value : undefined
    props.node.data.operationData = pairsToRecord(operationData.value)
  }
  showDrawer.value = false
}
</script>

<template>
  <transition name="extrinsic-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="extrinsic-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>
              <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/>
            </svg>
            <span>Extrinsic Node</span>
          </div>
          <button class="drawer-close" @click="saveAndClose" aria-label="Close drawer">×</button>
        </div>

        <div class="drawer-body">
          <div v-if="node" class="drawer-subtitle">
            <strong>{{ node.data?.title }}</strong>
          </div>

          <!-- Service Topic (NATS Subject) -->
          <div class="field-group">
            <label class="field-label">
              Service Topic
              <span class="help-text">NATS Subject to subscribe/publish</span>
            </label>
            <input
              v-model="serviceTopic"
              type="text"
              placeholder="e.g., user.created, orders.*"
              class="field-input"
            />
          </div>

          <!-- Timeout -->
          <div class="field-group">
            <label class="field-label">
              Timeout
              <span class="help-text">Timeout in seconds</span>
            </label>
            <input
              v-model.number="timeout"
              type="number"
              placeholder="e.g., 5000"
              class="field-input"
              min="0"
            />
          </div>

          <!-- Operation Data (K/V pairs) -->
          <div class="field-group">
            <label class="field-label">
              Operation Data
              <span class="help-text">Key/Value pairs saved as a JSON object</span>
            </label>

            <div class="kv-list">
              <div
                v-for="(pair, index) in operationData"
                :key="index"
                class="kv-row"
              >
                <input
                  v-model="pair.key"
                  type="text"
                  placeholder="Key"
                  class="field-input kv-key"
                />
                <input
                  v-model="pair.value"
                  type="text"
                  placeholder="Value"
                  class="field-input kv-value"
                />
                <button
                  class="kv-remove"
                  title="Remove pair"
                  @click="removePair(index)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <button class="kv-add" @click="addPair">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Pair
            </button>
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

.extrinsic-drawer {
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

/* ---- K/V pairs ---- */
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kv-key {
  flex: 1;
  min-width: 0;
}

.kv-value {
  flex: 1.5;
  min-width: 0;
}

.kv-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.kv-remove:hover {
  background: #fef2f2;
  color: #ef4444;
  border-color: #ef4444;
}

.kv-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px dashed var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.kv-add:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-style: solid;
  border-color: var(--accent, #aa3bff);
}

@media (max-width: 640px) {
  .extrinsic-drawer {
    width: 100%;
  }
}

/* Drawer fade transition */
.extrinsic-drawer-fade-enter-active,
.extrinsic-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.extrinsic-drawer-fade-enter-from,
.extrinsic-drawer-fade-leave-to {
  opacity: 0;
}

.extrinsic-drawer-fade-enter-active .extrinsic-drawer,
.extrinsic-drawer-fade-leave-active .extrinsic-drawer {
  transition: transform 0.3s ease;
}

.extrinsic-drawer-fade-enter-from .extrinsic-drawer,
.extrinsic-drawer-fade-leave-to .extrinsic-drawer {
  transform: translateX(100%);
}
</style>
