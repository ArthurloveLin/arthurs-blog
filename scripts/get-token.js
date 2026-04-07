const fs = require('fs');
const client_id = '0757b30ff29e4b73a882539984121397';
const client_secret = 'a37b7327c9bf49078fe0f4315f8e324a';
const code = 'AQATDBK5veQB6R_XgsAli0LotDP5sbn-ROYqXoGxliPJYbQrzqf4TIG-veJIK1NoG3dKruetaOdCSsa5oOyXRSiFiIPKbBePFIzBTKVPkoY8JD5VpH2MLvAGaX_F887DYvQeXKdzShxNOD5xHl2_6PdnNGg-tPwXBzmu_5AVmFsDr9QLl3IswmiUODe5284EuQKn6kLR4C6uj_ytvNs-zwKOPf_AAwTnjzi4Yox1YoTPKHGWjbO9GbH5dnfzMazSkVICkwj8MtuOp34';
const redirect_uri = 'http://127.0.0.1:3000';
const basic = Buffer.from(client_id + ':' + client_secret).toString('base64');

async function run() {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + basic,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
      }),
    });
    const data = await res.json();
    fs.writeFileSync('/home/arthur/project/arthur_grace_tools/wardrobe-picks/scripts/spotify_token.json', JSON.stringify(data, null, 2));
    console.log('Token data saved to scripts/spotify_token.json');
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
