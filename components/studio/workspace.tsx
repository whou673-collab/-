'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import useSWRInfinite from 'swr/infinite'
import { ArrowRight, Check, ChevronRight, HelpCircle, Menu, Plus, PlugZap, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StudioSidebar } from './sidebar'
import { GeneratorPanel } from './generator-panel'
import { PreviewPanel } from './preview-panel'
import { ConnectionsPanel } from './connections-panel'
import { HistoryPanel } from './history-panel'
import { TemplatesPanel } from './templates-panel'
import { AccountDialog } from './account-dialog'
import { apiRequest, errorMessage } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import { uploadReference } from '@/lib/upload-client'
import { initialDraft, inspirations, type Connection, type Draft, type Generation, type Inspiration, type StudioStatus, type StudioView } from '@/lib/studio'

const titles: Record<StudioView, { title: string; description: string; label: string }> = {
  create: { title: '让灵感，即刻成像。', description: '从一个想法到一幅作品，开启属于你的创作旅程。', label: '创作工作台' },
  templates: { title: '好作品，从一点灵感开始。', description: '挑选一个方向，带上你的想象，创造自己的版本。', label: '灵感模板' },
  history: { title: '每一次创作，都值得被记住。', description: '图片、提示词、模型与参考图，都在这里为你保留。', label: '生成历史' },
  favorites: { title: '留住那些，心动的瞬间。', description: '收藏喜欢的作品，让好灵感随时触手可及。', label: '我的收藏' },
  connections: { title: '连接模型，放大创造力。', description: '带上你的 API 与密钥，其余交给绘序。', label: 'API 连接' },
}

type HistoryPage = { items: Generation[]; hasMore: boolean }

export function StudioWorkspace() {
  const [view, setView] = useState<StudioView>('create')
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [inspiration, setInspiration] = useState(inspirations[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const submission = useRef<{ fingerprint: string; requestId: string } | null>(null)
  const submitLock = useRef(false)
  const uploadLock = useRef(false)
  const { mutate: mutateCache } = useSWRConfig()
  const { data: status, error: statusError, mutate: refreshStatus } = useSWR<StudioStatus>('/api/status', apiRequest, { shouldRetryOnError: false })
  const { data: connectionData, error: connectionError, mutate: refreshConnections } = useSWR<{ connections: Connection[] }>(status?.user ? ['/api/connections', status.user.id] : null, ([url]: [string, string]) => apiRequest(url), { shouldRetryOnError: false })
  const { data: pages, error: historyError, isLoading: historyLoading, isValidating, size, setSize, mutate: refreshHistory } = useSWRInfinite<HistoryPage>((index, previous) => !status?.user || (previous && !previous.hasMore) ? null : [`/api/generations?offset=${index * 24}`, status.user.id], ([url]: [string, string]) => apiRequest(url), {
    refreshInterval: (data) => data?.some((page) => page.items.some((item) => item.status === 'running' || item.status === 'queued')) ? 3000 : 0,
    revalidateFirstPage: true,
    shouldRetryOnError: false,
  })
  const connections = status?.user ? connectionData?.connections || [] : []
  const history = status?.user ? [...new Map((pages?.flatMap((page) => page.items) || []).map((item) => [item.id, item])).values()] : []
  const generation = history.find((item) => item.id === selectedId)

  useEffect(() => {
    if (!connectionData || !status?.user) return
    setDraft((current) => {
      const connection = connectionData.connections.find((item) => item.id === current.connectionId) || connectionData.connections[0]
      const connectionId = connection?.id || ''
      const model = connection?.models.some((item) => item.id === current.model)
        ? current.model : connection?.models.find((item) => item.imageLikely)?.id || connection?.models[0]?.id || ''
      return current.connectionId === connectionId && current.model === model ? current : { ...current, connectionId, model }
    })
  }, [connectionData, status?.user?.id, draft.connectionId])

  function navigate(next: StudioView) { setView(next); setMobileOpen(false) }
  function updateDraft(patch: Partial<Draft>) { setDraft((current) => ({ ...current, ...patch })) }
  function requireAccount() {
    if (!status?.ready || !status.user) { setAccountOpen(true); return false }
    return true
  }
  function chooseInspiration(item: Inspiration) { setInspiration(item); updateDraft({ prompt: item.prompt, size: item.size, references: [], negativePrompt: '' }); setSelectedId(null); navigate('create') }
  function reuse(item: Generation) {
    const existing = connections.find((connection) => connection.id === item.connectionId)
    setDraft({ prompt: item.prompt, negativePrompt: item.negativePrompt, size: item.size, count: item.count, connectionId: existing?.id || '', model: existing ? item.model : '', references: item.references })
    setSelectedId(null); navigate('create'); toast.success('已复用提示词、参考图与生成参数。')
  }

  async function upload(files: File[]) {
    if (!requireAccount() || !files.length || uploadLock.current) return
    const remaining = 6 - draft.references.length
    if (files.length > remaining) return toast.error(`最多上传 6 张参考图，还可添加 ${remaining} 张。`)
    if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) return toast.error('仅支持 JPG、PNG 和 WebP 图片。')
    if (files.some((file) => file.size > 10 * 1024 * 1024)) return toast.error('每张参考图不能超过 10 MB。')
    uploadLock.current = true
    setUploading(true)
    let added = 0
    try {
      for (const file of files) {
        const asset = await uploadReference(file)
        setDraft((current) => ({ ...current, references: [...current.references, asset].slice(0, 6) })); added++
      }
      toast.success(`已上传 ${added} 张参考图。`)
    } catch (error) { toast.error(`${errorMessage(error)}${added ? ` 已保留成功上传的 ${added} 张。` : ''}`) }
    finally { uploadLock.current = false; setUploading(false) }
  }

  async function generate() {
    if (!requireAccount() || submitLock.current || uploadLock.current) return
    if (!draft.connectionId || !draft.model) { navigate('connections'); toast.info('先连接 API 并选择一个生图模型。'); return }
    if (!draft.prompt.trim()) return toast.error('请先描述你想生成的画面。')
    const parameters = { prompt: draft.prompt, negativePrompt: draft.negativePrompt, size: draft.size, count: draft.count, connectionId: draft.connectionId, model: draft.model, referenceIds: draft.references.map((asset) => asset.id) }
    const fingerprint = JSON.stringify(parameters)
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, requestId: crypto.randomUUID() }
    submitLock.current = true
    setSubmitting(true)
    try {
      const result = await apiRequest<{ id: string; warning?: string }>('/api/generations', { method: 'POST', body: JSON.stringify({ ...parameters, requestId: submission.current.requestId }) })
      submission.current = null
      setSelectedId(result.id)
      navigate('create')
      await refreshHistory()
      if (result.warning) toast.warning(result.warning)
      else toast.success('生成任务已提交，将自动保存到历史。')
    } catch (error) { toast.error(errorMessage(error)); void refreshHistory() }
    finally { submitLock.current = false; setSubmitting(false) }
  }

  async function favorite(item: Generation) {
    try { await apiRequest(`/api/generations/${item.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !item.favorite }) }); await refreshHistory(); toast.success(item.favorite ? '已取消收藏。' : '已加入收藏。') }
    catch (error) { toast.error(errorMessage(error)) }
  }
  async function remove(item: Generation) {
    try { await apiRequest(`/api/generations/${item.id}`, { method: 'DELETE' }); await refreshHistory(); if (selectedId === item.id) setSelectedId(null); toast.success('生成记录已删除。') }
    catch (error) { toast.error(errorMessage(error)); throw error }
  }
  async function signOut() {
    if (uploadLock.current || submitLock.current) { toast.info('请等待上传或提交完成后再退出。'); return }
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('暂时无法退出，请稍后重试。')
      await mutateCache(() => true, undefined, { revalidate: false })
      setDraft(initialDraft); setSelectedId(null); setAccountOpen(false); submission.current = null
      await refreshStatus()
      router.replace('/'); router.refresh()
      toast.success('已安全退出。')
    } catch (error) { toast.error(errorMessage(error)) }
  }

  const sidebar = <StudioSidebar view={view} onNavigate={navigate} user={status?.user || null} onAccount={() => setAccountOpen(true)} onHelp={() => setHelpOpen(true)} onSignOut={signOut} />

  return (
    <div className="min-h-dvh">
      <a href="#studio-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">跳转到创作内容</a>
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r lg:block">{sidebar}</div>
      <div className="lg:pl-60">
        <header className="border-b bg-card px-5 text-card-foreground sm:px-8"><div className="flex h-[76px] items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开导航菜单" onClick={() => setMobileOpen(true)}><Menu /></Button><span className="hidden text-sm text-muted-foreground sm:inline">个人空间</span><ChevronRight className="hidden size-4 text-muted-foreground/60 sm:block" /><span className="text-sm font-medium">{titles[view].label}</span></div><div className="flex items-center gap-3"><button onClick={() => navigate('connections')} className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground"><span className={connections.length ? 'size-1.5 rounded-full bg-primary' : 'size-1.5 rounded-full bg-muted-foreground/50'} /><span className="hidden sm:inline">{connections.length ? `${connections.length} 个 API 已连接` : 'API 尚未连接'}</span><span className="sm:hidden">API</span></button><Button variant="ghost" size="icon" aria-label="使用指南" onClick={() => setHelpOpen(true)}><HelpCircle /></Button></div></div></header>
        <main id="studio-content" className="mx-auto max-w-[1600px] px-5 pb-10 pt-8 sm:px-8 xl:px-10">
          <div className="pb-7"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-col gap-2.5"><h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[28px]">{titles[view].title}</h1><p className="text-pretty text-sm leading-relaxed text-muted-foreground">{titles[view].description}</p></div>{view === 'create' ? <Button variant="outline" onClick={() => { setDraft((current) => ({ ...initialDraft, connectionId: current.connectionId, model: current.model, prompt: '' })); setSelectedId(null) }}><Plus data-icon="inline-start" />新建创作</Button> : <Button variant="outline" onClick={() => navigate('create')}><Sparkles data-icon="inline-start" />开始创作</Button>}</div></div>
          {view === 'create' && <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)]"><GeneratorPanel draft={draft} onChange={updateDraft} connections={connections} onConnections={() => navigate('connections')} onGenerate={generate} onUpload={upload} busy={submitting} uploading={uploading} /><PreviewPanel key={selectedId || inspiration.id} generation={generation} inspiration={inspiration} onInspiration={chooseInspiration} onTemplates={() => navigate('templates')} onFavorite={favorite} onReuse={reuse} onHistory={() => navigate('history')} /></div>}
          {view === 'connections' && <div className="flex flex-col gap-4">{connectionError && <Alert variant="destructive"><AlertTitle>暂时无法读取 API 连接</AlertTitle><AlertDescription>{errorMessage(connectionError)}<Button variant="outline" size="sm" onClick={() => refreshConnections()}>重新加载</Button></AlertDescription></Alert>}<ConnectionsPanel connections={connections} onChanged={() => { refreshConnections(); refreshStatus() }} requireAccount={requireAccount} /></div>}
          {(view === 'history' || view === 'favorites') && <HistoryPanel items={history} favoritesOnly={view === 'favorites'} loading={historyLoading || isValidating} error={historyError ? errorMessage(historyError) : undefined} signedIn={!!status?.user} onAccount={() => setAccountOpen(true)} onCreate={() => navigate('create')} onFavorite={favorite} onReuse={reuse} onDelete={remove} hasMore={pages?.at(-1)?.hasMore || false} onLoadMore={() => historyError ? refreshHistory() : setSize(size + 1)} />}
          {view === 'templates' && <TemplatesPanel onSelect={chooseInspiration} />}
          <footer className="pt-8"><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span className="font-mono tracking-wider">HUIXU STUDIO</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" />创意属于你，作品仅自己可见</span></div></footer>
        </main>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="max-w-72"><SheetTitle className="sr-only">工作台导航</SheetTitle><SheetDescription className="sr-only">切换创作工作台、历史、收藏和 API 连接。</SheetDescription>{sidebar}</SheetContent></Sheet>
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} status={status} error={statusError ? errorMessage(statusError) : undefined} onRetry={() => refreshStatus()} onAuthenticated={async () => { await refreshStatus(); setAccountOpen(false); toast.success('欢迎回来，创作空间已就绪。') }} onSignOut={signOut} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>把灵感交给绘序</DialogTitle><DialogDescription>从连接模型到管理作品，三个步骤开始创作。</DialogDescription></DialogHeader><div className="flex flex-col gap-5">{[{ icon: PlugZap, title: '连接你自己的 API', text: '登录后添加 OpenAI Images 兼容服务。系统通过 /models 识别模型，也支持手动填写模型 ID。' }, { icon: Sparkles, title: '描述画面，添加参考', text: '上传最多 6 张参考图，选择比例和数量。参考图会发送给所选 API 服务商，请勿上传无权分享的敏感内容。' }, { icon: Check, title: '所有创作，自动归档', text: '任务、原图和参数保留在历史中。你可以收藏、下载、复用参数；失败任务不会自动重试计费。' }].map((item) => <div key={item.title} className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><item.icon className="size-4" /></span><div className="flex flex-col gap-1.5"><h3 className="text-sm font-medium">{item.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p></div></div>)}<Button onClick={() => { setHelpOpen(false); navigate('connections') }}>去连接 API<ArrowRight data-icon="inline-end" /></Button></div></DialogContent></Dialog>
    </div>
  )
}
