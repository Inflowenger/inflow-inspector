<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Node } from '@vue-flow/core'
import { useApiQuery } from '../../api/hooks'
import { apiClient } from '../../api/client'
import type { PaginatedResponse } from '../../api/types'

export interface WorkflowSummary {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

interface FlowNodeOption {
  id: string
  label: string
}

interface FlowDetail {
  id: string
  title: string
  view_flow?: {
    nodes: Array<{
      id: string
      data?: { title?: string }
      type?: string
    }>
  }
}

interface GotoData {
  flowId: string
  flowTitle?: string
  from_nodeId: string
  from_nodeTitle?: string
  end_nodeId: string
  end_nodeTitle?: string
}

const props = defineProps<{
  modelValue: boolean
  node: Node | null
  flowId:string 
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// Fetch flows list from API (same endpoint as WorkflowListView)
const {
  data: flowsData,
  loading: flowsLoading,
  error: flowsError,
} = useApiQuery<PaginatedResponse<WorkflowSummary>>('/flow', {
  params: { per_page: 100 },
  immediate: true,
})

const workflows = computed(() => flowsData.value?.data.list.filter(el=>el.id!=props.flowId) ?? [])

// Cache for fetched flow details (flowId -> nodes)
const flowDetailsCache = ref<Record<string, FlowNodeOption[]>>({})
const loadingFlowNodes = ref(false)

const selectedFlowId = ref('')
const fromNodeId = ref('')
const endAtNodeId = ref('')

const selectedFlow = computed(() =>
  workflows.value.find((f) => f.id === selectedFlowId.value)
)

const flowNodes = computed(() => flowDetailsCache.value[selectedFlowId.value] || [])

// Fetch nodes for a given flow and cache them
async function fetchFlowNodes(flowId: string) {
  if (!flowId || flowDetailsCache.value[flowId]) return
  loadingFlowNodes.value = true
  try {
    const res = await apiClient.get<{ data: FlowDetail }>(`/flow/id/${flowId}`)
    const flowData = res.data.data
    const nodes = (flowData.view_flow?.nodes || []).map((n) => ({
      id: n.id,
      label: n.data?.title || n.id,
    }))
    flowDetailsCache.value[flowId] = nodes
  } catch (err) {
    console.error('Failed to fetch flow nodes:', err)
  } finally {
    loadingFlowNodes.value = false
  }
}

// Watch selected flow and fetch its nodes
watch(
  selectedFlowId,
  (flowId) => {
    if (flowId) {
      fetchFlowNodes(flowId)
    }
  },
  { immediate: false }
)

// Sync from node data whenever the node changes
watch(
  () => props.node,
  async (node) => {
    if (node?.data) {
      const goto = node.data.goto as GotoData | undefined
      const flowId = goto?.flowId || ''
      selectedFlowId.value = flowId
      fromNodeId.value = goto?.from_nodeId || ''
      endAtNodeId.value = goto?.end_nodeId || ''
      // Pre-fetch nodes for the existing flowId so dropdowns are populated
      if (flowId) {
        await fetchFlowNodes(flowId)
      }
    }
  },
  { immediate: true }
)

function saveAndClose() {
  if (props.node) {
    const flowId = selectedFlowId.value.trim()
    if (flowId) {
      const flowTitle = selectedFlow.value?.title || ''
      const fromNodeTitle = flowNodes.value.find((n) => n.id === fromNodeId.value)?.label || ''
      const endNodeTitle = flowNodes.value.find((n) => n.id === endAtNodeId.value)?.label || ''
      props.node.data.goto = {
        flowId,
        flowTitle,
        from_nodeId: fromNodeId.value.trim() || '',
        from_nodeTitle: fromNodeTitle,
        end_nodeId: endAtNodeId.value.trim() || '',
        end_nodeTitle: endNodeTitle,
      }
    } else {
      props.node.data.goto = undefined
    }
  }
  showDrawer.value = false
}

function onFlowChange() {
  // Reset node selections when workflow changes
  fromNodeId.value = ''
  endAtNodeId.value = ''
}
</script>

<template>
  <transition name="goto-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="goto-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 17L17 7"/>
              <path d="M7 7h10v10"/>
            </svg>
            <span>Goto Node</span>
          </div>
          <button class="drawer-close" @click="saveAndClose" aria-label="Close drawer">×</button>
        </div>

        <div class="drawer-body">
          <div v-if="node" class="drawer-subtitle">
            <strong>{{ node.data?.title }}</strong>
          </div>

          <!-- Workflow selector -->
          <div class="field-group">
            <label class="field-label">
              Workflow
              <span class="help-text">Select a workflow / flow diagram to jump into</span>
            </label>
            <select v-model="selectedFlowId" class="field-input" @change="onFlowChange" :disabled="flowsLoading">
              <option value="" disabled>-- Select workflow --</option>
              <option v-for="flow in workflows" :key="flow.id" :value="flow.id">
                {{ flow.title }}
              </option>
            </select>
            <div v-if="flowsLoading" class="field-hint">Loading workflows…</div>
            <div v-else-if="flowsError" class="field-hint error">Failed to load workflows.</div>
          </div>

          <!-- From node selector -->
          <div class="field-group">
            <label class="field-label">
              From
              <span class="help-text">Start node in the selected workflow</span>
            </label>
            <select v-model="fromNodeId" class="field-input" :disabled="!selectedFlowId || loadingFlowNodes || flowNodes.length === 0">
              <option value="" disabled>-- Select start node --</option>
              <option v-for="n in flowNodes" :key="n.id" :value="n.id">
                {{ n.label }}
              </option>
            </select>
            <div v-if="loadingFlowNodes" class="field-hint">Loading nodes…</div>
          </div>

          <!-- EndAt node selector -->
          <div class="field-group">
            <label class="field-label">
              EndAt
              <span class="help-text">End node in the selected workflow</span>
            </label>
            <select v-model="endAtNodeId" class="field-input" :disabled="!selectedFlowId || loadingFlowNodes || flowNodes.length === 0">
              <option value="" disabled>-- Select end node --</option>
              <option v-for="n in flowNodes" :key="n.id" :value="n.id">
                {{ n.label }}
              </option>
            </select>
            <div v-if="loadingFlowNodes" class="field-hint">Loading nodes…</div>
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

.goto-drawer {
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
  color: var(--goto-accent, #f59e0b);
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
  background: var(--goto-accent-bg, rgba(245, 158, 11, 0.1));
  color: var(--goto-accent, #f59e0b);
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
  color: var(--goto-accent, #f59e0b);
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
  border-color: var(--goto-accent, #f59e0b);
  box-shadow: 0 0 0 2px var(--goto-accent-bg, rgba(245, 158, 11, 0.2));
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--border, #e5e4e7);
}

.field-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.6;
}

.field-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text, #6b6375);
}

.field-hint.error {
  color: #dc3545;
}

@media (max-width: 640px) {
  .goto-drawer {
    width: 100%;
  }
}

/* Drawer fade transition */
.goto-drawer-fade-enter-active,
.goto-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.goto-drawer-fade-enter-from,
.goto-drawer-fade-leave-to {
  opacity: 0;
}

.goto-drawer-fade-enter-active .goto-drawer,
.goto-drawer-fade-leave-active .goto-drawer {
  transition: transform 0.3s ease;
}

.goto-drawer-fade-enter-from .goto-drawer,
.goto-drawer-fade-leave-to .goto-drawer {
  transform: translateX(100%);
}
</style>
