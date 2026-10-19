/* 研习录 · 自己服务器上的版本（baba.wogucloud.cn）
 * 只在 build.py 生成 server/index.html 时放进页面，放在 app.js 前面。
 * 做两件事：
 *   1. window.YXL_SERVER：告诉 app.js 现在跑在自己的服务器上（英语一层读 Baba 的实时数据、Baba 的页面在浮层里打开、登录按钮）；
 *   2. window.claude：仿照 claude.ai 的运行时接口（db / user / assets），背后换成 Baba 的 /api/yxl/*，
 *      这样 app.js 不用改读写逻辑，照旧按“云端记录”的方式工作。
 * 记录存在 Baba 的 Postgres 里（表 YxlDoc），电子书存在服务器磁盘上（表 YxlFile），按 Baba 的登录账号分开。 */
(function () {
  /* 万一研习录被套进了 Baba 的浮层（比如在浮层里点了指回首页的链接），跳出来整页打开 */
  try { if (window.top !== window.self && window.top.location.origin === location.origin) { window.top.location.href = location.href; return; } } catch (e) { /* 不同源时不管 */ }
  var API = "/api/yxl";
  var state = null, loadedAt = 0, loading = null, pending = 0, listeners = {};
  function enc(s) { return encodeURIComponent(s); }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function json(r) {
    if (r.status === 401) throw err("upstream_auth", "请先登录");
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) { throw err(b.code || (r.status === 413 ? "too_large" : r.status === 415 ? "unsupported_type" : "http_" + r.status), b.error); });
    return r.json();
  }
  function req(path, opt) { return fetch(API + path, Object.assign({ credentials: "same-origin", cache: "no-store" }, opt || {})).then(json); }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function snap(c) {
    var m = (state && state.docs[c]) || {};
    return { docs: Object.keys(m).map(function (id) { var v = m[id]; return { id: id, exists: true, data: function () { return clone(v); } }; }) };
  }
  function emit(c) { (listeners[c] || []).forEach(function (l) { try { l(snap(c)); } catch (e) { /* 忽略 */ } }); }
  function emitAll() { Object.keys(listeners).forEach(emit); }
  /* 取一遍全部记录。有写入还没回来时先不覆盖，免得刚改的又被旧数据盖回去 */
  function load() {
    if (loading) return loading;
    loading = req("/state").then(function (s) {
      loading = null;
      if (pending) return state;
      var was = state && state.user ? state.user.id : null;
      state = { user: s.user || null, docs: s.docs || {} };
      loadedAt = Date.now(); emitAll();
      if (was !== (state.user ? state.user.id : null)) window.dispatchEvent(new Event("yxl-user"));
      return state;
    }, function (e) { loading = null; throw e; });
    return loading;
  }
  function refresh(force) { if (force || Date.now() - loadedAt > 20000) load().catch(function () {}); }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refresh(); });
  window.addEventListener("focus", function () { refresh(); });
  setInterval(function () { if (document.visibilityState === "visible") refresh(true); }, 60000);

  function local(c, id, v) {
    if (!state) state = { user: null, docs: {} };
    var m = state.docs[c] = Object.assign({}, state.docs[c]);
    if (v === undefined) delete m[id]; else m[id] = clone(v);
    emit(c);
  }
  function write(p) {
    pending++;
    return p.then(function (r) { pending--; return r; }, function (e) { pending--; refresh(true); throw e; });
  }
  var db = {
    collection: function (c) {
      return {
        onSnapshot: function (cb) {
          (listeners[c] = listeners[c] || []).push(cb);
          if (state) setTimeout(function () { cb(snap(c)); }, 0);
          return function () { var a = listeners[c] || [], i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); };
        },
        doc: function (id) {
          return {
            get: function () { return req("/doc?coll=" + enc(c) + "&id=" + enc(id)).then(function (r) { return { id: id, exists: !!r.exists, data: function () { return clone(r.data); } }; }); },
            set: function (v) {
              local(c, id, v);
              return write(req("/doc", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ coll: c, id: id, data: v }) }));
            },
            delete: function () {
              local(c, id, undefined);
              return write(req("/doc?coll=" + enc(c) + "&id=" + enc(id), { method: "DELETE" }));
            }
          };
        }
      };
    }
  };
  var user = { isOwner: function () { return Promise.resolve(!!(state && state.user)); } };
  var assets = {
    upload: function (blob, opt) {
      var type = (opt && opt.type) || blob.type || "application/octet-stream";
      var name = blob.name || (type === "application/pdf" ? "book.pdf" : "book.epub.b64.txt");
      var fd = new FormData(); fd.append("file", new File([blob], name, { type: type }));
      return req("/files", { method: "POST", body: fd });
    },
    delete: function (id) { return req("/files/" + enc(id), { method: "DELETE" }); }
  };

  window.YXL_SERVER = {
    me: function () { return state && state.user; },
    reload: function () { return load(); },
    loginHref: function () { return "/login?callbackUrl=" + enc("/" + location.hash); },
    /* 英语一层：Baba 上的片子、每部看到哪、生词本各状态的数量 */
    english: function () { return req("/english"); },
    /* 把从 claude.ai 导出的记录（{ 集合: { 文档 id: 内容 } }）整批写进来 */
    importDocs: function (obj) {
      var src = obj && obj.data && typeof obj.data === "object" && !Array.isArray(obj.data) ? obj.data : obj, docs = [];
      Object.keys(src || {}).forEach(function (c) {
        var m = src[c]; if (!m || typeof m !== "object" || Array.isArray(m) || c === "ebooks") return;
        Object.keys(m).forEach(function (id) { var v = m[id]; if (v && typeof v === "object" && !Array.isArray(v)) docs.push({ coll: c, id: id, data: v }); });
      });
      if (!docs.length) return Promise.reject(err("empty", "文件里没有能导入的记录"));
      var out = { written: 0, skipped: 0 }, i = 0;
      function next() {
        if (i >= docs.length) return Promise.resolve(out);
        var part = docs.slice(i, i + 200); i += 200;
        return req("/docs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs: part }) }).then(function (r) { out.written += r.written || 0; out.skipped += r.skipped || 0; return next(); });
      }
      return next().then(function (r) { return load().then(function () { return r; }); });
    }
  };
  window.claude = {
    use: function (name) {
      if (name === "db") return load().then(function () { return db; });
      if (name === "user") return load().then(function () { return user; }, function () { return user; });
      if (name === "assets") return Promise.resolve(assets);
      return Promise.resolve(null);
    }
  };
})();
