<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useApiQuery } from '../../api/hooks'
import type { ExtensionSummary } from '../../api/types'

type TabId = 'generics' | 'extensions'

interface PaletteItem {
  type: string
  title: string
  icon: string
  tab: TabId
  // Optional: present when the item represents an extension from the API
  extension_raw?: string
}

const staticItems: PaletteItem[] = [
  // Generics tab
  { type: 'startNode', title: 'Start', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z', tab: 'generics' },
  // { type: 'plugin', title: 'Plugin', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z', tab: 'generics' },
  { type: 'pluginNative', title: 'PluginNative', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z', tab: 'generics' },
  { type: 'code', title: 'Code', icon: 'M16 18l6-6-6-6 M8 6l-6 6 6 6', tab: 'generics' },
  { type: 'contract', title: 'Contract', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2l6 6 M14 2v6h6', tab: 'generics' },
  { type: 'extrinsic', title: 'Extrinsics', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', tab: 'generics' },
  { type: 'goto', title: 'Goto', icon: 'M7 17L17 7 M7 7h10v10', tab: 'generics' },
  { type: 'void', title: 'Void', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z', tab: 'generics' },
]

// ---- Fetch extensions from API ----
const extensionsRaw = ref<ExtensionSummary[]>([])
const loadingExtensions = ref(false)
const extensionsError = ref<string | null>(null)

async function loadExtensions() {
  loadingExtensions.value = true
  extensionsError.value = null
  try {
    const { data, error, refresh } = useApiQuery<{ data: { list: ExtensionSummary[]; next: string } }>('/extension',
      { params: { per_page: 100 } }
    )
    await refresh()
    extensionsRaw.value = data.value?.data.list ?? []
    if (error.value) {
      extensionsError.value = error.value.message
    }
  } catch (e) {
    extensionsError.value = e instanceof Error ? e.message : 'Failed to load extensions'
  } finally {
    loadingExtensions.value = false
  }
}

onMounted(() => {
  loadExtensions()
})

// Map extension summaries to palette items
const extensionItems = computed((): PaletteItem[] => {
  return extensionsRaw.value.map((ext) => ({
    type: 'my_a_ext',
    title: ext.name || 'Untitled Extension',
    icon: ext.type === 'plugin'
      ? 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'
      : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    tab: 'extensions' as TabId,
    extension_raw: JSON.stringify(ext),
  }))
})

const activeTab = ref<TabId>('generics')
const collapsed = ref(false)

const filteredItems = computed((): PaletteItem[] => {
  if (activeTab.value === 'generics') return staticItems.filter((item) => item.tab === 'generics')
  return extensionItems.value
})

// ---- Draggable panel logic ----
const panelPos = ref({ x: 16, y: 16 })
const dragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

function onHeaderMouseDown(event: MouseEvent) {
  // Only start drag from header (not from items inside)
  const target = event.target as HTMLElement
  if (!target.closest('.palette-header')) return

  dragging.value = true
  dragOffset.value = {
    x: event.clientX - panelPos.value.x,
    y: event.clientY - panelPos.value.y,
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(event: MouseEvent) {
  if (!dragging.value) return
  panelPos.value = {
    x: event.clientX - dragOffset.value.x,
    y: event.clientY - dragOffset.value.y,
  }
}

function onMouseUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// ---- Drag start for items ----
function onItemDragStart(event: DragEvent, item: PaletteItem) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }
}
</script>

<template>
  <div
    class="floating-palette"
    :class="{ collapsed, dragging }"
    :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }"
    @mousedown="onHeaderMouseDown"
  >
    <!-- Header -->
    <div class="palette-header">
      <span class="palette-title">Palette</span>
      <button class="palette-toggle" @click.stop="collapsed = !collapsed" title="Toggle palette">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline v-if="!collapsed" points="18 15 12 9 6 15" />
          <polyline v-else points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div v-show="!collapsed" class="palette-body">
      <!-- Tabs -->
      <div class="palette-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'generics' }"
          @click.stop="activeTab = 'generics'"
        >
          Generics
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'extensions' }"
          @click.stop="activeTab = 'extensions'"
        >
          Extensions
        </button>
      </div>

      <!-- Items -->
      <div class="palette-list">
        <!-- Loading -->
        <div v-if="activeTab === 'extensions' && loadingExtensions" class="palette-state">Loading…</div>
        <!-- Error -->
        <div v-else-if="activeTab === 'extensions' && extensionsError" class="palette-state error">
          <span>{{ extensionsError }}</span>
          <button class="retry-btn" @click="loadExtensions">Retry</button>
        </div>
        <!-- Empty -->
        <div v-else-if="activeTab === 'extensions' && extensionItems.length === 0" class="palette-state">No extensions</div>

        <div
          v-for="(item, idx) in filteredItems"
          :key="item.extension_raw ? item.extension_raw : item.type + idx"
          class="palette-item"
          draggable="true"
          @dragstart="onItemDragStart($event, item as any)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path :d="(item as any).icon" />
          </svg>
          <span>{{ (item as any).title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-palette {
  position: absolute;
  z-index: 100;
  width: 180px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  user-select: none;
  transition: box-shadow 0.15s;
}

.floating-palette.dragging {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  cursor: grabbing;
}

.floating-palette.collapsed {
  width: auto;
}

/* ---- Header ---- */
.palette-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: grab;
  background: var(--bg, #fff);
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.collapsed .palette-header {
  border-bottom: none;
}

.palette-header:active {
  cursor: grabbing;
}

.palette-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-h, #08060d);
}

.palette-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: background 0.15s;
}

.palette-toggle:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}

/* ---- Tabs ---- */
.palette-tabs {
  display: flex;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.tab-btn {
  flex: 1;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  position: relative;
}

.tab-btn:hover {
  color: var(--text-h, #08060d);
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
}

.tab-btn.active {
  color: var(--accent, #aa3bff);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent, #aa3bff);
  border-radius: 1px 1px 0 0;
}

/* ---- Items ---- */
.palette-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 1px;
  max-height: 200px;
  overflow-y: auto;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text, #6b6375);
  cursor: grab;
  transition: background 0.12s, color 0.12s;
}

.palette-item:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--text-h, #08060d);
}

.palette-item:active {
  cursor: grabbing;
  background: var(--accent-bg, rgba(170, 59, 255, 0.2));
}

/* ---- State messages ---- */
.palette-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 12px 8px;
  font-size: 12px;
  color: var(--text, #6b6375);
  text-align: center;
}

.palette-state.error {
  color: #dc3545;
}

.retry-btn {
  padding: 2px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  cursor: pointer;
  font-size: 11px;
  transition: border-color 0.15s, color 0.15s;
}

.retry-btn:hover {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}
</style>
