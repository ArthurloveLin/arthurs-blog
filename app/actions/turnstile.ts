'use server'

import { headers } from 'next/headers'

export async function isTurnstileBypassed(): Promise<{ bypassed: boolean; country: string | null }> {
  try {
    const headersList = await headers()
    // 优先读取 cf-ipcountry（防止套了一层 Cloudflare 导致 Vercel 获取到的是 CF 节点的国家）
    const country = headersList.get('cf-ipcountry') || headersList.get('x-vercel-ip-country')
    
    console.log('[Turnstile Check] Detected Country:', country);
    
    return {
      bypassed: country === 'CN',
      country: country || null
    }
  } catch (error) {
    console.error('Error reading headers for country check:', error)
    return { bypassed: false, country: null }
  }
}
