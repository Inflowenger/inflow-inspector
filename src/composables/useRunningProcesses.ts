import { ref, computed } from 'vue'

export interface RunningProcess {
  pid: string
  selectedResource: Record<string, any>
  startTime: number
  flowId: string
  contextId: string
}

const processes = ref<RunningProcess[]>([])

export function useRunningProcesses() {
  const runningProcesses = computed(() => processes.value)

  function addProcess(process: RunningProcess) {
    // Avoid duplicates
    const exists = processes.value.some((p) => p.pid === process.pid)
    if (!exists) {
      processes.value.push(process)
    }
  }

  function removeProcess(pid: string) {
    processes.value = processes.value.filter((p) => p.pid !== pid)
  }

  function getProcess(pid: string): RunningProcess | undefined {
    return processes.value.find((p) => p.pid === pid)
  }

  function clearAll() {
    processes.value = []
  }

  return {
    runningProcesses,
    addProcess,
    removeProcess,
    getProcess,
    clearAll,
  }
}
