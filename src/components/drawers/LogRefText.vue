<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { parseRefs, resolveRefs } from '@inflowenger/flow-trace'
import { useFlowGraphs } from '../../composables/useFlowGraphs'

/**
 * Renders a log line, resolving every id it mentions against the saved graph.
 *
 * The engine names nodes and edges by id — titles live in the editor, not on
 * the wire. So any `n_…` / `e_…` in a message (whoever wrote it: the runtime, a
 * plugin, user code in a JS node) is swapped for the title the canvas draws,
 * with the id kept in the tooltip because that is what the raw JSON, the URL
 * and every other view key on.
 *
 * The splitting and naming is flow-trace's `resolveRefs`; this component only
 * supplies the graph and the markup.
 */
const props = defineProps<{
  text: string
  /** The flow bare ids belong to — the event's own flow. */
  flow?: string
  /** Title to use when the graph can't name a node (e.g. `node.enter`). */
  fallback?: string
}>()

const graphs = useFlowGraphs()

// Lazy by construction: a flow is fetched the first time a line mentioning it
// is actually rendered, and re-renders when it lands. Kept out of the resolved
// computed so fetching never depends on what resolving observed.
watchEffect(() => {
  for (const token of parseRefs(props.text, props.flow)) {
    if (token.kind !== 'text') graphs.ensure(token.flow)
  }
})

const parts = computed(() =>
  resolveRefs(props.text, graphs.index, { flow: props.flow, fallback: props.fallback }).map(
    (part) => ({
      ...part,
      tip: part.kind === 'text' ? undefined : graphs.describe(part.flow, part.kind, part.id!),
    }),
  ),
)
</script>

<template>
  <span class="log-refs">
    <template v-for="(part, i) in parts" :key="i">
      <span v-if="part.kind === 'text'">{{ part.label }}</span>
      <span
        v-else-if="part.kind === 'node'"
        class="ref-node"
        :class="{ 'ref-unknown': !part.known }"
        :title="part.tip"
        >{{ part.label }}</span
      >
      <span v-else class="ref-edge" :class="{ 'ref-unknown': !part.known }" :title="part.tip">{{
        part.label
      }}</span>
    </template>
  </span>
</template>

<style scoped>
.log-refs {
  min-width: 0;
  word-break: break-word;
}

/* A node the graph named: readable, and clearly a thing you can hover. */
.ref-node {
  cursor: help;
  font-weight: 500;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

/* An edge reads as its tags — the label on the canvas and the reason a branch
   was taken — so it gets the same green as a taken route hop. */
.ref-edge {
  cursor: help;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  background: rgba(46, 204, 113, 0.16);
  color: #176b3a;
}

/* Nothing named it: a flow still loading, or one deleted since the run. */
.ref-unknown {
  background: none;
  font-weight: 400;
  color: var(--text-muted, #b9b5bf);
}

@media (prefers-color-scheme: dark) {
  .ref-edge {
    background: rgba(46, 204, 113, 0.2);
    color: #6ee7a8;
  }
}
</style>
