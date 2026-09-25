import 'server-only'
import { generateImage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { FormData as UndiciFormData } from 'undici'
import { z } from 'zod'
import type { ImageSize } from '@/lib/studio'
import { AppError } from './errors'
import { safeFetch, normalizeApiBase } from './outbound'
import { providerStatusError } from './models'
import { MAX_IMAGE_BYTES, readLimitedBody } from './validation'

const imageResponse = z.object({
  data: z.array(z.object({ b64_json: z.string().optional(), url: z.string().max(8192).optional() })).min(1).max(4),
})

function normalizeEditBody(body: BodyInit | null | undefined) {
  if (!(body instanceof globalThis.FormData)) return body
  const normalized = new UndiciFormData()
  let imageIndex = 0
  for (const [key, value] of body.entries()) {
    if (key !== 'image' && key !== 'image[]') {
      normalized.append(key, value)
      continue
    }
    imageIndex += 1
    if (value instanceof Blob) {
      const extension = value.type === 'image/jpeg' ? 'jpg' : value.type.split('/')[1] || 'png'
      normalized.append('image', value, `reference-${imageIndex}.${extension}`)
    } else {
      normalized.append('image', value)
    }
  }
  return normalized
}

export function validateImageBase64(value: string) {
  if (!value.length || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new AppError('服务商返回的图像数据无效或超出 20 MB 限制。', 502)
  }
  const decoded = Buffer.from(value, 'base64')
  if (!decoded.length || decoded.length > MAX_IMAGE_BYTES) throw new AppError('服务商返回的图像超过大小限制。', 502)
  return value
}

export async function normalizeImageResponse(response: Response, count: number, signal?: AbortSignal | null) {
  const parsed = imageResponse.safeParse(await response.json().catch(() => null))
  if (!parsed.success || parsed.data.data.length > count) throw new AppError('服务商返回的结果不符合 OpenAI Images 格式。', 502)
  const data: { b64_json: string }[] = []
  for (const image of parsed.data.data) {
    if (image.b64_json) data.push({ b64_json: validateImageBase64(image.b64_json) })
    else if (image.url) {
      const download = await safeFetch(image.url, { signal }, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 40_000, maxRedirects: 3 })
      if (!download.ok) throw new AppError('图片已经生成，但服务商提供的下载地址暂时不可用。', 502)
      const bytes = await readLimitedBody(download, MAX_IMAGE_BYTES)
      data.push({ b64_json: Buffer.from(bytes).toString('base64') })
    } else throw new AppError('服务商没有返回图片数据或下载地址。', 502)
  }
  return Response.json({ data })
}

export async function generateProviderImages(input: {
  baseUrl: string; apiKey: string; model: string; prompt: string; negativePrompt: string
  size: ImageSize; count: number; references: Uint8Array[]; requestId: string
}) {
  const baseUrl = normalizeApiBase(input.baseUrl)
  const signal = AbortSignal.timeout(240_000)
  const provider = createOpenAI({
    baseURL: baseUrl,
    apiKey: input.apiKey,
    fetch: async (request, init) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url
      const isGeneration = url === `${baseUrl}/images/generations`
      const isEdit = url === `${baseUrl}/images/edits`
      if ((!isGeneration && !isEdit) || init?.method !== 'POST') throw new AppError('已阻止非预期的模型请求。', 400)
      const requestUrl = isEdit ? `${url}?model=${encodeURIComponent(input.model)}` : url
      const requestBody = isEdit ? normalizeEditBody(init?.body) : init?.body
      const response = await safeFetch(requestUrl, {
        ...init,
        body: requestBody as BodyInit,
        signal,
      }, { maxBytes: Math.ceil(MAX_IMAGE_BYTES * 4 / 3) * input.count + 65536, timeoutMs: 240_000 })
      if (!response.ok) throw providerStatusError(response.status)
      return normalizeImageResponse(response, input.count, signal)
    },
  })
  const text = input.negativePrompt ? `${input.prompt}\n\n请避免出现以下内容：${input.negativePrompt}` : input.prompt
  try {
    const result = await generateImage({
      model: provider.image(input.model),
      prompt: input.references.length ? { text, images: input.references } : text,
      n: input.count,
      maxImagesPerCall: input.count,
      size: input.size,
      maxRetries: 0,
      abortSignal: signal,
      headers: { 'Idempotency-Key': input.requestId },
    })
    return result.images.map((image) => image.uint8Array)
  } catch (error) {
    if (error instanceof AppError) throw error
    if (signal.aborted) throw new AppError('生成超时；服务商可能已产生费用。请先核对服务商记录，不会自动重试。', 504)
    throw new AppError('未取得有效的图片结果。请确认该模型支持 OpenAI Images 协议；不会自动重试计费。', 502)
  }
}
