<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted, markRaw, shallowRef } from 'vue'
import { createFlowTracker, type FlowTracker, type ProcEvent, type ProcessState } from '@inflowenger/flow-trace'
import { useRouter } from 'vue-router'
import { VueFlow, useVueFlow, type Node, type Edge, type Connection, MarkerType, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { JsonForms } from '@jsonforms/vue'
import { vanillaRenderers } from '@jsonforms/vue-vanilla'
import {
  InflowControlRenderer,
  InflowLayoutRenderer,
  inflowControlTester,
  inflowLayoutTester
} from '@inflowenger/plugin-form-builder'
import NodePalette from './NodePalette.vue'
import CustomNode from '../nodes/CustomNode.vue'
import StartNode from '../nodes/StartNode.vue'
import PluginNativeNode from '../nodes/PluginNativeNode.vue'
import CodeNode from '../nodes/CodeNode.vue'
import ContractNode from '../nodes/ContractNode.vue'
import ExtrinsicNode from '../nodes/ExtrinsicNode.vue'
import GotoNode from '../nodes/GotoNode.vue'
import VoidNode from '../nodes/VoidNode.vue'
import MyAExtNode from '../nodes/MyAExtNode.vue'
import CodeDrawer from '../drawers/CodeDrawer.vue'
import ContractDrawer from '../drawers/ContractDrawer.vue'
import ExtrinsicDrawer from '../drawers/ExtrinsicDrawer.vue'
import PluginNativeDrawer from '../drawers/PluginNativeDrawer.vue'
import GotoDrawer from '../drawers/GotoDrawer.vue'
import MyAExtDrawer from '../drawers/MyAExtDrawer.vue'
import CustomEdge from './CustomEdge.vue'
import { pluginJsonSchema, pluginUiSchema } from '../../schemas/pluginSchema'
import { useApiMutation, useApiQuery } from '../../api/hooks.ts'
import { apiClient } from '../../api/client.ts'
import type { PaginatedResponse } from '../../api/types'
import { useSocketIO } from '../../composables/useSocketIO.ts'
import { useRunningProcesses } from '../../composables/useRunningProcesses.ts'
import { useFlowGraphs } from '../../composables/useFlowGraphs.ts'
import FlowLogDrawer from '../drawers/FlowLogDrawer.vue'
import RunningProcessesPanel from './RunningProcessesPanel.vue'

interface ContextSummary {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{ id?: string }>()
const router = useRouter()

function goBack() {
  router.push({ name: 'workflows' })
}

// markRaw every renderer component — JSON Forms stores them in a reactive()
// context and would otherwise Proxy each component, breaking value reflection.
const renderers = [
  { tester: inflowControlTester, renderer: markRaw(InflowControlRenderer) },
  { tester: inflowLayoutTester, renderer: markRaw(InflowLayoutRenderer) },
  ...vanillaRenderers.map((r) => ({ tester: r.tester, renderer: markRaw(r.renderer) })),
]

// ---- Settings Drawer ----
const showDrawer = ref(false)
const selectedPluginNode = ref<Node | null>(null)
const drawerWidth = ref(380)
const isResizing = ref(false)

function startResize(event: MouseEvent) {
  isResizing.value = true
  const startX = event.clientX
  const startWidth = drawerWidth.value

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value) return
    const delta = startX - e.clientX
    drawerWidth.value = Math.max(280, Math.min(800, startWidth + delta))
  }

  function onResizeUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeUp)
  }

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeUp)
}

const pluginFormData = ref<Record<string, any>>({})

function saveFormToNode() {
  if (selectedPluginNode.value) {
    selectedPluginNode.value.data = {
      ...(selectedPluginNode.value.data as any),
      settings: JSON.parse(JSON.stringify(pluginFormData.value)),
    }
  }
}

function onOverlayClick(event: MouseEvent) {
  // Only close if the click target is the overlay itself (not bubbling from children)
  const target = event.target as HTMLElement
  if (target.classList.contains('drawer-overlay')) {
    closeDrawer()
  }
}

function closeDrawer() {
  saveFormToNode()
  showDrawer.value = false
  selectedPluginNode.value = null
}

function onFormChange(event: any) {
  if (selectedPluginNode.value) {
    selectedPluginNode.value.data.settings = event.data
  }
  pluginFormData.value = event.data
}

// ---- Code Node Drawer ----
const showCodeDrawer = ref(false)
const selectedCodeNode = ref<Node | null>(null)

function openCodeDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedCodeNode.value = node
  showCodeDrawer.value = true
}

// Initial nodes - now with no static edges
const initialNodes: Node[] = [

  {
    id: '001',
    position: { x: 50, y: 450 },
    data: { title: 'Start',  },
    type: 'startNode',
  }
]

// ---- Load / New flow ----
const emptyEdges: Edge[] = []

const nodes = ref<Node[]>([...initialNodes]) as any
const edges = ref<Edge[]>([...emptyEdges]) as any

const vueFlow = useVueFlow({ id: 'main-flow' })
let nodeId = 8 // Updated nodeId to reflect new nodes

// Workflow title (declared early — used by resetFlow / loadFlow / saveDiagram)
const workflowTitle = ref('')

function resetFlow() {
  nodes.value = [...initialNodes]
  edges.value = [...emptyEdges]
  workflowTitle.value = ''
  nodeId = 8
  vueFlow.fitView()
}

async function loadFlow(id: string) {
  try {
    const res = await apiClient.get<any>(`/flow/id/${id}`)
    const data = res.data.data
    if (data.view_flow) {
      nodes.value = data.view_flow.nodes ?? []
      edges.value = data.view_flow.edges ?? []
      nodeId = Math.max(...(nodes.value as Node[]).map((n: Node) => Number(n.id) || 0), 0) + 1
    }
    workflowTitle.value = data.title ?? ''

    // Restore saved viewport (position + zoom) if available
    const vp = data.view_flow?.position || data.position || null
    if (vp && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number') {
      nextTick(() => {
        vueFlow.setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
      })
    } else {
      vueFlow.fitView()
    }
  } catch (e) {
    console.error('Failed to load flow', e)
    alert('Failed to load workflow')
  }
}

watch(
  () => props.id,
  (id) => {
    if (!id) {
      resetFlow()
    } else {
      loadFlow(id)
    }
  },
  { immediate: true }
)

// ---- Contract Node Drawer ----
const showContractDrawer = ref(false)
const selectedContractNode = ref<Node | null>(null)

function openContractDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedContractNode.value = node
  showContractDrawer.value = true
}

// ---- Plugin Native Node Drawer ----
const showPluginNativeDrawer = ref(false)
const selectedPluginNativeNode = ref<Node | null>(null)

function openPluginNativeDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedPluginNativeNode.value = node
  showPluginNativeDrawer.value = true
}

// ---- Extrinsic Node Drawer ----
const showExtrinsicDrawer = ref(false)
const selectedExtrinsicNode = ref<Node | null>(null)

function openExtrinsicDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedExtrinsicNode.value = node
  showExtrinsicDrawer.value = true
}

// ---- Goto Node Drawer ----
const showGotoDrawer = ref(false)
const selectedGotoNode = ref<Node | null>(null)

function openGotoDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedGotoNode.value = node
  showGotoDrawer.value = true
}

// ---- MyAExt Node Drawer ----
const showMyAExtDrawer = ref(false)
const selectedMyAExtNode = ref<Node | null>(null)

function openMyAExtDrawer(nodeId: string) {
  const node: Node | undefined = nodes.value.find((n: Node) => n.id === nodeId)
  if (!node) return
  selectedMyAExtNode.value = node
  showMyAExtDrawer.value = true
}

// Edge line type selector
const edgeTypes = ['default', 'straight', 'step', 'smoothstep'] as const
type EdgeType = typeof edgeTypes[number]
const selectedEdgeType = ref<EdgeType>('default')
const showEdgeSelector = ref(false)

// Palette visibility
const showPalette = ref(true)

function onConnect(connection: Connection) {
  // Validate connection: allow 'output' or dynamic 'handler-*' source handles to 'input' target
  if (
    (connection.sourceHandle !== 'output' && !connection.sourceHandle?.startsWith('handler-')) ||
    connection.targetHandle !== 'input'
  ) {
    console.warn('❌ Invalid connection: Can only connect from output/handler port to input port')
    return
  }
  if (connection.source == connection.target){
    return
  }
  // Collect tags from the source handle if it's a handler
  const sourceNode = nodes.value.find((n: Node) => n.id === connection.source)
  let inheritedTags: string[] = []
  if (sourceNode && connection.sourceHandle?.startsWith('handler-')) {
    const handlers = (sourceNode.data?.handlers || []) as Array<{ id: string; tags: string[] }>
    const handler = handlers.find((h) => h.id === connection.sourceHandle)
    if (handler) {
      inheritedTags = [...handler.tags]
    }
  }

  // Create a unique edge ID
  const edgeId = `e-${connection.source}-${connection.target}-${Date.now()}`
  const newEdge: Edge = {
    id: edgeId,
    source: connection.source!,
    target: connection.target!,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    animated: false,
    markerEnd: MarkerType.ArrowClosed,
    type: 'custom-edge',
    data: {
      tags: inheritedTags,
      edgeType: selectedEdgeType.value,
    },
  }
  edges.value.push(newEdge)
  console.log('✅ Connection created:', edgeId, '| tags:', inheritedTags)
}

// Remove all edges whose source handle matches a deleted handler
function removeHandlerEdges(nodeId: string, handlerId: string) {
  const connected = edges.value.filter(
    (e: Edge) => e.source === nodeId && e.sourceHandle === handlerId
  )
  if (connected.length) {
    edges.value = edges.value.filter(
      (e: Edge) => !(e.source === nodeId && e.sourceHandle === handlerId)
    )
    console.log('🗑️ Removed', connected.length, 'edge(s) for handler', handlerId)
  }
}

// Save/Export diagram
async function saveDiagram() {
  const viewport = vueFlow.getViewport()
  const diagram = {
    id: props.id || "",
    view_flow: {
      nodes: nodes.value,
      edges: edges.value,
      position: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      },
    },
    title: workflowTitle.value,
  }
  let {mutate:upsertFlow}=useApiMutation<any>('POST','/flow')
    let res = await upsertFlow(diagram)
      console.log("save result: ",res)

  // The log drawer names nodes and edges by resolving ids against the saved
  // graph — a rename here must not leave it showing the old titles.
  flowGraphs.invalidate(props.id || res?.data?.data?.id)

  // If this was a new flow, redirect to the flow view page
  if (!props.id && res?.data?.data?.id) {
    const newId = res.data.data.id
    console.log('🔄 Redirecting to new flow:', newId)
    router.push({ name: 'workflow-edit', params: { id: newId } })
  }

  console.log('📊 Diagram Export:', diagram)
  console.log('📊 JSON:', JSON.stringify(diagram))
}

// Screenshot functionality
function takeScreenshot() {
  const flowElement = document.querySelector('.vue-flow') as HTMLElement
  if (!flowElement) return
  
  console.log('📸 Screenshot functionality triggered')
  console.log('📸 Flow element:', flowElement)
  console.log('📸 Note: For actual screenshot, integrate html2canvas or similar library')
  
  // Placeholder for actual screenshot implementation
  alert('Screenshot feature - check console for details')
}

// Toggle palette visibility
function togglePalette() {
  showPalette.value = !showPalette.value
}

// Change edge type for NEW edges only (don't affect existing edges)
function changeEdgeType(type: EdgeType) {
  selectedEdgeType.value = type
  showEdgeSelector.value = false
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()

  const json = event.dataTransfer?.getData('application/json')
  if (!json) return

  const item = JSON.parse(json)

  // Convert screen coordinates to flow coordinates
  const position = vueFlow.screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  })

  const baseLabel = item.title

  // Check for duplicate titles and add index if needed (Windows-style: "Untitled (1)")
  let counter = 1
  let title = baseLabel
  while (nodes.value.some((node: Node) => node.data.title === title)) {
    title = `${baseLabel} (${counter})`
    counter++
  }

  // Map palette item types to registered node types
  const nodeTypeMap: Record<string, string> = { startNode: 'startNode', plugin: 'plugin', pluginNative: 'pluginNative', code: 'code', contract: 'contract', extrinsic: 'extrinsic', goto: 'goto', void: 'void', my_a_ext: 'my_a_ext' }
  const nodeType = nodeTypeMap[item.type] || 'custom'

  // Build base data
  const baseData: Record<string, any> = {
    title,
    key: title, // Default key to title (mirrors title at creation)
  }

  // If dragging an extension, ship its raw data into the node
  if (nodeType === 'my_a_ext' && item.extension_raw) {
    baseData.extension_raw = item.extension_raw as string
  }

  // Initialize backend model fields based on node type
  if (nodeType === 'code') {
    baseData.lang = 'js'
    baseData.logic_rule = ''
    baseData.opa_data = {}
    baseData.opa_result = ''
  } else if (nodeType === 'contract') {
    baseData.lang = 'js'
    baseData.logic_rule = ''
    baseData.conditions = {}
    baseData.opa_result = ''
    baseData.handlers = []
  } else if (nodeType === 'goto') {
    baseData.goto = { flowId: '', from_nodeId: '', end_nodeId: '' }
  }

  const newNode: Node = {
    id: String(nodeId++),
    position,
    data: baseData,
    type: nodeType,
  }

  nodes.value.push(newNode)
}

// Handle node drag stop - group/ungroup into void nodes
function onNodeDragStop(dragEvent: any) {
  const node: Node = dragEvent.node

  // Don't group void nodes into other void nodes
  if (node.type === 'void') return

  // Get absolute position of the node
  let absX = node.position.x
  let absY = node.position.y

  // If node has a parent, check if it should be ungrouped
  if (node.parentNode) {
    const parent = nodes.value.find((n: Node) => n.id === node.parentNode)
    if (parent) {
      absX = parent.position.x + node.position.x
      absY = parent.position.y + node.position.y

      const parentWidth = (parent.data as any).width || 160
      const parentHeight = (parent.data as any).height || 100

      // Check if node is outside parent bounds (with some margin)
      if (node.position.x < -20 || node.position.x > parentWidth + 20 || node.position.y < -20 || node.position.y > parentHeight + 20) {
        // Ungroup the node
        node.position = { x: absX, y: absY }
        node.parentNode = undefined
        node.extent = undefined
        console.log(`📤 Node ${node.id} ungrouped from void node ${parent.id}`)
        // After ungrouping, fall through to check for new grouping
      } else {
        // Still inside parent, nothing to do
        return
      }
    }
  }

  // Find all void nodes (excluding self)
  const voidNodes = nodes.value.filter((n: Node) => n.type === 'void' && n.id !== node.id)

  for (const voidNode of voidNodes) {
    const voidX = voidNode.position.x
    const voidY = voidNode.position.y
    const voidWidth = (voidNode.data as any).width || 160
    const voidHeight = (voidNode.data as any).height || 100

    // Check if node center is inside void node bounds
    if (absX >= voidX && absX <= voidX + voidWidth && absY >= voidY && absY <= voidY + voidHeight) {
      // Make this node a child of the void node
      node.parentNode = voidNode.id
      node.extent = 'parent'
      // Adjust position to be relative to parent
      node.position = {
        x: absX - voidX,
        y: absY - voidY
      }
      console.log(`🗂️ Node ${node.id} grouped into void node ${voidNode.id}`)
      break
    }
  }
}

// ---- Socket.IO Dev Panel Logs ----
// Ids → titles for the log drawer; invalidated whenever this page saves.
const flowGraphs = useFlowGraphs()
const { state: socketState, messages: logMessages, isOpen: showLogDrawer, connect: connectSocket, clearMessages, open: openLogDrawer, tracker } = useSocketIO()

// ---- Running Processes Tracking ----
const { runningProcesses, addProcess, removeProcess } = useRunningProcesses()
const stoppingPids = ref<Set<string>>(new Set())

// Track the active process PID so we know when the flow is running
const currentPid = ref<string | null>(null)

// The run painted on the canvas. Outlives currentPid: when a process finishes
// it stops executing, but the path it took stays on screen until the next run.
const visualisedPid = ref<string | null>(null)

// ---- Live flow visualisation ----
//
// Edge state is derived from the tracker rather than tracked alongside it: the
// tracker already knows which edges were travelled and how each node stands, so
// re-deriving is both simpler and impossible to get out of sync.

const TRAVELLED_STROKE = '#aa3bff'
const PRUNED_OPACITY = 0.25

/** Coalesce redraws — a hot loop can emit hundreds of events per frame. */
let redrawQueued = false
function scheduleEdgeRefresh() {
  if (redrawQueued) return
  redrawQueued = true
  requestAnimationFrame(() => {
    redrawQueued = false
    refreshEdgeVisuals()
  })
}

/**
 * Paint the canvas from the tracked process.
 *
 * An edge shows motion while control is in flight along it — travelled, with a
 * target that hasn't settled yet. That falls out of the state, so motion stops
 * on its own when the process finishes and every node has settled.
 */
/**
 * The process the canvas is painting.
 *
 * A replay takes over the canvas while it runs — it has its own tracker fed at
 * its own pace, so live events for other processes can keep arriving without
 * fighting it for the diagram.
 */
function activeState(): ProcessState | undefined {
  const session = replaySession.value
  if (session) return session.tracker.state(session.pid)
  const pid = visualisedPid.value
  return pid ? tracker.value.state(pid) : undefined
}

function refreshEdgeVisuals() {
  const state = activeState()
  let changed = false

  for (const edge of edges.value as Edge[]) {
    const tracked = state?.edges[edge.id]
    const travelled = tracked?.taken === true
    // Known to the engine but never followed: the rejected side of a branch.
    const pruned = tracked !== undefined && !travelled

    let animate = false
    if (travelled && state) {
      const target = state.nodes[`${tracked!.to.flow}:${tracked!.to.node}`]
      animate = target?.status === 'pending' || target?.status === 'running'
    }

    const style = travelled
      ? { stroke: TRAVELLED_STROKE, strokeWidth: 2 }
      : pruned
        ? { opacity: PRUNED_OPACITY }
        : undefined

    if (edge.animated !== animate) {
      edge.animated = animate
      changed = true
    }
    if (JSON.stringify(edge.style ?? null) !== JSON.stringify(style ?? null)) {
      edge.style = style as any
      changed = true
    }
  }

  if (changed) {
    // VueFlow needs a new array identity to pick up per-edge changes.
    edges.value = [...edges.value]
  }
}

/** Clear all run styling — back to a plain, un-run graph. */
function resetEdgeAnimations() {
  let changed = false
  for (const edge of edges.value as Edge[]) {
    if (edge.animated || edge.style) {
      edge.animated = false
      edge.style = undefined
      changed = true
    }
  }
  if (changed) {
    edges.value = [...edges.value]
  }
}

// `move` carries the exact edge the engine took, so there is nothing to infer:
// no guessing from inbound edges, and branches that were pruned stay dark.
tracker.value.on('move', () => scheduleEdgeRefresh())
tracker.value.on('node:enter', () => scheduleEdgeRefresh())
tracker.value.on('node:exit', () => scheduleEdgeRefresh())

// proc.finish is the authoritative end of a process — this is the only thing
// that takes a row out of the running list.
tracker.value.on('finish', ({ pid }) => {
  removeProcess(pid)
  if (stoppingPids.value.has(pid)) {
    const next = new Set(stoppingPids.value)
    next.delete(pid)
    stoppingPids.value = next
  }
  if (currentPid.value === pid) {
    currentPid.value = null
  }
  // The path stays painted; every node has settled, so motion stops by itself.
  scheduleEdgeRefresh()
})

// Repaint when the focused process changes — each run has its own route.
watch(visualisedPid, () => {
  stopReplay()
  resetEdgeAnimations()
  scheduleEdgeRefresh()
})

// ---- Route replay ----
//
// Walks a recorded run's events back through a fresh tracker, one at a time, so
// the diagram redraws the route in the order the engine actually took it.
// Reading the events rather than re-deriving from the graph means what you see
// is exactly what happened, including branches not taken.

const REPLAY_STEP_MS = 140

const replaySession = shallowRef<{ pid: string; tracker: FlowTracker } | null>(null)
const replayProgress = ref<{ index: number; total: number } | null>(null)
let replayTimer: ReturnType<typeof setTimeout> | null = null

const isReplaying = computed(() => replaySession.value !== null)

function stopReplay() {
  if (replayTimer !== null) {
    clearTimeout(replayTimer)
    replayTimer = null
  }
  if (replaySession.value) {
    replaySession.value = null
    replayProgress.value = null
    // Hand the canvas back to the live tracker.
    scheduleEdgeRefresh()
  }
}

function startReplay({ pid, events }: { pid: string; events: ProcEvent[] }) {
  stopReplay()
  if (events.length === 0) return

  // A tracker of its own, so replaying never disturbs the live state.
  replaySession.value = { pid, tracker: createFlowTracker({ pid, reorderWindow: Infinity }) }
  replayProgress.value = { index: 0, total: events.length }
  resetEdgeAnimations()

  let i = 0
  const step = () => {
    const session = replaySession.value
    if (!session) return // stopped mid-flight

    session.tracker.ingest(events[i])
    i++
    replayProgress.value = { index: i, total: events.length }
    refreshEdgeVisuals()

    if (i < events.length) {
      replayTimer = setTimeout(step, REPLAY_STEP_MS)
      return
    }
    // Finished: leave the completed route on screen and release the canvas.
    replayTimer = setTimeout(() => {
      replaySession.value = null
      replayProgress.value = null
    }, 600)
  }
  step()
}

onUnmounted(() => stopReplay())

// Auto-connect socket when log drawer is opened
watch(showLogDrawer, (open) => {
  if (open) {
    connectSocket()
  }
})

// ---- Context Selection & Workflow Run ----
const LS_CONTEXT_KEY = 'inflow:last-selected-context'

const showContextDropdown = ref(false)
const selectedContextId = ref<string>('')

// Fetch context list
const { data: contextsData, loading: contextsLoading } = useApiQuery<PaginatedResponse<ContextSummary>>('/context', {
  params: { per_page: 100 },
})

const contexts = computed(() => contextsData.value?.data.list ?? [])

const selectedContextTitle = computed(() => {
  const ctx = contexts.value.find((c) => c.id === selectedContextId.value)
  return ctx?.title || 'Select Context'
})

// Restore saved context from localStorage on mount
onMounted(() => {
  const saved = localStorage.getItem(LS_CONTEXT_KEY)
  if (saved) {
    selectedContextId.value = saved
  }
})

function selectContext(ctxId: string) {
  selectedContextId.value = ctxId
  localStorage.setItem(LS_CONTEXT_KEY, ctxId)
  showContextDropdown.value = false
}

// Start workflow run
const { mutate: startRun, loading: isStarting } = useApiMutation<any>('POST', '/ps')

async function handleStart() {
  if (!props.id) {
    alert('Please save the workflow first before running.')
    return
  }
  if (!selectedContextId.value) {
    alert('Please select a context first.')
    showContextDropdown.value = true
    return
  }
  // Ensure socket is connected and drawer is open before starting
  connectSocket()
  openLogDrawer()

  const body = {
    flowId: `${props.id}`,
    contextId: selectedContextId.value,
  }
  clearMessages()
  const res = await startRun(body)
  if (res) {
    // Support both response shapes: { pid: '...', selected_resource: {...} } and { data: { pid: '...', selected_resource: {...} } }
    const responseData = res.data as any
    const pid = (responseData?.pid ?? responseData?.data?.pid) as string | undefined
    const selectedResource = (responseData?.selected_resource ?? responseData?.data?.selected_resource ?? {}) as Record<string, any>
    if (pid) {
      currentPid.value = pid
      visualisedPid.value = pid
      addProcess({
        pid,
        selectedResource,
        startTime: Date.now(),
        flowId: props.id,
        contextId: selectedContextId.value,
      })
    }
    console.log('▶️ Workflow started:', res)
  } else {
    alert('Failed to start workflow.')
  }
}

// Stop a specific running process by PID
async function handleStopProcess(pid: string) {
  const proc = runningProcesses.value.find((p) => p.pid === pid)
  if (!proc) {
    alert('Process not found in running list.')
    return
  }
  stoppingPids.value = new Set([...stoppingPids.value, pid])
  try {
    const body = { resource: proc.selectedResource }
    const res = await apiClient.post<any>(`/ps/stop/${pid}`, body)
    console.log('⏹️ Workflow stopped:', res)
    removeProcess(pid)
    if (currentPid.value === pid) {
      currentPid.value = null
    }
  } catch (err: any) {
    const status = err?.status ?? err?.data?.status ?? 0
    // If process already finished (404) or stopped successfully (200), remove it from the list
    if (status === 406 || status === 200) {
      console.log(`⏹️ Process ${pid} not found or already stopped (status ${status}), removing from list.`)
      removeProcess(pid)
      if (currentPid.value === pid) {
        currentPid.value = null
      }
    } else {
      console.error('Failed to stop workflow:', err)
      alert('Failed to stop workflow.')
    }
  } finally {
    const next = new Set(stoppingPids.value)
    next.delete(pid)
    stoppingPids.value = next
  }
}
</script>

<template>
  <div class="flow-page" @dragover="onDragOver" @drop="onDrop">
    <div class="flow-container">
      <VueFlow
        id="main-flow"
        v-model:nodes="nodes"
        v-model:edges="edges"
        delete-key-code="Delete"
        :default-edge-options="{ markerEnd: MarkerType.ArrowClosed as unknown as string, type: selectedEdgeType }"
        :connect-on-click="false"
        fit-view-on-init
        @connect="onConnect"
        @nodeDragStop="onNodeDragStop"
      >
        <Background variant="dots" :gap="16" :size="1" />
        
        <!-- MiniMap -->
        <MiniMap pannable zoomable />
        
        <!-- Default Controls (zoom, fit, etc.) - Bottom Left -->
        <Controls position="bottom-left" />
        
        <!-- Header Card: Controls + Workflow Title -->
        <Panel position="top-center" class="flow-header-card">
          <div class="header-controls">
            <!-- Back to list -->
            <button class="control-btn" title="Back to workflows" @click="goBack">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <!-- Save/Export button -->
            <button class="control-btn" title="Save Diagram" @click="saveDiagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
            
            <!-- Screenshot button -->
            <button class="control-btn" title="Take Screenshot" @click="takeScreenshot">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            
            <!-- Toggle Palette button -->
            <button class="control-btn" title="Toggle Palette" @click="togglePalette">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="13.5" cy="6.5" r=".5"/>
                <circle cx="17.5" cy="10.5" r=".5"/>
                <circle cx="8.5" cy="7.5" r=".5"/>
                <circle cx="6.5" cy="12.5" r=".5"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
              </svg>
            </button>

            <!-- Toggle Log Drawer button -->
            <button
              class="control-btn"
              :class="{ active: showLogDrawer }"
              title="Toggle Flow Logs"
              @click="showLogDrawer = !showLogDrawer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
            
            <!-- Edge Line Type Selector button -->
            <button class="control-btn" title="Edge Line Type" @click="showEdgeSelector = !showEdgeSelector">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 16 17 22 11"/>
              </svg>
            </button>

            <!-- Divider -->
            <div class="header-divider"></div>

            <!-- Context Selector Dropdown -->
            <div class="context-selector-wrapper">
              <button
                class="control-btn context-dropdown-toggle"
                :class="{ active: showContextDropdown }"
                :title="selectedContextTitle"
                @click="showContextDropdown = !showContextDropdown"
              >
                <span class="context-label">{{ selectedContextTitle }}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              <!-- Context Dropdown Panel -->
              <div v-if="showContextDropdown" class="context-dropdown-panel">
                <div class="panel-header">
                  <span>Select Context</span>
                  <button @click="showContextDropdown = false" class="close-btn">×</button>
                </div>
                <div v-if="contextsLoading" class="dropdown-loading">Loading contexts…</div>
                <div v-else-if="contexts.length === 0" class="dropdown-empty">No contexts found.</div>
                <div v-else class="dropdown-list">
                  <button
                    v-for="ctx in contexts"
                    :key="ctx.id"
                    :class="{ active: selectedContextId === ctx.id }"
                    class="dropdown-item"
                    @click="selectContext(ctx.id)"
                  >
                    {{ ctx.title || 'Unnamed' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Start button -->
            <button
              class="control-btn run-btn start-btn"
              :class="{ running: isStarting }"
              :disabled="isStarting"
              title="Start Workflow"
              @click="handleStart"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>Start</span>
            </button>
          </div>
          
          <input
            v-model="workflowTitle"
            class="header-title-input"
            placeholder="Workflow Title"
            type="text"
          />
        </Panel>
        
        <!-- Register custom node type -->
        <template #node-custom="slotProps">
          <CustomNode v-bind="slotProps" />
        </template>



      <!-- Register pluginNative node type -->
      <template #node-pluginNative="slotProps">
        <PluginNativeNode
          v-bind="slotProps"
          @open-plugin-native-settings="openPluginNativeDrawer(slotProps.id as string)"
        />
      </template>

        <!-- Register code node type -->
        <template #node-code="slotProps">
          <CodeNode v-bind="slotProps" @open-code="openCodeDrawer(slotProps.id as string)" />
        </template>

      <!-- Register contract node type -->
      <template #node-contract="slotProps">
        <ContractNode
          v-bind="slotProps"
          @open-contract="openContractDrawer(slotProps.id as string)"
          @remove-handler="(handlerId: string) => removeHandlerEdges(slotProps.id as string, handlerId)"
        />
      </template>

      <!-- Register extrinsic node type -->
      <template #node-extrinsic="slotProps">
        <ExtrinsicNode
          v-bind="slotProps"
          @open-extrinsic-settings="openExtrinsicDrawer(slotProps.id as string)"
        />
      </template>

      <!-- Register goto node type -->
      <template #node-goto="slotProps">
        <GotoNode
          v-bind="slotProps"
          @open-goto-settings="openGotoDrawer(slotProps.id as string)"
        />
      </template>

      <!-- Register void node type -->
      <template #node-void="slotProps">
        <VoidNode v-bind="slotProps" />
      </template>

        <!-- Register start node type -->
      <template #node-startNode="slotProps">
        <StartNode v-bind="slotProps" />
      </template>

      <!-- Register my_a_ext node type -->
      <template #node-my_a_ext="slotProps">
        <MyAExtNode
          v-bind="slotProps"
          @open-settings="openMyAExtDrawer(slotProps.id as string)"
        />
      </template>

      <!-- Register custom edge type -->
        <template #edge-custom-edge="props">
          <CustomEdge v-bind="props" />
        </template>
      </VueFlow>

      <!-- Settings Drawer (Right Side) -->
      <transition name="drawer-fade">
        <div v-if="showDrawer" class="drawer-overlay" @click="onOverlayClick">
          <div class="settings-drawer" :style="{ width: drawerWidth + 'px' }" @click.stop>
            <div class="drawer-resize-bar" @mousedown.stop="startResize" title="Drag to resize"></div>
            <div class="drawer-header">
              <div class="drawer-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>
                  <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/>
                </svg>
                <span>Plugin Settings</span>
              </div>
              <button class="drawer-close" @click="closeDrawer" aria-label="Close settings">×</button>
            </div>
            <div class="drawer-body">
              <div v-if="selectedPluginNode" class="drawer-subtitle">
                <strong>{{ selectedPluginNode.data?.title }}</strong>
              </div>
              <JsonForms
                :data="pluginFormData"
                :schema="pluginJsonSchema as any"
                :uischema="pluginUiSchema as any"
                :renderers="renderers"
                @change="onFormChange"
              ></JsonForms>
            </div>
          </div>
        </div>
      </transition>

      <!-- Code Node Drawer -->
      <CodeDrawer v-model="showCodeDrawer" :node="selectedCodeNode" />

      <!-- Contract Node Drawer -->
      <ContractDrawer v-model="showContractDrawer" :node="selectedContractNode" />

      <!-- Extrinsic Node Drawer -->
      <ExtrinsicDrawer v-model="showExtrinsicDrawer" :node="selectedExtrinsicNode" />

      <!-- Goto Node Drawer -->
      <GotoDrawer v-model="showGotoDrawer" :node="selectedGotoNode" :flowId="props.id as string"/>

      <!-- Plugin Native Node Drawer -->
      <PluginNativeDrawer v-model="showPluginNativeDrawer" :node="selectedPluginNativeNode" />

      <!-- MyAExt Node Drawer -->
      <MyAExtDrawer v-model="showMyAExtDrawer" :node="selectedMyAExtNode" />

      <!-- Edge Type Selector Panel -->
      <div v-if="showEdgeSelector" class="edge-selector-panel">
        <div class="panel-header">
          <span>Edge Line Type</span>
          <button @click="showEdgeSelector = false" class="close-btn">×</button>
        </div>
        <div class="edge-types">
          <button
            v-for="type in edgeTypes"
            :key="type"
            :class="{ active: selectedEdgeType === type }"
            @click="changeEdgeType(type)"
            class="edge-type-btn"
          >
            {{ type }}
          </button>
        </div>
      </div>

      <!-- Floating palette overlay -->
      <NodePalette v-if="showPalette" />

      <!-- Flow Log Drawer (Bottom) -->
      <FlowLogDrawer
        v-model="showLogDrawer"
        v-model:focused-pid="visualisedPid"
        :messages="logMessages"
        :connected="socketState.connected"
        :connecting="socketState.connecting"
        :replaying="isReplaying"
        :replay-progress="replayProgress"
        @clear="clearMessages"
        @reconnect="connectSocket"
        @replay="startReplay"
        @stop-replay="stopReplay"
      />

      <!-- Running Processes Panel (Bottom Left) -->
      <RunningProcessesPanel
        :processes="runningProcesses"
        :stopping-pids="stoppingPids"
        @stop="handleStopProcess"
      />
    </div>
  </div>
</template>

<style scoped>
.flow-page {
  height: 100%;
  width: 100%;
}

.flow-container {
  height: 100%;
  width: 100%;
  position: relative;
}

  /* Custom node styles are in CustomNode.vue */
  :deep(.vue-flow__node-custom),
  :deep(.vue-flow__node-startNode),
  :deep(.vue-flow__node-plugin),
  :deep(.vue-flow__node-pluginNative),
  :deep(.vue-flow__node-code),
  :deep(.vue-flow__node-contract),
  :deep(.vue-flow__node-extrinsic),
  :deep(.vue-flow__node-goto),
  :deep(.vue-flow__node-void),
  :deep(.vue-flow__node-my_a_ext) {
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

/* ---- Settings Drawer ---- */
.settings-drawer {
  position: absolute;
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

.drawer-resize-bar {
  position: absolute;
  top: 0;
  left: -4px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 101;
  background: transparent;
}

.drawer-resize-bar:hover,
.drawer-resize-bar:active {
  background: var(--accent, #aa3bff);
  opacity: 0.25;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
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
  margin-bottom: 12px;
  padding-bottom: 8px;
  font-size: 13px;
  color: var(--accent, #aa3bff);
  border-bottom: 1px solid var(--border, #e5e4e7);
}

/* Drawer overlay */
.drawer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  z-index: 99;
  display: flex;
  justify-content: flex-end;
}

/* Drawer fade transition */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

/* Drawer slide transition (inner panel) */
.drawer-fade-enter-active .settings-drawer,
.drawer-fade-leave-active .settings-drawer {
  transition: transform 0.3s ease;
}

.drawer-fade-enter-from .settings-drawer,
.drawer-fade-leave-to .settings-drawer {
  transform: translateX(100%);
}

:deep(.vue-flow__edge-textbg) {
  fill: var(--bg, #fff);
}

:deep(.vue-flow__edge-text) {
  font-size: 12px;
}

/* Flow Header Card - Top Center */
.flow-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px;
  padding: 0 10px;
  height: 40px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.header-controls {
  display: flex;
  flex-direction: row;
  gap: 6px;
}

.header-title-input {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 180px;
  text-align: left;
}

.header-title-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

.header-title-input::placeholder {
  color: var(--text, #6b6375);
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.control-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 4px 12px rgba(170, 59, 255, 0.2);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Edge Selector Panel */
.edge-selector-panel {
  position: absolute;
  top: 72px;
  right: 80px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  z-index: 10;
  min-width: 160px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg, #fff);
  border-bottom: 1px solid var(--border, #e5e4e7);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.close-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.edge-types {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
}

.edge-type-btn {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
  text-transform: capitalize;
}

.edge-type-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--text-h, #08060d);
}

.edge-type-btn.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  font-weight: 600;
}

/* MiniMap styling - Dark theme compatible */
:deep(.vue-flow__minimap) {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
}

:deep(.vue-flow__minimap-mask) {
  fill: var(--accent-bg, rgba(170, 59, 255, 0.1));
  stroke: var(--accent, #aa3bff);
}

:deep(.vue-flow__minimap-node) {
  fill: var(--text, #6b6375);
  stroke: var(--border, #e5e4e7);
}

/* Default Controls styling - Dark theme compatible */
:deep(.vue-flow__controls) {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

:deep(.vue-flow__controls-button) {
  background: var(--bg, #fff);
  border-bottom: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
}

:deep(.vue-flow__controls-button:hover) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

:deep(.vue-flow__controls-button:last-child) {
  border-bottom: none;
}

:deep(.vue-flow__controls-button svg) {
  fill: currentColor;
}

/* ---- JSONForms vanilla theme overrides ---- */
:deep(.vertical-layout),
:deep(.horizontal-layout) {
  gap: 12px;
}

:deep(.group),
:deep(.generated-group) {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  background: var(--bg, #fff);
}

:deep(.group legend),
:deep(.group h3),
:deep(.generated-group label),
:deep(.generated-group h3) {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent, #aa3bff);
  margin-bottom: 8px;
  display: block;
}

:deep(.control),
:deep(.generated-control) {
  margin-bottom: 10px;
}

:deep(.control label),
:deep(.generated-control label) {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  margin-bottom: 4px;
}

:deep(.control input:not([type="checkbox"])),
:deep(.control select),
:deep(.control textarea),
:deep(.generated-control input:not([type="checkbox"])),
:deep(.generated-control select),
:deep(.generated-control textarea) {
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

:deep(.control input:focus),
:deep(.control select:focus),
:deep(.generated-control input:focus),
:deep(.generated-control select:focus) {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

:deep(.control input[type="checkbox"]) {
  accent-color: var(--accent, #aa3bff);
  width: 14px;
  height: 14px;
}

:deep(.control .help) {
  font-size: 11px;
  color: var(--text, #6b6375);
}

:deep(.control .errors),
:deep(.validation_error) {
  font-size: 11px;
  color: #ef4444;
  margin-top: 2px;
}

:deep(.array-list) {
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  padding: 4px;
  background: var(--bg, #fff);
}

:deep(.array-list-item) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
}

:deep(.array-list-item:last-child) {
  border-bottom: none;
}

:deep(.array-list-item-index) {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent, #aa3bff);
  display: block;
  margin-bottom: 6px;
}

/* Make every input inside array items match the theme exactly */
:deep(.array-list-item input:not([type="checkbox"])),
:deep(.array-list-item select),
:deep(.array-list-item textarea),
:deep(.vertical-layout input:not([type="checkbox"])),
:deep(.vertical-layout select),
:deep(.vertical-layout textarea),
:deep(.horizontal-layout input:not([type="checkbox"])),
:deep(.horizontal-layout select),
:deep(.generated-control input:not([type="checkbox"])),
:deep(.generated-control select),
:deep(.object-categories input:not([type="checkbox"])),
:deep(.object-categories select) {
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.4;
}

:deep(.array-list-item input:focus),
:deep(.array-list-item select:focus),
:deep(.vertical-layout input:focus),
:deep(.vertical-layout select:focus),
:deep(.horizontal-layout input:focus),
:deep(.horizontal-layout select:focus),
:deep(.generated-control input:focus),
:deep(.generated-control select:focus),
:deep(.object-categories input:focus),
:deep(.object-categories select:focus) {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 2px var(--accent-bg, rgba(170, 59, 255, 0.2));
}

:deep(.array-list-item label),
:deep(.generated-control label),
:deep(.vertical-layout .control label),
:deep(.object-categories label) {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  margin-bottom: 4px;
}

:deep(.array-list-item .control),
:deep(.array-list-item .generated-control),
:deep(.horizontal-layout .control),
:deep(.object-categories .control) {
  margin-bottom: 0;
}

/* ---- Array-list toolbar / collapsed items (Features box) ---- */
:deep(.array-list-item-toolbar) {
  display: flex;
  align-items: stretch;
  margin: 3px 0;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e4e7);
  overflow: hidden;
  background: var(--bg, #fff);
}

:deep(.array-list-item-label) {
  flex: 1;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  display: flex;
  align-items: center;
  height: auto;
  min-height: 32px;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.15s;
}

:deep(.array-list-item-label:hover) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.05));
}

:deep(.array-list-item-toolbar > button) {
  background: var(--bg, #fff);
  border: none;
  border-left: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
}

:deep(.array-list-item-toolbar > button:hover) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

:deep(.array-list-item-toolbar > button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--border, #e5e4e7);
}

:deep(.array-list-item-add) {
  padding: 5px 10px;
  border: 1px dashed var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent, #aa3bff);
  background: var(--bg, #fff);
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  justify-content: center;
}

:deep(.array-list-item-add:hover) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-style: solid;
}

:deep(.array-list-item-content) {
  padding: 10px 12px;
  display: block;
  border: 1px solid var(--border, #e5e4e7);
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: var(--bg, #fff);
  margin-bottom: 6px;
}

:deep(.array-list-noData) {
  font-size: 11px;
  color: var(--text, #6b6375);
  padding: 8px;
  text-align: center;
  border: 1px dashed var(--border, #e5e4e7);
  border-radius: 6px;
}

:deep(.array-list-item-depth) {
  font-size: 0.85em;
  color: var(--text, #6b6375);
}

:deep(.v-btn),
:deep(.v-button),
:deep(.array-list button),
:deep(.object-categories button),
:deep(.one-of button),
:deep(.jsonforms-vue-vanilla button) {
  padding: 5px 10px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text, #6b6375);
  background: var(--bg, #fff);
  cursor: pointer;
  transition: all 0.15s;
}

:deep(.v-btn:hover),
:deep(.array-list button:hover),
:deep(.object-categories button:hover),
:deep(.one-of button:hover) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

:deep(.one-of .listing) {
  margin-bottom: 8px;
}

:deep(.one-of .selected) {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

:deep(.jsonforms-vue-vanilla select) {
  height: 32px;
  width: 100%;
}

:deep(.required) {
  color: #ef4444;
  margin-left: 2px;
}

/* ---- Header Divider ---- */
.header-divider {
  width: 1px;
  height: 20px;
  background: var(--border, #e5e4e7);
  margin: 0 2px;
  align-self: center;
}

/* ---- Context Selector ---- */
.context-selector-wrapper {
  position: relative;
}

.context-dropdown-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 110px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
}

.context-dropdown-toggle .context-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-dropdown-toggle.active {
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}

/* Context Dropdown Panel */
.context-dropdown-panel {
  position: absolute;
  top: 36px;
  left: 0;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  z-index: 20;
  min-width: 180px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
}

.dropdown-loading,
.dropdown-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--text, #6b6375);
  text-align: center;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--text-h, #08060d);
}

.dropdown-item.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  font-weight: 600;
}

/* ---- Run Buttons (Start / Stop) ---- */
.run-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  width: auto;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  border: none;
}

.run-btn span {
  line-height: 1;
}

.start-btn {
  background: #22c55e;
  border-color: #22c55e;
}

.start-btn:hover {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.start-btn:disabled,
.start-btn.running {
  opacity: 0.7;
  cursor: wait;
}

.stop-btn {
  background: #ef4444;
  border-color: #ef4444;
}

.stop-btn:hover {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.stop-btn:disabled,
.stop-btn.running {
  opacity: 0.7;
  cursor: wait;
}

@media (max-width: 640px) {
  .settings-drawer {
    width: 100% !important;
  }
  .drawer-resize-bar {
    display: none;
  }
}
</style>
