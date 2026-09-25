'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AuthForm({ onAuthenticated }: { onAuthenticated?: () => Promise<void> }) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (mode === 'sign-up' && !name.trim()) { setError('请填写你的称呼。'); return }
    setPending(true)
    setError('')
    try {
      const result = mode === 'sign-up'
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() })
        : await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) {
        setError(result.error.status === 429
          ? '尝试次数过多，请稍后再试。'
          : mode === 'sign-up' ? '注册未完成，请检查信息或尝试登录。' : '登录未完成，请检查邮箱和密码后重试。')
        return
      }
      setPassword('')
      if (onAuthenticated) await onAuthenticated()
      else { router.replace('/studio'); router.refresh() }
    } catch {
      setError('暂时无法完成账户操作，请检查网络后重试。')
    } finally { setPending(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      }} aria-busy={pending}>
        <FieldGroup>
          {mode === 'sign-up' && <Field><FieldLabel htmlFor="auth-name">你的称呼</FieldLabel><Input id="auth-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} disabled={pending} placeholder="我们该如何称呼你" /></Field>}
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="auth-email">邮箱</FieldLabel>
            <Input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} required maxLength={254} disabled={pending} placeholder="you@example.com" aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
          </Field>
          <Field data-invalid={!!error}>
            <div className="flex items-center justify-between"><FieldLabel htmlFor="auth-password">密码</FieldLabel><Button type="button" variant="ghost" size="sm" onClick={() => setVisible(!visible)} aria-pressed={visible} disabled={pending}>{visible ? '隐藏密码' : '显示密码'}</Button></div>
            <Input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} required minLength={8} maxLength={128} disabled={pending} placeholder="至少 8 位密码" aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
            {mode === 'sign-up' && <FieldDescription>建议使用密码管理器生成的独立密码。</FieldDescription>}
          </Field>
          {error && <Alert variant="destructive" id="auth-error"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" disabled={pending} className="h-11 w-full">{pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}{pending ? '正在安全连接…' : mode === 'sign-up' ? '创建账户，开始创作' : '登录创作空间'}{!pending && <ArrowRight data-icon="inline-end" />}</Button>
        </FieldGroup>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground"><span>{mode === 'sign-in' ? '第一次来到绘序？' : '已经有账户了？'}</span><Button type="button" variant="link" size="sm" disabled={pending} onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setPassword(''); setVisible(false) }}>{mode === 'sign-in' ? '创建账户' : '返回登录'}</Button></div>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>API 密钥在服务端加密保存，参考图和作品仅对当前账户开放。</span></p>
    </div>
  )
}
