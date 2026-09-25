import { handleUpload } from '@vercel/blob/client'
import { z } from 'zod'
import { errorResponse, json } from '@/lib/server/errors'
import { getUploadPermission } from '@/lib/server/media'
import { requireUser } from '@/lib/server/session'
import { idSchema, readJson } from '@/lib/server/validation'

export const runtime = 'nodejs'

const tokenRequest = z.object({
  type: z.literal('blob.generate-client-token'),
  payload: z.object({
    pathname: z.string().min(1).max(512),
    multipart: z.boolean(),
    clientPayload: idSchema,
  }),
})

export async function POST(request: Request) {
  try {
    const userId = await requireUser(request)
    const body = tokenRequest.parse(await readJson(request))
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const permission = await getUploadPermission(userId, idSchema.parse(clientPayload), pathname)
        return {
          allowedContentTypes: [permission.mediaType],
          maximumSizeInBytes: permission.size,
          validUntil: Date.now() + 5 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false,
        }
      },
    })
    return json(result)
  } catch (error) { return errorResponse(error) }
}
