<script setup lang="ts">
import { ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  data: {
    title: string
  }
}

const props = defineProps<Props>()

// Title editing state
const isEditingTitle = ref(false)
const titleValue = ref(props.data.title || '')
const titleInputRef = ref<HTMLInputElement | null>(null)

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
  <div class="start-node">
    <!-- Title centered in the circle -->
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

    <!-- Output handle on the right — outbound only -->
    <Handle
      id="output"
      type="source"
      :position="Position.Right"
      class="custom-handle output-handle"
    />
  </div>
</template>

<style scoped>
.start-node {
  position: relative;
  font-size: 14px;
  border-radius: 9999px; /* circle shape */
  border: 2px solid var(--accent-border, rgba(170, 59, 255, 0.5));
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.1) 0 10px 15px -3px);
  width: 72px;
  height: 56px;
  min-width: 72px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.start-node:hover {
  border-color: var(--accent, #aa3bff);
  box-shadow: var(--shadow, rgba(0, 0, 0, 0.15) 0 12px 20px -3px);
}

/* Node title — centered in circle */
.node-title {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 6px;
  font-size: 9px;
  font-weight: 500;
  cursor: text;
  text-align: center;
  line-height: 1.15;
}

/* Inline title edit input */
.title-edit-input {
  width: 80px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--accent, #aa3bff);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 9px;
  font-weight: 300;
  font-family: inherit;
  line-height: 1;
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
  box-sizing: border-box;
  text-align: center;
}

/* Custom handle styles — pill shaped */
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
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(170, 59, 255, 0.2));
  border-color: var(--accent, #aa3bff);
}

/* Output handle (right side) — centered vertically */
:deep(.output-handle) {
  right: -6px;
  border-radius: 4px 0 0 4px;
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
</style>
