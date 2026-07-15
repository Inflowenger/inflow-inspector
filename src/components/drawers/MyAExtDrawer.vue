<script setup lang="ts">
import { ref, watch, computed, markRaw } from 'vue'
import { type Node } from '@vue-flow/core'
import { JsonForms } from '@jsonforms/vue'
import { vanillaRenderers } from '@jsonforms/vue-vanilla'
import {
  InflowControlRenderer,
  InflowLayoutRenderer,
  inflowControlTester,
  inflowLayoutTester
} from '@inflowenger/plugin-form-builder'

interface ExtensionParams {
  schema?: Record<string, any>
  ui?: Record<string, any>
}

const props = defineProps<{
  modelValue: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// markRaw every renderer component — JSON Forms stores them in a reactive()
// context and would otherwise Proxy each component, breaking value reflection.
const renderers = [
  { tester: inflowControlTester, renderer: markRaw(InflowControlRenderer) },
  { tester: inflowLayoutTester, renderer: markRaw(InflowLayoutRenderer) },
  ...vanillaRenderers.map((r) => ({ tester: r.tester, renderer: markRaw(r.renderer) })),
]

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// Parse extension_raw to get schema/ui and current settings
const extensionRaw = computed(() => {
  try {
    const raw = props.node?.data?.extension_raw
    if (typeof raw === 'string') return JSON.parse(raw)
    return raw || null
  } catch {
    return null
  }
})

const extensionParams = computed((): ExtensionParams => {
  return extensionRaw.value?.params || {}
})

const extensionSchema = computed(() => {
  return extensionParams.value?.schema || { type: 'object', properties: {} }
})

const extensionUiSchema = computed(() => {
  return extensionParams.value?.ui || { type: 'VerticalLayout', elements: [] }
})

const formData = ref<Record<string, any>>({})

// When drawer opens or node changes, load saved settings or start fresh
watch(
  () => [props.node, props.modelValue],
  () => {
    if (props.node?.data?.settings) {
      formData.value = JSON.parse(JSON.stringify(props.node.data.settings))
    } else {
      formData.value = {}
    }
  },
  { immediate: true }
)

function onFormChange(event: any) {
  formData.value = event.data
  if (props.node) {
    props.node.data.settings = JSON.parse(JSON.stringify(event.data))
  }
}

function saveAndClose() {
  if (props.node) {
    props.node.data.settings = JSON.parse(JSON.stringify(formData.value))
  }
  showDrawer.value = false
}
</script>

<template>
  <transition name="myaext-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="myaext-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>
              <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6"/>
            </svg>
            <span>Extension Settings</span>
          </div>
          <button class="drawer-close" @click="saveAndClose" aria-label="Close drawer">×</button>
        </div>

        <div class="drawer-body">
          <div v-if="node" class="drawer-subtitle">
            <strong>{{ node.data?.title }}</strong>
          </div>

          <!-- JSONForms driven by extension params.schema + params.ui -->
          <JsonForms
            v-if="extensionSchema && Object.keys(extensionSchema).length > 0"
            :data="formData"
            :schema="extensionSchema as any"
            :uischema="extensionUiSchema as any"
            :renderers="renderers"
            @change="onFormChange"
          />

          <div v-else class="no-schema">
            <p>No parameter schema defined for this extension.</p>
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

.myaext-drawer {
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

.no-schema {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--text, #6b6375);
  font-size: 13px;
}

/* Drawer fade transition */
.myaext-drawer-fade-enter-active,
.myaext-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.myaext-drawer-fade-enter-from,
.myaext-drawer-fade-leave-to {
  opacity: 0;
}

.myaext-drawer-fade-enter-active .myaext-drawer,
.myaext-drawer-fade-leave-active .myaext-drawer {
  transition: transform 0.3s ease;
}

.myaext-drawer-fade-enter-from .myaext-drawer,
.myaext-drawer-fade-leave-to .myaext-drawer {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .myaext-drawer {
    width: 100%;
  }
}
</style>
