import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@jsonforms/vue-vanilla/vanilla.css'
import '@inflowenger/inflow-ui/style.css'
import { InflowUiPlugin, createInflowUi } from '@inflowenger/inflow-ui'

const app = createApp(App)

app.use(router)

app.use(InflowUiPlugin, createInflowUi({
  actions: {
    async refreshForm(ctx) {
      console.log('[Inflow UI] refreshForm action triggered for path:', ctx.path)
      // Example: reload external data, validate, etc.
      ctx.updateData({connection:{ protocol: 'wss',host:"api22.example.com"}}) //can be used to patch form data
      await ctx.refresh?.()
    }
  }
}))

app.mount('#app')
