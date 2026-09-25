'use client'

import { useState } from 'react'
import { Check, CircleHelp, Eye, EyeOff, KeyRound, Link2, LoaderCircle, PlugZap, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { apiRequest, errorMessage } from '@/lib/api-client'
import type { Connection, ModelInfo } from '@/lib/studio'

export function ConnectionsPanel({ connections, onChanged, requireAccount }: {
  connections: Connection[]
  onChanged: () => void
  requireAccount: () => boolean
}) {
  const [name, setName] = useState('我的生图 API')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [manual, setManual] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [remove, setRemove] = useState<Connection | null>(null)

  async function discover() {
    if (!requireAccount()) return
    if (!baseUrl.trim() || !apiKey.trim()) return toast.error('请填写 API 地址与密钥。')
    setBusy('discover'); setNotice(''); setModels([])
    try {
      const data = await apiRequest<{ models: ModelInfo[]; warning?: string }>('/api/connections/discover', { method: 'POST', body: JSON.stringify({ baseUrl, apiKey }) })
      setModels(data.models)
      setNotice(data.warning || `已识别 ${data.models.length} 个模型。模型列表可用不代表所有模型都支持生图。`)
      if (data.models.length) toast.success('连接成功，已获取模型列表。')
    } catch (error) { setNotice(errorMessage(error)); toast.error(errorMessage(error)) }
    finally { setBusy(null) }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!requireAccount()) return
    setBusy('save')
    try {
      await apiRequest('/api/connections', { method: 'POST', body: JSON.stringify({ name, baseUrl, apiKey, manualModels: manual.split(/[\n,，]/).map((id) => id.trim()).filter(Boolean) }) })
      setApiKey(''); setModels([]); setNotice(''); setManual(''); setBaseUrl('')
      onChanged(); toast.success('连接已保存，密钥已加密。')
    } catch (error) { toast.error(errorMessage(error)) }
    finally { setBusy(null) }
  }

  async function refresh(connection: Connection) {
    setBusy(connection.id)
    try { await apiRequest(`/api/connections/${connection.id}/refresh`, { method: 'POST' }); onChanged(); toast.success('模型列表已更新。') }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setBusy(null) }
  }

  async function deleteConnection() {
    if (!remove) return
    setBusy('delete')
    try { await apiRequest(`/api/connections/${remove.id}`, { method: 'DELETE' }); onChanged(); setRemove(null); toast.success('连接与密钥已删除，已有作品不受影响。') }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setBusy(null) }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-5">
        <Alert><ShieldCheck /><AlertTitle>自己的密钥，私密的创作</AlertTitle><AlertDescription>密钥仅在服务端加密保存，不会写入浏览器存储或返回前端。请使用有额度上限的专用密钥。</AlertDescription></Alert>
        {connections.length === 0 ? <section className="rounded-2xl border bg-card p-6 text-card-foreground"><Empty><EmptyHeader><EmptyMedia variant="icon"><PlugZap /></EmptyMedia><EmptyTitle>连接你的第一位创作伙伴</EmptyTitle><EmptyDescription>填写 OpenAI 兼容 API 地址与密钥，自动拉取模型列表。没有模型列表的服务也可手动添加模型 ID。</EmptyDescription></EmptyHeader></Empty><div className="grid gap-4 border-t pt-6 sm:grid-cols-3">{[{ icon: Link2, title: '填入 API', text: 'HTTPS 地址与密钥' }, { icon: Search, title: '发现模型', text: '自动读取 /models' }, { icon: Check, title: '开始创作', text: '选择模型，保存作品' }].map((item) => <div key={item.title} className="flex flex-col gap-2"><item.icon className="size-5 text-primary" /><h3 className="text-sm font-medium">{item.title}</h3><p className="text-sm text-muted-foreground">{item.text}</p></div>)}</div></section> : connections.map((connection) => <section key={connection.id} className="rounded-2xl border bg-card p-5 text-card-foreground"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><PlugZap className="size-5" /></span><div className="flex min-w-0 flex-col gap-1"><h3 className="truncate font-medium">{connection.name}</h3><p className="truncate text-sm text-muted-foreground">{connection.baseUrl}</p></div></div><div className="flex gap-1"><Button variant="ghost" size="icon" disabled={!!busy} aria-label={`刷新 ${connection.name} 的模型`} onClick={() => refresh(connection)}><RefreshCw className={busy === connection.id ? 'animate-spin' : ''} /></Button><Button variant="ghost" size="icon" disabled={!!busy} aria-label={`删除 ${connection.name}`} onClick={() => setRemove(connection)}><Trash2 /></Button></div></div><div className="py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><KeyRound className="size-3.5" /><span className="font-mono">{connection.keyHint}</span><span>· 服务端加密</span></div></div><div className="flex flex-wrap gap-2">{connection.models.slice(0, 12).map((model) => <Badge key={model.id} variant={model.imageLikely ? 'secondary' : 'outline'}>{model.id}</Badge>)}{connection.models.length > 12 && <Badge variant="outline">另有 {connection.models.length - 12} 个</Badge>}</div><p className="pt-3 text-sm text-muted-foreground">共 {connection.models.length} 个模型 · 蓝色为名称匹配的图像候选，能力以服务商为准</p></section>)}
        <section className="rounded-xl border border-dashed p-5"><div className="flex items-start gap-3"><CircleHelp className="size-5 shrink-0 text-muted-foreground" /><div className="flex flex-col gap-2"><h3 className="text-sm font-medium">关于 API 兼容性</h3><p className="text-sm leading-relaxed text-muted-foreground">当前使用 OpenAI Images 协议：文生图请求 images/generations，多参考图请求 images/edits。仅支持聊天接口或 Gemini 原生协议的服务不能直接使用；模型列表也不会提供可靠的参考图能力标记。请确认服务商支持这些端点。</p></div></div></section>
      </div>
      <section className="rounded-2xl border bg-card p-6 text-card-foreground"><div className="pb-6"><h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4" />添加 API 连接</h2><p className="pt-2 text-sm text-muted-foreground">一个连接，就能使用多个模型。</p></div><form onSubmit={save}><FieldGroup>
        <Field><FieldLabel htmlFor="connection-name">连接名称</FieldLabel><Input id="connection-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="例如：我的生图服务" /></Field>
        <Field><FieldLabel htmlFor="api-url">API Base URL</FieldLabel><Input id="api-url" type="url" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setModels([]); setNotice('') }} placeholder="https://your-api.com/v1" required autoComplete="url" /><FieldDescription>填写基础地址，不要包含 /images/generations 或 /models。</FieldDescription></Field>
        <Field><FieldLabel htmlFor="api-key">API Key</FieldLabel><div className="relative"><Input id="api-key" type={visible ? 'text' : 'password'} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setModels([]); setNotice('') }} placeholder="sk-..." className="pr-10" required autoComplete="off" maxLength={4096} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={visible ? '隐藏密钥' : '显示密钥'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button></div></Field>
        <Button type="button" variant="outline" disabled={!!busy} onClick={discover}>{busy === 'discover' ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Search data-icon="inline-start" />}测试连接并识别模型</Button>
        {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}
        {models.length > 0 && <div className="flex flex-col gap-3"><Input aria-label="搜索发现的模型" placeholder="搜索模型…" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">{models.filter((model) => model.id.toLowerCase().includes(search.toLowerCase())).map((model) => <Badge key={model.id} variant={model.imageLikely ? 'secondary' : 'outline'}>{model.id}</Badge>)}</div></div>}
        <Field><FieldLabel htmlFor="manual-model">手动补充模型 ID<span className="font-normal text-muted-foreground">（可选）</span></FieldLabel><Input id="manual-model" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="多个模型用逗号分隔" maxLength={3000} /><FieldDescription>用于不提供 /models 的接口，不会被标记为已验证。</FieldDescription></Field>
        <Button type="submit" className="h-10" disabled={!!busy}>{busy === 'save' ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}安全保存连接</Button>
      </FieldGroup></form></section>
      <Dialog open={!!remove} onOpenChange={(open) => { if (!open) setRemove(null) }}><DialogContent><DialogHeader><DialogTitle>删除这个 API 连接？</DialogTitle><DialogDescription>密钥将被删除，已有的生成历史和图片会保留。正在使用此连接的任务结束后才能删除。</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemove(null)}>取消</Button><Button disabled={busy === 'delete'} onClick={deleteConnection}>确认删除</Button></div></DialogContent></Dialog>
    </div>
  )
}
