'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ImagePlus, Images, LoaderCircle, Plus, Settings2, SlidersHorizontal, Sparkles, WandSparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { sizeOptions, type Connection, type Draft, type ImageSize } from '@/lib/studio'
import { cn } from '@/lib/utils'

export function GeneratorPanel({ draft, onChange, connections, onConnections, onGenerate, onUpload, busy, uploading }: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  connections: Connection[]
  onConnections: () => void
  onGenerate: () => void
  onUpload: (files: File[]) => void
  busy: boolean
  uploading: boolean
}) {
  const [mode, setMode] = useState('text')
  const [advanced, setAdvanced] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const connection = connections.find((item) => item.id === draft.connectionId)
  const models = [...(connection?.models || [])].sort((a, b) => Number(b.imageLikely) - Number(a.imageLikely))

  return (
    <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm shadow-foreground/[0.02]" aria-label="图像生成设置">
      <div className="p-5">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><SlidersHorizontal className="size-4" />创作设置</h2><span className="text-sm text-muted-foreground">让想象更具体</span></div>
      </div>
      <Separator />
      <div className="p-5">
        <Tabs value={draft.references.length ? 'reference' : mode} onValueChange={(value) => { setMode(String(value)); if (value === 'text') onChange({ references: [] }) }}>
          <TabsList className="h-10 w-full"><TabsTrigger value="text"><WandSparkles />文生图</TabsTrigger><TabsTrigger value="reference"><Images />参考图生图</TabsTrigger></TabsList>
        </Tabs>
        <div className="pt-6">
          <FieldGroup>
            <Field>
              <div className="flex items-center justify-between"><FieldLabel htmlFor="prompt">画面描述</FieldLabel><span className="font-mono text-sm text-muted-foreground">{draft.prompt.length} / 4000</span></div>
              <Textarea id="prompt" value={draft.prompt} onChange={(event) => onChange({ prompt: event.target.value })} maxLength={4000} rows={6} className="min-h-40 resize-y" placeholder="描述你想看见的画面，试着加入主体、环境、光线和风格…" onKeyDown={(event) => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!busy && !uploading) onGenerate() } }} />
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">加入细节</span>{['电影质感', '自然光影', '极简构图'].map((tag) => <button key={tag} type="button" onClick={() => onChange({ prompt: `${draft.prompt}${draft.prompt ? '，' : ''}${tag}`.slice(0, 4000) })} className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">+ {tag}</button>)}</div>
            </Field>
            <Field>
              <div className="flex items-center justify-between"><FieldLabel htmlFor="references">参考图片<span className="font-normal text-muted-foreground">（可选）</span></FieldLabel><span className="font-mono text-sm text-muted-foreground">{draft.references.length} / 6</span></div>
              <input id="references" ref={fileRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { onUpload(Array.from(event.target.files || [])); event.target.value = '' }} disabled={uploading} />
              {draft.references.length > 0 && <div className="grid grid-cols-3 gap-2">{draft.references.map((asset, index) => <div key={asset.id} className="relative overflow-hidden rounded-lg border"><img src={asset.url} alt={`参考图 ${index + 1}：${asset.name}`} className="aspect-square w-full object-cover" /><div className="absolute right-1 top-1"><Button variant="secondary" size="icon-sm" aria-label={`移除参考图 ${index + 1}`} onClick={() => onChange({ references: draft.references.filter((item) => item.id !== asset.id) })}><X /></Button></div><span className="absolute bottom-1 left-1 rounded bg-card/90 px-1.5 font-mono text-sm text-foreground">{index + 1}</span></div>)}</div>}
              {draft.references.length < 6 && <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onUpload(Array.from(event.dataTransfer.files)) }} className={cn('flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition-colors', dragging ? 'border-primary bg-secondary text-primary' : 'bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-secondary/30')}>
                {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" strokeWidth={1.5} />}<span>{uploading ? '正在安全上传…' : '点击上传，或将图片拖到这里'}</span><span className="text-sm text-muted-foreground">JPG / PNG / WebP · 每张不超过 10 MB</span>
              </button>}
            </Field>
            <Field>
              <div className="flex items-center justify-between"><FieldLabel htmlFor="connection">生成模型</FieldLabel><button className="flex items-center gap-1 text-sm text-primary" onClick={onConnections}><Settings2 className="size-3.5" />管理</button></div>
              {connections.length > 0 ? <>
                <Select value={draft.connectionId || null} onValueChange={(value) => onChange({ connectionId: String(value || ''), model: '' })}><SelectTrigger id="connection" className="h-10 w-full"><SelectValue placeholder="选择 API 连接">{connection?.name}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{connections.map((item) => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
                <Select value={draft.model || null} onValueChange={(value) => onChange({ model: String(value || '') })}><SelectTrigger aria-label="生成模型" className="h-10 w-full"><SelectValue placeholder="选择发现的模型" /></SelectTrigger><SelectContent><SelectGroup>{models.map((model) => <SelectItem key={model.id} value={model.id}>{model.id}{model.imageLikely ? ' · 图像候选' : ''}</SelectItem>)}</SelectGroup></SelectContent></Select>
              </> : <button onClick={onConnections} className="flex h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm text-muted-foreground hover:border-primary/40"><span className="flex size-6 items-center justify-center rounded bg-secondary text-primary"><Plus className="size-4" /></span><span className="flex-1">连接你的生图 API</span><ChevronRight className="size-4" /></button>}
            </Field>
            <Field>
              <FieldLabel>画面比例</FieldLabel>
              <ToggleGroup value={[draft.size]} onValueChange={(values) => { if (values[0]) onChange({ size: values[0] as ImageSize }) }} variant="outline" className="w-full" aria-label="画面比例">
                {sizeOptions.map((option) => <ToggleGroupItem key={option.value} value={option.value} className="h-14 flex-1 flex-col gap-1" aria-label={`${option.label} ${option.ratio}`}><span className={cn('block rounded-sm border border-current', option.ratio === '1:1' ? 'size-4' : option.ratio === '3:2' ? 'h-3 w-5' : 'h-5 w-3')} /><span className="font-mono text-sm">{option.ratio}</span></ToggleGroupItem>)}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>生成数量</FieldLabel>
              <ToggleGroup value={[String(draft.count)]} onValueChange={(values) => { if (values[0]) onChange({ count: Number(values[0]) }) }} variant="outline" className="w-full" aria-label="生成数量">{[1, 2, 4, 10].map((count) => <ToggleGroupItem key={count} value={String(count)} className="h-9 flex-1">{count} 张</ToggleGroupItem>)}</ToggleGroup>
            </Field>
          </FieldGroup>
        </div>
        <div className="pt-5"><button type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)} className="flex w-full items-center justify-between text-sm text-muted-foreground"><span className="flex items-center gap-2"><Settings2 className="size-4" />更多设置</span><ChevronDown className={cn('size-4 transition-transform', advanced && 'rotate-180')} /></button>{advanced && <div className="pt-4"><Field><FieldLabel htmlFor="negative-prompt">排除内容</FieldLabel><Textarea id="negative-prompt" value={draft.negativePrompt} onChange={(event) => onChange({ negativePrompt: event.target.value })} maxLength={1000} placeholder="例如：模糊、文字、水印、画面畸变" /><p className="text-sm leading-relaxed text-muted-foreground">会作为补充要求合并进提示词；最终效果由所选模型决定。</p></Field></div>}</div>
      </div>
      <Separator />
      <div className="p-5"><Button className="h-11 w-full" disabled={busy || uploading || !draft.prompt.trim()} onClick={onGenerate}>{busy ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}{busy ? '任务提交中…' : '开始生成'}<span className="ml-auto font-mono opacity-60">⌘ ↵</span></Button><p className="pt-3 text-center text-sm text-muted-foreground">使用你的 API 额度 · 生成后自动保存</p></div>
    </section>
  )
}
