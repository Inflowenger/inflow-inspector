import { ref, computed } from 'vue'
import { apiClient } from '../api/client'
import { signJwtHS256, decodeJwtPayload } from '../utils/jwt'

const AUTH_TOKEN_KEY = 'inflow_auth_token'
const AUTH_URL_KEY = 'inflow_auth_url'

const token = ref<string | null>(null)
const baseURL = ref<string | null>(null)
const showAuthDialog = ref(false)

export interface AuthState {
  isAuthenticated: boolean
  token: string | null
  baseURL: string | null
}

function openAuthDialog(): void {
  showAuthDialog.value = true
}

// Module-level init (runs once on first import, browser-only): restore any
// persisted credentials, wire up the 401 handler, and prompt for auth when
// no credentials are saved.
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
  const storedURL = localStorage.getItem(AUTH_URL_KEY)
  if (storedToken) {
    token.value = storedToken
    apiClient.setAuthToken(storedToken)
  }
  if (storedURL) {
    baseURL.value = storedURL
    apiClient.setBaseURL(storedURL)
  }

  // Any request that comes back 401 re-opens the auth dialog.
  apiClient.setUnauthorizedHandler(openAuthDialog)

  // No credentials saved yet — prompt immediately.
  if (!storedToken) {
    openAuthDialog()
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)

  async function authenticate(url: string, jwtTokenValue: string): Promise<void> {
    baseURL.value = url
    token.value = jwtTokenValue

    apiClient.setBaseURL(url)
    apiClient.setAuthToken(jwtTokenValue)

    localStorage.setItem(AUTH_TOKEN_KEY, jwtTokenValue)
    localStorage.setItem(AUTH_URL_KEY, url)
  }

  async function generateAndAuthenticate(url: string, secret: string): Promise<void> {
    const payload = { admin: true }
    const signedToken = await signJwtHS256(payload, secret)
    return authenticate(url, signedToken)
  }

  function logout(): void {
    token.value = null
    baseURL.value = null
    apiClient.clearAuthToken()
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_URL_KEY)
  }

  function getDecodedPayload(): Record<string, unknown> | null {
    if (!token.value) return null
    return decodeJwtPayload(token.value)
  }

  return {
    token,
    baseURL,
    isAuthenticated,
    showAuthDialog,
    openAuthDialog,
    authenticate,
    generateAndAuthenticate,
    logout,
    getDecodedPayload,
  }
}
