import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, Layers3 } from 'lucide-react'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'
import { buttonVariants } from '@/components/ui/button'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/studio')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-md">
        <div className="pb-7"><Link href="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft data-icon="inline-start" />返回工作台</Link></div>
        <section className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8" aria-labelledby="sign-in-title">
          <div className="pb-7"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Layers3 className="size-5" /></span><span className="text-xl font-semibold">绘序 <span className="font-mono text-sm font-normal tracking-widest text-muted-foreground">HUIXU</span></span></div><h1 id="sign-in-title" className="pt-7 text-balance text-2xl font-semibold tracking-tight">让灵感，有自己的归处</h1><p className="pt-2 text-pretty text-sm leading-relaxed text-muted-foreground">连接你喜欢的模型，私密保存每一张作品。</p></div>
          <AuthForm />
        </section>
      </div>
    </main>
  )
}
