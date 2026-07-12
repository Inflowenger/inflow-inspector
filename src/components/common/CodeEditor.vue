<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { rego } from "codemirror-lang-rego";

const props = defineProps<{
  modelValue: string
  language?: 'javascript' | 'opa-rego'
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorRef = ref<HTMLDivElement>()
let view: EditorView | null = null

function buildExtensions() {
  const exts: any[] = [basicSetup, oneDark]
  if (props.language === 'javascript') {
    exts.push(javascript())
  } else if (props.language === 'opa-rego') {
    exts.push(rego())
  }
  if (props.readonly) {
    exts.push(EditorState.readOnly.of(true))
  }
  return exts
}

function createView(initialDoc: string) {
  if (!editorRef.value) return
  view = new EditorView({
    doc: initialDoc,
    extensions: [
      ...buildExtensions(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && view) {
          emit('update:modelValue', view.state.doc.toString())
        }
      }),
    ],
    parent: editorRef.value,
  })
}

onMounted(() => {
  createView(props.modelValue || '')
})

watch(() => props.language, () => {
  if (!view) return
  const currentText = view.state.doc.toString()
  view.destroy()
  view = null
  createView(currentText)
})

watch(() => props.modelValue, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal || '' },
    })
  }
})

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="editorRef" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.code-editor :deep(.cm-editor) {
  min-height: 240px;
}

.code-editor :deep(.cm-focused) {
  outline: none;
}
</style>
