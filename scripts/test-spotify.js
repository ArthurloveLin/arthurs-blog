/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value[0]) acc[key.trim()] = value.join('=').trim();
  return acc;
}, {});

const client_id = env.SPOTIFY_CLIENT_ID;
const client_secret = env.SPOTIFY_CLIENT_SECRET;
const refresh_token = env.SPOTIFY_REFRESH_TOKEN;

const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;
const PLAYER_ENDPOINT = `https://api.spotify.com/v1/me/player`;
const RECENTLY_PLAYED_ENDPOINT = `https://api.spotify.com/v1/me/player/recently-played?limit=1`;

async function test() {
  console.log('--- Auth ---');
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error('Auth Error:', tokenData.error);
    return;
  }
  const access_token = tokenData.access_token;
  console.log('Auth OK');

  console.log('--- Current Player ---');
  const playerRes = await fetch(PLAYER_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  console.log('Status:', playerRes.status);
  if (playerRes.status === 200) {
    const data = await playerRes.json();
    console.log('Playing:', data.item?.name, 'on', data.device?.name);
  } else if (playerRes.status === 204) {
    console.log('No active playback (204)');
  } else {
    const err = await playerRes.text();
    console.log('Error:', err);
  }

  console.log('--- Recently Played ---');
  const recentRes = await fetch(RECENTLY_PLAYED_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  console.log('Status:', recentRes.status);
  if (recentRes.ok) {
    const data = await recentRes.json();
    console.log('Recent:', data.items[0]?.track?.name, 'at', data.items[0]?.played_at);
  } else {
    const err = await recentRes.text();
    console.log('Error:', err);
  }
}

test();
