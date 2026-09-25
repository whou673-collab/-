import { get } from '@vercel/blob'
import { AppError, errorResponse } from '@/lib/server/errors'
import { getOwnedAsset } from '@/lib/server/media'
import { requireUser } from '@/lib/server/session'
import { idSchema } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    const asset = await getOwnedAsset(userId, id)
    const result = await get(asset.pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
      abortSignal: AbortSignal.timeout(45_000),
    })
    if (!result) throw new AppError('图片暂时无法读取，请稍后重试。', 404)
    const headers = new Headers({
      'Cache-Control': 'private, no-cache',
      'Vary': 'Cookie',
      'ETag': result.blob.etag,
    })
    if (result.statusCode === 304) return new Response(null, { status: 304, headers })
    headers.set('Content-Type', asset.mediaType)
    headers.set('Content-Length', String(result.blob.size))
    if (new URL(request.url).searchParams.get('download') === '1') {
      const filename = `${asset.name.replace(/\.[^.]+$/, '')}.png`
      const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
      headers.set('Content-Disposition', `attachment; filename="huixu-${id}.png"; filename*=UTF-8''${encoded}`)
    }
    return new Response(result.stream, { headers })
  } catch (error) { return errorResponse(error) }
}
