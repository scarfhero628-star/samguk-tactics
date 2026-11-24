// 삼국지택틱스 - 오프라인 보관 (tools/build.py 가 만들어요. 직접 고치지 마세요)
// 게임 파일을 휴대폰에 보관해 두고, 인터넷이 없어도 홈 화면 아이콘으로 실행되게 해요.
// 새 완성본을 올리면 이 파일의 VERSION 이 바뀌고, 다음에 열 때 새 파일로 바뀌어요.
const VERSION = 'ba2209b59c999f27';
const PREFIX = 'samguk-tactics:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const PAGE = 'index.html';
const FILES = ["manifest.webmanifest", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

async function sha16(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// 게임 본체(index.html)를 받아 내용이 이 버전과 같은지 확인한 뒤 보관
async function fetchPage(firstInstall) {
  const tries = [];
  if (firstInstall) {
    // 처음에는 방금 연 페이지를 브라우저가 이미 받아 두었으니 그것을 그대로 씀 (데이터 절약)
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      const u = w.url.split('#')[0];
      if (u.startsWith(self.registration.scope)) tries.push([u, 'default']);
    }
  }
  tries.push([PAGE, 'no-cache'], [PAGE + '?v=' + VERSION, 'reload']);
  for (const [url, mode] of tries) {
    try {
      const res = await fetch(url, { cache: mode });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (await sha16(buf) !== VERSION) continue;     // 아직 예전 파일이 내려오는 중이면 다음 방법으로
      return new Response(buf, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) { /* 다음 방법으로 */ }
  }
  throw new Error('게임 파일을 받지 못했어요');
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const first = !keys.some(k => k.startsWith(PREFIX));
    const cache = await caches.open(CACHE);
    await cache.put(PAGE, await fetchPage(first));
    await Promise.all(FILES.map(async f => {
      const res = await fetch(f, { cache: 'no-cache' });
      if (res.ok) await cache.put(f, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  const key = req.mode === 'navigate' ? PAGE : req;
  e.respondWith(caches.open(CACHE)
    .then(c => c.match(key, { ignoreSearch: true }))
    .then(r => r || fetch(req)));
});
