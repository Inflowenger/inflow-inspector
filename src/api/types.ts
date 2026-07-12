export interface ApiResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Headers
}

export interface ApiError {
  message: string
  status: number
  statusText: string
  data?: unknown
}

export interface PaginatedResponse<T> {
  data: {
    list: T[]
    next: string
  },
  error:ApiError
}

// ---------------------------------------------------------------------------
// Space / Account types
// ---------------------------------------------------------------------------

export interface SpacePolicyImport {
  account: string
  name: string
  subject: string
  type: string
}

export interface SpacePolicyExport {
  name: string
  subject: string
  type: string
}

export interface SpacePolicy {
  imports?: SpacePolicyImport[]
  exports?: SpacePolicyExport[]
  connection_limit?: number
}

export interface SpaceSpec {
  builtin?: boolean
  signer_pub?: string
  signer_seed?: string
  signer_prv?: string
  sys_user_jwt?: string
  sys_account_jwt?: string
}

export interface SpaceSummary {
  id: string
  name: string
  seed: string
  pub: string
  policy: SpacePolicy | null
  spec: SpaceSpec | null
  createdAt: number
  status: number
}

export interface SpaceCredentialRequest {
  name: string
  sub: {
    allow: string[]
    deny: string[]
  }
  pub: {
    allow: string[]
    deny: string[]
  }
}

export interface RequestConfig {
  baseURL?: string
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined | null>
  timeout?: number
  responseType?: 'json' | 'blob' | 'text' | 'arraybuffer'
}

export interface ApiClientConfig {
  baseURL: string
  defaultHeaders?: Record<string, string>
  timeout?: number
}

// ---------------------------------------------------------------------------
// Portal types
// ---------------------------------------------------------------------------

export interface Account {
  id: string
  name: string
  seed: string
  pub: string
  policy: null | Record<string, unknown>
  spec: {
    builtin?: boolean
  } | null
  createdAt: number
  status: number
}

export interface Portal {
  id: string
  title: string
  subscribe_prefix: string
  path: string
  jwt_secret: string
  config: null | Record<string, unknown>
  tags: string[]
  status: number
  account: Account
}

export interface PortalCreateRequest {
  title: string
  path: string
  accountId: string
  subscribe_prefix: string
  jwt_secret: string
  config: null | Record<string, unknown>
  tags: string[]
  status: number
}

export interface PortalUpdateRequest {
  title?: string
  subscribe_prefix?: string
  accountId?: string
  jwt_secret?: string
  config?: Record<string, unknown> | null
  tags?: string[]
  status?: number
}

export interface Resource {
  id: string
  name: string
  url: string
  tags: string[]
  portal: Portal
  createdAt: number
  last_login: number
  count: number
}

// ---------------------------------------------------------------------------
// Extension types
// ---------------------------------------------------------------------------

export type ExtensionType = 'extrinsic' | 'plugin'

export interface Icon {
  class: string
  name: string
  meta?: Record<string, any>
}

export interface FormParameters {
  schema: Record<string, any>
  ui: Record<string, any>
}

export interface Bind {
  topic_key: string
  values: Record<string, string>
}

export interface ExtensionRecord {
  id: string
  type: ExtensionType
  name: string
  description: string
  icon: Icon
  params: FormParameters
  bindTo: Bind
  createdAt: number
  updatedAt: number
}

export interface ExtensionSummary {
  id: string
  name: string
  type: ExtensionType
  description: string
  createdAt: number
  updatedAt: number
}
