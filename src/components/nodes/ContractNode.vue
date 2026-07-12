<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'

const { updateNodeInternals } = useVueFlow()

interface Condition {
  key: string
  value: string
}

interface Handler {
  id: string
  tags: string[]
  color: string
}

interface Props {
  id?: string
  data: {
    title: string
    key?: string
    scope?: string
    lang?: 'js' | 'opa'
    logic_rule?: string
    opa_result?: string
    conditions?: Condition[]
    handlers?: Handler[]
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'open-contract'): void
  (e: 'remove-handler', handlerId: string): void
}>()

// Initialize handlers array if not present
if (!props.data.handlers) {
  props.data.handlers = []
}

// Key popup state
const showKeyInput = ref(false)
const keyValue = ref(props.data.key || '')

// Scope popup state
const showScopeInput = ref(false)
const scopeValue = ref(props.data.scope || '')

// Title editing state
const isEditingTitle = ref(false)
const titleValue = ref(props.data.title || '')
const titleInputRef = ref<HTMLInputElement | null>(null)

// Handler popup state
const showHandlerPopup = ref(false)
const handlerTagsInput = ref('')
const handlerColor = ref('#aa3bff')

const hasKey = computed(() => !!props.data.key)
const hasScope = computed(() => !!props.data.scope)
const hasCode = computed(() => !!props.data.logic_rule && props.data.logic_rule.length > 0)
const hasConditions = computed(() => !!props.data.conditions && props.data.conditions.length > 0)
const hasHandlers = computed(() => !!props.data.handlers && props.data.handlers.length > 0)

const nodeMinHeight = computed(() => {
  const baseHeight = 60
  const handlerSpacing = 22
  const handlerCount = props.data.handlers?.length || 0
  return Math.max(baseHeight, baseHeight + handlerCount * handlerSpacing)
})

function getHandlerLeft(index: number, total: number): string {
  // Position handlers evenly from 20% to 80% of the node width
  const start = 20
  const end = 80
  if (total === 1) return '50%'
  const step = (end - start) / (total - 1)
  return `${start + step * index}%`
}

function openContract() {
  emit('open-contract')
}

function saveKey() {
  props.data.key = keyValue.value.trim() || undefined
  showKeyInput.value = false
}

function saveScope() {
  props.data.scope = scopeValue.value.trim() || undefined
  showScopeInput.value = false
}

function saveTitle() {
  const newLabel = titleValue.value.trim() || 'Untitled'
  props.data.title = newLabel
  // Mirror the key to the new title so they stay in sync
  props.data.key = newLabel
  isEditingTitle.value = false
}

function onKeyKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') saveKey()
  else if (event.key === 'Escape') {
    keyValue.value = props.data.key || ''
    showKeyInput.value = false
  }
}

function onScopeKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') saveScope()
  else if (event.key === 'Escape') {
    scopeValue.value = props.data.scope || ''
    showScopeInput.value = false
  }
}

function onTitleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') saveTitle()
  else if (event.key === 'Escape') {
    titleValue.value = props.data.title || ''
    isEditingTitle.value = false
  }
}

function onHandlerKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') addHandler()
  else if (event.key === 'Escape') {
    handlerTagsInput.value = ''
    handlerColor.value = '#aa3bff'
    showHandlerPopup.value = false
  }
}

function openKey() {
  keyValue.value = props.data.key || ''
  showScopeInput.value = false
  showHandlerPopup.value = false
  showKeyInput.value = true
}

function openScope() {
  scopeValue.value = props.data.scope || ''
  showKeyInput.value = false
  showHandlerPopup.value = false
  showScopeInput.value = true
}

function closeAllPopups() {
  showKeyInput.value = false
  showScopeInput.value = false
  showHandlerPopup.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const popup = document.querySelector('.node-popup') as HTMLElement | null
  if (popup && !popup.contains(target)) {
    closeAllPopups()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

function startTitleEdit() {
  titleValue.value = props.data.title || ''
  isEditingTitle.value = true
  requestAnimationFrame(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function addHandler() {
  const tags = handlerTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)

  const handlerId = `handler-${Date.now()}`

  if (!props.data.handlers) {
    props.data.handlers = []
  }

  // Create a new array reference to ensure Vue reactivity triggers
  props.data.handlers = [
    ...props.data.handlers,
    { id: handlerId, tags, color: handlerColor.value }
  ]

  handlerTagsInput.value = ''
  handlerColor.value = '#aa3bff'
  showHandlerPopup.value = false
}

function removeHandler(handlerId: string) {
  if (props.data.handlers) {
    // Create a new array reference to ensure Vue reactivity triggers
    props.data.handlers = props.data.handlers.filter(h => h.id !== handlerId)
  }
  emit('remove-handler', handlerId)
}

// Watch handlers array and update node internals so Vue Flow
// recalculates handle positions for newly added/removed handlers.
// This ensures edges drawn from new handlers source correctly.
// We wait for the browser layout to settle (node resizing, handle
// positioning) before recalculating handle bounds.
watch(
  () => props.data.handlers?.length,
  () => {
    if (!props.id) return
    // Wait one full frame for Vue to render, then an extra tick
    // for getBoundingClientRect to reflect the new layout.
    requestAnimationFrame(() => {
      setTimeout(() => {
        updateNodeInternals([props.id!])
      }, 50)
    })
  },
  { immediate: true }
)
</script>

<template>
  <div class="custom-node contract-node"
    :class="{ 'has-meta': hasKey || hasScope, 'has-code': hasCode, 'has-conditions': hasConditions, 'has-handlers': hasHandlers }"
    :style="{ minHeight: nodeMinHeight + 'px' }">
    <!-- Input handle on the left -->
    <Handle
      id="input"
      type="target"
      :position="Position.Left"
      class="custom-handle input-handle"
    />

    <!-- Top-right action buttons -->
    <div class="node-actions">
      <!-- Contract / Code button -->
      <button
        class="action-btn"
        :class="{ active: hasCode || hasConditions }"
        title="Open contract editor"
        @click.stop="openContract"
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </button>

      <!-- Condition count badge pill -->
      <button
        v-if="hasConditions"
        class="action-btn condition-badge"
        :title="props.data.conditions!.length + ' condition(s) defined'"
        @click.stop="openContract"
      >
        <span class="condition-count">{{ props.data.conditions!.length }}</span>
      </button>

      <!-- Key button -->
      <button
        class="action-btn"
        :class="{ active: hasKey }"
        :title="hasKey ? 'Key: ' + data.key : 'Set result key'"
        @click.stop="openKey"
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
      </button>

      <!-- Scope button -->
      <button
        class="action-btn"
        :class="{ active: hasScope }"
        :title="hasScope ? 'Scope: ' + data.scope : 'Set scope (JSONPath)'"
        @click.stop="openScope"
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M3 7l5 5-5 5M11 17h10"/>
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

    <!-- Key input popup -->
    <div v-if="showKeyInput" class="node-popup" @click.stop>
      <input
        v-model="keyValue"
        @keydown="onKeyKeyDown"
        placeholder="Result key"
        class="popup-input"
        autofocus
      />
      <button class="popup-btn update" @click.stop="saveKey">Update</button>
    </div>

    <!-- Scope input popup -->
    <div v-if="showScopeInput" class="node-popup" @click.stop>
      <input
        v-model="scopeValue"
        @keydown="onScopeKeyDown"
        placeholder="JSONPath scope"
        class="popup-input"
        autofocus
      />
      <button class="popup-btn update" @click.stop="saveScope">Update</button>
    </div>

    <!-- Handler configuration popup -->
    <div v-if="showHandlerPopup" class="node-popup handler-popup" @click.stop>
      <input
        v-model="handlerTagsInput"
        @keydown="onHandlerKeyDown"
        placeholder="tag1, tag2, ..."
        class="popup-input"
        autofocus
      />
      <input
        type="color"
        v-model="handlerColor"
        class="popup-color-picker"
        title="Handler color"
      />
      <button class="popup-btn update" @click.stop="addHandler">Add</button>
    </div>

    <!-- Default output handle on the right -->
    <!-- <Handle
      id="output"
      type="source"
      :position="Position.Right"
      class="custom-handle output-handle"
    /> -->

    <!-- Dynamic handler output handles at the bottom -->
    <template v-if="data.handlers">
      <Handle
        v-for="(handler, index) in data.handlers"
        :key="handler.id"
        :id="handler.id"
        type="source"
        :position="Position.Bottom"
        class="custom-handle handler-handle"
        :style="{
          backgroundColor: handler.color,
          borderColor: handler.color,
          left: getHandlerLeft(index, data.handlers!.length)
        }"
        :title="handler.tags.length > 0 ? handler.tags.join(', ') : 'No tags'"
      />
      <!-- Handler remove buttons -->
      <button
        v-for="(handler, index) in data.handlers"
        :key="`remove-${handler.id}`"
        class="handler-remove-btn"
        :style="{ left: getHandlerLeft(index, data.handlers!.length) }"
        @click.stop="removeHandler(handler.id)"
        title="Remove handler"
      >
        ×
      </button>
    </template>

    <!-- Add handler button at bottom-right -->
    <button
      class="add-handler-btn"
      :class="{ active: hasHandlers }"
      title="Add output handler"
      @click.stop="showHandlerPopup = !showHandlerPopup"
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.custom-node {
  position: relative;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: 8px;
  border: 2px solid var(--accent-border, rgba(170, 59, 255, 0.5));
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.1) 0 10px 15px -3px);
  min-width: 140px;
  text-align: center;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.custom-node:hover {
  border-color: var(--accent, #aa3bff);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.15) 0 12px 20px -3px);
}

.custom-node.has-code {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px rgba(170,59,255,0.1);
}

.custom-node.has-conditions {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
}

.custom-node.has-code.has-conditions {
  border-color: #d946ef;
  box-shadow: 0 0 0 2px rgba(217, 70, 239, 0.15);
}

.custom-node.has-handlers {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.custom-node.has-handlers:hover {
  border-color: #2563eb;
}

/* Action buttons - top right */
.node-actions {
  position: absolute;
  top: 3px;
  right: 4px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.custom-node:hover .node-actions {
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
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

.action-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
}

.condition-badge {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
  width: auto;
  min-width: 13px;
  padding: 0 3px;
}

.condition-badge:hover {
  background: #d97706;
  border-color: #d97706;
}

.condition-count {
  font-size: 7px;
  font-weight: 700;
}

/* Node title */
.node-title {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 18px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  font-size: 8px;
  font-weight: 300;
  cursor: text;
  border-radius: 4px 4px 0 0;
  transition: background 0.15s;
}
.node-title:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  color: var(--accent, #aa3bff);
}

/* Inline title edit input */
.title-edit-input {
  width: 100%;
  height: 15px;
  padding: 0 4px;
  border: 1px solid var(--accent, #aa3bff);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 8px;
  font-weight: 300;
  font-family: inherit;
  line-height: 1;
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
  box-sizing: border-box;
}

/* Popup */
.node-popup {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
}

.handler-popup {
  top: auto;
  bottom: calc(100% + 4px);
}

.popup-input {
  width: 100px;
  padding: 4px 6px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 10px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.popup-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.popup-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.7;
}

.popup-color-picker {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.popup-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.popup-btn.update {
  border: 1px solid var(--accent, #aa3bff);
  background: var(--accent, #aa3bff);
  color: #fff;
}

.popup-btn.update:hover {
  background: #9333ea;
  border-color: #9333ea;
  box-shadow: 0 2px 6px rgba(170, 59, 255, 0.3);
}

/* Custom handle styles - pill shaped */
:deep(.custom-handle) {
  width: 8px;
  height: 16px;
  border: 2px solid var(--accent, #aa3bff);
  background: var(--bg, #fff);
  border-radius: 4px;
  /* Only transition visual properties, NEVER position/layout properties.
     Animating left/top/transform causes getBoundingClientRect() to return
     intermediate values while Vue Flow is computing handle bounds. */
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.custom-handle:hover) {
  background: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(170, 59, 255, 0.2));
  border-color: var(--accent, #aa3bff);
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

/* Handler handle - circular, at bottom */
:deep(.handler-handle) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  bottom: -6px;
  top: auto;
  transform: translateX(-50%);
  /* Keep the hover scale effect animated without animating left/top */
  transition: transform 0.2s, box-shadow 0.2s;
}

:deep(.handler-handle:hover) {
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
  transform: translateX(-50%) scale(1.25);
}

/* When connecting */
:deep(.custom-handle.connecting) {
  background: var(--accent, #aa3bff);
  box-shadow: 0 0 0 4px var(--accent-bg, rgba(170, 59, 255, 0.3));
}

/* Valid connection target */
:deep(.custom-handle.valid) {
  background: #10b981;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}

/* Handler remove button */
.handler-remove-btn {
  position: absolute;
  bottom: 10px;
  transform: translateX(-50%);
  width: 11px;
  height: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #ef4444;
  color: #fff;
  border-radius: 50%;
  font-size: 8px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 0;
  line-height: 1;
  z-index: 10;
}

.custom-node:hover .handler-remove-btn {
  opacity: 1;
}

.handler-remove-btn:hover {
  background: #dc2626;
}

/* Add handler button - bottom right */
.add-handler-btn {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
  opacity: 0;
  z-index: 10;
}

.custom-node:hover .add-handler-btn {
  opacity: 1;
}

.add-handler-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

.add-handler-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
}
</style>
