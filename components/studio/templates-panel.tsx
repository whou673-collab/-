'use client'

import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { inspirations, type Inspiration } from '@/lib/studio'

export function TemplatesPanel({ onSelect }: { onSelect: (item: Inspiration) => void }) {
  return <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">{inspirations.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-card text-card-foreground"><img src={item.image} alt={item.title} className="aspect-[4/3] w-full object-cover" /><div className="p-5"><div className="flex flex-col gap-3"><div className="flex items-center justify-between"><Badge variant="secondary">{item.category}</Badge><span className="text-sm text-muted-foreground">灵感示例</span></div><h2 className="text-lg font-medium text-balance">{item.title}</h2><p className="text-sm leading-relaxed text-muted-foreground">{item.prompt}</p><Button variant="outline" className="w-full" onClick={() => onSelect(item)}>使用这个灵感<ArrowUpRight data-icon="inline-end" /></Button></div></div></article>)}</div>
}
