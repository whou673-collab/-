import { start } from 'workflow/api'
import { z } from 'zod'
import { errorResponse, json } from '@/lib/server/errors'
import { failQueuedGeneration, listGenerations, recordRun, reserveGeneration } from '@/lib/server/generations'
import { requireUser } from '@/lib/server/session'
import { generationSchema, readJson } from '@/lib/server/validation'
import { imageGenerationWorkflow } from '@/workflows/generate-image'

export const runtime = 'nodejs'
export const maxDuration = 60

const offsetSchema = z.coerce.number().int().min(0).max(100_000)

export async function GET(request: Request) {
  try {
    const userId = await requireUser(request)
    const offset = offsetSchema.parse(new URL(request.url).searchParams.get('offset') ?? 0)
    return json(await listGenerations(userId, offset))
  } catch (error) { return errorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUser(request)
    const input = generationSchema.parse(await readJson(request))
    const generation = await reserveGeneration(userId, input)
    if (!generation.created) return json({ id: generation.id }, 200)
    let runId: string
    try {
      const run = await start(imageGenerationWorkflow, [generation.id, userId])
      runId = run.runId
    } catch {
      await failQueuedGeneration(userId, generation.id)
      return json({ id: generation.id, warning: '任务启动未确认，请查看历史记录中的状态；不会自动重试计费。' }, 202)
    }
    // Once enqueued, a metadata-write failure must never launch a second billable run.
    await recordRun(userId, generation.id, runId).catch(() => console.error('[studio] Workflow metadata update deferred'))
    return json({ id: generation.id }, 202)
  } catch (error) { return errorResponse(error) }
}
