import { readFile } from '../node-shim.mjs';

/**
 * Destination accounts live server-side only. Example accounts.json:
 *
 * [
 *   { "id": "pc-linkedin", "provider": "linkedin", "label": "Planet Crust",
 *     "author": "urn:li:organization:123456", "tokenEnv": "SMA_LINKEDIN_PC_TOKEN", "apiVersion": "202611" },
 *   { "id": "pc-x", "provider": "x", "label": "@PlanetCrust", "handle": "PlanetCrust",
 *     "tokenEnv": "SMA_X_PC_TOKEN", "longPosts": false }
 * ]
 *
 * Tokens are read from the named environment variable at send time and never stored in
 * the queue, written to logs, or returned to the browser.
 */
export async function loadAccountsFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Could not read accounts file ' + file + ': ' + error.message);
  }
}

export function normaliseAccounts(list) {
  if (!Array.isArray(list)) throw new Error('Accounts must be an array.');
  const map = new Map();
  for (const raw of list) {
    if (!raw?.id || !raw?.provider) throw new Error('Every account needs an id and a provider.');
    if ('token' in raw || 'accessToken' in raw) throw new Error('Put tokens in environment variables (tokenEnv), not in the accounts file: ' + raw.id);
    if (map.has(raw.id)) throw new Error('Duplicate account id ' + raw.id);
    if (raw.channel !== undefined && (typeof raw.channel !== 'string' || !raw.channel.trim() || raw.channel.length > 60)) throw new Error('Account ' + raw.id + ' has an invalid channel name.');
    for (const key of ['site', 'logo']) {
      if (raw[key] === undefined) continue;
      let ok = false;
      try { ok = ['https:', 'http:'].includes(new URL(raw[key]).protocol); } catch { ok = false; }
      if (!ok) throw new Error('Account ' + raw.id + ' needs a full http(s) address for ' + key + '.');
    }
    map.set(raw.id, Object.freeze({ ...raw, ...(raw.channel ? { channel: raw.channel.trim() } : {}) }));
  }
  return map;
}

export const envCredentials = env => account => {
  const token = account.tokenEnv ? env[account.tokenEnv] : '';
  return token ? { accessToken: token } : null;
};

// Every destination the workspace lists (except WordPress, which SMA never publishes) gets a
// simulated account so it can be tried end to end. Platforms other than LinkedIn and X publish
// through a webhook endpoint (n8n, Zapier, Make or your own service) in live mode.
const SIMULATED_CHANNELS = ['Facebook', 'Instagram', 'Threads', 'TikTok', 'Pinterest', 'Bluesky', 'Mastodon', 'Reddit', 'Snapchat', 'Tumblr', 'Quora', 'XING', 'Google Business Profile', 'VK', 'LINE', 'Lemmy',
  'Telegram', 'WhatsApp', 'Discord', 'Signal', 'WeChat', 'Google Chat',
  'LinkedIn Newsletter', 'Substack', 'beehiiv', 'Mailchimp', 'Kit', 'Brevo', 'MailerLite', 'Buttondown',
  'Medium', 'Ghost', 'Hashnode', 'DEV', 'Webflow', 'Wix', 'Squarespace', 'HubSpot',
  'YouTube', 'Vimeo', 'Twitch', 'Spotify', 'Apple Podcasts', 'Patreon', 'Behance', 'Dribbble', 'Flickr'];
const COMMENTING = new Set(['Facebook', 'Instagram', 'Threads', 'TikTok', 'Bluesky', 'Mastodon', 'Reddit', 'YouTube', 'Medium', 'Tumblr', 'Quora', 'XING', 'LinkedIn Newsletter', 'Substack', 'Hashnode', 'DEV', 'Vimeo', 'Twitch', 'Patreon', 'Behance', 'Dribbble', 'Flickr', 'VK', 'Lemmy']);
export const SIMULATED_ACCOUNTS = [
  { id: 'linkedin-planet-crust', provider: 'linkedin', label: 'Planet Crust (simulated)', author: 'urn:li:organization:0' },
  { id: 'x-planet-crust', provider: 'x', label: '@PlanetCrust (simulated)', handle: 'PlanetCrust' },
  { id: 'website-demo', provider: 'webhook', channel: 'Website', label: 'planetcrust.com (simulated)', site: 'https://www.planetcrust.com', supportsComments: true },
  ...SIMULATED_CHANNELS.map(channel => ({
    id: 'sim-' + channel.toLowerCase().replace(/[^a-z0-9]+/g, '-'), provider: 'webhook', channel,
    label: 'Planet Crust on ' + channel + ' (simulated)', supportsComments: COMMENTING.has(channel)
  }))
];
