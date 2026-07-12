/**
 * Browser-native JWT signing using Web Crypto API (HS256)
 */

function base64urlEncode(str: string): string {
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): string {
  // Restore standard Base64 padding
  const padding = '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding
  return atob(base64)
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function signJwtHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()

  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64urlEncode(JSON.stringify(header))
  const payloadB64 = base64urlEncode(JSON.stringify(payload))

  const signingInput = `${headerB64}.${payloadB64}`

  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput))

  const signatureB64 = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  )

  return `${headerB64}.${payloadB64}.${signatureB64}`
}

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(base64urlDecode(parts[1])) as T
  } catch {
    return null
  }
}
