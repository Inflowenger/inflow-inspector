import { ref, onUnmounted, type Ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { apiClient } from '../api/client'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success'

export interface FlowLogMessage {
  id: string
  timestamp: number
  level: LogLevel
  stage?: string
  message: string
  nodeId?: string
  nodeTitle?: string
  data?: unknown
}

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
}

let globalSocket: Socket | null = null

export function useSocketIO() {
  const socket: Ref<Socket | null> = ref(null)
  const state = ref<SocketState>({
    connected: false,
    connecting: false,
    error: null,
  })
  const messages = ref<FlowLogMessage[]>([])
  const isOpen = ref(false)
  const lastFinishEvent = ref<{ pid: string; time: number } | null>(null)

  function getBaseURL(): string {
    const base = apiClient['baseURL'] ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
    return base.replace(/\/$/, '')
  }

  function getAuthToken(): string | null {
    // Try to get token from apiClient's default headers
    const authHeader = apiClient['defaultHeaders']?.['Authorization'] as string | undefined
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }
    // Fallback to localStorage
    return localStorage.getItem('inflow_auth_token')
  }

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function addMessage(msg: Omit<FlowLogMessage, 'id' | 'timestamp'>): void {
    messages.value.push({
      id: generateId(),
      timestamp: Date.now(),
      ...msg,
    })
  }

  function clearMessages(): void {
    messages.value = []
  }

  function extractFinishPid(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const obj = payload as Record<string, unknown>

    // Case 1: top-level finish
    if (obj.type === 'finish' && typeof obj.pid === 'string') {
      return obj.pid
    }

    // Case 2: finish nested inside payload.message as an object
    if (obj.message && typeof obj.message === 'object') {
      const msg = obj.message as Record<string, unknown>
      if (msg.type === 'finish' && typeof msg.pid === 'string') {
        return msg.pid
      }
    }

    // Case 3: finish nested inside payload.message as a JSON string
    if (typeof obj.message === 'string') {
      try {
        const parsed = JSON.parse(obj.message)
        if (parsed && typeof parsed === 'object' && parsed.type === 'finish' && typeof parsed.pid === 'string') {
          return parsed.pid
        }
      } catch {
        // Not JSON — ignore
      }
    }

    return null
  }

  function checkForFinish(payload: unknown): void {
    const pid = extractFinishPid(payload)
    if (pid) {
      lastFinishEvent.value = { pid, time: Date.now() }
    }
  }

  function connect(): void {
    // Already connected — nothing to do.
    if (socket.value?.connected) return
    // A connection attempt is already in flight — don't start another.
    if (state.value.connecting) return
    // An existing socket that's disconnected — reuse it instead of creating a
    // new one (otherwise the old socket is orphaned and we leak a connection).
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

    const socketURL = `${baseURL}`

    const newSocket = io(socketURL, {
      transports: ['websocket'],
      path: '/ws/dev-panel',
      query: {
        Authorization: token,
      },
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
    })

    newSocket.on('connect_error', (err) => {
      state.value.connected = false
      state.value.connecting = false
      state.value.error = err.message
      addMessage({ level: 'error', message: `Connection error: ${err.message}` })
    })

    // Generic log message handler
    newSocket.on('log', (payload: { level?: LogLevel; message: string; stage?: string; nodeId?: string; nodeTitle?: string; data?: unknown }) => {
      checkForFinish(payload)
      addMessage({
        level: payload.level ?? 'info',
        message: payload.message,
        stage: payload.stage,
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
        data: payload.data,
      })
    })

    // Stage update handler
    newSocket.on('stage', (payload: { stage: string; message: string; nodeId?: string; nodeTitle?: string; data?: unknown }) => {
      checkForFinish(payload)
      addMessage({
        level: 'info',
        message: payload.message,
        stage: payload.stage,
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
        data: payload.data,
      })
    })

    // Notification handler
    newSocket.on('notification', (payload: { level?: LogLevel; message: string; data?: unknown }) => {
      checkForFinish(payload)
      addMessage({
        level: payload.level ?? 'info',
        message: payload.message,
        data: payload.data,
      })
    })

    // Flow execution events
    newSocket.on('flow:start', (payload: { flowId: string; message?: string }) => {
      checkForFinish(payload)
      addMessage({
        level: 'success',
        message: payload.message ?? `Flow started: ${payload.flowId}`,
        stage: 'start',
      })
    })

    newSocket.on('flow:end', (payload: { flowId: string; message?: string; success?: boolean }) => {
      checkForFinish(payload)
      addMessage({
        level: payload.success === false ? 'error' : 'success',
        message: payload.message ?? `Flow ended: ${payload.flowId}`,
        stage: 'end',
      })
    })

    // Node execution events
    newSocket.on('node:start', (payload: { nodeId: string; nodeTitle?: string; message?: string }) => {
      checkForFinish(payload)
      addMessage({
        level: 'info',
        message: payload.message ?? `Node started: ${payload.nodeTitle ?? payload.nodeId}`,
        stage: 'node-start',
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
      })
    })

    newSocket.on('node:end', (payload: { nodeId: string; nodeTitle?: string; message?: string; success?: boolean }) => {
      checkForFinish(payload)
      addMessage({
        level: payload.success === false ? 'error' : 'info',
        message: payload.message ?? `Node ended: ${payload.nodeTitle ?? payload.nodeId}`,
        stage: 'node-end',
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
      })
    })

    // Dedicated handler for 'message' events (server sends logs via this event)
    newSocket.on('message', (payload: { level?: LogLevel; message?: unknown; stage?: string; nodeId?: string; nodeTitle?: string; data?: unknown; type?: string; pid?: string }) => {
      checkForFinish(payload)
      const rawMsg = payload.message !== undefined ? payload.message : payload
      const messageStr = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg, null, 2)
      addMessage({
        level: payload.level ?? 'info',
        message: messageStr,
        stage: payload.stage,
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
        data: payload.data,
      })
    })

    // Catch-all for unknown events (treat as log)
    newSocket.onAny((eventName: string, ...args: unknown[]) => {
      // Skip internal socket.io events and already handled events
      const knownEvents = ['connect', 'disconnect', 'connect_error', 'log', 'stage', 'notification', 'flow:start', 'flow:end', 'node:start', 'node:end', 'message']
      if (knownEvents.includes(eventName)) return

      const payload = args[0] as Record<string, unknown> | undefined
      checkForFinish(payload)
      if (payload && typeof payload === 'object') {
        const rawMsg = payload.message !== undefined ? payload.message : args[0]
        const messageStr = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg, null, 2)
        addMessage({
          level: (payload.level as LogLevel) ?? 'info',
          message: messageStr,
          stage: payload.stage as string | undefined,
          nodeId: payload.nodeId as string | undefined,
          nodeTitle: payload.nodeTitle as string | undefined,
          data: payload.data as object | undefined,
        })
      } else {
        addMessage({
          level: 'info',
          message: `[${eventName}] ${JSON.stringify(args)}`,
        })
      }
    })

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
    // Only disconnect if this is the active socket instance
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
    connect,
    disconnect,
    toggle,
    open,
    close,
    clearMessages,
    addMessage,
  }
}
