/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async scheduled(event, env, ctx) {
    // 根据触发器名称或时间判断模式
    // 注意：我们将通过两个不同的 Cron 触发该函数
    const isFullSync = event.cron === "5 16 * * *"; // 假设每天凌晨触发的是 Full
    const mode = isFullSync ? "full" : "quick";
    const url = `${env.SYNC_URL}?mode=${mode}`;

    console.log(`正在触发 Spotify [${mode.toUpperCase()}] 同步...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-spotify-sync-secret": env.SYNC_SECRET,
        "User-Agent": "Cloudflare-Cron-Worker"
      }
    });

    if (response.ok) {
      console.log(`${mode} 同步请求发送成功。`);
    } else {
      const text = await response.text();
      console.error(`${mode} 同步失败，状态码 ${response.status}: ${text}`);
    }
  },

  async fetch(request, env, ctx) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'quick';
    const url = `${env.SYNC_URL}?mode=${mode}`;

    await fetch(url, {
      method: "POST",
      headers: {
        "x-spotify-sync-secret": env.SYNC_SECRET,
      }
    });
    return new Response(`${mode} 同步已手动触发。`);
  }
};

