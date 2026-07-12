<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthDialog from '../auth/AuthDialog.vue'

const sidebarCollapsed = ref(false)
const showAuthDialog = ref(false)

const route = useRoute()
const router = useRouter()

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const isWorkflowsActive = computed(() => {
  return route.name === 'workflows' || route.name === 'workflow-new' || route.name === 'workflow-edit'
})

const isContextsActive = computed(() => {
  return route.name === 'contexts' || route.name === 'context-new' || route.name === 'context-view'
})

const isResourcesActive = computed(() => {
  return route.name === 'resources' || route.name === 'portal-view'
})

const isSpacesActive = computed(() => {
  return route.name === 'spaces' || route.name === 'space-new' || route.name === 'space-view'
})

const isExtensionsActive = computed(() => {
  return route.name === 'extensions' || route.name === 'extension-new' || route.name === 'extension-view'
})

function goToWorkflows() {
  router.push({ name: 'workflows' })
}

function goToContexts() {
  router.push({ name: 'contexts' })
}

function goToResources() {
  router.push({ name: 'resources' })
}

function goToSpaces() {
  router.push({ name: 'spaces' })
}

function goToExtensions() {
  router.push({ name: 'extensions' })
}
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <button class="menu-btn" @click="toggleSidebar" title="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span class="app-title">InFlow</span>
      </div>
      <div class="header-right">
        <button
          class="auth-trigger-btn"
          title="Authentication"
          @click="showAuthDialog = true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
        <span class="badge">v0.1.0</span>
      </div>
    </header>

    <div class="body">
      <!-- Left Sidebar -->
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <nav class="sidebar-nav">
          <a
            href="#"
            class="nav-item"
            :class="{ active: isWorkflowsActive }"
            title="Workflows"
            @click.prevent="goToWorkflows"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span v-show="!sidebarCollapsed">Workflows</span>
          </a>
          <a
            href="#"
            class="nav-item"
            :class="{ active: isContextsActive }"
            title="Contexts"
            @click.prevent="goToContexts"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33" />
              <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6" />
            </svg>
            <span v-show="!sidebarCollapsed">Contexts</span>
          </a>
          <a
            href="#"
            class="nav-item"
            :class="{ active: isExtensionsActive }"
            title="Extensions"
            @click.prevent="goToExtensions"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.5 7.5a2.5 2.5 0 0 1-2.5 2.5h-1v3h1a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5h-1v-3h-1v3h-3v-1h-3v1h-3v-3h1v-1h-3v1h-3v-3h1a2.5 2.5 0 0 1 2.5-2.5h1v-3h-1a2.5 2.5 0 0 1-2.5-2.5v-1a2.5 2.5 0 0 1 2.5-2.5h1v3h1v-3h3v1h3v-1h3v3h-1v1h3v-1h3v3h-1z" />
            </svg>
            <span v-show="!sidebarCollapsed">Extensions</span>
          </a>
          <div class="sidebar-divider push-bottom half-right" v-show="!sidebarCollapsed"></div>
          <div class="infra-section-header" v-show="!sidebarCollapsed">
            <div class="infra-section-header-left">
              <svg class="infra-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="13" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="7" x2="6.01" y2="7" />
                <line x1="6" y1="17" x2="6.01" y2="17" />
              </svg>
              <div class="infra-titles">
                <span class="infra-title">Infra</span>
                <span class="infra-subtitle">inflowenger Infra</span>
              </div>
            </div>
            <button
              class="infra-auth-btn"
              title="Authentication"
              @click="showAuthDialog = true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
          </div>
          <div class="sidebar-divider half-right" v-show="!sidebarCollapsed"></div>
          <a
            href="#"
            class="nav-item"
            :class="{ active: isResourcesActive }"
            title="Resources"
            @click.prevent="goToResources"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span v-show="!sidebarCollapsed">Resources</span>
          </a>
          <a
            href="#"
            class="nav-item"
            :class="{ active: isSpacesActive }"
            title="Spaces"
            @click.prevent="goToSpaces"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span v-show="!sidebarCollapsed">Spaces</span>
          </a>
        </nav>

      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <router-view />
      </main>
    </div>

    <!-- Footer -->
    <footer class="app-footer">
      <span>&copy; 2026 InFlowenger</span>
      <span class="footer-right">Built by Inflowenger Dev Team</span>
    </footer>
  </div>

  <AuthDialog v-model="showAuthDialog" />
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
}

/* ---- Header ---- */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--bg, #fff);
  border-bottom: 1px solid var(--border, #e5e4e7);
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-h, #08060d);
  cursor: pointer;
  transition: background 0.15s;
}

.menu-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}

.app-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h, #08060d);
  letter-spacing: 0.5px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  font-weight: 600;
}

.auth-trigger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-trigger-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}

/* ---- Body (sidebar + main) ---- */
.body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ---- Sidebar ---- */
.sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
  transition: width 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed {
  width: 52px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
  flex: 1;
  min-height: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text, #6b6375);
  font-size: 14px;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--text-h, #08060d);
}

.nav-item.active {
  background: var(--accent-bg, rgba(170, 59, 255, 0.15));
  color: var(--accent, #aa3bff);
  font-weight: 600;
}

.sidebar-divider {
  height: 1px;
  background: var(--border, #e5e4e7);
  margin: 8px 12px;
}

.sidebar-divider.half-right {
  width: 50%;
  margin-left: auto;
}

.push-bottom {
  margin-top: auto;
}

.nav-item-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.nav-item-subtitle {
  font-size: 11px;
  opacity: 0.65;
}

/* ---- Main Content ---- */
.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ---- Footer ---- */
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 16px;
  font-size: 12px;
  border-top: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
  flex-shrink: 0;
  color: var(--text, #6b6375);
}

.footer-right {
  opacity: 0.6;
}

/* ---- Infra Section Header ---- */
.infra-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  gap: 6px;
}

.infra-section-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.infra-icon {
  color: var(--text-muted, #8f8a99);
  flex-shrink: 0;
}

.infra-titles {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.infra-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.infra-subtitle {
  font-size: 11px;
  color: var(--text-muted, #8f8a99);
}

.infra-auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted, #8f8a99);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.infra-auth-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
}
</style>
