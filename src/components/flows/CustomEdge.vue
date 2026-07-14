<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const showTagInput = ref(false)
const newTag = ref('')
const tags = ref<string[]>(props.data?.tags || [])

// Track editing state
const editingIndex = ref<number | null>(null)
const editValue = ref('')

// Calculate edge path + on-path label anchor based on type from data.
// The path helpers return [path, labelX, labelY] where labelX/labelY sit on
// the real curve — so the label stays glued to the edge no matter how nodes
// are dragged (linear interpolation would drift off curved edges).
const edgeGeometry = computed(() => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props
  const edgeType = props.data?.edgeType || 'default'

  if (edgeType === 'straight') {
    return getStraightPath({ sourceX, sourceY, targetX, targetY })
  } else if (edgeType === 'step' || edgeType === 'smoothstep') {
    return getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  } else {
    // default - bezier curve
    return getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  }
})

const edgePath = computed(() => edgeGeometry.value[0])

// Label anchor on the actual edge path (helper returns [path, labelX, labelY])
const labelPosition = computed(() => ({
  x: edgeGeometry.value[1],
  y: edgeGeometry.value[2],
}))

function addTag() {
  if (newTag.value.trim()) {
    tags.value.push(newTag.value.trim())
    if (props.data) {
      props.data.tags = tags.value
    }
    newTag.value = ''
    showTagInput.value = false
  }
}

function removeTag(index: number) {
  tags.value.splice(index, 1)
  if (props.data) {
    props.data.tags = tags.value
  }
}

function startEditing(index: number) {
  editingIndex.value = index
  editValue.value = tags.value[index]
}

function saveEdit() {
  if (editingIndex.value !== null && editValue.value.trim()) {
    tags.value[editingIndex.value] = editValue.value.trim()
    if (props.data) {
      props.data.tags = tags.value
    }
  }
  editingIndex.value = null
  editValue.value = ''
}

function cancelEdit() {
  editingIndex.value = null
  editValue.value = ''
}

function onNewTagKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  } else if (event.key === 'Escape') {
    showTagInput.value = false
    newTag.value = ''
  }
}

function onEditKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEdit()
  } else if (event.key === 'Escape') {
    cancelEdit()
  }
}
</script>

<template>
  <g class="custom-edge">
    <!-- The edge path -->
    <BaseEdge
      :id="id"
      :path="edgePath"
      :marker-end="markerEnd"
      :style="style"
    />

    <!-- Edge Label Renderer for tags and add button -->
    <EdgeLabelRenderer>
      <div
        :style="{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
          pointerEvents: 'all',
        }"
        class="edge-label-container"
      >
        <!-- Tags displayed as a tiny vertical list -->
        <div v-if="tags.length > 0" class="tags-list">
          <div
            v-for="(tag, index) in tags"
            :key="index"
            class="tag-item"
            @click.self="startEditing(index)"
          >
            <!-- View mode -->
            <template v-if="editingIndex !== index">
              <span class="tag-text" @click="startEditing(index)">{{ tag }}</span>
              <button class="tag-action remove" @click.stop="removeTag(index)" title="Remove tag">−</button>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <input
                v-model="editValue"
                @keydown="onEditKeyDown"
                @blur="saveEdit"
                class="tag-input"
                autofocus
              />
            </template>
          </div>
        </div>

        <!-- Add tag button (shows on hover) -->
        <button
          v-if="!showTagInput"
          @click="showTagInput = true"
          class="add-tag-btn"
          title="Add tag"
        >
          +
        </button>

        <!-- New tag input -->
        <div v-if="showTagInput" class="tag-input-wrapper">
          <input
            v-model="newTag"
            @keydown="onNewTagKeyDown"
            @blur="addTag"
            placeholder="..."
            class="tag-input"
            autofocus
          />
        </div>
      </div>
    </EdgeLabelRenderer>
  </g>
</template>

<style scoped>
.edge-label-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

/* Vertical list of tags - no boxes, no cards */
.tags-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.tag-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 2px;
  line-height: 1.3;
  cursor: pointer;
  color: var(--text, #6b6375);
  font-size: 9px;
  white-space: nowrap;
  transition: opacity 0.1s;
  user-select: none;
}

.tag-item:hover {
  opacity: 1;
}

.tag-text {
  cursor: pointer;
  transition: color 0.1s;
}

.tag-text:hover {
  color: var(--accent, #aa3bff);
}

/* Tiny action buttons on hover */
.tag-action {
  display: none;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  color: var(--text-muted, #aaa);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
  transition: color 0.1s;
}

.tag-action:hover {
  color: #e74c3c;
}

.tag-item:hover .tag-action {
  display: flex;
}

/* Tiny plus button */
.add-tag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted, #bbb);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.edge-label-container:hover .add-tag-btn {
  opacity: 1;
}

.add-tag-btn:hover {
  color: var(--accent, #aa3bff);
}

/* Minimal input - no box styling */
.tag-input-wrapper {
  display: flex;
  align-items: center;
}

.tag-input {
  width: 60px;
  padding: 0 2px;
  border: none;
  border-bottom: 1px solid var(--accent, #aa3bff);
  background: transparent;
  color: var(--text-h, #08060d);
  font-size: 9px;
  text-align: center;
  outline: none;
  line-height: 1.3;
}

.tag-input::placeholder {
  color: var(--text-muted, #bbb);
}
</style>
