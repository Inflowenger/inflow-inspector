import type { ApiResponse, ApiError, RequestConfig, ApiClientConfig } from './types'

export class ApiClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>
  private timeout: number

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/+$/, '')
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.defaultHeaders,
    }
    this.timeout = config.timeout ?? 30_000
  }

  setBaseURL(url: string): void {
    this.baseURL = url.replace(/\/+$/, '')
  }

  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers }
  }

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization']
  }

  // ---------------------------------------------------------------------------
  // HTTP methods
  // ---------------------------------------------------------------------------

  async get<T = unknown>(
    url: string,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, undefined, config)
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, body, config)
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, body, config)
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, body, config)
  }

  async delete<T = unknown>(
    url: string,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, config)
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    const finalURL = this.buildURL(url, config)
    const headers = this.buildHeaders(config)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout ?? this.timeout)

    try {
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      }

      if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
        init.body = JSON.stringify(body)
      }

      const response = await fetch(finalURL, init)

      clearTimeout(timeoutId)

      const apiResponse = await this.parseResponse<T>(response, config)

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          data: apiResponse.data,
        }
        throw error
      }

      return apiResponse
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw {
          message: 'Request timed out',
          status: 0,
          statusText: 'Timeout',
        } satisfies ApiError
      }

      // Re-throw ApiErrors as-is
      if (this.isApiError(error)) {
        throw error
      }

      // Network or other errors
      throw {
        message: error instanceof Error ? error.message : 'Unknown network error',
        status: 0,
        statusText: 'NetworkError',
      } satisfies ApiError
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildURL(url: string, config?: RequestConfig): string {
    // If the url is absolute, use it as-is; otherwise prepend baseURL
    const base = url.startsWith('http://') || url.startsWith('https://')
      ? ''
      : this.baseURL

    let finalURL = `${base}${url.startsWith('/') ? url : `/${url}`}`

    if (config?.params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      }
      const qs = searchParams.toString()
      if (qs) {
        finalURL += `${finalURL.includes('?') ? '&' : '?'}${qs}`
      }
    }

    return finalURL
  }

  private buildHeaders(config?: RequestConfig): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...config?.headers,
    }
  }

  private async parseResponse<T>(
    response: Response,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    let data: T

    const responseType = config?.responseType ?? 'json'

    switch (responseType) {
      case 'blob':
        data = (await response.blob()) as unknown as T
        break
      case 'text':
        data = (await response.text()) as unknown as T
        break
      case 'arraybuffer':
        data = (await response.arrayBuffer()) as unknown as T
        break
      case 'json':
      default: {
        // Try to parse JSON; fall back to text if body is empty
        const text = await response.text()
        data = text ? (JSON.parse(text) as T) : (null as T)
        break
      }
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }
  }

  private isApiError(error: unknown): error is ApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'statusText' in error &&
      'message' in error
    )
  }
}

// Singleton instance – configure it before use
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 30_000,
})

// Restore persisted auth state from localStorage (browser-only)
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem('inflow_auth_token')
  const savedURL = localStorage.getItem('inflow_auth_url')
  if (savedToken) {
    apiClient.setAuthToken(savedToken)
  }
  if (savedURL) {
    apiClient.setBaseURL(savedURL)
  }
}
