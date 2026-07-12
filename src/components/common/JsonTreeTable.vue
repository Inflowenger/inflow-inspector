<script setup lang="ts">
import { ref } from 'vue'

interface TreeNodeProps {
  field: string
  value: unknown
  depth?: number
  path?: string
}

const props = withDefaults(defineProps<TreeNodeProps>(), {
  depth: 0,
  path: '',
})

const isExpanded = ref(true)

function getValueType(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function isExpandable(v: unknown): boolean {
  const t = getValueType(v)
  return t === 'object' || t === 'array'
}

function getPreview(v: unknown): string {
  const t = getValueType(v)
  if (t === 'null') return 'null'
  if (t === 'array') return `Array[${(v as unknown[]).length}]`
  if (t === 'object') {
    const keys = Object.keys(v as object)
    return `{${keys.length} field${keys.length === 1 ? '' : 's'}}`
  }
  return String(v)
}

function toggleExpand() {
  if (isExpandable(props.value)) {
    isExpanded.value = !isExpanded.value
  }
}

function typeColor(t: string): string {
  switch (t) {
    case 'string': return '#28a745'
    case 'number': return '#e83e8c'
    case 'boolean': return '#007bff'
    case 'null': return '#6c757d'
    case 'array': return '#fd7e14'
    case 'object': return '#6f42c1'
    default: return '#6b6375'
  }
}

function formatValue(v: unknown): string {
  const t = getValueType(v)
  if (t === 'string') return `"${v}"`
  if (t === 'null') return 'null'
  if (t === 'boolean') return String(v)
  if (t === 'number') return String(v)
  return getPreview(v)
}

const type = getValueType(props.value)
</script>

<template>
  <div class="tree-node" :style="{ '--depth': depth }">
    <div class="node-row" :class="{ expandable: isExpandable(value) }" @click="toggleExpand">
      <span class="indent-spacer" />
      <span v-if="isExpandable(value)" class="expand-icon" :class="{ collapsed: !isExpanded }">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <span v-else class="expand-icon placeholder" />

      <span class="field-name">{{ field }}</span>
      <span class="field-sep">:</span>

      <template v-if="!isExpandable(value)">
        <span class="field-value" :style="{ color: typeColor(type) }">{{ formatValue(value) }}</span>
      </template>
      <template v-else>
        <span class="field-preview">{{ getPreview(value) }}</span>
      </template>

      <span class="type-badge" :style="{ backgroundColor: typeColor(type) + '18', color: typeColor(type) }">
        {{ type }}
      </span>
    </div>

    <div v-if="isExpandable(value) && isExpanded" class="node-children">
      <template v-if="Array.isArray(value)">
        <JsonTreeTable
          v-for="(item, index) in value"
          :key="index"
          :field="String(index)"
          :value="item"
          :depth="depth + 1"
          :path="`${path}.${field}[${index}]`"
        />
      </template>
      <template v-else>
        <JsonTreeTable
          v-for="[k, v] in Object.entries(value as Record<string, unknown>)"
          :key="k"
          :field="k"
          :value="v"
          :depth="depth + 1"
          :path="`${path}.${field}.${k}`"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.1s;
  cursor: default;
}

.node-row.expandable {
  cursor: pointer;
}

.node-row:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
}

.indent-spacer {
  display: inline-block;
  width: calc(var(--depth, 0) * 16px);
  flex-shrink: 0;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text, #6b6375);
}

.expand-icon svg {
  transition: transform 0.15s;
}

.expand-icon.collapsed svg {
  transform: rotate(0deg);
}

.expand-icon:not(.collapsed) svg {
  transform: rotate(90deg);
}

.expand-icon.placeholder {
  opacity: 0;
}

.field-name {
  color: #d946ef;
  font-weight: 500;
}

.field-sep {
  color: var(--text, #6b6375);
  margin-right: 2px;
}

.field-value {
  word-break: break-all;
}

.field-preview {
  color: var(--text, #6b6375);
  font-style: italic;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: lowercase;
  margin-left: auto;
  flex-shrink: 0;
}

.node-children {
  display: flex;
  flex-direction: column;
}
</style>
