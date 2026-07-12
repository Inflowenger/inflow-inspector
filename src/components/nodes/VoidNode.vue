<script setup lang="ts">
import { ref, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  id?: string
  data: {
    title: string
    description?: string
  }
}

const props = defineProps<Props>()

// Title editing state
const isEditingTitle = ref(false)
const titleValue = ref(props.data.title || '')
const titleInputRef = ref<HTMLInputElement | null>(null)

// Description editing state
const isEditingDescription = ref(false)
const descriptionValue = ref(props.data.description || '')
const descriptionRef = ref<HTMLTextAreaElement | null>(null)

const hasDescription = computed(() => !!props.data.description && props.data.description.trim().length > 0)

function saveTitle() {
  const newLabel = titleValue.value.trim() || 'Untitled'
  props.data.title = newLabel
  isEditingTitle.value = false
}

function saveDescription() {
  props.data.description = descriptionValue.value.trim() || undefined
  isEditingDescription.value = false
}

function onTitleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') saveTitle()
  else if (event.key === 'Escape') {
    titleValue.value = props.data.title || ''
    isEditingTitle.value = false
  }
}

function onDescriptionKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    descriptionValue.value = props.data.description || ''
    isEditingDescription.value = false
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

function startDescriptionEdit() {
  descriptionValue.value = props.data.description || ''
  isEditingDescription.value = true
  requestAnimationFrame(() => {
    descriptionRef.value?.focus()
  })
}

// Dimensions from node data (persisted)
const nodeWidth = computed(() => (props.data as any).width || 160)
const nodeHeight = computed(() => (props.data as any).height || 100)

// Resizing logic
const isResizing = ref(false)
let initialWidth = 0
let initialHeight = 0
let initialX = 0
let initialY = 0

function startResize(event: MouseEvent) {
  isResizing.value = true
  initialWidth = (event.target as HTMLElement).parentElement?.offsetWidth || 0
  initialHeight = (event.target as HTMLElement).parentElement?.offsetHeight || 0
  initialX = event.clientX
  initialY = event.clientY

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(event: MouseEvent) {
  if (!isResizing.value) return

  const dx = event.clientX - initialX
  const dy = event.clientY - initialY

  const newWidth = Math.max(160, initialWidth + dx)
  const newHeight = Math.max(100, initialHeight + dy)

  // Persist dimensions in node data
  ;(props.data as any).width = newWidth
  ;(props.data as any).height = newHeight
}

function onMouseUp() {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div class="void-node" :class="{ 'has-description': hasDescription }" :style="{ width: nodeWidth + 'px', height: nodeHeight + 'px' }">
    <!-- Input handle on the left -->
    <Handle
      id="input"
      type="target"
      :position="Position.Left"
      class="custom-handle input-handle"
    />

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

    <!-- Description area -->
    <div class="node-description" @click.stop="startDescriptionEdit">
      <template v-if="isEditingDescription">
        <textarea
          ref="descriptionRef"
          v-model="descriptionValue"
          @keydown="onDescriptionKeyDown"
          @blur="saveDescription"
          @click.stop
          placeholder="Add description..."
          class="description-edit-input"
          rows="3"
        />
      </template>
      <template v-else>
        <span v-if="hasDescription" class="description-text">{{ data.description }}</span>
        <span v-else class="description-placeholder">Add description...</span>
      </template>
    </div>

    <!-- Slot for child nodes -->
    <div class="node-content">
      <slot></slot>
    </div>

    <!-- Resize handle -->
    <div class="resize-handle" @mousedown.stop="startResize"></div>
  </div>
</template>

<style scoped>
.void-node {
  position: relative;
  font-size: 14px;
  padding: 24px 16px 12px 16px;
  border-radius: 8px;
  border: 2px solid var(--void-border, rgba(107, 114, 128, 0.5));
  background: var(--void-bg, rgba(243, 244, 246, 0.8));
  color: var(--text-h, #08060d);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.1) 0 10px 15px -3px);
  min-width: 160px;
  min-height: 100px; /* Added min-height for resizable nodes */
  text-align: center;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.void-node:hover {
  border-color: var(--void-accent, #6b7280);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.15) 0 12px 20px -3px);
}

.void-node.has-description {
  border-color: var(--void-accent, #6b7280);
  box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.1);
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
  background: var(--void-accent-bg, rgba(107, 114, 128, 0.05));
  color: var(--void-accent, #6b7280);
}

/* Inline title edit input */
.title-edit-input {
  width: 100%;
  height: 15px;
  padding: 0 4px;
  border: 1px solid var(--void-accent, #6b7280);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 8px;
  font-weight: 300;
  font-family: inherit;
  line-height: 1;
  outline: none;
  box-shadow: 0 0 0 2px var(--void-accent-bg, rgba(107, 114, 128, 0.2));
  box-sizing: border-box;
}

/* Description area */
.node-description {
  margin-top: 4px;
  cursor: text;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.description-text {
  font-size: 11px;
  color: var(--text, #374151);
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.description-placeholder {
  font-size: 11px;
  color: var(--text, #9ca3af);
  font-style: italic;
}

.node-description:hover .description-placeholder {
  color: var(--void-accent, #6b7280);
}

/* Description textarea */
.description-edit-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid var(--void-accent, #6b7280);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 11px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  box-shadow: 0 0 0 2px var(--void-accent-bg, rgba(107, 114, 128, 0.2));
  box-sizing: border-box;
  line-height: 1.4;
}

.description-edit-input::placeholder {
  color: var(--text, #9ca3af);
  opacity: 0.7;
}

/* Custom handle styles - pill shaped */
:deep(.custom-handle) {
  width: 8px;
  height: 16px;
  border: 2px solid var(--void-accent, #6b7280);
  background: var(--bg, #fff);
  border-radius: 4px;
  transition: all 0.2s;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.custom-handle:hover) {
  background: var(--void-accent, #6b7280);
  box-shadow: 0 0 0 3px var(--void-accent-bg, rgba(107, 114, 128, 0.2));
  border-color: var(--void-accent, #6b7280);
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

.node-content {
  margin-top: 10px;
  padding: 10px;
  border-top: 1px solid var(--void-border, rgba(107, 114, 128, 0.3));
  width: 100%;
  box-sizing: border-box;
}

/* When connecting */
:deep(.custom-handle.connecting) {
  background: var(--void-accent, #6b7280);
  box-shadow: 0 0 0 4px var(--void-accent-bg, rgba(107, 114, 128, 0.3));
}

/* Valid connection target */
:deep(.custom-handle.valid) {
  background: #10b981;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: var(--void-accent, #6b7280);
  border-radius: 0 0 8px 0;
  cursor: se-resize;
  z-index: 10;
}
</style>
