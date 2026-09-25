import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { getDb, lockUser } from '@/lib/db'
import { assets, connections, generations } from '@/lib/db/schema'
import type { Generation } from '@/lib/studio'
import { AppError } from './errors'
import { presentAsset } from './media'
import { generationSchema } from './validation'

export const INTERRUPTED_MESSAGE = '任务未能在安全时限内完成，已停止自动等待。服务商可能已处理请求，请先核对调用记录，避免重复计费。'
const activeStatuses = ['queued', 'running'] as const

export async function expireStaleGenerations(userId: string) {
  await getDb().update(generations).set({ status: 'failed', error: INTERRUPTED_MESSAGE, updatedAt: new Date() }).where(and(eq(generations.userId, userId), inArray(generations.status, [...activeStatuses]), lt(generations.updatedAt, new Date(Date.now() - 15 * 60_000))))
}

export async function reserveGeneration(userId: string, input: z.infer<typeof generationSchema>) {
  await expireStaleGenerations(userId)
  const { requestId, ...parameters } = input
  const requestHash = createHash('sha256').update(JSON.stringify(parameters)).digest('hex')
  return getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const [existing] = await tx.select().from(generations).where(and(eq(generations.userId, userId), eq(generations.requestId, requestId))).limit(1)
    if (existing) {
      if (existing.requestHash !== requestHash) throw new AppError('同一次提交不能使用不同的参数，请重新发起创作。', 409)
      return { id: existing.id, created: false }
    }
    const active = await tx.select({ id: generations.id }).from(generations).where(and(eq(generations.userId, userId), inArray(generations.status, [...activeStatuses]))).limit(1)
    if (active.length) throw new AppError('已有一项任务正在生成，请完成后再提交，避免误触重复计费。', 409)
    const [recent] = await tx.select({ total: count() }).from(generations).where(and(eq(generations.userId, userId), sql`${generations.createdAt} > now() - interval '1 hour'`))
    if (recent.total >= 60) throw new AppError('已达到每小时 60 次的安全提交上限，请稍后再试。', 429)
    const [connection] = await tx.select({ models: connections.models }).from(connections).where(and(eq(connections.id, input.connectionId), eq(connections.userId, userId))).limit(1)
    if (!connection || !connection.models.some((model) => model.id === input.model)) throw new AppError('请选择当前账户已保存的连接与模型。', 422)
    if (input.referenceIds.length) {
      const found = await tx.select({ id: assets.id }).from(assets).where(and(eq(assets.userId, userId), eq(assets.kind, 'reference'), eq(assets.ready, true), inArray(assets.id, input.referenceIds)))
      if (found.length !== input.referenceIds.length) throw new AppError('部分参考图不可用或不属于当前账户。', 422)
    }
    const [storage] = await tx.select({ bytes: sql<number>`coalesce(sum(${assets.size}), 0)::float8`, total: count() }).from(assets).where(eq(assets.userId, userId))
    if (storage.bytes + input.count * 20 * 1024 * 1024 > 2 * 1024 * 1024 * 1024 || storage.total + input.count > 1000) throw new AppError('当前账户图片存储空间不足，请先删除不需要的生成记录。', 422)
    const id = randomUUID()
    await tx.insert(generations).values({ id, userId, ...parameters, requestId, requestHash })
    return { id, created: true }
  })
}

export async function recordRun(userId: string, id: string, runId: string) {
  await getDb().update(generations).set({ runId }).where(and(eq(generations.id, id), eq(generations.userId, userId)))
}

export async function getGeneration(userId: string, id: string) {
  const [row] = await getDb().select().from(generations).where(and(eq(generations.id, id), eq(generations.userId, userId))).limit(1)
  if (!row) throw new AppError('生成记录不存在或无权访问。', 404)
  return row
}

export async function claimGeneration(userId: string, id: string) {
  const [claimed] = await getDb().update(generations).set({ status: 'running', updatedAt: new Date() }).where(and(eq(generations.id, id), eq(generations.userId, userId), eq(generations.status, 'queued'))).returning()
  return claimed
}

export async function finishGeneration(userId: string, id: string, status: 'completed' | 'failed', error: string | null) {
  await getDb().update(generations).set({ status, error, updatedAt: new Date() }).where(and(eq(generations.id, id), eq(generations.userId, userId), inArray(generations.status, [...activeStatuses])))
}

export async function listGenerations(userId: string, offset: number): Promise<{ items: Generation[]; hasMore: boolean }> {
  await expireStaleGenerations(userId)
  const rows = await getDb().select().from(generations).where(eq(generations.userId, userId)).orderBy(desc(generations.createdAt), desc(generations.id)).offset(offset).limit(25)
  const page = rows.slice(0, 24)
  const ids = [...new Set(page.flatMap((row) => [...row.outputIds, ...row.referenceIds]))]
  const media = ids.length ? await getDb().select().from(assets).where(and(eq(assets.userId, userId), eq(assets.ready, true), inArray(assets.id, ids))) : []
  const byId = new Map(media.map((row) => [row.id, presentAsset(row)]))
  return {
    items: page.map((row) => ({
      id: row.id, connectionId: row.connectionId, model: row.model, prompt: row.prompt, negativePrompt: row.negativePrompt,
      size: row.size, count: row.count, status: row.status, error: row.error, favorite: row.favorite,
      createdAt: row.createdAt.toISOString(), assets: row.outputIds.flatMap((id) => byId.get(id) || []), references: row.referenceIds.flatMap((id) => byId.get(id) || []),
    })),
    hasMore: rows.length > 24,
  }
}

export async function favoriteGeneration(userId: string, id: string, favorite: boolean) {
  const found = await getDb().update(generations).set({ favorite }).where(and(eq(generations.id, id), eq(generations.userId, userId))).returning({ id: generations.id })
  if (!found.length) throw new AppError('生成记录不存在。', 404)
}

export async function deleteGeneration(userId: string, id: string) {
  await getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const [generation] = await tx.select().from(generations).where(and(eq(generations.id, id), eq(generations.userId, userId))).limit(1)
    if (!generation) return
    if (generation.status === 'running' || generation.status === 'queued') throw new AppError('正在运行的任务不能删除，请等待任务完成。', 409)
    if (generation.outputIds.length) {
      const outputs = await tx.select().from(assets).where(and(eq(assets.userId, userId), eq(assets.kind, 'output'), inArray(assets.id, generation.outputIds)))
      if (outputs.length) await del(outputs.map((asset) => asset.pathname))
      await tx.delete(assets).where(and(eq(assets.userId, userId), eq(assets.kind, 'output'), inArray(assets.id, generation.outputIds)))
    }
    await tx.delete(generations).where(and(eq(generations.id, id), eq(generations.userId, userId)))
  })
}
