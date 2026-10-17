(function () {
  "use strict";
  document.documentElement.lang = "zh-CN";

  var LIB = window.YXL_LIB, REC = window.YXL_RECORD || { data: {} };
  var PLAN = window.YXL_PLAN || null, STUDY_SNAP = window.YXL_STUDY || { next: {}, days: {}, streak: 0 };
  var LESSON_SNAP = window.YXL_LESSONS || {};
  /* 有课程页的线：电影、SQL、Python、CFA、地缘、周复盘 */
  var COURSES = PLAN ? ["film", "sql", "py", "cfa", "geo", "rev"].filter(function (k) { return PLAN.lessons[k]; }) : [];
  var COLLS = ["progress", "notes", "journal", "cards", "study", "film", "ebooks"];
  var STATUS = [["todo", "未开始"], ["doing", "进行中"], ["done", "已完成"], ["review", "已内化"]];
  var STATUS_LABEL = {}; STATUS.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });
  var MARK = { done: "阅", review: "熟" };
  var BOX_DAYS = [0, 1, 3, 7, 16, 35];
  var LS_KEY = "yanxilu-local-v1";
  var CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var p = s.split("-").map(Number); return ymd(new Date(p[0], p[1] - 1, p[2] + n)); }
  function hhmm() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function emptyData() { return { progress: {}, notes: {}, journal: {}, cards: {}, study: {}, film: {}, ebooks: {} }; }

  /* ---------- 索引 ---------- */
  var ITEMS = {};
  LIB.tracks.forEach(function (t) {
    t.stages.forEach(function (s) { s.items.forEach(function (it) { if (typeof it === "object") ITEMS[it.id] = Object.assign({ tracks: [], home: t.id }, it); }); });
  });
  LIB.tracks.forEach(function (t) {
    t.stages.forEach(function (s) {
      s.items = s.items.map(function (it) { var id = typeof it === "string" ? it : it.id; var x = ITEMS[id]; if (x.tracks.indexOf(t.id) < 0) x.tracks.push(t.id); return x; });
    });
  });
  var TRACK = {}; LIB.tracks.forEach(function (t) { TRACK[t.id] = t; });
  /* 正在精读的书：focus 可以是一本书的 id，也可以是几本书的数组 */
  var FOCUS = [].concat(LIB.focus || []).filter(function (id) { return LIB.books[id]; });
  if (!FOCUS.length) FOCUS = Object.keys(LIB.books).slice(0, 1);
  var CARDS = [], CARD = {};
  Object.keys(LIB.books).forEach(function (bid) { LIB.books[bid].cards.forEach(function (c) { var x = Object.assign({ book: bid }, c); CARDS.push(x); CARD[c.id] = x; }); });
  function chId(bid, n) { return bid + "-ch" + n; }

  /* ---------- 状态 ---------- */
  var S = {
    mode: "pending", canEdit: false, db: null,
    data: Object.assign(emptyData(), clone(REC.data || {})), local: emptyData(),
    route: "home", bookTab: "intro", openCh: {}, flipped: {}, hl: null, rv: null,
    confirmDel: null, dirty: false, raf: 0,
    zoom: "gist", secOpen: {}, prShown: {}, prDone: {}, pendingSec: null,
    practice: "switch", sw: { A1: true, A2: true, A3: true, A4: true, A5: true },
    mapMode: "trunk", mapOpen: {}, nestOff: {}
  };
  COLLS.forEach(function (c) { S.data[c] = S.data[c] || {}; });

  function st(id) { var p = S.data.progress[id]; return (p && p.s) || "todo"; }
  function isDone(id) { var s = st(id); return s === "done" || s === "review"; }
  function trackProg(t) {
    var ids = {}; t.stages.forEach(function (s) { s.items.forEach(function (it) { ids[it.id] = 1; }); });
    var all = Object.keys(ids), done = all.filter(isDone).length, doing = all.filter(function (i) { return st(i) === "doing"; }).length;
    return { total: all.length, done: done, doing: doing };
  }
  function bookProg(bid) { var b = LIB.books[bid]; return { total: b.chapters.length, done: b.chapters.filter(function (c) { return isDone(chId(bid, c.n)); }).length }; }
  function allItems() { return Object.keys(ITEMS); }
  function boxOf(id) { var c = S.data.cards[id]; return (c && c.box) || 0; }
  function dueCards() {
    var t = today();
    return CARDS.filter(function (c) {
      var s = S.data.cards[c.id];
      if (c.prompt && !s) return false; // 嵌入式自测题：读到并自评过之后才进入复习
      return !s || !s.due || s.due <= t;
    });
  }
  function gradeCard(id, g) {
    var cur = S.data.cards[id] || {}, box = cur.box || 0;
    if (g === "again") box = 1; else if (g === "good") box = Math.min(5, box + 1); else box = Math.max(1, box);
    return put("cards", id, { box: box, due: addDays(today(), BOX_DAYS[box]), last: today() });
  }
  function journalEntries() {
    return Object.keys(S.data.journal).map(function (k) { return Object.assign({ id: k }, S.data.journal[k]); })
      .sort(function (a, b) { return a.date === b.date ? String(b.t || "").localeCompare(String(a.t || "")) : String(b.date).localeCompare(String(a.date)); });
  }
  function refLabel(ref) {
    if (!ref) return "";
    if (ref === "plan") return "路线单";
    if (ITEMS[ref]) return ITEMS[ref].kind === "book" ? "《" + ITEMS[ref].title + "》" : ITEMS[ref].title;
    var m = /^(.+)-ch(\d+)$/.exec(ref);
    if (m && LIB.books[m[1]]) return "《" + LIB.books[m[1]].title + "》第" + CN[+m[2]] + "章";
    return "";
  }
  function refHref(ref) {
    if (!ref) return "";
    if (ref === "plan") return "#journal";
    var m = /^(.+)-ch(\d+)$/.exec(ref);
    if (m && LIB.books[m[1]]) return "#b-" + m[1];
    var it = ITEMS[ref]; if (!it) return "";
    if (it.module) return "#b-" + it.module;
    return "#t-" + it.tracks[0];
  }

  /* ---------- 读写 ---------- */
  var chains = {};
  function writeErr(e) {
    var code = e && e.code;
    if (code === "invalid_argument") { S.canEdit = false; scheduleRender(); return "这份记录对你是只读的，修改没有保存。"; }
    if (code === "quota_exceeded") return "记录数量已到上限，需要先清理一些旧条目。";
    if (code === "revoked") { S.canEdit = false; scheduleRender(); return "访问已变更，页面转为只读。"; }
    return "保存失败，请稍后再试。";
  }
  function chain(key, fn) {
    chains[key] = (chains[key] || Promise.resolve()).then(fn).catch(function (e) { toast(writeErr(e)); throw e; });
    return chains[key].catch(function () {});
  }
  function put(coll, id, val) {
    S.data[coll] = Object.assign({}, S.data[coll]); S.data[coll][id] = val;
    if (S.mode === "db") return chain(coll + "/" + id, function () { return S.db.collection(coll).doc(id).set(val); });
    S.local[coll][id] = val; saveLocal(); return Promise.resolve();
  }
  function del(coll, id) {
    S.data[coll] = Object.assign({}, S.data[coll]); delete S.data[coll][id];
    if (S.mode === "db") return chain(coll + "/" + id, function () { return S.db.collection(coll).doc(id).delete(); });
    S.local[coll][id] = null; saveLocal(); return Promise.resolve();
  }
  function readLocal() {
    try {
      var r = JSON.parse(localStorage.getItem(LS_KEY) || "null"), o = emptyData();
      if (r && typeof r === "object") COLLS.forEach(function (c) { if (r[c] && typeof r[c] === "object") o[c] = r[c]; });
      return o;
    } catch (e) { return emptyData(); }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S.local)); }
    catch (e) { toast("这个浏览器不允许本地保存，刷新后修改会丢失。"); }
  }
  function enterLocal() {
    S.mode = "local"; S.canEdit = true; S.local = readLocal();
    var d = Object.assign(emptyData(), clone(REC.data || {}));
    COLLS.forEach(function (c) {
      d[c] = d[c] || {};
      Object.keys(S.local[c]).forEach(function (k) { var v = S.local[c][k]; if (v === null) delete d[c][k]; else d[c][k] = v; });
    });
    S.data = d; render();
  }
  function connect() {
    var timer = setTimeout(function () { if (S.mode === "pending") enterLocal(); }, 12000);
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      clearTimeout(timer);
      var db = r[0], user = r[1];
      if (!db) { if (S.mode === "pending") enterLocal(); return; }
      if (S.mode === "local") return;
      S.db = db; S.mode = "db";
      var owner = user ? user.isOwner() : Promise.resolve(false);
      Promise.resolve(owner).then(function (v) { S.canEdit = !!v; render(); }, function () { S.canEdit = false; render(); });
      window.claude.use("assets").then(function (a) { S.assets = a || null; render(); }, function () { S.assets = null; });
      COLLS.forEach(function (c) {
        try {
          db.collection(c).onSnapshot(function (snap) {
            var m = {}; snap.docs.forEach(function (d) { if (d.exists) m[d.id] = d.data(); });
            S.data[c] = m; scheduleRender();
          }, function (e) {
            if (e && e.code === "revoked") { S.canEdit = false; scheduleRender(); return; }
            toast("记录同步中断，刷新页面即可恢复。");
          });
        } catch (e) { /* 忽略：保留快照 */ }
      });
      render();
    }, function () { clearTimeout(timer); if (S.mode === "pending") enterLocal(); });
  }

  /* ---------- 渲染调度 ---------- */
  function isEditing() {
    var a = document.activeElement;
    if (!a || !a.closest || !a.closest("main")) return false;
    return a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && ["text", "number", "date", "search"].indexOf(a.type) >= 0);
  }
  function scheduleRender() {
    if (isEditing()) { S.dirty = true; return; }
    if (S.raf) return;
    S.raf = requestAnimationFrame(function () { S.raf = 0; render(); });
  }
  document.addEventListener("focusout", function () {
    setTimeout(function () { if (S.dirty && !isEditing()) { S.dirty = false; render(); } }, 60);
  });

  /* ---------- 通用片段 ---------- */
  function statusCtl(id, label) {
    var s = st(id), mk = MARK[s] ? '<i class="mk" aria-hidden="true">' + MARK[s] + "</i>" : "";
    if (!S.canEdit) return '<span class="stw s-' + s + '">' + mk + '<span class="st">' + STATUS_LABEL[s] + "</span></span>";
    var opts = STATUS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === s ? " selected" : "") + ">" + x[1] + "</option>"; }).join("");
    return '<span class="stw s-' + s + '">' + mk + '<select class="st" id="st-' + esc(id) + '" data-act="status" data-id="' + esc(id) + '" aria-label="' + esc(label) + ' 的进度">' + opts + "</select></span>";
  }
  function statusChip(id) {
    var s = st(id), mk = MARK[s] ? '<i class="mk" aria-hidden="true">' + MARK[s] + "</i>" : "";
    return '<span class="stw s-' + s + '">' + mk + '<span class="st">' + STATUS_LABEL[s] + "</span></span>";
  }
  function noteBlock(id, label, placeholder) {
    var n = S.data.notes[id], text = (n && n.text) || "";
    if (S.canEdit) {
      return '<div class="note"><label for="note-' + esc(id) + '">' + esc(label) + "</label>" +
        '<textarea id="note-' + esc(id) + '" data-note="' + esc(id) + '" placeholder="' + esc(placeholder) + '">' + esc(text) + "</textarea>" +
        '<span class="ns" id="ns-' + esc(id) + '">' + (n && n.t ? "上次保存 " + esc(String(n.t).slice(0, 10)) : "边读边写，自动保存") + "</span></div>";
    }
    return '<div class="note"><span class="note-lab">' + esc(label) + "</span>" + (text ? '<div class="note-ro">' + esc(text) + "</div>" : '<div class="note-ro empty">还没有批注。</div>') + "</div>";
  }
  function bannerHTML() {
    if (S.mode !== "local") return "";
    return '<div class="banner" role="note"><span>公开阅读版：显示的是 ' + esc(REC.syncedAt || "") + ' 同步的学习记录。你在这里标的进度和写的批注只保存在当前浏览器。</span>' +
      '<button class="btn small ghost" type="button" data-act="export">复制我的记录</button></div>';
  }
  function stripHTML(bid) {
    var b = LIB.books[bid];
    var cols = b.chapters.length === 10 ? "" : ' style="grid-template-columns:repeat(' + b.chapters.length + ',minmax(0,1fr))"';
    return '<div class="strip" role="list" aria-label="章节进度"' + cols + ">" + b.chapters.map(function (c) {
      var s = st(chId(bid, c.n));
      return '<button type="button" role="listitem" class="cell ' + s + '" data-act="open-ch" data-book="' + bid + '" data-n="' + c.n + '" title="第' + CN[c.n] + "章 " + esc(c.title) + " · " + STATUS_LABEL[s] + '">' + c.n + "</button>";
    }).join("") + "</div>";
  }
  function journalList(list, deletable) {
    if (!list.length) return '<p class="empty-line">还没有学习足迹。读完一段、讨论完一个问题，就记一笔。</p>';
    return '<ul class="jlist">' + list.map(function (e) {
      var ref = refLabel(e.ref), href = refHref(e.ref);
      var del = "";
      if (S.canEdit && deletable) {
        del = S.confirmDel === e.id
          ? '<span class="jdel">删除这条？<button type="button" class="linkbtn danger" data-act="j-del-yes" data-id="' + esc(e.id) + '">删除</button><button type="button" class="linkbtn" data-act="j-del-no">取消</button></span>'
          : '<button type="button" class="linkbtn" data-act="j-del" data-id="' + esc(e.id) + '">删除</button>';
      }
      return '<li><span class="jdate">' + esc(e.date) + "</span><div class=\"jbody\">" +
        (ref || e.minutes ? '<div class="jmeta">' + (ref ? (href ? '<a href="' + href + '">' + esc(ref) + "</a>" : esc(ref)) : "") + (e.minutes ? '<span class="jmin">' + esc(e.minutes) + " 分钟</span>" : "") + "</div>" : "") +
        '<p class="jtext">' + esc(e.text) + "</p>" + del + "</div></li>";
    }).join("") + "</ul>";
  }

  /* ---------- 顶部导航（手机上是底部标签栏） ---------- */
  var ICON = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="7" r="2.2"></circle><circle cx="19" cy="17" r="2.2"></circle><path d="M7.2 7H13a3 3 0 0 1 3 3v4.8"></path><path d="M3 17h6M12 3v4"></path></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 9.5h16M9 3v4M15 3v4"></path></svg>',
    shelf: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.6-1 2.4 15.4-3.6 1z"></path></svg>',
    review: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"></path><path d="M4 4v4h4"></path></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20c-1.5-2-1.5-5 0-7s1.5-5 0-7M17 18c-1.5-2-1.5-5 0-7s1.5-5 0-7"></path></svg>'
  };
  function railHTML() {
    var r = S.route, sec = /^[lc]-/.test(r) ? "home" : r === "shelf" || r === "archive" || /^[tbr]-/.test(r) ? "shelf" : r;
    function it(id, label, extra) { return '<a href="#' + id + '"' + (sec === id ? ' aria-current="page"' : "") + ">" + ICON[id] + "<span>" + label + "</span>" + (extra || "") + "</a>"; }
    var mode = S.mode === "db" ? (S.canEdit ? ["db", "云端记录"] : ["db", "只读浏览"]) : S.mode === "local" ? ["local", "公开阅读版"] : ["", "正在连接"];
    return '<div class="tb-in"><a class="brand" href="#home" aria-label="研习录，回到线网"><span class="roundel" aria-hidden="true"><i></i></span><b>研习录</b></a>' +
      '<nav class="mainnav" aria-label="主导航">' + it("home", "线网") + it("shelf", "书架") + it("journal", "足迹") + "</nav>" +
      '<span class="mode ' + mode[0] + '"><i></i>' + mode[1] + "</span></div>";
  }

  /* ---------- 专题（独立页面，新标签页打开；按 reportGroups 分组） ---------- */
  var IN_ARTIFACT = !!(window.claude && typeof window.claude.use === "function");
  var REPORTS = LIB.reports || [];
  var RGROUPS = LIB.reportGroups || [{ id: "data", name: "数据专题", trackHead: "用数据看这个方向" }];
  function reportsIn(gid, list) { return (list || REPORTS).filter(function (rp) { return (rp.group || "data") === gid; }); }
  function reportHref(rp) { return IN_ARTIFACT && rp.artifact ? rp.artifact : rp.href; }
  /* 用途：[科目, 第几课(从 0 起), 说明] → “SQL 第 31 课 导入 Excel / CSV” */
  function useLabel(u) {
    if (!PLAN || !PLAN.lessons[u[0]]) return u[2] || "";
    var it = lessonList(u[0])[u[1]];
    return subjName(u[0]) + " 第 " + (u[1] + 1) + " 课" + (it ? "「" + it.title.split("：")[0] + "」" : "");
  }
  function reportRel(rp, withQ) {
    var out = [];
    if (withQ && rp.question) out.push('<span class="rrel"><b>问题</b>' + esc(rp.question) + "</span>");
    if (rp.origin) out.push('<span class="rrel"><b>出处</b>' + esc(rp.origin) + "</span>");
    (rp.uses || []).forEach(function (u) { out.push('<span class="rrel"><b>可用于</b>' + esc(useLabel(u)) + (u[2] ? "：" + esc(u[2]) : "") + "</span>"); });
    if (rp.refresh) out.push('<span class="rrel"><b>更新</b>' + esc(rp.refresh) + "</span>");
    return out.join("");
  }
  function reportRows(list, rel) {
    return list.map(function (rp) {
      var tr = (rp.tracks || []).map(function (x) { return TRACK[x] ? TRACK[x].short : ""; }).filter(Boolean).join("、");
      return '<a class="rrow" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><span class="rname">' + esc(rp.title) + '<span class="ext" aria-hidden="true">↗</span></span>' +
        '<span class="rdesc">' + esc(rp.desc) + '</span><span class="rmeta">' + esc(rp.date.replace("-", " 年 ") + " 月") + (tr ? " · " + esc(tr) : "") + "</span>" + (rel ? reportRel(rp, true) : "") + "</a>";
    }).join("");
  }

  /* ---------- 书架：博古架 ----------
   * 一个方向一格，书多的格子宽；三层装下五个方向。每本书是一条竖起来的线，书脊上一章一站。
   * 只勾了线 = 还没读；抽出半截、颜色染到读到的地方 = 在读；整本上色、盖“阅”字章 = 读完。 */
  var SHELF_ROWS = [[["geo", 806], ["+", 101]], [["fin", 548], ["co", 359]], [["cycle", 486], ["fut", 421]]];
  var SHELF_CLS = { geo: "D8", fin: "F830", co: "F27", cycle: "F0", fut: "F724" };
  var SHELF_COL = { geo: "--ln-geo", fin: "--ln-cfa", co: "--ln-rev", cycle: "--ln-tao", fut: "--ln-mm" };
  function hashN(s) { var x = 7; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 100003; return x; }
  function isLatin(t) { return /^[\x00-\xff]*$/.test(t); }
  /* 一本书读到哪：精读模块按章节，《大国政治的悲剧》再参考课表里地缘线学到第几课 */
  function bookState(id) {
    var s = st(id), b = LIB.books[id], r = { s: s, pct: 0, done: 0, total: 0 };
    if (b) {
      r.total = b.chapters.length;
      r.done = b.chapters.filter(function (c) { return isDone(chId(id, c.n)); }).length;
      if (id === "tragedy" && PLAN) r.done = Math.max(r.done, Math.min(r.total, Math.floor((curStudy().next.geo || 0) / 2)));
      r.pct = r.total ? r.done / r.total : 0;
      if (s === "todo" && r.done > 0) r.s = "doing";
      if (r.done === r.total && r.total && s !== "review") r.s = "done";
    } else if (s === "doing") r.pct = 0;
    if (id === "cfa-quant" || id === "cfa-econ") {
      var nx = PLAN ? curStudy().next.cfa || 0 : 0, p = id === "cfa-quant" ? Math.min(1, nx / 36) : Math.max(0, Math.min(1, (nx - 36) / 28));
      if (p > 0 && s === "todo") r.s = p >= 1 ? "done" : "doing";
      r.pct = p;
    }
    return r;
  }
  function shelfMatch(s) { var f = S.shelfF || "all"; return f === "all" || (f === "doing" ? s === "doing" : f === "done" ? s === "done" || s === "review" : s === "todo"); }
  /* 书名分成一列或两列：有副标题的按“：”分；长英文书名在中间的空格处断开；太长的中文书名对半分 */
  function titleCols(t, split) {
    if (t.indexOf("：") > 0) return t.split("：");
    if (isLatin(t) && t.length > 16) { var sp = [], i; for (i = 0; i < t.length; i++) if (t[i] === " ") sp.push(i); var k = sp.sort(function (a, b) { return Math.abs(a - t.length / 2) - Math.abs(b - t.length / 2); })[0]; return [t.slice(0, k), t.slice(k + 1)]; }
    if (split && t.length >= 8) { var m = Math.ceil(t.length / 2), r = [t.slice(0, m), t.slice(m)]; r.even = true; return r; }
    return [t];
  }
  function colEm(parts, lat) {
    return Math.max.apply(null, parts.map(function (x, i) { return x.length * (lat ? 0.6 : 1.12) * (i && !parts.even ? 0.74 : 1); }));
  }
  /* 书脊上排得下多大的字：可用高度 = 书高 − 顶部、编号牌和间距 */
  function fitSpine(it, h) {
    var lat = isLatin(it.title), avail = h - 72, parts = titleCols(it.title), size = Math.min(14, avail / colEm(parts, lat));
    if (size < 11 && parts.length === 1 && !lat) { parts = titleCols(it.title, true); size = Math.min(14, avail / colEm(parts, lat)); }
    size = Math.max(9, Math.floor(size * 2) / 2);
    var by = it.by || "", showBy = !!by && colEm(parts, lat) * size + by.length * 11.2 + 8 <= avail;
    return { parts: parts, size: size, showBy: showBy, two: parts.length > 1 };
  }
  function spineTitle(t, size, cls, parts) {
    parts = parts || titleCols(t);
    return '<span class="sp-t' + (isLatin(t) ? " lat" : "") + (cls ? " " + cls : "") + '" style="font-size:' + size + 'px">' + esc(parts[0]) + (parts[1] ? (parts.even ? "<br>" + esc(parts[1]) : '<br><small>' + esc(parts[1]) + "</small>") : "") + "</span>";
  }
  function spineH(it) { return Math.round((206 + hashN(it.id) % 56) * 0.86); }
  function spineW(it) { return 34 + (hashN(it.id + "w") % 10) * 2 + (bookState(it.id).s === "doing" ? 6 : 0); }
  function spineHTML(it, tid, idx, sc) {
    var bs = bookState(it.id), h = spineH(it), f = fitSpine(it, h), size = f.size, showBy = f.showBy;
    var w = Math.max(f.two ? 36 : 28, Math.round((34 + (hashN(it.id + "w") % 10) * 2) * (sc || 1)));
    var cls = SHELF_CLS[tid] + "<br>" + pad2(idx);
    var dim = shelfMatch(bs.s === "review" ? "done" : bs.s) ? "" : " dim", pick = (S.shelfPick === it.id ? " picked" : "") + (ebookOf(it.id) ? " has-eb" : "");
    var common = 'type="button" data-act="pick" data-id="' + esc(it.id) + '" title="《' + esc(it.title) + "》" + esc(it.by || "") + " · " + esc(STATUS_LABEL[bs.s] || "") + '"';
    if (bs.s === "done" || bs.s === "review") {
      return "<button " + common + ' class="spine done' + dim + pick + '" style="height:' + h + "px;width:" + w + 'px">' + spineTitle(it.title, Math.min(size, 13.5), "", f.parts) + '<i class="sp-seal" aria-hidden="true">' + (MARK[bs.s] || "阅") + "</i></button>";
    }
    if (bs.s === "doing") {
      var chs = LIB.books[it.id] ? LIB.books[it.id].chapters : null, dots = "";
      if (chs) dots = '<span class="sp-line" aria-hidden="true">' + chs.map(function (c, i) { return '<i class="' + (i < bs.done ? "d" : i === bs.done ? "c" : "") + '"></i>'; }).join("") + "</span>";
      return "<button " + common + ' class="spine doing' + dim + pick + '" style="height:' + h + "px;width:" + (w + 6) + "px;--p:" + Math.round(bs.pct * 100) + '%"><span class="sp-label">' + spineTitle(it.title, 12, "tight") + "</span>" + dots + '<i class="sp-rib" aria-hidden="true"></i></button>';
    }
    return "<button " + common + ' class="spine' + dim + pick + '" style="height:' + h + "px;width:" + w + 'px">' + spineTitle(it.title, size, "", f.parts) +
      (showBy ? '<span class="sp-by">' + esc(it.by) + "</span>" : '<span class="sp-by"></span>') + '<span class="sp-no">' + cls + "</span></button>";
  }
  function cfaCaseHTML(items) {
    var vols = items.map(function (it) {
      var bs = bookState(it.id), name = it.title.replace(/（.*）$/, ""), code = { "cfa-ethics": "ETH", "cfa-quant": "QM", "cfa-econ": "EC", "cfa-fsa": "FSA", "cfa-corp": "CI", "cfa-equity": "EQ", "cfa-fi": "FI", "cfa-deriv": "DER", "cfa-alt": "ALT", "cfa-pm": "PM" }[it.id] || "";
      var cls = bs.s === "done" || bs.s === "review" ? " done" : bs.s === "doing" ? " doing" : "";
      var dim = shelfMatch(bs.s === "review" ? "done" : bs.s) ? "" : " dim";
      return '<button type="button" class="vol' + cls + dim + (S.shelfPick === it.id ? " picked" : "") + (ebookOf(it.id) ? " has-eb" : "") + '" data-act="pick" data-id="' + esc(it.id) + '" style="--p:' + Math.round(bs.pct * 100) + '%" title="CFA 一级 · ' + esc(it.title) + '"><span class="sp-t" style="font-size:12px">' + esc(name) + '</span><span class="vol-c">' + code + "</span>" + (bs.s === "doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + "</button>";
    }).join("");
    var g = GOAL.cfa;
    return '<div class="case"><div class="case-h"><span>CFA 一级 · 十册函套</span>' + (g ? '<a class="case-tag" href="#g-cfa">目标线 · ' + hrs(goalMin(g)) + " / " + goalTotal(g) + " h</a>" : "") + '</div><div class="case-box"><div class="case-in">' + vols + '</div><i class="clasp" aria-hidden="true"></i><i class="clasp b" aria-hidden="true"></i></div></div>';
  }
  function compartmentHTML(tid, w) {
    var t = TRACK[tid], col = SHELF_COL[tid] || "--ln-rev";
    var all = []; t.stages.forEach(function (s) { s.items.forEach(function (it) { if (it.home === tid && all.indexOf(it) < 0) all.push(it); }); });
    var books = all.filter(function (it) { return it.kind === "book"; });
    var cfa = tid === "fin" ? t.stages[0].items.filter(function (it) { return /^cfa-/.test(it.id) && it.kind === "topic"; }) : [];
    var other = all.filter(function (it) { return it.kind !== "book" && cfa.indexOf(it) < 0; });
    var nRead = books.filter(function (it) { return bookState(it.id).s === "doing"; }).length, nDone = books.filter(function (it) { var s = bookState(it.id).s; return s === "done" || s === "review"; }).length;
    var meta = books.length + " 本" + (cfa.length ? " + 十册" : "") + (nRead ? " · 在读 " + nRead : "") + (nDone ? " · 读完 " + nDone : "");
    /* 书多的格子把书脊按比例压窄，保证放得下 */
    var nKids = books.length + (cfa.length ? 1 : 0) + (other.length ? 1 : 0) + 1;
    var fixed = (cfa.length ? cfa.length * 26 + (cfa.length - 1) * 3 + 36 + 22 + 4 : 0) + (other.length ? 68 : 0) + 19 + 4 * (nKids - 1);
    var room = w - 32 - fixed - 4, natural = books.reduce(function (a, it) { return a + spineW(it); }, 0), sc = natural ? Math.min(1, room / natural) : 1;
    for (var pass = 0; pass < 4 && sc < 1; pass++) {
      var used = books.reduce(function (a, it) { var f = fitSpine(it, spineH(it)); return a + Math.max(f.two ? 36 : 28, Math.round((spineW(it) - (bookState(it.id).s === "doing" ? 6 : 0)) * sc)) + (bookState(it.id).s === "doing" ? 6 : 0); }, 0);
      if (used <= room) break;
      sc *= 1 - (used - room) / used - 0.01;
    }
    var row = (cfa.length ? cfaCaseHTML(cfa) : "") + books.map(function (it, i) { return spineHTML(it, tid, i + 1, sc); }).join("") +
      (other.length ? '<a class="pbox" href="#t-' + tid + '" title="' + esc(other.map(function (x) { return x.title; }).join("、")) + '"><b>' + other.length + "</b><span>练习与专题</span></a>" : "") +
      '<span class="bookend" aria-hidden="true"></span>';
    return '<div class="bay" style="--c:var(' + col + ');--w:' + w + 'px"><div class="bay-row">' + row + '</div><div class="lip"><a class="plate" href="#t-' + tid + '"><b class="cls">' + SHELF_CLS[tid] + "</b><b>" + esc(t.short) + "</b><span>" + esc(meta) + "</span></a></div></div>";
  }
  /* ---------- 电子书：给书架上的书挂一个 PDF ----------
   * 只在 claude.ai 版里有：文件用 assets 能力存在这个研习录自己的存储里（只有你能看到，GitHub 公开版不带文件）。
   * 记录在 ebooks 集合：文档 id = 书的 id，内容 { asset, name, size, t }；打开地址是 "/_blob/" + asset。 */
  var EB_MAX = 20 * 1024 * 1024;
  var EB_ERR = { too_large: "文件超过 20 MB，压缩一下再传。", unsupported_type: "只能上传 PDF 文件。", quota_or_state: "研习录的存储空间满了，先移除一些不用的电子书。",
    rate_limited: "传得太频繁了，过一会儿再试。", upstream_auth: "登录状态过期了，刷新页面后再试。", capability_disabled: "这个页面现在不能上传文件。", not_granted: "这个页面现在不能上传文件。", capability_removed: "这个页面现在不能上传文件。" };
  function ebookOf(id) { return IN_ARTIFACT && S.mode === "db" && S.data.ebooks ? S.data.ebooks[id] || null : null; }
  function fmtSize(n) { return n >= 1048576 ? Math.round(n / 104857.6) / 10 + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function ebookBlock(id) {
    if (!IN_ARTIFACT) return LIB.home ? '<div class="eb eb-empty"><p><b>电子书</b>这里是 GitHub 上的公开版，不存文件。到 claude.ai 上的研习录里抽出这本书，就能上传 PDF；以后在那边点它就能打开。</p><a class="btn ghost small" href="' + esc(LIB.home) + '" target="_blank" rel="noopener">去 claude.ai 版 ↗</a></div>' : "";
    var eb = ebookOf(id), up = !!(S.assets && S.canEdit), busy = S.ebBusy === id;
    if (!eb && !up) return "";
    var input = up ? '<label class="btn ghost small eb-up' + (busy ? " busy" : "") + '"><input class="vh" type="file" accept="application/pdf,.pdf" data-eb="' + esc(id) + '"' + (busy ? " disabled" : "") + ">" + (busy ? "上传中……" : eb ? "换一个文件" : "上传 PDF") + "</label>" : "";
    if (!eb) return '<div class="eb eb-empty"><p><b>电子书</b>还没有放文件。上传一个 PDF（20 MB 以内），以后抽出这本书就能直接打开。</p>' + input + "</div>";
    var tools = "";
    if (up) tools = '<span class="eb-tools">' + input + (S.ebConfirm === id
      ? '<span class="eb-conf">文件会删掉，确定？<button type="button" class="linkbtn danger" data-act="eb-del-yes" data-id="' + esc(id) + '">移除</button><button type="button" class="linkbtn" data-act="eb-del-no">取消</button></span>'
      : '<button type="button" class="linkbtn" data-act="eb-del" data-id="' + esc(id) + '">移除</button>') + "</span>";
    return '<div class="eb"><a class="btn eb-open" href="/_blob/' + esc(eb.asset) + '" target="_blank" rel="noopener">打开电子书 ↗</a><span class="eb-meta">' + esc(eb.name || "PDF") + (eb.size ? " · " + fmtSize(eb.size) : "") + "</span>" + tools + "</div>";
  }
  function ebUpload(id, file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { toast("只能上传 PDF 文件。"); return; }
    if (file.size > EB_MAX) { toast("文件超过 20 MB，压缩一下再传。"); return; }
    if (!S.assets) { toast("这个页面现在不能上传文件。"); return; }
    var old = S.data.ebooks[id];
    S.ebBusy = id; render();
    function tryUp(again) {
      return S.assets.upload(file, { type: "application/pdf" }).catch(function (e) {
        if (!again && e && e.code === "store_unavailable") return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return tryUp(true); });
        throw e;
      });
    }
    tryUp(false).then(function (r) {
      return put("ebooks", id, { asset: r.id, name: file.name, size: r.sizeBytes || file.size, t: new Date().toISOString() }).then(function () {
        if (old && old.asset && old.asset !== r.id) S.assets.delete(old.asset).catch(function () {});
        S.ebBusy = null; render(); toast("已放上书架，点「打开电子书」就能看。");
      });
    }, function (e) { S.ebBusy = null; render(); toast(EB_ERR[e && e.code] || "上传没成功，请再试一次。"); });
  }
  function ebRemove(id) {
    var eb = S.data.ebooks[id]; S.ebConfirm = null;
    if (!eb) { render(); return; }
    del("ebooks", id).then(function () { if (S.assets && eb.asset) return S.assets.delete(eb.asset).catch(function () {}); }).then(function () { toast("电子书已移除。"); });
    render();
  }
  function pulledHTML() {
    var id = S.shelfPick, it = ITEMS[id];
    if (!it) { id = S.shelfPick = FOCUS.filter(function (b) { return bookState(b).s === "doing"; })[0] || FOCUS[0]; it = ITEMS[id]; }
    if (!it) return "";
    var b = LIB.books[id], bs = bookState(id), t = TRACK[it.home] || {}, col = SHELF_COL[it.home] || "--ln-rev";
    var lineName = id === "tragedy" ? "自选线 · 地缘" : id === "zhoulu" ? "自选线 · 随时读" : /^cfa-/.test(id) ? "目标线上的一站" : "";
    var head = '<p class="eyebrow">抽出来的书</p><div class="pb-h" style="--c:var(' + col + ')"><span class="pb-bar" aria-hidden="true"></span><div><h2 id="pulled-h">' + esc(it.title.replace(/（.*）$/, "")) + "</h2>" +
      '<p class="meta">' + esc([it.by, t.short, lineName].filter(Boolean).join(" · ")) + "</p></div></div>";
    if (!b) {
      var cnt = /^cfa-q|^cfa-e/.test(id) && bs.pct ? '<p class="meta">课表里学到 ' + Math.round(bs.pct * 100) + "%</p>" : "";
      return '<aside class="pulled" aria-labelledby="pulled-h">' + head + ebookBlock(id) + (it.why ? '<p class="pb-why">' + esc(it.why) + "</p>" : "") + cnt +
        '<div class="pb-st">' + statusCtl(id, it.title) + "</div>" + noteBlock(id, "我的批注", "读到哪、想到什么，写在这里") +
        '<div class="btns"><a class="btn ghost small" href="#t-' + it.home + '">' + esc(t.short || "") + " 方向全部内容</a></div></aside>";
    }
    var segs = b.chapters.map(function (c, i) { return '<span class="fe-s' + (i < bs.done ? " r" : "") + '"></span>'; }).join("");
    var nums = b.chapters.map(function (c, i) { return '<span class="' + (i === bs.done ? "cur" : i < bs.done ? "r" : "") + '">' + CN[c.n] + "</span>"; }).join("");
    var next = b.chapters[Math.min(bs.done, b.chapters.length - 1)];
    var mins = id === "tragedy" ? subjMin("geo") : id === "zhoulu" ? (minutesBy().tao || 0) : 0;
    var nNotes = Object.keys(S.data.notes).filter(function (k) { return k === id || k.indexOf(id + "-") === 0; }).length;
    var chs = b.chapters.map(function (c, i) {
      var k = i < bs.done ? "d" : i === bs.done ? "c" : "";
      return '<li class="' + k + '"><i aria-hidden="true"></i><button type="button" class="linkrow" data-act="open-ch" data-book="' + id + '" data-n="' + c.n + '"><span class="pb-cn">第' + CN[c.n] + "章</span>" + esc(c.title) + "</button></li>";
    }).join("");
    var lastNote = Object.keys(S.data.notes).filter(function (k) { return k.indexOf(id + "-ch") === 0 && S.data.notes[k].text; }).sort(function (a, c) { return String(S.data.notes[c].t || "").localeCompare(String(S.data.notes[a].t || "")); })[0];
    var noteFig = lastNote ? '<figure class="pb-note"><figcaption>我的批注 · ' + esc(refLabel(lastNote).replace(/^《.*》/, "")) + "</figcaption><p>" + esc(S.data.notes[lastNote].text.slice(0, 120)) + "</p></figure>" : "";
    var deepN = Object.keys(b.deep || {});
    return '<aside class="pulled" aria-labelledby="pulled-h" style="--c:var(' + col + ')">' + head + ebookBlock(id) +
      '<div class="fe"><div class="fe-top"><span>书口 · 读过的部分翻旧了</span><span>' + Math.round(bs.pct * 100) + '%</span></div><div class="fe-wrap"><div class="fe-block" aria-hidden="true">' + segs + '</div><i class="fe-rib" style="left:' + (bs.done / b.chapters.length * 100) + '%" aria-hidden="true"></i></div><div class="fe-n" aria-hidden="true">' + nums + "</div></div>" +
      '<div class="pb-stats"><div><b>' + bs.done + "<small> / " + bs.total + "</small></b><span>章读完</span></div><div><b>" + nNotes + "</b><span>条批注</span></div><div><b>" + hrs(mins) + "</b><span>小时</span></div></div>" +
      '<ol class="pb-chs">' + chs + "</ol>" + noteFig +
      '<div class="btns"><button type="button" class="btn" data-act="open-ch" data-book="' + id + '" data-n="' + next.n + '">继续：第' + CN[next.n] + "章</button>" +
      (deepN.length ? '<a class="btn ghost" href="#r-' + id + "-" + deepN[0] + '">精读稿</a>' : "") + '<a class="btn ghost" href="#b-' + id + '">整本书</a></div></aside>';
  }
  /* ---------- 书架：档案架（研究课题一盒一盒放） ----------
   * 一个课题一个档案盒，盒里按件编号；件越多盒越厚，盒顶露出每件的色签（档案、数据、计划、纪要）。
   * 在做的盒子抽出半截、挂丝带；要年更的挂小牌；结卷的盖“结”字章。没立课题的单件放收件匣。 */
  var TOPICS = LIB.topics || [], TOPIC = {};
  TOPICS.forEach(function (tp) { TOPIC[tp.id] = tp; });
  var KINDS = { "档案": "--k-doc", "数据": "--k-data", "计划": "--k-plan", "纪要": "--k-note" };
  var TP_STATUS = { doing: "在做", yearly: "要年更", closed: "已结卷" };
  var ARCH_ROWS = [[["geo", 332], ["fin", 260], ["co", 256]], [["cycle", 300], ["fut", 380], ["+", 168]]];
  function reportKind(rp) { return KINDS[rp.kind] ? rp.kind : (rp.group === "note" ? "档案" : "数据"); }
  function topicItems(tp) {
    return REPORTS.map(function (rp, i) { return { rp: rp, i: i }; }).filter(function (x) { return x.rp.topic === tp.id; })
      .sort(function (a, b) { return String(a.rp.date).localeCompare(String(b.rp.date)) || a.i - b.i; }).map(function (x) { return x.rp; });
  }
  function inboxItems() { return REPORTS.filter(function (rp) { return !rp.topic || !TOPIC[rp.topic]; }); }
  function topicNo(tp) { return (SHELF_CLS[tp.track] || "研") + " · " + pad2(tp.no || 1); }
  function topicText(tp) {
    return [tp.title, tp.question, tp.answer, tp.origin, (TRACK[tp.track] || {}).short].concat(topicItems(tp).map(function (rp) { return rp.title + " " + (rp.desc || "") + " " + (rp.question || ""); })).join(" ").toLowerCase();
  }
  function archMatch(tp) {
    var f = S.archF || "all", q = S.archQ || "";
    return (f === "all" || tp.status === f) && (!q || topicText(tp).indexOf(q) >= 0);
  }
  function vcol(t, size, cls) { return "<span" + (cls ? ' class="' + cls + '"' : "") + ' style="font-size:' + size + 'px">' + esc(t) + "</span>"; }
  function fitSz(room, n, per, max) { return Math.min(max, Math.floor(room / (Math.max(1, n) * per) * 2) / 2); }
  /* 盒脊上的题名：有“：”就分成正副两列；太长对半分成两列 */
  function boxTitle(tp) {
    var t = tp.title, room = tp.status === "closed" ? 104 : 128, i = t.indexOf("：");
    if (i > 0) { var a = t.slice(0, i), b = t.slice(i + 1); return vcol(a, fitSz(room, a.length, 1.14, 14)) + vcol(b, fitSz(room, b.length, 1.1, 11.5), "sub"); }
    if (t.length * 15 * 1.14 <= room) return vcol(t, 15);
    var m = Math.ceil(t.length / 2), sz = fitSz(room, m, 1.14, 14);
    return vcol(t.slice(0, m), sz) + vcol(t.slice(m), sz);
  }
  function boxHTML(tp) {
    var items = topicItems(tp), n = items.length, w = Math.min(150, 54 + 9 * Math.max(1, n)), col = SHELF_COL[tp.track] || "--ln-rev";
    var shown = items.slice(0, 10), step = (w - 22) / Math.max(1, shown.length);
    var slips = shown.map(function (rp, i) {
      var h = 12 + (i * 5) % 9;
      return '<i style="left:' + Math.round(11 + i * step + (step - 9) / 2) + "px;top:-" + h + "px;height:" + (h + 6) + "px;--k:var(" + KINDS[reportKind(rp)] + ')"></i>';
    }).join("");
    var on = S.archPick === tp.id;
    var cls = "abox" + (tp.status ? " " + tp.status : "") + (on ? " picked" : "") + (archMatch(tp) ? "" : " dim");
    return '<button type="button" class="' + cls + '" data-act="abox" data-t="' + esc(tp.id) + '" style="--c:var(' + col + ");width:" + w + 'px" title="' + esc(tp.title + (tp.question ? "：" + tp.question : "")) + '" aria-pressed="' + on + '">' +
      '<span class="ab-slips" aria-hidden="true">' + slips + '</span><span class="ab-band" aria-hidden="true"></span>' +
      '<span class="ab-label"><span class="ab-no">' + esc(SHELF_CLS[tp.track] || "") + "<b>" + pad2(tp.no || 1) + '</b></span><span class="ab-t">' + boxTitle(tp) + "</span>" +
      '<span class="ab-foot">' + (tp.status === "closed" ? '<i class="ab-seal" aria-hidden="true">结</i>' : "") + "<span>" + n + " 件</span></span></span>" +
      '<i class="ab-hole" aria-hidden="true"></i>' + (tp.status === "yearly" ? '<span class="ab-tag">年更</span>' : "") + (tp.status === "doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + "</button>";
  }
  function archBayHTML(tid, w) {
    var t = TRACK[tid], col = SHELF_COL[tid] || "--ln-rev";
    var tps = TOPICS.filter(function (tp) { return tp.track === tid; }).sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
    var n = tps.reduce(function (a, tp) { return a + topicItems(tp).length; }, 0);
    var row = tps.length ? tps.map(boxHTML).join("") : '<span class="bay-empty">还没有课题</span>';
    return '<div class="bay" style="--c:var(' + col + ");--w:" + w + 'px"><div class="bay-row">' + row + '<span class="bookend" aria-hidden="true"></span></div>' +
      '<div class="lip"><a class="plate" href="#t-' + tid + '"><b class="cls">' + SHELF_CLS[tid] + "</b><b>" + esc(t.short) + "</b><span>" + tps.length + " 卷 · " + n + " 件</span></a></div></div>";
  }
  function trayHTML(w) {
    var list = inboxItems(), q = S.archQ || "";
    var sheets = list.slice(-3).map(function (rp, i, arr) {
      var k = arr.length - 1 - i, text = (rp.title + " " + (rp.desc || "")).toLowerCase();
      return '<a class="asheet' + (q && text.indexOf(q) < 0 ? " dim" : "") + '" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener" data-q="' + esc(text) + '" style="--k:var(' + KINDS[reportKind(rp)] + ");bottom:" + (16 + k * 40) + "px;transform:rotate(" + (k % 2 ? -3 : 2) + 'deg)">' +
        '<i aria-hidden="true"></i><b>' + esc(rp.title) + "</b><span>" + esc(reportKind(rp)) + " · " + esc(rp.date || "") + "</span></a>";
    }).join("");
    return '<div class="bay atray" style="--w:' + w + 'px"><div class="atray-h"><b>收件匣</b><span>零散的小分析先放这里；攒到两件讲同一件事，再立卷装盒。</span></div>' +
      '<div class="atray-pile">' + (sheets || '<span class="atray-empty">空</span>') + '<i class="atray-base" aria-hidden="true"></i></div>' +
      '<div class="lip"><span class="plate"><span>' + (list.length ? list.length + " 件待归卷" : "没有待归卷的") + "</span></span></div></div>";
  }
  function archPanelHTML() {
    var tp = TOPIC[S.archPick]; if (!tp) return "";
    var items = topicItems(tp), col = SHELF_COL[tp.track] || "--ln-rev", t = TRACK[tp.track] || {};
    var meta = [t.short, tp.since ? "立卷 " + tp.since : "", TP_STATUS[tp.status], items.length + " 件"].filter(Boolean).join(" · ");
    var rows = items.map(function (rp, i) {
      var k = reportKind(rp);
      return '<tr><td class="n">' + pad2(i + 1) + '</td><td><a href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener">' + esc(rp.title) + ' <span aria-hidden="true">↗</span></a><span class="d">' + esc(rp.question && rp.question !== tp.question ? rp.question : rp.desc || "") + "</span></td>" +
        '<td class="k" style="--k:var(' + KINDS[k] + ')"><i aria-hidden="true"></i>' + k + '</td><td class="dt">' + esc(rp.date || "") + "</td></tr>";
    }).join("");
    var books = (tp.books || []).filter(function (b) { return ITEMS[b]; });
    var spines = books.map(function (b, i) {
      var it = ITEMS[b], c2 = SHELF_COL[it.home] || col;
      return '<button type="button" class="ms" data-act="pick-go" data-id="' + esc(b) + '" title="《' + esc(it.title) + "》" + esc(it.by || "") + '" aria-label="在博古架上看《' + esc(it.title) + '》" style="--c:var(' + c2 + ");height:" + (40 + (hashN(b) % 12)) + 'px"></button>';
    }).join("");
    var uses = [];
    items.forEach(function (rp) { (rp.uses || []).forEach(function (u) { uses.push(useLabel(u)); }); });
    var line = tp.line && typeof freeLine === "function" ? freeLine(tp.line) : null, grown = "";
    if (line) grown += '<span class="ln" style="--c2:var(' + line.color + ')"></span>自选线「' + esc(freeName(line)) + "」" + freeStops(line).length + " 站";
    if (uses.length) grown += (grown ? "<br>" : "") + uses.map(esc).join("<br>");
    var rel = '<div class="arel"><div><b>从哪来</b>' + esc(tp.origin || "—") + "</div>" +
      "<div><b>用到的书</b>" + (books.length ? '<span class="ms-row">' + spines + "</span>书架上 " + books.length + " 本" : "—") + "</div>" +
      "<div><b>" + (line ? "长出来的" : "用得上") + "</b>" + (grown || "—") + "</div></div>";
    return '<aside class="pulled apanel" aria-labelledby="ap-h" style="--c:var(' + col + ')"><p class="eyebrow">打开的档案盒 · 卷内目录</p>' +
      '<div class="pb-h"><span class="pb-bar" aria-hidden="true"></span><div><span class="ap-no">研 · ' + esc(topicNo(tp)) + '</span><h2 id="ap-h">' + esc(tp.title) + '</h2><p class="meta">' + esc(meta) + "</p></div></div>" +
      '<div class="ap-q"><small>课题问题</small><p class="q">' + esc(tp.question || "") + "</p>" + (tp.answer ? "<small>现在的答案（每装进一件就改一次）</small><p class=\"a\">" + esc(tp.answer) + "</p>" : "") + "</div>" +
      '<table class="aitems"><thead><tr><th scope="col">件</th><th scope="col">题名</th><th scope="col">类型</th><th scope="col" class="dt">日期</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<div><p class="meta ap-rel-h">来龙去脉</p>' + rel + "</div>" +
      (tp.note ? '<p class="ap-note"><b>备考</b>' + esc(tp.note) + "</p>" : "") + "</aside>";
  }
  function shelfSeg(cur) {
    var nBooks = allItems().filter(function (id) { return ITEMS[id].kind === "book"; }).length;
    return '<nav class="seg shelf-seg" aria-label="书架里的两件家具"><a href="#shelf"' + (cur === "shelf" ? ' aria-current="page"' : "") + ">博古架 · " + nBooks + " 本</a>" +
      '<a href="#archive"' + (cur === "archive" ? ' aria-current="page"' : "") + ">档案架 · " + TOPICS.length + " 卷 " + REPORTS.length + " 件</a></nav>";
  }
  function archiveHTML() {
    if (!TOPIC[S.archPick]) S.archPick = (TOPICS.filter(function (tp) { return tp.status === "doing"; })[0] || TOPICS[0] || {}).id;
    var f = S.archF || "all";
    function chip(k, label, n) { return '<button type="button" class="chipbtn" data-act="arch-f" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + ' <span class="segn">' + n + "</span></button>"; }
    function cnt(s) { return TOPICS.filter(function (tp) { return tp.status === s; }).length; }
    var cab = ARCH_ROWS.map(function (row) {
      var empty = row.every(function (c) { return c[0] === "+" ? !inboxItems().length : !TOPICS.some(function (tp) { return tp.track === c[0]; }); });
      return '<div class="tier' + (empty ? " empty" : "") + '">' + row.map(function (c) { return c[0] === "+" ? trayHTML(c[1]) : TRACK[c[0]] ? archBayHTML(c[0], c[1]) : ""; }).join("") + "</div>";
    }).join("");
    var legend = Object.keys(KINDS).map(function (k) { return '<span style="--k:var(' + KINDS[k] + ')"><i aria-hidden="true"></i>' + k + "</span>"; }).join("");
    var rules = [["一", "一个问题一盒", "新资料先问：它在回答哪个问题？已经有这个问题，就装进那一盒；是新问题才立新卷。卷号跟书架用同一套索书号。"],
      ["二", "盒里按件编号", "每件是档案、数据、计划、纪要四种之一，色签露在盒顶。件越多盒越厚，一眼看出这一盒是查资料多，还是做数据多。"],
      ["三", "零散的先进收件匣", "一次性的小分析不急着立卷。攒到两件讲同一件事，再一起装盒。"],
      ["四", "线网上一盒一个地标", "地图上只画课题，不画单件，地标下面写着件数。资料再多，地标也只随课题增长。"]];
    return '<div class="view shelf archive-v">' + bannerHTML() +
      '<header class="phead"><div><p class="eyebrow">五个方向 · ' + TOPICS.length + " 个课题 · " + REPORTS.length + ' 件资料</p><h1>书架<span class="h1-sub">档案架</span></h1>' +
      '<p class="lede">书放博古架；自己做的研究按课题装进档案盒，放在档案架上。一个课题一盒，盒里按件编号，资料再多也只是盒子变厚、盒子变多。</p>' + shelfSeg("archive") +
      '<div class="chips" role="group" aria-label="只看">' + chip("all", "全部", TOPICS.length) + chip("doing", "在做", cnt("doing")) + chip("yearly", "要年更", cnt("yearly")) + chip("closed", "已结卷", cnt("closed")) + "</div></div>" +
      '<div class="arch-side"><div class="k-legend"><span class="kl-h">盒顶的色签</span>' + legend + "</div>" +
      '<label class="arch-q"><span aria-hidden="true">找</span><input id="arch-q" type="search" autocomplete="off" placeholder="按问题找：周期、利率、库存" value="' + esc(S.archQ || "") + '" aria-label="在档案架里找"></label></div></header>' +
      '<div class="arch-main"><section class="cabinet archive" aria-label="档案架"><div class="cab-top"><span>研究档案</span></div><div class="cab-body">' + cab + '</div><div class="cab-feet" aria-hidden="true"><i></i><i></i></div></section>' + archPanelHTML() + "</div>" +
      '<section class="arules" aria-labelledby="ar-h"><h2 id="ar-h">怎样归档</h2><div class="ar-grid">' + rules.map(function (r) { return '<div class="arule"><p><b class="ar-n">' + r[0] + "</b><b>" + r[1] + "</b></p><p>" + r[2] + "</p></div>"; }).join("") + "</div>" +
      '<p class="meta">讨论完一个问题、查完一份资料，说一句“放进研习录”，我按这四条归档。</p></section></div>';
  }
  /* 搜索框：不重画页面，只把不相关的盒子调暗 */
  function applyArchFilter() {
    var q = S.archQ || "";
    document.querySelectorAll(".archive .abox").forEach(function (b) { var tp = TOPIC[b.getAttribute("data-t")]; if (tp) b.classList.toggle("dim", !archMatch(tp)); });
    document.querySelectorAll(".archive .asheet").forEach(function (a) { a.classList.toggle("dim", !!q && (a.getAttribute("data-q") || "").indexOf(q) < 0); });
  }
  function shelfHTML() {
    var books = allItems().filter(function (id) { return ITEMS[id].kind === "book"; });
    var cnt = { doing: 0, done: 0, todo: 0 };
    books.forEach(function (id) { var s = bookState(id).s; cnt[s === "review" ? "done" : s] = (cnt[s === "review" ? "done" : s] || 0) + 1; });
    var f = S.shelfF || "all";
    function chip(k, label, n) { return '<button type="button" class="chipbtn" data-act="shelf-f" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + ' <span class="segn">' + n + "</span></button>"; }
    var cab = SHELF_ROWS.map(function (row) {
      return '<div class="tier">' + row.map(function (c) {
        if (c[0] === "+") return '<div class="bay niche" style="--w:' + c[1] + 'px"><button type="button" class="addbook" data-act="add-book">＋加一本</button><span class="meta">说书名<br>就行</span><div class="lip"></div></div>';
        return TRACK[c[0]] ? compartmentHTML(c[0], c[1]) : "";
      }).join("") + "</div>";
    }).join("");
    return '<div class="view shelf">' + bannerHTML() +
      '<header class="phead"><div><p class="eyebrow">五个方向 · ' + books.length + ' 本书 + CFA 十册</p><h1>书架<span class="h1-sub">博古架</span></h1>' +
      '<p class="lede">一个方向一格，三层装下。每本书是一条竖起来的线，书脊上一章一站；点一本书，把它抽出来看。</p>' + shelfSeg("shelf") +
      '<div class="chips" role="group" aria-label="只看">' + chip("all", "全部", books.length) + chip("doing", "在读", cnt.doing || 0) + chip("done", "读完", cnt.done || 0) + chip("todo", "还没读", cnt.todo || 0) + "</div></div>" +
      '<div class="sp-legend" aria-hidden="true"><span><i class="lg-s"></i>只勾了线：还没读</span><span><i class="lg-s doing"></i>抽出半截、颜色染到读到的地方：在读</span><span><i class="lg-s done"></i>整本上色、盖章：读完</span></div></header>' +
      '<div class="shelf-main"><section class="cabinet" aria-label="博古架"><div class="cab-top"><span>研习书架</span></div><div class="cab-body">' + cab + '</div><div class="cab-feet" aria-hidden="true"><i></i><i></i></div></section>' + pulledHTML() + "</div></div>";
  }

  /* ---------- 方向页 ---------- */
  function trackHTML(id) {
    var t = TRACK[id], p = trackProg(t);
    var stages = t.stages.map(function (s, si) {
      var ids = s.items.map(function (x) { return x.id; }), sd = ids.filter(isDone).length;
      var lis = s.items.map(function (it) {
        var also = it.tracks.filter(function (x) { return x !== id; }).map(function (x) { return '<a href="#t-' + x + '">' + esc(TRACK[x].short) + "</a>"; });
        var links = [];
        if (it.module) links.push('<a class="go" href="#b-' + it.module + '">进入精读模块</a>');
        if (it.report) { var rp = REPORTS.filter(function (x) { return x.id === it.report; })[0]; if (rp) links.push('<a class="go" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener">打开「' + esc(rp.title) + '」↗</a>'); }
        if (also.length) links.push('<span class="also">亦属：' + also.join("、") + "</span>");
        return '<li class="item"><div class="main-col"><div><span class="kind">' + esc(LIB.kinds[it.kind] || "") + '</span><span class="t">' + (it.kind === "book" ? "《" + esc(it.title) + "》" : esc(it.title)) + "</span>" +
          (it.by ? '<span class="by">' + esc(it.by) + "</span>" : "") + "</div>" +
          '<p class="why">' + esc(it.why) + "</p>" + (links.length ? '<div class="links">' + links.join("") + "</div>" : "") + "</div>" +
          '<div class="side-col">' + statusCtl(it.id, it.title) + "</div></li>";
      }).join("");
      return '<section class="stage"><h2><span class="no">阶段' + CN[si + 1] + " · " + sd + " / " + ids.length + "</span>" + esc(s.name) + '</h2><p class="desc">' + esc(s.desc) + '</p><ul class="items">' + lis + "</ul></section>";
    }).join("");
    return '<div class="view">' + bannerHTML() + '<header><p class="eyebrow">学习方向</p><h1>' + esc(t.name) + '</h1><p class="goal"><b>目标</b>　' + esc(t.goal) + "</p>" +
      '<div class="stats"><span><b>' + p.done + "</b>/ " + p.total + ' 项已完成</span><span><b>' + p.doing + "</b>项进行中</span></div></header>" +
      (function () { var mine = REPORTS.filter(function (rp) { return (rp.tracks || []).indexOf(id) >= 0; });
        return RGROUPS.map(function (g) { var rs = reportsIn(g.id, mine);
          return rs.length ? '<section class="stage"><h2><span class="no">' + esc(g.name) + '</span>' + esc(g.trackHead || "") + '</h2><div class="reports">' + reportRows(rs) + "</div></section>" : ""; }).join(""); })() +
      stages + "</div>";
  }

  /* ---------- 精读页 ---------- */
  var TABS = [["intro", "导读"], ["chapters", "章节精读"], ["argmap", "论证地图"], ["practice", "练习"], ["debate", "争鸣与延伸"]];
  var PRACTICE = [["switch", "假设开关"], ["cards", "概念卡"], ["framework", "分析框架"]];
  function bookHTML(bid) {
    var b = LIB.books[bid], bp = bookProg(bid), tr = TRACK[b.track];
    var tabs = '<div class="tabs" role="tablist">' + TABS.map(function (x) {
      return '<button type="button" role="tab" id="tab-' + x[0] + '" aria-selected="' + (S.bookTab === x[0]) + '" data-act="tab" data-tab="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    var body = S.bookTab === "chapters" ? chaptersTab(bid) : S.bookTab === "argmap" ? argmapTab(bid) : S.bookTab === "practice" ? practiceTab(bid) : S.bookTab === "debate" ? debateTab(bid) : introTab(bid);
    return '<div class="view">' + bannerHTML() + '<header><p class="eyebrow">精读 · <a href="#t-' + tr.id + '">' + esc(tr.name) + "</a></p><h1>" + esc(b.title) + "</h1>" +
      '<p class="sub">' + esc([b.en || b.subtitle, b.author].filter(Boolean).join(" · ")) + "</p>" +
      '<div class="book-prog"><span class="meta">已读完 ' + bp.done + " / " + bp.total + " 章</span>" + stripHTML(bid) + '<div class="whole">' + statusCtl(bid, b.title) + '<span class="meta">整本书</span></div></div></header>' +
      tabs + '<div class="tabbody" role="tabpanel" aria-labelledby="tab-' + S.bookTab + '">' + body + "</div></div>";
  }
  function introTab(bid) {
    var b = LIB.books[bid];
    var deepNs = Object.keys(b.deep || {});
    return '<p class="thesis"><span class="k">主旨</span>' + esc(b.thesis) + "</p>" +
      (deepNs.length ? '<p class="deep-line"><span class="k">精读稿</span>已完成 ' + deepNs.length + " / " + b.chapters.length + " 章：" + deepNs.map(function (k) { return '<a href="#r-' + bid + "-" + k + '">第' + CN[+k] + "章</a>"; }).join("、") + "。其余章节按你的阅读进度补齐。</p>" : "") +
      (b.timeline ? timelineHTML(bid) : "") +
      '<section><h2>这本书</h2><dl class="facts">' + b.facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></section>" +
      '<section><h2>理论链条</h2><ol class="chain">' + b.chain.map(function (c) { return '<li><span class="k">' + esc(c[0]) + "</span><span>" + esc(c[1]) + "</span></li>"; }).join("") + "</ol></section>" +
      (b.nest ? nestHTML(bid) : "") +
      '<section><h2>建议的阅读顺序</h2><ol class="order">' + b.order.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ol></section>" +
      "<section>" + noteBlock(bid, "整本书的批注", "读完全书后的总体判断：同意什么，怀疑什么，它改变了你对哪件事的看法？") + "</section>";
  }
  /* 康波时间轴：上面是长周期全景，下面放大全书覆盖的年份，章号可点 */
  function timelineHTML(bid) {
    var tl = LIB.books[bid].timeline, span = tl.to - tl.from, z = tl.zoom, zs = z[1] - z[0];
    function pc(v) { return (Math.round(v * 10000) / 100) + "%"; }
    function at(y) { return pc((y - tl.from) / span); }
    function wd(a, b) { return pc((b - a) / span); }
    var ticks = [];
    for (var y = tl.from; y <= tl.to; y += 10) ticks.push('<span style="left:' + at(y) + '">' + y + "</span>");
    var phases = tl.phases.map(function (p, i) {
      return '<div class="kw-ph p' + i + '" style="left:' + at(p[1]) + ";width:" + wd(p[1], p[2]) + '"><b>' + esc(p[0]) + "</b><span>" + p[1] + "—" + p[2] + "</span></div>";
    }).join("");
    var d = new Date(), ny = d.getFullYear() + (d - new Date(d.getFullYear(), 0, 1)) / (365.25 * 864e5);
    var now = ny > tl.from && ny < tl.to ? '<div class="kw-now" style="left:' + at(ny) + '"><span>今天</span></div>' : "";
    var zl = (z[0] - tl.from) / span * 100, zr = (z[1] - tl.from) / span * 100;
    var link = '<div class="kw-link" aria-hidden="true" style="clip-path:polygon(' + zl.toFixed(2) + "% 0," + zr.toFixed(2) + '% 0,100% 100%,0 100%)"></div>';
    var zt = [];
    for (var k = z[0]; k <= z[1]; k++) zt.push('<span style="left:' + pc((k - z[0]) / zs) + '">' + String(k).slice(2) + "</span>");
    var covered = {};
    var chs = tl.chapters.map(function (c) {
      for (var yy = c[1]; yy < c[2]; yy++) covered[yy] = 1;
      var ch = LIB.books[bid].chapters.filter(function (x) { return x.n === c[0]; })[0];
      return '<button type="button" class="kw-ch ' + st(chId(bid, c[0])) + '" style="left:calc(' + pc((c[1] - z[0]) / zs) + " + 2px);width:calc(" + pc((c[2] - c[1]) / zs) + ' - 4px)" data-act="open-ch" data-book="' + bid + '" data-n="' + c[0] + '" title="第' + CN[c[0]] + "章 " + esc(ch ? ch.title : "") + '">' + CN[c[0]] + "</button>";
    }).join("");
    for (var g = z[0]; g < z[1]; g++) if (!covered[g]) chs += '<div class="kw-gap" style="left:calc(' + pc((g - z[0]) / zs) + " + 2px);width:calc(" + pc(1 / zs) + ' - 4px)" title="' + g + ' 年没有收录报告"></div>';
    return '<section class="kw-sec"><h2>' + esc(tl.title) + "</h2>" +
      '<div class="kw"><div class="kw-main">' + phases + '<div class="kw-zoomband" style="left:' + at(z[0]) + ";width:" + wd(z[0], z[1]) + '" aria-hidden="true"></div>' + now + "</div>" +
      '<div class="kw-axis">' + ticks.join("") + "</div>" + link +
      '<div class="kw-zoom" role="group" aria-label="各章覆盖的年份">' + chs + "</div>" +
      '<div class="kw-axis small">' + zt.join("") + "</div>" +
      '<p class="meta kw-cap">下方放大 ' + z[0] + "—" + (z[1] - 1) + " 年：每一格是一章，点章号打开该章导读。</p></div>" +
      '<ol class="kw-ev">' + tl.events.map(function (e) { return '<li><span class="y">' + e[0] + "</span><span>" + esc(e[1]) + "</span></li>"; }).join("") + "</ol>" +
      '<p class="meta kw-note">' + esc(tl.note) + "</p></section>";
  }
  /* 四周期嵌套：按长度比例画四条波，点每一层可以决定是否计入最下面的叠加曲线 */
  function nestHTML(bid) {
    var ns = LIB.books[bid].nest, W = 600, H = 44, N = 480;
    function path(f) {
      var d = "";
      for (var i = 0; i <= N; i++) { var x = i / N * W, y = f(i / N); d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }
      return d;
    }
    function svg(d, cls) {
      return '<svg class="nw' + (cls ? " " + cls : "") + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><line class="nz" x1="0" y1="' + H / 2 + '" x2="' + W + '" y2="' + H / 2 + '" vector-effect="non-scaling-stroke"/><path d="' + d + '" vector-effect="non-scaling-stroke"/></svg>';
    }
    var on = ns.rows.filter(function (r, i) { return !S.nestOff[i]; });
    var rows = ns.rows.map(function (r, i) {
      var inSum = !S.nestOff[i];
      var d = path(function (t) { return H / 2 + (H / 2 - 4) * Math.cos(2 * Math.PI * r.n * t); });
      return '<div class="nr' + (inSum ? "" : " off") + '"><button type="button" class="nl" data-act="nest-tog" data-i="' + i + '" aria-pressed="' + inSum + '">' +
        '<span class="nchk" aria-hidden="true"></span><span class="ntx"><b>' + esc(r.name) + "</b><span>" + esc(r.alt) + " · " + esc(r.years) + '</span><span class="nd">' + esc(r.driver) + (r.n > 1 ? " · 一个康波约含 " + r.n + " 轮" : "") + "</span></span></button>" +
        svg(d) + "</div>";
    }).join("");
    var tot = on.reduce(function (a, r) { return a + r.w; }, 0);
    var sd = path(function (t) {
      if (!tot) return H / 2;
      var s = 0; on.forEach(function (r) { s += r.w * Math.cos(2 * Math.PI * r.n * t); });
      return H / 2 + (H / 2 - 4) * s / tot;
    });
    var sumLab = on.length ? on.map(function (r) { return r.name; }).join(" + ") : "一层都没选";
    return '<section class="nest"><h2>' + esc(ns.title) + "</h2>" +
      '<p class="meta nest-hint">点左侧的名称，决定这一层要不要计入最下面的叠加曲线。</p>' +
      '<div class="nrows">' + rows +
      '<div class="nr sum"><div class="nl"><span class="ntx"><b>' + esc(ns.sum) + "</b><span>" + esc(sumLab) + '</span><span class="nd">同向处波峰波谷最深，就是共振</span></span></div>' + svg(sd, "sum") + "</div>" +
      '<div class="nscale" aria-hidden="true"><span></span><em>一个康波，约 60 年</em><span></span></div></div>' +
      '<p class="meta nest-note">' + esc(ns.note) + "</p></section>";
  }
  function chaptersTab(bid) {
    var b = LIB.books[bid], casesLab = (b.labels && b.labels.cases) || "历史案例与要点";
    return '<div class="chs">' + b.chapters.map(function (c) {
      var id = chId(bid, c.n), open = !!S.openCh[id];
      var concepts = c.concepts.length ? '<div><h4>关键概念</h4><div class="chips">' + c.concepts.map(function (k) { return '<button type="button" class="chip" data-act="goto-card" data-card="' + k + '">' + esc(CARD[k].f) + "</button>"; }).join("") + "</div></div>" : "";
      var deep = b.deep && b.deep[c.n];
      return '<details class="ch" id="d-' + id + '" data-ch="' + id + '"' + (open ? " open" : "") + "><summary>" +
        '<span class="no">第' + CN[c.n] + "章</span><span class=\"ttl\">" + esc(c.title) + '<span class="depth">' + esc(c.depth) + "</span>" + (deep ? '<span class="deep-tag">精读稿</span>' : "") + "</span>" + statusChip(id) + "</summary>" +
        '<div class="ch-body"><div class="ch-st">' + statusCtl(id, "第" + CN[c.n] + "章") +
        (deep ? '<a class="btn" href="#r-' + bid + "-" + c.n + '">进入精读稿：' + deep.sections.length + " 个论证单元</a>" : '<span class="meta">精读稿待写：读到这一章时告诉我。</span>') + "</div>" +
        (c.tip ? '<p class="tip">' + esc(c.tip) + "</p>" : "") +
        '<div><h4>本章要回答</h4><p class="q">' + esc(c.q) + "</p></div>" +
        '<div><h4>核心论点</h4><ol>' + c.points.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol></div>" +
        concepts +
        (c.cases ? '<div><h4>' + esc(casesLab) + "</h4><p>" + esc(c.cases) + "</p></div>" : "") +
        (c.reports ? '<div><h4>收录的报告（' + c.reports.length + ' 篇）</h4><ol class="reps">' + c.reports.map(function (r) {
          return '<li><span class="rt">' + esc(r[0]) + '</span><span class="ry">' + esc(r[1]) + "</span>" + (r[2] ? '<span class="rh">' + esc(r[2]) + "</span>" : "") + "</li>";
        }).join("") + "</ol></div>" : "") +
        '<div><h4>思考题</h4><ul>' + c.questions.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul></div>" +
        noteBlock(id, "我的批注", "这一章的要点用自己的话复述一遍，再写下疑问和反例。") +
        "</div></details>";
    }).join("") + "</div>";
  }
  function cardMeta(id) {
    var c = S.data.cards[id];
    if (!c || !c.box) return "新卡";
    return "第 " + c.box + " 盒 · 下次 " + (c.due || "");
  }
  function cardsTab(bid) {
    var b = LIB.books[bid], due = dueCards().filter(function (c) { return c.book === bid; }).length;
    var nPrompt = b.cards.filter(function (c) { return c.prompt; }).length;
    return '<div class="cards-head"><p>点卡片翻面，先自己说出答案再看背面。' + (nPrompt ? "精读稿里另有 " + nPrompt + " 道嵌入自测题。" : "") + "</p></div>" +
      '<div class="cards">' + b.cards.filter(function (c) { return !c.prompt; }).map(function (c) {
        var fl = !!S.flipped[c.id];
        return '<button type="button" class="card' + (fl ? " flipped" : "") + (S.hl === c.id ? " hl" : "") + '" id="card-' + c.id + '" data-act="flip" data-card="' + c.id + '" aria-pressed="' + fl + '">' +
          '<span class="front">' + esc(c.f) + "</span>" + (fl ? '<span class="back">' + esc(c.b) + "</span>" : '<span class="hint">点击查看解释</span>') +
          '<span class="meta"><span>第' + CN[c.ch] + "章</span><span>" + esc(cardMeta(c.id)) + "</span></span></button>";
      }).join("") + "</div>";
  }
  function debateTab(bid) {
    var b = LIB.books[bid];
    var further = b.further.map(function (id) { var it = ITEMS[id]; return "<li><b>《" + esc(it.title) + "》</b>" + esc(it.by) + '<span class="why">' + esc(it.why) + "</span></li>"; }).join("") +
      b.furtherExtra.map(function (x) { return "<li><b>《" + esc(x[0]) + "》</b>" + esc(x[1]) + '<span class="why">' + esc(x[2]) + "</span></li>"; }).join("");
    return (b.scorecard ? scorecardHTML(b.scorecard) : "") + '<section><h2>其他理论怎么看</h2><div class="views">' + b.debate.map(function (d) {
      return '<div class="v"><h3>' + esc(d.who) + '</h3><span class="who">' + esc(d.reps) + "</span><p>" + esc(d.text) + "</p></div>";
    }).join("") + "</div></section>" +
      '<section><h2>读的时候带着这些问题</h2><ul class="plain">' + b.challenges.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></section>" +
      '<section><h2>延伸阅读</h2><ul class="further">' + further + "</ul></section>";
  }
  /* 判断对照表：当时怎么说、后来怎样 */
  var VERDICT = { "对": "ok", "部分": "part", "偏差": "miss" };
  function scorecardHTML(sc) {
    var cnt = {}; sc.rows.forEach(function (r) { cnt[r.v] = (cnt[r.v] || 0) + 1; });
    return '<section class="score"><h2>' + esc(sc.title) + "</h2>" +
      '<div class="sc-sum">' + Object.keys(VERDICT).map(function (v) { return '<span class="vd ' + VERDICT[v] + '">' + v + " " + (cnt[v] || 0) + "</span>"; }).join("") + "</div>" +
      '<ol class="sc">' + sc.rows.map(function (r) {
        return '<li><span class="sc-when">' + esc(r.when) + '</span><div class="sc-body"><p class="sc-said"><span class="k">当时</span>' + esc(r.said) + '</p><p class="sc-then"><span class="k">后来</span>' + esc(r.then) + "</p></div>" +
          '<span class="vd ' + (VERDICT[r.v] || "") + '">' + esc(r.v) + "</span></li>";
      }).join("") + "</ol>" +
      '<p class="meta sc-note">' + esc(sc.note) + "</p></section>";
  }
  function frameworkText(bid) {
    var fw = LIB.books[bid].framework, n = 0;
    return fw.title + "\n" + fw.parts.map(function (p) { return "【" + p[0] + "】\n" + p[1].map(function (q) { n++; return n + ". " + q; }).join("\n"); }).join("\n");
  }
  function frameworkTab(bid) {
    var fw = LIB.books[bid].framework, n = 0;
    return '<div class="fw-head"><div><h2>' + esc(fw.title) + '</h2><p class="meta">' + esc(fw.note) + "</p></div>" +
      '<button type="button" class="btn ghost" data-act="copy-fw" data-book="' + bid + '">复制清单</button></div>' +
      '<div class="fw">' + fw.parts.map(function (p) {
        return '<div class="fwp"><h3>' + esc(p[0]) + "</h3><ol start=\"" + (n + 1) + '">' + p[1].map(function (q) { n++; return "<li>" + esc(q) + "</li>"; }).join("") + "</ol></div>";
      }).join("") + "</div>" +
      '<p class="meta fw-foot">' + esc(fw.foot || "用法：选一场冲突，把清单复制到和 Claude 的对话里逐条回答；分析成文后，可以作为“专题实战”的成果收进研习录。") + "</p>";
  }

  /* ---------- 练习：假设开关 / 概念卡 / 分析框架 ---------- */
  function practiceTab(bid) {
    var b = LIB.books[bid], subs = PRACTICE.filter(function (p) { return p[0] !== "switch" || b.switches; });
    if (!subs.some(function (p) { return p[0] === S.practice; })) S.practice = subs[0][0];
    var nav = '<div class="seg" role="group" aria-label="练习类型">' + subs.map(function (p) {
      return '<button type="button" data-act="practice" data-p="' + p[0] + '" aria-pressed="' + (S.practice === p[0]) + '">' + p[1] + "</button>";
    }).join("") + "</div>";
    var body = S.practice === "cards" ? cardsTab(bid) : S.practice === "framework" ? frameworkTab(bid) : switchHTML(bid);
    return '<div class="practice">' + nav + body + "</div>";
  }
  function secLink(bid, ref, label) {
    var m = /^(\d+):(s\d+)$/.exec(ref);
    if (m && LIB.books[bid].deep && LIB.books[bid].deep[+m[1]]) {
      var d = LIB.books[bid].deep[+m[1]], idx = d.sections.map(function (s) { return s.id; }).indexOf(m[2]) + 1;
      return '<button type="button" class="xref" data-act="goto-sec" data-book="' + bid + '" data-n="' + m[1] + '" data-sec="' + m[2] + '">' + (label || ("第" + CN[+m[1]] + "章 §" + idx)) + "</button>";
    }
    if (/^\d+$/.test(ref)) return '<button type="button" class="xref" data-act="open-ch" data-book="' + bid + '" data-n="' + ref + '">' + (label || ("第" + CN[+ref] + "章")) + "</button>";
    return "";
  }
  function switchHTML(bid) {
    var sw = LIB.books[bid].switches, on = S.sw, NODE = {};
    sw.nodes.forEach(function (x) { NODE[x.id] = x; });
    function ok(id) { return id in on ? on[id] : NODE[id].needs.every(ok); }
    function label(id) { if (id in on) { var a = sw.assumptions.filter(function (x) { return x.id === id; })[0]; return a.name; } return NODE[id].name; }
    var cardsA = sw.assumptions.map(function (a, i) {
      var v = on[a.id];
      return '<button type="button" class="asw' + (v ? " on" : " off") + '" data-act="sw" data-id="' + a.id + '" aria-pressed="' + v + '">' +
        '<span class="asw-top"><span class="asw-no">假设' + CN[i + 1] + '</span><span class="tog" aria-hidden="true"><i></i></span></span>' +
        '<span class="asw-name">' + esc(a.name) + '</span><span class="asw-desc">' + esc(v ? a.on : a.off) + "</span>" +
        (a.critic ? '<span class="asw-critic">挑战这一条：' + esc(a.critic) + "</span>" : "") + "</button>";
    }).join("");
    function nodeHTML(id) {
      var x = NODE[id], holds = ok(id), fails = x.needs.filter(function (k) { return !ok(k); });
      return '<div class="cn' + (holds ? " ok" : " broken") + '"><div class="cn-head"><span class="cn-name">' + esc(x.name) + '</span><span class="cn-st">' + (holds ? "成立" : "断裂") + "</span></div>" +
        '<div class="cn-needs">需要：' + x.needs.map(function (k) { return '<span class="need' + (ok(k) ? "" : " miss") + '">' + esc(label(k)) + "</span>"; }).join("") + "</div>" +
        (fails.length ? '<ul class="cn-why">' + fails.map(function (k) { return "<li>" + esc(x.why[k] || "") + "</li>"; }).join("") + "</ul>" : "") +
        (x.critic && holds ? '<p class="cn-critic">' + esc(x.critic) + "</p>" : "") +
        '<div class="cn-link">' + secLink(bid, "2:" + x.sec, "读这一单元") + "</div></div>";
    }
    var offs = sw.assumptions.filter(function (a) { return !on[a.id]; });
    var broken = sw.nodes.filter(function (x) { return !ok(x.id); }).map(function (x) { return x.name; });
    var result = !offs.length ? sw.allOn : "关掉了" + offs.map(function (a) { return "“" + a.name + "”"; }).join("、") + "，推论链断在：" + broken.join("、") + "。" + (broken.length === sw.nodes.length ? "作者描绘的世界完全不成立。" : "");
    return '<div class="sw"><p class="sw-intro">' + esc(sw.intro) + "</p>" +
      '<div class="asws">' + cardsA + "</div>" +
      '<div class="chainx" aria-live="polite"><div class="row2">' + nodeHTML("F") + nodeHTML("S") + '</div><div class="arrow" aria-hidden="true"></div>' +
      nodeHTML("P") + '<div class="arrow" aria-hidden="true"></div><div class="row2">' + nodeHTML("H") + nodeHTML("C") + "</div></div>" +
      '<div class="sw-result"><span class="k">结果</span><p>' + esc(result) + "</p>" + (offs.length ? '<button type="button" class="btn small ghost" data-act="sw-reset">全部打开</button>' : "") + "</div></div>";
  }

  /* ---------- 论证地图 ---------- */
  var MAP_TYPE = { claim: "论点", premise: "前提", evidence: "证据", objection: "反驳" };
  function countNodes(x) { return 1 + x.kids.reduce(function (a, k) { return a + countNodes(k); }, 0); }
  function argmapTab(bid) {
    var root = LIB.books[bid].argmap;
    if (!root) return '<p class="empty-line">这本书的论证地图还没有做。</p>';
    function nodeHTML(x, key, depth) {
      var has = x.kids.length, open = key in S.mapOpen ? S.mapOpen[key] : (S.mapMode === "all" || depth === 0);
      var row = '<div class="mrow">' + (has ? '<button type="button" class="mtog" data-act="map-tog" data-key="' + key + '" aria-expanded="' + open + '" aria-label="' + (open ? "收起" : "展开") + '"><i></i></button>' : '<span class="mtog leaf" aria-hidden="true"></span>') +
        '<span class="mtype">' + MAP_TYPE[x.t] + '</span><span class="mtext">' + esc(x.text) + (has && !open ? '<span class="mcount">' + (countNodes(x) - 1) + "</span>" : "") + "</span>" + (x.ref ? secLink(bid, x.ref) : "") + "</div>";
      return '<li class="mn t-' + x.t + '">' + row + (has && open ? "<ul>" + x.kids.map(function (k, i) { return nodeHTML(k, key + "." + i, depth + 1); }).join("") + "</ul>" : "") + "</li>";
    }
    var dn = Object.keys(LIB.books[bid].deep || {}).map(function (k) { return "第" + CN[+k] + "章"; });
    return '<div class="map-head"><p>全书的论证长成一棵树：根是全书的核心论点，往下是前提、推论、证据，以及批评者的反驳。' +
      (dn.length ? dn.join("、") + "的节点直接连到精读稿的对应单元，其他节点连到章节导读，精读稿写好后会接上。" : "节点连到章节导读。") + "</p>" +
      '<div class="legend">' + Object.keys(MAP_TYPE).map(function (t) { return '<span class="lg t-' + t + '"><span class="mtype">' + MAP_TYPE[t] + "</span></span>"; }).join("") + "</div>" +
      '<div class="seg" role="group" aria-label="展开程度"><button type="button" data-act="map-mode" data-m="trunk" aria-pressed="' + (S.mapMode === "trunk") + '">只看主干</button><button type="button" data-act="map-mode" data-m="all" aria-pressed="' + (S.mapMode === "all") + '">全部展开</button></div></div>' +
      '<div class="mapwrap"><ul class="mtree">' + nodeHTML(root, "r", 0) + "</ul></div>";
  }

  /* ---------- 精读稿（伸缩阅读 + 嵌入自测） ---------- */
  /* 例证来源：书中 / 作者演讲（书外，可对照） / 本页补充 */
  var ESRC = { "书": ["book", "书中"], "演讲": ["talk", "作者演讲"], "补": ["added", "补充"] };
  function secKey(bid, n, sid) { return bid + "-" + n + "-" + sid; }
  function promptHTML(c) {
    var s = S.data.cards[c.id], shown = S.prShown[c.id];
    var meta = s && s.box ? "已进入复习 · 第 " + s.box + " 盒 · 下次 " + s.due : "";
    var h = '<div class="pr" id="pr-' + c.id + '"><p class="pq"><span class="k">自测</span>' + esc(c.f) + "</p>";
    if (!shown) h += '<div class="pr-acts"><button type="button" class="btn small ghost" data-act="pr-show" data-card="' + c.id + '">想好了，看答案</button>' + (meta ? '<span class="meta">' + esc(meta) + "</span>" : "") + "</div>";
    else {
      h += '<p class="pa">' + esc(c.b) + "</p>";
      if (S.canEdit && !S.prDone[c.id]) h += '<div class="pr-acts"><button type="button" class="btn small again" data-act="pr-grade" data-g="again" data-card="' + c.id + '">没记住</button><button type="button" class="btn small good" data-act="pr-grade" data-g="good" data-card="' + c.id + '">记住了</button></div>';
      else if (meta) h += '<div class="pr-acts"><span class="meta">' + esc(meta) + "</span></div>";
    }
    return h + "</div>";
  }
  function sectionText(s) {
    return s.claim.join("") + s.steps.join("") + s.evidence.map(function (e) { return e.text; }).join("") + s.replies.map(function (r) { return r.obj + r.ans; }).join("");
  }
  function readerHTML(bid, n) {
    var b = LIB.books[bid], d = b.deep[n], ch = b.chapters.filter(function (c) { return c.n === n; })[0], cid = chId(bid, n);
    var secs = d.sections;
    var nChecks = secs.reduce(function (a, s) { return a + s.check.length; }, 0);
    var prompts = CARDS.filter(function (c) { return c.book === bid && c.ch === n && c.prompt; });
    var chars = secs.reduce(function (a, s) { return a + sectionText(s).replace(/\s/g, "").length; }, 0);
    var answered = prompts.filter(function (c) { return S.data.cards[c.id]; }).length;
    var ZOOM = [["one", "一句话"], ["gist", "提要"], ["full", "全文"]];
    var zoom = '<div class="seg zoom" role="group" aria-label="阅读详略">' + ZOOM.map(function (z) {
      return '<button type="button" data-act="zoom" data-z="' + z[0] + '" aria-pressed="' + (S.zoom === z[0]) + '">' + z[1] + "</button>";
    }).join("") + "</div>";
    var body;
    if (S.zoom === "one") {
      body = '<p class="oneline">' + esc(d.oneLine) + "</p>" +
        '<ol class="toc">' + secs.map(function (s, i) {
          return '<li><button type="button" data-act="sec-jump" data-book="' + bid + '" data-n="' + n + '" data-sec="' + s.id + '"><span class="secno">§' + (i + 1) + "</span>" + esc(s.title) + "</button></li>";
        }).join("") + "</ol>";
    } else {
      body = '<p class="oneline small"><span class="k">本章一句话</span>' + esc(d.oneLine) + "</p>" + secs.map(function (s, i) {
        var key = secKey(bid, n, s.id), open = S.zoom === "full" || !!S.secOpen[key];
        var h = '<section class="sec' + (open ? " open" : "") + '" id="sec-' + s.id + '"><div class="sec-head"><span class="secno">§' + (i + 1) + "</span><h2>" + esc(s.title) + "</h2></div>" +
          '<p class="gist">' + esc(s.gist) + "</p>";
        if (!open) return h + '<button type="button" class="more-btn" data-act="sec-toggle" data-key="' + key + '" aria-expanded="false">展开这一单元</button></section>';
        h += '<div class="sec-body">' + s.claim.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
        if (s.steps.length) h += '<div class="blk"><h4>推理</h4><ol class="reason">' + s.steps.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol></div>";
        if (s.evidence.length) h += '<div class="blk"><h4>例证</h4><ul class="evid">' + s.evidence.map(function (e) {
          var es = ESRC[e.src] || ESRC["补"];
          return '<li><span class="etag">' + esc(e.tag) + '</span><span class="esrc ' + es[0] + '">' + es[1] + "</span><span>" + esc(e.text) + "</span></li>";
        }).join("") + "</ul></div>";
        if (s.replies.length) h += '<div class="blk"><h4>反驳与回应</h4>' + s.replies.map(function (r) {
          return '<div class="qa"><p class="obj"><span class="k">有人说</span>' + esc(r.obj) + '</p><p class="ans"><span class="k">作者答</span>' + esc(r.ans) + "</p></div>";
        }).join("") + "</div>";
        if (s.practice) {
          var pr = s.practice === true ? { p: "switch", label: "去练习：用假设开关检验这五条" } : s.practice;
          h += '<p class="go-practice"><button type="button" class="xref" data-act="goto-switch" data-p="' + esc(pr.p) + '" data-book="' + bid + '">' + esc(pr.label) + "</button></p>";
        }
        if (s.check.length) h += '<div class="chk"><span class="k">待核对</span><ul>' + s.check.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
        var ps = prompts.filter(function (c) { return c.sec === s.id; });
        if (ps.length) h += '<div class="prs">' + ps.map(promptHTML).join("") + "</div>";
        h += "</div>";
        if (S.zoom !== "full") h += '<button type="button" class="more-btn" data-act="sec-toggle" data-key="' + key + '" aria-expanded="true">收起</button>';
        return h + "</section>";
      }).join("");
    }
    return '<div class="view reader">' + bannerHTML() +
      '<header><p class="eyebrow"><a href="#b-' + bid + '">《' + esc(b.title) + "》</a> · 精读稿</p><h1>第" + CN[n] + "章　" + esc(ch.title) + "</h1>" +
      '<div class="stats"><span><b>' + Math.round(chars / 100) / 10 + "</b>千字</span><span><b>" + secs.length + "</b>个论证单元</span><span><b>" + answered + "</b>/ " + prompts.length + " 道自测已作答</span><span><b>" + nChecks + "</b>处待核对</span></div>" +
      '<div class="reader-bar">' + zoom + '<div class="whole">' + statusCtl(cid, "第" + CN[n] + "章") + "</div></div>" +
      '<p class="meta reader-note">' + esc(d.note) + " 例证标“书中”的是作者在书里用的，标“补充”的是本页为帮助理解加的。</p></header>" +
      '<div class="reader-body">' + body + "</div>" +
      '<section class="reader-foot">' + noteBlock(cid, "我的批注", "这一章读完后，用自己的话写下最关键的推理，以及你最怀疑的一环。也可以记下原书中与这里不一致的地方（附页码）。") +
      '<div class="btns"><a class="btn ghost" href="#b-' + bid + '">返回《' + esc(b.title) + '》</a>' + (b.switches ? '<button type="button" class="btn ghost" data-act="goto-switch" data-book="' + bid + '">假设开关</button>' : '<button type="button" class="btn ghost" data-act="goto-switch" data-p="cards" data-book="' + bid + '">概念卡</button>') + '<button type="button" class="btn ghost" data-act="goto-map" data-book="' + bid + '">论证地图</button></div></section></div>';
  }

  /* ---------- 学习足迹 ---------- */
  function refOptions() {
    var h = '<option value="">（不关联）</option>' + (PLAN ? '<option value="plan">每日课表</option>' : "");
    Object.keys(LIB.books).forEach(function (bid) {
      var b = LIB.books[bid];
      h += '<optgroup label="精读 ·《' + esc(b.title) + '》"><option value="' + bid + '">整本书</option>' + b.chapters.map(function (c) { return '<option value="' + chId(bid, c.n) + '">第' + CN[c.n] + "章 " + esc(c.title) + "</option>"; }).join("") + "</optgroup>";
    });
    LIB.tracks.forEach(function (t) {
      var seen = {};
      h += '<optgroup label="' + esc(t.name) + '">';
      t.stages.forEach(function (s) { s.items.forEach(function (it) { if (seen[it.id] || LIB.books[it.id]) return; seen[it.id] = 1; h += '<option value="' + it.id + '">' + esc(it.kind === "book" ? "《" + it.title + "》" : it.title) + "</option>"; }); });
      h += "</optgroup>";
    });
    return h;
  }
  /* ---------- 足迹：经折集章册 ----------
   * 折起来一页一周，整本拉开是一幅长卷。一条线占一行，哪天学了就在那一格盖它的章，章上是课号。
   * 数据：打卡记录（study/progress.json 的 days：planned、done、minutes、note）和随手记（journal）。 */
  var STAMP_TOP = { film: "电影", sql: "SQL", py: "PY", cfa: "CFA", en: "EN", geo: "地缘", tao: "周期" };
  function polyPts(n, r, start) {
    var o = [];
    for (var k = 0; k < n; k++) { var a = (start + 360 * k / n) * Math.PI / 180; o.push(r1(r * Math.cos(a)) + "," + r1(-r * Math.sin(a))); }
    return o.join(" ");
  }
  function stampSVG(kind, label, x, y, rot, sc) {
    var c = "var(" + (kind === "en" ? "--ln-cfa" : LINE_COLOR[kind] || "--ln-rev") + ")", bg = "var(--stamp-bg)", fr, tc = c;
    var o = 'style="fill:' + bg + ";stroke:" + c + ';stroke-width:2.6"', i = 'style="fill:none;stroke:' + c + ';stroke-width:1"';
    if (kind === "film") fr = '<circle r="21.5" ' + o + '/><circle r="17.5" ' + i + "/>";
    else if (kind === "sql") fr = '<rect x="-20" y="-20" width="40" height="40" rx="7" ' + o + '/><rect x="-16.5" y="-16.5" width="33" height="33" rx="4" ' + i + "/>";
    else if (kind === "py") fr = '<polygon points="' + polyPts(6, 23, 90) + '" ' + o + '/><polygon points="' + polyPts(6, 19, 90) + '" ' + i + "/>";
    else if (kind === "cfa") { fr = '<rect x="-19.5" y="-19.5" width="39" height="39" rx="2" style="fill:' + c + '"/><rect x="-16" y="-16" width="32" height="32" style="fill:none;stroke:' + bg + ';stroke-width:.9"/>'; tc = bg; }
    else if (kind === "en") fr = '<rect x="-19.5" y="-19.5" width="39" height="39" rx="2" ' + o + '/><rect x="-16" y="-16" width="32" height="32" ' + i + "/>";
    else if (kind === "geo") fr = '<ellipse rx="25" ry="18.5" ' + o + '/><ellipse rx="21" ry="14.8" ' + i + "/>";
    else fr = '<polygon points="' + polyPts(8, 21, 112.5) + '" ' + o + '/><polygon points="' + polyPts(8, 17, 112.5) + '" ' + i + "/>";
    var s = String(label), big = /^\d+$/.test(s) ? (s.length <= 2 ? 18 : 14) : s.length <= 2 ? 13 : 11;
    return '<g class="stamp" transform="translate(' + r1(x) + " " + r1(y) + ") rotate(" + r1(rot) + ") scale(" + (sc || 1) + ')"><g filter="url(#inkLite)">' + fr + "</g>" +
      '<text y="-6.5" class="st-top" style="fill:' + tc + '">' + esc(STAMP_TOP[kind] || "") + '</text><text y="11.5" class="st-num" style="fill:' + tc + ";font-size:" + big + 'px">' + esc(s) + "</text></g>";
  }
  function foldLanes() {
    var lanes = GOALS.map(function (g) { return { id: g.id, name: g.name, sub: g.end, kind: "目标线", subjs: g.subjs, col: g.color, est: goalTotal(g), min: goalMin(g) }; });
    lanes.push({ id: "film", name: "英语·电影跟读", sub: PLAN.subjects.film ? "《" + PLAN.subjects.film.film + "》" : "", kind: "自选线", subjs: ["film"], col: "--ln-en", est: subjEstMin("film") / 60, min: subjMin("film") });
    lanes.push({ id: "geo", name: LIB.books.tragedy ? LIB.books.tragedy.title : subjName("geo"), sub: "精读", kind: "自选线", subjs: ["geo"], col: "--ln-geo", est: subjEstMin("geo") / 60, min: subjMin("geo") });
    if (journalEntries().some(function (e) { return String(e.ref || "").indexOf("zhoulu") === 0; })) lanes.push({ id: "tao", name: "涛动周期录", sub: "随时读", kind: "自选线", subjs: ["tao"], col: "--ln-tao", est: 0, min: minutesBy().tao || 0 });
    return lanes;
  }
  function jByDate() {
    var o = {}; journalEntries().forEach(function (e) { (o[e.date] = o[e.date] || []).push(e); }); return o;
  }
  /* 某一天：盖了哪些章、学了多少分钟、打卡状态 */
  function dayInfo(d, JD) {
    var rec = curStudy().days[d], out = { d: d, rec: rec, stamps: [], min: 0, status: "" };
    if (rec && rec.planned) {
      var done = rec.done || [];
      rec.planned.forEach(function (s) {
        if (done.indexOf(s.subj) < 0 || s.subj === "prep") return;
        out.stamps.push({ subj: s.subj, label: s.review ? "回看" : s.subj === "en" ? "术语" : s.index != null ? s.index + 1 : "学" });
      });
      if (checkedIn(rec)) out.min += Number(rec.minutes) || rec.planned.filter(function (s) { return done.indexOf(s.subj) >= 0; }).reduce(function (a, s) { return a + (s.mins || 0); }, 0);
      out.status = rec.status || "";
    }
    (JD[d] || []).forEach(function (e) {
      out.min += Number(e.minutes) || 0;
      var m = /^zhoulu(?:-ch(\d+))?/.exec(String(e.ref || ""));
      if (m) out.stamps.push({ subj: "tao", label: m[1] || "读" });
    });
    return out;
  }
  function milestones(JD) {
    var t = bjToday(), out = {}, cum = 0, streak = 0, first = true, hrsMarks = [10, 25, 50, 100, 200, 300, 500, 750, 1000], hi = 0, stMarks = [7, 14, 21, 30, 50, 100];
    var start = addDaysBJ(PLAN.start, -1);
    for (var d = start; d <= t; d = addDaysBJ(d, 1)) {
      var di = dayInfo(d, JD), studied = di.stamps.length > 0 || di.min > 0;
      if (studied && first) { out[d] = { t: "开通", ring: "第一次盖章", col: "--seal" }; first = false; }
      streak = studied ? streak + 1 : d === t ? streak : 0;
      if (studied && stMarks.indexOf(streak) >= 0) out[d] = { t: streak + "天", ring: "连续打卡", col: "--seal" };
      cum += di.min;
      while (hi < hrsMarks.length && cum / 60 >= hrsMarks[hi]) { out[d] = { t: hrsMarks[hi] + "时", ring: "累计学习", col: "--seal" }; hi++; }
    }
    var ck = curStudy().checks || {};
    Object.keys(ck).forEach(function (k) {
      var m = /^([a-z]+)-(\d+)$/.exec(k), g = m && GOAL[m[1]];
      if (g && g.stations[+m[2]]) out[ck[k]] = { t: "过站", ring: g.stations[+m[2]].name, col: g.color };
    });
    return out;
  }
  function foldSVG(lanes, ws, JD, MS) {
    var W = 1344, HDR = 176, PAST0 = 182, P0 = 226, NP = 3, PW = 354, COLW = 47, PADL = (PW - 7 * COLW) / 2, FUT0 = P0 + NP * PW + 6;
    var RH = 76, Y_TOP = 34, Y_DAY = 66, Y_ROW = 112, Y_SEAL = Y_ROW + lanes.length * RH + 4, SEALH = 86, Y_BAR = Y_SEAL + SEALH + 4, BARH = 66, Y_FOOT = Y_BAR + BARH + 6, Y_BOT = Y_FOOT + 30, H = Y_BOT + 12;
    var t = bjToday(), weeks = PLAN.weeks || 12, NW = "一二三四五六七八九十";
    function wname(k) { k += 1; return k <= 10 ? NW[k - 1] : k < 20 ? "十" + NW[k - 11] : String(k); }
    var o = ['<svg class="fold" viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="经折集章册：第' + wname(ws) + "到第" + wname(ws + NP - 1) + '周">'];
    o.push('<defs><filter id="inkLite" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="t"/><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="t" in2="w" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="wash" x="-20%" y="-5%" width="140%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<linearGradient id="foldA" x1="0" x2="1"><stop offset="0" stop-color="#5A4520" stop-opacity="0"/><stop offset=".75" stop-color="#5A4520" stop-opacity=".02"/><stop offset="1" stop-color="#5A4520" stop-opacity=".16"/></linearGradient>' +
      '<linearGradient id="foldB" x1="0" x2="1"><stop offset="0" stop-color="#5A4520" stop-opacity=".16"/><stop offset=".25" stop-color="#5A4520" stop-opacity=".02"/><stop offset="1" stop-color="#5A4520" stop-opacity="0"/></linearGradient></defs>');
    lanes.forEach(function (ln, i) {
      var yc = Y_ROW + i * RH + RH / 2, goal = ln.kind === "目标线", hv = hrs(ln.min);
      o.push(tx(0, yc - 16, ln.name, "fd-ln") + tx(0, yc + 1, ln.sub, "fd-sub"));
      o.push('<rect x="0" y="' + (yc + 8) + '" width="44" height="17" rx="8.5" style="' + (goal ? "fill:var(" + ln.col + ");stroke:var(" + ln.col + ")" : "fill:none;stroke:var(" + ln.col + ")") + '"/><text x="22" y="' + (yc + 20.5) + '" text-anchor="middle" class="fd-k" style="fill:' + (goal ? "var(--bdg-on)" : "var(" + ln.col + ")") + '">' + ln.kind + "</text>");
      o.push(tx(52, yc + 21, hv + (ln.est ? "/" + Math.round(ln.est) : "") + " h", "fd-h"));
      if (ln.est) o.push('<rect x="0" y="' + (yc + 30) + '" width="160" height="4" rx="2" class="fd-trk"/><rect x="0" y="' + (yc + 30) + '" width="' + Math.max(2, Math.min(160, 160 * hv / ln.est)) + '" height="4" rx="2" style="fill:var(' + ln.col + ')"/>');
    });
    o.push(tx(0, Y_SEAL + 38, "纪念章", "fd-ln") + tx(0, Y_SEAL + 56, "开通、累计、连续打卡", "fd-sub"));
    o.push(tx(0, Y_BAR + 34, "每天学了多久", "fd-ln") + tx(0, Y_BAR + 52, "墨条越高学得越久", "fd-sub"));
    o.push('<rect x="' + (PAST0 - 8) + '" y="' + (Y_TOP - 8) + '" width="' + (FUT0 + 52 - PAST0 + 8) + '" height="' + (Y_BOT - Y_TOP + 16) + '" rx="6" class="fd-cover"/>');
    var leftTxt = ws > 0 ? "第一" + (ws > 1 ? "至" + wname(ws - 1) : "") + "周已合上" : "从" + (+PLAN.start.slice(5, 7)) + "月" + (+PLAN.start.slice(8, 10)) + "日开始";
    var rightTxt = ws + NP < weeks ? "第" + wname(ws + NP) + "周起还没翻开" : "第一阶段到这里";
    [[PAST0, 38, leftTxt, ws > 0 ? -1 : 0], [FUT0, 44, rightTxt, ws + NP < weeks ? 1 : 0]].forEach(function (sk) {
      var g = '<g class="fd-stack' + (sk[3] ? " act" : "") + '"' + (sk[3] ? ' data-act="fold-nav" data-d="' + sk[3] + '" role="button" tabindex="0" aria-label="' + (sk[3] < 0 ? "往前翻一周" : "往后翻一周") + '"' : "") + ">";
      for (var k = 0; k < 7; k++) g += '<rect x="' + (sk[0] + k * 5) + '" y="' + (Y_TOP + 2) + '" width="' + (sk[1] - k * 5) + '" height="' + (Y_BOT - Y_TOP - 4) + '" class="fd-pg' + (k % 2 ? " b" : "") + '"/>';
      sk[2].split("").forEach(function (ch, i) { g += tx(sk[0] + (sk[1] === 38 ? 20 : 26), Y_TOP + 60 + i * 16, ch, "fd-st", "middle"); });
      o.push(g + "</g>");
    });
    var late = [];
    for (var w = 0; w < NP; w++) {
      var x0 = P0 + w * PW, wk = ws + w, d0 = addDaysBJ(PLAN.start, wk * 7), d6 = addDaysBJ(d0, 6);
      o.push('<rect x="' + x0 + '" y="' + Y_TOP + '" width="' + PW + '" height="' + (Y_BOT - Y_TOP) + '" class="fd-paper"/><rect x="' + x0 + '" y="' + Y_TOP + '" width="' + PW + '" height="' + (Y_BOT - Y_TOP) + '" fill="url(#' + (w % 2 ? "foldB" : "foldA") + ')"/>');
      if (w) o.push('<line x1="' + x0 + '" y1="' + Y_TOP + '" x2="' + x0 + '" y2="' + Y_BOT + '" class="fd-crease"/>');
      var curW = t >= d0 && t <= d6;
      o.push(tx(x0 + PADL, Y_TOP + 22, "第" + wname(wk) + "周", "fd-wk" + (curW ? " cur" : "")) + tx(x0 + PW - PADL, Y_TOP + 22, (+d0.slice(5, 7)) + "/" + (+d0.slice(8, 10)) + "—" + (+d6.slice(5, 7)) + "/" + (+d6.slice(8, 10)), "fd-rng", "end"));
      o.push('<line x1="' + (x0 + PADL) + '" y1="' + (Y_TOP + 31) + '" x2="' + (x0 + PW - PADL) + '" y2="' + (Y_TOP + 31) + '" class="fd-rule"/><line x1="' + (x0 + PADL) + '" y1="' + (Y_TOP + 34) + '" x2="' + (x0 + PW - PADL) + '" y2="' + (Y_TOP + 34) + '" class="fd-rule"/>');
      lanes.forEach(function (ln, i) {
        var yc = Y_ROW + i * RH + RH / 2;
        o.push('<line x1="' + x0 + '" y1="' + yc + '" x2="' + (x0 + PW) + '" y2="' + yc + '" class="fd-thread' + (ln.kind === "目标线" ? " goal" : "") + '" style="stroke:var(' + ln.col + ')"/>');
        if (i) o.push('<line x1="' + (x0 + PADL) + '" y1="' + (Y_ROW + i * RH) + '" x2="' + (x0 + PW - PADL) + '" y2="' + (Y_ROW + i * RH) + '" class="fd-row"/>');
      });
      o.push('<line x1="' + (x0 + PADL) + '" y1="' + Y_SEAL + '" x2="' + (x0 + PW - PADL) + '" y2="' + Y_SEAL + '" class="fd-rule dash"/><line x1="' + (x0 + PADL) + '" y1="' + (Y_BAR + BARH) + '" x2="' + (x0 + PW - PADL) + '" y2="' + (Y_BAR + BARH) + '" class="fd-base"/>');
      var wkMin = 0;
      for (var c = 0; c < 7; c++) {
        var d = addDaysBJ(d0, c), cx = x0 + PADL + c * COLW + COLW / 2, fut = d > t, isT = d === t, di = dayInfo(d, JD), sel = S.foldDay === d;
        o.push('<g class="fd-day' + (sel ? " sel" : "") + '" data-act="fold-day" data-d="' + d + '" role="button" tabindex="' + (fut ? -1 : 0) + '" aria-label="' + cnDate(d) + (di.stamps.length ? "，盖了 " + di.stamps.length + " 枚章" : "") + '"><rect x="' + (cx - COLW / 2 + 1) + '" y="' + (Y_DAY - 2) + '" width="' + (COLW - 2) + '" height="' + (Y_BAR + BARH - Y_DAY + 4) + '" rx="4" class="fd-hit"/></g>');
        o.push(tx(cx, Y_DAY + 14, "一二三四五六日"[c], "fd-wd" + (c >= 5 ? " we" : "")) + tx(cx, Y_DAY + 33, String(+d.slice(8, 10)), "fd-dn" + (isT ? " today" : fut ? " fut" : "")));
        if (+d.slice(8, 10) === 1) o.push(tx(cx, Y_TOP - 10, (+d.slice(5, 7)) + " 月", "fd-mo", "middle") + '<line x1="' + cx + '" y1="' + (Y_TOP - 6) + '" x2="' + cx + '" y2="' + Y_TOP + '" class="fd-base"/>');
        if (isT) o.push('<rect x="' + (cx - COLW / 2 + 1) + '" y="' + (Y_DAY - 2) + '" width="' + (COLW - 2) + '" height="' + (Y_BAR + BARH - Y_DAY + 4) + '" rx="4" class="fd-today"/>' + tx(cx, Y_BAR + BARH + 20, "今日", "fd-tl", "middle"));
        if (fut) continue;
        if (di.rec && (di.rec.done || []).indexOf("rev") >= 0) o.push('<g transform="translate(' + (cx + 15) + " " + (Y_DAY + 28.5) + ')" class="fd-chk"><circle r="7"/><text y="3.5" text-anchor="middle">检</text></g>');
        lanes.forEach(function (ln, i) {
          var ss = di.stamps.filter(function (s) { return ln.subjs.indexOf(s.subj) >= 0; });
          ss.forEach(function (s, j) {
            var off = ss.length > 1 ? (j - (ss.length - 1) / 2) * 18 : 0;
            o.push(stampSVG(s.subj, s.label, cx + off, Y_ROW + i * RH + RH / 2, (hashN(d + s.subj) % 11) - 5, ss.length > 1 ? 0.72 : 0.98));
          });
        });
        wkMin += di.min;
        if (di.min) { var bh = Math.min(BARH - 8, di.min / 220 * (BARH - 8)); o.push('<rect x="' + (cx - 9) + '" y="' + r1(Y_BAR + BARH - bh) + '" width="18" height="' + r1(bh) + '" rx="2" class="fd-bar"/>' + tx(cx, Y_BAR + BARH - bh - 5, String(Math.round(di.min)), "fd-bn", "middle")); }
        else if (!isT && di.rec && di.rec.planned && d !== PLAN.prep) o.push(tx(cx, Y_BAR + BARH - 8, di.status === "missed" ? "没学" : checkedIn(di.rec) ? "" : "未打卡", "fd-miss", "middle"));
        if (MS[d]) {
          var ms = MS[d], sx = cx + (c === 0 ? 16 : c === 6 ? -16 : 0);
          late.push('<g class="fd-seal" transform="translate(' + sx + " " + (Y_SEAL + SEALH / 2 + 2) + ") rotate(" + ((hashN(d) % 14) - 8) + ')" style="--sc:var(' + ms.col + ')"><g filter="url(#inkLite)"><circle r="34" class="o"/><circle r="29" class="i"/></g>' +
            tx(0, -9, ms.ring, "s1", "middle") + tx(0, 11, ms.t, "s2", "middle") + tx(0, 23, (+d.slice(5, 7)) + "·" + (+d.slice(8, 10)), "s3", "middle") + "</g>");
        }
      }
      o.push(tx(x0 + PADL, Y_FOOT + 16, "本周 " + hrs(wkMin) + " 小时", "fd-wt"));
    }
    o.push(late.join(""), "</svg>");
    return o.join("");
  }
  function foldMiniHTML(ws, JD) {
    var weeks = PLAN.weeks || 12, t = bjToday(), W = 1344, HDR = 176, cw = (W - HDR) / weeks;
    var o = ['<svg class="fold-mini" viewBox="0 0 ' + W + ' 66" role="group" aria-label="全卷缩略：' + weeks + ' 周">' + tx(0, 26, "全卷", "fd-ln") + tx(0, 44, PLAN.phase + " · " + weeks + " 周", "fd-sub")];
    for (var w = 0; w < weeks; w++) {
      var x0 = HDR + w * cw, inWin = w >= ws && w < ws + 3;
      o.push('<g class="fm-w" data-act="fold-go" data-w="' + w + '" role="button" tabindex="0" aria-label="翻到第 ' + (w + 1) + ' 周"><rect x="' + r1(x0 + 2) + '" y="10" width="' + r1(cw - 4) + '" height="38" rx="3" class="fm-pg"/>');
      for (var c = 0; c < 7; c++) {
        var d = addDaysBJ(PLAN.start, w * 7 + c); if (d > t) continue;
        var mn = dayInfo(d, JD).min; if (!mn) continue;
        var bh = Math.min(28, mn / 220 * 28);
        o.push('<rect x="' + r1(x0 + 8 + c * (cw - 16) / 7) + '" y="' + r1(44 - bh) + '" width="' + r1((cw - 16) / 7 - 3) + '" height="' + r1(bh) + '" class="fd-bar"/>');
      }
      o.push(tx(x0 + cw / 2, 64, String(w + 1), "fm-n" + (t >= addDaysBJ(PLAN.start, w * 7) && t <= addDaysBJ(PLAN.start, w * 7 + 6) ? " cur" : ""), "middle") + "</g>");
    }
    o.push('<rect x="' + r1(HDR + ws * cw) + '" y="4" width="' + r1(3 * cw) + '" height="50" rx="5" class="fm-win"/></svg>');
    return o.join("");
  }
  function foldDayHTML(d, JD) {
    var di = dayInfo(d, JD), rec = di.rec, je = JD[d] || [];
    var head = '<div class="fdc-h"><h2 id="fdc-h">' + cnDate(d) + " · " + WD[wdOf(d)] + '</h2><span class="meta">' + (d === PLAN.prep ? "准备日" : rec ? (DAY_STATUS[rec.status] || "") : "") + (di.min ? " · " + Math.round(di.min) + " 分钟" : "") + "</span></div>";
    var big = di.stamps.map(function (s) { return '<svg viewBox="-30 -30 60 60" width="64" height="64" aria-hidden="true">' + stampSVG(s.subj, s.label, 0, 0, 0, 1.1) + "</svg>"; }).join("");
    var rows = rec && rec.planned ? rec.planned.map(function (s) {
      var ok = (rec.done || []).indexOf(s.subj) >= 0, g = GOAL[GOAL_OF[s.subj]];
      return '<li class="' + (ok ? "ok" : checkedIn(rec) ? "no" : "") + '"><i style="--c:var(' + (LINE_COLOR[s.subj] || "--ln-rev") + ')" aria-hidden="true"></i><a href="' + slotHref(s) + '"><b>' + esc(subjName(s.subj)) + (s.index != null && s.subj !== "film" ? " · 第 " + (s.index + 1) + " 课" : "") + "</b>" + (g ? '<span class="meta">' + esc(g.name) + "</span>" : "") + "<span>" + esc(s.title || "") + "</span></a><span class=\"fdc-m\">" + (ok ? s.mins + "′" : checkedIn(rec) ? "没学" : s.mins + "′") + "</span></li>";
    }).join("") : "";
    var notes = (rec && rec.note ? '<blockquote class="fdc-note">“' + esc(rec.note) + '”<span>晚上打卡时写的一句</span></blockquote>' : "") +
      je.map(function (e) { return '<blockquote class="fdc-note j">' + esc(e.text) + "<span>随手记" + (e.minutes ? " · " + esc(e.minutes) + " 分钟" : "") + (e.ref ? " · " + esc(refLabel(e.ref)) : "") + "</span></blockquote>"; }).join("");
    var empty = !rows && !notes ? '<p class="empty-line">这一天没有记录。</p>' : rec && !checkedIn(rec) && d < bjToday() ? '<p class="meta">这天还没打卡：学了的话，晚上打卡时一起说，章就补上。</p>' : "";
    return '<section class="fdc" aria-labelledby="fdc-h">' + head + (big ? '<div class="fdc-st">' + big + "</div>" : "") + (rows ? '<ul class="fdc-l">' + rows + "</ul>" : "") + notes + empty +
      (rec && rec.file ? '<div class="btns"><a class="btn ghost small" href="' + esc(lessonHref(rec.file)) + '">当天路线单</a></div>' : "") + "</section>";
  }
  function foldWS() {
    var weeks = PLAN.weeks || 12, cw = Math.max(0, Math.min(weeks - 1, Math.floor(dayDiff(PLAN.start, bjToday()) / 7)));
    var ws = S.foldStart != null ? S.foldStart : Math.max(0, cw - 2);
    return Math.max(0, Math.min(weeks - 3, ws));
  }
  function journalHTML() {
    if (!PLAN) return '<div class="view"><h1>足迹</h1></div>';
    var JD = jByDate(), lanes = foldLanes(), t = bjToday(), weeks = PLAN.weeks || 12;
    var cw = Math.max(0, Math.min(weeks - 1, Math.floor(dayDiff(PLAN.start, t) / 7))), ws = foldWS();
    if (!S.foldDay) S.foldDay = curStudy().days[t] ? t : Object.keys(curStudy().days).filter(function (d) { return d <= t; }).sort().pop() || t;
    var MS = milestones(JD), days = 0, stamps = 0, mins = 0;
    for (var d = addDaysBJ(PLAN.start, -1); d <= t; d = addDaysBJ(d, 1)) { var di = dayInfo(d, JD); if (di.stamps.length || di.min) days++; stamps += di.stamps.length; mins += di.min; }
    var js = journalEntries();
    var stats = [[days, "天有章", "从 " + cnDate(PLAN.start) + " 起"], [stamps, "枚站章", "一行一条线"], [hrs(mins), "小时", "累计"], [curStudy().streak || 0, "天连续", "打卡"]];
    var legend = ["sql", "py", "cfa", "film", "geo"].map(function (k) { return '<span><svg viewBox="-26 -26 52 52" width="38" height="38" aria-hidden="true">' + stampSVG(k, k === "film" ? 22 : 9, 0, 0, 0, 0.9) + "</svg>" + { sql: "SQL 课", py: "Python 课", cfa: "CFA 课", film: "电影段落", geo: "精读章节" }[k] + "</span>"; }).join("");
    var form = S.canEdit ? '<form class="jform" id="j-form" autocomplete="off"><h3>记一笔</h3><div class="row">' +
      '<label class="field"><span>日期</span><input type="date" id="j-date" value="' + today() + '"></label>' +
      '<label class="field"><span>用时（分钟）</span><input type="number" id="j-min" min="0" step="5" inputmode="numeric" placeholder="例如 45"></label>' +
      '<label class="field ref"><span>关联内容</span><select id="j-ref">' + refOptions() + "</select></label></div>" +
      '<label class="field"><span>这次学了什么、想明白了什么</span><textarea id="j-text" rows="3" placeholder="例如：读完第二章。五个假设里，我最怀疑“理性行为体”这一条，因为……"></textarea></label>' +
      '<div><button class="btn" type="submit">保存</button></div></form>' : "";
    return '<div class="view fold-v">' + bannerHTML() +
      '<header class="phead"><div><p class="eyebrow">' + esc(PLAN.phase) + '</p><h1>足迹<span class="h1-sub">经折集章册</span></h1>' +
      '<p class="lede">折起来一页一周，整本拉开是一幅长卷。一条线占一行，哪天学了就在那一格盖它的章，章上是课号。晚上打卡后自动盖章。</p></div>' +
      '<div class="pstats">' + stats.map(function (s) { return "<div><b>" + s[0] + "<span>" + s[1] + "</span></b><small>" + esc(s[2]) + "</small></div>"; }).join("") + "</div></header>" +
      '<div class="fd-bar-top"><div class="fd-legend" aria-hidden="true">' + legend + '<span class="meta">章上的数字是课号</span></div><div class="fd-nav">' +
      '<button type="button" class="chipbtn" data-act="fold-nav" data-d="-1"' + (ws <= 0 ? " disabled" : "") + ">‹ 往前翻</button>" +
      (ws !== Math.max(0, Math.min(weeks - 3, cw - 2)) ? '<button type="button" class="chipbtn" data-act="fold-go" data-w="' + cw + '">回到本周</button>' : "") +
      '<button type="button" class="chipbtn" data-act="fold-nav" data-d="1"' + (ws >= weeks - 3 ? " disabled" : "") + ">往后翻 ›</button></div></div>" +
      '<section class="fold-w" aria-label="经折集章册"><div class="fold-scroll">' + foldSVG(lanes, ws, JD, MS) + "</div></section>" +
      '<section class="fold-mini-w" aria-label="全卷缩略"><div class="fold-scroll">' + foldMiniHTML(ws, JD) + "</div></section>" +
      '<div class="fd-grid">' + foldDayHTML(S.foldDay, JD) +
      '<section class="panel" aria-labelledby="jr-h"><h2 id="jr-h">随手记</h2><p class="meta">课表之外读的书、查的资料、想明白的事，在这里记一笔；关联到《涛动周期录》的会盖在它那一行。</p>' + form +
      journalList(js.slice(0, 8), true) + "</section></div></div>";
  }

  /* ---------- 每日课表 ---------- */
  /* 课表进度：云端版优先读 study/progress 文档（每天早晚由定时任务写入），读不到就用构建时的快照 */
  function curStudy() {
    var d = S.data.study && S.data.study.progress;
    if (d && d.days && d.next && String(d.updated || "") >= String(STUDY_SNAP.updated || "")) return d;
    return STUDY_SNAP;
  }
  var WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  var DAY_STATUS = { done: "完成", partial: "部分完成", missed: "没学", pushed: "待打卡" };
  function bjToday() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
  function utcDay(s) { var p = s.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function dayDiff(a, b) { return Math.round((utcDay(b) - utcDay(a)) / 86400000); }
  function lessonList(subj) {
    var raw = PLAN.lessons[subj] || [];
    if (subj !== "cfa") return raw.map(function (t) { return { title: t }; });
    var out = [];
    raw.forEach(function (m) { for (var k = 1; k <= m[3]; k++) out.push({ title: m[0] + " " + m[1] + "（" + k + "/" + m[3] + "）", en: m[2], code: m[0] }); });
    return out;
  }
  function weekNo(date) { var d = dayDiff(PLAN.start, date); return d >= 0 ? Math.floor(d / 7) + 1 : 0; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function lessonKey(subj, i) { return subj + "-" + pad2(i + 1); }
  function isWritten(subj) { return (PLAN.written || []).indexOf(subj) >= 0; }
  function sinceOk(subj, date) { var s = (PLAN.since || {})[subj]; return !s || date >= s; }
  /* 某科已经写好讲义的课数：早上定时任务记在 progress.issued，构建时嵌进来的讲义也算 */
  function issuedN(subj) {
    var n = ((curStudy().issued || {})[subj]) || 0;
    while (LESSON_SNAP[lessonKey(subj, n)]) n++;
    return n;
  }
  function dayPlan(date) {
    var STUDY = curStudy();
    var wd = new Date(utcDay(date)).getUTCDay(), res = { date: date, wd: wd, slots: [] };
    if (date === PLAN.prep) { res.prep = true; return res; }
    if (dayDiff(PLAN.start, date) < 0) { res.before = true; return res; }
    var cfa = null;
    PLAN.week[wd].forEach(function (x) {
      if (!sinceOk(x[0], date)) return;
      var s = { subj: x[0], mins: x[1] }, list = lessonList(x[0]), i = STUDY.next[x[0]] || 0;
      if (x[2] === "review") {
        s.review = true;
        s.title = i > 0 ? "本周复习：第 " + (Math.max(0, i - 6) + 1) + "—" + i + " 段连起来过一遍" : "本周复习：还没有学过的段落，今天可以先看一遍全片";
      } else if (x[0] !== "en") {
        s.index = i; s.total = list.length;
        s.title = i < list.length ? list[i].title : "这一科本阶段已学完";
        if (i < list.length && isWritten(x[0])) s.lesson = lessonKey(x[0], i);
        if (x[0] === "cfa") cfa = list[i];
      }
      res.slots.push(s);
    });
    res.slots.forEach(function (s) { if (s.subj === "en") s.title = wd === 0 ? "本周 CFA 词汇小测 + 1、3、7 天前的词复习" : "CFA 术语与短文" + (cfa ? "：" + cfa.en : ""); });
    return res;
  }
  /* 讲义链接：study/daily/<日期>.md → #l-<日期>；study/lessons/sql/01.md → #l-sql-01 */
  function lessonHref(file) {
    var m = /(\d{4}-\d{2}-\d{2})\.md$/.exec(file || "");
    if (m) return "#l-" + m[1];
    m = /lessons\/([a-z]+)\/(\d+)\.md$/.exec(file || "");
    if (m) return "#l-" + m[1] + "-" + m[2];
    return PLAN.repo + file;
  }
  /* 一个时段点进去去哪：有讲义的去讲义，电影去跟读播放器，英语（旧）去 CFA 课末尾的术语 */
  function slotHref(s) {
    if (s.subj === "film") return "#c-film";
    if (s.lesson) return "#l-" + s.lesson;
    if (s.subj === "en") { var c = (curStudy().next.cfa || 0); return "#l-" + lessonKey("cfa", c); }
    if (PLAN.lessons[s.subj] && typeof s.index === "number" && isWritten(s.subj)) return "#l-" + lessonKey(s.subj, s.index);
    return "#c-" + s.subj;
  }

  /* ---------- 讲义阅读 ---------- */
  /* 讲义正文：云端版按需读 lessons/<键> 文档（早上定时任务写入），读不到就用构建时嵌入的快照。
   * 键是日期（每日路线单）或 科目-序号（按课的讲义，如 sql-01） */
  var LESSON = {};   // 键 -> { md } | { loading: true } | { missing: true }
  function lessonMd(date) {
    var c = LESSON[date];
    if (c && c.md) return c.md;
    if (S.mode === "db" && S.db && !c) {
      LESSON[date] = { loading: true };
      S.db.collection("lessons").doc(date).get().then(function (snap) {
        var d = snap && snap.exists ? snap.data() : null;
        LESSON[date] = d && typeof d.md === "string" ? { md: d.md } : { missing: true };
        if (S.route === "l-" + date) scheduleRender();
      }, function () { LESSON[date] = { missing: true }; if (S.route === "l-" + date) scheduleRender(); });
    }
    if (LESSON_SNAP[date]) return LESSON_SNAP[date];
    return null;
  }
  function mdInline(t) {
    var codes = [];
    t = t.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    t = esc(t);
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, url) {
      var m = /^(?:[.\/a-z]*\/)?(\d{4}-\d{2}-\d{2})\.md$/.exec(url);
      if (m) return '<a href="#l-' + m[1] + '">' + txt + "</a>";
      m = /(?:^|\/)lessons\/([a-z]+)\/(\d+)\.md$/.exec(url);
      if (m) return '<a href="#l-' + m[1] + "-" + m[2] + '">' + txt + "</a>";
      if (!/^https?:/.test(url)) url = PLAN.repo + "study/daily/" + url;
      return '<a href="' + url + '" target="_blank" rel="noopener">' + txt + "</a>";
    });
    t = t.replace(/(^|[\s（(])(https?:\/\/[^\s<）)]+)/g, function (_, pre, url) { return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>"; });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    t = t.replace(/\$([^$]+)\$/g, function (_, m) { return '<span class="mth">' + mathText(m) + "</span>"; });
    return t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return "<code>" + esc(codes[+i]) + "</code>"; });
  }
  function mathText(m) {
    return m.replace(/\\text\{([^}]*)\}/g, "$1").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1) ÷ ($2)").replace(/\\cdots/g, "⋯")
      .replace(/_(\{[^}]*\}|\w)/g, function (_, x) { return "<sub>" + x.replace(/[{}]/g, "") + "</sub>"; }).replace(/\\,/g, " ");
  }
  function mdHTML(md) {
    var L = md.replace(/\r/g, "").split("\n"), out = [], i = 0, list = null;
    function closeList() { if (list) { out.push(list.sub ? "</ul></li></" + list.t + ">" : "</li></" + list.t + ">"); list = null; } }
    while (i < L.length) {
      var l = L[i], m;
      if (/^```/.test(l)) {
        closeList(); var lang = l.slice(3).trim(), buf = []; i++;
        while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]);
        i++; out.push('<div class="mdcode"><span class="lang">' + esc(lang || "text") + '</span><button type="button" class="btn ghost small" data-act="copy-code">复制</button><pre><code>' + esc(buf.join("\n")) + "</code></pre></div>"); continue;
      }
      if (/^\$\$/.test(l.trim())) {
        closeList(); var mb = []; i++;
        while (i < L.length && !/^\$\$/.test(L[i].trim())) mb.push(L[i++]);
        i++; out.push('<p class="mblock">' + mathText(esc(mb.join(" ").trim())) + "</p>"); continue;
      }
      if (!l.trim()) { if (list && L[i + 1] && /^(\s*)([-*]|\d+\.)\s/.test(L[i + 1])) { i++; continue; } closeList(); i++; continue; }
      if (/^<details>|^<\/details>|^<summary>.*<\/summary>$/.test(l.trim())) {
        closeList(); var tt = l.trim();
        out.push(tt.indexOf("<summary>") === 0 ? "<summary>" + esc(tt.replace(/<\/?summary>/g, "")) + "</summary>" : tt); i++; continue;
      }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { closeList(); var n = m[1].length; out.push("<h" + (n + 1) + ">" + mdInline(m[2]) + "</h" + (n + 1) + ">"); i++; continue; }
      if (/^---+\s*$/.test(l)) { closeList(); out.push("<hr>"); i++; continue; }
      if (/^>\s?/.test(l)) {
        closeList(); var q = [];
        while (i < L.length && /^>\s?/.test(L[i])) q.push(L[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + mdInline(q.join(" ")) + "</blockquote>"); continue;
      }
      if (/^\|/.test(l) && L[i + 1] && /^\|[\s:|-]+\|\s*$/.test(L[i + 1])) {
        closeList();
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        var h = cells(l), rows = []; i += 2;
        while (i < L.length && /^\|/.test(L[i])) rows.push(cells(L[i++]));
        out.push('<div class="mdtbl"><table><thead><tr>' + h.map(function (c) { return "<th>" + mdInline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + mdInline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>"); continue;
      }
      if ((m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l))) {
        var ind = m[1].length, t = /\d/.test(m[2]) ? "ol" : "ul";
        if (ind >= 2 && list) {
          if (!list.sub) { out.push("<ul>"); list.sub = true; }
          out.push("<li>" + mdInline(m[3]) + "</li>"); i++; continue;
        }
        if (list && list.sub) { out.push("</ul>"); list.sub = false; }
        if (list && list.t !== t) closeList();
        if (!list) { list = { t: t, sub: false }; out.push("<" + t + (t === "ol" ? ' start="' + parseInt(m[2], 10) + '"' : "") + "><li>" + mdInline(m[3])); }
        else out.push("</li><li>" + mdInline(m[3]));
        i++; continue;
      }
      if (list && /^\s{2,}\S/.test(l)) { out.push("<br>" + mdInline(l.trim())); i++; continue; }
      closeList();
      var para = [l.trim()]; i++;
      while (i < L.length && L[i].trim() && !/^(#{1,4}\s|```|\||>|<details>|<\/details>|<summary>|---+\s*$|\s*([-*]|\d+\.)\s|\$\$)/.test(L[i])) para.push(L[i++].trim());
      out.push("<p>" + mdInline(para.join("\n")).replace(/\n/g, "<br>") + "</p>");
    }
    closeList();
    return out.join("\n");
  }
  function lessonHTML(key) {
    var md = lessonMd(key), c = LESSON[key] || {}, STUDY = curStudy();
    var cm = /^([a-z]+)-(\d+)$/.exec(key);
    if (cm) {
      /* 按课的讲义：上一课、下一课、课程页 */
      var subj = cm[1], i = +cm[2] - 1, list = lessonList(subj), nx = STUDY.next[subj] || 0, iss = issuedN(subj);
      var stt = i < nx ? ["done", "已学完"] : i === nx ? ["cur", "下一课"] : ["todo", "还没到"];
      var col = LINE_COLOR[subj] || "--ln-rev";
      var lnav = '<nav class="lnav">' + (i > 0 ? '<a class="btn ghost small" href="#l-' + lessonKey(subj, i - 1) + '">← 第 ' + i + " 课</a>" : "<span></span>") +
        '<a class="btn ghost small" href="#c-' + subj + '">' + esc(subjName(subj)) + " 全部课程</a>" +
        (i + 1 < iss ? '<a class="btn ghost small" href="#l-' + lessonKey(subj, i + 1) + '">第 ' + (i + 2) + " 课 →</a>" : "<span></span>") + "</nav>";
      var file = "study/lessons/" + subj + "/" + pad2(i + 1) + ".md", gh = PLAN.repo + file;
      var body0 = md ? '<article class="md">' + mdHTML(md) + "</article>"
        : c.loading ? '<p class="empty-line">讲义加载中……</p>'
        : '<p class="empty-line">这一课的讲义还没写。排到这一课的那天早上 ' + PLAN.push + "（" + PLAN.tz + "）会写好。</p>";
      return '<div class="view lesson"><p class="eyebrow"><a href="#c-' + subj + '"><b class="lbadge" style="--c:var(' + col + ')">' + esc(subjName(subj)) + "</b></a> · 第 " + (i + 1) + " / " + list.length + ' 课 · <span class="lst ' + stt[0] + '">' + stt[1] + "</span></p>" +
        lnav + body0 + lnav + (md ? '<p class="meta src">原文件：<a href="' + gh + '" target="_blank" rel="noopener">' + file + "</a></p>" : "") + "</div>";
    }
    var date = key, days = Object.keys(STUDY.days).filter(function (d) { return STUDY.days[d].file; }).sort();
    var k = days.indexOf(date), prev = k > 0 ? days[k - 1] : "", next = k >= 0 && k < days.length - 1 ? days[k + 1] : "";
    var nav = '<nav class="lnav">' + (prev ? '<a class="btn ghost small" href="#l-' + prev + '">← ' + prev + "</a>" : "<span></span>") +
      '<a class="btn ghost small" href="#journal">足迹</a>' + (next ? '<a class="btn ghost small" href="#l-' + next + '">' + next + " →</a>" : "<span></span>") + "</nav>";
    var gh2 = PLAN.repo + "study/daily/" + date + ".md";
    var rec = STUDY.days[date], cards = "";
    if (rec && rec.planned && rec.planned.length && date !== PLAN.prep) {
      cards = '<div class="lcards">' + rec.planned.map(function (s) {
        var ok = (rec.done || []).indexOf(s.subj) >= 0, col2 = LINE_COLOR[s.subj] || "--ln-rev";
        return '<a class="lcard' + (ok ? " ok" : "") + '" href="' + slotHref(s) + '" style="--c:var(' + col2 + ')"><span class="lc-top"><b class="lbadge' + (DARK_INK[s.subj] ? " dk" : "") + '">' + esc(subjName(s.subj)) + '</b><span class="lc-min">' + (ok ? "✓ " : "") + s.mins + "′</span></span>" +
          '<span class="lc-t">' + esc(s.title || "") + '</span><span class="lc-go">' + (s.subj === "film" ? "打开跟读播放器" : s.review ? "本周复习" : "打开讲义") + " →</span></a>";
      }).join("") + "</div>";
    }
    var body = md ? '<article class="md">' + mdHTML(md) + "</article>"
      : c.loading ? '<p class="empty-line">路线单加载中……</p>'
      : '<p class="empty-line">研习录里还没有这天的路线单。可以先看 <a href="' + gh2 + '" target="_blank" rel="noopener">GitHub 上的版本</a>。</p>';
    return '<div class="view lesson"><p class="eyebrow"><a href="#journal">足迹</a> · ' + (date === PLAN.prep ? "讲义" : "路线单") + "</p>" + nav + cards + body + nav +
      '<p class="meta src">原文件：<a href="' + gh2 + '" target="_blank" rel="noopener">study/daily/' + date + ".md</a></p></div>";
  }
  /* ---------- 首页：线网图 ----------
   * 两种线：目标线（plan.js 的 goals）按估算小时排站，进度看学了多少小时、过了几站检验；
   * 自选线（metro.js 的 free）一课一站。没有晚点：路线单只是建议，没学完下次接着学。 */
  var M = window.YXL_METRO || null;
  var LINE_COLOR = { film: "--ln-en", en: "--ln-en", sql: "--ln-sql", py: "--ln-py", cfa: "--ln-cfa", geo: "--ln-geo", rev: "--ln-rev", prep: "--ln-rev", tao: "--ln-tao", mm: "--ln-mm" };
  var DARK_INK = { film: 1, en: 1, mm: 1 };
  var GOALS = (PLAN && PLAN.goals) || [];
  var GOAL = {}, GOAL_OF = {};
  GOALS.forEach(function (g) { GOAL[g.id] = g; g.subjs.forEach(function (s) { GOAL_OF[s] = g.id; }); });
  var POS = {};
  function subjName(s) { return s === "prep" ? "准备日" : ((PLAN && PLAN.subjects[s]) || {}).name || s; }
  function addDaysBJ(d, n) { return new Date(utcDay(d) + n * 86400000).toISOString().slice(0, 10); }
  function wdOf(d) { return new Date(utcDay(d)).getUTCDay(); }
  function cnDate(d) { return +d.slice(5, 7) + "月" + +d.slice(8, 10) + "日"; }
  /* 这一天这一科要不要往前走一课（复习时段、还没开始的科目都不算） */
  function onDay(subj, d) { return sinceOk(subj, d) && (PLAN.week[wdOf(d)] || []).some(function (x) { return x[0] === subj && x[2] !== "review"; }); }
  function checkedIn(rec) { return !!(rec && rec.status && rec.status !== "pushed"); }
  function nextWhen(subj) {
    var t = bjToday();
    for (var k = 0; k < 8; k++) { var d = addDaysBJ(t, k); if (onDay(subj, d)) return k === 0 ? "今天" : k === 1 ? "明天" : WD[wdOf(d)]; }
    return "";
  }
  /* 学习时间：打卡记录里完成的时段按排课分钟算（报了当天总分钟就按比例折算），再加上随手记里关联到书的分钟 */
  function minutesBy() {
    var STUDY = curStudy(), m = {};
    Object.keys(STUDY.days || {}).forEach(function (d) {
      var r = STUDY.days[d], done = r.done || [];
      if (!done.length || !r.planned) return;
      var slots = r.planned.filter(function (s) { return done.indexOf(s.subj) >= 0; });
      var sum = slots.reduce(function (a, s) { return a + (s.mins || 0); }, 0), f = r.minutes && sum ? r.minutes / sum : 1;
      slots.forEach(function (s) { m[s.subj] = (m[s.subj] || 0) + (s.mins || 0) * f; });
    });
    journalEntries().forEach(function (e) {
      var b = String(e.ref || "").split("-ch")[0], k = b === "zhoulu" ? "tao" : b === "tragedy" ? "geo" : "";
      if (k && e.minutes) m[k] = (m[k] || 0) + Number(e.minutes);
    });
    return m;
  }
  function hrs(min) { return Math.round(min / 6) / 10; }
  function subjMin(s) { return minutesBy()[s] || 0; }
  function goalMin(g) { var m = minutesBy(); return g.subjs.reduce(function (a, s) { return a + (m[s] || 0); }, 0); }
  function goalTotal(g) { return g.stations.reduce(function (a, s) { return a + s.hours; }, 0); }
  /* 目标线每一站：已学小时、状态（passed 过了检验 / ready 学够了等检验 / on 在学 / todo 还没到） */
  function goalStations(g) {
    var ck = curStudy().checks || {}, par = g.parallel || 0, m = minutesBy();
    var parDone = 0, out = [];
    g.stations.slice(0, par).forEach(function (st) { parDone += Math.min(st.hours, (m[st.subj] || 0) / 60); });
    var rest = Math.max(0, goalMin(g) / 60 - parDone), firstOpen = -1;
    g.stations.forEach(function (st, i) {
      var done = i < par ? Math.min(st.hours, (m[st.subj] || 0) / 60) : Math.min(st.hours, rest);
      if (i >= par) rest = Math.max(0, rest - done);
      var passed = ck[g.id + "-" + i];
      var state = passed ? "passed" : done >= st.hours ? "ready" : done > 0 ? "on" : "todo";
      if (!passed && firstOpen < 0 && i >= par) firstOpen = i;
      out.push({ st: st, i: i, done: done, state: state, passed: passed || "" });
    });
    if (firstOpen >= 0 && out[firstOpen].state === "todo" && out.slice(0, par).every(function (x) { return x.state === "passed"; })) out[firstOpen].state = "on";
    out.slice(0, par).forEach(function (x) { if (x.state === "todo") x.state = "on"; });
    return out;
  }
  function stateText(s) { return { passed: "已过检验", ready: "学够了，等检验", on: "在学", todo: "还没到" }[s]; }

  /* ---------- 折线工具 ---------- */
  function segLen(a, b) { return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); }
  function polyLen(p) { var L = 0; for (var k = 1; k < p.length; k++) L += segLen(p[k - 1], p[k]); return L; }
  function polyAt(p, d) {
    for (var k = 1; k < p.length; k++) {
      var sl = segLen(p[k - 1], p[k]);
      if (d <= sl || k === p.length - 1) { var f = sl ? Math.max(0, Math.min(1, d / sl)) : 0; return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f]; }
      d -= sl;
    }
    return p[p.length - 1];
  }
  function polySub(p, d0, d1) {
    var out = [polyAt(p, d0)], acc = 0;
    for (var k = 1; k < p.length - 1; k++) { acc += segLen(p[k - 1], p[k]); if (acc > d0 && acc < d1) out.push(p[k]); }
    out.push(polyAt(p, d1));
    return out;
  }
  function ptsPath(pts) { return "M" + pts.map(function (q) { return r1(q[0]) + " " + r1(q[1]); }).join(" L"); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function isVert(p, d) { var a = polyAt(p, Math.max(0, d - 1)), b = polyAt(p, d + 1); return Math.abs(b[0] - a[0]) < 0.5; }

  /* ---------- 自选线 ---------- */
  function freeName(f) {
    if (f.name) return f.name;
    if (f.book && LIB.books[f.book]) return LIB.books[f.book].title;
    return subjName(f.subj);
  }
  function freeStops(f) {
    var STUDY = curStudy(), out = [];
    if (f.subj && PLAN.lessons[f.subj]) {
      var list = lessonList(f.subj), nx = STUDY.next[f.subj] || 0;
      list.forEach(function (x, i) { out.push({ title: x.title, state: i < nx ? "done" : i === nx ? "cur" : "todo" }); });
    } else if (f.book && LIB.books[f.book]) {
      var b = LIB.books[f.book], first = -1;
      b.chapters.forEach(function (c, i) { var dn = isDone(chId(f.book, c.n)); if (!dn && first < 0) first = i; out.push({ title: "第" + CN[c.n] + "章 " + c.title, n: c.n, state: dn ? "done" : "todo" }); });
      if (first >= 0) out[first].state = "cur";
    } else if (f.id === "mm") {
      M.mmWeeks.forEach(function (t, i) { out.push({ title: "第 " + (i + 1) + " 周 · " + t, state: "todo" }); });
    }
    return out;
  }
  function freeMin(f) { var m = minutesBy(); return m[f.subj || f.id] || 0; }
  /* 估算总时长：按课表每周排几次、每次多久推算（电影 36 段 6 周，每周 7 次 90 分钟） */
  function subjEstMin(subj) {
    if (!PLAN.lessons[subj]) return 0;
    var adv = 0, all = 0;
    Object.keys(PLAN.week).forEach(function (wd) { PLAN.week[wd].forEach(function (x) { if (x[0] !== subj) return; all += x[1]; if (x[2] !== "review") adv++; }); });
    return adv ? Math.ceil(lessonList(subj).length / adv) * all : 0;
  }
  function freeLine(id) { return (M.free || []).filter(function (f) { return f.id === id; })[0]; }
  function freeHref(f) { return f.subj && COURSES.indexOf(f.subj) >= 0 ? "#c-" + f.subj : f.book ? "#b-" + f.book : ""; }

  /* ---------- 今日路线 ---------- */
  function todayInfo() {
    var STUDY = curStudy(), t = bjToday(), rec = STUDY.days[t], day = dayPlan(t), slots;
    if (rec && rec.planned && rec.planned.length) {
      slots = rec.planned.map(function (p) {
        var o = { subj: p.subj, mins: p.mins, title: p.title, index: p.index, review: p.review };
        if (PLAN.lessons[p.subj]) o.total = lessonList(p.subj).length;
        return o;
      });
    } else slots = day.slots || [];
    return { t: t, rec: rec, day: day, slots: slots };
  }
  function metroMode() {
    if (!S.metroMode) { try { S.metroMode = localStorage.getItem("yanxilu-route-" + bjToday()) || "std"; } catch (e) { S.metroMode = "std"; } }
    return S.metroMode;
  }
  /* 保底：只学电影一段；标准：路线单；多学：目标线上再多学一课 */
  function routeFor(ti, mode) {
    var slots = ti.slots;
    if (mode === "min") { var fm = slots.filter(function (s) { return s.subj === "film" || s.subj === "en"; }); return { stops: fm.length ? fm : slots.slice(0, 1) }; }
    if (mode !== "plus") return { stops: slots };
    var base = slots.filter(function (x) { return GOAL_OF[x.subj] && PLAN.lessons[x.subj]; })[0];
    if (!base) return { stops: slots };
    var list = lessonList(base.subj), i = (curStudy().next[base.subj] || 0) + 1;
    if (i >= list.length) return { stops: slots };
    return { stops: slots.concat([{ subj: base.subj, mins: base.mins, title: list[i].title, index: i, total: list.length, extra: true }]) };
  }
  function stopSeq(s) {
    if (s.subj === "en") return "跟着 CFA 主题";
    if (s.review) return "复习，不往前走";
    if (!PLAN.lessons[s.subj]) return "";
    return "第 " + ((s.index || 0) + 1) + " / " + (s.total || lessonList(s.subj).length) + (s.subj === "film" ? " 段" : " 课");
  }
  function stopLine(s) {
    var g = GOAL[GOAL_OF[s.subj]];
    return g ? g.name + " · " + subjName(s.subj) : subjName(s.subj);
  }
  function todayStripHTML(ti) {
    var mode = metroMode(), r = routeFor(ti, mode), stops = r.stops, t = ti.t, rec = ti.rec, day = ti.day;
    var total = stops.reduce(function (a, s) { return a + (s.mins || 0); }, 0);
    var head = '<div class="ts-top"><div><p class="eyebrow">今天 · ' + cnDate(t) + " " + WD[day.wd] + (day.prep ? " · 准备日" : day.before ? "" : " · 第 " + weekNo(t) + " 周第 " + (dayDiff(PLAN.start, t) % 7 + 1) + " 天") + '</p><h2 id="ts-h">今日路线</h2></div>' +
      '<div class="seg" role="group" aria-label="今天学多少">' + [["min", "保底"], ["std", "标准"], ["plus", "多学"]].map(function (m) {
        var mins = routeFor(ti, m[0]).stops.reduce(function (a, s) { return a + (s.mins || 0); }, 0);
        return '<button type="button" data-act="metro-mode" data-m="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + ' <span class="segn">' + mins + "′</span></button>";
      }).join("") + "</div></div>";
    if (!stops.length) {
      return '<section class="tstrip" aria-labelledby="ts-h">' + head + '<p class="ts-note" style="margin-top:16px">今天没有排课。路线单每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送。</p></section>";
    }
    var route = stops.map(function (s) {
      var c = LINE_COLOR[s.subj] || "--ln-rev", g = GOAL_OF[s.subj], plus = g && s.mins ? "学完 " + GOAL[g].name + " +" + hrs(s.mins) + " 小时" : "";
      return '<a class="stp' + (s.extra ? " extra" : "") + '" href="' + slotHref(s) + '" style="--c:var(' + c + ');flex-grow:' + (s.mins || 20) + '"><span class="stp-dot" aria-hidden="true"></span><span class="stp-bar" aria-hidden="true"></span>' +
        '<span class="stp-tx"><span class="stp-tag"><b class="stp-line">' + esc(stopLine(s)) + (s.extra ? " · 多学" : "") + '</b><span class="stp-min">' + (s.mins || "") + "′</span></span>" +
        '<span class="stp-title">' + esc(s.title || "") + '</span><span class="stp-seq">' + esc([stopSeq(s), plus].filter(Boolean).join(" · ")) + (s.subj === "film" ? " · 跟读播放器" : s.lesson || (PLAN.lessons[s.subj] && isWritten(s.subj)) ? " · 讲义" : "") + "</span></span></a>";
    }).join("") + '<div class="stp end"><span class="stp-dot" aria-hidden="true"></span><div class="stp-tx"><span class="stp-min">' + PLAN.checkin + '</span><span class="stp-title">打卡 · 盖章</span></div></div>';
    var note = mode === "min" ? "时间不够就只学电影这一段，学一点也算没断。其余几课下次接着学，不记欠账。"
      : mode === "plus" ? "目标线上多学一课，小时数多涨一点。"
      : "按今天的路线单学。哪一课没学完，下次从这一课接着学，不记欠账。";
    var btn = rec && rec.file ? '<a class="btn" href="' + esc(lessonHref(rec.file)) + '">今天的路线单</a>' : '<span class="meta">路线单每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送</span>";
    var y = addDaysBJ(t, -1), yr = curStudy().days[y], warn = "";
    if (yr && !checkedIn(yr) && y !== PLAN.prep) warn = '<p class="ts-warn"><b>' + cnDate(y) + "还没打卡。</b>先按没学处理，那几课下次接着学；其实学了的话，晚上打卡时一起说，足迹和小时数都会补上。</p>";
    return '<section class="tstrip" aria-labelledby="ts-h">' + head + '<div class="ts-route">' + route + "</div>" +
      '<div class="ts-foot">' + btn + '<p class="ts-note">全程 ' + total + " 分钟。" + note + "</p></div>" + warn + "</section>";
  }

  /* ---------- 线网图 ---------- */
  function tx(x, y, s, cls, anchor, style) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '"' + (cls ? ' class="' + cls + '"' : "") + (anchor ? ' text-anchor="' + anchor + '"' : "") + (style ? ' style="' + style + '"' : "") + ">" + esc(s) + "</text>";
  }
  function textW(s, size) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? size : size * 0.58; return Math.round(w); }
  function plateSVG(x, y, name, kind, hrsTxt, col, href, w) {
    w = w || 150;
    var goal = kind === "目标线";
    var g = '<g class="mplate"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="46" rx="3" class="mpl-bg"/>' +
      '<rect x="' + (x + 7) + '" y="' + (y + 8) + '" width="6" height="30" style="fill:var(' + col + ')"/>' + tx(x + 20, y + 20, name, "mpl-n") +
      '<rect x="' + (x + 20) + '" y="' + (y + 27) + '" width="38" height="14" rx="7" style="' + (goal ? "fill:var(" + col + ");stroke:var(" + col + ")" : "fill:none;stroke:var(" + col + ")") + '"/>' +
      '<text x="' + (x + 39) + '" y="' + (y + 37.5) + '" text-anchor="middle" class="mpl-k" style="fill:' + (goal ? "var(--bdg-on)" : "var(" + col + ")") + '">' + kind + "</text>" +
      tx(x + 64, y + 38, hrsTxt, "mpl-h") + "</g>";
    return href ? '<a href="' + href + '" class="mplate-a" aria-label="' + esc(name) + '">' + g + "</a>" : g;
  }
  function todaySeal(x, y, label) {
    return '<g class="mseal" aria-hidden="true" transform="translate(' + r1(x) + " " + r1(y) + ') rotate(-6)"><rect x="-10" y="-10" width="20" height="20" rx="2"/><rect x="-7.5" y="-7.5" width="15" height="15" class="in"/><text y="4.6" text-anchor="middle">今</text></g>' +
      (label ? tx(x + 14, y + 4.5, label, "mt-b") : "");
  }
  function hereRing(x, y, col) {
    return '<circle class="mhalo" cx="' + r1(x) + '" cy="' + r1(y) + '" r="12" style="stroke:var(' + col + ')"/><circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="8" class="mhere"/>';
  }
  function stopDot(x, y, col, state, r) {
    if (state === "done") return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + (r - 0.5) + '" style="fill:var(' + col + ');stroke:var(--map-bg);stroke-width:1.8"/>';
    return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r + '" style="fill:var(--map-bg);stroke:var(' + col + ');stroke-width:2.6"/>';
  }
  function checkDot(x, y, state) {
    return state === "passed" ? '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="10" class="mchk ok"/><path d="M' + r1(x - 4.5) + " " + r1(y) + " l3 3.2 l6 -6.4" + '" class="mchk-v"/>'
      : '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="10" class="mchk"/><circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="3" class="mchk-c"/>';
  }
  /* 目标线：粗线中间一道空心（还要学），学过的一段填实；前几站并行的轨道画在主线两侧 */
  function goalSVG(gid, today, h) {
    var g = GOAL[gid], L = M.goals[gid]; if (!g || !L) return;
    var p = L.pts, len = polyLen(p), tot = goalTotal(g), k = len / tot, par = g.parallel || 0, col = g.color;
    var sts = goalStations(g), parH = g.stations.slice(0, par).reduce(function (a, s) { return a + s.hours; }, 0);
    var mergeD = parH * k, seqDone = sts.slice(par).reduce(function (a, x) { return a + x.done; }, 0) * k;
    var mainPts = par ? polySub(p, mergeD, len) : p;
    h.push('<g class="mgoal" data-g="' + gid + '">');
    h.push('<path d="' + ptsPath(mainPts) + '" class="mg-out" style="stroke:var(' + col + ')"/><path d="' + ptsPath(mainPts) + '" class="mg-in"/>');
    if (seqDone > 0) h.push('<path d="' + ptsPath(polySub(p, mergeD, mergeD + seqDone)) + '" class="mg-done" style="stroke:var(' + col + ')"/>');
    var labels = [];
    if (par) {
      var x0 = p[0][0], y0 = p[0][1], xm = polyAt(p, mergeD)[0], gap = L.gap || 22;
      sts.slice(0, par).forEach(function (x, j) {
        var ty = y0 + (j === 0 ? -gap : gap), c2 = LINE_COLOR[x.st.subj] || col, tl = xm - x0 - 24;
        h.push('<path d="M' + x0 + " " + y0 + " L" + (x0 + 12) + " " + ty + " L" + (xm - 12) + " " + ty + " L" + xm + " " + y0 + '" class="mg-track" style="stroke:var(' + c2 + ')"/>');
        var gx = Math.max(x0 + 28, x0 + 12 + tl * Math.min(1, x.done / x.st.hours));
        if (x.done > 0) h.push('<path d="M' + (x0 + 12) + " " + ty + " L" + r1(gx) + " " + ty + '" class="mg-tdone"/>');
        POS["g:" + gid + ":" + j] = [x0 + 12 + tl / 2, ty];
        h.push('<g class="mst" data-act="mgs" data-g="' + gid + '" data-i="' + j + '" tabindex="0" role="button" aria-label="' + esc(g.name + "：" + x.st.name + "，" + stateText(x.state)) + '"><title>' + esc(x.st.name) + '</title><rect class="hit" x="' + (x0 + 12) + '" y="' + (ty - 9) + '" width="' + r1(tl) + '" height="18"/></g>');
        h.push('<g class="mst" data-act="mgs" data-g="' + gid + '" data-i="' + j + '" tabindex="-1">' + hereRing(gx, ty, c2) + "</g>");
        labels.push(tx(x0 + 44, j === 0 ? ty - 12 : ty + 22, x.st.name + " " + x.st.hours + " h", "mt-gl", "", "fill:var(" + (j === 0 ? "--zi-data" : "--zi-data") + ")"));
        var sl = today[x.st.subj];
        if (sl) labels.push(todaySeal(gx, j === 0 ? ty - 40 : ty + 46, subjName(x.st.subj) + " 第 " + ((sl.index || 0) + 1) + " 课"));
      });
      ["start", "merge"].forEach(function (w, n) {
        var xx = n ? xm : x0;
        h.push('<rect x="' + r1(xx - 11) + '" y="' + (y0 - gap - 11) + '" width="22" height="' + (2 * gap + 22) + '" rx="11" class="mcap"/>');
      });
      if (L.joinHub !== false) POS.join = [x0 + 12 + (xm - x0 - 24) * 0.5, y0];
    }
    var cum = parH;
    sts.slice(par).forEach(function (x) {
      var d0 = cum * k; cum += x.st.hours; var d1 = cum * k, last = x.i === g.stations.length - 1;
      var mid = polyAt(p, (d0 + d1) / 2), q = polyAt(p, d1), vert = isVert(p, (d0 + d1) / 2);
      if (vert) labels.push(tx(mid[0] + 20, mid[1] + 2, x.st.name, "mt-gl", "", "fill:var(--ink)") + tx(mid[0] + 20, mid[1] + 18, x.st.hours + " h", "mt-h"));
      else labels.push(tx(mid[0], mid[1] + 34, x.st.name, "mt-gl", "middle", "fill:var(--ink)") + tx(mid[0], mid[1] + 50, x.st.hours + " h", "mt-h", "middle"));
      POS["g:" + gid + ":" + x.i] = mid;
      h.push('<g class="mst" data-act="mgs" data-g="' + gid + '" data-i="' + x.i + '" tabindex="0" role="button" aria-label="' + esc(g.name + "：" + x.st.name + "，约 " + x.st.hours + " 小时，" + stateText(x.state)) + '"><title>' + esc(x.st.name + " · 约 " + x.st.hours + " 小时") + "</title>" +
        '<path d="' + ptsPath(polySub(p, d0 + 6, d1 - 6)) + '" class="hit-line"/>' + (last ? "" : checkDot(q[0], q[1], x.state)) + "</g>");
      if (x.state === "on" && !par || (x.state === "on" && x.done > 0)) {
        var hp = polyAt(p, d0 + x.done * k);
        h.push('<g class="mst" data-act="mgs" data-g="' + gid + '" data-i="' + x.i + '" tabindex="-1">' + hereRing(hp[0], hp[1], col) + "</g>");
        var subj = x.st.subj || g.subjs[0], sl2 = today[subj] || (gid === "cfa" && today.en);
        if (sl2 && !par) labels.push(todaySeal(hp[0], hp[1] - 26, subjName(sl2.subj) + (sl2.index != null && sl2.subj !== "en" ? " 第 " + (sl2.index + 1) + " 课" : "")));
      }
    });
    var end = p[p.length - 1];
    if (L.endBox) {
      h.push('<rect x="' + end[0] + '" y="' + (end[1] - 19) + '" width="150" height="38" rx="8" class="mend"/>');
      labels.push(tx(end[0] + 75, end[1] - 3, "终点 · " + g.end, "mt-end", "middle") + tx(end[0] + 75, end[1] + 12, "约 " + tot + " h", "mt-h", "middle"));
    } else {
      h.push('<line x1="' + (end[0] + 6) + '" y1="' + end[1] + '" x2="' + (end[0] + 16) + '" y2="' + end[1] + '" class="mend-l"/><rect x="' + (end[0] + 16) + '" y="' + (end[1] - 22) + '" width="86" height="44" rx="8" class="mend"/>');
      labels.push(tx(end[0] + 59, end[1] - 4, "终点", "mt-end", "middle") + tx(end[0] + 59, end[1] + 12, "约 " + tot + " h", "mt-h", "middle") + tx(end[0] - 14, end[1] + 4, g.end, "mt-end", "end"));
    }
    h.push("</g>");
    h.push(labels.join(""));
    h.push(plateSVG(L.plate[0], L.plate[1], g.name, "目标线", hrs(goalMin(g)) + "/" + tot + " h", col, "#g-" + gid));
  }
  function freeSVG(f, today, h) {
    var stops = freeStops(f), n = stops.length; if (!n) return;
    var p = f.pts, len = polyLen(p), col = f.color, name = freeName(f), small = n > 20;
    if (f.after) {
      var e0 = p[p.length - 1];
      h.push('<path d="M' + e0[0] + " " + e0[1] + " L" + f.after.to[0] + " " + f.after.to[1] + '" class="mf-after" style="stroke:var(' + col + ')"/>');
      h.push(tx(f.after.to[0], f.after.to[1] + 28, f.after.label, "mt-s", "end", "fill:var(--zi-en)"));
    }
    h.push('<path d="' + ptsPath(p) + '" class="mf-line" style="stroke:var(' + col + ')"/>');
    var hubIdx = {}; (M.hubs || []).forEach(function (hb) { hb.at.forEach(function (a) { if (a[0] === f.id) hubIdx[a[1]] = 1; }); });
    var sl = f.subj ? today[f.subj] : null, overlay = [];
    stops.forEach(function (s, i) {
      var q = polyAt(p, n > 1 ? len * i / (n - 1) : 0), x = q[0], y = q[1];
      POS["f:" + f.id + ":" + i] = q;
      if (f.ticks && i % f.ticks === 0) h.push(tx(x, y - 14, "第 " + (i / f.ticks + 1) + " 周", "mt-tick", "middle"));
      var label = name + " 第 " + (i + 1) + " 站：" + s.title;
      if (s.state === "cur") overlay.push({ i: i, x: x, y: y, s: s, label: label });
      if (hubIdx[i]) return;
      h.push('<g class="mst" data-act="mst" data-l="' + f.id + '" data-i="' + i + '" tabindex="-1" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title><circle class="hit" cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + (small ? 8 : 11) + '"/>' + stopDot(x, y, col, s.state, small ? 4.2 : 5) + "</g>");
    });
    overlay.forEach(function (o) {
      h.push('<g class="mst" data-act="mst" data-l="' + f.id + '" data-i="' + o.i + '" tabindex="0" role="button" aria-label="' + esc(o.label + "（下一站）") + '"><title>' + esc(o.label) + "</title>" + '<circle class="hit" cx="' + r1(o.x) + '" cy="' + r1(o.y) + '" r="14"/>' + hereRing(o.x, o.y, col) + "</g>");
      if (sl && !sl.review && sl.index === o.i) h.push(todaySeal(o.x, o.y + 26, f.subj === "film" ? "第 " + (o.i + 1) + " 段" : "第 " + (o.i + 1) + " 课"));
    });
    var est = f.subj ? subjEstMin(f.subj) : 0, mins = freeMin(f), done = stops.filter(function (s) { return s.state === "done"; }).length;
    var hrsTxt = est ? hrs(mins) + "/" + Math.round(est / 60) + " h" : hrs(mins) + " h";
    if (f.plate) h.push(plateSVG(f.plate[0], f.plate[1], name, "自选线", hrsTxt, col, freeHref(f)));
    if (f.title) {
      var unit = f.book ? " 章" : f.id === "mm" ? " 周" : " 课", t = name + " · 自选线 · " + done + " / " + n + unit + (mins ? " · " + hrs(mins) + " 小时" : "");
      var href = freeHref(f) || (f.report ? reportHref(REPORTS.filter(function (x) { return x.id === f.report; })[0] || {}) : "");
      var lab = tx(f.title[0], f.title[1], t, "mt-ft", "", "fill:var(" + col + ")");
      h.push(href ? '<a href="' + esc(href) + '"' + (f.report ? ' target="_blank" rel="noopener"' : "") + ' class="mlink">' + lab + "</a>" : lab);
    }
  }
  function metroSVG(ti) {
    POS = {};
    var today = {}; ti.slots.forEach(function (s) { today[s.subj] = s; });
    var h = ['<svg class="metro" viewBox="0 0 ' + M.w + " " + M.h + '" role="group" aria-label="线网图：两条目标线、几条自选线、换乘站和地标">'];
    M.zones.forEach(function (z) {
      h.push('<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="16" class="mzone-r' + (z.dashed ? " dashed" : "") + '"' + (z.dashed ? "" : ' style="fill:var(' + z.fill + ')"') + "/>");
      if (!z.name) return;
      var lx = z.x + 16, ly = z.bottom ? z.y + z.h - 16 : z.y + 26;
      var lab = tx(lx, ly, z.name, "mzl", "", "fill:var(" + z.ink + ")") + (z.sub ? tx(lx, ly + 18, z.sub, "mt-s", "", "fill:var(" + z.ink + ")") : "");
      h.push(z.track && TRACK[z.track] ? '<a href="#t-' + z.track + '" class="mzone">' + lab + "</a>" : lab);
    });
    (M.planned || []).forEach(function (pl) {
      h.push('<path d="' + ptsPath(pl.pts) + '" class="mf-plan"/>');
      for (var j = 0; j < pl.stops; j++) { var q = polyAt(pl.pts, polyLen(pl.pts) * (j + 0.1) / pl.stops); h.push('<circle cx="' + r1(q[0]) + '" cy="' + r1(q[1]) + '" r="5" class="mf-plan-s"/>'); }
      h.push(tx(pl.lx, pl.ly, pl.label, "mt-s", "", "fill:var(--ink-3)"));
    });
    (M.free || []).forEach(function (f) { freeSVG(f, today, h); });
    Object.keys(M.goals || {}).forEach(function (gid) { goalSVG(gid, today, h); });
    (M.labels || []).forEach(function (l) { h.push(tx(l.x, l.y, l.t, "mt-b", l.anchor, l.ink ? "fill:var(" + l.ink + ")" : "")); });
    (M.hubs || []).forEach(function (hb, k) {
      var xy = hb.ai ? POS.join : [hb.x, hb.y]; if (!xy) return;
      POS["h:" + k] = xy;
      var shape = hb.ai ? '<rect x="' + r1(xy[0] - 9) + '" y="' + r1(xy[1] - 31) + '" width="18" height="62" rx="9" class="mhub"/>' : '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="10" class="mhub"/>';
      h.push('<g class="mst" data-act="mhub" data-h="' + k + '" tabindex="0" role="button" aria-label="换乘站：' + esc(hb.name) + '"><title>换乘站：' + esc(hb.name) + "</title>" + shape + "</g>");
    });
    (M.landmarks || []).forEach(function (lm) {
      var tp = lm.topic ? TOPIC[lm.topic] : null, rp = !tp && lm.report ? REPORTS.filter(function (x) { return x.id === lm.report; })[0] : null;
      if (!tp && !rp) return;
      var key = tp ? "t:" + tp.id : rp.id, title = tp ? tp.title : rp.title;
      var sub = tp ? topicItems(tp).length + " 件" + (TP_STATUS[tp.status] ? " · " + TP_STATUS[tp.status] : "") : lm.sub;
      POS["l:" + key] = [lm.x, lm.y];
      h.push('<g class="mlm mst" data-act="mlm" data-r="' + esc(key) + '" tabindex="0" role="button" aria-label="' + (tp ? "研究课题：" : "地标：") + esc(title) + '"><title>' + (tp ? "研究课题：" : "地标：") + esc(title) + '</title><rect class="hit" x="' + (lm.x - 12) + '" y="' + (lm.y - 12) + '" width="' + (30 + textW(title, 13)) + '" height="' + (sub ? 40 : 24) + '"/>' +
        '<rect x="' + (lm.x - 7) + '" y="' + (lm.y - 7) + '" width="14" height="14" class="mlm-sq"/>' + tx(lm.x + 14, lm.y + 4.5, title, "mt-lm") + (sub ? tx(lm.x + 14, lm.y + 21, sub, "mt-s", "", "fill:var(--ink-3)") : "") + "</g>");
    });
    var lg = M.legend;
    if (lg) {
      var X = lg.x, Y = lg.y, gy = Y + 52;
      h.push('<g class="mlg"><rect x="' + X + '" y="' + Y + '" width="304" height="204" rx="14" class="mlg-bg"/>' + tx(X + 18, Y + 28, "图例", "mt-end") +
        '<path d="M' + (X + 18) + " " + gy + " L" + (X + 62) + " " + gy + '" class="mg-out" style="stroke:var(--ln-cfa);stroke-width:11"/><path d="M' + (X + 40) + " " + gy + " L" + (X + 62) + " " + gy + '" class="mg-in" style="stroke-width:4"/>' + tx(X + 74, gy + 4.5, "目标线：实心是已学，空心是还要学", "mt-lg") +
        checkDot(X + 40, gy + 28, "todo") + tx(X + 74, gy + 32.5, "技能站：过了检验才算到站", "mt-lg") +
        '<path d="M' + (X + 18) + " " + (gy + 56) + " L" + (X + 62) + " " + (gy + 56) + '" class="mf-line" style="stroke:var(--ln-geo)"/>' + stopDot(X + 32, gy + 56, "--ln-geo", "done", 5) + stopDot(X + 50, gy + 56, "--ln-geo", "todo", 5) + tx(X + 74, gy + 60.5, "自选线：一课一站", "mt-lg") +
        '<circle cx="' + (X + 40) + '" cy="' + (gy + 84) + '" r="10" class="mhub"/>' + tx(X + 74, gy + 88.5, "换乘：两条线讲同一件事", "mt-lg") +
        '<rect x="' + (X + 33) + '" y="' + (gy + 105) + '" width="14" height="14" class="mlm-sq"/>' + tx(X + 74, gy + 116.5, "地标：研究课题，一盒一个", "mt-lg") +
        todaySeal(X + 40, gy + 140) + tx(X + 74, gy + 144.5, "今天要学的那一站", "mt-lg") + "</g>");
    }
    h.push("</svg>");
    return h.join("");
  }

  /* ---------- 线网图下方：目标线明细、地标、规则 ---------- */
  function goalSecHTML(g) {
    var sts = goalStations(g), tot = goalTotal(g), done = goalMin(g) / 60;
    var rows = sts.map(function (x) {
      var pct = Math.min(100, Math.round(x.done / x.st.hours * 100));
      var links = [];
      if (x.st.subj && COURSES.indexOf(x.st.subj) >= 0) links.push('<a href="#c-' + x.st.subj + '">' + esc(subjName(x.st.subj)) + " 课程</a>");
      if (x.st.item && ITEMS[x.st.item]) links.push('<a href="#t-' + ITEMS[x.st.item].tracks[0] + '">书架</a>');
      return '<tr class="' + x.state + '"><th scope="row"><button type="button" class="linkbtn gname" data-act="mgs" data-g="' + g.id + '" data-i="' + x.i + '">' + esc(x.st.name) + "</button>" + (links.length ? '<span class="glinks">' + links.join(" · ") + "</span>" : "") + "</th>" +
        "<td>" + esc(x.st.learn || "") + '</td><td class="gnum">' + x.st.hours + " h</td><td>" + esc(x.st.check || "") + "</td>" +
        '<td class="gprog"><span class="bar"><span style="width:' + pct + "%;background:var(" + (LINE_COLOR[x.st.subj] || g.color) + ')"></span></span><span class="gp-t">' + (Math.round(x.done * 10) / 10) + " / " + x.st.hours + ' h</span><span class="gst ' + x.state + '">' + stateText(x.state) + (x.passed ? " · " + esc(x.passed) : "") + "</span></td></tr>";
    }).join("");
    return '<section class="gsec" id="g-' + g.id + '" style="--c:var(' + g.color + ')"><div class="gsec-h"><h2><span class="gbar" aria-hidden="true"></span>' + esc(g.name) + ' <span class="gk">目标线</span></h2>' +
      '<p class="meta">终点：' + esc(g.end) + " · 已学 " + (Math.round(done * 10) / 10) + " / 约 " + tot + " 小时 · 还要约 " + Math.max(0, Math.round(tot - done)) + " 小时</p></div>" +
      '<div class="gtab-w"><table class="gtab"><thead><tr><th scope="col">技能站</th><th scope="col">学什么</th><th scope="col" class="gnum">估算</th><th scope="col">过站检验</th><th scope="col">进度</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (g.parallel ? '<p class="meta gnote">前 ' + g.parallel + " 站是并行的两条轨道，交替学，都过了检验再并成一条线。小时数是粗估，学到那一站时再细化。</p>" : '<p class="meta gnote">每科先按 30 小时估，学到那一科时再按考纲细化。</p>') + "</section>";
  }
  function landmarkPanel() {
    var inbox = inboxItems();
    return '<section class="panel" aria-labelledby="lm-h"><h2 id="lm-h">研究课题</h2><p class="meta" style="margin-top:6px">讨论和查到的资料按课题装进档案盒，放在<a href="#archive">书架 · 档案架</a>上；地图上一个课题一个地标，不算进度。</p><div class="lmk-list">' +
      TOPICS.map(function (tp) {
        var n = topicItems(tp).length;
        return '<button type="button" class="lmk" data-act="abox-go" data-t="' + esc(tp.id) + '"><span class="lmk-sq" aria-hidden="true"></span><span class="lmk-t">' + esc(tp.title) + ' <span class="lmk-n">' + esc(topicNo(tp)) + " · " + n + " 件" + (TP_STATUS[tp.status] ? " · " + TP_STATUS[tp.status] : "") + "</span></span>" +
          '<span class="lmk-d">' + esc(tp.question || "") + "</span>" + (tp.answer ? '<span class="lmk-a">' + esc(tp.answer) + "</span>" : "") + "</button>";
      }).join("") +
      inbox.map(function (rp) { return '<a class="lmk" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><span class="lmk-sq" aria-hidden="true"></span><span class="lmk-t">' + esc(rp.title) + ' <span class="lmk-n">收件匣</span> <span aria-hidden="true">↗</span></span><span class="lmk-d">' + esc(rp.desc) + "</span></a>"; }).join("") + "</div></section>";
  }
  function homeHTML() {
    if (!M || !PLAN) return shelfHTML();
    var ti = todayInfo();
    var gDone = GOALS.reduce(function (a, g) { return a + goalMin(g) / 60; }, 0), gTot = GOALS.reduce(function (a, g) { return a + goalTotal(g); }, 0);
    var stats = [[GOALS.length, "条目标线", GOALS.map(function (g) { return g.name; }).join(" · ")], [(M.free || []).length, "条自选线", "一课一站"],
      [Math.round(gDone * 10) / 10, "小时", "目标线已学"], [Math.round(gTot - gDone), "小时", "目标线还要学"]];
    return '<div class="view home">' + bannerHTML() +
      '<header class="phead"><div><p class="eyebrow">' + esc(PLAN.phase) + " · " + cnDate(PLAN.start) + '起</p><h1>线网图</h1><p class="lede">底色是学习方向。双线是目标线，按估算小时排站，站距越长要学越久；单线是自选线，一课一站。</p></div>' +
      '<div class="pstats">' + stats.map(function (s) { return '<div><b>' + s[0] + "<span>" + s[1] + "</span></b><small>" + esc(s[2]) + "</small></div>"; }).join("") + "</div></header>" +
      todayStripHTML(ti) +
      '<section class="mwrap" aria-label="线网图"><div class="mscroll"><div class="minner" id="minner">' + metroSVG(ti) + '<div class="mpop" id="mpop" role="dialog" aria-label="站点详情" hidden></div></div></div>' +
      '<p class="meta mhint">点任意一站、线名牌或换乘站看详情；屏幕窄时可以左右拖动地图。</p></section>' +
      GOALS.map(goalSecHTML).join("") +
      '<div class="hgrid">' + landmarkPanel() +
      '<section class="panel rules-p" aria-labelledby="ru-h"><h2 id="ru-h">运行规则</h2><ol class="rules-l">' +
      "<li>两种线：目标线是自己定的能力目标，按估算小时排站；自选线是单独挑出来学的一门课或一本书，一课一站。</li>" +
      "<li>进度看小时：每晚打卡说学了哪几课、多少分钟，目标线上的小时数自动累加。</li>" +
      "<li>到站要检验：学够小时不算到站，过了这一站的检验才算。检验做完告诉我，我记进研习录。</li>" +
      "<li>没有晚点：路线单只是建议，没学完不记欠账，下次从停下的那一课接着学。</li>" +
      "<li>出发前选今天学多少：保底只学电影一段，标准按路线单，多学在目标线上再加一课。</li>" +
      "<li>电影线每天一段，周日回看本周 6 段；周日的周复盘在足迹里记一个“检”。</li>" +
      "<li>晚上 9 点打卡、盖章。没打卡，位置原地不动。</li></ol></section></div></div>";
  }

  /* ---------- 站点详情 ---------- */
  function freeStopPopHTML(lid, i) {
    var f = freeLine(lid), stops = f ? freeStops(f) : [], s = stops[i]; if (!s) return "";
    var stTxt = { done: "已学完", cur: "下一站", todo: "还没到" }[s.state];
    var sl = f.subj ? todayInfo().slots.filter(function (x) { return x.subj === f.subj; })[0] : null;
    if (s.state === "cur" && sl && sl.index === i) stTxt += " · 今天要学";
    var links = [], extra = "";
    if (f.subj === "film") links.push('<a class="btn small" href="#c-film" data-act="film-go" data-seg="' + i + '">在跟读播放器里打开</a>');
    else if (f.subj && PLAN.lessons[f.subj]) {
      if (isWritten(f.subj) && i < issuedN(f.subj)) links.push('<a class="btn small" href="#l-' + lessonKey(f.subj, i) + '">打开讲义</a>');
      else if (isWritten(f.subj)) extra = '<p class="mp-s">讲义在排到这一课的那天早上写好。</p>';
      links.push('<a class="btn small ghost" href="#c-' + f.subj + '">全部课程</a>');
    }
    if (f.id === "geo" && i < 20) {
      var ch = Math.floor(i / 2) + 1, tb = LIB.books.tragedy;
      if (tb) links.push(tb.deep && tb.deep[ch] ? '<a class="btn small ghost" href="#r-tragedy-' + ch + '">第' + CN[ch] + "章精读稿</a>" : '<button type="button" class="btn small ghost" data-act="open-ch" data-book="tragedy" data-n="' + ch + '">第' + CN[ch] + "章导读</button>");
    } else if (f.book && !f.subj) {
      var bk = LIB.books[f.book];
      if (bk.deep && bk.deep[s.n]) links.push('<a class="btn small" href="#r-' + f.book + "-" + s.n + '">精读稿</a>');
      links.push('<button type="button" class="btn small ghost" data-act="open-ch" data-book="' + f.book + '" data-n="' + s.n + '">本章导读</button>');
    }
    if (f.report) { var rp = REPORTS.filter(function (x) { return x.id === f.report; })[0]; if (rp) links.push('<a class="btn small ghost" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener">打开研习计划 ↗</a>'); }
    var uses = f.subj ? usesAt(f.subj, i) : [];
    if (uses.length) extra += '<ul class="mp-uses">' + uses.map(function (x) { return '<li><a href="' + esc(reportHref(x.rp)) + '" target="_blank" rel="noopener"><b>可用资料</b>' + esc(x.rp.title) + " ↗</a>" + (x.u[2] ? '<span class="meta">' + esc(x.u[2]) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b class="lbadge' + (DARK_INK[f.subj || f.id] ? " dk" : "") + '" style="--c:var(' + f.color + ')">' + esc(freeName(f)) + '</b><span class="mp-pos">自选线 · 第 ' + (i + 1) + " / " + stops.length + " 站</span></div>" +
      '<p class="mp-t">' + esc(s.title) + '</p><p class="mp-s">' + esc(stTxt) + "</p>" + extra + (links.length ? '<div class="btns">' + links.join("") + "</div>" : "");
  }
  function goalStopPopHTML(gid, i) {
    var g = GOAL[gid], x = g && goalStations(g)[i]; if (!x) return "";
    var links = [], st = x.st;
    if (st.subj && PLAN.lessons[st.subj]) {
      var nx = curStudy().next[st.subj] || 0, list = lessonList(st.subj);
      if (st.lessons && (nx < st.lessons[0] || nx >= st.lessons[1])) nx = -1;
      if (nx >= 0 && nx < list.length && isWritten(st.subj) && nx < issuedN(st.subj)) links.push('<a class="btn small" href="#l-' + lessonKey(st.subj, nx) + '">下一课：第 ' + (nx + 1) + " 课</a>");
      links.push('<a class="btn small ghost" href="#c-' + st.subj + '">' + esc(subjName(st.subj)) + " 全部课程</a>");
    }
    if (st.item && ITEMS[st.item]) links.push('<a class="btn small ghost" href="#t-' + ITEMS[st.item].tracks[0] + '">在书架上看</a>');
    var lessonNote = st.lessons ? '<p class="mp-s">课表里的第 ' + (st.lessons[0] + 1) + "—" + st.lessons[1] + " 课。</p>" : "";
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b class="lbadge" style="--c:var(' + g.color + ')">' + esc(g.name) + '</b><span class="mp-pos">目标线 · 第 ' + (i + 1) + " / " + g.stations.length + " 站</span></div>" +
      '<p class="mp-t">' + esc(st.name) + '</p><p class="mp-s">约 ' + st.hours + " 小时 · 已学 " + (Math.round(x.done * 10) / 10) + " 小时 · " + stateText(x.state) + (x.passed ? "（" + esc(x.passed) + "）" : "") + "</p>" +
      '<dl class="mp-dl"><dt>学什么</dt><dd>' + esc(st.learn || "") + "</dd><dt>过站检验</dt><dd>" + esc(st.check || "") + "</dd></dl>" + lessonNote +
      (links.length ? '<div class="btns">' + links.join("") + "</div>" : "");
  }
  function usesAt(subj, i) {
    var out = [];
    REPORTS.forEach(function (rp) { (rp.uses || []).forEach(function (u) { if (u[0] === subj && u[1] === i) out.push({ rp: rp, u: u }); }); });
    return out;
  }
  function landmarkPopHTML(rid) {
    if (/^t:/.test(rid)) {
      var tp = TOPIC[rid.slice(2)]; if (!tp) return "";
      return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b>研究课题 · ' + esc(tp.title) + '</b><span class="mp-pos">' + esc(topicNo(tp)) + (TP_STATUS[tp.status] ? " · " + TP_STATUS[tp.status] : "") + "</span></div>" +
        (tp.question ? '<p class="mp-t" style="font-size:15px">' + esc(tp.question) + "</p>" : "") + (tp.answer ? '<p class="mp-s">' + esc(tp.answer) + "</p>" : "") +
        "<ul>" + topicItems(tp).map(function (rp, i) { return '<li><a class="linkrow" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><b class="lbadge" style="--c:var(' + KINDS[reportKind(rp)] + ')">' + pad2(i + 1) + " " + reportKind(rp) + "</b> " + esc(rp.title) + " ↗</a></li>"; }).join("") + "</ul>" +
        '<div class="btns"><button type="button" class="btn small" data-act="abox-go" data-t="' + esc(tp.id) + '">打开档案盒</button></div>';
    }
    var rp = REPORTS.filter(function (x) { return x.id === rid; })[0]; if (!rp) return "";
    var tr = (rp.tracks || []).map(function (x) { return TRACK[x] ? '<a href="#t-' + x + '">' + esc(TRACK[x].short) + "</a>" : ""; }).filter(Boolean).join("、");
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b>地标 · ' + esc(rp.title) + '</b></div>' +
      (rp.question ? '<p class="mp-t" style="font-size:15px">' + esc(rp.question) + "</p>" : "") + '<p class="mp-s">' + esc(rp.desc) + "</p>" +
      '<div class="mp-rel">' + (tr ? '<span class="rrel"><b>归属</b>' + tr + "</span>" : "") + reportRel(rp, false) + "</div>" +
      '<div class="btns"><a class="btn small" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener">打开专题 ↗</a></div>';
  }
  function hubEndName(a) {
    if (a[0] === "cfa" || GOAL[a[0]]) { var g = GOAL[a[0]]; return { name: g.name, col: g.color, title: g.stations[a[1]].name, act: 'data-act="mgs" data-g="' + a[0] + '" data-i="' + a[1] + '"' }; }
    var f = freeLine(a[0]);
    if (f) { var s = freeStops(f)[a[1]]; return { name: freeName(f), col: f.color, title: s ? s.title : "", act: 'data-act="mst" data-l="' + a[0] + '" data-i="' + a[1] + '"' }; }
    var list = lessonList(a[0]), x = list[a[1]];
    return { name: subjName(a[0]), col: LINE_COLOR[a[0]] || "--ln-rev", title: "第 " + (a[1] + 1) + " 课 " + (x ? x.title : ""), href: isWritten(a[0]) && a[1] < issuedN(a[0]) ? "#l-" + lessonKey(a[0], a[1]) : "#c-" + a[0] };
  }
  function hubPopHTML(k) {
    var hb = M.hubs[k];
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b>换乘站 · ' + esc(hb.name) + '</b></div><p class="mp-s" style="margin-top:6px">' + esc(hb.sub) + "</p><ul>" +
      hb.at.map(function (a) {
        var e = hubEndName(a), inner = '<b class="lbadge" style="--c:var(' + e.col + ')">' + esc(e.name) + "</b> " + esc(e.title);
        return "<li>" + (e.href ? '<a class="linkrow" href="' + e.href + '">' + inner + "</a>" : '<button type="button" class="linkrow" ' + e.act + ">" + inner + "</button>") + "</li>";
      }).join("") + "</ul>";
  }
  function openPop(html, x, y) {
    var inner = document.getElementById("minner"), pop = document.getElementById("mpop");
    if (!inner || !pop || !html) return;
    var sc = inner.clientWidth / M.w;
    pop.innerHTML = html; pop.hidden = false;
    var px = x * sc, py = y * sc, pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(8, px - pw / 2), inner.clientWidth - pw - 8), top = py + 18;
    if (top + ph > inner.clientHeight - 8) top = py - ph - 18;
    pop.style.left = left + "px"; pop.style.top = Math.max(8, top) + "px";
    var f = pop.querySelector("a,button:not(.mp-x)") || pop.querySelector(".mp-x"); if (f) f.focus({ preventScroll: true });
  }
  function closePop() { var pop = document.getElementById("mpop"); if (pop && !pop.hidden) { pop.hidden = true; pop.innerHTML = ""; } }
  function openStation(lid, i) { var p = POS["f:" + lid + ":" + i]; if (p) openPop(freeStopPopHTML(lid, i), p[0], p[1]); }
  function openGoalStop(gid, i) {
    var p = POS["g:" + gid + ":" + i];
    if (p && document.getElementById("minner")) { openPop(goalStopPopHTML(gid, i), p[0], p[1]); var m = document.getElementById("minner"); if (m) m.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  }
  function openHub(k) { var p = POS["h:" + k]; if (p) openPop(hubPopHTML(k), p[0], p[1]); }
  function openLandmark(rid) { var p = POS["l:" + rid]; if (p) openPop(landmarkPopHTML(rid), p[0], p[1]); }

  /* ---------- 课程页：一条线一个页面 ---------- */
  function courseHTML(subj) {
    var STUDY = curStudy(), list = lessonList(subj), nx = Math.min(STUDY.next[subj] || 0, list.length), t = bjToday();
    var col = LINE_COLOR[subj] || "--ln-rev", info = PLAN.subjects[subj] || {};
    var fresh = !sinceOk(subj, t), film = subj === "film", gl = GOAL[GOAL_OF[subj]];
    var pill = fresh ? '<span class="pill free">' + cnDate(PLAN.since[subj]) + "开始</span>"
      : gl ? '<a class="pill" href="#g-' + gl.id + '">' + esc(gl.name) + " · 目标线</a>" : '<span class="pill free">自选线</span>';
    var est = subjEstMin(subj);
    pill += '<span><b>' + hrs(subjMin(subj)) + "</b>" + (est && !gl ? "/ 约 " + Math.round(est / 60) + " " : "") + "小时已学</span>";
    var unit = film ? "段" : "课";
    var head = '<header><p class="eyebrow"><a href="#home">线网</a> · ' + (gl ? esc(gl.name) + " · " : "") + '课程</p><h1 class="ctitle"><span class="cbar" style="--c:var(' + col + ')" aria-hidden="true"></span>' + esc(info.name || subj) + (film ? "《" + esc(info.film) + "》" : "") + "</h1>" +
      '<p class="lede">' + esc(info.why || "") + "</p>" +
      '<div class="stats"><span><b>' + nx + "</b>/ " + list.length + " " + unit + "已学</span>" + pill + (fresh ? "" : '<span>下次：' + esc(nextWhen(subj) || "—") + "</span>") + "</div></header>";
    if (film) return '<div class="view wide course">' + bannerHTML() + head + '<div id="film-slot"></div>' + filmSegsHTML() + filmNotesHTML() + "</div>";
    var iss = issuedN(subj), cur = nx < list.length ? list[nx] : null;
    var now = cur ? '<section class="cnow" style="--c:var(' + col + ')"><p class="eyebrow">下一课 · 第 ' + (nx + 1) + " / " + list.length + " 课</p><h2>" + esc(cur.title) + "</h2>" +
      (isWritten(subj) && nx < iss ? '<div class="btns"><a class="btn" href="#l-' + lessonKey(subj, nx) + '">打开讲义</a></div>' : '<p class="meta">讲义在排到这一课的那天早上 ' + PLAN.push + " 写好。下次上这门课：" + esc(nextWhen(subj) || "—") + "。</p>") + "</section>"
      : '<section class="cnow"><h2>本阶段已学完</h2></section>';
    var rows = [], lastCode = "";
    list.forEach(function (x, i) {
      if (x.code && x.code !== lastCode) { lastCode = x.code; rows.push('<li class="cmod">' + esc(x.code) + " · " + esc(x.title.replace(/^\S+\s/, "").replace(/（\d+\/\d+）$/, "")) + (x.en ? '<span class="meta">' + esc(x.en) + "</span>" : "") + "</li>"); }
      var stt = i < nx ? ["done", "学完"] : i === nx ? ["cur", "下一课"] : ["todo", ""];
      var open = isWritten(subj) && i < iss, uses = usesAt(subj, i);
      var hubs = (M ? M.hubs : []).filter(function (hb) { return hb.at.some(function (a) { return a[0] === subj && a[1] === i; }); });
      rows.push('<li class="crow ' + stt[0] + '"><span class="cnum">' + pad2(i + 1) + "</span>" + (open ? '<a class="ct" href="#l-' + lessonKey(subj, i) + '">' + esc(x.title) + "</a>" : '<span class="ct">' + esc(x.title) + "</span>") +
        '<span class="cs">' + (stt[1] ? '<span class="lst ' + stt[0] + '">' + stt[1] + "</span>" : "") + (hubs.length ? '<span class="ctag">换乘 · ' + esc(hubs.map(function (h) { return h.name; }).join("、")) + "</span>" : "") +
        (uses.length ? '<span class="ctag">资料 · ' + esc(uses.map(function (u) { return u.rp.title; }).join("、")) + "</span>" : "") + "</span></li>");
    });
    var hubList = (M ? M.hubs : []).filter(function (hb) { return hb.at.some(function (a) { return a[0] === subj; }); });
    var hubSec = hubList.length ? '<section><h2>换乘站</h2><ul class="clinks">' + hubList.map(function (hb) { return "<li><b>" + esc(hb.name) + "</b>" + esc(hb.sub) + "</li>"; }).join("") + "</ul></section>" : "";
    var useSec = [];
    REPORTS.forEach(function (rp) { (rp.uses || []).forEach(function (u) { if (u[0] === subj) useSec.push('<li><a href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><b>' + esc(rp.title) + " ↗</b></a>第 " + (u[1] + 1) + " 课用得上：" + esc(u[2] || "") + "</li>"); }); });
    return '<div class="view course">' + bannerHTML() + head + now +
      '<section><h2>全部课程</h2><p class="meta">讲义一课一个文件。点亮的课可以打开；没写的课，排到那天早上写好。</p><ol class="clist">' + rows.join("") + "</ol></section>" +
      hubSec + (useSec.length ? '<section><h2>可用资料</h2><ul class="clinks">' + useSec.join("") + "</ul></section>" : "") + "</div>";
  }

  /* ---------- 电影跟读播放器 ----------
   * 片源和字幕都是你自己的文件，只在浏览器里打开，不上传；页面只记“第几段、第几句已背熟”（序号，不存台词）。
   * 字幕按台词数分成 36 段，切点落在附近最长的停顿上，所以每段大致是一场戏。 */
  var FILM_SEGS = 36;
  var FILM = { root: null, video: null, seg: null, cur: -1, shown: -2, mode: "show", speed: 1, rep: 1, gap: false,
    cues: null, segs: null, subName: "", mediaName: "", mediaUrl: "", isAudio: false, err: "",
    raf: 0, timer: 0, stopAt: null, left: 0, chain: false, after: null, peek: {}, explain: {}, recUrl: {}, recording: -1, noMic: false, sample: undefined };
  var FILM_STEPS = [
    { t: "复习旧段", m: 10, d: "前一段、三天前、七天前的那段各放一遍，不开字幕，跟着小声说。", mode: "hide", rep: 1, gap: false, old: true },
    { t: "盲听", m: 10, d: "不开字幕把今天这段完整看两遍，只抓大意：谁、在哪、为了什么。", mode: "hide", rep: 1, gap: false, whole: true },
    { t: "精听", m: 25, d: "开字幕逐句听。听不出的句子放慢到 0.75、每句重复 3 遍；生词和连读记下来，看不懂的点“讲”。", mode: "show", rep: 3, gap: false },
    { t: "跟读", m: 20, d: "打开“跟读停顿”，每句播完停一下，跟着说；点“录”把自己的声音和原声对比。", mode: "show", rep: 1, gap: true },
    { t: "背诵", m: 20, d: "字幕换成中文提示（没有中文就用首字母），再全部遮住，逐句说出来。说得出的句子点“熟”。", mode: "zh", rep: 1, gap: true },
    { t: "回放", m: 5, d: "不开字幕把整段再看一遍，影子跟读：比原声慢半拍，一直跟着说。", mode: "hide", rep: 1, gap: false, whole: true }
  ];
  var FILM_REVIEW = [
    { t: "连看", m: 30, d: "不开字幕，把本周学过的几段连起来看两遍。", mode: "hide", rep: 1, gap: false, week: true },
    { t: "补背", m: 40, d: "逐段翻一遍，挑还没点“熟”的句子，先首字母、再遮住，说到能脱口而出。", mode: "initials", rep: 1, gap: true },
    { t: "复述", m: 20, d: "不看画面，用英文把本周的情节讲一遍；说不出的地方用中文补上，记下来周一再练。", mode: "hide", rep: 1, gap: false }
  ];
  var FILM_MODES = [["show", "原文"], ["zh", "中文提示"], ["initials", "首字母"], ["hide", "遮住"]];

  function tsec(x) { var p = x.replace(",", ".").split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  function mmss(x) { x = Math.max(0, Math.floor(x)); var h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s2 = x % 60; return (h ? h + ":" + pad2(m) : m) + ":" + pad2(s2); }
  function filmParse(text) {
    text = String(text || "").replace(/\r/g, "").replace(/^﻿/, "");
    var re = /((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/, out = [];
    text.split(/\n[ \t]*\n/).forEach(function (b) {
      var lines = b.split("\n"), k = -1;
      for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) { k = i; break; }
      if (k < 0) return;
      var m = re.exec(lines[k]), en = [], zh = [];
      lines.slice(k + 1).forEach(function (l) {
        l = l.replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\\N/g, " ").trim();
        if (l) (/[㐀-鿿]/.test(l) ? zh : en).push(l);
      });
      var e = en.join(" ").replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
      if (!/[A-Za-z]/.test(e.replace(/\([^)]*\)|♪|#/g, ""))) return;
      out.push({ s: tsec(m[1]), e: tsec(m[2]), en: e, zh: zh.join(" ") });
    });
    out.sort(function (a, b) { return a.s - b.s; });
    return out;
  }
  function filmSegments(cues) {
    var n = cues.length, per = n / FILM_SEGS, w = Math.max(1, Math.floor(per * 0.3)), b = [0], k;
    for (k = 1; k < FILM_SEGS; k++) {
      var t = Math.round(k * per), best = Math.max(t, b[k - 1] + 1), gap = -1;
      for (var j = Math.max(b[k - 1] + 1, t - w); j <= Math.min(n - 1, t + w); j++) { var g = cues[j].s - cues[j - 1].e; if (g > gap) { gap = g; best = j; } }
      b.push(Math.min(best, n));
    }
    b.push(n);
    var segs = [];
    for (k = 0; k < FILM_SEGS; k++) segs.push({ a: b[k], z: Math.max(b[k], b[k + 1]) });
    return segs;
  }
  function filmSetSubs(txt, name, restoring) {
    var cues = filmParse(txt);
    if (cues.length < FILM_SEGS * 3) { FILM.err = "字幕「" + name + "」里只读到 " + cues.length + " 句英文台词。请换一个英文字幕或中英双语字幕（.srt 或 .vtt）。"; filmPaint(); return; }
    FILM.cues = cues; FILM.segs = filmSegments(cues); FILM.subName = name; FILM.err = ""; FILM.cur = -1; FILM.explain = {}; FILM.peek = {};
    if (!restoring) { try { localStorage.setItem("yanxilu-film-subs", JSON.stringify({ name: name, txt: txt })); } catch (e) { /* 存不下就每次重新选 */ } }
    filmPaint();
  }
  function filmLoad(files) {
    [].forEach.call(files || [], function (f) {
      var nm = f.name.toLowerCase();
      if (/\.(srt|vtt|txt)$/.test(nm)) {
        var rd = new FileReader();
        rd.onload = function () {
          var txt = String(rd.result);
          if ((txt.match(/\uFFFD/g) || []).length > 20) { var r2 = new FileReader(); r2.onload = function () { filmSetSubs(String(r2.result), f.name); }; r2.readAsText(f, "gb18030"); return; }
          filmSetSubs(txt, f.name);
        };
        rd.readAsText(f, "utf-8");
      } else if (/^(video|audio)\//.test(f.type) || /\.(mp4|m4v|mov|webm|mkv|mp3|m4a|aac|wav|ogg)$/.test(nm)) {
        if (FILM.mediaUrl) URL.revokeObjectURL(FILM.mediaUrl);
        FILM.mediaUrl = URL.createObjectURL(f); FILM.mediaName = f.name; FILM.err = "";
        FILM.isAudio = /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg)$/.test(nm);
        var v = filmVideo(); v.src = FILM.mediaUrl; v.load();
        filmPaint();
      } else toast("认不出「" + f.name + "」：片源用 MP4 等视频或 MP3 等音频，字幕用 .srt 或 .vtt");
    });
  }
  function filmVideo() {
    if (FILM.video) return FILM.video;
    var v = document.createElement("video");
    v.setAttribute("playsinline", ""); v.preload = "auto";
    v.addEventListener("error", function () { if (!FILM.mediaUrl) return; FILM.err = "这个文件播放不了。常见原因：格式浏览器不支持（MKV、AVI 先转成 MP4），或者当前页面不允许播放本地文件（换到 GitHub 公开版打开：cnyanghai.github.io/yanxilu/#c-film）。"; filmPaint(); });
    v.addEventListener("play", function () { filmTick(); filmPlayBtn(); });
    v.addEventListener("pause", filmPlayBtn);
    FILM.video = v;
    return v;
  }
  function filmBuild() {
    var r = document.createElement("div");
    r.className = "fp";
    r.innerHTML = '<div class="fp-main"><div class="fp-screen" id="fp-screen"><div class="fp-ph" id="fp-ph"></div><div class="fp-sub" id="fp-sub"></div></div><div id="fp-panel"></div></div><div class="fp-side" id="fp-body"></div>';
    r.querySelector("#fp-screen").insertBefore(filmVideo(), r.querySelector("#fp-sub"));
    FILM.root = r;
    try { var c = JSON.parse(localStorage.getItem("yanxilu-film-subs") || "null"); if (c && c.txt) filmSetSubs(c.txt, c.name, true); } catch (e) { /* 没有缓存 */ }
  }
  function filmMount() {
    var slot = document.getElementById("film-slot");
    if (!slot) { if (FILM.video && !FILM.video.paused) FILM.video.pause(); return; }
    if (!FILM.root) filmBuild();
    slot.appendChild(FILM.root);
    filmPaint();
  }
  function filmToday() {
    var STUDY = curStudy(), ti = PLAN ? todayInfo() : { slots: [] }, sl = ti.slots.filter(function (s) { return s.subj === "film"; })[0];
    return { next: Math.min(STUDY.next.film || 0, FILM_SEGS - 1), review: !!(sl && sl.review), today: !!sl };
  }
  function filmSeg() { if (FILM.seg == null) { var td = filmToday(); FILM.seg = td.review ? Math.max(0, td.next - 1) : td.next; } return FILM.seg; }
  function filmKnown(k) { var d2 = S.data.film && S.data.film["seg-" + pad2(k + 1)]; return (d2 && d2.known) || []; }
  function filmText(c, mode, i) {
    if (mode === "show" || FILM.peek[i]) return esc(c.en);
    if (mode === "zh") return c.zh ? '<span class="fz">' + esc(c.zh) + "</span>" : filmInitials(c.en);
    if (mode === "initials") return filmInitials(c.en);
    return '<span class="fh">· · ·</span>';
  }
  function filmInitials(x) { return esc(x.replace(/[A-Za-z][A-Za-z']*/g, function (w) { return w[0] + w.slice(1).replace(/[A-Za-z']/g, "_"); })); }

  function filmPaint() {
    if (!FILM.root || !FILM.root.parentNode) return;
    var panel = FILM.root.querySelector("#fp-panel"), body = FILM.root.querySelector("#fp-body"), screen = FILM.root.querySelector("#fp-screen"), ph = FILM.root.querySelector("#fp-ph");
    screen.className = "fp-screen" + (!FILM.mediaUrl ? " nomedia" : FILM.isAudio ? " audio" : "");
    ph.innerHTML = !FILM.mediaUrl ? "<b>选好片源，画面在这里</b><span>只有字幕也能先读台词</span>" : FILM.isAudio ? "<b>" + esc(FILM.mediaName) + "</b><span>音频</span>" : "";
    var picker = '<label class="btn' + (FILM.cues && FILM.mediaUrl ? " ghost small" : "") + ' fp-pick"><input type="file" id="fp-file" multiple accept="video/*,audio/*,.srt,.vtt,.mkv,.m4v,.mov">' + (FILM.cues && FILM.mediaUrl ? "换文件" : "选择片源和字幕") + "</label>";
    var err = FILM.err ? '<p class="fp-err" role="alert">' + esc(FILM.err) + "</p>" : "";
    if (!FILM.cues) {
      panel.innerHTML = '<div class="fp-load">' + picker + '<p class="meta">一次选两个文件：电影的视频（或音频）和英文字幕（.srt / .vtt；中英双语字幕更好，背诵时能看中文提示）。' +
        (FILM.mediaUrl ? "已选片源：" + esc(FILM.mediaName) + "，还差字幕。" : "") + "文件只在你的浏览器里打开，不上传，也不会进公开仓库。</p>" + err + "</div>";
      body.innerHTML = filmStepsHTML();
      return;
    }
    var k = filmSeg(), sg = FILM.segs[k], cues = FILM.cues, td = filmToday(), known = filmKnown(k);
    var t0 = sg.z > sg.a ? cues[sg.a].s : 0, t1 = sg.z > sg.a ? cues[sg.z - 1].e : 0;
    var seg = '<div class="fp-seg"><button type="button" class="fp-nav" data-act="fp-seg" data-d="-1" aria-label="上一段"' + (k === 0 ? " disabled" : "") + '>‹</button>' +
      '<div class="fp-segt"><b>第 ' + (k + 1) + " 段</b>" + (k === td.next && td.today && !td.review ? '<span class="lst cur">今天</span>' : k < (curStudy().next.film || 0) ? '<span class="lst done">学完</span>' : "") +
      '<span class="meta">' + mmss(t0) + "–" + mmss(t1) + " · " + (sg.z - sg.a) + " 句 · 熟 " + known.length + "</span></div>" +
      '<button type="button" class="fp-nav" data-act="fp-seg" data-d="1" aria-label="下一段"' + (k === FILM_SEGS - 1 ? " disabled" : "") + ">›</button></div>";
    function seg2(name, label, opts, val) {
      return '<div class="fp-ctl"><span class="fp-lab">' + label + '</span><div class="seg" role="group" aria-label="' + label + '">' + opts.map(function (o) {
        return '<button type="button" data-act="fp-set" data-k="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (String(val) === String(o[0])) + '">' + o[1] + "</button>";
      }).join("") + "</div></div>";
    }
    panel.innerHTML = seg +
      '<div class="fp-play"><button type="button" class="btn" id="fp-pp" data-act="fp-whole">' + (FILM.video && !FILM.video.paused ? "暂停" : "▶ 播放这一段") + "</button>" + picker + "</div>" + err +
      '<div class="fp-ctls">' + seg2("mode", "字幕", FILM_MODES, FILM.mode) + seg2("speed", "速度", [[0.75, "0.75"], [0.9, "0.9"], [1, "1.0"]], FILM.speed) +
      seg2("rep", "每句", [[1, "1 遍"], [3, "3 遍"], [5, "5 遍"]], FILM.rep) + seg2("gap", "跟读停顿", [["0", "关"], ["1", "开"]], FILM.gap ? "1" : "0") + "</div>" +
      '<p class="meta fp-keys">空格 播放 / 暂停 · ← → 上一句 / 下一句 · R 重听 · H 换字幕 · K 标“熟”' + (FILM.subName ? " · 字幕：" + esc(FILM.subName) : "") + "</p>";
    var rows = [];
    for (var i = sg.a; i < sg.z; i++) {
      var c = cues[i], kn = known.indexOf(i - sg.a) >= 0, ex = FILM.explain[i];
      rows.push('<li class="fc' + (i === FILM.shown ? " on" : "") + (kn ? " kn" : "") + '" id="fc-' + i + '"><span class="fc-n">' + (i - sg.a + 1) + "</span>" +
        '<button type="button" class="fc-tx" data-act="fp-peek" data-i="' + i + '" title="点一下看原文">' + filmText(c, FILM.mode, i) + "</button>" +
        '<span class="fc-b"><button type="button" data-act="fp-cue" data-i="' + i + '" aria-label="听这一句">听</button>' +
        (FILM.noMic ? "" : '<button type="button" data-act="fp-rec" data-i="' + i + '"' + (FILM.recording === i ? ' class="rec"' : "") + ' aria-label="录音跟读这一句">' + (FILM.recording === i ? "录音中" : "录") + "</button>") +
        (FILM.recUrl[i] ? '<button type="button" data-act="fp-mine" data-i="' + i + '" aria-label="放我的录音">我的</button>' : "") +
        '<button type="button" data-act="fp-known" data-i="' + i + '" aria-pressed="' + kn + '" aria-label="标记这一句背熟了">熟</button>' +
        '<button type="button" data-act="fp-ex" data-i="' + i + '" aria-label="讲解这一句">讲</button></span>' +
        (ex ? '<div class="fc-ex" id="fx-' + i + '">' + esc(ex.text || (ex.busy ? "Claude 正在看这句……" : "")) + (ex.err ? '<span class="fp-err">' + esc(ex.err) + "</span>" : "") + "</div>" : "") + "</li>");
    }
    body.innerHTML = filmStepsHTML() + '<ol class="fcues" aria-label="第 ' + (k + 1) + ' 段台词">' + rows.join("") + "</ol>";
    filmShowCue(FILM.shown, true);
  }
  function filmStepsHTML() {
    var td = filmToday(), steps = td.review ? FILM_REVIEW : FILM_STEPS, nx = td.next;
    var old = [1, 3, 7].map(function (b) { return nx - b; }).filter(function (x, i, a) { return x >= 0 && a.indexOf(x) === i; });
    return '<div class="fsteps"><p class="eyebrow">' + (td.review ? "周日 · 本周复习，90 分钟" : "每天一段 · 90 分钟") + '</p><ol>' + steps.map(function (st, i) {
      var extra = "";
      if (st.old && FILM.cues) extra = old.length ? '<span class="fs-x">' + old.map(function (x) { return '<button type="button" class="btn small ghost" data-act="fp-play-seg" data-k="' + x + '">第 ' + (x + 1) + " 段</button>"; }).join("") + "</span>" : '<span class="fs-x meta">还没有学过的段落，今天跳过这一步。</span>';
      if (st.week && FILM.cues && nx > 0) extra = '<span class="fs-x"><button type="button" class="btn small ghost" data-act="fp-play-week">连播第 ' + (Math.max(0, nx - 6) + 1) + "—" + nx + " 段</button></span>";
      return '<li><button type="button" class="fs-b" data-act="fp-step" data-s="' + i + '"><b>' + esc(st.t) + '</b><span class="fs-m">' + st.m + "′</span></button><span class=\"fs-d\">" + esc(st.d) + "</span>" + extra + "</li>";
    }).join("") + "</ol></div>";
  }
  function filmPlayBtn() { var b = FILM.root && FILM.root.querySelector("#fp-pp"); if (b) b.textContent = FILM.video && !FILM.video.paused ? "暂停" : "▶ 播放这一段"; }
  function filmCueAt(tm) {
    var cues = FILM.cues; if (!cues) return -1;
    var lo = 0, hi = cues.length - 1, ans = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (cues[mid].s <= tm) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans >= 0 && tm <= cues[ans].e + 0.25 ? ans : -1;
  }
  function filmShowCue(i, quiet) {
    FILM.shown = i;
    if (!FILM.root) return;
    var sub = FILM.root.querySelector("#fp-sub"), c = FILM.cues && FILM.cues[i];
    sub.innerHTML = c ? filmText(c, FILM.mode, i) : "";
    var prev = FILM.root.querySelector(".fc.on"); if (prev && prev.id !== "fc-" + i) prev.classList.remove("on");
    var row = FILM.root.querySelector("#fc-" + i);
    if (row) { row.classList.add("on"); if (!quiet && row.scrollIntoView) row.scrollIntoView({ block: "nearest" }); }
  }
  function filmClear() { clearTimeout(FILM.timer); FILM.timer = 0; FILM.stopAt = null; FILM.left = 0; FILM.chain = false; FILM.after = null; }
  function filmGapMs(i) { var c = FILM.cues[i]; return c ? Math.min(9000, ((c.e - c.s) / FILM.speed * 1.2 + 0.6) * 1000) : 800; }
  function filmPlayCue(i, opt) {
    opt = opt || {};
    var c = FILM.cues && FILM.cues[i], v = filmVideo();
    if (!c) return;
    if (!FILM.mediaUrl) { filmShowCue(i); toast("还没选片源：先读台词，选好片源就能听"); return; }
    clearTimeout(FILM.timer);
    FILM.cur = i; FILM.left = (opt.rep || FILM.rep) - 1; FILM.chain = !!opt.chain; FILM.after = opt.after || null;
    FILM.stopAt = c.e + 0.12;
    v.playbackRate = FILM.speed;
    v.currentTime = Math.max(0, c.s - 0.08);
    filmShowCue(i);
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* 被浏览器拦下时等用户再点 */ });
  }
  function filmPlayRange(a, z) {
    var v = filmVideo(); if (!FILM.mediaUrl) { toast("还没选片源"); return; }
    filmClear(); FILM.cur = -1; FILM.stopAt = z + 0.2; v.playbackRate = FILM.speed; v.currentTime = Math.max(0, a - 0.1);
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  function filmPlaySeg(k) { var sg = FILM.segs && FILM.segs[k]; if (sg && sg.z > sg.a) filmPlayRange(FILM.cues[sg.a].s, FILM.cues[sg.z - 1].e); }
  function filmWhole() {
    var v = filmVideo();
    if (!v.paused) { filmClear(); v.pause(); return; }
    var sg = FILM.segs[filmSeg()]; if (!sg || sg.z <= sg.a) return;
    if (FILM.gap || FILM.rep > 1) filmPlayCue(sg.a, { chain: true });
    else filmPlayRange(FILM.cues[sg.a].s, FILM.cues[sg.z - 1].e);
  }
  function filmTick() {
    cancelAnimationFrame(FILM.raf);
    var v = FILM.video;
    (function loop() {
      if (!v || v.paused) return;
      var tm = v.currentTime, i = filmCueAt(tm);
      if (i !== FILM.shown && (i >= 0 || FILM.stopAt == null || FILM.cur < 0)) filmShowCue(i);
      if (FILM.stopAt != null && tm >= FILM.stopAt) {
        v.pause();
        var cur = FILM.cur, sg = FILM.segs && FILM.segs[filmSeg()];
        if (cur >= 0 && FILM.left > 0) { FILM.left--; FILM.timer = setTimeout(function () { v.currentTime = Math.max(0, FILM.cues[cur].s - 0.08); v.play(); }, FILM.gap ? filmGapMs(cur) : 300); return; }
        if (cur >= 0 && FILM.chain && sg && cur + 1 < sg.z) { FILM.timer = setTimeout(function () { filmPlayCue(cur + 1, { chain: true }); }, FILM.gap ? filmGapMs(cur) : 0); return; }
        var after = FILM.after; filmClear();
        if (after) after();
        return;
      }
      FILM.raf = requestAnimationFrame(loop);
    })();
  }
  function filmToggleKnown(i) {
    var k = filmSeg(), sg = FILM.segs[k], arr = filmKnown(k).slice(), off = i - sg.a, p = arr.indexOf(off);
    if (p >= 0) arr.splice(p, 1); else arr.push(off);
    arr.sort(function (a, b) { return a - b; });
    var key = "seg-" + pad2(k + 1), val = { known: arr, n: sg.z - sg.a, t: new Date().toISOString() };
    if (S.mode === "db" && !S.canEdit) { S.data.film = Object.assign({}, S.data.film); S.data.film[key] = val; toast("只读浏览，标记不会保存"); }
    else put("film", key, val);
    filmPaint();
  }
  function filmRecord(i) {
    var c = FILM.cues[i];
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { FILM.noMic = true; toast("这里用不了麦克风。录音跟读请在 GitHub 公开版里用。"); filmPaint(); return; }
    if (FILM.recording >= 0) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var rec = new MediaRecorder(stream), chunks = [];
      FILM.recording = i; filmPaint();
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        if (FILM.recUrl[i]) URL.revokeObjectURL(FILM.recUrl[i]);
        FILM.recUrl[i] = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        FILM.recording = -1; filmPaint();
        filmPlayCue(i, { rep: 1, after: function () { filmMine(i); } });
      };
      rec.start();
      setTimeout(function () { if (rec.state !== "inactive") rec.stop(); }, ((c.e - c.s) / FILM.speed * 1.4 + 1.2) * 1000);
    }, function () { FILM.noMic = true; FILM.recording = -1; toast("没拿到麦克风权限。可以在浏览器设置里允许，或换到 GitHub 公开版录音。"); filmPaint(); });
  }
  function filmMine(i) { if (FILM.recUrl[i]) { var a = new Audio(FILM.recUrl[i]); var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); } }
  var SAMPLE_ERR = { rate_limited: "问得太频繁了，过一会儿再点。", session_expired: "登录过期了，刷新页面再试。", upstream_error: "没连上，稍后再点一次。", refused: "这句没能讲解。", empty_completion: "没有得到回答，稍后再试。" };
  function filmExplain(i) {
    var c = FILM.cues[i], pv = FILM.cues[i - 1], nx = FILM.cues[i + 1];
    var prompt = "我在用电影《当幸福来敲门》（The Pursuit of Happyness，2006）练英语跟读。请用简体中文讲解“这句”台词，分四点，每点一两句，不用客套：\n" +
      "1. 意思：自然的中文翻译，必要时说明说话的场景和语气\n2. 词和短语：值得记的生词、短语、俚语\n3. 用法：语法或口语里省略、倒装等特别的地方\n4. 发音：连读、弱读、吞音和重音提示\n\n" +
      (pv ? "上一句：" + pv.en + "\n" : "") + "这句：" + c.en + "\n" + (nx ? "下一句：" + nx.en + "\n" : "");
    function fallback() { copyText(prompt, "已复制这句和讲解要求，粘贴到和 Claude 的对话里就能问"); }
    function paintEx() {
      var el = FILM.root && FILM.root.querySelector("#fx-" + i), ex = FILM.explain[i];
      if (!el) { filmPaint(); return; }
      el.innerHTML = esc(ex.text || (ex.busy ? "Claude 正在看这句……" : "")) + (ex.err ? '<span class="fp-err">' + esc(ex.err) + "</span>" : "");
    }
    function go(sample) {
      if (!sample) { fallback(); return; }
      FILM.explain[i] = { text: "", busy: true }; filmPaint();
      sample(prompt, { modelTier: "quick", onText: function (u) { FILM.explain[i] = { text: u.text, busy: true }; paintEx(); } }).then(function (r) {
        FILM.explain[i] = { text: r.text }; paintEx();
      }, function (e) {
        var code = e && e.code;
        if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].indexOf(code) >= 0) { FILM.sample = null; delete FILM.explain[i]; filmPaint(); fallback(); return; }
        FILM.explain[i] = { text: code === "refused" ? "" : (e && e.text) || "", err: code === "cancelled" ? "" : SAMPLE_ERR[code] || SAMPLE_ERR.upstream_error }; paintEx();
      });
    }
    if (!IN_ARTIFACT || FILM.sample === null) { fallback(); return; }
    if (FILM.sample) { go(FILM.sample); return; }
    window.claude.use("sample").then(function (sm) { FILM.sample = sm || null; go(FILM.sample); }, function () { FILM.sample = null; fallback(); });
  }
  function filmApplyStep(st) {
    FILM.mode = st.mode; FILM.rep = st.rep; FILM.gap = !!st.gap;
    if (st.mode === "zh" && FILM.cues && !FILM.cues.some(function (c) { return c.zh; })) FILM.mode = "initials";
    if (st.whole) { filmPaint(); filmWhole(); return; }
    if (st.week) { filmPaint(); return; }
    filmPaint();
  }
  function filmSegsHTML() {
    var nx = curStudy().next.film || 0, out = [];
    for (var k = 0; k < FILM_SEGS; k++) {
      var kn = filmKnown(k).length, d2 = S.data.film && S.data.film["seg-" + pad2(k + 1)], n = d2 && d2.n;
      if (k % 6 === 0) out.push('<div class="fwk"><span class="fseg-wk">第 ' + (k / 6 + 1) + ' 周</span><div class="fwk-b">');
      out.push('<button type="button" class="fseg' + (k < nx ? " done" : k === nx ? " cur" : "") + '" data-act="film-go" data-seg="' + k + '" title="第 ' + (k + 1) + " 段" + (n ? " · 熟 " + kn + " / " + n : "") + '"><b>' + (k + 1) + "</b>" +
        (n ? '<span class="fseg-bar"><i style="width:' + Math.round(kn / n * 100) + '%"></i></span>' : "") + "</button>");
      if (k % 6 === 5) out.push("</div></div>");
    }
    return '<section><h2>36 段</h2><p class="meta">每天一段，6 天一周，周日复习。实心是学完的段，黑框是下一段；条是这一段背熟的句数。</p><div class="fsegs">' + out.join("") + "</div></section>";
  }
  function filmNotesHTML() {
    return '<section><h2>怎么准备</h2><ul class="plain">' +
      "<li>片源：用你自己合法获得的《当幸福来敲门》视频文件，MP4 最稳；只有音频（MP3）也能练听和跟读。</li>" +
      "<li>字幕：英文字幕或中英双语字幕，.srt 或 .vtt。双语字幕的中文会用在“背诵”这一步当提示。</li>" +
      "<li>两个文件一起选。字幕会记在这个浏览器里，下次只要重新选片源；片源每次都要重新选，这是浏览器的安全限制。</li>" +
      "<li>文件只在你的浏览器里打开，不会上传。研习录只记“第几段第几句背熟了”，不存台词。</li>" +
      "<li>如果在这里播放不了本地视频，换到 GitHub 公开版的同一页面：cnyanghai.github.io/yanxilu/#c-film（录音跟读也只在那里能用）。</li>" +
      "<li>晚上打卡时说一句“电影第几段学完了”，地图上的电影线就往前走一站。</li></ul></section>";
  }

  /* ---------- 主渲染 ---------- */
  var ROUTES = { home: 1, shelf: 1, archive: 1, journal: 1 };
  COURSES.forEach(function (k) { ROUTES["c-" + k] = 1; });
  LIB.tracks.forEach(function (t) { ROUTES["t-" + t.id] = 1; });
  Object.keys(LIB.books).forEach(function (b) {
    ROUTES["b-" + b] = 1;
    Object.keys(LIB.books[b].deep || {}).forEach(function (n) { ROUTES["r-" + b + "-" + n] = 1; });
  });
  function readHash() { var h = (location.hash || "").slice(1); return ROUTES[h] || (PLAN && /^l-(\d{4}-\d{2}-\d{2}|[a-z]+-\d{2})$/.test(h)) ? h : "home"; }

  function render(scrollTop) {
    $("#rail").innerHTML = railHTML();
    var r = S.route, html, rm = /^r-(.+)-(\d+)$/.exec(r);
    if (rm) html = readerHTML(rm[1], +rm[2]);
    else if (r.indexOf("t-") === 0) html = trackHTML(r.slice(2));
    else if (r.indexOf("b-") === 0) html = bookHTML(r.slice(2));
    else if (r === "journal") html = journalHTML();
    else if (/^l-/.test(r)) html = lessonHTML(r.slice(2));
    else if (/^c-/.test(r)) html = courseHTML(r.slice(2));
    else if (r === "shelf") html = shelfHTML();
    else if (r === "archive") html = archiveHTML();
    else html = homeHTML();
    if (FILM.root && FILM.root.parentNode) FILM.root.parentNode.removeChild(FILM.root);
    $("#main").innerHTML = html;
    filmMount();
    if (scrollTop) window.scrollTo(0, 0);
    if (S.pendingSec) {
      var sid = S.pendingSec; S.pendingSec = null;
      setTimeout(function () { var el = document.getElementById("sec-" + sid); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 60);
    }
  }
  function gotoSec(bid, n, sid) {
    S.secOpen[secKey(bid, n, sid)] = true; S.pendingSec = sid;
    if (S.zoom === "one") S.zoom = "gist";
    var r = "r-" + bid + "-" + n;
    if (S.route === r) render(); else location.hash = r;
  }
  function gotoBookTab(bid, tab) {
    S.bookTab = tab;
    if (S.route === "b-" + bid) render(); else location.hash = "b-" + bid;
  }

  /* ---------- 交互 ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
  }
  function copyText(text, msg) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove();
      toast(ok ? msg || "已复制" : "浏览器阻止了复制，请手动选择文字复制");
    }
    try { navigator.clipboard.writeText(text).then(function () { toast(msg || "已复制"); }, fallback); } catch (e) { fallback(); }
  }
  function openChapter(bid, n) {
    var id = chId(bid, n); S.openCh[id] = true; S.bookTab = "chapters";
    if (S.route !== "b-" + bid) { location.hash = "b-" + bid; }
    else render();
    setTimeout(function () { var el = document.getElementById("d-" + id); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 80);
  }

  document.addEventListener("click", function (e) {
    var pop = document.getElementById("mpop");
    if (pop && !pop.hidden && !e.target.closest("#mpop") && !e.target.closest('[data-act="mst"],[data-act="mgs"],[data-act="mhub"],[data-act="mlm"]')) closePop();
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "mst") { openStation(t.getAttribute("data-l"), +t.getAttribute("data-i")); return; }
    if (act === "mgs") { openGoalStop(t.getAttribute("data-g"), +t.getAttribute("data-i")); return; }
    if (act === "pick") { S.shelfPick = t.getAttribute("data-id"); render(); var pa = document.querySelector(".pulled"); if (pa) { var pr = pa.getBoundingClientRect(); if (window.innerWidth < 1100 || pr.top < 0 || pr.top > window.innerHeight - 160) pa.scrollIntoView({ block: "start", behavior: "smooth" }); } return; }
    if (act === "shelf-f") { S.shelfF = t.getAttribute("data-f"); render(); return; }
    if (act === "abox") { S.archPick = t.getAttribute("data-t"); render(); var ap = document.querySelector(".apanel"); if (ap && window.innerWidth < 1100) ap.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (act === "arch-f") { S.archF = t.getAttribute("data-f"); render(); return; }
    if (act === "abox-go") { S.archPick = t.getAttribute("data-t"); S.archF = "all"; closePop(); if (S.route === "archive") render(); else location.hash = "#archive"; return; }
    if (act === "eb-del") { S.ebConfirm = t.getAttribute("data-id"); render(); return; }
    if (act === "eb-del-no") { S.ebConfirm = null; render(); return; }
    if (act === "eb-del-yes") { ebRemove(t.getAttribute("data-id")); return; }
    if (act === "pick-go") { S.shelfPick = t.getAttribute("data-id"); S.shelfF = "all"; location.hash = "#shelf"; return; }
    if (act === "add-book") { toast("在对话里说书名和放进哪个方向，我加到书架上"); return; }
    if (act === "fold-day") { S.foldDay = t.getAttribute("data-d"); render(); return; }
    if (act === "fold-nav") { S.foldStart = foldWS() + +t.getAttribute("data-d"); S.foldDay = null; render(); return; }
    if (act === "fold-go") { var fw = +t.getAttribute("data-w"); S.foldStart = Math.max(0, fw - 1); S.foldDay = null; render(); return; }
    if (act === "mhub") { openHub(+t.getAttribute("data-h")); return; }
    if (act === "mlm") { openLandmark(t.getAttribute("data-r")); return; }
    if (act === "film-go") {
      FILM.seg = +t.getAttribute("data-seg"); filmClear(); if (FILM.video) FILM.video.pause(); FILM.cur = -1; FILM.shown = -2;
      if (S.route === "c-film") { render(); var fs = document.getElementById("film-slot"); if (fs) fs.scrollIntoView({ block: "start", behavior: "smooth" }); }
      return;
    }
    if (act === "fp-seg") { FILM.seg = Math.max(0, Math.min(FILM_SEGS - 1, filmSeg() + +t.getAttribute("data-d"))); filmClear(); if (FILM.video) FILM.video.pause(); FILM.cur = -1; FILM.shown = -2; filmPaint(); return; }
    if (act === "fp-set") {
      var fk = t.getAttribute("data-k"), fv = t.getAttribute("data-v");
      if (fk === "mode") FILM.mode = fv; else if (fk === "speed") { FILM.speed = +fv; if (FILM.video) FILM.video.playbackRate = FILM.speed; } else if (fk === "rep") FILM.rep = +fv; else if (fk === "gap") FILM.gap = fv === "1";
      filmPaint(); return;
    }
    if (act === "fp-whole") { filmWhole(); return; }
    if (act === "fp-cue") { filmPlayCue(+t.getAttribute("data-i")); return; }
    if (act === "fp-peek") { var pi = +t.getAttribute("data-i"); FILM.peek[pi] = !FILM.peek[pi]; t.innerHTML = filmText(FILM.cues[pi], FILM.mode, pi); if (FILM.shown === pi) filmShowCue(pi, true); return; }
    if (act === "fp-rec") { filmRecord(+t.getAttribute("data-i")); return; }
    if (act === "fp-mine") { filmMine(+t.getAttribute("data-i")); return; }
    if (act === "fp-known") { filmToggleKnown(+t.getAttribute("data-i")); return; }
    if (act === "fp-ex") { filmExplain(+t.getAttribute("data-i")); return; }
    if (act === "fp-step") { filmApplyStep((filmToday().review ? FILM_REVIEW : FILM_STEPS)[+t.getAttribute("data-s")]); return; }
    if (act === "fp-play-seg") { filmPlaySeg(+t.getAttribute("data-k")); return; }
    if (act === "fp-play-week") {
      var fnx = curStudy().next.film || 0, fa = FILM.segs[Math.max(0, fnx - 6)], fz = FILM.segs[Math.max(0, fnx - 1)];
      if (fa && fz && fz.z > fa.a) filmPlayRange(FILM.cues[fa.a].s, FILM.cues[fz.z - 1].e); return;
    }
    if (act === "mpop-close") { closePop(); return; }
    if (act === "metro-mode") { S.metroMode = t.getAttribute("data-m"); try { localStorage.setItem("yanxilu-route-" + bjToday(), S.metroMode); } catch (e2) {} render(); return; }
    if (act === "status") return;
    if (act === "tab") { S.bookTab = t.getAttribute("data-tab"); render(); return; }
    if (act === "open-ch") { e.preventDefault(); openChapter(t.getAttribute("data-book"), +t.getAttribute("data-n")); return; }
    if (act === "flip") { var cid = t.getAttribute("data-card"); S.flipped[cid] = !S.flipped[cid]; S.hl = null; render(); var el = document.getElementById("card-" + cid); if (el) el.focus({ preventScroll: true }); return; }
    if (act === "zoom") { S.zoom = t.getAttribute("data-z"); render(); return; }
    if (act === "sec-toggle") { var sk = t.getAttribute("data-key"), sec = t.closest("section.sec"); S.secOpen[sk] = !S.secOpen[sk]; render(); if (!S.secOpen[sk] && sec) { var el2 = document.getElementById(sec.id); if (el2 && el2.getBoundingClientRect().top < 0) el2.scrollIntoView({ block: "start" }); } return; }
    if (act === "sec-jump" || act === "goto-sec") { gotoSec(t.getAttribute("data-book"), +t.getAttribute("data-n"), t.getAttribute("data-sec")); return; }
    if (act === "pr-show") { S.prShown[t.getAttribute("data-card")] = true; render(); return; }
    if (act === "pr-grade") { var pc = t.getAttribute("data-card"); S.prDone[pc] = true; gradeCard(pc, t.getAttribute("data-g")); render(); return; }
    if (act === "practice") { S.practice = t.getAttribute("data-p"); render(); return; }
    if (act === "sw") { var aid = t.getAttribute("data-id"); S.sw[aid] = !S.sw[aid]; render(); var b2 = document.querySelector('[data-act="sw"][data-id="' + aid + '"]'); if (b2) b2.focus({ preventScroll: true }); return; }
    if (act === "sw-reset") { Object.keys(S.sw).forEach(function (k) { S.sw[k] = true; }); render(); return; }
    if (act === "goto-switch") { S.practice = t.getAttribute("data-p") || "switch"; gotoBookTab(t.getAttribute("data-book"), "practice"); return; }
    if (act === "nest-tog") { var ni = t.getAttribute("data-i"); S.nestOff[ni] = !S.nestOff[ni]; render(); var b4 = document.querySelector('[data-act="nest-tog"][data-i="' + ni + '"]'); if (b4) b4.focus({ preventScroll: true }); return; }
    if (act === "goto-map") { gotoBookTab(t.getAttribute("data-book"), "argmap"); return; }
    if (act === "map-tog") { var mk = t.getAttribute("data-key"); S.mapOpen[mk] = t.getAttribute("aria-expanded") !== "true"; render(); var b3 = document.querySelector('[data-act="map-tog"][data-key="' + mk + '"]'); if (b3) b3.focus({ preventScroll: true }); return; }
    if (act === "map-mode") { S.mapMode = t.getAttribute("data-m"); S.mapOpen = {}; render(); return; }
    if (act === "goto-card") {
      var k = t.getAttribute("data-card"); S.bookTab = "practice"; S.practice = "cards"; S.flipped[k] = true; S.hl = k; render();
      setTimeout(function () { var el = document.getElementById("card-" + k); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60); return;
    }
    if (act === "copy-fw") { copyText(frameworkText(t.getAttribute("data-book"))); return; }
    if (act === "copy-code") { var pre = t.parentNode.querySelector("pre"); if (pre) copyText(pre.textContent); return; }
    if (act === "export") { copyText(JSON.stringify(S.data, null, 2)); return; }
    if (act === "j-del") { S.confirmDel = t.getAttribute("data-id"); render(); return; }
    if (act === "j-del-no") { S.confirmDel = null; render(); return; }
    if (act === "j-del-yes") { var jid = t.getAttribute("data-id"); S.confirmDel = null; del("journal", jid); toast("已删除"); render(); return; }
  });
  /* 线网：用键盘打开站点详情，Esc 关闭 */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { var pop = document.getElementById("mpop"); if (pop && !pop.hidden) { closePop(); return; } }
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target && e.target.closest ? e.target.closest('.metro [data-act="mst"], .metro [data-act="mgs"], .metro [data-act="mhub"], .metro [data-act="mlm"], .fold [data-act], .fold-mini [data-act]') : null;
    if (!g) return;
    e.preventDefault();
    var ga = g.getAttribute("data-act");
    if (ga === "fold-day" || ga === "fold-nav" || ga === "fold-go") { g.dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
    if (ga === "mhub") openHub(+g.getAttribute("data-h")); else if (ga === "mlm") openLandmark(g.getAttribute("data-r")); else if (ga === "mgs") openGoalStop(g.getAttribute("data-g"), +g.getAttribute("data-i")); else openStation(g.getAttribute("data-l"), +g.getAttribute("data-i"));
  });
  /* 跟读播放器的快捷键 */
  document.addEventListener("keydown", function (e) {
    if (S.route !== "c-film" || !FILM.cues || e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target, tag = tg && tg.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var sg = FILM.segs[filmSeg()], k = e.key;
    if (!sg || sg.z <= sg.a) return;
    var cur = FILM.cur >= sg.a && FILM.cur < sg.z ? FILM.cur : FILM.shown >= sg.a && FILM.shown < sg.z ? FILM.shown : sg.a;
    if (k === " " && tag !== "BUTTON" && tag !== "A") { e.preventDefault(); var v = filmVideo(); if (!v.paused) { filmClear(); v.pause(); } else filmPlayCue(cur); }
    else if (k === "ArrowRight") { e.preventDefault(); filmPlayCue(Math.min(sg.z - 1, cur + 1)); }
    else if (k === "ArrowLeft") { e.preventDefault(); filmPlayCue(Math.max(sg.a, cur - 1)); }
    else if (k === "r" || k === "R") filmPlayCue(cur);
    else if (k === "h" || k === "H") { var ms = FILM_MODES.map(function (m) { return m[0]; }); FILM.mode = ms[(ms.indexOf(FILM.mode) + 1) % ms.length]; filmPaint(); }
    else if (k === "k" || k === "K") filmToggleKnown(cur);
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "fp-file") { filmLoad(t.files); t.value = ""; return; }
    if (t.hasAttribute && t.hasAttribute("data-eb")) { var f = t.files && t.files[0]; t.value = ""; ebUpload(t.getAttribute("data-eb"), f); return; }
    if (t.matches && t.matches('select[data-act="status"]')) {
      var id = t.getAttribute("data-id"), v = t.value;
      if (v === "todo") del("progress", id); else put("progress", id, { s: v, t: new Date().toISOString() });
      t.blur(); render();
    }
  });
  document.addEventListener("toggle", function (e) {
    var d = e.target; if (!d.matches || !d.matches("details.ch")) return;
    S.openCh[d.getAttribute("data-ch")] = d.open;
  }, true);
  var noteTimers = {};
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "arch-q") { S.archQ = t.value.trim().toLowerCase(); applyArchFilter(); return; }
    if (!t.hasAttribute || !t.hasAttribute("data-note")) return;
    var id = t.getAttribute("data-note"), ind = document.getElementById("ns-" + id);
    if (ind) ind.textContent = "编辑中";
    clearTimeout(noteTimers[id]);
    noteTimers[id] = setTimeout(function () {
      var text = t.value, p = text.trim() ? put("notes", id, { text: text, t: new Date().toISOString() }) : del("notes", id);
      p.then(function () { var i2 = document.getElementById("ns-" + id); if (i2) i2.textContent = "已保存 " + hhmm(); });
    }, 800);
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "j-form") return;
    e.preventDefault();
    var f = e.target, date = $("#j-date", f).value || today(), minutes = Math.max(0, Math.round(Number($("#j-min", f).value) || 0));
    var ref = $("#j-ref", f).value, text = $("#j-text", f).value.trim();
    if (!text) { toast("先写下这次学了什么"); $("#j-text", f).focus(); return; }
    var id = "j-" + date.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8);
    put("journal", id, { date: date, minutes: minutes, ref: ref, text: text, t: new Date().toISOString() });
    if (document.activeElement) document.activeElement.blur();
    S.dirty = false; render(); toast("已记下");
  });
  window.addEventListener("hashchange", function () {
    var r = readHash();
    S.route = r; S.confirmDel = null; render(true);
  });

  /* ---------- 启动 ---------- */
  S.route = readHash();
  if (window.claude && typeof window.claude.use === "function") { render(); connect(); }
  else enterLocal();
})();
