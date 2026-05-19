'use client'

import { useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import Turnstile from '@/components/Turnstile'
import { useAuth } from '@/components/AuthProvider'

type Phase = 'idle' | 'open' | 'sending' | 'sent' | 'error'

export default function ContactChat() {
  const pathname = usePathname()
  const { isAuthenticated, email: authEmail, displayName, guestDisplayName } = useAuth()

  const [phase, setPhase] = useState<Phase>('idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  if (pathname.startsWith('/admin')) return null

  const open = () => {
    if (!isAuthenticated) {
      setName(guestDisplayName)
    }
    setPhase('open')
    setTimeout(() => {
      if (isAuthenticated) {
        messageRef.current?.focus()
      } else {
        nameRef.current?.focus()
      }
    }, 50)
  }

  const close = () => {
    setPhase('idle')
    setName('')
    setEmail('')
    setMessage('')
    setTurnstileToken('')
    setErrorMsg('')
  }

  const canSubmit = isAuthenticated
    ? !!message.trim()
    : !!name.trim() && !!message.trim() && !!turnstileToken

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated && !turnstileToken) {
      setErrorMsg('请等待验证完成')
      return
    }
    setPhase('sending')

    const senderName = isAuthenticated ? (displayName ?? authEmail ?? '') : name
    const senderEmail = isAuthenticated ? (authEmail ?? '') : email

    try {
      const body: Record<string, string> = { name: senderName, message }
      if (senderEmail) body.email = senderEmail
      if (!isAuthenticated) body.turnstileToken = turnstileToken

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setErrorMsg(data.error ?? '发送失败，请稍后重试')
        setPhase('error')
        return
      }
      setPhase('sent')
    } catch {
      setErrorMsg('网络错误，请稍后重试')
      setPhase('error')
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {phase !== 'idle' && (
        <div className="w-80 rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">联系站长</span>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1 hover:bg-muted transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* body */}
          <div className="p-4">
            {phase === 'sent' ? (
              <div className="py-6 text-center space-y-2">
                <div className="text-2xl">✉️</div>
                <p className="text-sm font-medium">已收到，感谢你的留言！</p>
                <p className="text-xs text-muted-foreground">我会尽快回复你</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  关闭
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <p className="text-xs text-muted-foreground">Hi！有什么想说的？</p>

                {isAuthenticated ? (
                  <p className="text-xs text-foreground/60">
                    发自：<span className="font-medium text-foreground/80">{displayName ?? authEmail}</span>
                  </p>
                ) : (
                  <>
                    <div>
                      <input
                        ref={nameRef}
                        type="text"
                        placeholder="昵称 *"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        maxLength={50}
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="邮箱（可选，用于回复）"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        maxLength={100}
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </>
                )}

                <div>
                  <textarea
                    ref={messageRef}
                    placeholder="留言内容 *"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    maxLength={1000}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {!isAuthenticated && (
                  <Turnstile
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    className="scale-90 origin-left"
                  />
                )}

                {phase === 'error' && (
                  <p className="text-xs text-destructive">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={phase === 'sending' || !canSubmit}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {phase === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {phase === 'sending' ? '发送中…' : '发送'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={phase === 'idle' ? open : close}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="联系站长"
      >
        {phase === 'idle' ? (
          <MessageCircle className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </button>
    </div>
  )
}
