/**
 * Cloudflare Turnstile 验证逻辑
 * 参考: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export interface TurnstileVerificationResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * 在服务端验证 Turnstile 令牌
 * @param token 前端传回的 cf-turnstile-response 令牌
 * @param remoteip 用户的可选 IP 地址
 */
export async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error('CLOUDFLARE_TURNSTILE_SECRET_KEY is not defined');
    return false;
  }

  // 如果没有 token，直接返回失败
  if (!token) {
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const result = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        body: formData,
        method: 'POST',
      }
    );

    const outcome: TurnstileVerificationResponse = await result.json();

    if (!outcome.success) {
      console.warn('Turnstile verification failed:', outcome['error-codes']);
    }

    return outcome.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}
