const CACHE_NAME = 'stamp-app-v1';
const urlsToCache = [
  '/app.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Service Worker: キャッシュ開始');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('⚠️ Service Worker: キャッシュエラー（無視して続行）:', err);
          // エラーを無視して続行（開発中は一部のファイルが見つからない可能性がある）
        });
      })
  );
  self.skipWaiting(); // 即座にアクティブ化
});

self.addEventListener('activate', function(event) {
  console.log('✅ Service Worker: アクティブ化');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // 即座に制御を開始
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          console.log('📦 キャッシュから取得:', event.request.url);
          return response;
        }
        console.log('🌐 ネットワークから取得:', event.request.url);
        return fetch(event.request).catch(err => {
          console.warn('⚠️ Fetch エラー:', event.request.url, err);
          // ネットワークエラーの場合、適切なフォールバックを返す
          return new Response('オフラインです', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});