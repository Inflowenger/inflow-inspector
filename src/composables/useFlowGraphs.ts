import { ref } from 'vue'
import type { GraphIndex, NamedEdge, NamedNode } from '@inflowenger/flow-trace'
import { apiClient } from '../api/client'

/**
 * Lazy, read-only index of saved flow graphs, keyed by flow id.
 *
 * The engine's stream names things the only way it can: by id. It carries no
 * titles on purpose — the runtime has no business shipping the editor's labels,
 * and an event that embedded them would be stale the moment someone renamed a
 * node. So the log drawer resolves ids against the *saved graph*, fetching each
 * referenced flow once and caching it here.
 *
 * The cache is module-level, not per-component: one run mentions the same flow
 * on nearly every line, and every view of it wants the same names.
 *
 * Everything is best-effort — an unresolvable id renders as itself. A flow that
 * fails to load is remembered as failed, so a stream of events about a deleted
 * flow doesn't become a stream of requests.
 */

export interface ResolvedNode extends NamedNode {
  type: string
}

export interface ResolvedEdge extends NamedEdge {
  sourceHandle?: string | null
}

interface CachedGraph {
  status: 'loading' | 'ready' | 'error'
  nodes: Record<string, ResolvedNode>
  edges: Record<string, ResolvedEdge>
}

/** A handler port on a node — `{ id, tags[], color }` in the editor's data. */
interface Handler {
  id: string
  tags?: string[]
}

const graphs = ref<Record<string, CachedGraph>>({})
// Flows already asked for, deliberately outside Vue's reactivity: `ensure` is
// called from render effects, and a reactive read there would re-run them every
// time any graph resolves.
const requested = new Set<string>()

function nodeTitle(node: any): string {
  const title = String(node?.data?.title ?? '').trim()
  return title || String(node?.type ?? '')
}

/**
 * An edge's tags. A routed port (rule / LLM / handler nodes) carries them on the
 * source node's handler rather than on the edge itself, so fall back to the
 * handler the edge leaves from — that is the tag drawn on the canvas.
 */
function edgeTags(edge: any, source: any): string[] {
  const own = edge?.data?.tags
  if (Array.isArray(own) && own.length > 0) return own as string[]
  const handlers = source?.data?.handlers
  if (!Array.isArray(handlers)) return []
  return (handlers as Handler[]).find((h) => h.id === edge?.sourceHandle)?.tags ?? []
}

function ensure(flowId?: string): void {
  if (!flowId || requested.has(flowId)) return
  requested.add(flowId)
  graphs.value[flowId] = { status: 'loading', nodes: {}, edges: {} }
  void apiClient
    .get<any>(`/flow/id/${flowId}`)
    .then((res) => {
      const view = res.data?.data?.view_flow ?? {}
      const nodes: Record<string, ResolvedNode> = {}
      const byId = new Map<string, any>()
      for (const n of view.nodes ?? []) {
        byId.set(n.id, n)
        nodes[n.id] = { id: n.id, title: nodeTitle(n), type: String(n.type ?? '') }
      }
      const edges: Record<string, ResolvedEdge> = {}
      for (const e of view.edges ?? []) {
        edges[e.id] = {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          tags: edgeTags(e, byId.get(e.source)),
        }
      }
      graphs.value[flowId] = { status: 'ready', nodes, edges }
    })
    .catch(() => {
      // A deleted flow, or a run from a flow this user can't read. Ids stay.
      graphs.value[flowId] = { status: 'error', nodes: {}, edges: {} }
    })
}

function node(flowId: string | undefined, nodeId: string): ResolvedNode | undefined {
  if (!flowId) return undefined
  return graphs.value[flowId]?.nodes[nodeId]
}

function edge(flowId: string | undefined, edgeId: string): ResolvedEdge | undefined {
  if (!flowId) return undefined
  return graphs.value[flowId]?.edges[edgeId]
}

/**
 * Tooltip for one reference: the id, plus whatever the graph knows about it. An
 * edge is described by its endpoints — the pair a routing decision is about.
 */
function describe(flowId: string | undefined, kind: 'node' | 'edge', id: string): string {
  if (kind === 'node') {
    const found = node(flowId, id)
    return found ? `${id} · ${found.type}` : id
  }
  const found = edge(flowId, id)
  if (!found) return id
  const from = node(flowId, found.source)?.title ?? found.source
  const to = node(flowId, found.target)?.title ?? found.target
  return `${id} · ${from} → ${to}`
}

/**
 * Re-read a flow (or every loaded flow) after a save — rows already on screen
 * ask for a graph only once, so a dropped entry has to be refilled here or the
 * drawer falls back to bare ids for the rest of the session.
 */
function invalidate(flowId?: string): void {
  // Only flows already cached: saving a flow nobody is watching logs for should
  // not pull its graph down.
  const stale = flowId ? (graphs.value[flowId] ? [flowId] : []) : Object.keys(graphs.value)
  for (const id of stale) {
    requested.delete(id)
    delete graphs.value[id]
    ensure(id)
  }
}

/** `node` / `edge` are flow-trace's GraphIndex — pass `index` to `resolveRefs`. */
const index: GraphIndex = { node, edge }

export function useFlowGraphs() {
  return { graphs, ensure, node, edge, describe, invalidate, index }
}
