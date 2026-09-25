'use client'

import { Aperture, ArrowUpRight, ChevronDown, CircleHelp, Heart, History, Layers3, LogOut, PlugZap, Sparkles, UserRound, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { StudioStatus, StudioView } from '@/lib/studio'

const links = [
  { id: 'create', label: '创作工作台', icon: WandSparkles },
  { id: 'templates', label: '灵感模板', icon: Layers3 },
  { id: 'history', label: '生成历史', icon: History },
  { id: 'favorites', label: '我的收藏', icon: Heart },
] as const

export function StudioSidebar({ view, onNavigate, user, onAccount, onHelp, onSignOut }: {
  view: StudioView
  onNavigate: (view: StudioView) => void
  user: StudioStatus['user']
  onAccount: () => void
  onHelp: () => void
  onSignOut: () => void
}) {
  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pb-8 pt-8">
        <button className="flex items-center gap-3 outline-offset-4" onClick={() => onNavigate('create')} aria-label="绘序首页">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Aperture className="size-7" strokeWidth={1.6} /></span>
          <span className="flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight">绘序</span><span className="font-mono text-sm tracking-widest text-muted-foreground">HUIXU</span></span>
        </button>
      </div>
      <div className="px-4">
        <div className="rounded-xl border bg-background p-3">
          <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-card text-foreground"><Layers3 className="size-4" /></span><span className="flex-1 text-sm font-medium">个人创作空间</span><ChevronDown className="size-4 text-muted-foreground" /></div>
        </div>
      </div>
      <div className="px-6 pb-3 pt-8 text-sm text-muted-foreground">工作空间</div>
      <nav aria-label="工作空间导航" className="flex flex-col gap-1.5 px-3">
        {links.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)} aria-current={view === id ? 'page' : undefined} className={cn('flex h-11 items-center gap-3 rounded-lg px-4 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary', view === id ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-[18px]" strokeWidth={1.7} /><span>{label}</span>{id === 'create' && <span className="ml-auto size-1.5 rounded-full bg-current" />}</button>)}
      </nav>
      <div className="px-6 py-6"><Separator /></div>
      <nav aria-label="连接设置" className="px-3">
        <button onClick={() => onNavigate('connections')} aria-current={view === 'connections' ? 'page' : undefined} className={cn('flex h-11 w-full items-center gap-3 rounded-lg px-4 text-sm transition-colors', view === 'connections' ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><PlugZap className="size-[18px]" strokeWidth={1.7} />API 连接<span className="ml-auto rounded border px-1.5 font-mono text-sm">BYOK</span></button>
      </nav>
      <div className="mt-auto px-4 pb-5 pt-12">
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" />你的模型，你的创造力</div>
          <p className="pb-3 pt-2 text-sm leading-relaxed text-muted-foreground">连接自己的 API，让每一份灵感都有更多可能。</p>
          <Button variant="outline" className="w-full" onClick={() => onNavigate('connections')}>管理连接<ArrowUpRight data-icon="inline-end" /></Button>
        </div>
      </div>
      <div className="px-4 pb-4"><Button variant="ghost" onClick={onHelp} className="w-full justify-start"><CircleHelp data-icon="inline-start" />使用指南</Button></div>
      <Separator />
      <div className="p-4"><div className="flex items-center gap-3"><button onClick={onAccount} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><UserRound className="size-4" /></span><span className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-sm font-medium">{user?.name || '访客创作者'}</span><span className="truncate text-sm text-muted-foreground">{user ? '个人账户' : '登录以保存你的创作'}</span></span></button>{user && <Button variant="ghost" size="icon" aria-label="退出登录" onClick={onSignOut}><LogOut /></Button>}</div></div>
    </aside>
  )
}
