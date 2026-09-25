import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'AppError'
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status)
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message || '提交的参数不正确。' }, 400)
  if (error instanceof SyntaxError) return json({ error: '请求内容不是有效的 JSON。' }, 400)
  // Never log provider responses: they can contain prompts, credentials or image data.
  console.error('[studio] Request failed:', error instanceof Error ? error.name : 'UnknownError')
  return json({ error: '服务暂时不可用，请稍后重试。' }, 503)
}
