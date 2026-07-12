import type { JsonSchema } from '@jsonforms/core'

export const pluginJsonSchema: JsonSchema = {
  type: 'object',
  title: 'Plugin Configuration',
  properties: {
    connection: {
      type: 'object',
      title: 'Connection Settings',
      properties: {
        protocol: {
          type: 'string',
          enum: ['http', 'https', 'ws', 'wss'],
          default: 'https',
        },
        host: { type: 'string', default: 'localhost' },
        port: { type: 'integer', minimum: 1, maximum: 65535, default: 443 },
        timeout: { type: 'integer', minimum: 0, default: 30 },
        enabled: { type: 'boolean', default: true },
      },
      required: ['protocol', 'host', 'port'],
    },
    features: {
      type: 'array',
      title: 'Active Features',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          priority: { type: 'integer', minimum: 0, maximum: 10 },
        },
        required: ['name'],
      },
    },
    authentication: {
      oneOf: [
        {
          title: 'API Key',
          type: 'object',
          properties: {
            kind: { type: 'string', const: 'apiKey' },
            apiKey: { type: 'string', format: 'password' },
          },
          required: ['apiKey'],
        },
        {
          title: 'OAuth2',
          type: 'object',
          properties: {
            kind: { type: 'string', const: 'oauth2' },
            clientId: { type: 'string' },
            clientSecret: { type: 'string', format: 'password' },
            scope: { type: 'string' },
          },
          required: ['clientId', 'clientSecret'],
        },
      ],
    },
    condition: {
      type: 'object',
      title: 'Conditional Rule',
      properties: {
        field: { type: 'string' },
        operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt', 'contains'] },
        value: { type: 'string' },
      },
      required: ['field', 'operator'],
    },
  },
}

export const pluginSampleData = {
  connection: { protocol: 'https', host: 'api.example.com', port: 443, enabled: true },
  features: [{ name: 'Rate Limit', priority: 5 }, { name: 'Retry', priority: 3 }],
  authentication: { kind: 'oauth2', clientId: '', clientSecret: '', scope: 'read' },
  condition: { field: 'status', operator: 'eq' },
}

export const pluginUiSchema = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Group',
      label: 'Connection',
      elements: [
        {
          type: 'HorizontalLayout',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/connection/properties/protocol',
              label: 'Protocol',
              'x-inflow-ui': {
                action: { name: 'refreshForm' },
                button: { position: 'append', icon: '↻', label: 'Refresh' }
              }
            },
            {
              type: 'Control',
              scope: '#/properties/connection/properties/host',
              label: 'Host',
            },
            {
              type: 'Control',
              scope: '#/properties/connection/properties/port',
              label: 'Port',
            },
          ],
        },
        {
          type: 'Control',
          scope: '#/properties/connection/properties/timeout',
          label: 'Timeout (seconds)',
        },
        {
          type: 'Control',
          scope: '#/properties/connection/properties/enabled',
          label: 'Enabled',
        },
      ],
    },
    {
      type: 'Group',
      label: 'Features',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/features',
          options: {
            showSortButtons: true,
            showAddButton: true,
            showRemoveButton: true,
          },
        },
      ],
    },
    {
      type: 'Group',
      label: 'Authentication',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/authentication',
          options: { detail: 'GENERATED' },
        },
      ],
    },
    {
      type: 'Group',
      label: 'Condition',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/condition',
          options: { detail: 'GENERATED' },
        },
      ],
    },
  ],
}
