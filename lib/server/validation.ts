import { z } from 'zod'
import { AppError } from './errors'

export const MAX_REFERENCES = 6
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
export const imageSizeSchema = z.enum(['1024x1024', '1536x1024', '1024x1536'])
export const idSchema = z.uuid({ error: '记录 ID 不正确。' })
const modelIdSchema = z.string().trim().min(1, '请填写模型 ID。').max(200).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), '模型 ID 不能包含控制字符。')
const endpointSchema = z.string().trim().min(1, '请填写 API 地址。').max(2048)
const apiKeySchema = z.string().trim().min(1, '请填写 API 密钥。').max(4096).refine((value) => !/[\r\n\u0000]/.test(value), 'API 密钥格式不正确。')

export const discoverySchema = z.object({ baseUrl: endpointSchema, apiKey: apiKeySchema })
export const connectionSchema = discoverySchema.extend({
  name: z.string().trim().min(1, '请填写连接名称。').max(60),
  manualModels: z.array(modelIdSchema).max(40, '最多手动添加 40 个模型。').default([]),
})
export const generationSchema = z.object({
  connectionId: idSchema,
  model: modelIdSchema,
  prompt: z.string().trim().min(1, '请先描述画面。').max(12000, '提示词不能超过 12000 个字符。'),
  negativePrompt: z.string().trim().max(3000).default(''),
  size: imageSizeSchema,
  count: z.number().int().min(1).max(4, '一次最多生成 4 张图片。'),
  referenceIds: z.array(idSchema).max(MAX_REFERENCES).default([]).refine((ids) => new Set(ids).size === ids.length, '参考图不能重复。'),
  requestId: idSchema,
})
export const favoriteSchema = z.object({ favorite: z.boolean() }).strict()

export async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > maxBytes) {
    await response.body?.cancel()
    throw new AppError('文件或 API 响应超出大小限制。', 413)
  }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const parts: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) {
        await reader.cancel()
        throw new AppError('文件或 API 响应超出大小限制。', 413)
      }
      parts.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.byteLength }
  return result
}

export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AppError('请使用 JSON 提交请求。', 415)
  }
  const bytes = await readLimitedBody(new Response(request.body, { headers: request.headers }), maxBytes)
  return JSON.parse(new TextDecoder().decode(bytes))
}
