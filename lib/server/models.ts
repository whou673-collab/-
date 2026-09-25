import 'server-only'
import type { ModelInfo } from '@/lib/studio'
import { AppError } from './errors'
import { normalizeApiBase, safeFetch } from './outbound'

export function modelLooksLikeImage(id: string) {
  return /(image|dall[-_.]?e|flux|diffusion|sdxl|recraft|kolors|ideogram|imagen|seedream)/i.test(id)
}

export function mergeModels(discovered: ModelInfo[], manual: string[]) {
  const merged = new Map(discovered.map((model) => [model.id, model]))
  for (const id of manual) if (!merged.has(id)) merged.set(id, { id, source: 'manual', imageLikely: modelLooksLikeImage(id) })
  return [...merged.values()].sort((a, b) => Number(b.imageLikely) - Number(a.imageLikely) || a.id.localeCompare(b.id))
}

export function providerStatusError(status: number): AppError {
  if (status === 401 || status === 403) return new AppError('API 拒绝访问，请确认密钥有效、账户有额度且具有相应模型权限。', 422)
  if (status === 429) return new AppError('服务商提示限流或额度不足，请检查配额后再试。不会自动重试生图。', 429)
  if (status === 400 || status === 422) return new AppError('服务商不接受当前参数，请确认模型、尺寸、张数及参考图是否受支持。', 422)
  if (status === 404 || status === 405) return new AppError('此地址或模型不支持当前 OpenAI Images 端点，请检查 API 基础地址和模型 ID。', 422)
  return new AppError('服务商暂时无法完成请求。请先核对调用记录，再决定是否重新生成。', 502)
}

export async function discoverModels(base: string, apiKey: string) {
  const baseUrl = normalizeApiBase(base)
  const response = await safeFetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }, { maxBytes: 2 * 1024 * 1024 })
  if ([404, 405, 501].includes(response.status)) {
    return { baseUrl, models: [] as ModelInfo[], warning: '此服务未提供 /models 列表，请手动填写模型 ID。手动模型未经过能力验证。' }
  }
  if (!response.ok) throw providerStatusError(response.status)
  const result: unknown = await response.json().catch(() => null)
  if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data)) {
    throw new AppError('模型列表不是 OpenAI 兼容格式，需要返回 data 数组。', 422)
  }
  const models: ModelInfo[] = []
  for (const item of result.data.slice(0, 2000)) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue
    const id = item.id.trim()
    if (!id || id.length > 200 || /[\u0000-\u001f\u007f]/.test(id)) continue
    models.push({ id, source: 'discovered', imageLikely: modelLooksLikeImage(id) })
  }
  const unique = mergeModels(models, [])
  return {
    baseUrl, models: unique,
    warning: unique.length === 0 ? '已连接，但未发现可选模型。可手动填写服务商提供的模型 ID。' : result.data.length > 2000 ? '仅展示前 2000 个模型。生图标记仅根据名称推测，请向服务商确认能力。' : undefined,
  }
}
