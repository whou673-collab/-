'use client'

import { upload } from '@vercel/blob/client'
import { apiRequest } from './api-client'
import type { MediaAsset } from './studio'

export async function uploadReference(file: File): Promise<MediaAsset> {
  const reserved = await apiRequest<{ id: string; pathname: string }>('/api/media/uploads', {
    method: 'POST',
    body: JSON.stringify({ name: file.name, mediaType: file.type, size: file.size }),
  })
  try {
    try {
      await upload(reserved.pathname, file, {
        access: 'private',
        contentType: file.type,
        handleUploadUrl: '/api/media/upload',
        clientPayload: reserved.id,
        abortSignal: AbortSignal.timeout(120_000),
      })
    } catch {
      throw new Error('参考图上传未完成，请检查网络后重新选择图片。')
    }
    const result = await apiRequest<{ asset: MediaAsset }>(`/api/media/uploads/${reserved.id}`, { method: 'POST' })
    return result.asset
  } catch (error) {
    await apiRequest(`/api/media/uploads/${reserved.id}`, { method: 'DELETE' }).catch(() => undefined)
    throw error
  }
}
