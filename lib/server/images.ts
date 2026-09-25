import 'server-only'
import sharp from 'sharp'
import { AppError } from './errors'
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from './validation'

export async function prepareImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) throw new AppError('图片为空或超过 20 MB 限制。', 413)
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
    const metadata = await image.metadata()
    if (!metadata.format || !['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
      throw new AppError('仅支持静态 JPG、PNG 和 WebP 图片，不支持动画或 SVG。', 415)
    }
    const { data, info } = await image.rotate().png().toBuffer({ resolveWithObject: true })
    if (data.length > MAX_IMAGE_BYTES) throw new AppError('图片解码后过大，请先降低分辨率。', 413)
    return { bytes: data, width: info.width, height: info.height, size: data.length, mediaType: 'image/png' }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('图片无法安全解码，请使用有效的 JPG、PNG 或 WebP，且不超过 4000 万像素。', 422)
  }
}

export function safeImageName(name: string) {
  return (name.replace(/[\u0000-\u001f\u007f/\\]/g, '').replace(/\.[^.]+$/, '').slice(0, 160) || 'image') + '.png'
}
