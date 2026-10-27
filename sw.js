/* 研习录 Service Worker：把页面、字体和第三方库在本机存一份——手机上「添加到主屏幕」
 * 就像装了个 App，地铁里没网也能打开翻剪报、看进度（记录的读写照常走网络）。
 * /api/、/_blob/（电子书文件）、登录相关从不缓存。
 * 版本号由 build.py 盖进来：页面一发新版，旧缓存整个换掉。 */
var V = "yxl-b2a96bf591";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\/api\/|\/_blob\/|\/login|\/logout|\/account/.test(url.pathname)) return;
  var nav = req.mode === "navigate";
  e.respondWith(caches.open(V).then(function (c) {
    if (nav) {
      /* 页面：先走网络（保证拿到最新），断网时用缓存里的首页 */
      return fetch(req).then(function (r) {
        if (r.ok) c.put(req, r.clone());
        return r;
      }).catch(function () {
        return c.match(req, { ignoreSearch: true }).then(function (m) { return m || c.match("./"); });
      });
    }
    /* 静态资源：先用缓存（字体、库都不小），后台再更新一份 */
    return c.match(req).then(function (m) {
      var net = fetch(req).then(function (r) {
        if (r.ok && r.type === "basic") c.put(req, r.clone());
        return r;
      }).catch(function () { return m; });
      return m || net;
    });
  }));
});
