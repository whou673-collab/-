'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, Expand, Heart, ImageIcon, Layers3, LoaderCircle, RotateCcw, ScanLine, Sparkles, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { inspirations, statusLabels, type Generation, type Inspiration } from '@/lib/studio'
import { cn } from '@/lib/utils'

export function PreviewPanel({ generation, inspiration, onInspiration, onTemplates, onFavorite, onReuse, onHistory }: {
  generation?: Generation
  inspiration: Inspiration
  onInspiration: (item: Inspiration) => void
  onTemplates: () => void
  onFavorite: (item: Generation) => void
  onReuse: (item: Generation) => void
  onHistory: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const asset = generation?.assets[imageIndex] || generation?.assets[0]
  const running = generation?.status === 'queued' || generation?.status === 'running'
  const image = asset?.url || (!generation ? inspiration.image : undefined)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="rounded-2xl border bg-card p-5 text-card-foreground" aria-label="创作流程"><div className="flex items-center justify-between gap-2">{[{ icon: Type, label: '创意输入', sub: '描述与参考' }, { icon: Sparkles, label: '图像生成', sub: '模型与参数' }, { icon: ImageIcon, label: '作品输出', sub: '保存与分享' }].map((step, index) => <div key={step.label} className="contents"><div className="flex items-center gap-3"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', index === 0 ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground')}><step.icon className="size-[18px]" strokeWidth={1.6} /></span><span className="flex flex-col gap-0.5"><span className="text-sm font-medium">{step.label}</span><span className="hidden text-sm text-muted-foreground xl:block">{step.sub}</span></span></div>{index < 2 && <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />}</div>)}</div></section>
      <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm shadow-foreground/[0.02]" aria-label="图像预览">
        <div className="px-5 py-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="text-base font-semibold">创作预览</h2><Badge variant="outline">{generation ? statusLabels[generation.status] : '灵感示例'}</Badge></div><Button variant="ghost" size="icon" disabled={!image} onClick={() => setExpanded(true)} aria-label="放大预览"><Expand /></Button></div></div>
        <div className="px-4"><div className="relative overflow-hidden rounded-xl bg-muted">
          {image && <img src={image} alt={generation ? generation.prompt : inspiration.title} className="aspect-[4/3] w-full object-cover" fetchPriority="high" />}
          {!generation && <span className="absolute bottom-4 left-4 rounded-md bg-card/90 px-3 py-1.5 text-sm text-foreground backdrop-blur-sm">{inspiration.category} · 非生成记录</span>}
          {running && <div className="flex aspect-[4/3] items-center justify-center"><div className="flex flex-col items-center gap-5"><span className="flex size-16 items-center justify-center rounded-2xl border bg-card text-primary"><LoaderCircle className="size-7 animate-spin" /></span><div className="flex flex-col items-center gap-2"><h3 className="text-lg font-medium">正在把灵感变成画面</h3><p className="text-sm text-muted-foreground">任务已保存，可在生成历史中查看进度。</p></div></div></div>}
          {generation?.status === 'failed' && <Empty className="aspect-[4/3]"><EmptyHeader><EmptyMedia variant="icon"><RotateCcw /></EmptyMedia><EmptyTitle>这次生成没有完成</EmptyTitle><EmptyDescription>{generation.error || '请检查 API 连接和模型参数。'}</EmptyDescription></EmptyHeader><Button variant="outline" onClick={() => onReuse(generation)}>复用参数，再试一次</Button></Empty>}
          {generation?.status === 'completed' && !asset && <Empty className="aspect-[4/3]"><EmptyHeader><EmptyTitle>暂无可预览图片</EmptyTitle><EmptyDescription>请在历史记录中检查任务详情。</EmptyDescription></EmptyHeader></Empty>}
        </div></div>
        {generation && generation.assets.length > 1 && <div className="px-4 pt-3"><div className="flex gap-2">{generation.assets.map((item, index) => <button key={item.id} aria-label={`查看第 ${index + 1} 张图片`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)} className={cn('overflow-hidden rounded-lg border-2', imageIndex === index ? 'border-primary' : 'border-transparent')}><img src={item.url} alt={`生成图 ${index + 1}`} className="size-16 object-cover" /></button>)}</div></div>}
        <div className="p-5"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 flex-col gap-1"><p className="truncate text-sm font-medium">{generation ? generation.model : inspiration.title}</p><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="font-mono">{asset ? `${asset.width} × ${asset.height}` : generation ? generation.size.replace('x', ' × ') : '灵感画廊'}</span><span>·</span><span>{generation ? '私密作品' : '点击下方模板复用提示词'}</span></div></div>{generation && asset ? <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={generation.favorite ? '取消收藏' : '收藏作品'} onClick={() => onFavorite(generation)}><Heart className={generation.favorite ? 'fill-current' : ''} /></Button><Button variant="outline" render={<a href={`${asset.url}?download=1`} download />}><ArrowDownToLine data-icon="inline-start" /><span className="hidden sm:inline">下载</span></Button></div> : <span className="hidden rounded-full border px-2.5 py-1 text-sm text-muted-foreground sm:block">MADE OF IDEAS</span>}</div></div>
      </section>
      <section aria-label="灵感模板"><div className="pb-3"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-medium"><Layers3 className="size-4 text-muted-foreground" />从一个灵感开始</h2><button onClick={onTemplates} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">全部模板<ArrowRight className="size-3.5" /></button></div></div><div className="grid grid-cols-3 gap-3">{inspirations.map((item) => <button onClick={() => { setImageIndex(0); onInspiration(item) }} key={item.id} className="group min-w-0 overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/40 hover:shadow-sm"><div className="relative overflow-hidden"><img src={item.image} alt={item.title} className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />{inspiration.id === item.id && !generation && <span className="absolute bottom-2 right-2 flex size-5 items-center justify-center rounded-full bg-card text-primary"><Check className="size-3" /></span>}</div><div className="px-3 py-2.5"><p className="truncate text-sm font-medium">{item.category}</p></div></button>)}</div></section>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><ScanLine className="size-4" /><span>每一次生成，都会留下灵感的轨迹。</span><button onClick={onHistory} className="text-primary hover:underline">查看历史</button></div>
      <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{generation ? '作品预览' : inspiration.title}</DialogTitle><DialogDescription>{generation ? '图片仅对当前账户开放。' : '这是灵感示例，不是你的生成记录。'}</DialogDescription></DialogHeader>{image && <img src={image} alt={generation?.prompt || inspiration.title} className="max-h-[70dvh] w-full rounded-lg object-contain" />}</DialogContent></Dialog>
    </div>
  )
}
