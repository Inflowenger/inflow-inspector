<script setup lang="ts">
import { onMounted } from 'vue'
import { apiClient } from '../../api/client'
import { useApiQuery, useApiMutation } from '../../api/hooks'
import { ApiRequestError } from '../../api/errors'
import type { ApiResponse } from '../../api/types'

// ---------------------------------------------------------------------------
// Types for the example (replace with your real API types)
// ---------------------------------------------------------------------------
interface User {
  id: number
  name: string
  email: string
}

interface CreateUserPayload {
  name: string
  email: string
}

// ---------------------------------------------------------------------------
// 1) Direct usage – apiClient singleton
// ---------------------------------------------------------------------------
async function fetchUsersDirectly() {
  try {
    const res: ApiResponse<User[]> = await apiClient.get<User[]>('/users', {
      params: { page: 1, limit: 10 },
      timeout: 5_000,
    })
    console.log('Users:', res.data)
  } catch (err) {
    const apiErr = new ApiRequestError(err as any)
    if (apiErr.isUnauthorized) {
      // redirect to login …
    }
  }
}

// ---------------------------------------------------------------------------
// 2) Composable – auto-fetching GET query
// ---------------------------------------------------------------------------
const {
  data: users,
  error: usersError,
  loading: usersLoading,
  refresh: refreshUsers,
} = useApiQuery<User[]>('/users', {
  params: { page: 1, limit: 50 },
  immediate: true,
})

// ---------------------------------------------------------------------------
// 3) Composable – mutation (POST / PUT / PATCH / DELETE)
// ---------------------------------------------------------------------------
const { error: createError, loading: createLoading, mutate: createUser } =
  useApiMutation<User>('POST', '/users')

async function handleCreateUser() {
  const payload: CreateUserPayload = {
    name: 'Jane Doe',
    email: 'jane@example.com',
  }

  const res = await createUser(payload)

  if (res) {
    console.log('Created user:', res.data)
    // Optionally re-fetch the list
    await refreshUsers()
  }
}

// ---------------------------------------------------------------------------
// 4) Composable – DELETE example
// ---------------------------------------------------------------------------
const { loading: deleteLoading } = useApiMutation('DELETE', '/users/1')

async function handleDeleteUser(userId: number) {
  const res = await apiClient.delete(`/users/${userId}`)
  if (res.status === 204) {
    console.log('Deleted successfully')
    await refreshUsers()
  }
}

// ---------------------------------------------------------------------------
// 5) Manual useApi with a custom fetcher
// ---------------------------------------------------------------------------
import { useApi } from '../../api/hooks'

const { data: stats, execute: fetchStats } = useApi(() =>
  apiClient.get<{ total: number; active: number }>('/users/stats'),
)

onMounted(() => {
  fetchUsersDirectly()
  fetchStats()
})
</script>

<template>
  <div class="api-example">
    <h2>API Client Usage Example</h2>

    <!-- Loading state -->
    <div v-if="usersLoading" class="state loading">Loading users…</div>

    <!-- Error state -->
    <div v-else-if="usersError" class="state error">
      {{ usersError.message }}
      <button @click="() => refreshUsers()">Retry</button>
    </div>

    <!-- Data -->
    <div v-else>
      <ul v-if="users && users.length">
        <li v-for="user in users" :key="user.id">
          {{ user.name }} <{{ user.email }}>
        </li>
      </ul>
      <p v-else>No users found.</p>
    </div>

    <!-- Stats (manual fetch) -->
    <div v-if="stats" class="stats">
      Total: {{ stats.total }} · Active: {{ stats.active }}
    </div>

    <!-- Create button -->
    <button
      :disabled="createLoading"
      @click="handleCreateUser"
    >
      {{ createLoading ? 'Creating…' : 'Create User' }}
    </button>

    <!-- Delete button -->
    <button
      :disabled="deleteLoading"
      @click="handleDeleteUser(1)"
    >
      {{ deleteLoading ? 'Deleting…' : 'Delete User #1' }}
    </button>

    <!-- Error display -->
    <div v-if="createError" class="state error">
      Create failed: {{ createError.message }}
    </div>
  </div>
</template>

<style scoped>
.api-example {
  padding: 24px;
  font-family: sans-serif;
}

h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.state {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.loading {
  background: rgba(170, 59, 255, 0.08);
  color: var(--accent, #aa3bff);
}

.error {
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 12px;
}

.error button {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
}

li {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.stats {
  font-size: 13px;
  color: var(--text, #6b6375);
  margin-bottom: 16px;
}

button {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 6px;
  border: 2px solid var(--accent-border, rgba(170, 59, 255, 0.5));
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.15s;
}

button:hover:not(:disabled) {
  background: var(--accent, #aa3bff);
  color: #fff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>