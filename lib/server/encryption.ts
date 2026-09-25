import 'server-only'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { AppError } from './errors'

export function encryptionReady() {
  return (process.env.API_KEY_ENCRYPTION_SECRET?.length || 0) >= 32
}

function encryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length < 32) throw new AppError('服务端密钥加密尚未配置，暂时不能保存 API 连接。', 503)
  return Buffer.from(hkdfSync('sha256', secret, 'huixu-studio-v1', 'provider-key-encryption', 32))
}

export function encryptApiKey(value: string, userId: string, connectionId: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(`${userId}:${connectionId}`))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptApiKey(value: string, userId: string, connectionId: string) {
  const key = encryptionKey()
  try {
    const [version, nonce, tag, ciphertext, extra] = value.split('.')
    if (version !== 'v1' || !nonce || !tag || !ciphertext || extra) throw new Error('InvalidEnvelope')
    const iv = Buffer.from(nonce, 'base64url')
    const authTag = Buffer.from(tag, 'base64url')
    if (iv.length !== 12 || authTag.length !== 16) throw new Error('InvalidEnvelope')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(`${userId}:${connectionId}`))
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new AppError('无法解密此连接的密钥，请重新添加 API 连接。', 503)
  }
}

export function keyHint(value: string) {
  return value.length > 8 ? `•••• ${value.slice(-4)}` : '••••'
}
