<script setup lang="ts">
import { ref, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  id?: string
  data: {
    title: string
    goto?: {
      flowId: string
      flowTitle?: string
      from_nodeId: string
      from_nodeTitle?: string
      end_nodeId: string
      end_nodeTitle?: string
    }
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'open-goto-settings'): void }>()

// Title editing state
const isEditingTitle = ref(false)
const titleValue = ref(props.data.title || '')
const titleInputRef = ref<HTMLInputElement | null>(null)

const hasGoto = computed(() =>
  !!(props.data.goto?.flowId || props.data.goto?.from_nodeId || props.data.goto?.end_nodeId)
)

function openGotoSettings() {
  emit('open-goto-settings')
}

function saveTitle() {
  const newLabel = titleValue.value.trim() || 'Untitled'
  props.data.title = newLabel
  isEditingTitle.value = false
}

function onTitleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') saveTitle()
  else if (event.key === 'Escape') {
    titleValue.value = props.data.title || ''
    isEditingTitle.value = false
  }
}

function startTitleEdit() {
  titleValue.value = props.data.title || ''
  isEditingTitle.value = true
  requestAnimationFrame(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
</script>

<template>
  <div class="goto-node" :class="{ 'has-goto': hasGoto }">
    <!-- Input handle on the left -->
    <Handle
      id="input"
      type="target"
      :position="Position.Left"
      class="custom-handle input-handle"
    />

    <!-- Top-right action button -->
    <div class="node-actions">
      <button
        class="action-btn"
        :class="{ active: hasGoto }"
        title="Open Goto settings"
        @click.stop="openGotoSettings"
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M7 17L17 7"/>
          <path d="M7 7h10v10"/>
        </svg>
      </button>
    </div>

    <!-- Node title (inline editable) -->
    <div class="node-title" @click.stop="startTitleEdit">
      <template v-if="isEditingTitle">
        <input
          ref="titleInputRef"
          v-model="titleValue"
          @keydown="onTitleKeyDown"
          @blur="saveTitle"
          @click.stop
          placeholder="Node title"
          class="title-edit-input"
        />
      </template>
      <template v-else>
        {{ data.title }}
      </template>
    </div>

    <!-- Goto info preview -->
    <div v-if="hasGoto" class="goto-preview">
      <div v-if="data.goto?.flowId" class="goto-row">
        <span class="goto-label">Flow:</span>
        <span class="goto-value">{{ data.goto.flowTitle || data.goto.flowId }}</span>
      </div>
      <div v-if="data.goto?.from_nodeId" class="goto-row">
        <span class="goto-label">From:</span>
        <span class="goto-value">{{ data.goto.from_nodeTitle || data.goto.from_nodeId }}</span>
      </div>
      <div v-if="data.goto?.end_nodeId" class="goto-row">
        <span class="goto-label">EndAt:</span>
        <span class="goto-value">{{ data.goto.end_nodeTitle || data.goto.end_nodeId }}</span>
      </div>
    </div>

    <!-- Output handle on the right -->
    <Handle
      id="output"
      type="source"
      :position="Position.Right"
      class="custom-handle output-handle"
    />
  </div>
</template>

<style scoped>
.goto-node {
  position: relative;
  font-size: 14px;
  padding: 44px 20px 16px;
  --node-rgb: 99, 102, 241;
  --accent: rgb(var(--node-rgb));
  --accent-bg: rgba(var(--node-rgb), 0.12);
  --accent-border: rgba(var(--node-rgb), 0.5);
  border-radius: 26px;
  border: 2px solid var(--goto-border, rgba(245, 158, 11, 0.5));
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.1) 0 10px 15px -3px),
    inset 0 1.5px 1px rgba(255, 255, 255, 0.4),
    inset 0 -8px 14px rgba(var(--node-rgb), 0.06);
  background-image: linear-gradient(160deg, rgba(var(--node-rgb), 0.09), rgba(var(--node-rgb), 0) 55%);
  min-width: 140px;
  min-height: 90px;
  text-align: center;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.goto-node:hover {
  border-color: var(--goto-accent, #f59e0b);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.18) 0 14px 22px -3px),
    inset 0 1.5px 1px rgba(255, 255, 255, 0.5),
    inset 0 -8px 14px rgba(var(--node-rgb), 0.1);
}

.goto-node.has-goto {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.goto-node.has-goto:hover {
  border-color: #d97706;
}

/* Action buttons - top right */
.node-actions {
  position: absolute;
  top: 6px;
  right: 16px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.goto-node:hover .node-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--goto-accent-bg, rgba(245, 158, 11, 0.1));
  color: var(--goto-accent, #f59e0b);
  border-color: var(--goto-accent, #f59e0b);
}

.action-btn.active {
  background: var(--goto-accent, #f59e0b);
  color: #fff;
  border-color: var(--goto-accent, #f59e0b);
}

/* Node title */
.node-title {
  position: absolute;
  top: 22px;
  left: 0;
  right: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  cursor: text;
  transition: background 0.15s;
}
.node-title:hover {
  background: var(--goto-accent-bg, rgba(245, 158, 11, 0.05));
  color: var(--goto-accent, #f59e0b);
}

/* Inline title edit input */
.title-edit-input {
  width: 100%;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--goto-accent, #f59e0b);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  text-align: left;
  outline: none;
  box-shadow: 0 0 0 2px var(--goto-accent-bg, rgba(245, 158, 11, 0.2));
  box-sizing: border-box;
}

/* Goto preview */
.goto-preview {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.goto-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
}

.goto-label {
  font-weight: 600;
  color: var(--goto-accent, #f59e0b);
}

.goto-value {
  color: var(--text, #6b6375);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Custom handle styles - pill shaped */
:deep(.custom-handle) {
  width: 8px;
  height: 16px;
  border: 2px solid var(--goto-accent, #f59e0b);
  background: var(--bg, #fff);
  border-radius: 4px;
  transition: all 0.2s;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.custom-handle:hover) {
  background: var(--goto-accent, #f59e0b);
  box-shadow: 0 0 0 3px var(--goto-accent-bg, rgba(245, 158, 11, 0.2));
  border-color: var(--goto-accent, #f59e0b);
}

/* Input handle (left side) - centered vertically */
:deep(.input-handle) {
  left: -6px;
  border-radius: 0 4px 4px 0;
}

/* Output handle (right side) - centered vertically */
:deep(.output-handle) {
  right: -6px;
  border-radius: 4px 0 0 4px;
}

/* When connecting */
:deep(.custom-handle.connecting) {
  background: var(--goto-accent, #f59e0b);
  box-shadow: 0 0 0 4px var(--goto-accent-bg, rgba(245, 158, 11, 0.3));
}

/* Valid connection target */
:deep(.custom-handle.valid) {
  background: #10b981;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}
</style>
