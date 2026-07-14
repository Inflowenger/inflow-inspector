<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { JsonForms } from '@jsonforms/vue'
import { vanillaRenderers } from '@jsonforms/vue-vanilla'
import {
  InflowControlRenderer,
  InflowLayoutRenderer,
  inflowControlTester,
  inflowLayoutTester,
} from '@inflowenger/inflow-ui'

const renderers = [
  { tester: inflowControlTester, renderer: markRaw(InflowControlRenderer) },
  { tester: inflowLayoutTester, renderer: markRaw(InflowLayoutRenderer) },
  ...vanillaRenderers.map((r) => ({ tester: r.tester, renderer: markRaw(r.renderer) })),
]

const schema = {
  type: 'object',
  properties: {
    protocol: { type: 'string', title: 'Protocol', enum: ['http', 'https', 'ws', 'wss'], default: 'https' },
    host: { type: 'string', title: 'Host', default: 'localhost' },
  },
}

// A: protocol WITH x-inflow-ui (wrapped by InflowControlRenderer)
const uiWrapped = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Control',
      scope: '#/properties/protocol',
      'x-inflow-ui': { action: { name: 'noop' }, button: { position: 'append', label: 'x' } },
    },
    { type: 'Control', scope: '#/properties/host' },
  ],
}

// B: protocol WITHOUT x-inflow-ui (plain vanilla enum)
const uiPlain = {
  type: 'VerticalLayout',
  elements: [
    { type: 'Control', scope: '#/properties/protocol' },
    { type: 'Control', scope: '#/properties/host' },
  ],
}

const dataA = ref<Record<string, any>>({ protocol: 'https', host: 'localhost' })
const dataB = ref<Record<string, any>>({ protocol: 'https', host: 'localhost' })

function patchA() {
  dataA.value = { ...dataA.value, protocol: 'wss' }
}
</script>

<template>
  <div style="padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px">
    <div>
      <h3>A — WRAPPED (x-inflow-ui)</h3>
      <JsonForms :data="dataA" :schema="schema" :uischema="uiWrapped" :renderers="renderers" @change="(e:any)=>dataA=e.data" />
      <button id="patchA" @click="patchA">set protocol=wss</button>
      <pre id="dataA">{{ JSON.stringify(dataA, null, 2) }}</pre>
    </div>
    <div>
      <h3>B — PLAIN vanilla enum</h3>
      <JsonForms :data="dataB" :schema="schema" :uischema="uiPlain" :renderers="renderers" @change="(e:any)=>dataB=e.data" />
      <pre id="dataB">{{ JSON.stringify(dataB, null, 2) }}</pre>
    </div>
  </div>
</template>
