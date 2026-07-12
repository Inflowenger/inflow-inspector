import { ref, type Ref } from 'vue'
import { apiClient } from './client'
import { toApiError, ApiRequestError } from './errors'
import type { ApiResponse, RequestConfig } from './types'

// ---------------------------------------------------------------------------
// useApi – generic composable for a single request
// ---------------------------------------------------------------------------

export interface UseApiState<T> {
  data: Ref<T | null>
  error: Ref<ApiRequestError | null>
  loading: Ref<boolean>
}

export function useApi<T = unknown>(
  fetcher: () => Promise<ApiResponse<T>>,
): UseApiState<T> & { execute: () => Promise<ApiResponse<T> | undefined> } {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<ApiRequestError | null>(null)
  const loading = ref(false)

  async function execute(): Promise<ApiResponse<T> | undefined> {
    loading.value = true
    error.value = null

    try {
      const response = await fetcher()
      data.value = response.data as T
      return response
    } catch (err) {
      const apiErr = toApiError(err)
      error.value = apiErr
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { data, error, loading, execute }
}

// ---------------------------------------------------------------------------
// useApiQuery – auto-fetching composable for GET-like requests
// ---------------------------------------------------------------------------

export interface UseApiQueryOptions {
  immediate?: boolean
}

export function useApiQuery<T = unknown>(
  url: string,
  config?: RequestConfig & UseApiQueryOptions,
) {
  const { immediate = true, ...requestConfig } = config ?? {}

  const state = useApi<T>(() => apiClient.get<T>(url, requestConfig))

  if (immediate) {
    state.execute()
  }

  return {
    ...state,
    /**
     * Re-fetch the query with optional new config.
     */
    refresh: (newConfig?: RequestConfig) => {
      const cfg = newConfig ?? requestConfig
      return apiClient.get<T>(url, cfg).then((res) => {
        state.data.value = res.data as T
        state.error.value = null
        return res
      }).catch((err) => {
        state.error.value = toApiError(err)
        return undefined
      })
    },
  }
}

// ---------------------------------------------------------------------------
// useApiMutation – composable for POST / PUT / PATCH / DELETE
// ---------------------------------------------------------------------------

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function useApiMutation<T = unknown>(
  method: MutationMethod,
  url: string,
) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<ApiRequestError | null>(null)
  const loading = ref(false)

  async function mutate(
    body?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T> | undefined> {
    loading.value = true
    error.value = null

    try {
      let response: ApiResponse<T>

      switch (method) {
        case 'POST':
          response = await apiClient.post<T>(url, body, config)
          break
        case 'PUT':
          response = await apiClient.put<T>(url, body, config)
          break
        case 'PATCH':
          response = await apiClient.patch<T>(url, body, config)
          break
        case 'DELETE':
          response = await apiClient.delete<T>(url, config)
          break
      }

      data.value = response.data as T
      return response
    } catch (err) {
      const apiErr = toApiError(err)
      error.value = apiErr
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { data, error, loading, mutate }
}