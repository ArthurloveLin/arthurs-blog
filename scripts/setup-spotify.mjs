import fs from 'fs';
import path from 'path';
import readline from 'readline';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envContent.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const client_id = env.SPOTIFY_CLIENT_ID;
const client_secret = env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'http://127.0.0.1:3000';
const scope = 'user-read-currently-playing user-read-playback-state user-read-recently-played';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}`;

console.log('\n--- Spotify v2 Setup ---\n');
console.log('1. 请在浏览器中打开此链接并授权:');
console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
console.log('2. 授权后，页面会跳转到 http://127.0.0.1:3000/?code=...');

rl.question('3. 请粘贴跳转后的完整 URL 或 code 值: ', async (input) => {
  let code = input;
  if (input.includes('code=')) {
    code = new URL(input).searchParams.get('code');
  }

  console.log('\n正在换取 Refresh Token...');

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    const data = await res.json();

    if (data.error) {
      console.error('\x1b[31m失败了:\x1b[0m', data.error_description || data.error);
    } else {
      const newToken = data.refresh_token;
      console.log('\x1b[32m成功获取 Token!\x1b[0m');
      
      const newContent = envContent.replace(/SPOTIFY_REFRESH_TOKEN=.*/, `SPOTIFY_REFRESH_TOKEN=${newToken}`);
      fs.writeFileSync(envPath, newContent);
      console.log('\x1b[32m.env.local 已更新。\x1b[0m');
      console.log('\n现在请重启您的 npm run dev 服务器即可！');
    }
  } catch (err) {
    console.error('\x1b[31m请求出错:\x1b[0m', err.message);
  } finally {
    rl.close();
  }
});
