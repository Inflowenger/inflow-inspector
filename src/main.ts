import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@jsonforms/vue-vanilla/vanilla.css'
import '@inflowenger/plugin-form-builder/style.css'
import { InflowUiPlugin, createInflowUi } from '@inflowenger/plugin-form-builder'
import { mergeStyles, defaultStyles } from '@jsonforms/vue-vanilla'

const app = createApp(App)

app.use(router)

// Token-based theme for the vanilla JSON Forms widgets.
// We only map class names here; the actual look lives in style.css and uses the
// app's design tokens (--bg, --border, --accent, ...), so forms inherit the app
// theme (incl. dark mode) and plugin-form-builder stays design-system-agnostic.
// mergeStyles keeps the structural vanilla classes and appends ours.
const inflowFormStyles = mergeStyles(defaultStyles, {
  control: {
    root: 'if-control',
    label: 'if-label',
    input: 'if-input',
    select: 'if-input',
    textarea: 'if-input',
    error: 'if-error',
    description: 'if-desc',
  },
  verticalLayout: { root: 'if-vstack' },
  horizontalLayout: { root: 'if-hstack', item: 'if-hstack-item' },
  group: { root: 'if-group', label: 'if-group-label' },
  arrayList: { root: 'if-array', addButton: 'if-btn', label: 'if-group-label' },
  // The "clear data?" confirm shown when switching a oneOf with existing data
  // is a native <dialog> baked into vanilla's OneOfRenderer. It can't be
  // disabled via config, only styled — so we theme it to match the app.
  dialog: {
    root: 'if-dialog',
    title: 'if-dialog-title',
    body: 'if-dialog-body',
    actions: 'if-dialog-actions',
    buttonPrimary: 'if-btn',
    buttonSecondary: 'if-btn-secondary',
  },
})
app.provide('styles', inflowFormStyles)

app.use(InflowUiPlugin, createInflowUi({
  // x-inflow-ui button/container look — also token-based, defined in style.css.
  theme: {
    containerClass: 'if-inflow-field',
    buttonClass: 'if-btn',
    iconButtonClass: 'if-btn-icon',
  },
  actions: {
    async refreshForm(ctx) {
      console.log('[Inflow UI] refreshForm action triggered for path:', ctx.path)
      // Patch individual LEAF paths (dot notation). Writing the whole
      // `connection` object would replace it and wipe port/secure.
      ctx.updateData({
        'connection.protocol': 'wss',
        'connection.host': 'api22.example.com',
      })
      await ctx.refresh?.()
    },

    // Test action: simulate a service call that RETURNS an array list, then
    // write it into the form. `ctx.data` is the value of the control the button
    // sits on (e.g. the selected Project), so this is the shape of a cascade.
    async loadLabels(ctx) {
      console.log('[loadLabels] triggered — control value (ctx.data):', ctx.data)

      // Pretend we hit a backend keyed off the current selection.
      const labels = await new Promise<string[]>((resolve) =>
        setTimeout(() => resolve(['bug', 'feature', 'urgent']), 300)
      )
      console.log('[loadLabels] service returned:', labels)

      // Effects happen via updateData (the action contract is void — there is
      // no return channel to the UI). Keys are absolute data paths; here we
      // fill the `labels` array field with the returned list.
      ctx.updateData({ labels })
      await ctx.refresh?.()
    },
  }
}))

app.mount('#app')
