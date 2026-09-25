import { runImageStep, settleImageStep } from './image-steps'

export async function imageGenerationWorkflow(generationId: string, userId: string) {
  'use workflow'
  try {
    const result = await runImageStep(generationId, userId)
    if (result) await settleImageStep(generationId, userId, result.status, result.error)
  } catch {
    await settleImageStep(generationId, userId, 'failed', '任务执行中断；服务商可能已产生费用。请先检查调用记录，再决定是否重新生成。')
  }
}
