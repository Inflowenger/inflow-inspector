import { ref, onUnmounted, shallowRef, type Ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import {
  createFlowTracker,
  type FlowTracker,
  type Level,
  type ProcEvent,
} from '@inflowenger/flow-trace'
import { apiClient } from '../api/client'

export type LogLevel = Level | 'success'

/**
 * One line in the log drawer.
 *
 * `event` is the raw event exactly as the engine published it — the inspector's
 * job is to show what actually came off the wire, so nothing is dropped on the
 * way in. Everything else is derived for display.
 */
export interface FlowLogMessage {
  id: string
  timestamp: number
  level: LogLevel
  /** Human-readable one-liner. See `summarize`. */
  message: string
  /** Present for events off the wire; absent for local notices (connect, etc.). */
  event?: ProcEvent
  pid?: string
  seq?: number
  kind?: string
  src?: string
  flow?: string
  nodeId?: string
  nodeTitle?: string
}

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
}

let globalSocket: Socket | null = null

/** Cap on retained log lines. A looping flow emits without bound. */
const MAX_MESSAGES = 5000

function shortNode(flow?: string, node?: string): string {
  if (!flow || !node) return ''
  return `${flow}/${node}`
}

/**
 * A readable one-liner per event kind.
 *
 * The raw JSON is always one click away, so this optimises for scanning: what
 * happened, to which node, and why.
 */
function summarize(event: ProcEvent): string {
  const d = (event.detail ?? {}) as Record<string, any>
  switch (event.kind) {
    case 'proc.start':
      return `Process started at ${shortNode(d.flow, d.node)}`
    case 'proc.finish': {
      const ms = d.durationMs ?? 0
      if (d.status === 'completed') return `Process completed in ${ms}ms`
      if (d.status === 'stopped') return `Process stopped after ${ms}ms`
      return `Process failed after ${ms}ms${d.error ? `: ${d.error}` : ''}`
    }
    case 'node.enter': {
      const attempt = d.attempt > 1 ? ` (attempt ${d.attempt})` : ''
      return `→ ${d.title ?? event.node} entered${attempt}`
    }
    case 'node.exit': {
      if (d.status === 'error') return `✕ exited with error: ${d.error ?? 'unknown'}`
      return `✓ exited ok in ${d.durationMs ?? 0}ms`
    }
    case 'edge.select': {
      const taken = (d.taken ?? []) as Array<{ node: string }>
      const pruned = (d.pruned ?? []) as Array<{ node: string }>
      const reason = d.reason?.tags?.length ? ` on [${d.reason.tags.join(', ')}]` : ''
      if (taken.length === 0) return `Routed nowhere${reason}`
      const targets = taken.map((t) => t.node).join(', ')
      const skipped = pruned.length > 0 ? `, skipped ${pruned.length}` : ''
      return `Routed to ${targets}${reason}${skipped}`
    }
    case 'flow.jump':
      return `Jumped to ${shortNode(d.to?.flow, d.to?.node)}${
        d.ret ? `, returns at ${shortNode(d.ret.flow, d.ret.node)}` : ''
      }`
    case 'log':
      return String(d.msg ?? '')
    default:
      // An unknown kind from a newer engine — show it rather than hide it.
      return `${event.kind}`
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
  const lastFinishEvent = ref<{ pid: string; time: number; status: string } | null>(null)

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
    pushMessage({
      timestamp: event.ts,
      level: event.level,
      message: summarize(event),
      event,
      pid: event.pid,
      seq: event.seq,
      kind: event.kind,
      src: event.src,
      flow: event.flow,
      nodeId: event.node,
      nodeTitle: (event.detail as any)?.title,
    })
  })

  tracker.value.on('finish', ({ pid, status, at }) => {
    lastFinishEvent.value = { pid, status, time: at }
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
    lastFinishEvent,
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
