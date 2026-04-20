const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachePath(rootDir) {
  return path.join(rootDir, '.bare', 'grove-update-check');
}

function getLatestVersionFromCache(rootDir) {
  try {
    const cachePath = getCachePath(rootDir);
    if (!fs.existsSync(cachePath)) return null;
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    if (Date.now() - cache.checkedAt > CACHE_TTL) return null;
    return cache.latestVersion || null;
  } catch {
    return null;
  }
}

function fetchLatestVersionAsync(rootDir) {
  const cachePath = getCachePath(rootDir);
  const req = https.get('https://registry.npmjs.org/@rawvv/grove/latest', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const { version } = JSON.parse(data);
        fs.writeFileSync(cachePath, JSON.stringify({ latestVersion: version, checkedAt: Date.now() }));
      } catch {}
    });
  });
  req.on('error', () => {});
  req.setTimeout(2000, () => req.destroy());
}

module.exports = { getLatestVersionFromCache, fetchLatestVersionAsync };
