import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, lockUser } from '@/lib/db'
import { connections, generations } from '@/lib/db/schema'
import type { Connection } from '@/lib/studio'
import { encryptApiKey, decryptApiKey, keyHint } from './encryption'
import { AppError } from './errors'
import { discoverModels, mergeModels } from './models'
import { connectionSchema } from './validation'

const publicColumns = { id: connections.id, name: connections.name, baseUrl: connections.baseUrl, keyHint: connections.keyHint, models: connections.models, createdAt: connections.createdAt }

export async function listConnections(userId: string): Promise<Connection[]> {
  const rows = await getDb().select(publicColumns).from(connections).where(eq(connections.userId, userId)).orderBy(desc(connections.createdAt))
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function createConnection(userId: string, input: z.infer<typeof connectionSchema>) {
  const discovered = await discoverModels(input.baseUrl, input.apiKey)
  const models = mergeModels(discovered.models, input.manualModels)
  if (!models.length) throw new AppError('没有可用的模型 ID，请手动补充服务商提供的模型名称。', 422)
  const id = randomUUID()
  const encryptedKey = encryptApiKey(input.apiKey, userId, id)
  await getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const rows = await tx.select({ id: connections.id }).from(connections).where(eq(connections.userId, userId)).limit(20)
    if (rows.length >= 20) throw new AppError('最多保存 20 个 API 连接，请先删除不需要的连接。', 422)
    await tx.insert(connections).values({ id, userId, name: input.name, baseUrl: discovered.baseUrl, encryptedKey, keyHint: keyHint(input.apiKey), models })
  })
  return { id, warning: discovered.warning }
}

export async function getConnectionSecret(userId: string, id: string) {
  const [connection] = await getDb().select().from(connections).where(and(eq(connections.id, id), eq(connections.userId, userId))).limit(1)
  if (!connection) throw new AppError('API 连接不存在，请重新选择或添加。', 404)
  return { ...connection, apiKey: decryptApiKey(connection.encryptedKey, userId, id) }
}

export async function refreshModels(userId: string, id: string) {
  const connection = await getConnectionSecret(userId, id)
  const result = await discoverModels(connection.baseUrl, connection.apiKey)
  const models = mergeModels(result.models, connection.models.filter((model) => model.source === 'manual').map((model) => model.id))
  if (!models.length) throw new AppError(result.warning || '没有获取到模型，保留之前的列表。', 422)
  const rows = await getDb().update(connections).set({ models, updatedAt: new Date() }).where(and(eq(connections.id, id), eq(connections.userId, userId))).returning({ id: connections.id })
  if (!rows.length) throw new AppError('此连接已被删除。', 404)
  return { models, warning: result.warning }
}

export async function deleteConnection(userId: string, id: string) {
  await getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const active = await tx.select({ id: generations.id }).from(generations).where(and(eq(generations.userId, userId), eq(generations.connectionId, id), inArray(generations.status, ['queued', 'running']))).limit(1)
    if (active.length) throw new AppError('此连接仍有生成任务，请等待任务结束后再删除。', 409)
    await tx.delete(connections).where(and(eq(connections.id, id), eq(connections.userId, userId)))
  })
}
