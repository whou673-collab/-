import { claimGeneration, finishGeneration } from '@/lib/server/generations'
import { getConnectionSecret } from '@/lib/server/connections'
import { readReferences, saveGeneratedImage } from '@/lib/server/media'
import { generateProviderImages } from '@/lib/server/provider'
import { AppError } from '@/lib/server/errors'

export async function runImageStep(generationId: string, userId: string): Promise<{ status: 'completed' | 'failed'; error: string | null } | null> {
  'use step'
  try {
    const generation = await claimGeneration(userId, generationId)
    if (!generation) return null
    const connection = await getConnectionSecret(userId, generation.connectionId)
    const references = await readReferences(userId, generation.referenceIds)
    const images = await generateProviderImages({
      baseUrl: connection.baseUrl, apiKey: connection.apiKey, model: generation.model,
      prompt: generation.prompt, negativePrompt: generation.negativePrompt, size: generation.size,
      count: generation.count, requestId: generation.requestId, references,
    })
    for (const [position, image] of images.entries()) await saveGeneratedImage(userId, generationId, image, position)
    return { status: 'completed', error: images.length < generation.count ? `服务商仅返回 ${images.length} / ${generation.count} 张图片，已保存现有结果，未补发请求。` : null }
  } catch (error) {
    return { status: 'failed', error: error instanceof AppError ? error.message : '图片生成或保存未能完成。已保存的图片仍可查看，不会自动重新调用生图 API。' }
  }
}

// A successful provider call may be billable even if its response is lost.
runImageStep.maxRetries = 0

export async function settleImageStep(generationId: string, userId: string, status: 'completed' | 'failed', error: string | null) {
  'use step'
  await finishGeneration(userId, generationId, status, error)
}
