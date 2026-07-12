<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '../../composables/useAuth'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const { authenticate, generateAndAuthenticate, isAuthenticated, logout, baseURL: storedURL } = useAuth()

const serverUrl = ref('')
const bearerToken = ref('')
const sharedSecret = ref('')
const error = ref('')
const loading = ref(false)
const showSecret = ref(false)
const activeTab = ref<'token' | 'secret'>('secret')

watch(() => props.modelValue, (open) => {
  if (open) {
    error.value = ''
    serverUrl.value = storedURL.value || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8025'
    bearerToken.value = ''
    sharedSecret.value = ''
  }
})

function close() {
  emit('update:modelValue', false)
}

async function handleLogin() {
  error.value = ''

  if (!serverUrl.value.trim()) {
    error.value = 'Base Server URL is required'
    return
  }

  // Simple URL validation
  try {
    new URL(serverUrl.value)
  } catch {
    error.value = 'Please enter a valid URL (e.g., http://localhost:8025)'
    return
  }

  loading.value = true

  try {
    const url = serverUrl.value.trim().replace(/\/+$/, '')

    if (activeTab.value === 'secret') {
      if (!sharedSecret.value.trim()) {
        error.value = 'Shared Secret is required for HS256 token generation'
        loading.value = false
        return
      }
      await generateAndAuthenticate(url, sharedSecret.value.trim())
    } else {
      if (!bearerToken.value.trim()) {
        error.value = 'Bearer Token is required'
        loading.value = false
        return
      }
      await authenticate(url, bearerToken.value.trim())
    }

    close()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Authentication failed'
  } finally {
    loading.value = false
  }
}

function handleLogout() {
  logout()
  close()
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="auth-dialog-backdrop" @click="onBackdropClick">
        <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
          <div class="auth-dialog-header">
            <h2 id="auth-dialog-title" class="auth-dialog-title">
              {{ isAuthenticated ? 'Authentication' : 'API Authentication' }}
            </h2>
            <button class="auth-dialog-close" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="auth-dialog-body">
            <div v-if="isAuthenticated" class="auth-authenticated">
              <div class="auth-status">
                <div class="auth-status-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p class="auth-status-text">You are authenticated.</p>
                <p v-if="storedURL" class="auth-status-url">{{ storedURL }}</p>
              </div>
              <button class="auth-btn auth-btn-danger" @click="handleLogout">Log Out</button>
            </div>

            <div v-else class="auth-form">
              <label class="auth-field">
                <span class="auth-label">Base Server URL</span>
                <input
                  v-model="serverUrl"
                  class="auth-input"
                  type="text"
                  placeholder="https://api.example.com"
                  @keydown.enter="handleLogin"
                />
              </label>

              <!-- Tabs -->
              <div class="auth-tabs">
                <button
                  class="auth-tab"
                  :class="{ active: activeTab === 'secret' }"
                  @click="activeTab = 'secret'"
                >
                  Shared Secret
                </button>
                <button
                  class="auth-tab"
                  :class="{ active: activeTab === 'token' }"
                  @click="activeTab = 'token'"
                >
                  Bearer Token
                </button>
              </div>

              <div v-if="activeTab === 'secret'" class="auth-tab-panel">
                <label class="auth-field">
                  <span class="auth-label">Shared Secret Key</span>
                  <div class="auth-input-wrapper">
                    <input
                      v-model="sharedSecret"
                      class="auth-input"
                      :type="showSecret ? 'text' : 'password'"
                      placeholder="your-shared-secret"
                      @keydown.enter="handleLogin"
                    />
                    <button
                      type="button"
                      class="auth-input-suffix"
                      tabindex="-1"
                      @click="showSecret = !showSecret"
                    >
                      {{ showSecret ? 'Hide' : 'Show' }}
                    </button>
                  </div>
                  <span class="auth-hint">Generates a JWT with payload &#123; admin: true &#125; using HS256.</span>
                </label>
              </div>

              <div v-else class="auth-tab-panel">
                <label class="auth-field">
                  <span class="auth-label">Bearer Token (JWT)</span>
                  <textarea
                    v-model="bearerToken"
                    class="auth-input auth-textarea"
                    rows="3"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                  <span class="auth-hint">Paste an existing JWT token to use directly.</span>
                </label>
              </div>

              <p v-if="error" class="auth-error">{{ error }}</p>

              <button
                class="auth-btn auth-btn-primary"
                :disabled="loading"
                @click="handleLogin"
              >
                {{ loading ? 'Authenticating...' : 'Authenticate' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 6, 13, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.auth-dialog {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(8, 6, 13, 0.18);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
}

.auth-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.auth-dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h, #08060d);
  margin: 0;
}

.auth-dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-dialog-close:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

.auth-dialog-body {
  padding: 20px;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h, #08060d);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.auth-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border, #c7c4cc);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.auth-input:focus {
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px rgba(170, 59, 255, 0.12);
}

.auth-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-input-wrapper .auth-input {
  padding-right: 56px;
}

.auth-input-suffix {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--accent, #aa3bff);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.auth-input-suffix:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}

.auth-textarea {
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
}

.auth-hint {
  font-size: 12px;
  color: var(--text-muted, #8f8a99);
}

/* Tabs */
.auth-tabs {
  display: flex;
  gap: 4px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
  padding: 4px;
  border-radius: 8px;
}

.auth-tab {
  flex: 1;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #6b6375);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-tab.active {
  background: var(--bg, #fff);
  color: var(--accent, #aa3bff);
  box-shadow: 0 1px 3px rgba(8, 6, 13, 0.08);
}

.auth-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Buttons */
.auth-btn {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.05s;
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-btn-primary {
  background: var(--accent, #aa3bff);
  color: #fff;
}

.auth-btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.auth-btn-danger {
  background: rgba(230, 57, 70, 0.1);
  color: #e63946;
}

.auth-btn-danger:hover {
  background: rgba(230, 57, 70, 0.18);
}

/* Error */
.auth-error {
  margin: 0;
  font-size: 13px;
  color: #e63946;
  background: rgba(230, 57, 70, 0.08);
  padding: 8px 10px;
  border-radius: 6px;
}

/* Authenticated state */
.auth-authenticated {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.auth-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.auth-status-icon {
  color: #2a9d8f;
}

.auth-status-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-h, #08060d);
}

.auth-status-url {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted, #8f8a99);
  word-break: break-all;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-active .auth-dialog,
.fade-leave-active .auth-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .auth-dialog,
.fade-leave-to .auth-dialog {
  transform: translateY(-12px) scale(0.98);
  opacity: 0;
}
</style>
