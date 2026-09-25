'use client'

import { useState } from 'react'
import { ArrowDownToLine, Copy, Heart, History, ImageIcon, LoaderCircle, RotateCcw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { statusLabels, type Generation } from '@/lib/studio'

export function HistoryPanel({ items, favoritesOnly, loading, error, signedIn, onAccount, onCreate, onFavorite, onReuse, onDelete, onLoadMore, hasMore }: {
  items: Generation[]
  favoritesOnly: boolean
  loading: boolean
  error?: string
  signedIn: boolean
  onAccount: () => void
  onCreate: () => void
  onFavorite: (item: Generation) => void
  onReuse: (item: Generation) => void
  onDelete: (item: Generation) => Promise<void>
  onLoadMore: () => void
  hasMore: boolean
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState<Generation | null>(null)
  const [remove, setRemove] = useState<Generation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const filtered = items.filter((item) => (!favoritesOnly || item.favorite) && (filter === 'all' || item.status === filter) && `${item.prompt} ${item.model}`.toLowerCase().includes(query.toLowerCase()))
  const selected = items.find((item) => item.id === detail?.id) || detail

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('提示词已复制。') }
    catch { toast.error('复制失败，请在详情中手动选择提示词。') }
  }

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索已加载的生成记录" placeholder="搜索已加载的提示词、模型…" className="h-10 pl-9" /></div><Select value={filter} onValueChange={(value) => setFilter(String(value))}><SelectTrigger aria-label="按生成状态筛选" className="h-10 min-w-32"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">所有状态</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></div>
    {!signedIn ? <Empty className="min-h-80 rounded-2xl border bg-card"><EmptyHeader><EmptyMedia variant="icon"><History /></EmptyMedia><EmptyTitle>让每一份灵感都有迹可循</EmptyTitle><EmptyDescription>登录后，生成图片、提示词和参考图都会私密保存在云端，刷新或换设备也能继续创作。</EmptyDescription></EmptyHeader><Button onClick={onAccount}>登录 / 创建账户</Button></Empty> : error ? <Empty className="min-h-80 rounded-2xl border bg-card"><EmptyHeader><EmptyTitle>历史暂时无法加载</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader><Button variant="outline" onClick={onLoadMore}>重试</Button></Empty> : loading && !items.length ? <div role="status" className="flex min-h-80 items-center justify-center gap-2 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />正在读取你的创作…</div> : !filtered.length ? <Empty className="min-h-80 rounded-2xl border bg-card"><EmptyHeader><EmptyMedia variant="icon">{favoritesOnly ? <Heart /> : <ImageIcon />}</EmptyMedia><EmptyTitle>{query || filter !== 'all' ? '没有匹配的作品' : favoritesOnly ? '把喜欢的作品留在这里' : '你的第一幅作品，正等待诞生'}</EmptyTitle><EmptyDescription>{query || filter !== 'all' ? '试着更换关键词或状态筛选。' : favoritesOnly ? '在生成结果或历史记录中点击收藏，即可快速找到。' : '开始一次生成，图片和完整参数将自动出现在这里。'}</EmptyDescription></EmptyHeader><Button onClick={onCreate}>去创作</Button></Empty> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-card text-card-foreground"><button onClick={() => setDetail(item)} className="relative block w-full text-left" aria-label={`查看作品：${item.prompt.slice(0, 30)}`}>{item.assets[0] ? <img src={item.assets[0].url} alt={item.prompt} className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-muted text-muted-foreground">{item.status === 'queued' || item.status === 'running' ? <LoaderCircle className="size-7 animate-spin" /> : <ImageIcon className="size-7" />}<span className="text-sm">{statusLabels[item.status]}</span></div>}<div className="absolute left-3 top-3"><Badge variant="secondary">{statusLabels[item.status]}</Badge></div>{item.assets.length > 1 && <span className="absolute bottom-3 right-3 rounded bg-card/90 px-2 py-1 text-sm text-foreground">{item.assets.length} 张</span>}</button><div className="p-4"><p className="line-clamp-2 min-h-10 text-sm leading-relaxed">{item.prompt}</p><div className="py-3"><div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span className="truncate">{item.model}</span><time className="shrink-0" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></div></div><div className="flex items-center justify-between border-t pt-3"><Button variant="ghost" onClick={() => onReuse(item)}><RotateCcw data-icon="inline-start" />复用参数</Button><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={item.favorite ? '取消收藏' : '收藏作品'} onClick={() => onFavorite(item)}><Heart className={item.favorite ? 'fill-current' : ''} /></Button><Button variant="ghost" size="icon" disabled={item.status === 'running' || item.status === 'queued'} aria-label="删除作品" onClick={() => setRemove(item)}><Trash2 /></Button></div></div></div></article>)}</div>}
    {hasMore && signedIn && <Button variant="outline" onClick={onLoadMore} disabled={loading} className="self-center">{loading ? '正在加载…' : '加载更多记录'}</Button>}
    <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>创作详情</DialogTitle><DialogDescription>完整保留本次生成的图片、提示词、模型和参考图。</DialogDescription></DialogHeader>{selected && <div className="flex flex-col gap-5"><div className="grid gap-3 sm:grid-cols-2">{selected.assets.map((asset) => <div key={asset.id} className="flex flex-col gap-2"><img src={asset.url} alt={selected.prompt} className="w-full rounded-lg object-contain" /><Button variant="outline" render={<a href={`${asset.url}?download=1`} download />}><ArrowDownToLine data-icon="inline-start" />下载原图</Button></div>)}</div>{selected.error && <p role="alert" className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{selected.error}</p>}<div className="flex flex-wrap gap-2"><Badge variant="outline">{selected.model}</Badge><Badge variant="outline">{selected.size}</Badge><Badge variant="outline">{selected.count} 张</Badge><Badge variant="secondary">{statusLabels[selected.status]}</Badge></div><div className="flex flex-col gap-2"><h3 className="text-sm font-medium">画面描述</h3><p className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-relaxed">{selected.prompt}</p></div>{selected.negativePrompt && <p className="text-sm text-muted-foreground">排除内容：{selected.negativePrompt}</p>}{selected.references.length > 0 && <div className="flex flex-col gap-2"><h3 className="text-sm font-medium">参考图片 · {selected.references.length} 张</h3><div className="flex flex-wrap gap-2">{selected.references.map((asset) => <img key={asset.id} src={asset.url} alt={asset.name} className="size-20 rounded-lg object-cover" />)}</div></div>}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => copy(selected.prompt)}><Copy data-icon="inline-start" />复制提示词</Button><Button onClick={() => { onReuse(selected); setDetail(null) }}><RotateCcw data-icon="inline-start" />复用全部参数</Button></div></div>}</DialogContent></Dialog>
    <Dialog open={!!remove} onOpenChange={(open) => { if (!open && !deleting) setRemove(null) }}><DialogContent><DialogHeader><DialogTitle>删除这次生成记录？</DialogTitle><DialogDescription>记录和生成图片将被删除，无法恢复。参考图不会从其他记录中删除。</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setRemove(null)}>保留</Button><Button disabled={deleting} onClick={async () => { if (!remove) return; setDeleting(true); try { await onDelete(remove); setRemove(null) } finally { setDeleting(false) } }}>{deleting ? '删除中…' : '确认删除'}</Button></div></DialogContent></Dialog>
  </div>
}
