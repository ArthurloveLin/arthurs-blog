'use server'

import { headers } from 'next/headers'

export async function isTurnstileBypassed(): Promise<boolean> {
  try {
    const headersList = await headers()
    const country = headersList.get('x-vercel-ip-country') || headersList.get('cf-ipcountry')
    return country === 'CN'
  } catch (error) {
    console.error('Error reading headers for country check:', error)
    return false
  }
}
