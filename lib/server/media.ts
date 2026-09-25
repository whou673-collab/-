import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { del, get, put } from '@vercel/blob'
import { z } from 'zod'
import { getDb, lockUser } from '@/lib/db'
import { assets, generations } from '@/lib/db/schema'
import type { MediaAsset } from '@/lib/studio'
import { AppError } from './errors'
import { prepareImage, safeImageName } from './images'
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES, readLimitedBody, uploadSchema } from './validation'

type AssetRow = typeof assets.$inferSelect
export function presentAsset(asset: AssetRow): MediaAsset {
  return { id: asset.id, name: asset.name, width: asset.width, height: asset.height, url: `/api/media/${asset.id}` }
}
function assetPrefix(userId: string, id: string) {
  return `studio/${createHash('sha256').update(userId).digest('hex').slice(0, 24)}/${id}`
}

export async function reserveReference(userId: string, input: z.infer<typeof uploadSchema>) {
  return getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const [totals] = await tx.select({ total: count(), bytes: sql<number>`coalesce(sum(${assets.size}), 0)::float8` }).from(assets).where(eq(assets.userId, userId))
    if (totals.total >= 1000 || totals.bytes + input.size > 2 * 1024 * 1024 * 1024) throw new AppError('当前账户已达到图片存储上限，请先删除不需要的生成记录。', 429)
    const [recent] = await tx.select({ total: count() }).from(assets).where(and(eq(assets.userId, userId), sql`${assets.createdAt} > now() - interval '1 minute'`))
    if (recent.total >= 20) throw new AppError('上传过于频繁，请稍后再试。', 429)
    const id = randomUUID()
    const extension = input.mediaType === 'image/jpeg' ? 'jpg' : input.mediaType === 'image/webp' ? 'webp' : 'png'
    const pathname = `${assetPrefix(userId, id)}/source.${extension}`
    await tx.insert(assets).values({ id, userId, kind: 'reference', pathname, name: safeImageName(input.name), mediaType: input.mediaType, size: input.size })
    return { id, pathname }
  })
}

export async function getOwnedAsset(userId: string, id: string, ready = true) {
  const [asset] = await getDb().select().from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId), ready ? eq(assets.ready, true) : undefined)).limit(1)
  if (!asset) throw new AppError('图片不存在或你无权访问。', 404)
  return asset
}

export async function getUploadPermission(userId: string, id: string, pathname: string) {
  const asset = await getOwnedAsset(userId, id, false)
  if (asset.kind !== 'reference' || asset.ready || asset.pathname !== pathname || Date.now() - asset.createdAt.getTime() > 10 * 60_000) {
    throw new AppError('上传授权已失效，请重新选择图片。', 409)
  }
  return { mediaType: asset.mediaType, size: asset.size }
}

async function readPrivateImage(pathname: string, maxBytes: number) {
  const result = await get(pathname, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(45_000) })
  if (!result || result.statusCode !== 200) throw new AppError('图片暂时无法读取，请稍后重试。', 404)
  return readLimitedBody(new Response(result.stream, { headers: { 'Content-Length': String(result.blob.size) } }), maxBytes)
}

export async function completeReference(userId: string, id: string) {
  const completed = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`asset:${userId}:${id}`}))`)
    const [asset] = await tx.select().from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId), eq(assets.kind, 'reference'))).limit(1)
    if (!asset) throw new AppError('上传记录不存在。', 404)
    if (asset.ready) return { asset: presentAsset(asset), source: null }
    const bytes = await readPrivateImage(asset.pathname, MAX_UPLOAD_BYTES)
    const image = await prepareImage(bytes)
    const pathname = `${assetPrefix(userId, id)}/image.png`
    await put(pathname, image.bytes, { access: 'private', contentType: image.mediaType, addRandomSuffix: false, allowOverwrite: true })
    const [saved] = await tx.update(assets).set({ pathname, width: image.width, height: image.height, size: image.size, mediaType: image.mediaType, ready: true }).where(and(eq(assets.id, id), eq(assets.userId, userId))).returning()
    return { asset: presentAsset(saved), source: asset.pathname }
  })
  if (completed.source) await del(completed.source).catch(() => console.error('[studio] Temporary image cleanup deferred'))
  return completed.asset
}

export async function discardPendingReference(userId: string, id: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`asset:${userId}:${id}`}))`)
    const [asset] = await tx.select().from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId), eq(assets.kind, 'reference'), eq(assets.ready, false))).limit(1)
    if (!asset) return
    await del([asset.pathname, `${assetPrefix(userId, id)}/image.png`])
    await tx.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId), eq(assets.ready, false)))
  })
}

export async function readReferences(userId: string, ids: string[]) {
  if (!ids.length) return []
  const rows = await getDb().select().from(assets).where(and(eq(assets.userId, userId), eq(assets.kind, 'reference'), eq(assets.ready, true), inArray(assets.id, ids)))
  if (rows.length !== ids.length) throw new AppError('部分参考图已失效，请重新上传。', 422)
  const byId = new Map(rows.map((asset) => [asset.id, asset]))
  return Promise.all(ids.map((id) => readPrivateImage(byId.get(id)!.pathname, MAX_IMAGE_BYTES)))
}

export async function saveGeneratedImage(userId: string, generationId: string, bytes: Uint8Array, position: number) {
  const image = await prepareImage(bytes)
  const id = randomUUID()
  const pathname = `${assetPrefix(userId, id)}/image.png`
  await put(pathname, image.bytes, { access: 'private', contentType: image.mediaType, addRandomSuffix: false })
  try {
    await getDb().transaction(async (tx) => {
      await lockUser(tx, userId)
      const [generation] = await tx.select({ status: generations.status }).from(generations).where(and(eq(generations.id, generationId), eq(generations.userId, userId))).limit(1)
      if (generation?.status !== 'running') throw new AppError('生成任务已结束，未写入新的图片。', 409)
      await tx.insert(assets).values({ id, userId, pathname, kind: 'output', name: `huixu-${generationId.slice(0, 8)}-${position + 1}.png`, width: image.width, height: image.height, size: image.size, mediaType: image.mediaType, ready: true })
      await tx.update(generations).set({ outputIds: sql`array_append(${generations.outputIds}, ${id}::uuid)`, updatedAt: new Date() }).where(and(eq(generations.id, generationId), eq(generations.userId, userId), eq(generations.status, 'running')))
    })
  } catch (error) {
    const recorded = await getDb().select({ id: assets.id }).from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId))).catch(() => null)
    if (recorded && !recorded.length) await del(pathname).catch(() => undefined)
    throw error
  }
  return id
}
