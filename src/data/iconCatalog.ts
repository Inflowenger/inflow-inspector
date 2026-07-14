/**
 * Curated icon catalog for the extension icon picker.
 *
 * Icons are rendered with @iconify/vue, which addresses every icon as
 * `<collection>:<name>` (e.g. `mdi:web`). That maps directly onto the backend
 * `Icon { class, name }` model — we store `class = collection id`, `name = icon
 * name`. MDI is the same convention the plugin SDK uses for action icons.
 *
 * This is a curated subset (not the full sets, which are thousands of icons) so
 * the picker stays fast and the names are known-good. Add more names freely.
 */

export interface IconCollection {
  /** Iconify prefix — stored as icon.class */
  id: string
  /** Display label for the collection tab */
  label: string
  /** Icon names — stored as icon.name */
  icons: string[]
}

export const iconCollections: IconCollection[] = [
  {
    id: 'mdi',
    label: 'Material',
    icons: [
      'web', 'api', 'database', 'cloud-outline', 'server', 'server-network',
      'cog-outline', 'key-variant', 'lock-outline', 'email-outline', 'bell-outline',
      'code-tags', 'code-braces', 'connection', 'webhook', 'puzzle', 'puzzle-outline',
      'lightning-bolt', 'rocket-launch-outline', 'robot-outline', 'chart-line',
      'chart-bar', 'file-document-outline', 'account-outline', 'calendar-clock',
      'clock-outline', 'link-variant', 'send', 'sync', 'refresh', 'filter-outline',
      'magnify', 'folder-outline', 'tag-outline', 'shield-check-outline', 'wifi',
      'sitemap-outline', 'currency-usd', 'credit-card-outline', 'bank-outline',
      'map-marker-outline', 'message-outline', 'star-outline', 'download', 'upload',
      'share-variant', 'cloud-upload-outline', 'cloud-download-outline',
    ],
  },
  {
    id: 'lucide',
    label: 'Lucide',
    icons: [
      'globe', 'database', 'cloud', 'server', 'settings', 'key', 'lock', 'mail',
      'bell', 'code', 'cable', 'webhook', 'puzzle', 'rocket', 'bot', 'zap',
      'line-chart', 'bar-chart-3', 'file-text', 'user', 'calendar', 'clock', 'link',
      'send', 'refresh-cw', 'filter', 'search', 'folder', 'tag', 'shield',
      'shield-check', 'wifi', 'workflow', 'network', 'git-branch', 'terminal', 'cpu',
      'box', 'package', 'layers', 'plug', 'share-2', 'download', 'upload',
    ],
  },
  {
    id: 'heroicons',
    label: 'Heroicons',
    icons: [
      'globe-alt', 'circle-stack', 'cloud', 'server', 'cog-6-tooth', 'key',
      'lock-closed', 'envelope', 'bell', 'code-bracket', 'puzzle-piece',
      'rocket-launch', 'bolt', 'chart-bar', 'document-text', 'user', 'calendar',
      'clock', 'link', 'paper-airplane', 'arrow-path', 'funnel', 'magnifying-glass',
      'folder', 'tag', 'shield-check', 'wifi', 'cpu-chip', 'squares-2x2',
      'command-line', 'cube', 'share',
    ],
  },
  {
    id: 'fa6-brands',
    label: 'Brands',
    icons: [
      'github', 'gitlab', 'bitbucket', 'slack', 'jira', 'atlassian', 'aws',
      'google', 'docker', 'stripe', 'discord', 'linkedin', 'x-twitter', 'microsoft',
      'windows', 'apple', 'android', 'npm', 'node-js', 'python', 'java', 'react',
      'vuejs', 'git-alt', 'salesforce', 'shopify', 'paypal', 'mailchimp', 'telegram',
      'whatsapp',
    ],
  },
]

/** Default icon used when an extension has none set. */
export const DEFAULT_ICON_CLASS = 'mdi'
export const DEFAULT_ICON_NAME = 'puzzle'
