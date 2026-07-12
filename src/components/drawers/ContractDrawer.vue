<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Node } from '@vue-flow/core'
import CodeEditor from '../common/CodeEditor.vue'

interface Condition {
  key: string
  value: string
}

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
const conditions = ref<Condition[]>([{ key: '', value: '' }])

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
      const conds = node.data.conditions
      conditions.value = Array.isArray(conds) && conds.length
        ? JSON.parse(JSON.stringify(conds))
        : [{ key: '', value: '' }]
    }
  },
  { immediate: true }
)

function addCondition() {
  conditions.value.push({ key: '', value: '' })
}

function removeCondition(index: number) {
  conditions.value.splice(index, 1)
  if (conditions.value.length === 0) {
    conditions.value.push({ key: '', value: '' })
  }
}

function saveAndClose() {
  if (props.node) {
    props.node.data.lang = language.value === 'opa-rego' ? 'opa' : 'js'
    props.node.data.logic_rule = code.value
    props.node.data.opa_result = resultVariable.value
    // Filter out empty conditions before saving
    const validConditions = conditions.value.filter(c => c.key.trim() !== '')
    props.node.data.conditions = validConditions.length > 0 ? validConditions : undefined
  }
  showDrawer.value = false
}
</script>

<template>
  <transition name="contract-drawer-fade">
    <div v-if="showDrawer" class="drawer-overlay" @click.self="saveAndClose">
      <div class="contract-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Contract Node</span>
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

          <!-- Conditions / K-V Section -->
          <div class="conditions-section">
            <div class="conditions-header">
              <label class="field-label">Conditions</label>
              <span class="field-hint">
                Define key/value pairs that form the contract criteria
              </span>
            </div>
            <p class="description">
              These conditions are user-defined key-value pairs. In the result model they appear as <code>{"leftside":data.p1, operator:"minus", "rightside":1200}</code>.
              Each row is one condition entry.
            </p>
            <div class="conditions-table">
              <div class="conditions-row conditions-header-row">
                <span class="col-key">Key</span>
                <span class="col-value">Value</span>
                <span class="col-action"></span>
              </div>
              <div
                v-for="(condition, index) in conditions"
                :key="index"
                class="conditions-row"
              >
                <input
                  v-model="condition.key"
                  type="text"
                  placeholder="e.g., leftside"
                  class="condition-input"
                />
                <input
                  v-model="condition.value"
                  type="text"
                  placeholder="e.g., data.p1"
                  class="condition-input"
                />
                <button
                  class="condition-remove"
                  title="Remove condition"
                  @click="removeCondition(index)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <button class="condition-add" @click="addCondition">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Condition
              </button>
            </div>
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

.contract-drawer {
  position: relative;
  top: 0;
  right: 0;
  width: 520px;
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

.field-hint {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: var(--text, #6b6375);
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
  margin: 0 0 12px 0;
}

.description code {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.conditions-section {
  margin-bottom: 16px;
}

.conditions-header {
  margin-bottom: 6px;
}

.conditions-table {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg, #fff);
}

.conditions-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.conditions-row:last-child {
  border-bottom: none;
}

.conditions-header-row {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text, #6b6375);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.col-key {
  flex: 1;
}

.col-value {
  flex: 1;
}

.col-action {
  width: 24px;
  flex-shrink: 0;
}

.condition-input {
  flex: 1;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.condition-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.condition-input::placeholder {
  color: var(--text, #6b6375);
  opacity: 0.6;
  font-family: inherit;
}

.condition-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.condition-remove:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

.condition-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border: 1px dashed var(--border, #e5e4e7);
  border-radius: 0;
  background: var(--bg, #fff);
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.condition-add:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-style: solid;
}

.editor-section {
  display: flex;
  flex-direction: column;
}

@media (max-width: 640px) {
  .contract-drawer {
    width: 100%;
  }
}

/* Drawer fade transition */
.contract-drawer-fade-enter-active,
.contract-drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.contract-drawer-fade-enter-from,
.contract-drawer-fade-leave-to {
  opacity: 0;
}

.contract-drawer-fade-enter-active .contract-drawer,
.contract-drawer-fade-leave-active .contract-drawer {
  transition: transform 0.3s ease;
}

.contract-drawer-fade-enter-from .contract-drawer,
.contract-drawer-fade-leave-to .contract-drawer {
  transform: translateX(100%);
}
</style>
