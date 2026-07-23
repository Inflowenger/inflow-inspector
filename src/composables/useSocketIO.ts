import { ref, onUnmounted, shallowRef, type Ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import {
  createFlowTracker,
  describeEvent,
  type FlowTracker,
  type Level,
  type LogCategory,
  type LogDetail,
  type ProcEvent,
} from '@inflowenger/flow-trace'
import { apiClient } from '../api/client'

export type LogLevel = Level

/**
 * One line in the log drawer.
 *
 * `event` is the raw event exactly as the engine published it — the inspector's
 * job is to show what actually came off the wire, so nothing is dropped on the
 * way in. Everything else is derived for display.
 */
/**
 * One end of a routing decision — ids, because that is all the stream carries.
 *
 * Names live in the editor: resolve `node` (and `edgeId`, whose tags are its
 * label) against the saved graph at render time — see `useFlowGraphs`.
 */
export interface RouteEnd {
  /** The node id this branch lands on. */
  id: string
  /** The flow it lands in — the same flow, unless a GoTo crosses one. */
  flow?: string
  /** The graph's edge id. Empty for edges the runtime synthesised. */
  edgeId?: string
  /** The tags the runtime matched to reach this decision. */
  tags: string[]
}

/**
 * Where a routing decision went — an `edge.select` row's payload, rendered as a
 * route line rather than a sentence.
 *
 * `pruned` is what the runtime evaluated and rejected: worth showing, because
 * where the flow *didn't* go is usually why the log got opened.
 */
export interface LogRoute {
  from: RouteEnd
  taken: RouteEnd[]
  pruned: RouteEnd[]
  /** The tags a contract returned to make this choice. */
  reason?: string[]
}

export interface FlowLogMessage {
  id: string
  timestamp: number
  level: LogLevel
  /**
   * Human-readable one-liner, from flow-trace's `describeEvent`. It names nodes
   * and edges by **id**; pass it through `resolveRefs` to show titles.
   */
  message: string
  /** Present for events off the wire; absent for local notices (connect, etc.). */
  event?: ProcEvent
  pid?: string
  seq?: number
  kind?: string
  /**
   * Sub-kind of a `log` event, from `detail.category` — `progress` (a job
   * frame), `protocol` (an inflowV1 transport trace), or `dep.wait` /
   * `dep.ready` (a join node parking on its inbound branches, then released).
   * Absent for plain logs and for every non-log kind. Drives the badge so these
   * read as their own category.
   */
  category?: LogCategory
  src?: string
  flow?: string
  nodeId?: string
  nodeTitle?: string
  /** Set on `edge.select` only — the row renders as a route instead of text. */
  route?: LogRoute
}

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
}

let globalSocket: Socket | null = null

/** Cap on retained log lines. A looping flow emits without bound. */
const MAX_MESSAGES = 5000

/** Read one branch of an `edge.select`. Ids only — the wire carries no names. */
function routeEnd(edge: Record<string, any>): RouteEnd {
  return {
    id: String(edge?.node ?? ''),
    flow: edge?.flow ? String(edge.flow) : undefined,
    edgeId: edge?.edgeId ? String(edge.edgeId) : undefined,
    tags: Array.isArray(edge?.tags) ? edge.tags : [],
  }
}

/** The route an `edge.select` describes, or undefined for every other kind. */
function routeOf(event: ProcEvent): LogRoute | undefined {
  if (event.kind !== 'edge.select') return undefined
  const d = (event.detail ?? {}) as Record<string, any>
  return {
    from: { id: String(event.node ?? ''), flow: event.flow, tags: [] },
    taken: ((d.taken ?? []) as Record<string, any>[]).map(routeEnd),
    pruned: ((d.pruned ?? []) as Record<string, any>[]).map(routeEnd),
    reason: d.reason?.tags?.length ? (d.reason.tags as string[]) : undefined,
  }
}

export function useSocketIO() {
  const socket: Ref<Socket | null> = ref(null)
  const state = ref<SocketState>({
    connected: false,
    connecting: false,
    error: null,
  })
  const messages = ref<FlowLogMessage[]>([])
  const isOpen = ref(false)

  /**
   * The parser for the engine's event stream.
   *
   * shallowRef because the tracker owns mutable state internally and must not be
   * turned into a deep reactive proxy — subscribe to its events instead.
   */
  const tracker = shallowRef<FlowTracker>(createFlowTracker())

  function getBaseURL(): string {
    const base = apiClient['baseURL'] ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
    return base.replace(/\/$/, '')
  }

  function getAuthToken(): string | null {
    const authHeader = apiClient['defaultHeaders']?.['Authorization'] as string | undefined
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }
    return localStorage.getItem('inflow_auth_token')
  }

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function pushMessage(msg: Omit<FlowLogMessage, 'id'>): void {
    messages.value.push({ id: generateId(), ...msg })
    if (messages.value.length > MAX_MESSAGES) {
      messages.value.splice(0, messages.value.length - MAX_MESSAGES)
    }
  }

  /** A local notice — not from the engine, so it has no raw event. */
  function addMessage(msg: { level: LogLevel; message: string }): void {
    pushMessage({ timestamp: Date.now(), ...msg })
  }

  function clearMessages(): void {
    messages.value = []
  }

  // Every event the tracker accepts becomes a drawer line. Subscribing to
  // `event` (rather than the socket) means lines arrive in seq order, already
  // demultiplexed and validated.
  tracker.value.on('event', (event) => {
    const route = routeOf(event)
    pushMessage({
      timestamp: event.ts,
      level: event.level,
      message: describeEvent(event),
      event,
      pid: event.pid,
      seq: event.seq,
      kind: event.kind,
      category: event.kind === 'log' ? (event.detail as LogDetail | undefined)?.category : undefined,
      src: event.src,
      flow: event.flow,
      nodeId: event.node,
      // The only title on the wire: `node.enter` reports the compiled node's
      // title. Every other reference is resolved from the graph as it renders.
      nodeTitle: (event.detail as any)?.title,
      route,
    })
  })

  tracker.value.on('gap', ({ pid, from, count }) => {
    addMessage({
      level: 'warn',
      message: `Lost ${count} event${count === 1 ? '' : 's'} from #${from} (pid ${pid.slice(0, 8)}…)`,
    })
  })

  tracker.value.on('skip', ({ reason, input }) => {
    // A legacy event means the engine predates the v1 stream — worth saying
    // plainly rather than silently showing nothing.
    if (reason === 'legacy') {
      addMessage({
        level: 'warn',
        message: 'Ignored a pre-v1 log event — this engine predates the current log format.',
      })
      return
    }
    // Connection banners and other non-event traffic are normal; only surface
    // things that look like they were meant to be events.
    if (reason === 'malformed' || reason === 'unsupported-version') {
      addMessage({ level: 'warn', message: `Ignored an unusable event (${reason})` })
      return
    }
    if (typeof input === 'string' && input.length > 0) {
      addMessage({ level: 'debug', message: input })
    }
  })

  function connect(): void {
    if (socket.value?.connected) return
    if (state.value.connecting) return
    if (socket.value) {
      state.value.connecting = true
      state.value.error = null
      socket.value.connect()
      return
    }

    const baseURL = getBaseURL()
    const token = getAuthToken()

    if (!token) {
      state.value.error = 'No auth token available'
      return
    }

    state.value.connecting = true
    state.value.error = null

    const newSocket = io(baseURL, {
      transports: ['websocket'],
      path: '/ws/dev-panel',
      query: { Authorization: token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    newSocket.on('connect', () => {
      state.value.connected = true
      state.value.connecting = false
      state.value.error = null
      addMessage({ level: 'info', message: 'Connected to dev panel' })
    })

    newSocket.on('disconnect', (reason) => {
      state.value.connected = false
      state.value.connecting = false
      addMessage({ level: 'warn', message: `Disconnected: ${reason}` })
      // A dropped connection means any hole in the stream will never be filled;
      // don't leave processes stuck mid-flight behind it.
      tracker.value.flush()
    })

    newSocket.on('connect_error', (err) => {
      state.value.connected = false
      state.value.connecting = false
      state.value.error = err.message
      addMessage({ level: 'error', message: `Connection error: ${err.message}` })
    })

    // The engine's stream. inspector-api relays it verbatim, so everything the
    // engine publishes arrives here and the tracker decides what is usable.
    newSocket.on('message', (payload: unknown) => tracker.value.ingest(payload))
    newSocket.on('log', (payload: unknown) => tracker.value.ingest(payload))

    socket.value = newSocket
    globalSocket = newSocket
  }

  function disconnect(): void {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      globalSocket = null
    }
    state.value.connected = false
    state.value.connecting = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  onUnmounted(() => {
    if (socket.value && socket.value === globalSocket) {
      disconnect()
    }
  })

  return {
    socket,
    state,
    messages,
    isOpen,
    tracker,
    connect,
    disconnect,
    toggle,
    open,
    close,
    clearMessages,
    addMessage,
  }
}
