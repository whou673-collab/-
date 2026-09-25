'use client'

import { LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { StudioStatus } from '@/lib/studio'

export function AccountDialog({ open, onOpenChange, status, error, onAuthenticated, onSignOut, onRetry }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status?: StudioStatus
  error?: string
  onAuthenticated: () => Promise<void>
  onSignOut: () => Promise<void>
  onRetry: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{status?.user ? '你的私密创作空间' : '让灵感，有自己的归处'}</DialogTitle><DialogDescription>{status?.user ? '跨设备登录，继续你的创作。' : '登录或创建账户，连接模型并保存每一次创作。'}</DialogDescription></DialogHeader>
        {error || (status && !status.ready) ? <div className="flex flex-col gap-4"><Alert><ShieldCheck /><AlertTitle>账户服务暂时不可用</AlertTitle><AlertDescription>{error || '安全存储配置尚未就绪，请稍后刷新。你的创作参数仍保留在当前页面。'}</AlertDescription></Alert><Button variant="outline" onClick={onRetry}>重新检查连接</Button></div>
          : !status ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />正在检查账户服务…</div>
          : status.user ? <div className="flex flex-col gap-5"><div className="rounded-xl bg-muted p-4 text-muted-foreground"><p className="font-medium text-foreground">{status.user.name}</p><p className="pt-1 text-sm break-all">{status.user.email}</p></div><Button variant="outline" onClick={onSignOut}><LogOut data-icon="inline-start" />安全退出</Button></div>
          : <AuthForm onAuthenticated={onAuthenticated} />}
      </DialogContent>
    </Dialog>
  )
}
