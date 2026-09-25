import { errorResponse, json } from '@/lib/server/errors'
import { getStudioStatus } from '@/lib/server/session'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try { return json(await getStudioStatus(request.headers)) }
  catch (error) { return errorResponse(error) }
}
