<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  id?: string
  data: {
    title: string
    key?: string
    scope?: string
    subject_prefix?: string
    request?: string
    idle_min?: number
    body?: Record<string, any>
    infra_isolated?: {
      account?: string
    }
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'open-plugin-native-settings'): void }>()

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

const hasKey = computed(() => !!props.data.key)
const hasScope = computed(() => !!props.data.scope)
const hasSettings = computed(() =>
  !!props.data.subject_prefix ||
  !!props.data.request ||
  typeof props.data.idle_min === 'number' ||
  (props.data.body && Object.keys(props.data.body).length > 0) ||
  !!props.data.infra_isolated?.account
)

function openPluginNativeSettings() {
  emit('open-plugin-native-settings')
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

function openKey() {
  keyValue.value = props.data.key || ''
  showScopeInput.value = false
  showKeyInput.value = true
}

function openScope() {
  scopeValue.value = props.data.scope || ''
  showKeyInput.value = false
  showScopeInput.value = true
}

function closeAllPopups() {
  showKeyInput.value = false
  showScopeInput.value = false
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
</script>

<template>
  <div class="custom-node" :class="{ 'has-meta': hasKey || hasScope, 'has-settings': hasSettings }">
    <!-- Input handle on the left -->
    <Handle
      id="input"
      type="target"
      :position="Position.Left"
      class="custom-handle input-handle"
    />

    <!-- Top-right action buttons -->
    <div class="node-actions">
      <!-- Settings button -->
      <button
        class="action-btn"
        :class="{ active: hasSettings }"
        title="Open plugin native settings"
        @click.stop="openPluginNativeSettings"
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>
          <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/>
        </svg>
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
.custom-node {
  position: relative;
  font-size: 14px;
  padding: 44px 20px 16px;
  --node-rgb: 244, 63, 94;
  --accent: rgb(var(--node-rgb));
  --accent-bg: rgba(var(--node-rgb), 0.12);
  --accent-border: rgba(var(--node-rgb), 0.5);
  border-radius: 26px;
  border: 2px solid var(--accent-border, rgba(var(--node-rgb), 0.5));
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

.custom-node:hover {
  border-color: var(--accent, #aa3bff);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.18) 0 14px 22px -3px),
    inset 0 1.5px 1px rgba(255, 255, 255, 0.5),
    inset 0 -8px 14px rgba(var(--node-rgb), 0.1);
}

.custom-node.has-settings {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
}

.custom-node.has-settings:hover {
  border-color: #059669;
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
  background: var(--accent-bg, rgba(var(--node-rgb), 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

.action-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
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
  background: var(--accent-bg, rgba(var(--node-rgb), 0.05));
  color: var(--accent, #aa3bff);
}

/* Inline title edit input */
.title-edit-input {
  width: 100%;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--accent, #aa3bff);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  text-align: left;
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(var(--node-rgb), 0.2));
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
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(var(--node-rgb), 0.2));
}

.popup-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.7;
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
  box-shadow: 0 2px 6px rgba(var(--node-rgb), 0.3);
}

/* Custom handle styles - pill shaped */
:deep(.custom-handle) {
  width: 8px;
  height: 16px;
  border: 2px solid var(--accent, #aa3bff);
  background: var(--bg, #fff);
  border-radius: 4px;
  transition: all 0.2s;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.custom-handle:hover) {
  background: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(var(--node-rgb), 0.2));
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

/* When connecting */
:deep(.custom-handle.connecting) {
  background: var(--accent, #aa3bff);
  box-shadow: 0 0 0 4px var(--accent-bg, rgba(var(--node-rgb), 0.3));
}

/* Valid connection target */
:deep(.custom-handle.valid) {
  background: #10b981;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}
</style>
