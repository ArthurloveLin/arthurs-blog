'use client'

import React, { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useTheme } from 'next-themes'

interface TurnstileProps {
  onVerify?: (token: string) => void
  onError?: (error: any) => void
  onExpire?: () => void
  className?: string
}

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: (error: any) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onloadTurnstileCallback: () => void
  }
}

/**
 * Cloudflare Turnstile 组件 (最佳实践版)
 * - 自动处理主题
 * - 自动集成 FormData (通过隐藏 input)
 * - 支持重置
 */
export default function Turnstile({
  onVerify,
  onError,
  onExpire,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState<string>('')
  const { theme, resolvedTheme } = useTheme()
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY

  const currentTheme = (resolvedTheme || theme || 'auto') as 'light' | 'dark' | 'auto'

  useEffect(() => {
    if (!siteKey) {
      console.warn('Turnstile Site Key is missing')
      return
    }

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: currentTheme === 'dark' ? 'dark' : 'light',
          callback: (newToken: string) => {
            setToken(newToken)
            onVerify?.(newToken)
          },
          'error-callback': (err: any) => {
            onError?.(err)
          },
          'expired-callback': () => {
            setToken('')
            onExpire?.()
          },
        })
      }
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      window.onloadTurnstileCallback = renderWidget
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey, currentTheme, onVerify, onError, onExpire])

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback"
        strategy="afterInteractive"
      />
      {/* Turnstile 容器 */}
      <div ref={containerRef} />
      
      {/* 隐藏输入框，以便 Server Action 自动获取值 */}
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </div>
  )
}
