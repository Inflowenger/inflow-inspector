<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Node } from '@vue-flow/core'
import CodeEditor from '../common/CodeEditor.vue'

const props = defineProps<{
  modelValue: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const language = ref<'javascript' | 'opa-rego'>('javascript')
const code = ref('')
const resultVariable = ref('')

const showDrawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// Sync from node data whenever the node changes
watch(
  () => props.node,
  (node) => {
    if (node?.data) {
      language.value = node.data.lang === 'opa' ? 'opa-rego' : 'javascript'
      code.value = (node.data.logic_rule as string) || ''
      resultVariable.value = (node.data.opa_result as string) || ''
    }
  },
  { immediate: true }
)

function saveAndClose() {
  if (props.node) {
    props.node.data.lang = language.value === 'opa-rego' ? 'opa' : 'js'
    props.node.data.logic_rule = code.value
    props.node.data.opa_result = resultVariable.value
  }
  showDrawer.value = false
}
</script>

<template>
  <transition name="code-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="code-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Code Node</span>
          </div>
          <button class="drawer-close" @click="saveAndClose" aria-label="Close drawer">×</button>
        </div>

        <div class="drawer-body">
          <div v-if="node" class="drawer-subtitle">
            <strong>{{ node.data?.title }}</strong>
          </div>

          <!-- Language Selector -->
          <div class="language-selector">
            <label class="field-label">Language</label>
            <div class="language-options">
              <button
                class="lang-btn"
                :class="{ active: language === 'javascript' }"
                @click="language = 'javascript'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M16 18l6-6-6-6" />
                  <path d="M8 6l-6 6 6 6" />
                </svg>
                JavaScript
              </button>
              <button
                class="lang-btn"
                :class="{ active: language === 'opa-rego' }"
                @click="language = 'opa-rego'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                OPA-Rego
              </button>
            </div>
          </div>

          <!-- Result Variable (only for OPA-Rego) -->
          <div v-if="language === 'opa-rego'" class="result-field">
            <label class="field-label">
              Result Variable
              <span class="help-text">
                The variable name used as the final result in OPA evaluation
              </span>
            </label>
            <input
              v-model="resultVariable"
              type="text"
              placeholder="e.g., allow, result, permit"
              class="result-input"
            />
            <p class="description">
              In OPA-Rego, this variable determines which value is returned as the final decision from your policy.
              Common names are <code>allow</code>, <code>result</code>, or <code>permit</code>. The evaluation engine will
              look for this variable's value and ship it as the node's final output.
            </p>
          </div>

          <!-- JavaScript REPL Description -->
          <div v-if="language === 'javascript'" class="result-field">
            <label class="field-label">
              Result
              <span class="help-text">
                The last line of your code identifies the final result variable
              </span>
            </label>
            <p class="description">
              In JavaScript mode, identify the final result by writing its variable name on the
              <strong>last line</strong> of your code — just like a REPL. The evaluation engine evaluates the last line and ships it directly as the node's output. For example, if your computed value is stored in <code>result</code>, simply add <code>result;</code> as the final line.
            </p>
          </div>

          <!-- Code Editor -->
          <div class="editor-section">
            <label class="field-label">Code Editor</label>
            <CodeEditor v-model="code" :language="language" />
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

.code-drawer {
  position: relative;
  top: 0;
  right: 0;
  width: 480px;
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

.language-selector {
  margin-bottom: 16px;
}

.language-options {
  display: flex;
  gap: 8px;
}

.lang-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  border-color: var(--accent, #aa3bff);
  color: var(--text-h, #08060d);
}

.lang-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
}

.result-field {
  margin-bottom: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-input {
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
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  margin-bottom: 8px;
}

.result-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.result-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.6;
}

.description {
  font-size: 11px;
  color: var(--text, #6b6375);
  line-height: 1.5;
  margin: 0;
}

.description code {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.editor-section {
  display: flex;
  flex-direction: column;
}

@media (max-width: 640px) {
  .code-drawer {
    width: 100%;
  }
}

/* Drawer fade transition */
.code-drawer-fade-enter-active,
.code-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.code-drawer-fade-enter-from,
.code-drawer-fade-leave-to {
  opacity: 0;
}

.code-drawer-fade-enter-active .code-drawer,
.code-drawer-fade-leave-active .code-drawer {
  transition: transform 0.3s ease;
}

.code-drawer-fade-enter-from .code-drawer,
.code-drawer-fade-leave-to .code-drawer {
  transform: translateX(100%);
}
</style>
