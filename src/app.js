(function () {
  "use strict";
  document.documentElement.lang = "zh-CN";

  var LIB = window.YXL_LIB, REC = window.YXL_RECORD || { data: {} };
  var PLAN = window.YXL_PLAN || null, STUDY_SNAP = window.YXL_STUDY || { next: {}, days: {}, streak: 0 };
  var LESSON_SNAP = window.YXL_LESSONS || {};
  /* 有课程页的线：电影、SQL、Python、CFA、地缘、周复盘 */
  var COURSES = PLAN ? ["film", "sql", "py", "cfa", "geo", "rev"].filter(function (k) { return PLAN.lessons[k]; }) : [];
  var COLLS = ["progress", "notes", "journal", "cards", "study", "film", "ebooks", "mybooks", "hidden", "reading", "marks", "domains"];
  var STATUS = [["todo", "未开始"], ["doing", "进行中"], ["done", "已完成"], ["review", "已内化"]];
  var STATUS_LABEL = {}; STATUS.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });
  var MARK = { done: "阅", review: "熟" };
  var BOX_DAYS = [0, 1, 3, 7, 16, 35];
  var LS_KEY = "yanxilu-local-v1";
  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var p = s.split("-").map(Number); return ymd(new Date(p[0], p[1] - 1, p[2] + n)); }
  function hhmm() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function emptyData() { return { progress: {}, notes: {}, journal: {}, cards: {}, study: {}, film: {}, ebooks: {}, mybooks: {}, hidden: {}, reading: {}, marks: {}, domains: {} }; }

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
  /* 英语一层：片盒（电影、剧）和英语读物，见 data.js 的 english */
  var EN = LIB.english || { films: [], books: [] }, EN_ITEM = {}, EN_IDS = [];
  (EN.films || []).forEach(function (x) { EN_ITEM[x.id] = Object.assign({ kind: "film" }, x); EN_IDS.push(x.id); });
  (EN.books || []).forEach(function (x) { EN_ITEM[x.id] = Object.assign({ kind: "read" }, x); EN_IDS.push(x.id); });
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
    if (EN_ITEM[ref]) return "《" + EN_ITEM[ref].title + "》";
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
    return TRACK[it.tracks[0]] ? "#t-" + it.tracks[0] : "#shelf";
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

  /* ---------- 书架：公共部分（索书号、方向色、一本书读到哪） ---------- */
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
    var rdg = readingOf(id);
    if (rdg) {
      r.epct = rdg.pct;
      if (!b) r.pct = Math.max(r.pct, rdg.pct);
      if (r.s === "todo" && rdg.pct > 0.004) r.s = "doing";
    }
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
  /* ---------- 书架：英语一层 ----------
   * 一部电影或一部剧是一个片盒（像影碟盒，侧边有胶片孔），绘本封面朝外立着，最右边是 Baba 的生词本卡片盒。
   * 片盒的状态和书一样：在学的抽出半截挂丝带，学完盖“完”字章。
   * 研习录自己的电影线（《当幸福来敲门》）按课表算学到第几段；Baba 上的片子在面板里手动标。 */
  function enHref(path) { return String(EN.site || "").replace(/\/$/, "") + (path || ""); }
  function enState(id) {
    var x = EN_ITEM[id], s = st(id), r = { s: s, pct: 0, done: 0, total: 0 };
    if (x && x.where === "local" && x.plan && PLAN && PLAN.lessons[x.plan]) {
      r.total = PLAN.lessons[x.plan].length;
      r.done = Math.min(r.total, curStudy().next[x.plan] || 0);
      r.pct = r.total ? r.done / r.total : 0;
      if (s === "todo" && r.done > 0) r.s = "doing";
      if (r.done >= r.total && r.total && s !== "review") r.s = "done";
    }
    return r;
  }
  function enFit(t, h) { return Math.max(10.5, Math.min(15, Math.floor((h - 104) / (t.length * 1.16) * 2) / 2)); }
  function filmCaseHTML(x) {
    var es = enState(x.id), h = 226, size = enFit(x.title, h);
    var cls = "fcase" + (es.s === "doing" ? " doing" : es.s === "done" || es.s === "review" ? " done" : "") + (shelfMatch(es.s === "review" ? "done" : es.s) ? "" : " dim") + (S.shelfPick === x.id ? " picked" : "");
    var src = x.where === "local" ? '<span class="fc-src">本地</span>' : '<span class="fc-src baba">Baba</span>';
    return '<button type="button" class="' + cls + '" data-act="pick" data-id="' + esc(x.id) + '" style="height:' + h + "px;--p:" + Math.round(es.pct * 100) + '%" title="《' + esc(x.title) + "》" + esc(x.en) + " · " + esc(x.type) + " · " + esc(STATUS_LABEL[es.s] || "") + '">' +
      '<span class="fc-type">' + esc(x.type) + '</span><span class="fc-lab"><span class="fc-t" style="font-size:' + size + 'px">' + esc(x.title) + "</span></span>" +
      '<span class="fc-foot">' + src + (es.s === "done" || es.s === "review" ? '<i class="sp-seal" aria-hidden="true">' + (es.s === "review" ? "熟" : "完") + "</i>" : "<span>" + esc(String(x.year || "")) + "</span>") + "</span>" +
      (es.total ? '<i class="fc-prog" aria-hidden="true"></i>' : "") + (es.s === "doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + "</button>";
  }
  /* 绘本封面朝外立着：封面是自己画的夜空，不用原书插图 */
  function readCoverHTML(x) {
    var es = enState(x.id);
    var cls = "pbook" + (es.s === "doing" ? " doing" : es.s === "done" || es.s === "review" ? " done" : "") + (shelfMatch(es.s === "review" ? "done" : es.s) ? "" : " dim") + (S.shelfPick === x.id ? " picked" : "");
    return '<button type="button" class="' + cls + '" data-act="pick" data-id="' + esc(x.id) + '" title="《' + esc(x.title) + "》" + esc(x.en) + " · " + esc(x.type) + " · " + esc(STATUS_LABEL[es.s] || "") + '">' +
      '<span class="pk-sky" aria-hidden="true"><i></i><i></i><i></i></span><span class="pk-type">' + esc(x.type) + " · " + esc((x.level || "").split(" · ")[0]) + '</span><span class="pk-en">' + esc(x.en) + '</span><span class="pk-t">' + esc(x.title) + "</span>" +
      '<span class="pk-foot"><span class="fc-src baba">Baba</span>' + (es.s === "done" || es.s === "review" ? '<i class="sp-seal" aria-hidden="true">' + (es.s === "review" ? "熟" : "阅") + "</i>" : "<span>" + esc((x.level || "").split(" · ")[1] || "") + "</span>") + "</span>" +
      (es.s === "doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + "</button>";
  }
  /* 抽出来的片盒 / 英语读物 */
  function enDais(id) {
    var x = EN_ITEM[id], es = enState(id), film = x.kind === "film", local = x.where === "local";
    var head = daisId(x.title, [x.year, x.type, x.level], x.en, local ? "" : statusCtl(id, x.title));
    var noteLab = film ? "观影笔记" : "我的批注", notePh = film ? "哪几句听不出来、记住了哪些说法，写在这里" : "读到哪、想到什么，写在这里";
    var why = x.why ? '<p class="pb-why">' + esc(x.why) + "</p>" : "";
    if (local) {
      var next = Math.min(es.done, Math.max(0, es.total - 1)), segs = "", mins = x.plan ? subjMin(x.plan) : 0;
      for (var k = 0; k < es.total; k++) segs += '<span class="fe-s' + (k < es.done ? " r" : "") + '"></span>';
      var prog = '<section class="prog" aria-label="学到哪"><div class="pg-top"><b class="pg-pct">' + Math.round(es.pct * 100) + "<small>%</small></b>" +
        '<span class="pg-where">' + es.done + " / " + es.total + " 段学完" + (mins ? " · " + hrs(mins) + " 小时" : "") + "</span></div>" +
        '<div class="fe-wrap"><div class="fe-block en-segs sm" aria-hidden="true">' + segs + '</div><i class="fe-rib sm" style="left:' + (es.total ? es.done / es.total * 100 : 0) + '%" aria-hidden="true"></i></div></section>';
      var go = es.done < es.total ? '<a class="btn" href="#c-' + esc(x.plan) + '" data-act="film-go" data-seg="' + next + '">继续：第 ' + (next + 1) + " 段</a>" : '<a class="btn" href="#c-' + esc(x.plan) + '">打开跟读播放器</a>';
      return { col: "var(--ln-en)", head: head, body: prog + '<div class="btns pb-acts">' + go + "</div>" + moreHTML(why + noteBlock(id, noteLab, notePh), "介绍 · " + noteLab) };
    }
    var go2 = '<a class="btn" href="' + esc(enHref(x.path)) + '" target="_blank" rel="noopener">' + (film ? "去 Baba 学" : "去 Baba 读") + " ↗</a>";
    var sync = '<p class="meta">学到哪、收了哪些生词都记在 Baba 上，暂时不传回研习录，学到一半或学完了在上面标一下。</p>';
    return { col: "var(--ln-en)", head: head, body: '<div class="btns pb-acts">' + go2 + "</div>" + moreHTML(why + sync + noteBlock(id, noteLab, notePh), "介绍 · " + noteLab) };
  }
  /* ---------- 自己加的书、从书墙上拿下的书 ----------
   * mybooks：自己加的书，文档 id = "my-" + 时间，内容 { title, by, track, why, t }，和内置的书一样能挂电子书、写批注、标进度。
   * hidden：从书墙上拿下来的内置书，文档 id = 书的 id，内容 { t }；放回去就删掉这一条。 */
  var DIRS = ["geo", "cycle", "fut", "co", "fin"];
  /* ---------- 领域：书墙上的一格 ----------
   * 内置五个方向（有方向页、进线网图）+ 自己加的领域 + 英语。
   * domains：自己加的领域，文档 id = "dm-" + 时间，内容 { name 名称, code 分类号（可空）, color 布色（DOM_COLORS 的键）, t }。
   * 自己加的领域只在书架上，不进线网图；里面没有书了才能删。 */
  var DOM_COLORS = [
    ["teal", "青", "#2F7E7A", ["#3E7C78", "#2E6764", "#56918C", "#285957"]],
    ["indigo", "靛蓝", "#4659A6", ["#47598A", "#3A4975", "#5B6C9E", "#323E64"]],
    ["rose", "胭脂", "#B4506A", ["#A55468", "#8D4557", "#B86B7D", "#7A3A4A"]],
    ["umber", "赭石", "#8C5A2B", ["#8A5D35", "#73492A", "#A0744A", "#634023"]],
    ["forest", "墨绿", "#3F6B45", ["#43684A", "#36573C", "#5A7E60", "#2E4A33"]],
    ["lilac", "藕荷", "#8C6F94", ["#8A7290", "#735E79", "#A08AA6", "#5F4D64"]]
  ];
  function domColor(c) { return DOM_COLORS.filter(function (x) { return x[0] === c; })[0] || DOM_COLORS[0]; }
  function domBuiltin(k) { return !!(TRACK[k] && SHELF_COL[k]); }
  function domExists(k) { return domBuiltin(k) || !!(S.data.domains || {})[k]; }
  /* 书墙上的领域，按顺序：内置五个，再按加的先后排自己加的；领域被删了但还有书的（换设备时可能出现），也留一格 */
  function domList() {
    var D = S.data.domains || {}, mb = S.data.mybooks || {};
    var out = DIRS.concat(Object.keys(D).filter(function (k) { return D[k] && D[k].name; }).sort(function (a, b) { return String(D[a].t).localeCompare(String(D[b].t)); }));
    Object.keys(mb).forEach(function (id) { var t = mb[id] && mb[id].track; if (t && typeof t === "string" && out.indexOf(t) < 0 && t !== "en") out.push(t); });
    return out;
  }
  function domInfo(k) {
    if (domBuiltin(k)) return { key: k, name: TRACK[k].short, code: SHELF_CLS[k] || "", col: "var(" + SHELF_COL[k] + ")", cloth: CLOTH[k], href: "#t-" + k, custom: false };
    var d = (S.data.domains || {})[k], c = domColor(d && d.color);
    return { key: k, name: d && d.name ? String(d.name) : "未命名领域", code: d && d.code ? String(d.code) : "", col: c[2], cloth: c[3], href: "", custom: true, missing: !d };
  }
  function domCount(k) { return trackBooks(k).books.length; }
  function domNextColor() {
    var D = S.data.domains || {}, used = Object.keys(D).map(function (k) { return D[k] && D[k].color; });
    var free = DOM_COLORS.filter(function (c) { return used.indexOf(c[0]) < 0; })[0];
    return (free || DOM_COLORS[Object.keys(D).length % DOM_COLORS.length])[0];
  }
  function domFieldsHTML(d) {
    var col = d ? d.color : domNextColor();
    return '<label class="add-f"><span>领域名称</span><input name="dname" maxlength="12" autocomplete="off" placeholder="比如：心理学" value="' + esc(d ? d.name : "") + '"></label>' +
      '<label class="add-f"><span>分类号</span><input name="dcode" maxlength="8" autocomplete="off" placeholder="可以不填，比如中图分类号 B84" value="' + esc(d ? d.code || "" : "") + '"></label>' +
      '<fieldset class="add-f"><legend>布面颜色</legend><div class="add-cols">' + DOM_COLORS.map(function (c) {
        return '<label class="add-col" style="--c:' + c[2] + '"><input type="radio" name="dcol" value="' + c[0] + '"' + (c[0] === col ? " checked" : "") + '><i aria-hidden="true"></i>' + esc(c[1]) + "</label>";
      }).join("") + "</div></fieldset>";
  }
  function domRead(f, selfKey) {
    var name = (f.elements.dname.value || "").trim().replace(/\s+/g, " "), code = (f.elements.dcode.value || "").trim();
    var color = (f.querySelector('input[name="dcol"]:checked') || {}).value || domNextColor();
    if (!name) { toast("给领域起个名字"); f.elements.dname.focus(); return null; }
    var same = domList().filter(function (k) { return k !== selfKey && domInfo(k).name === name; })[0];
    return { name: name, code: code, color: color, same: same || "" };
  }
  function domSheetHTML() {
    var k = S.domOpen, d = k && (S.data.domains || {})[k];
    if (!d || !S.canEdit) return "";
    var n = domCount(k);
    return '<div class="add-sheet" role="dialog" aria-modal="true" aria-labelledby="dom-h"><form class="add-card" id="dom-form" data-k="' + esc(k) + '"><h2 id="dom-h">改这个领域</h2>' + domFieldsHTML(d) +
      '<div class="btns"><button type="submit" class="btn">保存</button><button type="button" class="btn ghost" data-act="dom-close">取消</button></div>' +
      (n ? '<p class="meta">这个领域里还有 ' + n + " 本书。把书拿下，或者在展台上点「改书名、作者、领域」换到别的领域，空了以后才能删。</p>"
        : '<div class="pb-rm"><button type="button" class="linkbtn danger" data-act="dom-del" data-k="' + esc(k) + '">删掉这个领域</button></div>') + "</form></div>";
  }
  function domSave(f) {
    var k = f.getAttribute("data-k"), old = (S.data.domains || {})[k]; if (!old) return;
    var v = domRead(f, k); if (!v) return;
    if (v.same) { toast("已经有叫「" + v.name + "」的领域了"); f.elements.dname.focus(); return; }
    put("domains", k, { name: v.name, code: v.code, color: v.color, t: old.t });
    S.domOpen = null; render(); toast("领域改好了");
  }
  function syncMyBooks() {
    var mb = S.data.mybooks || {};
    Object.keys(ITEMS).forEach(function (id) { if (ITEMS[id].mine && !mb[id]) delete ITEMS[id]; });
    Object.keys(mb).forEach(function (id) {
      var b = mb[id]; if (!b || !b.title || !b.track || typeof b.track !== "string" || b.track === "en") return;
      ITEMS[id] = { id: id, title: String(b.title), by: String(b.by || ""), kind: "book", home: b.track, tracks: [b.track], why: String(b.why || ""), mine: true };
    });
  }
  function isHidden(id) { return !!(S.data.hidden && S.data.hidden[id]); }
  function addSheetHTML() {
    if (!S.addOpen || !S.canEdit) return "";
    var ed = S.addOpen.edit && S.data.mybooks[S.addOpen.edit] ? S.data.mybooks[S.addOpen.edit] : null;
    var doms = domList(), tr = (ed && ed.track) || S.addOpen.track || (ITEMS[S.shelfPick] && ITEMS[S.shelfPick].home) || "geo";
    if (tr !== "__new" && doms.indexOf(tr) < 0) tr = "geo";
    var radios = doms.map(function (d) { var di = domInfo(d); return '<label class="add-dir" style="--c:' + di.col + '"><input type="radio" name="track" value="' + esc(d) + '"' + (d === tr ? " checked" : "") + '><i aria-hidden="true"></i>' + esc(di.name) + "</label>"; }).join("") +
      '<label class="add-dir new"><input type="radio" name="track" value="__new"' + (tr === "__new" ? " checked" : "") + '><b aria-hidden="true">＋</b>新领域</label>';
    return '<div class="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-h"><form class="add-card" id="add-form" data-edit="' + esc(S.addOpen.edit || "") + '">' +
      '<h2 id="add-h">' + (ed ? "改一下这本书" : "加一本书") + "</h2>" +
      '<label class="add-f"><span>书名</span><input id="add-title" name="title" required maxlength="60" autocomplete="off" placeholder="比如：置身事内" value="' + esc(ed ? ed.title : "") + '"></label>' +
      '<label class="add-f"><span>作者</span><input name="by" maxlength="40" autocomplete="off" placeholder="可以不填" value="' + esc(ed ? ed.by || "" : "") + '"></label>' +
      '<fieldset class="add-f"><legend>放在哪个领域</legend><div class="add-dirs">' + radios + "</div></fieldset>" +
      '<div class="add-new">' + domFieldsHTML(null) + "</div>" +
      '<label class="add-f"><span>为什么读</span><textarea name="why" rows="3" maxlength="200" placeholder="一两句话，以后看到书脊就想得起来">' + esc(ed ? ed.why || "" : "") + "</textarea></label>" +
      '<div class="btns"><button type="submit" class="btn">' + (ed ? "保存" : "放上书墙") + '</button><button type="button" class="btn ghost" data-act="add-close">取消</button></div>' +
      (ed ? "" : '<p class="meta">放上去以后，在展台上可以上传这本书的 PDF 或 EPUB。</p>') + "</form></div>";
  }
  function addSave(f) {
    var title = (f.elements.title.value || "").trim(), by = (f.elements.by.value || "").trim(), why = (f.elements.why.value || "").trim();
    var tr = (f.querySelector('input[name="track"]:checked') || {}).value;
    if (!title) { toast("先写书名"); f.elements.title.focus(); return; }
    if (tr === "__new") {
      var nd = domRead(f, ""); if (!nd) return;
      if (nd.same) tr = nd.same;
      else { tr = "dm-" + Date.now().toString(36); put("domains", tr, { name: nd.name, code: nd.code, color: nd.color, t: new Date().toISOString() }); }
    }
    if (!domExists(tr) && domList().indexOf(tr) < 0) { toast("选一个领域放进去"); return; }
    var edit = f.getAttribute("data-edit"), old = edit && S.data.mybooks[edit];
    var id = old ? edit : "my-" + Date.now().toString(36);
    put("mybooks", id, { title: title, by: by, track: tr, why: why, t: old ? old.t : new Date().toISOString() });
    S.addOpen = null; S.shelfPick = id; S.flip = old ? null : id; syncMyBooks(); render();
    toast(old ? "改好了" : "《" + title + "》放上书墙了");
  }
  function shelfOpsHTML(id) {
    var it = ITEMS[id];
    if (!S.canEdit || !it || /^cfa-/.test(id)) return "";
    if (S.rmConfirm === id) {
      return '<div class="pb-rm"><span>' + (it.mine ? "这本是你加的，拿下就删掉" + (ebookOf(id) ? "（连同电子书）" : "") + "，批注和划线留着。" : "拿下后不在书墙上显示，在书墙下方随时能放回去。") + "</span>" +
        '<button type="button" class="linkbtn danger" data-act="shelf-rm-yes" data-id="' + esc(id) + '">拿下</button><button type="button" class="linkbtn" data-act="shelf-rm-no">取消</button></div>';
    }
    return '<div class="pb-rm">' + (it.mine ? '<button type="button" class="linkbtn" data-act="add-book" data-edit="' + esc(id) + '">改书名、作者、领域</button>' : "") +
      '<button type="button" class="linkbtn" data-act="shelf-rm" data-id="' + esc(id) + '">从书墙上拿下</button></div>';
  }
  function shelfRemove(id) {
    var it = ITEMS[id]; S.rmConfirm = null; if (!it) return;
    if (it.mine) { if (ebookOf(id)) ebRemove(id); del("mybooks", id); }
    else put("hidden", id, { t: new Date().toISOString() });
    toast("《" + it.title + "》拿下来了");
    S.shelfPick = null; render();
  }
  function hiddenListHTML() {
    var ids = Object.keys(S.data.hidden || {}).filter(function (id) { return ITEMS[id]; });
    if (!ids.length) return "";
    return '<p class="w-hidden"><span>拿下来的书：</span>' + ids.map(function (id) {
      return S.canEdit ? '<button type="button" class="linkbtn" data-act="unhide" data-id="' + esc(id) + '">《' + esc(ITEMS[id].title) + "》放回去</button>" : "《" + esc(ITEMS[id].title) + "》";
    }).join("") + "</p>";
  }
  /* ---------- 阅读进度：电子书读到哪 ----------
   * reading：文档 id = 书的 id，内容 { pct 0—1, loc 第几部分或第几页, y 这一部分或这一页里读到的位置, total, label 读到的章节,
   *   kind（epub / pdf）, t 最后一次读的时间, days { 日期: 当天读到的 pct } }。
   * 在阅读器里翻页、滚动时记下（最多几秒存一次，关掉阅读器时再存一次）；书脊、展台上的进度都从这里读。 */
  function readingOf(id) { var r = S.data.reading && S.data.reading[id]; return r && typeof r.pct === "number" ? r : null; }
  var RDW = {};
  function readingSave(id, rec, force) {
    var old = S.data.reading[id] || {}, now = Date.now(), d = today(), w = RDW[id] || (RDW[id] = { at: 0 });
    var days = Object.assign({}, old.days || {}); days[d] = Math.max(days[d] || 0, Math.round(rec.pct * 1000) / 1000);
    var keys = Object.keys(days).sort(); while (keys.length > 90) delete days[keys.shift()];
    var val = { pct: Math.round(rec.pct * 1000) / 1000, loc: rec.loc, y: Math.round((rec.y || 0) * 1000) / 1000, total: rec.total, label: rec.label || "", kind: rec.kind, t: new Date().toISOString(), days: days };
    if (!force && Math.abs(val.pct - (old.pct || 0)) < 0.002 && val.loc === old.loc && old.days && old.days[d] != null) return;
    clearTimeout(w.timer);
    if (!force && now - w.at < 4000) { w.timer = setTimeout(function () { readingSave(id, rec, true); }, 4000 - (now - w.at)); return; }
    w.at = now;
    if (!S.canEdit) { S.data.reading = Object.assign({}, S.data.reading); S.data.reading[id] = val; return; }
    put("reading", id, val);
    if (val.pct > 0.004 && st(id) === "todo" && !LIB.books[id]) put("progress", id, { s: "doing", t: val.t });
  }
  function agoText(iso) {
    var t = Date.parse(iso || ""); if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "刚刚"; if (m < 60) return m + " 分钟前";
    var h = Math.round(m / 60); if (h < 24) return h + " 小时前";
    var dd = dayDiff(String(iso).slice(0, 10), today());
    return dd <= 1 ? "昨天" : dd < 30 ? dd + " 天前" : String(iso).slice(0, 10);
  }
  /* 进度：一行大数字和读到哪，下面一条书口（读过的部分翻旧了，书签夹在读到的地方，精读书画出每一章），再一行近两周读了几天、照这个速度还要几天 */
  function progCardHTML(id) {
    var b = LIB.books[id], bs = bookState(id), rd = readingOf(id), pct = rd ? rd.pct : bs.pct;
    if (!b && !rd && !(bs.pct > 0)) return "";
    var J = S.data.journal || {}, jd = {};
    Object.keys(J).forEach(function (k) { var e = J[k]; if (e && e.date && (e.ref === id || String(e.ref || "").indexOf(id + "-ch") === 0)) jd[e.date] = true; });
    var rdays = (rd && rd.days) || {}, days = [], tdy = today();
    for (var i = 13; i >= 0; i--) days.push(addDays(tdy, -i));
    var on = days.filter(function (d) { return rdays[d] != null || jd[d]; }).length, where = "";
    if (rd && rd.label) where = rd.label;
    else if (b) where = bs.done >= b.chapters.length ? "全部读完" : "第" + CN[b.chapters[bs.done].n] + "章 · " + b.chapters[bs.done].title.replace(/（.*）$/, "");
    var ticks = b ? b.chapters.map(function (c, k) { return '<i class="pg-ch' + (k < bs.done ? " d" : "") + '" style="left:' + (k / b.chapters.length * 100).toFixed(2) + "%;width:" + (100 / b.chapters.length).toFixed(2) + '%" title="第' + CN[c.n] + "章 " + esc(c.title) + (k < bs.done ? " · 精读完" : "") + '"></i>'; }).join("") : "";
    var eta = "";
    if (rd && pct < 0.995) {
      var ks = Object.keys(rdays).sort().filter(function (d) { return d >= days[0]; });
      if (ks.length >= 2) {
        var span = Math.max(1, dayDiff(ks[0], tdy)), rate = (pct - rdays[ks[0]]) / span;
        if (rate > 0.0005) { var left = Math.ceil((1 - pct) / rate); if (left <= 365) eta = "照这个速度大约还要 " + left + " 天"; }
      }
    }
    var sub = [on ? "近两周读了 " + on + " 天" : "", eta, rd ? "上次 " + agoText(rd.t) : ""].filter(Boolean).join(" · ");
    return '<section class="prog" aria-label="阅读进度"><div class="pg-top"><b class="pg-pct">' + Math.round(pct * 100) + "<small>%</small></b>" +
      (where ? '<span class="pg-where">' + esc(where) + "</span>" : "") + "</div>" +
      '<div class="pg-edge' + (b ? " ch" : "") + '" style="--p:' + (pct * 100).toFixed(1) + '%" role="img" aria-label="读到 ' + Math.round(pct * 100) + '%">' + ticks + '<i class="pg-read"></i><i class="pg-rib"></i></div>' +
      (sub ? '<p class="pg-sub">' + esc(sub) + "</p>" : "") + "</section>";
  }
  /* ---------- 书架：原木书墙 ----------
   * 上面是展台：一次只请一本书（或一部片、一个档案盒）上来，封面朝外，旁边摆着它的道具，右边是展签。
   * 下面是一面亚麻墙：书、研究档案、片子挂在同一套橡木板上。墙的挂法四选一：浮板、木钉立柱、麻绳吊板、拱形书龛（记在这台设备的浏览器里）。
   * 书是布面精装：每个方向一族低饱和的布色，书脊轮流用烫金线、贴签、拼布、色带四种做法。
   * 在读的抽出半截、夹书签、书脊上一章一站；读完盖“阅”章；花的时间越多书脊越厚（时间来自足迹里记的分钟）。 */
  var CLOTH = {
    geo: ["#A9573F", "#8E4A37", "#BE7759", "#7A3F31", "#B4664A", "#965744", "#C48669"],
    fin: ["#6B5577", "#58456A", "#7D6A8B"],
    co: ["#5E6B70", "#738189", "#4B565B", "#879297"],
    cycle: ["#B08A45", "#977335", "#C29E5C", "#86682F", "#A6844A"],
    fut: ["#6F7D4E", "#5B683F", "#849262", "#4E5A37", "#77865A"],
    en: ["#33475F", "#3E5672", "#2B3C51"]
  };
  var HANGS = [["float", "浮板", "浮板：看不见支架"], ["peg", "木钉", "木钉立柱"], ["rope", "麻绳", "麻绳吊板"], ["niche", "书龛", "拱形书龛"]];
  var HANG_KEY = "yanxilu-hang";
  function hangGet() {
    var h = "float";
    try { h = window.localStorage.getItem(HANG_KEY) || "float"; } catch (e) { /* 读不到就用浮板 */ }
    return HANGS.some(function (x) { return x[0] === h; }) ? h : "float";
  }
  function hangSet(h) { try { window.localStorage.setItem(HANG_KEY, h); } catch (e) { /* 存不了就只在这次生效 */ } }
  function clothOf(tid, key) { var p = CLOTH[tid] || (tid !== "en" && !domBuiltin(tid) ? domInfo(tid).cloth : null) || CLOTH.co; return p[hashN(key) % p.length]; }
  function lumHex(h) {
    var c = [1, 3, 5].map(function (i) { var x = parseInt(h.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function shortBy(by) {
    if (!by) return "";
    var many = /、|等/.test(by), first = by.split("、")[0].replace(/\s*等.*$/, "").split("（")[0].trim(), parts = first.split("·");
    return parts[parts.length - 1] + (many ? " 等" : "");
  }
  /* 一本书花了多少分钟：足迹里指向这本书（或它某一章）的记录加起来；两本精读书再参考课表里的时间 */
  function bookMinutes(id) {
    var m = 0, J = S.data.journal || {};
    Object.keys(J).forEach(function (k) { var e = J[k]; if (e && e.minutes && (e.ref === id || String(e.ref || "").indexOf(id + "-ch") === 0)) m += +e.minutes || 0; });
    if (id === "tragedy") m = Math.max(m, subjMin("geo"));
    if (id === "zhoulu") m = Math.max(m, minutesBy().tao || 0);
    return m;
  }
  function clothSpine(it, tid, idx) {
    var bs = bookState(it.id), title = it.title, h0 = hashN(it.id), base = clothOf(tid, it.id);
    var variant = ["foil", "label", "quarter", "plain"][(Math.floor(h0 / 7) + idx) % 4];
    var h = 206 + h0 % 40, lat = isLatin(title), light = lumHex(base) > 0.2;
    var state = bs.s === "doing" ? "doing" : bs.s === "done" || bs.s === "review" ? "done" : "";
    var b = LIB.books[it.id], prog = state === "doing" && b ? { done: bs.done, total: b.chapters.length } : null;
    var top = { foil: 24, label: 22, quarter: 40, plain: 40 }[variant];
    var bottom = state === "done" ? 34 : prog ? 18 + prog.total * 11 : state === "doing" && bs.epct ? 76 : 14;
    var by = shortBy(it.by), parts = titleCols(title), cw = lat ? 0.5 : 1.14;
    function need(ps) { return Math.max.apply(null, ps.map(function (p, i) { return p.length * cw * (i && !ps.even ? 0.78 : 1); })); }
    function fit(ps, withBy) { return Math.min(lat ? 14 : 15, (h - top - bottom - (withBy ? by.length * 10.5 + 10 : 0) - (variant === "label" ? 18 : 0)) / need(ps)); }
    var withBy = !!by && !prog && state !== "done" && !(state === "doing" && bs.epct), size = fit(parts, withBy);
    if (size < 11.5 && withBy) { withBy = false; size = fit(parts, false); }
    if (size < 10.5 && parts.length === 1 && !lat) { parts = titleCols(title, true); size = fit(parts, withBy); }
    size = Math.max(9.5, Math.floor(size * 2) / 2);
    var two = parts.length > 1, w = two ? (lat ? 38 : 42) + (h0 % 3) * 2 : (lat ? 28 : 30) + (h0 % 6) * 2;
    var mins = bookMinutes(it.id);
    w += Math.min(12, Math.round(mins / 60 * 0.9)) + (prog ? 4 : 0);
    var colsH = parts.map(function (p, i) { var sub = i && !parts.even; return "<span" + (sub ? ' class="sub"' : "") + ' style="font-size:' + (sub ? Math.round(size * 7.4) / 10 : size) + 'px">' + esc(p) + "</span>"; }).join("");
    var t = '<span class="cb-t' + (lat ? " lat" : "") + '">' + colsH + "</span>";
    if (variant === "label") t = '<span class="cb-lab">' + t + "</span>";
    var foot = "";
    if (prog) foot = '<span class="cb-dots" aria-hidden="true">' + b.chapters.map(function (c, i) { return '<i class="' + (i < prog.done ? "d" : i === prog.done ? "c" : "") + '"></i>'; }).join("") + "</span>";
    else if (state === "done") foot = '<i class="cb-seal" aria-hidden="true">' + (MARK[bs.s] || "阅") + "</i>";
    else if (state === "doing" && bs.epct) foot = '<span class="cb-gauge" style="--p:' + Math.round(bs.epct * 100) + '%" aria-hidden="true"></span>';
    else if (withBy) foot = '<span class="cb-by">' + esc(by) + "</span>";
    var cls = "cb v-" + variant + (light ? " light" : "") + (state ? " " + state : "") + (shelfMatch(bs.s === "review" ? "done" : bs.s) ? "" : " dim") + (S.shelfPick === it.id ? " picked" : "") + (ebookOf(it.id) ? " has-eb" : "");
    return '<button type="button" class="' + cls + '" data-act="pick" data-id="' + esc(it.id) + '" style="--cl:' + base + ";height:" + h + "px;width:" + w + 'px" title="《' + esc(title) + "》" + esc(it.by || "") + " · " + esc(STATUS_LABEL[bs.s] || "") + (mins ? " · 学了 " + hrs(mins) + " 小时" : "") + (bs.epct ? " · 电子书读到 " + Math.round(bs.epct * 100) + "%" : "") + '">' +
      t + foot + (state === "doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + (ebookOf(it.id) ? '<i class="cb-eb" aria-hidden="true"></i>' : "") + "</button>";
  }
  var CFA_CODE = { "cfa-ethics": "ETH", "cfa-quant": "QM", "cfa-econ": "EC", "cfa-fsa": "FSA", "cfa-corp": "CI", "cfa-equity": "EQ", "cfa-fi": "FI", "cfa-deriv": "DER", "cfa-alt": "ALT", "cfa-pm": "PM" };
  function cfaBoxHTML(items) {
    var vols = items.map(function (it, i) {
      var bs = bookState(it.id), name = it.title.replace(/（.*）$/, ""), size = Math.min(12, Math.floor(150 / (name.length * 1.14) * 2) / 2);
      var stc = bs.s === "done" || bs.s === "review" ? " done" : bs.s === "doing" ? " doing" : "";
      var cls = "cv" + stc + (shelfMatch(bs.s === "review" ? "done" : bs.s) ? "" : " dim") + (S.shelfPick === it.id ? " picked" : "") + (ebookOf(it.id) ? " has-eb" : "");
      return '<button type="button" class="' + cls + '" data-act="pick" data-id="' + esc(it.id) + '" style="--cl:' + CLOTH.fin[i % 3] + '" title="CFA 一级 · ' + esc(it.title) + '">' +
        '<span class="cv-lab"><span style="font-size:' + size + 'px">' + esc(name) + "</span></span>" +
        (stc === " done" ? '<i class="cb-seal sm" aria-hidden="true">' + (MARK[bs.s] || "阅") + "</i>" : '<span class="cv-c">' + (CFA_CODE[it.id] || "") + "</span>") +
        (stc === " doing" ? '<i class="sp-rib" aria-hidden="true"></i>' : "") + "</button>";
    }).join("");
    var g = GOAL.cfa;
    return '<div class="cfa-box"><div class="cfa-h"><span>CFA 一级 · 十册函套</span>' + (g ? '<a class="cfa-tag" href="#g-cfa">目标线 · ' + hrs(goalMin(g)) + " / " + goalTotal(g) + " h</a>" : "") + "</div>" +
      '<div class="cfa-case"><div class="cfa-in">' + vols + '</div><i class="cfa-cl" aria-hidden="true"></i><i class="cfa-cl b" aria-hidden="true"></i></div></div>';
  }
  function basketHTML(tid, n) {
    return '<a class="basket" href="#t-' + tid + '" title="练习与专题 ' + n + ' 项" style="--cl:' + CLOTH[tid][0] + '"><i class="bk-p" aria-hidden="true"></i><i class="bk-p b" aria-hidden="true"></i>' +
      '<span class="bk-tag"><b>' + n + "</b><span>练习与专题</span></span></a>";
  }
  /* 墙上的摆件和花草：SVG 画的（沙漏、陶瓶蒲苇、地球仪、多肉、绿萝），每样只摆一次，渐变 id 不会重复；
   * 生成脚本不在仓库里，改样子就直接改这里的 SVG。绿萝的藤垂到搁板前面，所以它所在的那一排下面多留了空。 */
  var DECO = {
    glass: '<span class="deco d-glass" aria-hidden="true"><svg class="dz dz-glass" viewBox="0 0 46 92" width="46" height="92" aria-hidden="true" focusable="false"><defs><linearGradient id="yxh-oak" x1="0" x2="1"><stop offset="0" stop-color="#5E3D1E"/><stop offset=".3" stop-color="#B88A55"/><stop offset=".55" stop-color="#94673A"/><stop offset="1" stop-color="#583819"/></linearGradient><linearGradient id="yxh-gl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".22" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".8" stop-color="#D6E4EA" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient><linearGradient id="yxh-sd" x1="0" x2="1"><stop offset="0" stop-color="#B98F55"/><stop offset=".35" stop-color="#E2C48C"/><stop offset="1" stop-color="#A9824A"/></linearGradient></defs><ellipse cx="23" cy="91" rx="21" ry="1.6" fill="#2A1C0E" opacity=".28"/><rect x="22" y="10" width="2" height="72" fill="url(#yxh-oak)" opacity=".55"/><path d="M11,10 C11,27 21,39 22.3,46 L23.7,46 C25,39 35,27 35,10 Z" fill="#F4F1EA" fill-opacity=".18"/><path d="M22.3,46 C21,53 11,65 11,82 L35,82 C35,65 25,53 23.7,46 Z" fill="#F4F1EA" fill-opacity=".18"/><path d="M15,27 C17,35 21,41 22.5,45 L23.5,45 C25,41 29,35 31,27 Q23,29.5 15,27 Z" fill="url(#yxh-sd)"/><line x1="23" y1="45" x2="23" y2="74" stroke="#C9A468" stroke-width=".8"/><path d="M11.4,82 C12,75 16,70 23,67.5 C30,70 34,75 34.6,82 Z" fill="url(#yxh-sd)"/><path d="M19,72 Q23,70 27,72" stroke="#F0DCAF" stroke-width=".7" fill="none" opacity=".8"/><path d="M11,10 C11,27 21,39 22.3,46 L23.7,46 C25,39 35,27 35,10 Z" fill="url(#yxh-gl)" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/><path d="M22.3,46 C21,53 11,65 11,82 L35,82 C35,65 25,53 23.7,46 Z" fill="url(#yxh-gl)" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/><path d="M14,13 C14,22 16.5,30 20,37" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".8"/><path d="M14,79 C14,70 16.5,62 20,55" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".7"/><rect x="3.5" y="9" width="3" height="74" rx="1.2" fill="url(#yxh-oak)"/><ellipse cx="5.0" cy="18" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><ellipse cx="5.0" cy="46" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><ellipse cx="5.0" cy="74" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><rect x="39.5" y="9" width="3" height="74" rx="1.2" fill="url(#yxh-oak)"/><ellipse cx="41.0" cy="18" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><ellipse cx="41.0" cy="46" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><ellipse cx="41.0" cy="74" rx="2.6" ry="1.9" fill="url(#yxh-oak)"/><rect x="1" y="2" width="44" height="7" rx="2" fill="url(#yxh-oak)"/><rect x="1" y="2" width="44" height="1.3" rx=".6" fill="#E3BE86" opacity=".55"/><rect x="1" y="84" width="44" height="7" rx="2" fill="url(#yxh-oak)"/><rect x="1" y="84" width="44" height="1.3" rx=".6" fill="#E3BE86" opacity=".55"/><rect x="5" y="9" width="36" height="2.4" rx="1" fill="#6A4523" opacity=".7"/><rect x="5" y="81" width="36" height="2.4" rx="1" fill="#6A4523" opacity=".7"/></svg></span>',
    vase: '<span class="deco d-vase" aria-hidden="true"><svg class="dz dz-vase" viewBox="0 0 78 184" width="78" height="184" aria-hidden="true" focusable="false"><defs><radialGradient id="yxp-v" cx=".34" cy=".32" r=".8"><stop offset="0" stop-color="#F4EFE5"/><stop offset=".45" stop-color="#DDD4C3"/><stop offset="1" stop-color="#A99A82"/></radialGradient><clipPath id="yxp-c"><path id="yxp-vp" d="M31,120 C31,127 27,131 22,140 C15,152 16,172 24,184 L54,184 C62,172 63,152 56,140 C51,131 47,127 47,120 Z"/></clipPath></defs><path d="M38,122 Q22,80 12,26 M40,122 Q36,60 34,6 M41,122 Q50,70 60,18 M39,122 Q58,95 70,50 M37,122 Q30,92 20,52" stroke="#A28A60" stroke-width="1.1" fill="none"/><path d="M23.1 75.4l-3.4 -4.1M23.1 75.4l2 -3.3M22.9 74.6l-5.3 -4M22.5 73.2l-4 -3M22.5 73.2l1.8 -4.2M21.6 69.6l-5.4 -3.5M21.7 70.3l-4 -3.4M21.2 68l-6.1 -5.8M21.2 68l4.1 -5.8M20.2 64.1l4.1 -7.8M19.8 62.5l2.5 -6.7M19.5 61.2l3.9 -8.2M19.1 59.5l-7.8 -6.9M18.7 57.8l-8.2 -7.2M18.4 56.6l5.3 -10.6M18 55.2l-9.2 -6.8M17.7 53.8l3.8 -9.9M17.3 52l1.6 -11.4M16.7 49.4l-8.1 -7.5M16.3 47.4l1.7 -7.1M16.3 47.3l-8.5 -7.1M15.4 43.2l-6.7 -5.8M14.8 40.3l3.4 -5.8M14.6 39.5l-5.5 -3.4M14 36.4l-4.3 -5.7M14 36.4l3.7 -4.4M13.7 34.8l2.5 -6.2M12.9 31l-4.1 -3.2M12.6 29l-4.5 -3.3M12.2 27l-2.8 -1.9M12.3 27.6l-2.6 -4.2M12.3 27.6l1.6 -4.1M12 26l2.8 1.5M36.4 59.1l-3.4 -4.2M36.4 59.1l3.4 -4M36 52.8l-6.3 -6M36 52.8l4.5 -4.2M35.9 50l4.8 -8.4M35.9 50.4l-4.1 -5.6M35.6 43.4l3.2 -6.9M35.5 41.6l-7.1 -9.5M35.4 39.5l6.2 -5.6M35.4 40.4l-5.6 -10.7M35.3 37.2l4.9 -6M35.3 37.9l4.3 -9.4M35.2 35.8l5.6 -6.8M35.2 35.8l-8.2 -6.8M35.2 34.9l4.5 -8.2M35 31.1l-7.4 -9.5M35 30.6l-6.2 -6.2M34.9 28.1l-7.5 -5.6M34.9 27.2l-6.5 -9.7M34.8 26.8l-2.9 -6.7M34.8 25.3l-6.4 -9.8M34.7 23.3l-5.4 -8.7M34.6 22.3l-4.4 -7M34.6 21.7l3.3 -7.8M34.5 19.3l-3.3 -5.6M34.6 20.4l6.7 -7.7M34.4 15.5l6.4 -6.6M34.4 15.2l-4.3 -7.3M34.2 10.2l-3.1 -4.5M34.2 10.2l2.4 -4M34.1 9.1l2.8 -3.1M34.1 8.9l-4.3 -4.7M34.1 9l-2.7 -4.5M50.6 68.2l2.7 -4.4M51.3 64.3l-3.6 -5.1M51.3 64.3l3.6 -5.2M51.4 63.7l-3.2 -6.6M51.5 63l6.3 -5.1M51.7 62.1l-5.4 -6.2M52 60.7l5.2 -7.2M52.3 58.7l6.4 -5.7M53.3 53.3l-4.3 -5.5M53.3 53.3l5.4 -5.8M53.9 50.4l-1.8 -8M54.2 48.8l-7.4 -9.2M54.4 47.3l7.1 -7M54.8 45.5l7.7 -5.3M54.8 45.4l-1.9 -7.1M55.1 43.8l8.4 -6.5M55.1 43.6l7.4 -9.9M55.3 42.5l4.6 -6.9M55.1 43.6l-7.7 -9.4M55.9 39.7l5.2 -8.4M55.9 39.7l-1.3 -8M56.2 38l7 -9.6M56.4 36.8l-6.3 -7.4M57 33.7l-2.2 -9.2M57.4 31.7l5 -5.1M57.6 30.8l-5 -6.6M57.8 29.6l5.8 -7.1M58.1 27.7l5.9 -3.6M58.4 26.2l-3.8 -8.2M58.8 24.5l4.9 -2.6M59 23.3l3.7 -4.5M59.8 18.9l2.8 -2.6M57.4 87.9l-2.4 -6.9M57.3 88l4.1 -2M58 86.2l-0.5 -5.4M58.4 85.3l-1.7 -5M58.8 84.2l-1.1 -6.4M59.1 83.5l8.1 -2.6M59.3 83.1l-1.1 -7M59.6 82.3l-0.1 -7.4M59.9 81.6l7.9 -4.5M59.8 81.7l4.9 -5M60.2 80.9l-0.5 -10.7M60.4 80.1l4.4 -4.9M60.6 79.8l7 -4.8M60.8 79.2l-2.8 -10.7M60.8 79.2l5.4 -3.9M61.5 77.3l-3.7 -7.1M62 75.8l-0.3 -7.2M62 75.8l6.7 -8M62.2 75.4l-1.2 -12.1M62.5 74.6l10.1 -4.3M63 72.9l-1.3 -12.1M63.7 70.9l-1.2 -8.5M63.7 70.9l8.7 -4.3M64.4 68.8l-1 -10.5M64.9 67.3l5.5 -4.6M65.3 66.2l-4.6 -8.1M65.3 66.2l9.3 -4.3M65.4 65.6l7.5 -2.9M66 63.8l-3.7 -5.8M66.2 63.3l-1.3 -7.1M66.2 63.3l8.7 -6.8M66.9 60.8l-4.2 -6.6M66.8 61.3l4.8 -5.4M68.3 56.1l-1.1 -5.5M68.6 55.1l4.4 -3.2M68.7 54.6l-2.6 -6.9M69 53.7l-3.1 -5M69.2 53.1l3.7 -4.9M69.1 53.4l-4 -5.9M69.5 52l-2.7 -4.4M69.7 51l-0.7 -3.8M69.7 51.1l3.8 -3M28.7 87.3l2.8 -5.2M28.4 86.1l4 -6.3M28.5 86.4l1.4 -5.7M28.3 85.7l3.4 -6.9M28.2 85.3l3.5 -7M27.9 84l1.3 -5.3M27.7 83.2l2.8 -6.1M27.1 80.6l-6.3 -4.7M26.8 79.4l-8.5 -6.3M26.5 78.2l3.5 -10M25.9 75.9l2 -9M25.4 73.6l-9.1 -4.8M25.4 73.6l1.8 -8.7M25.2 73.1l-6.1 -4.8M25.2 73.1l3.4 -6.4M25 72.2l2.5 -7.3M24.7 70.8l3.8 -9.2M24.7 71l5 -10.4M24.5 70l-9.5 -7M24.4 69.5l-6.1 -7M23.8 67.3l-5.7 -6.9M22.4 61.8l4.7 -8.4M21.9 59.5l-6.2 -3.5M21.1 56.3l-5.9 -3.2M21.1 56.3l4.2 -5.6M21 56l-4.9 -5.7M20.8 55.3l2 -4.6" stroke="#F3EBD9" stroke-opacity=".75" stroke-width="1.15" stroke-linecap="round" fill="none"/><path d="M22.9 74.6l2 -4.6M22.7 73.9l-4.4 -2.4M22.7 73.9l2.2 -5.4M22 71.4l-6.4 -3.7M20.9 67l-4.7 -5.4M20.9 67.1l-6.1 -5.5M20.4 65.2l4.1 -5.5M20.5 65.6l-5 -3.6M20.2 64.1l-6.3 -4.7M19.8 62.5l-4 -5.6M19.9 62.9l3 -6.2M18.8 58.6l-7.8 -4.2M18.6 57.7l-8.9 -6.8M18.6 57.7l6.1 -9.6M18.7 57.8l5 -8.1M18.3 56.1l5.5 -7.2M17.7 53.8l-8.1 -5.4M17.6 53.1l3.9 -6.6M17.3 52l-7 -7.3M17.2 51.5l-8.4 -4.5M17.2 51.5l2.5 -9.1M17.1 51.1l6.6 -9.9M16.7 49.4l5.5 -8.8M16.3 47.4l-5.8 -8.1M16.3 47.3l3.8 -9.5M15.9 45.5l-7.3 -5.5M15.9 45.5l5.3 -9.6M15.5 43.5l6.8 -9.4M15.4 43.2l-6.3 -9.1M15.4 43.2l6.9 -8.4M15 41.5l-6.2 -9.3M15 41.3l-6.3 -3.6M14.1 37l-4 -4.8M13.7 34.8l-7 -4.2M13.1 31.9l-4.4 -3.5M13.1 31.9l2.5 -4.1M13.3 32.7l4.4 -5.2M13.2 32.2l-4.7 -2.8M12.9 31l1.5 -6.9M12.7 30l2.1 -3.8M12.2 27l2.6 -3.6M36.3 58.1l-3.3 -5.6M36.3 57.3l4.2 -4.8M36.3 57.5l-3.4 -5.6M36.2 55.8l-3.2 -4.1M36.2 56l4.5 -4M35.8 47.8l7.6 -7.3M35.7 46.9l-7 -5.6M35.6 43.4l-4.5 -5.9M35.6 44.2l-6 -8.8M35.5 42l-5.8 -8.6M35.4 40l-5.1 -4.8M35.1 32.9l-7.1 -6.9M35.1 32.9l4.5 -6.9M35.1 33.4l3.8 -9.9M34.9 28.3l-7.7 -6.4M34.7 23l7.7 -7.3M34.6 21.8l7 -7.4M34.6 22.3l4.7 -7M34.6 20.4l-3.8 -7.5M34.5 18.3l4.5 -8M34.5 18.3l-3.5 -6.1M34.4 15.5l-3.2 -6.6M34.3 15l-2.7 -4.8M34.3 15l5 -4.6M34.3 14.9l-3.3 -4.9M34.3 14.9l4.1 -3.6M34.3 12.9l2.4 -5.5M34.3 13.8l2.4 -6.1M34.1 8.9l3.7 -5.2M34.1 9l1.9 -4.8M34.1 7.6l-3.5 -3.6M34 6l2.9 -1.4M34 6l3.8 1.5M50.6 68.2l-1 -4.2M51.6 62.6l-4.8 -6.8M52.3 59l6.4 -8M52.4 58.1l-4.5 -6.7M52.8 56.4l7.9 -5.8M52.6 57.1l5.8 -3.5M52.9 55.4l5.8 -6.9M53 55.1l6.8 -5.6M53.7 51.1l-2.2 -9.8M53.9 50.1l5.7 -8.7M54.5 46.8l-4.8 -6.7M55.1 43.8l-3.8 -6.3M55.5 41.9l-2.7 -11.1M55.8 40l-5.2 -8.5M56.2 37.9l8.4 -4.7M56.7 35.2l5.8 -3.5M56.6 35.8l-3.7 -8.8M56.6 35.8l7.6 -8.3M57 33.7l5.4 -6.1M57.1 33l-2 -8.4M57.1 33l5.6 -5.3M57.3 32l4.6 -6.4M57.3 32.2l-7 -8.5M57.6 30.8l6.7 -7.1M57.8 29.6l-3.9 -6.9M58 28.4l7.2 -4.6M58.1 27.9l-3.2 -8M58.1 27.7l-4.6 -6.2M58.4 26.2l3.8 -4.7M58.6 25.2l-1.5 -7M58.8 24.5l-3.1 -7.6M59.3 21.8l-3.6 -4.5M59.2 22.2l-1.5 -6.5M59.2 22.2l4.3 -4.2M59.6 20.2l3.1 -3M59.7 19.6l-2.1 -4.8M59.8 18.9l-2.9 -4.2M57 88.8l3.2 -2.6M57.3 88l-0.3 -5.6M57.3 88l4.1 -3.6M57.6 87.4l5.3 -3M58.2 85.7l7.3 -2.2M58.7 84.5l-0.2 -7.4M58.7 84.5l5.7 -6.1M58.7 84.7l7 -3.1M59.8 81.7l-2.8 -7.7M60.6 79.8l-3.4 -8.8M61.5 77.3l4.8 -5M61.4 77.6l9.5 -4.5M63 72.9l5.9 -5.3M63.7 70.9l-1.5 -11.1M64.1 69.8l-2.8 -7.7M64.2 69.4l-3.1 -8.8M64.6 68.4l-2.7 -7.1M64.9 67.3l9.4 -7.5M64.9 67.3l-0.5 -8.1M65.5 65.3l-0.8 -8.4M65.4 65.6l-4.3 -7.6M65.7 64.7l-1.3 -10.5M67.2 59.9l-2.5 -7.7M67.2 59.9l5.7 -2.4M67.6 58.5l-3.1 -5.3M68 57.3l-2.7 -8.5M68 57.3l4.3 -4.3M68.6 55.1l-0.9 -5.1M69 53.7l5 -4.4M69.5 52l-0.6 -5.7M69.5 52l3.6 -5M69.7 51l3.1 -4.3M29 88.6l-3.5 -4.5M28.4 85.8l1.5 -6.9M27.9 83.9l1.2 -7.6M27.5 82.3l-5.3 -5.7M27.4 82l0.9 -7.4M27.3 81.4l-5.1 -5.2M27.3 81.4l2.6 -9.2M26.9 79.8l-4.5 -6M26.9 79.8l3.2 -9.1M26.8 79.5l-7.7 -5.6M26.5 78.2l-7.3 -5.6M26.1 76.6l-6.5 -6M25.7 75.1l-4.2 -6.1M25.5 74.3l-7.1 -3.6M25.2 72.8l-8.9 -7.4M25.2 72.8l3.1 -7.6M24.8 71.2l6.7 -10M24.7 70.8l-5.7 -5.4M24.4 69.6l-8.5 -5.8M24.4 69.6l4.4 -7.9M24.4 69.5l3.6 -9.8M24.1 68.7l-6.4 -8M23.7 66.9l5.3 -7.9M23.3 65.1l-5.6 -5.6M23.4 65.8l-7 -4.9M23.4 65.8l1.8 -7.3M23.2 64.9l3.8 -10M22.7 62.8l-8.2 -7.4M22.7 62.8l2.8 -8.3M22.4 61.6l4.4 -8.1M22.4 61.6l5 -8.2M22.4 61.5l-4.9 -5.1M22.1 60.4l-8.2 -4.2M21.9 59.5l1.2 -6M21.6 58.3l-3.1 -4.4M21.6 58.3l2.8 -7.7M21.6 58.3l-3.7 -5.3M21 56l2.3 -6.6M20.8 55.3l-4 -2.8M20.8 55.3l-4.3 -5.2M20.4 53.7l-4.3 -2.8M20 52.1l1.8 -2.9M20.2 52.6l-2.6 -2.8" stroke="#E4D5B5" stroke-opacity=".7" stroke-width="1.15" stroke-linecap="round" fill="none"/><path d="M22 71.5l-5.2 -4.3M22 71.5l2.8 -7.7M21.6 69.6l1.1 -6.9M21.7 70.3l3.6 -6.4M21.5 69.3l0.8 -5.7M21.2 68.4l-4.8 -3.3M20.9 67.1l5.1 -8.2M19.9 62.9l-7.2 -5.7M19.5 61.2l-4.9 -6.3M19.2 60l2.2 -7.3M19.1 59.5l2.7 -11.5M19.2 60l-5.4 -4.4M19.2 60l6.9 -8.9M18.8 58.6l4.4 -10.1M18.3 56.1l-8.5 -4.3M17.2 51.5l4.6 -6.9M17.2 51.5l-8.5 -7.5M16 46.2l3.3 -7.5M15.5 43.5l-6.8 -5.2M15.3 42.5l2 -7.9M15.4 43.2l3.2 -8.7M15 41.5l4.4 -5.4M15 41.3l5.9 -8.7M14.5 38.7l-6.1 -8M14.5 38.7l5.5 -7M14.1 37l6.1 -7.8M14.3 38.1l-4.5 -5.8M13.6 34.6l-6.6 -5.8M13.6 34.6l4.7 -7.9M13.3 32.7l-3.7 -6.1M13.3 32.7l-4.1 -4.1M12.7 30l-2.2 -3.5M36.3 57.3l-3.2 -6.7M36.3 58.2l-2.3 -4.4M36.3 57.5l3.3 -4.1M36.1 55l-3.3 -6.9M36.1 55l4 -3.7M36 52.1l3.2 -6M35.9 50.4l2.7 -5.4M35.8 49l3.8 -5.8M35.8 47.2l4.1 -5.6M35.7 46.9l4.2 -6.7M35.7 46.2l4.9 -7.1M35.6 43.2l-5.6 -5.4M35.6 43.2l3.3 -6.2M35.4 40l5 -10.8M35.3 37.9l-6.4 -5M35.3 36.6l-7 -5.1M35.2 35.8l4.7 -9.7M35.1 33.4l-5.6 -9.8M35 30.6l9.2 -8M34.9 28.1l2.6 -8.1M34.9 28.3l5.5 -9.7M34.8 26.8l4.7 -9.8M34.8 25.3l4.6 -9.4M34.7 23l-6.3 -8.3M34.6 21.8l-4.9 -9.1M34.6 21.7l-2.7 -6M34.5 18.3l-3.8 -6.1M34.5 18.3l-3.3 -6.1M34.5 18.3l6.1 -5.9M34.4 15.2l2.8 -7.2M34.3 12.9l-4.7 -4.2M34.2 11.7l-2.2 -4.7M34.2 11.7l2.8 -4.8M34.2 11.5l-2.8 -6.4M34.2 11.5l2.3 -3.9M50.8 66.8l4.4 -4M51.4 63.7l4 -3.3M51.6 62.6l3.5 -5.5M51.8 61.3l-2.3 -7.2M52.3 59l-4.3 -8.7M52.4 58.1l8 -6.7M52.8 56.4l-2.8 -8.9M52.6 57.1l-4 -7.2M52.9 55.4l-1.3 -6.6M53 55.1l-2.3 -6.8M53 55.2l5.3 -8M53.3 53.7l-2.1 -6.4M53.8 50.6l-2.2 -8.3M53.9 50.4l6.6 -9.6M54.2 48.7l9.5 -7.3M54.2 48.8l6.1 -3.8M54.8 45.5l-4.4 -10.2M54.8 45.4l6.8 -10.1M55.1 43.6l-2.1 -10.2M55.1 43.6l8.9 -5.8M55.5 41.9l5.8 -6.9M55.4 42.1l-2.6 -8.3M55.8 40l9.2 -6.9M56.2 37.9l-6.9 -9.8M57.1 33.2l-3.6 -8.4M57.1 33.2l5.1 -6.9M57.3 32l-6.2 -7.4M57.4 31.7l-1.9 -7.5M58.1 27.8l-3.7 -6.5M58.6 25.2l5.6 -4.1M59 23.3l-3.2 -5.9M58.9 23.9l-4.3 -5.4M58.9 23.9l3.8 -3.3M59.7 19.6l2.7 -3.3M59.9 18.4l-1.9 -3.3M59.9 18.4l2.8 -3.1M59.9 18.8l-1.7 -4M57 88.8l-0.3 -4M57.4 87.9l6.3 -3.1M58.4 85.3l7.9 -3.9M59.1 83.5l-1.7 -6.6M60.2 80.9l8.1 -6.2M61.4 77.6l-4.6 -10.6M61.7 76.6l9.6 -6.9M62.4 74.8l-4 -8.6M62.4 74.8l9.1 -4.4M62.5 74.6l-3.7 -9.9M63.1 72.8l5.3 -4.8M64 70.2l10 -6.6M64.1 69.8l7.6 -8.6M64.4 68.8l7 -7.5M64.9 67.3l-1.8 -11.7M66.3 62.9l-0.9 -8M66.3 62.8l-3.3 -6M66.9 60.8l6.8 -4.5M66.8 61.3l-1.3 -6.6M67.1 60.2l-0.6 -8.5M67.6 58.5l6.8 -2.9M68 57.1l-3.1 -4.7M68 57.1l4.5 -3.9M67.8 58l-3 -6.7M67.8 58l5.8 -4.5M68.7 54.6l4.5 -3.5M69.2 53.1l-1 -4.5M69.1 53.4l4 -4.9M69.9 50.3l-0.4 -3M69.9 50.3l2.3 -2.9M28.7 87.3l-5.8 -2.9M28.4 86.1l-6.2 -5M28.5 86.4l-4.2 -5.3M28.2 85.3l-4.7 -3.4M27.9 83.9l-4.7 -3.4M27.5 82.3l3 -6M27.5 82.2l3.2 -5.1M27.1 80.6l3.9 -9.4M26.5 78.3l-6.7 -6M26.3 77.4l2.6 -7.9M26.1 76.6l1.8 -11.5M25.9 75.9l-6.6 -5M26.1 76.8l-7.7 -8.6M25.8 75.5l2.6 -6.8M25.2 73l-6 -5M25 72.2l-6 -4.1M24.8 71.2l-6.4 -7.6M23.8 67.3l5.1 -6.8M23.1 64.5l4.2 -8.6M22.7 62.8l5 -9.6M22.4 61.8l-5.2 -6.7M22.4 61.6l-5.4 -3.8M22.4 61.5l4.2 -6.7M22.1 60.4l3.8 -5.3M21.3 57.2l-4.4 -4.8M21.3 57.2l3.1 -4.3M20.8 55.3l1.8 -4.5M20.7 54.7l-3 -3M20.3 53.4l0.9 -5M20.2 52.6l0.6 -4.9" stroke="#D3BF96" stroke-opacity=".65" stroke-width="1.15" stroke-linecap="round" fill="none"/><path d="M22.6 73.6l-3 -3.4M22.6 73.6l0.6 -4.5M22 71.4l0.8 -5.9M21.5 69.3l-5.2 -5.2M21.2 68.4l4.3 -8.7M20.9 67l3.1 -9.4M20.4 65.2l-8.5 -3.9M20.5 65.6l1.5 -5.9M20 63.6l-9.6 -5.3M20 63.6l2.7 -7.9M19.2 60l-8.3 -3.9M18.4 56.6l-6.6 -6M18 55.2l4.3 -6.5M17.6 53.1l-8.3 -4.2M17.7 53.7l-4.8 -6.4M17.7 53.7l4.3 -6.7M17.1 51.1l-10 -6.7M16.7 49.4l-5.5 -4.8M16.7 49.4l3.1 -9.4M16 46.2l-7.1 -6.7M15.8 45l-6.8 -3.9M15.8 45l1.6 -7.3M15.3 42.5l-7.7 -3.9M14.8 40.3l-6.5 -5.8M14.6 39.5l3 -7.1M14.3 38.1l2.9 -6.2M13.8 35.2l-4.6 -4.1M13.8 35.2l2.1 -6.9M13.3 32.7l1.9 -4.7M13.2 32.2l1 -6M12.5 28.7l-4.9 -3.7M12.5 28.7l3.1 -4.7M12.6 29l3.4 -4.8M12 26l2.8 -2.3M36.3 58.1l4.7 -5.5M36.3 58.2l2.7 -3.6M36.2 55.8l2.3 -4.5M36.2 56l-4.6 -6M36 52.4l-4.5 -4.5M36 52.4l3 -5.3M36 52.1l-5 -6.9M35.9 50l-4 -6.4M35.8 49l-4.8 -9.2M35.8 47.8l-3.7 -5.1M35.8 47.2l-4 -8.9M35.7 46.7l-6.8 -6.6M35.7 46.7l4.8 -6.1M35.7 46.2l-4.6 -5M35.6 44.2l7.4 -7.3M35.5 42l4 -10.8M35.5 41.6l3.3 -8.5M35.4 39.5l-4.6 -5.8M35.4 40.4l7.9 -7.3M35.3 37.2l-6.7 -7.4M35.3 36.6l7.3 -9.4M35.2 35.8l-4.7 -5.6M35.2 34.9l-3.6 -8.3M35 31.1l5.9 -5.4M35.1 32.2l-4.1 -9.6M35.1 32.2l2.5 -7.1M35 30.4l-6.8 -7.3M35 30.4l3.4 -10.1M34.8 26.6l-4.2 -5.8M34.8 26.6l3.9 -8.9M34.9 27.2l5 -6.6M34.7 23.3l2.5 -7.4M34.5 19.3l5.5 -9.1M34.5 18.3l3.9 -5M34.3 13.8l-4.2 -5.5M34.1 9.1l-3.6 -5.2M34.1 7.9l-2.7 -2.3M34.1 7.9l2.3 -4.4M34.1 7.6l3.4 -4.3M50.8 66.8l-1.8 -4.9M51 66.2l-1.7 -4.8M51 66.2l4.4 -3.6M50.9 66.4l-1.2 -7.2M50.9 66.4l4 -5.2M51.5 63l-2.3 -4.8M51.7 62.1l5.5 -7.4M51.7 62.1l-3.9 -5M51.7 62.1l4.2 -6M51.8 61.3l4.2 -4.6M52 60.7l-5.3 -6.5M52.3 58.7l-1.9 -9.6M53 55.2l-5.7 -8.2M53.3 53.7l7.3 -6.2M53.7 51.1l4.6 -6.5M53.8 50.6l9.3 -7.8M53.9 50.1l-1.9 -11.3M54.2 48.7l-3.1 -9.5M54.5 46.8l7.2 -5.2M54.4 47.3l-3.5 -11.5M55.3 42.5l-6 -9.2M55.4 42.1l9.7 -5.8M55.9 39.7l-3.5 -6.3M55.9 39.7l5 -8.3M56.2 38l-2.9 -10.2M56.4 36.8l6.7 -5.5M56.7 35.2l-6.4 -8.3M57.3 32.2l6 -3.3M58 28.4l-4.6 -5.9M58.1 27.8l5.3 -6.6M58.1 27.9l4.6 -5.8M59.3 21.8l6.2 -3.3M59.6 20.2l-1.3 -5.2M59.9 18.8l2.1 -2.9M57.3 88l-1.9 -5.5M57.6 87.4l-0.4 -4.9M58 86.2l4.4 -4.1M58.2 85.7l-2.7 -5.9M58.7 84.7l-2.9 -6.2M58.8 84.2l6.2 -2.5M59.3 83.1l5.5 -2.4M59.6 82.3l6.6 -7.1M59.9 81.6l-3.3 -9.2M60.4 80.1l-1 -7.8M60.6 79.7l-2.9 -10.1M60.6 79.7l9.4 -5.7M61.7 76.6l-0.5 -10.2M61.9 76l-1.8 -10M61.9 76l7.4 -4.5M62.2 75.4l8.1 -6.6M63 73.1l-3 -8.3M63 73.1l8 -2.9M63.1 72.8l-4.1 -11.3M63.2 72.3l-5.4 -10.2M63.2 72.3l5.9 -4.9M63.7 70.9l5.6 -5M64 70.2l-1.7 -7.3M64.2 69.4l8.7 -8.4M64.6 68.4l11 -4.1M65.5 65.3l9.9 -6.3M66 63.8l6.1 -3M65.7 64.7l7.1 -4.3M66.3 62.9l6.3 -5.4M66.3 62.8l6.5 -3M66.9 60.9l-3.1 -9.8M66.9 60.9l6.6 -3.2M67.1 60.2l4.9 -4.6M68.3 56.1l7.4 -3.9M69.5 52l2.7 -2.8M69.7 51.1l-2.4 -4M29 88.6l2.1 -3.2M28.7 87.3l-4.2 -5.2M28.7 87.3l2.2 -6.3M28.4 85.8l-3.8 -3.1M28.3 85.7l-6.8 -3.3M27.9 84l-4.9 -5.5M27.7 83.2l-7.1 -6M27.5 82.2l-6.6 -5.4M27.4 82l-5.8 -4.9M26.8 79.4l5 -8.8M26.8 79.5l2.3 -6.6M26.5 78.3l2.3 -8.3M26.3 77.4l-5.9 -8.8M26.1 76.8l6.3 -8.9M25.8 75.5l-8.2 -6.8M25.7 75.1l1.5 -8.9M25.5 74.3l5.8 -7.8M25.2 73l5.4 -10.2M24.7 71l-6.3 -7.8M24.5 70l2.8 -9.2M24.1 68.7l3.3 -11.4M24 68l-9.7 -7.3M24 68l4.5 -5.9M23.7 66.9l-7.2 -5.6M23.7 66.7l-6.9 -5.7M23.7 66.7l5.4 -10.7M23.3 65.1l3 -7.9M23.2 64.9l-6.4 -3.6M23.1 64.5l-7.3 -7.2M22.7 62.8l-5.7 -4.8M22.4 61.6l-5.9 -4.6M21.8 59.4l-5.8 -4M21.8 59.4l1 -8.4M21.6 58.3l2.5 -5.6M21.1 56.2l-4.7 -6.3M21.1 56.2l2 -5.4M20.7 54.7l1.1 -6M20.3 53.4l-2.7 -3M20.4 53.7l1.6 -5.5M20 52.1l-2.5 -3" stroke="#FBF6EA" stroke-opacity=".8" stroke-width="1.15" stroke-linecap="round" fill="none"/><ellipse cx="39" cy="183.2" rx="18" ry="1.8" fill="#2A1C0E" opacity=".3"/><path d="M31,120 C31,127 27,131 22,140 C15,152 16,172 24,184 L54,184 C62,172 63,152 56,140 C51,131 47,127 47,120 Z" fill="url(#yxp-v)"/><g clip-path="url(#yxp-c)" fill="#5B4632" opacity=".38"><circle cx="25.7" cy="164.9" r="0.6"/><circle cx="22" cy="140.8" r="0.6"/><circle cx="33" cy="130.8" r="0.4"/><circle cx="17.5" cy="183.5" r="0.7"/><circle cx="20.7" cy="165.9" r="0.8"/><circle cx="41.8" cy="127" r="0.6"/><circle cx="36.1" cy="132.1" r="0.6"/><circle cx="17.4" cy="178.9" r="0.6"/><circle cx="44.6" cy="179.9" r="0.6"/><circle cx="28.1" cy="135.7" r="0.4"/><circle cx="18.2" cy="169.6" r="0.7"/><circle cx="30" cy="131.9" r="0.6"/><circle cx="54.2" cy="179.3" r="0.4"/><circle cx="51.5" cy="173.1" r="0.7"/><circle cx="31.4" cy="131.8" r="0.7"/><circle cx="31.1" cy="143.6" r="0.6"/><circle cx="33.2" cy="173.2" r="0.5"/><circle cx="18.8" cy="156.3" r="0.6"/><circle cx="53.1" cy="165.2" r="0.8"/><circle cx="58.6" cy="151.6" r="0.6"/><circle cx="23.9" cy="139.2" r="0.6"/><circle cx="20.5" cy="164" r="0.4"/><circle cx="36.5" cy="182.1" r="0.4"/><circle cx="18.8" cy="148.1" r="0.4"/><circle cx="48.8" cy="120.2" r="0.7"/><circle cx="54.6" cy="170.4" r="0.5"/><circle cx="29.5" cy="162.3" r="0.6"/><circle cx="35.5" cy="141.7" r="0.5"/><circle cx="46.3" cy="172.9" r="0.8"/><circle cx="24.2" cy="138.9" r="0.5"/><circle cx="41.8" cy="142.3" r="0.4"/><circle cx="20.7" cy="140.7" r="0.6"/><circle cx="59.7" cy="178.2" r="0.7"/><circle cx="59.9" cy="181.6" r="0.6"/><circle cx="52.7" cy="123.8" r="0.7"/><circle cx="43.8" cy="139" r="0.6"/><circle cx="58.9" cy="150.8" r="0.6"/><circle cx="30.2" cy="142" r="0.7"/><circle cx="18.2" cy="132.1" r="0.7"/><circle cx="36.7" cy="125.5" r="0.6"/><circle cx="33.4" cy="157.2" r="0.5"/><circle cx="40.3" cy="156.1" r="0.5"/><circle cx="22" cy="131.6" r="0.8"/><circle cx="41.1" cy="127.2" r="0.7"/><circle cx="28.2" cy="126.1" r="0.6"/><circle cx="28.1" cy="151.3" r="0.6"/><circle cx="27" cy="156.7" r="0.4"/><circle cx="39.6" cy="157.7" r="0.4"/><circle cx="35" cy="124.7" r="0.5"/><circle cx="55" cy="155.2" r="0.7"/><circle cx="50.3" cy="127.3" r="0.8"/><circle cx="48.8" cy="126.5" r="0.7"/><circle cx="34.2" cy="131" r="0.8"/><circle cx="41.8" cy="169.6" r="0.4"/><circle cx="51.2" cy="123.7" r="0.5"/><circle cx="33.4" cy="121" r="0.6"/><circle cx="26.4" cy="139.2" r="0.7"/><circle cx="35.7" cy="176.9" r="0.6"/><circle cx="55.4" cy="156" r="0.8"/><circle cx="55.3" cy="130.8" r="0.7"/><circle cx="32" cy="168.9" r="0.7"/><circle cx="53.3" cy="127.9" r="0.5"/><circle cx="49.4" cy="180.7" r="0.7"/><circle cx="18.9" cy="158.6" r="0.4"/><circle cx="41.1" cy="171.4" r="0.4"/><circle cx="57.7" cy="163.2" r="0.5"/><circle cx="25.5" cy="148.6" r="0.7"/><circle cx="42.6" cy="127.3" r="0.4"/><circle cx="21.9" cy="171.2" r="0.4"/><circle cx="41.4" cy="138.6" r="0.7"/></g><g clip-path="url(#yxp-c)" stroke="#7A6A55" stroke-width=".5" fill="none" opacity=".18"><path d="M15,146 Q39,148.5 63,146" /><path d="M15,153 Q39,155.5 63,153" /><path d="M15,160 Q39,162.5 63,160" /><path d="M15,167 Q39,169.5 63,167" /><path d="M15,174 Q39,176.5 63,174" /></g><ellipse cx="39" cy="120" rx="8" ry="2" fill="#B3A58E" stroke="#EDE6D8" stroke-width=".8"/><ellipse cx="39" cy="120.3" rx="5.6" ry="1.2" fill="#4A3A2A"/><path d="M26,140 C21,150 21,162 25,172" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".35"/></svg></span>',
    globe: '<span class="deco d-globe" aria-hidden="true"><svg class="dz dz-globe" viewBox="0 0 74 106" width="74" height="106" aria-hidden="true" focusable="false"><defs><radialGradient id="yxg-sea" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#9EBDB4"/><stop offset=".6" stop-color="#6E9690"/><stop offset="1" stop-color="#46676A"/></radialGradient><radialGradient id="yxg-sh" cx=".34" cy=".3" r=".78"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".28" stop-color="#fff" stop-opacity=".06"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0B1414" stop-opacity=".5"/></radialGradient><linearGradient id="yxg-br" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#F2D79A"/><stop offset=".45" stop-color="#C39A4E"/><stop offset="1" stop-color="#7E5E28"/></linearGradient><linearGradient id="yxg-oak" x1="0" x2="1"><stop offset="0" stop-color="#5E3D1E"/><stop offset=".3" stop-color="#B88A55"/><stop offset=".55" stop-color="#94673A"/><stop offset="1" stop-color="#583819"/></linearGradient><clipPath id="yxg-c"><circle cx="37" cy="37" r="27"/></clipPath></defs><ellipse cx="37" cy="105" rx="21" ry="1.8" fill="#2A1C0E" opacity=".3"/><path d="M20,104 C20,98 28,96 33,95 L41,95 C46,96 54,98 54,104 Z" fill="url(#yxg-oak)"/><rect x="19" y="103" width="36" height="2.4" rx="1.2" fill="#5E3D1E"/><rect x="35" y="69" width="4" height="26" fill="url(#yxg-oak)"/><ellipse cx="37" cy="72" rx="3.4" ry="2" fill="url(#yxg-oak)"/><path d="M25,9.3 A30.2,30.2 0 1 1 37,67.2" stroke="url(#yxg-br)" stroke-width="3" fill="none"/><path d="M25,9.3 A30.2,30.2 0 1 1 37,67.2" stroke="#FFF2CF" stroke-opacity=".45" stroke-width=".6" fill="none" transform="translate(-.5 -.3)"/><g transform="rotate(-23.5 37 37)"><circle cx="37" cy="37" r="27" fill="url(#yxg-sea)"/><g clip-path="url(#yxg-c)"><path d="M26.1,61.7 27,62 28,62.3 29.1,62.6 30.2,62.9 31.5,63 32.8,63.2 34.2,63.3 35.6,63.4 37,63.4 38.4,63.4 39.8,63.3 41.2,63.2 42.5,63 43.8,62.9 44.9,62.6 46,62.3 47,62 47.9,61.7M14.1,51.3 14.8,52.1 15.6,52.8 16.8,53.5 18.1,54.1 19.6,54.7 21.4,55.2 23.3,55.7 25.3,56.1 27.5,56.4 29.8,56.7 32.1,56.9 34.6,57 37,57.1 39.4,57 41.9,56.9 44.2,56.7 46.5,56.4 48.7,56.1 50.7,55.7 52.6,55.2 54.4,54.7 55.9,54.1 57.2,53.5 58.4,52.8 59.2,52.1 59.9,51.3M10,37 10.1,37.9 10.6,38.7 11.3,39.6 12.3,40.4 13.6,41.2 15.2,41.9 16.9,42.6 18.9,43.2 21.1,43.8 23.5,44.2 26,44.6 28.7,44.9 31.4,45.2 34.2,45.3 37,45.3 39.8,45.3 42.6,45.2 45.3,44.9 48,44.6 50.5,44.2 52.9,43.8 55.1,43.2 57.1,42.6 58.8,41.9 60.4,41.2 61.7,40.4 62.7,39.6 63.4,38.7 63.9,37.9 64,37M13.7,23.4 13.6,24.2 13.7,24.9 14.1,25.7 14.8,26.4 15.6,27.1 16.8,27.8 18.1,28.4 19.6,29 21.4,29.5 23.3,30 25.3,30.4 27.5,30.8 29.8,31 32.1,31.2 34.6,31.3 37,31.4 39.4,31.3 41.9,31.2 44.2,31 46.5,30.8 48.7,30.4 50.7,30 52.6,29.5 54.4,29 55.9,28.4 57.2,27.8 58.4,27.1 59.2,26.4 59.9,25.7 60.3,24.9 60.4,24.2 60.3,23.4M25.3,12.7 24.7,13.1 24.2,13.5 23.8,13.9 23.6,14.3 23.5,14.8 23.6,15.2 23.8,15.6 24.2,16.1 24.7,16.5 25.3,16.8 26.1,17.2 27,17.6 28,17.9 29.1,18.1 30.2,18.4 31.5,18.6 32.8,18.7 34.2,18.8 35.6,18.9 37,18.9 38.4,18.9 39.8,18.8 41.2,18.7 42.5,18.6 43.8,18.4 44.9,18.1 46,17.9 47,17.6 47.9,17.2 48.7,16.8 49.3,16.5 49.8,16.1 50.2,15.6 50.4,15.2 50.5,14.8 50.4,14.3 50.2,13.9 49.8,13.5 49.3,13.1 48.7,12.7M38.7,10.1 38.2,10.2 37.6,10.6 37,11.3M34.4,10.1 35.3,10.2 36.1,10.6 37,11.3M28.8,11.3 30.8,10.9 32.8,10.7 34.9,10.9 37,11.3M15.6,20.5 17.4,18.5 19.3,16.8 21.5,15.2 23.8,13.9 26.3,12.8 28.8,12 31.5,11.5 34.2,11.3 37,11.3M17.9,56.1 16.2,54.2 14.8,52.1 13.5,49.8 12.6,47.4 11.9,44.9 11.5,42.2 11.3,39.6 11.5,36.9 11.9,34.2 12.6,31.5 13.5,28.9 14.8,26.4 16.2,24 17.9,21.7 19.8,19.6 21.9,17.7 24.2,16.1 26.6,14.6 29.1,13.4 31.7,12.4 34.3,11.7 37,11.3M29.7,63 28,62.3 26.4,61.4 24.9,60.2 23.6,58.8 22.4,57.1 21.4,55.2 20.5,53.1 19.8,50.8 19.3,48.4 19,45.9 18.9,43.2 19,40.5 19.3,37.7 19.8,35 20.5,32.2 21.4,29.5 22.4,26.9 23.6,24.4 24.9,22.1 26.4,19.9 28,17.9 29.7,16.1 31.4,14.5 33.2,13.2 35.1,12.1 37,11.3M34.7,63.8 34.2,63.3 33.7,62.6 33.2,61.5 32.8,60.2 32.5,58.7 32.1,56.9 31.9,54.9 31.7,52.7 31.5,50.3 31.4,47.8 31.4,45.2 31.4,42.4 31.5,39.6 31.7,36.8 31.9,34 32.1,31.2 32.5,28.5 32.8,25.9 33.2,23.4 33.7,21 34.2,18.8 34.7,16.9 35.3,15.1 35.8,13.6 36.4,12.3 37,11.3M40.4,63.7 41.2,63.2 41.9,62.4 42.6,61.4 43.2,60.1 43.8,58.5 44.2,56.7 44.6,54.7 44.9,52.5 45.2,50.1 45.3,47.6 45.3,44.9 45.3,42.2 45.2,39.4 44.9,36.6 44.6,33.8 44.2,31 43.8,28.3 43.2,25.7 42.6,23.2 41.9,20.9 41.2,18.7 40.4,16.8 39.6,15 38.7,13.5 37.9,12.3 37,11.3M47,62 48.8,61.1 50.4,59.8 51.9,58.3 53.2,56.6 54.4,54.7 55.3,52.5 56.1,50.2 56.6,47.8 57,45.2 57.1,42.6 57,39.9 56.6,37.1 56.1,34.4 55.3,31.7 54.4,29 53.2,26.4 51.9,24 50.4,21.7 48.8,19.5 47,17.6 45.2,15.8 43.2,14.3 41.2,13 39.1,12 37,11.3M59.9,51.3 61.1,49 62.1,46.6 62.8,44 63.3,41.4 63.4,38.7 63.3,36 62.8,33.4 62.1,30.7 61.1,28.1 59.9,25.7 58.4,23.3 56.6,21.1 54.7,19.1 52.5,17.2 50.2,15.6 47.7,14.2 45.2,13.1 42.5,12.2 39.8,11.6 37,11.3M54.2,16.2 52.1,14.7 49.8,13.5 47.4,12.5 44.9,11.8 42.3,11.3 39.7,11.2 37,11.3M42.6,10.7 40.8,10.6 38.9,10.8 37,11.3" stroke="#E8F0EA" stroke-opacity=".3" stroke-width=".35" fill="none"/><path d="M10,37 10.1,37.9 10.6,38.7 11.3,39.6 12.3,40.4 13.6,41.2 15.2,41.9 16.9,42.6 18.9,43.2 21.1,43.8 23.5,44.2 26,44.6 28.7,44.9 31.4,45.2 34.2,45.3 37,45.3 39.8,45.3 42.6,45.2 45.3,44.9 48,44.6 50.5,44.2 52.9,43.8 55.1,43.2 57.1,42.6 58.8,41.9 60.4,41.2 61.7,40.4 62.7,39.6 63.4,38.7 63.9,37.9 64,37" stroke="#C6563F" stroke-opacity=".55" stroke-width=".5" fill="none"/><path d="M29.3,27.8 29.6,26.5 29.9,25.2 31.3,24.7 32.6,24.2 31.9,23.3 33.1,22.8 34,22.2 34.9,21.7 35.9,21.1 36.1,20 36.6,19.8 36.5,20.9 37.6,21.1 38.9,20.9 39.4,19.9 40,19.7 40.9,18.9 39.6,18.9 39.1,18.4 39,17.5 39.5,17 38.9,16.9 38.1,18.1 38.5,18.9 38.2,20 37.1,20.4 36.8,19.3 35.5,19.6 35.4,18.6 35.9,17.9 36.6,17.4 37.2,16.9 37.7,16 38.1,15.8 38.6,15.5 39,15.4 39.4,15.3 40.3,15.5 41.1,15.8 41.9,16.1 42.4,16.3 42.2,15.7 42.8,15.6 43.3,15.5 43.7,15.3 44,14.9 44,14.5 43.9,14.1 43.7,13.7 43.9,13.6 44.1,13.5 44.3,13.4 44.2,13.1 44.1,12.9 43.9,12.7 43.7,12.5 43.5,12.3 43.4,12.2 43.3,12.1 43.3,12 43.1,11.8 43,11.7 43.3,11.7 43.6,11.6 43.9,11.6 44.1,11.5 44.3,11.5 44.2,11.4 44.1,11.3 43.9,11.2 43.8,11.1 43.6,11 43.4,10.9 43.1,10.8 42.9,10.7 42.6,10.6 42.3,10.5 41.9,10.5 41.5,10.4 41.1,10.3 40.6,10.2 40.1,10.2 39.6,10.1 39.1,10.1 39.5,10.1 39.9,10.2 40.7,10.2 41.4,10.4 42.2,10.5 43,10.7 43.7,10.9 44.5,11 46,11.5 46.4,11.7 47.9,12.3 49.5,13.1 51.4,14.2 52.9,15.2 54.3,16.2 55.7,17.5 57,18.9 56.4,18.3 57.7,19.6 58.9,21.2 59.7,22.4 60.4,23.5 61,24.6 61.5,25.6 61.8,26.2 62,26.8 62.6,28.5 63,29.6 63.2,30.7 63.6,32.6 63.9,34.4 64,36.2 63.8,34.6 63.6,33 63.3,31.7 62.9,30.5 62.6,30.6 61.8,29.2 61.4,29.1 61.3,29.8 61.3,31.5 61.1,33.1 61.7,35.6 61.2,36.9 60.8,35.7 59.7,33.8 58.9,31.6 58.2,31.3 57.1,30.7 55.7,31 54.2,31.3 53.9,30.6 53.5,32.1 52.6,32.2 51.9,31.7 50.8,30.2 50.9,30 52.1,30.9 52.3,31.6 54.1,32 55.4,32.4 55.1,34.4 53.7,36.1 52.5,37.1 51.3,38 50.7,38.4 50.2,37.3 49.4,36 48.4,34.7 46.8,32.4 46.1,31.8 45.7,30.3 45.8,28.3 45.8,27.8 44.4,28 43.5,28.1 42.5,27.8 42.2,26.7 42,26.4 41.2,26.4 40.8,26.6 41.3,27.6 40.8,28.3 40.3,27.5 39.7,26.6 39.6,26 38.2,24.7 37.6,24.5 37.1,25.2 38.4,26.2 39.3,26.8 38.8,27.3 38.5,27.7 38.3,26.9 37.7,26.4 36.7,25.8 36.3,25.2 35.6,25.1 34.9,25.6 34,25.4 33.9,25.9 33,26.3 32.6,27 32.6,27.4 31.8,28.1 30.4,28.3 29.8,27.8ZM24.3,37.5 24.9,35.3 24.8,34.6 25.9,32.9 26.9,31.9 28.2,31.1 28.7,29.8 29.9,29.2 30.3,28.4 31.7,28.8 33.6,28.2 34.9,28.2 36.2,28.1 36.6,28.8 36.3,29.4 36.7,29.9 38.2,30.3 40.1,31.1 40.2,30.4 41.3,30.1 42.2,30.4 43.8,30.6 44.9,30.4 45.7,30.3 46.1,31.8 47,33.4 47.9,35.1 48.5,36.2 50.7,38.4 51.3,39.3 52.5,38.7 53.7,38.1 53.7,38.7 52.6,41.8 51.7,43.2 50.1,45.2 49.4,46.6 49.2,48.3 49.6,49.1 49.4,50.7 47.9,51.9 47,53.7 46.8,54.4 45.5,55.3 45.3,56.2 44.6,56.7 43.2,57.7 42.2,58.1 40.9,58.2 40.1,58.4 39.5,58.2 39.4,57.5 38.9,56.6 38.3,56.1 38.1,54.5 36.9,52.6 37.1,50.9 37.7,50.1 37.5,49 37.1,48 37,47.5 36.8,46.9 35.8,45.6 35.9,44.2 35.5,43.3 34.2,43.3 33.5,42.4 32.1,42.4 30.5,43 29.6,42.7 28,42.9 27.1,42.3 26.3,41.5 25.6,40.7 25,39.4 24.3,38.6ZM50,54.3 51,54 51.8,52.8 52.5,51.5 53.2,50.2 53,48.8 52.4,49.6 50.8,51.1 50.1,53.2ZM31.8,22.4 32.8,22.3 33.9,22.2 34.1,21.5 33.7,21.2 33.4,20.4 33.5,19.7 33.2,19.3 32.9,19.2 32.4,19.9 32.5,20.5 32.9,20.8 32.8,21.2 32.3,21.4 32.1,21.8 32.5,21.9ZM31.9,21.7 32.1,20.9 31.9,20.4 31.1,20.7 30.6,21.6 31.3,21.8ZM10,38.1 10.1,39.2 10.2,40.7 10.8,43.5 11.6,46.1 12.4,48.1 13,49.4 13.7,50.7 14.5,51.9 15.3,53.1 16.2,54.2 17.1,55.2 18.6,56.7 20.1,58 20.9,58.7 21.7,59.3 21.7,59.3 20.5,58.4 20.2,58.1 19.6,57.6 19.1,57.2 18.5,56.6 18.2,56.4 17.6,55.8 17.4,55.6 16.8,54.9 17.1,55.1 16.8,54.7 16.3,54.2 16.7,54.4 16.6,54.1 16.5,53.6 16.3,52.8 15.8,51.8 16.3,51.4 17,51.3 16.9,50.1 16.6,48.1 16.9,47.3 17.4,46.1 17.2,45 16.2,44 15.4,43.3 14.5,42.7 13.6,41.6 13.2,40.9 12.9,38.9 12.5,37.8 11.9,37.3 11.5,35.6 11.4,34.4 11,34 10.9,32.7 10.7,33 10.7,32.6 10.5,32.6 10.3,33.3 10.2,33.8 10.1,35.3 10,36.2 10,36.4ZM10.3,32.8 10.3,33.5 10.4,32.6 10.6,31.4 11,29.6 11.4,28.5 11.8,27.4 12.2,26.4 12.3,26.1 11.9,26.9 12.1,26.6 12.8,25 13.8,23.1 14.3,22.5 14.4,22.3 13.8,23.1 14.1,22.7 13.7,23.4 13.2,24.5 12.6,25.7 12.9,25.1 13.7,23.7 14.2,23 14.9,22.5 15.5,21.7 16.5,20.8 17,20.9 17.6,20.1 18.2,20 18.6,20.1 18.8,20.5 19.1,19.7 19.7,18.6 20.1,18.8 20.6,18.9 21.4,18.8 22.1,18.2 22.6,17.1 24,15.7 23.2,15.6 24,15.1 24.2,14.7 24.4,14.3 23.5,14.8 22.1,15.6 21.1,16.1 20.8,16.2 21.7,15.3 22.2,14.8 22.8,14.3 23.7,13.7 24.4,13.4 25.4,13.2 26.4,12.9 27.1,12.9 27.8,12.7 28,12.5 28.3,12.2 28.7,12 29,11.8 29.2,11.7 29.5,11.5 29.7,11.4 30,11.3 30.3,11.2 30.3,11.1 30.4,11 30.4,10.9 30.5,10.9 30.7,10.8 31.1,10.7 31.4,10.6 31.8,10.5 32.2,10.4 32.7,10.4 33.1,10.3 33.6,10.2 34,10.2 34.5,10.1 35,10.1 35.5,10 36,10 36.5,10 37,10 37.4,10 37.9,10 38.4,10 38.9,10.1 39.2,10.1 39.5,10.1 39.8,10.1 40.1,10.2 40.4,10.2 40.7,10.3 41,10.3 41.4,10.4 41.7,10.4 42.1,10.5 42.5,10.6 42.9,10.7 43.4,10.8 41.8,10.4 40.3,10.2 38.6,10 37,10 35.4,10 33.8,10.2 32.2,10.4 30.7,10.7 29.3,11.1 28,11.6 26.7,12 25.5,12.6 24.4,13.1 23.4,13.7 22.4,14.3 21.5,14.9 20.7,15.4 20,16 19.4,16.6 18.7,17.1 18.2,17.6 16.4,19.5 14.6,22 13.3,24.1 12.7,25.2 12.2,26.3 11.8,27.3 11.4,28.5 11,29.9 10.7,30.9ZM31.4,12 31.9,12 32.4,12 32.9,12 33.4,11.9 33.6,12 33.7,12 33.8,12 34,12.1 34.1,12.1 34.3,12.1 34.5,12.1 34.6,12.2 34.8,12.2 35,12.2 34.8,12.4 34.8,12.5 34.8,12.7 34,13.6 32.5,14.7 31.6,15.2 30.8,15.3 30,15.4 29,15.7 28,15.9 25.9,17.2 25.7,16.6 26.5,15.6 27.4,14.7 28.6,14 29.7,13.4 29.9,13.1 30.3,12.8 30.6,12.5 31,12.3ZM30,16.9 31,16.2 31.6,16.4 32.2,16.5 32.1,16.9 31.7,17.1 30.8,17.2 30.2,17Z" fill="#E7D7AE" stroke="#9B8558" stroke-width=".35" stroke-linejoin="round"/><circle cx="37" cy="37" r="27" fill="url(#yxg-sh)"/></g><circle cx="37" cy="37" r="27" fill="none" stroke="#2E4446" stroke-opacity=".35" stroke-width=".6"/><circle cx="37" cy="9" r="1.7" fill="url(#yxg-br)"/><circle cx="37" cy="65" r="1.7" fill="url(#yxg-br)"/></g><path d="M34.6,66.2 h4.8 l-.6 4 h-3.6z" fill="url(#yxg-br)"/></svg></span>',
    succ: '<span class="deco d-succ" aria-hidden="true"><svg class="dz dz-succ" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><defs><linearGradient id="yxs-pot" x1="0" x2="1"><stop offset="0" stop-color="#8B4528"/><stop offset=".3" stop-color="#CF7C4F"/><stop offset=".6" stop-color="#B9663D"/><stop offset="1" stop-color="#7E3C22"/></linearGradient><linearGradient id="yxs-rim" x1="0" x2="1"><stop offset="0" stop-color="#9A5130"/><stop offset=".3" stop-color="#E09166"/><stop offset=".65" stop-color="#C46F44"/><stop offset="1" stop-color="#874227"/></linearGradient></defs><ellipse cx="32" cy="63" rx="17" ry="1.6" fill="#2A1C0E" opacity=".3"/><path d="M15,41 L18,63 L46,63 L49,41 Z" fill="url(#yxs-pot)"/><path d="M37,44 L39.5,61" stroke="#E7A07A" stroke-width="1.6" stroke-linecap="round" opacity=".35"/><path d="M13,35 L51,35 L51,41.5 Q32,43.5 13,41.5 Z" fill="url(#yxs-rim)"/><ellipse cx="32" cy="35" rx="19" ry="3.2" fill="#3B281A"/><path d="M13,35 Q32,38.6 51,35" stroke="#EDA57C" stroke-width=".7" fill="none" opacity=".7"/><path d="M32.5,34.1 35,32.5 37.2,30.9 39.2,29.4 40.8,27.9 41.9,26.5 42.4,25.1 41.5,23.5 39.2,21.7 39.2,21.7 35.2,22.3 32.4,23.1 31.1,24.4 30.4,25.9 30.2,27.6 30.4,29.6 30.8,31.7 31.5,33.9Z" fill="#B2C9BB" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M42.4,25.1 41.5,23.5 39.2,21.7 39.2,21.7 35.2,22.3 32.4,23.1Z" fill="#C2727A" opacity=".55"/><path d="M32.9,32.1 L37.4,24.1" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.5,33.9 33,31.4 33.3,29 33.3,26.7 33,24.7 32.2,22.9 30.7,21.4 27.9,20.4 23.8,19.7 23.8,19.7 21.7,21.8 20.9,23.6 21.5,25.3 22.8,27 24.5,28.7 26.6,30.5 28.9,32.3 31.5,34.1Z" fill="#B2C9BB" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M30.7,21.4 27.9,20.4 23.8,19.7 23.8,19.7 21.7,21.8 20.9,23.6Z" fill="#C2727A" opacity=".55"/><path d="M31,31.8 L25.8,22.5" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.3,34.2 35.6,33.7 38.7,33.1 41.7,32.5 44.5,31.8 47,31 49.2,30.1 50.5,28.5 51.2,26.3 51.2,26.3 47,25.3 43.6,25 41,25.6 38.7,26.6 36.7,27.9 34.9,29.7 33.2,31.6 31.7,33.8Z" fill="#B3CABC" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M49.2,30.1 50.5,28.5 51.2,26.3 51.2,26.3 47,25.3 43.6,25Z" fill="#C2727A" opacity=".55"/><path d="M34.4,32.7 L46.4,27.6" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.3,33.8 30.7,31.2 29,28.8 27.1,26.7 25,24.9 22.6,23.5 19.9,22.6 16.3,22.4 11.9,23 11.9,23 12.6,25.5 14,27.5 16.3,28.9 18.9,30.1 21.8,31.2 25,32.2 28.3,33.3 31.7,34.2Z" fill="#AEC5B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M19.9,22.6 16.3,22.4 11.9,23 11.9,23 12.6,25.5 14,27.5Z" fill="#C2727A" opacity=".55"/><path d="M29.5,32.2 L17,25.1" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.4,33.2 33.4,30.7 34,28.3 34.5,26 34.5,23.9 34.2,22.1 33.2,20.5 30.9,19.2 27.5,18.1 27.5,18.1 25.1,20.1 24,21.9 24.2,23.7 24.9,25.4 26.1,27.3 27.7,29.3 29.5,31.3 31.6,33.3Z" fill="#B7CDC0" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M33.2,20.5 30.9,19.2 27.5,18.1 27.5,18.1 25.1,20.1 24,21.9Z" fill="#C2727A" opacity=".55"/><path d="M31.4,31 L28.6,21.2" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.4,33.4 34.8,31.5 36.9,29.7 38.8,27.9 40.4,26.1 41.5,24.3 42.2,22.6 41.6,20.6 39.9,18.3 39.9,18.3 36.2,19 33.7,20.1 32.4,21.6 31.5,23.5 31.1,25.6 31.1,28 31.2,30.5 31.6,33.1Z" fill="#C0D5C7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M42.2,22.6 41.6,20.6 39.9,18.3 39.9,18.3 36.2,19 33.7,20.1Z" fill="#C2727A" opacity=".55"/><path d="M33,31 L37.9,21.3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.3,33.1 31.3,30.6 30.2,28.3 29,26.2 27.6,24.4 25.8,23 23.8,22 20.9,21.8 17.4,22.1 17.4,22.1 17.5,24.5 18.3,26.4 19.9,27.8 21.8,29 24,30.1 26.5,31.3 29,32.4 31.7,33.5Z" fill="#AFC6B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M23.8,22 20.9,21.8 17.4,22.1 17.4,22.1 17.5,24.5 18.3,26.4Z" fill="#C2727A" opacity=".55"/><path d="M30.2,31.5 L21,24.2" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32,33.7 29.2,32.3 26.4,31.1 23.6,30.2 20.8,29.6 18,29.5 15.1,29.9 12.3,31.3 9.4,33.4 9.4,33.4 12.2,35 15,35.8 17.8,35.9 20.6,35.8 23.5,35.5 26.3,35.2 29.1,34.8 32,34.3Z" fill="#B0C7BA" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M15.1,29.9 12.3,31.3 9.4,33.4 9.4,33.4 12.2,35 15,35.8Z" fill="#C2727A" opacity=".55"/><path d="M29.2,33.5 L15,32.9" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.2,33.5 34.8,32.7 37.4,31.8 39.8,30.9 42.2,30 44.3,29 46.2,27.8 47.6,25.9 48.6,23.6 48.6,23.6 45.4,22.8 42.6,22.8 40.4,23.6 38.4,24.8 36.6,26.5 34.9,28.4 33.3,30.6 31.8,33Z" fill="#C0D5C7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M46.2,27.8 47.6,25.9 48.6,23.6 48.6,23.6 45.4,22.8 42.6,22.8Z" fill="#C2727A" opacity=".55"/><path d="M34.1,31.7 L44.4,25.3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32,34.3 35,34.5 38,34.7 41,34.8 44,34.8 47,34.6 50.1,34.3 53.1,33.2 56.3,31.4 56.3,31.4 53.3,29.4 50.3,28.3 47.3,28.2 44.3,28.6 41.2,29.4 38.2,30.6 35.1,32 32,33.7Z" fill="#B5CBBD" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M50.1,34.3 53.1,33.2 56.3,31.4 56.3,31.4 53.3,29.4 50.3,28.3Z" fill="#C2727A" opacity=".55"/><path d="M35,33.3 L50.2,31.3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.4,32.5 33.9,30.4 35.2,28.4 36.2,26.4 37,24.6 37.3,22.9 37.2,21.3 35.8,19.7 33.5,18.1 33.5,18.1 30.7,19.3 29,20.7 28.5,22.2 28.5,24 28.9,25.9 29.6,28 30.5,30.2 31.6,32.5Z" fill="#C0D5C7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M37.2,21.3 35.8,19.7 33.5,18.1 33.5,18.1 30.7,19.3 29,20.7Z" fill="#C2727A" opacity=".55"/><path d="M32.2,30.3 L33.1,21" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.3,32.4 32.8,30 33.1,27.7 33.2,25.6 33,23.7 32.5,22.1 31.6,20.8 29.6,19.9 26.8,19.4 26.8,19.4 25.2,21.4 24.6,23.2 24.9,24.7 25.7,26.2 26.9,27.8 28.3,29.3 29.9,31 31.7,32.6Z" fill="#AFC6B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M31.6,20.8 29.6,19.9 26.8,19.4 26.8,19.4 25.2,21.4 24.6,23.2Z" fill="#C2727A" opacity=".55"/><path d="M31.3,30.5 L28.1,22" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.2,32.7 34.2,31.3 35.9,29.9 37.6,28.5 39,27.1 40.2,25.7 41,24.2 41.1,22.3 40.5,20 40.5,20 37.7,20.1 35.7,20.7 34.4,21.9 33.5,23.4 32.8,25.3 32.3,27.5 31.9,29.8 31.8,32.3Z" fill="#C7DBCD" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M41,24.2 41.1,22.3 40.5,20 40.5,20 37.7,20.1 35.7,20.7Z" fill="#C2727A" opacity=".55"/><path d="M33.1,30.6 L38.4,22.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32,33 29.8,31.2 27.7,29.6 25.6,28.3 23.4,27.2 21.3,26.7 19.2,26.5 17.2,27.3 15.2,28.8 15.2,28.8 17.3,30.7 19.5,31.9 21.6,32.4 23.7,32.8 25.8,33.1 27.9,33.3 30,33.4 32,33.5Z" fill="#A9C1B4" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M19.2,26.5 17.2,27.3 15.2,28.8 15.2,28.8 17.3,30.7 19.5,31.9Z" fill="#C2727A" opacity=".55"/><path d="M29.9,32.3 L19.4,29.2" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.1,32.3 31,30.1 29.8,28 28.5,26.2 27.2,24.6 25.8,23.5 24.3,22.7 22.5,22.7 20.4,23.4 20.4,23.4 21.2,25.5 22.3,27.2 23.6,28.3 25.1,29.3 26.7,30.2 28.4,31 30.1,31.9 31.9,32.7Z" fill="#A2BBAD" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M24.3,22.7 22.5,22.7 20.4,23.4 20.4,23.4 21.2,25.5 22.3,27.2Z" fill="#C2727A" opacity=".55"/><path d="M30.5,31 L23.3,25" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.3,31.8 33.4,30.3 34.4,28.8 35.1,27.5 35.7,26.2 35.9,25.1 35.7,24.1 34.7,23.1 32.8,22.2 32.8,22.2 30.8,22.8 29.5,23.6 29.1,24.6 29.2,25.7 29.5,27 30.1,28.5 30.8,30.1 31.7,31.7Z" fill="#C0D5C7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M35.7,24.1 34.7,23.1 32.8,22.2 32.8,22.2 30.8,22.8 29.5,23.6Z" fill="#C2727A" opacity=".55"/><path d="M32.1,30.2 L32.6,23.9" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.2,31.6 32.4,29.7 32.5,27.9 32.4,26.3 32.2,25 31.8,23.9 31.1,23.1 29.8,22.8 27.9,22.9 27.9,22.9 27.1,24.4 26.8,25.7 27.2,26.7 27.7,27.7 28.5,28.7 29.5,29.7 30.6,30.8 31.8,31.9Z" fill="#A3BBAE" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M31.1,23.1 29.8,22.8 27.9,22.9 27.9,22.9 27.1,24.4 26.8,25.7Z" fill="#C2727A" opacity=".55"/><path d="M31.5,30.3 L29,24.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,33.8 28.3,33.5 25.1,33.3 22,33.4 19.2,33.8 16.7,34.7 14.6,35.9 13.4,37.9 12.9,40.7 12.9,40.7 17.3,40.9 20.9,40.7 23.5,39.8 25.7,38.8 27.7,37.7 29.4,36.6 30.9,35.5 32.3,34.2Z" fill="#AFC6B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M14.6,35.9 13.4,37.9 12.9,40.7 12.9,40.7 17.3,40.9 20.9,40.7Z" fill="#C2727A" opacity=".55"/><path d="M29.6,34.5 L17.7,38.3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32,32.7 33.1,32.1 34.2,31.5 35.3,30.8 36.5,30.1 37.7,29.4 38.9,28.5 40.2,27 41.6,25 41.6,25 40.6,24.1 39.5,23.9 38.3,24.4 37.1,25.4 35.8,26.7 34.6,28.4 33.3,30.2 32,32.3Z" fill="#BFD5C7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M38.9,28.5 40.2,27 41.6,25 41.6,25 40.6,24.1 39.5,23.9Z" fill="#C2727A" opacity=".55"/><path d="M33.2,31.2 L39.2,26.2" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.8,33.5 33,33.6 34.3,33.6 35.7,33.5 37.2,33.5 39,33.3 41,33 43.6,32.1 46.8,30.7 46.8,30.7 46.2,29.1 45.1,28.2 43.5,28.1 41.5,28.4 39.4,29.2 37.1,30.2 34.7,31.5 32.2,33Z" fill="#B8CEC0" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M41,33 43.6,32.1 46.8,30.7 46.8,30.7 46.2,29.1 45.1,28.2Z" fill="#C2727A" opacity=".55"/><path d="M33.8,32.5 L43.1,30.6" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.1,31.9 32.9,31.1 33.6,30.3 34.4,29.5 35,28.6 35.6,27.8 36,26.9 36.2,25.6 36.2,24 36.2,24 35.2,23.5 34.3,23.5 33.7,24.1 33.2,25.1 32.8,26.4 32.5,27.9 32.2,29.7 31.9,31.6Z" fill="#C2D7C9" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M36,26.9 36.2,25.6 36.2,24 36.2,24 35.2,23.5 34.3,23.5Z" fill="#C2727A" opacity=".55"/><path d="M32.5,30.4 L35.2,25.2" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,34.2 32.9,35.3 34.3,36.3 35.8,37.4 37.7,38.4 39.9,39.3 42.5,40.1 46.1,40.3 50.6,40 50.6,40 50.5,37.5 49.4,35.6 47.4,34.4 44.9,33.7 42.1,33.3 39,33.3 35.8,33.4 32.3,33.8Z" fill="#B1C8BB" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M42.5,40.1 46.1,40.3 50.6,40 50.6,40 50.5,37.5 49.4,35.6Z" fill="#C2727A" opacity=".55"/><path d="M34.3,34.4 L46,37.8" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,33 29.2,31.8 26.8,30.7 24.5,29.8 22.4,29.3 20.6,29.1 19.2,29.3 18.5,30.3 18.5,31.9 18.5,31.9 21.9,33 24.6,33.7 26.5,33.8 28.1,33.9 29.4,33.8 30.5,33.7 31.5,33.6 32.3,33.5Z" fill="#A0B9AB" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M19.2,29.3 18.5,30.3 18.5,31.9 18.5,31.9 21.9,33 24.6,33.7Z" fill="#C2727A" opacity=".55"/><path d="M30.3,32.7 L21.9,31.5" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.2,31.1 32.9,30.2 33.5,29.3 34,28.5 34.4,27.9 34.5,27.3 34.4,26.8 33.7,26.3 32.5,25.8 32.5,25.8 31.1,25.8 30.3,25.9 30.1,26.3 30.1,26.9 30.3,27.7 30.7,28.7 31.2,29.8 31.8,31Z" fill="#BCD1C4" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M34.4,26.8 33.7,26.3 32.5,25.8 32.5,25.8 31.1,25.8 30.3,25.9Z" fill="#C2727A" opacity=".55"/><path d="M32.1,30 L32.4,26.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.1,30.9 32.3,29.5 32.4,28.3 32.4,27.2 32.4,26.3 32.2,25.7 31.9,25.3 31.3,25.4 30.4,25.8 30.4,25.8 29.9,26.7 29.6,27.5 29.8,28 30,28.5 30.4,29.1 30.8,29.7 31.3,30.4 31.9,31.1Z" fill="#93ADA0" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M31.9,25.3 31.3,25.4 30.4,25.8 30.4,25.8 29.9,26.7 29.6,27.5Z" fill="#C2727A" opacity=".55"/><path d="M31.8,30 L30.8,26.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.9,31.6 31,29.8 30.1,28.2 29.2,26.8 28.4,25.6 27.6,24.8 26.9,24.3 26.5,24.5 26.2,25.1 26.2,25.1 27.4,26.6 28.4,27.8 29.2,28.5 29.9,29.2 30.5,29.9 31,30.6 31.6,31.3 32.1,31.9Z" fill="#8BA699" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M26.9,24.3 26.5,24.5 26.2,25.1 26.2,25.1 27.4,26.6 28.4,27.8Z" fill="#C2727A" opacity=".55"/><path d="M31.3,30.5 L27.7,26.1" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.9,31.1 31.8,30.5 31.8,30 31.7,29.4 31.8,28.9 31.9,28.5 32.1,28 32.6,27.3 33.3,26.4 33.3,26.4 33.6,25.9 33.8,25.7 33.7,26 33.5,26.5 33.2,27.3 32.9,28.4 32.5,29.6 32.1,30.9Z" fill="#AEC5B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M32.1,28 32.6,27.3 33.3,26.4 33.3,26.4 33.6,25.9 33.8,25.7Z" fill="#C2727A" opacity=".55"/><path d="M32.2,30.1 L33,26.9" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,32.3 29.8,31.1 28,30 26.4,29.1 24.9,28.5 23.8,28.2 23,28.2 22.9,28.9 23.6,30 23.6,30 26.3,31 28.4,31.7 29.7,31.9 30.6,32.1 31.3,32.2 31.8,32.4 32.1,32.5 32.3,32.7Z" fill="#9BB4A7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M23,28.2 22.9,28.9 23.6,30 23.6,30 26.3,31 28.4,31.7Z" fill="#C2727A" opacity=".55"/><path d="M30.9,31.8 L25.7,30" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32.1,30.3 32.5,29.4 32.9,28.7 33.1,28.1 33.3,27.6 33.3,27.3 33.2,27.2 32.7,27.3 31.8,27.4 31.8,27.4 31,27.5 30.6,27.6 30.5,27.8 30.5,28 30.7,28.4 31,29 31.4,29.6 31.9,30.3Z" fill="#AEC5B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M33.2,27.2 32.7,27.3 31.8,27.4 31.8,27.4 31,27.5 30.6,27.6Z" fill="#C2727A" opacity=".55"/><path d="M32,29.5 L31.9,27.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.8,31 31,29.9 30.4,29 29.8,28.2 29.4,27.6 29.3,27.2 29.3,27 29.9,27.1 31.1,27.4 31.1,27.4 32.4,27.8 33.3,28.1 33.6,28.4 33.6,28.8 33.4,29.2 33.1,29.8 32.7,30.4 32.2,31.1Z" fill="#8EA99D" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M29.3,27 29.9,27.1 31.1,27.4 31.1,27.4 32.4,27.8 33.3,28.1Z" fill="#C2727A" opacity=".55"/><path d="M31.9,30.2 L31.3,27.6" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M32,30.3 31.9,29.9 31.9,29.5 31.8,29.1 31.8,28.8 31.8,28.6 31.9,28.5 32,28.2 32.2,27.8 32.2,27.8 32.4,27.3 32.5,27 32.5,27 32.4,27.3 32.3,27.8 32.3,28.4 32.1,29.3 32,30.2Z" fill="#B1C8BA" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M31.9,28.5 32,28.2 32.2,27.8 32.2,27.8 32.4,27.3 32.5,27Z" fill="#C2727A" opacity=".55"/><path d="M32,29.6 L32.2,27.7" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,32.6 31.2,32.3 31,31.9 30.9,31.6 31.1,31.3 31.6,31 32.6,30.7 34.5,30.2 37.4,29.4 37.4,29.4 38.8,28.6 39.5,28.2 39.1,28.3 38.3,28.7 37.1,29.3 35.7,30.2 34.1,31.2 32.3,32.4Z" fill="#AAC2B4" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M32.6,30.7 34.5,30.2 37.4,29.4 37.4,29.4 38.8,28.6 39.5,28.2Z" fill="#C2727A" opacity=".55"/><path d="M32.7,31.7 L36,29.5" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.8,31.9 31.6,31.3 31.5,30.8 31.6,30.2 31.9,29.8 32.3,29.3 33.1,28.8 34.5,28.1 36.5,27.2 36.5,27.2 37.3,26.6 37.6,26.4 37.3,26.7 36.6,27.2 35.7,28 34.7,29.1 33.5,30.3 32.2,31.6Z" fill="#ADC5B7" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M33.1,28.8 34.5,28.1 36.5,27.2 36.5,27.2 37.3,26.6 37.6,26.4Z" fill="#C2727A" opacity=".55"/><path d="M32.6,30.8 L35.3,27.6" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.9,30.2 31.6,29.3 31.3,28.6 31.1,27.9 30.9,27.4 30.9,27.2 30.9,27.1 31.3,27.3 31.9,27.7 31.9,27.7 32.5,28 32.9,28.2 33,28.3 32.9,28.5 32.8,28.9 32.6,29.3 32.4,29.8 32.1,30.3Z" fill="#94AEA1" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M30.9,27.1 31.3,27.3 31.9,27.7 31.9,27.7 32.5,28 32.9,28.2Z" fill="#C2727A" opacity=".55"/><path d="M32,29.6 L31.9,27.6" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.5,33.9 29,34.2 26.7,34.7 24.7,35.3 23.1,36.1 22,37.2 21.5,38.5 22.4,40.3 24.6,42.3 24.6,42.3 28.7,41.5 31.4,40.5 32.8,39.4 33.5,38.2 33.7,37.1 33.6,36.1 33.2,35.1 32.5,34.1Z" fill="#AAC2B5" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M21.5,38.5 22.4,40.3 24.6,42.3 24.6,42.3 28.7,41.5 31.4,40.5Z" fill="#C2727A" opacity=".55"/><path d="M31.1,34.7 L26.5,39.5" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.7,31.7 30.6,30.8 29.7,29.9 28.9,29.2 28.4,28.6 28.2,28.1 28.3,27.9 29.4,27.8 31.3,27.8 31.3,27.8 33.3,28.1 34.6,28.3 34.9,28.6 34.9,29 34.6,29.6 34,30.2 33.2,31 32.3,31.8Z" fill="#91AC9F" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M28.3,27.9 29.4,27.8 31.3,27.8 31.3,27.8 33.3,28.1 34.6,28.3Z" fill="#C2727A" opacity=".55"/><path d="M31.9,30.9 L31.5,28.1" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.5,34.1 31.2,35.5 31.1,36.8 31.3,38.2 31.9,39.6 32.9,41.1 34.6,42.5 37.6,43.8 41.9,44.7 41.9,44.7 43.7,42.3 44.3,40.2 43.4,38.5 42,37.1 40.1,36 37.8,35.2 35.3,34.5 32.5,33.9Z" fill="#B0C7B9" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M34.6,42.5 37.6,43.8 41.9,44.7 41.9,44.7 43.7,42.3 44.3,40.2Z" fill="#C2727A" opacity=".55"/><path d="M33.2,35 L39.4,41.3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.6,33.4 31.1,33.7 30.9,34.1 30.9,34.5 31.2,34.9 31.9,35.4 33.2,35.9 35.8,36.2 39.4,36.2 39.4,36.2 41.2,34.8 41.9,33.6 41.3,33 40.2,32.6 38.7,32.4 36.8,32.5 34.7,32.8 32.4,33.2Z" fill="#AFC6B8" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M33.2,35.9 35.8,36.2 39.4,36.2 39.4,36.2 41.2,34.8 41.9,33.6Z" fill="#C2727A" opacity=".55"/><path d="M32.9,33.2 L37.6,34.8" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.6,32.5 30,31.8 28.6,31.1 27.5,30.6 26.6,30.3 26.1,30.2 26.2,30.3 27.4,30.6 29.6,31.2 29.6,31.2 32.4,31.3 34.2,31.3 34.8,31.3 35,31.4 34.7,31.5 34.1,31.8 33.4,32.2 32.4,32.6Z" fill="#9DB6A9" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M26.2,30.3 27.4,30.6 29.6,31.2 29.6,31.2 32.4,31.3 34.2,31.3Z" fill="#C2727A" opacity=".55"/><path d="M31.7,32 L30.2,30.8" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/><path d="M31.6,33.2 29.8,33.1 28.2,33 27,33 26.1,33.2 25.6,33.5 25.8,34.1 27.3,34.8 30,35.7 30,35.7 33.2,35.2 35.3,34.7 35.9,34.2 36,33.8 35.5,33.5 34.8,33.4 33.7,33.3 32.4,33.3Z" fill="#A4BDAF" stroke="#4E6E62" stroke-opacity=".45" stroke-width=".3" stroke-linejoin="round"/><path d="M25.8,34.1 27.3,34.8 30,35.7 30,35.7 33.2,35.2 35.3,34.7Z" fill="#C2727A" opacity=".55"/><path d="M31.8,33.2 L30.5,34.4" stroke="#fff" stroke-opacity=".22" stroke-width=".6" stroke-linecap="round"/></svg></span>',
    pothos: '<span class="deco d-pothos" aria-hidden="true"><svg class="dz dz-pothos" viewBox="0 0 104 150" width="104" height="150" aria-hidden="true" focusable="false"><defs><linearGradient id="yxt-pot" x1="0" x2="1"><stop offset="0" stop-color="#C9C2B4"/><stop offset=".3" stop-color="#F4F0E8"/><stop offset=".65" stop-color="#E2DCD0"/><stop offset="1" stop-color="#B3AB9C"/></linearGradient><linearGradient id="yxt-lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8CBF5E"/><stop offset=".55" stop-color="#4F8C3A"/><stop offset="1" stop-color="#2F6526"/></linearGradient><linearGradient id="yxt-lf2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6FA94C"/><stop offset=".6" stop-color="#3C7A2F"/><stop offset="1" stop-color="#25521E"/></linearGradient></defs><g transform="translate(36 36) rotate(-150) scale(0.9)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.8,2.5 C0.6,6 -1.5,9 0.5,13.5" stroke="#E4E79A" stroke-width="0.9" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(46 30) rotate(-175) scale(1)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.4,2.5 C-0.7,6 -2.1,9 -0.8,13.5" stroke="#E4E79A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(58 31) rotate(170) scale(0.9)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.9,2.5 C2.4,6 -1,9 0.5,13.5" stroke="#E4E79A" stroke-width="0.9" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(68 37) rotate(145) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf2)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(52 27) rotate(178) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.4,2.5 C-0.2,6 -2.9,9 0.2,13.5" stroke="#E4E79A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(41 33) rotate(-125) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-0.1,2.5 C0.7,6 -1,9 0.1,13.5" stroke="#E4E79A" stroke-width="1" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(63 34) rotate(130) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><path d="M34,38 L36,70 L70,70 L72,38 Z" fill="url(#yxt-pot)"/><path d="M39,41 L38.7,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M43,41 L42.7,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M47,41 L46.7,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M51,41 L50.7,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M55,41 L55.3,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M59,41 L59.3,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M63,41 L63.3,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><path d="M67,41 L67.3,69" stroke="#A39B8C" stroke-width=".4" opacity=".35"/><ellipse cx="53.0" cy="38" rx="19.0" ry="2.6" fill="#E9E4DA"/><ellipse cx="53.0" cy="38.4" rx="17.0" ry="1.7" fill="#3E2E20"/><ellipse cx="53.0" cy="69.5" rx="20.0" ry="1.4" fill="#2A1C0E" opacity=".25"/><path d="M36,39 C18,46 14,82 16,142 M40,39 C28,56 30,100 34,120 M70,39 C86,48 88,90 84,132 M66,39 C74,60 70,88 66,108" stroke="#5C7E3A" stroke-width="1" fill="none" stroke-linecap="round"/><g transform="translate(23.4 52.9) rotate(-18) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1,2.5 C2.4,6 -0.7,9 -0.7,13.5" stroke="#E4E79A" stroke-width="1" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(19.4 66) rotate(41.6) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-0.3,2.5 C0.6,6 -2.4,9 0.8,13.5" stroke="#E4E79A" stroke-width="0.9" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(16.9 83) rotate(-35.7) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.2,2.5 C2.4,6 -0.6,9 -0.2,13.5" stroke="#E4E79A" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(15.7 103.9) rotate(33.5) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.7,2.5 C2.5,6 -2.4,9 -0.4,13.5" stroke="#E4E79A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(15.6 128.4) rotate(-35.7) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf2)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(16 141) rotate(-9.8) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.3,2.5 C1.1,6 -1.9,9 0.1,13.5" stroke="#E4E79A" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(32.7 60) rotate(-28.8) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.5,2.5 C2.2,6 -0.5,9 -0.4,13.5" stroke="#E4E79A" stroke-width="1" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(31.2 74.1) rotate(45.7) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf2)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(30.9 88.7) rotate(-48.4) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.7,2.5 C-0.9,6 -0.1,9 -0.4,13.5" stroke="#E4E79A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(31.7 102.7) rotate(28.1) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.5,2.5 C1.5,6 -2.8,9 -0.4,13.5" stroke="#E4E79A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(33.1 114.9) rotate(-54.1) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(34 119) rotate(-7.1) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.2,2.5 C0.6,6 -2.8,9 -0.6,13.5" stroke="#E4E79A" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(80.8 55) rotate(-56.7) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(83.9 68.6) rotate(39.3) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.6,2.5 C-0.9,6 -2.9,9 1.3,13.5" stroke="#E4E79A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(85.5 84.8) rotate(-49.9) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.2,2.5 C0.1,6 0,9 -0.8,13.5" stroke="#E4E79A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(85.7 102.9) rotate(44) scale(0.7)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.4,2.5 C2.2,6 -1.9,9 0.7,13.5" stroke="#E4E79A" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(84.8 122.2) rotate(-41.1) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(84 131) rotate(1.7) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-0.9,2.5 C1,6 -1.2,9 -0.8,13.5" stroke="#E4E79A" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(70.3 59.2) rotate(-52) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.2,2.5 C1,6 -1.7,9 1.1,13.5" stroke="#E4E79A" stroke-width="0.9" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(70.6 70.5) rotate(44.3) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.3,2.5 C1.4,6 -1.5,9 0.5,13.5" stroke="#E4E79A" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(70 81.8) rotate(-27.7) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.4,2.5 C-0.4,6 -0.3,9 0.6,13.5" stroke="#E4E79A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(68.7 92.8) rotate(54.3) scale(0.6)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-0.7,2.5 C1.8,6 -0.3,9 1.2,13.5" stroke="#E4E79A" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(66.9 103.2) rotate(-29) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf2)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(66 107) rotate(-0.1) scale(0.5)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(38 36) rotate(-60) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/></g><g transform="translate(49 34) rotate(-10) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M-1.1,2.5 C-0.2,6 -2.1,9 -0.8,13.5" stroke="#E4E79A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(61 35) rotate(25) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.5,2.5 C0.4,6 -0.1,9 1.1,13.5" stroke="#E4E79A" stroke-width="0.8" stroke-linecap="round" fill="none" opacity=".75"/></g><g transform="translate(70 37) rotate(70) scale(0.8)"><path d="M0,0 C-5.5,-1.5 -8.5,4 -6.5,8.5 C-4.5,12.5 -1,14.5 0,17.5 C1,14.5 4.5,12.5 6.5,8.5 C8.5,4 5.5,-1.5 0,0Z" fill="url(#yxt-lf)"/><path d="M0,1 L0,16" stroke="#2C5A22" stroke-width=".5" opacity=".6"/><path d="M0.7,2.5 C0.6,6 -0.1,9 0,13.5" stroke="#E4E79A" stroke-width="0.9" stroke-linecap="round" fill="none" opacity=".75"/></g></svg></span>'
  };
  function trackBooks(tid) {
    var t = domBuiltin(tid) ? TRACK[tid] : null, all = [];
    if (t) t.stages.forEach(function (s) { s.items.forEach(function (it) { if (it.home === tid && all.indexOf(it) < 0) all.push(it); }); });
    var cfa = t && tid === "fin" ? t.stages[0].items.filter(function (it) { return /^cfa-/.test(it.id) && it.kind === "topic"; }) : [];
    var mine = Object.keys(ITEMS).filter(function (id) { return ITEMS[id].mine && ITEMS[id].home === tid; }).sort(function (a, b) { return String((S.data.mybooks[a] || {}).t).localeCompare(String((S.data.mybooks[b] || {}).t)); }).map(function (id) { return ITEMS[id]; });
    return { books: all.filter(function (it) { return it.kind === "book" && !isHidden(it.id); }).concat(mine), cfa: cfa, other: all.filter(function (it) { return it.kind !== "book" && cfa.indexOf(it) < 0; }) };
  }
  function wmHTML(key, col, label, href, inner, cls, cont) {
    var di = key !== "en" && key !== "+" ? domInfo(key) : null;
    var plus = S.canEdit && di ? '<button type="button" class="wm-plus" data-act="add-book" data-t="' + esc(key) + '" title="在这个领域加一本书" aria-label="在“' + esc(di.name) + '”加一本书">＋</button>' : "";
    var edit = S.canEdit && di && di.custom && !di.missing;
    var open = href ? '<a class="wm-lab" href="' + href + '">' : edit ? '<button type="button" class="wm-lab" data-act="dom-edit" data-k="' + esc(key) + '" title="改这个领域的名称、分类号和颜色">' : '<span class="wm-lab">';
    var close = href ? "</a>" : edit ? "</button>" : "</span>";
    return '<section class="wm' + (cls ? " " + cls : "") + '" data-wm="' + esc(key) + '" style="--c:' + col + '"' + (cont ? ' data-cont="' + esc(cont) + '"' : "") + '><div class="wm-in">' + inner + "</div>" +
      '<div class="wm-board">' + (label ? open + '<i class="wm-dot" aria-hidden="true"></i>' + label + close : "") + plus + "</div></section>";
  }
  function wallModule(key) {
    if (key === "+") return !S.canEdit ? "" : '<section class="wm ghost" data-wm="+"><div class="wm-in"><button type="button" class="wm-add" data-act="add-book">＋ 加一本<small>说书名就行</small></button></div><div class="wm-board"></div></section>';
    if (key === "en") {
      var films = (EN.films || []).map(function (x) { return EN_ITEM[x.id]; }), reads = (EN.books || []).map(function (x) { return EN_ITEM[x.id]; });
      var all = films.concat(reads), d = all.filter(function (x) { return enState(x.id).s === "doing"; }).length;
      var vocab = '<a class="vbox" href="' + esc(enHref("/vocabulary")) + '" target="_blank" rel="noopener" title="Baba 上的生词本（新标签页打开）"><span class="vb-cards" aria-hidden="true"><i></i><i></i><i></i></span><span class="vb-body"><b>生词本</b><small>Baba ↗</small></span></a>';
      var innerE = films.map(filmCaseHTML).join("") + '<span class="bookend" aria-hidden="true"></span>' + reads.map(function (x) { return '<span class="easel">' + readCoverHTML(x) + "</span>"; }).join("") + '<span class="wm-fill" aria-hidden="true"></span>' + vocab;
      return wmHTML("en", "var(--ln-en)", "<b>EN</b>英语 · " + films.length + " 部片 · " + reads.length + " 本读物" + (d ? " · 在学 " + d : ""), "", innerE, "en", "<b>EN</b>英语 · 续");
    }
    var tb = trackBooks(key), di = domInfo(key);
    var nRead = tb.books.filter(function (it) { return bookState(it.id).s === "doing"; }).length, nDone = tb.books.filter(function (it) { var s = bookState(it.id).s; return s === "done" || s === "review"; }).length;
    var head = (di.code ? "<b>" + esc(di.code) + "</b>" : "") + esc(di.name);
    var label = head + " · " + tb.books.length + " 本" + (tb.cfa.length ? " + 十册" : "") + (nRead ? " · 在读 " + nRead : "") + (nDone ? " · 读完 " + nDone : "");
    var innerT = (tb.cfa.length ? cfaBoxHTML(tb.cfa) : "") + tb.books.map(function (it, i) { return clothSpine(it, key, i); }).join("") +
      (tb.other.length ? basketHTML(key, tb.other.length) : "");
    if (!innerT) innerT = '<span class="wm-empty">这一格还空着' + (S.canEdit ? "<small>点搁板右边的 ＋ 加书</small>" : "") + "</span>";
    return wmHTML(key, di.col, label, di.href, innerT, di.custom ? "mine" : "", head + " · 续");
  }
  /* 先把所有格子排成一排交给页面，再由 wallPack() 按实际宽度分排 */
  function wallHTML() {
    var keys = domList().concat(["en", "+"]);
    return '<section class="wall hang-' + hangGet() + '" aria-label="书墙"><div class="wall-row">' + keys.map(wallModule).join("") + "</div></section>";
  }
  /* ---------- 书墙排版：按每一格实际多宽，动态排成几排 ----------
   * 1. 量出每一格（一个领域）不换行时有多宽；比一整排还宽的，按书拆成几段，后面几段的标签写“续”。
   * 2. 按领域顺序往下排：每一格放进最上面一排还放得下它的地方（“续”只往它前一段的下面排）。
   * 3. 剩下的空当摆东西：先放“加一本”的空格，再放摆件（地球仪跟地缘、沙漏跟周期、蒲苇跟公司，多肉和绿萝找最空的地方，绿萝优先最下面一排）。
   * 窄屏（单栏）不重排：每格一排，左右滑着看，摆件跟着各自的领域。 */
  var DECO_PLAN = [["globe", "geo", 98], ["glass", "cycle", 74], ["vase", "co", 102], ["succ", "", 94], ["pothos", "", 120]];
  var WALL_W = 0;
  function wallPack() {
    var wall = document.querySelector(".wall"), row0 = wall && wall.querySelector(".wall-row");
    if (!row0) return;
    WALL_W = wall.clientWidth;
    function el(html) { var t = document.createElement("template"); t.innerHTML = html; return t.content.firstChild; }
    function addDeco(mod, name) {
      var wi = mod.querySelector(".wm-in");
      if (!wi.querySelector(".wm-fill")) wi.appendChild(el('<span class="wm-fill" aria-hidden="true"></span>'));
      wi.appendChild(el(DECO[name]));
    }
    function outerW(x) { var c = getComputedStyle(x); return x.getBoundingClientRect().width + (parseFloat(c.marginLeft) || 0) + (parseFloat(c.marginRight) || 0); }
    var narrow = window.matchMedia && window.matchMedia("(max-width:1100px)").matches;
    if (narrow) {
      DECO_PLAN.forEach(function (d) { var k = d[0] === "succ" ? "en" : d[1], m = k && row0.querySelector('.wm[data-wm="' + k + '"]'); if (m && d[0] !== "pothos") addDeco(m, d[0]); });
      return;
    }
    var mods = Array.prototype.slice.call(row0.children), ghost = row0.querySelector(".wm.ghost");
    wall.style.minHeight = wall.getBoundingClientRect().height + "px";  /* 量的时候整面墙会缩成一排，先撑住高度，免得页面滚动位置被挤掉 */
    wall.classList.add("measuring");
    var cs = getComputedStyle(wall), W = wall.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var gap = parseFloat(getComputedStyle(row0).columnGap) || 18, ghostW = ghost ? ghost.getBoundingClientRect().width : 0;
    var items = [];
    mods.forEach(function (m) {
      if (m === ghost) return;
      var w = m.getBoundingClientRect().width, key = m.getAttribute("data-wm");
      if (w <= W + 0.5) { items.push({ el: m, w: w, key: key, part: 0 }); return; }
      var wi = m.querySelector(".wm-in"), ic = getComputedStyle(wi), pad = parseFloat(ic.paddingLeft) + parseFloat(ic.paddingRight), ig = parseFloat(ic.columnGap) || 0;
      var chunks = [[]], widths = [], acc = pad;
      Array.prototype.slice.call(wi.children).forEach(function (c) {
        var cw = outerW(c), cur = chunks[chunks.length - 1], add = (cur.length ? ig : 0) + cw;
        if (cur.length && acc + add > W - 1) { widths.push(acc); chunks.push([c]); acc = pad + cw; }
        else { cur.push(c); acc += add; }
      });
      widths.push(acc);
      var plus = m.querySelector(".wm-plus"), last = m;
      chunks.forEach(function (ch, i) {
        var x = m;
        if (i > 0) {
          x = m.cloneNode(false); x.classList.add("cont"); x.setAttribute("data-part", String(i));
          x.innerHTML = '<div class="wm-in"></div><div class="wm-board"><span class="wm-lab"><i class="wm-dot" aria-hidden="true"></i>' + (m.getAttribute("data-cont") || "续") + "</span></div>";
          var nw = x.querySelector(".wm-in"); ch.forEach(function (c) { nw.appendChild(c); });
          last = x;
        }
        items.push({ el: x, w: Math.min(W, widths[i]), key: key, part: i });
      });
      if (plus && last !== m) last.querySelector(".wm-board").appendChild(plus);
    });
    var rows = [], at = {};
    items.forEach(function (it) {
      var r = it.part ? at[it.key] + 1 : 0;
      for (; r < rows.length; r++) if (rows[r].used + gap + it.w <= W + 0.5) break;
      if (r === rows.length) rows.push({ els: [], used: -gap, deco: 0 });
      rows[r].els.push(it); rows[r].used += gap + it.w; at[it.key] = r;
    });
    function room(r) { return W - rows[r].used - gap; }
    function roomiest(min, preferLast) {
      var best = -1;
      if (preferLast && rows.length && room(rows.length - 1) >= min && rows[rows.length - 1].deco < 2) return rows.length - 1;
      rows.forEach(function (r, i) { if (r.deco < 2 && room(i) >= min && (best < 0 || room(i) > room(best))) best = i; });
      return best;
    }
    if (ghost) {
      var gr = roomiest(ghostW + 40, false);
      if (gr >= 0) { rows[gr].els.push({ el: ghost, w: ghostW, key: "+", part: 0 }); rows[gr].used += gap + ghostW; }
      else ghost.parentNode.removeChild(ghost);
    }
    DECO_PLAN.forEach(function (d) {
      var r = -1, host = null;
      if (d[1]) rows.forEach(function (row, i) { if (r < 0 && row.deco < 2 && room(i) + gap >= d[2] && row.els.some(function (x) { return x.key === d[1]; })) r = i; });
      if (r < 0) r = roomiest(d[2] - gap, d[0] === "pothos");
      if (r < 0) return;
      rows[r].els.forEach(function (x) { if (x.key === d[1]) host = x.el; });
      if (!host) rows[r].els.forEach(function (x) { if (x.key !== "+") host = x.el; });
      if (!host) return;
      addDeco(host, d[0]); rows[r].used += d[2]; rows[r].deco++;
    });
    wall.classList.remove("measuring");
    var frag = document.createDocumentFragment();
    rows.forEach(function (row) { var div = document.createElement("div"); div.className = "wall-row"; row.els.forEach(function (x) { div.appendChild(x.el); }); frag.appendChild(div); });
    wall.removeChild(row0); wall.appendChild(frag);
    wall.style.minHeight = "";
  }
  function wallRefresh() { var w = document.querySelector(".wall"); if (!w) return; var sy = window.scrollY; w.outerHTML = wallHTML(); wallPack(); if (window.scrollY !== sy) window.scrollTo(0, sy); }
  function hangPicker() {
    var h = hangGet();
    return '<div class="hang" role="radiogroup" aria-label="书墙的挂法"><span class="hang-h">挂法</span>' + HANGS.map(function (x) {
      return '<button type="button" role="radio" aria-checked="' + (h === x[0]) + '" class="hang-b" data-act="hang" data-h="' + x[0] + '" title="' + x[2] + '"><i class="hg hg-' + x[0] + '" aria-hidden="true"></i>' + x[1] + "</button>";
    }).join("") + "</div>";
  }
  /* ---------- 展台：一次只请一本上来 ---------- */
  function stagePick() {
    var id = S.shelfPick;
    if (id && /^t:/.test(id) && TOPIC[id.slice(2)]) return id;
    if (id && (EN_ITEM[id] || ITEMS[id])) return id;
    var fo = FOCUS.filter(function (b) { return !isHidden(b); });
    S.shelfPick = fo.filter(function (b) { return bookState(b).s === "doing"; })[0] || fo[0] || Object.keys(ITEMS).filter(function (k) { return ITEMS[k].kind === "book" && !isHidden(k); })[0];
    return S.shelfPick;
  }
  /* 封面上的书名：有副标题分两行；长的中文书名对半分两行；按最长一行定字号 */
  function coverTitle(t) {
    t = t.replace(/（.*）$/, "");
    var lines, sub = "";
    if (t.indexOf("：") > 0) { lines = [t.split("：")[0]]; sub = t.split("：")[1]; }
    else if (!isLatin(t) && t.length > 5) { var m = Math.ceil(t.length / 2); lines = [t.slice(0, m), t.slice(m)]; }
    else lines = [t];
    var n = Math.max.apply(null, lines.map(function (x) { return isLatin(x) ? x.length * 0.5 : x.length; }));
    var size = n <= 5 ? 30 : n <= 7 ? 23 : n <= 9 ? 18 : 15;
    return '<span class="sc-t" style="font-size:' + size + 'px">' + lines.map(esc).join("<br>") + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>";
  }
  function stageCover(id) {
    var flip = S.flip === id ? " flip" : "";
    if (/^t:/.test(id)) {
      var tp = TOPIC[id.slice(2)];
      return '<div class="stg-box' + flip + '" style="--c:var(' + (SHELF_COL[tp.track] || "--ln-rev") + ')"><span class="sb-label"><span class="sb-no">' + esc(topicNo(tp)) + '</span><b>' + esc(tp.title.split("：")[0]) + "</b><span>" + topicItems(tp).length + " 件 · " + esc(TP_STATUS[tp.status] || "") + '</span></span><i class="sb-hole" aria-hidden="true"></i></div>';
    }
    if (EN_ITEM[id]) {
      var x = EN_ITEM[id];
      if (x.kind === "read") return '<div class="stg-cover pic' + flip + '"><span class="pk-sky" aria-hidden="true"><i></i><i></i><i></i></span><span class="sc-kind">' + esc(x.type) + '</span><span class="sc-en">' + esc(x.en) + '</span><span class="sc-t sm">' + esc(x.title) + '</span><span class="sc-foot">Baba · ' + esc(x.level || "") + "</span></div>";
      return '<div class="stg-cover film' + flip + '" style="--cl:' + clothOf("en", x.id) + '"><i class="sc-holes" aria-hidden="true"></i><span class="sc-kind">' + esc(x.type) + " · " + esc(String(x.year || "")) + '</span>' + coverTitle(x.title) + '<span class="sc-en">' + esc(x.en) + '</span><span class="sc-foot">' + (x.where === "local" ? "研习录跟读" : "Baba 英语") + "</span></div>";
    }
    var it = ITEMS[id], tid = it.home, base = /^cfa-/.test(id) ? CLOTH.fin[0] : clothOf(tid, id), light = lumHex(base) > 0.2, tname = domInfo(tid).name;
    return '<div class="stg-cover' + (light ? " light" : "") + flip + '" style="--cl:' + base + '"><i class="sc-rule" aria-hidden="true"></i>' + coverTitle(it.title) + '<span class="sc-by">' + esc(it.by ? it.by + " 著" : "CFA 一级") + '</span><span class="sc-foot">' + esc(tname || "") + '</span><i class="sc-rule" aria-hidden="true"></i></div>';
  }
  /* 展台在书墙右边一栏，滚动时停在屏幕上 */
  function stageHTML() {
    var id = stagePick();
    if (/^t:/.test(id)) {
      var mini = '<div class="dais"><div class="stg-mid"><div class="stg-scale"><div class="stg-zoom">' + stageCover(id) + '</div></div><i class="stg-stand" aria-hidden="true"></i></div><i class="stg-top" aria-hidden="true"></i></div>';
      S.flip = null;
      return '<aside class="dais-col" aria-label="展台">' + mini + archPanelHTML(TOPIC[id.slice(2)]) + "</aside>";
    }
    var P = EN_ITEM[id] ? enDais(id) : bookDais(id);
    var top = '<div class="dais"><div class="stg-mid"><div class="stg-scale"><div class="stg-zoom">' + stageCover(id) + '</div></div><i class="stg-stand" aria-hidden="true"></i></div>' + P.head + '<i class="stg-top" aria-hidden="true"></i></div>';
    S.flip = null;
    return '<aside class="dais-col" aria-label="展台" style="--c:' + P.col + '">' + top + '<div class="pulled">' + P.body + "</div></aside>";
  }
  function wallLegend() {
    return '<div class="w-legend" aria-hidden="true"><span><i class="lg-b"></i>立着：还没读</span><span><i class="lg-b doing"></i>抽出半截、夹书签：在读</span>' +
      '<span><i class="lg-b thin"></i><i class="lg-b thick"></i>书脊越厚，花的时间越多</span><span><i class="lg-b done"></i>盖章：读完</span><span><i class="lg-film"></i>蓝布面盒：电影或剧</span><span><i class="lg-bk"></i>藤筐：练习与专题</span></div>';
  }
  /* ---------- 电子书：给书架上的书挂一个 PDF 或 EPUB ----------
   * claude.ai 版：文件用 assets 能力存在这个研习录自己的存储里（只有你能打开，换设备也在）。
   *   PDF 原样存；EPUB 不在存储接受的格式里，按接口文档的建议包成 base64 文本（text/plain）存，打开时再还原（enc: "b64"）。
   *   记录在 ebooks 集合：文档 id = 书的 id，内容 { asset, kind, enc, name, size, t }；PDF 的打开地址是 "/_blob/" + asset。
   * GitHub 公开版：文件只存在当前浏览器的 IndexedDB 里（库 yanxilu-ebooks，键 = 书的 id），不会传到网上；
   *   本地记录 ebooks[书的 id] = { local: true, kind, name, size, t }，跟公开版的其他本地记录一样存在 localStorage。
   * PDF 和 EPUB 都在页面里的阅读器打开（见下面的阅读器），PDF 也可以在新标签页打开。 */
  var EB_MAX = 20 * 1024 * 1024, EPUB_MAX = 15 * 1024 * 1024;
  function ebKind(file) {
    var n = file.name || "";
    if (/\.epub$/i.test(n) || file.type === "application/epub+zip") return "epub";
    if (/\.pdf$/i.test(n) || file.type === "application/pdf") return "pdf";
    return "";
  }
  var EB_ERR = { too_large: "文件太大了：PDF 最多 20 MB，EPUB 最多 15 MB。", unsupported_type: "只能上传 PDF 或 EPUB 文件。", quota_or_state: "研习录的存储空间满了，先移除一些不用的电子书。",
    rate_limited: "传得太频繁了，过一会儿再试。", upstream_auth: "登录状态过期了，刷新页面后再试。", capability_disabled: "这个页面现在不能上传文件。", not_granted: "这个页面现在不能上传文件。", capability_removed: "这个页面现在不能上传文件。" };
  function ebookOf(id) {
    var e = S.data.ebooks ? S.data.ebooks[id] || null : null;
    if (S.mode === "db") return IN_ARTIFACT && e && e.asset ? e : null;
    if (S.mode === "local") return e && e.local ? e : null;
    return null;
  }
  /* 公开版：浏览器自己的 IndexedDB */
  var EBDB = null;
  function ebDb() {
    if (!EBDB) {
      EBDB = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej({ code: "no_idb" }); return; }
        var rq = indexedDB.open("yanxilu-ebooks", 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore("files"); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error || { code: "no_idb" }); };
        rq.onblocked = function () { rej({ code: "no_idb" }); };
      });
      EBDB.catch(function () { EBDB = null; });
    }
    return EBDB;
  }
  function ebTx(mode, fn) {
    return ebDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("files", mode), r = fn(tx.objectStore("files"));
        tx.oncomplete = function () { res(r && r.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error || { code: "idb_error" }); };
      });
    });
  }
  function ebLocalErr(e) {
    var n = e && (e.name || e.code);
    if (n === "QuotaExceededError") return "浏览器的存储空间不够了，先移除一些不用的电子书，或清理一下磁盘。";
    if (n === "no_idb") return "这个浏览器不允许存文件（可能是无痕窗口），换普通窗口再试。";
    return "没存成功，请再试一次。";
  }
  /* 打开：先把文件读成一个本页可用的地址，填进链接，点链接就在新标签页打开（不走弹窗，浏览器不会拦） */
  S.ebUrls = {};
  function ebForget(id) { if (S.ebUrls[id]) { URL.revokeObjectURL(S.ebUrls[id]); delete S.ebUrls[id]; } }
  function ebHydrate() {
    if (S.mode !== "local") return;
    document.querySelectorAll('a[data-act="eb-open-local"]').forEach(function (a) {
      var id = a.getAttribute("data-id"); if (S.ebUrls[id]) { a.href = S.ebUrls[id]; return; }
      ebTx("readonly", function (st) { return st.get(id); }).then(function (rec) {
        if (!rec || !rec.blob) return;
        if (!S.ebUrls[id]) S.ebUrls[id] = URL.createObjectURL(rec.blob);
        document.querySelectorAll('a[data-act="eb-open-local"][data-id="' + id + '"]').forEach(function (x) { x.href = S.ebUrls[id]; });
      }, function () {});
    });
  }
  function ebOpenLocal(id) {
    ebTx("readonly", function (st) { return st.get(id); }).then(function (rec) {
      if (!rec || !rec.blob) { toast("这个浏览器里找不到文件了，重新上传一次。"); return; }
      if (!S.ebUrls[id]) S.ebUrls[id] = URL.createObjectURL(rec.blob);
      var a = document.querySelector('a[data-act="eb-open-local"][data-id="' + id + '"]');
      if (a) { a.href = S.ebUrls[id]; toast("文件准备好了，再点一次「新标签页打开」。"); }
    }, function (e) { toast(ebLocalErr(e)); });
  }
  function fmtSize(n) { return n >= 1048576 ? Math.round(n / 104857.6) / 10 + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function ebCanUpload() { return S.mode === "local" ? true : !!(S.assets && S.canEdit); }
  function ebUploadBtn(id, label) {
    if (!ebCanUpload()) return "";
    var busy = S.ebBusy === id, tip = S.mode === "local" ? "PDF 或 EPUB，只存在这个浏览器里，不会传到网上" : "PDF（20 MB 以内）或 EPUB（15 MB 以内）";
    return '<label class="btn ghost eb-up' + (busy ? " busy" : "") + '" title="' + tip + '"><input class="vh" type="file" accept="application/pdf,.pdf,application/epub+zip,.epub" data-eb="' + esc(id) + '"' + (busy ? " disabled" : "") + ">" + (busy ? "上传中……" : label) + "</label>";
  }
  function ebFileHTML(id) {
    var eb = ebookOf(id); if (!eb) return "";
    var local = S.mode === "local", lu = local && S.ebUrls[id], epub = (eb.kind || "pdf") === "epub";
    var tab = epub ? "" : local ? '<a class="linkbtn eb-tab" data-act="eb-open-local" data-id="' + esc(id) + '" href="' + (lu ? lu : "#") + '" target="_blank" rel="noopener">新标签页打开 ↗</a>'
      : '<a class="linkbtn eb-tab" href="/_blob/' + esc(eb.asset) + '" target="_blank" rel="noopener">新标签页打开 ↗</a>';
    var tools = "";
    if (ebCanUpload()) tools = (S.ebConfirm === id
      ? '<span class="eb-conf">文件会删掉，确定？<button type="button" class="linkbtn danger" data-act="eb-del-yes" data-id="' + esc(id) + '">移除</button><button type="button" class="linkbtn" data-act="eb-del-no">取消</button></span>'
      : '<button type="button" class="linkbtn" data-act="eb-del" data-id="' + esc(id) + '">移除</button>');
    var swap = ebCanUpload() ? '<label class="linkbtn eb-up' + (S.ebBusy === id ? " busy" : "") + '"><input class="vh" type="file" accept="application/pdf,.pdf,application/epub+zip,.epub" data-eb="' + esc(id) + '">' + (S.ebBusy === id ? "上传中……" : "换一个文件") + "</label>" : "";
    return '<div class="eb-file"><span class="eb-meta">电子书：' + esc(eb.name || "PDF") + (eb.size ? " · " + fmtSize(eb.size) : "") + (local ? " · 存在这个浏览器里" : "") + "</span>" +
      '<span class="eb-tools">' + tab + swap + tools + "</span></div>";
  }
  function ebUpload(id, file) {
    if (!file) return;
    var kind = ebKind(file);
    if (!kind) { toast("只能上传 PDF 或 EPUB 文件。"); return; }
    if (S.mode === "local") {
      S.ebBusy = id; render();
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      var blob = new Blob([file], { type: kind === "epub" ? "application/epub+zip" : "application/pdf" });
      ebTx("readwrite", function (st) { return st.put({ blob: blob, kind: kind, name: file.name, size: file.size, t: new Date().toISOString() }, id); }).then(function () {
        ebForget(id);
        return put("ebooks", id, { local: true, kind: kind, name: file.name, size: file.size, t: new Date().toISOString() });
      }).then(function () { S.ebBusy = null; render(); toast("电子书挂好了，点「开始读」就能看。"); },
        function (e) { S.ebBusy = null; render(); toast(ebLocalErr(e)); });
      return;
    }
    if (kind === "pdf" && file.size > EB_MAX) { toast("PDF 超过 20 MB，压缩一下再传。"); return; }
    if (kind === "epub" && file.size > EPUB_MAX) { toast("EPUB 超过 15 MB，传不上去。可以在公开版里放（只存在那个浏览器）。"); return; }
    if (!S.assets) { toast("这个页面现在不能上传文件。"); return; }
    var old = S.data.ebooks[id];
    S.ebBusy = id; render();
    var body = kind === "pdf" ? Promise.resolve(file) : new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var s2 = String(fr.result), k = s2.indexOf(","); res(new Blob([s2.slice(k + 1)], { type: "text/plain" })); };
      fr.onerror = function () { rej(epErr("read")); };
      fr.readAsDataURL(file);
    });
    function tryUp(again) {
      return body.then(function (b) { return S.assets.upload(b, { type: kind === "pdf" ? "application/pdf" : "text/plain" }); }).catch(function (e) {
        if (!again && e && e.code === "store_unavailable") return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return tryUp(true); });
        throw e;
      });
    }
    tryUp(false).then(function (r) {
      var rec = { asset: r.id, kind: kind, name: file.name, size: file.size, t: new Date().toISOString() };
      if (kind === "epub") rec.enc = "b64";
      return put("ebooks", id, rec).then(function () {
        if (old && old.asset && old.asset !== r.id) S.assets.delete(old.asset).catch(function () {});
        S.ebBusy = null; render(); toast("电子书挂好了，点「开始读」就能看。");
      });
    }, function (e) { S.ebBusy = null; render(); toast(EB_ERR[e && e.code] || "上传没成功，请再试一次。"); });
  }
  function ebRemove(id) {
    var eb = S.data.ebooks[id]; S.ebConfirm = null;
    if (!eb) { render(); return; }
    if (eb.local) {
      ebForget(id); ebTx("readwrite", function (st) { return st.delete(id); }).catch(function () {});
      del("ebooks", id).then(function () { toast("电子书已移除。"); });
      render(); return;
    }
    del("ebooks", id).then(function () { if (S.assets && eb.asset) return S.assets.delete(eb.asset).catch(function () {}); }).then(function () { toast("电子书已移除。"); });
    render();
  }
  /* ---------- EPUB 阅读器 ----------
   * 不依赖外部库：用浏览器自带的 DecompressionStream 解 zip，按 OPF 的阅读顺序一章一章显示。
   * 每章放进一个不允许运行脚本的 iframe；图片、样式、字体都换成 data: 地址内嵌。
   * 读到第几章、章内位置记在这个浏览器里（localStorage：yanxilu-epub-<书的 id>）。 */
  var EP_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", css: "text/css",
    ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", xhtml: "application/xhtml+xml", html: "text/html", htm: "text/html" };
  function epErr(code) { return { code: code }; }
  function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), n = u8.length, e = -1, i;
    for (i = n - 22; i >= Math.max(0, n - 65558); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw epErr("bad_epub");
    var cnt = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true), files = {}, td = new TextDecoder("utf-8");
    for (var k = 0; k < cnt; k++) {
      if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) throw epErr("bad_epub");
      var nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      var name = td.decode(u8.subarray(off + 46, off + 46 + nlen));
      files[name] = { method: dv.getUint16(off + 10, true), csize: dv.getUint32(off + 20, true), usize: dv.getUint32(off + 24, true), loff: dv.getUint32(off + 42, true) };
      off += 46 + nlen + xlen + clen;
    }
    function data(name) {
      var f = files[name] || files[decodeURIComponent(name)];
      if (!f) return Promise.resolve(null);
      var lo = f.loff, start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(start, start + f.csize);
      if (f.method === 0) return Promise.resolve(raw.slice());
      if (f.method !== 8 || typeof DecompressionStream === "undefined") return Promise.reject(epErr(f.method === 8 ? "old_browser" : "bad_epub"));
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    return { data: data, size: function (name) { var f = files[name] || files[decodeURIComponent(name)]; return f ? f.usize : 0; }, text: function (name) { return data(name).then(function (b) { return b ? new TextDecoder("utf-8").decode(b) : null; }); } };
  }
  function epDir(p) { var i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i + 1); }
  function epResolve(base, rel) {
    rel = String(rel || "").split("#")[0].split("?")[0];
    if (!rel) return "";
    try { rel = decodeURIComponent(rel); } catch (e) { /* 保持原样 */ }
    var parts = (rel.charAt(0) === "/" ? rel.slice(1) : base + rel).split("/"), out = [];
    parts.forEach(function (s) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); });
    return out.join("/");
  }
  function epXml(txt, type) {
    var d = new DOMParser().parseFromString(txt, type || "application/xml");
    if (d.getElementsByTagName("parsererror").length && type !== "text/html") d = new DOMParser().parseFromString(txt, "text/html");
    return d;
  }
  function epTags(doc, name) { return Array.prototype.slice.call(doc.getElementsByTagNameNS("*", name)); }
  function u8ToB64(u8) { var s = "", C = 0x8000; for (var i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s); }
  function epOpen(buf) {
    var z = unzip(buf);
    return z.text("META-INF/container.xml").then(function (cx) {
      var rf = cx && epTags(epXml(cx), "rootfile")[0];
      if (!rf) throw epErr("bad_epub");
      var opfPath = rf.getAttribute("full-path");
      return z.text(opfPath).then(function (ot) {
        if (!ot) throw epErr("bad_epub");
        var opf = epXml(ot), base = epDir(opfPath), man = {}, byPath = {};
        epTags(opf, "item").forEach(function (it) {
          var m = { id: it.getAttribute("id"), path: epResolve(base, it.getAttribute("href")), type: it.getAttribute("media-type") || "", props: it.getAttribute("properties") || "" };
          man[m.id] = m; byPath[m.path] = m;
        });
        var spine = epTags(opf, "itemref").map(function (r) { return man[r.getAttribute("idref")]; }).filter(function (m) { return m && /html|xml/.test(m.type); });
        if (!spine.length) throw epErr("bad_epub");
        var tEl = epTags(opf, "title")[0], ep = { z: z, spine: spine, byPath: byPath, title: tEl ? tEl.textContent.trim() : "", toc: [] };
        ep.w = spine.map(function (m) { return Math.max(1, z.size(m.path)); }); ep.cum = []; ep.tot = 0;
        ep.w.forEach(function (x) { ep.cum.push(ep.tot); ep.tot += x; });
        var nav = Object.keys(man).map(function (k) { return man[k]; }).filter(function (m) { return /(^|\s)nav(\s|$)/.test(m.props); })[0];
        var spEl = epTags(opf, "spine")[0], ncx = man[spEl && spEl.getAttribute("toc")] || Object.keys(man).map(function (k) { return man[k]; }).filter(function (m) { return /ncx/.test(m.type); })[0];
        function add(label, href, from, depth) {
          var path = epResolve(epDir(from), href), frag = (String(href).split("#")[1] || "");
          var idx = spine.findIndex(function (m) { return m.path === path; });
          if (idx >= 0 && label) ep.toc.push({ label: label.replace(/\s+/g, " ").trim(), i: idx, frag: frag, depth: depth });
        }
        if (nav) return z.text(nav.path).then(function (nt) {
          if (nt) {
            var nd = epXml(nt, "application/xhtml+xml"), navs = epTags(nd, "nav"), tocNav = navs.filter(function (x) { return /toc/.test(x.getAttribute("epub:type") || x.getAttributeNS("http://www.idpf.org/2007/ops", "type") || ""); })[0] || navs[0];
            if (tocNav) epTags(tocNav, "a").forEach(function (a) { var d = 0, p = a.parentNode; while (p && p !== tocNav) { if (/^(ol|ul)$/i.test(p.localName)) d++; p = p.parentNode; } add(a.textContent, a.getAttribute("href"), nav.path, Math.max(0, d - 1)); });
          }
          return ep;
        });
        if (ncx) return z.text(ncx.path).then(function (xt) {
          if (xt) epTags(epXml(xt), "navPoint").forEach(function (np) {
            var lab = epTags(np, "text")[0], ct = epTags(np, "content")[0], d = 0, p = np.parentNode;
            while (p && p.localName === "navPoint") { d++; p = p.parentNode; }
            if (lab && ct) add(lab.textContent, ct.getAttribute("src"), ncx.path, d);
          });
          return ep;
        });
        return ep;
      });
    });
  }
  function epDataUrl(ep, path) {
    return ep.z.data(path).then(function (b) {
      if (!b) return "";
      var m = ep.byPath[path], ext = (path.split(".").pop() || "").toLowerCase();
      return "data:" + ((m && m.type) || EP_MIME[ext] || "application/octet-stream") + ";base64," + u8ToB64(b);
    });
  }
  function epCss(ep, path, txt) {
    var dir = epDir(path), urls = {}, re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, mm;
    txt = txt.replace(/@import[^;]+;/g, "");
    while ((mm = re.exec(txt))) if (!/^(data:|https?:|#)/.test(mm[2])) urls[mm[2]] = epResolve(dir, mm[2]);
    var keys = Object.keys(urls);
    return Promise.all(keys.map(function (k) { return epDataUrl(ep, urls[k]); })).then(function (du) {
      var map = {}; keys.forEach(function (k, i) { map[k] = du[i]; });
      return txt.replace(re, function (all, q, u) { return map[u] ? "url(" + map[u] + ")" : all; });
    });
  }
  function epChapter(ep, i, theme) {
    var it = ep.spine[i];
    return ep.z.text(it.path).then(function (src) {
      if (src == null) throw epErr("bad_epub");
      var doc = epXml(src, /xhtml|xml/.test(it.type) ? "application/xhtml+xml" : "text/html"), dir = epDir(it.path), jobs = [];
      epTags(doc, "script").forEach(function (s) { s.parentNode.removeChild(s); });
      Array.prototype.slice.call(doc.getElementsByTagName("*")).forEach(function (el) {
        Array.prototype.slice.call(el.attributes).forEach(function (a) { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
      });
      epTags(doc, "img").forEach(function (im) {
        var p = epResolve(dir, im.getAttribute("src")); if (!p) return;
        jobs.push(epDataUrl(ep, p).then(function (d) { if (d) im.setAttribute("src", d); }));
      });
      epTags(doc, "image").forEach(function (im) {
        var h = im.getAttributeNS("http://www.w3.org/1999/xlink", "href") || im.getAttribute("href"), p = epResolve(dir, h); if (!p) return;
        jobs.push(epDataUrl(ep, p).then(function (d) { if (!d) return; im.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", d); im.setAttribute("href", d); }));
      });
      var styles = [];
      epTags(doc, "link").forEach(function (l) {
        if (!/stylesheet/i.test(l.getAttribute("rel") || "")) return;
        var p = epResolve(dir, l.getAttribute("href")); l.parentNode.removeChild(l); if (!p) return;
        jobs.push(ep.z.text(p).then(function (t) { return t ? epCss(ep, p, t) : ""; }).then(function (c) { styles.push(c); }));
      });
      epTags(doc, "style").forEach(function (s) { jobs.push(epCss(ep, it.path, s.textContent).then(function (c) { s.textContent = c; })); });
      epTags(doc, "a").forEach(function (a) {
        var h = a.getAttribute("href"); if (!h) return;
        if (/^(https?:|mailto:)/i.test(h)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); return; }
        if (/^javascript:/i.test(h)) { a.removeAttribute("href"); return; }
        var p = h.charAt(0) === "#" ? it.path : epResolve(dir, h);
        a.setAttribute("data-ep", p + "#" + (h.split("#")[1] || ""));
      });
      return Promise.all(jobs).then(function () {
        var body = epTags(doc, "body")[0], head = epTags(doc, "head")[0];
        var inner = body ? new XMLSerializer().serializeToString(body).replace(/^<body[^>]*>|<\/body>$/g, "") : new XMLSerializer().serializeToString(doc.documentElement);
        var headStyles = head ? epTags(head, "style").map(function (s) { return s.textContent; }).join("\n") : "";
        var bodyCls = body ? (body.getAttribute("class") || "") : "";
        return '<!doctype html><html><head><meta charset="utf-8"><style>' + styles.join("\n") + "\n" + headStyles + "</style><style>" +
          "html{background:" + theme.bg + "}body{max-width:40em;margin:0 auto!important;padding:28px 22px 80px!important;color:" + theme.ink + "!important;background:" + theme.bg + "!important;" +
          "font-family:\"Noto Serif SC\",\"Songti SC\",\"STSong\",\"SimSun\",serif;font-size:19px;line-height:1.9;word-break:break-word}" +
          "img,svg,video{max-width:100%!important;height:auto!important}a{color:" + theme.link + "}p{text-align:justify}" +
          "mark.yx-hl{color:inherit;border-radius:2px;cursor:pointer;padding:0 1px;background:rgba(245,206,80,.5)}mark.c-g{background:rgba(120,200,130,.45)}mark.c-b{background:rgba(110,170,235,.42)}mark.c-p{background:rgba(240,140,170,.42)}mark.has-note{border-bottom:2px solid #C8372D}" +
          "</style></head><body class=\"" + bodyCls.replace(/"/g, "") + "\">" + inner + "</body></html>";
      });
    });
  }

  /* ---------- 划线和批注 ----------
   * marks：文档 id = "mk-" + 时间 + 随机，内容 { book, kind（epub / pdf）, loc 第几部分或第几页, label 章节, exact 划的原文,
   *   prefix 前 32 个字, suffix 后 32 个字, pos 在这一部分或这一页里的位置, c 颜色（y 黄 / g 绿 / b 蓝 / p 粉）, note 批注, t }。
   * 位置用“原文 + 前后文”来记（W3C Web Annotation 的 TextQuoteSelector 思路），换字号、换设备打开也找得回来。 */
  var MK_COLORS = [["y", "黄"], ["g", "绿"], ["b", "蓝"], ["p", "粉"]];
  function marksOf(book) {
    var M = S.data.marks || {};
    return Object.keys(M).map(function (k) { return Object.assign({ id: k }, M[k]); }).filter(function (m) { return m.book === book && m.exact; })
      .sort(function (a, b) { return (a.loc - b.loc) || ((a.pos || 0) - (b.pos || 0)); });
  }
  function tqText(root) { var r = root.ownerDocument.createRange(); r.selectNodeContents(root); return r.toString(); }
  function tqOff(root, node, off) { var r = root.ownerDocument.createRange(); r.setStart(root, 0); r.setEnd(node, off); return r.toString().length; }
  function tqLocate(full, m) {
    var best = -1, bestSc = -1, at = full.indexOf(m.exact), p = m.prefix || "", q = m.suffix || "";
    while (at >= 0) {
      var sc = 0, i, j;
      for (i = 1; i <= p.length && full.charAt(at - i) === p.charAt(p.length - i); i++) sc++;
      for (j = 0; j < q.length && full.charAt(at + m.exact.length + j) === q.charAt(j); j++) sc++;
      if (sc > bestSc) { bestSc = sc; best = at; }
      at = full.indexOf(m.exact, at + 1);
    }
    return best;
  }
  function tqWrap(root, start, end, m) {
    var doc = root.ownerDocument, w = doc.createTreeWalker(root, 4, null), n, pos = 0, segs = [];
    while ((n = w.nextNode())) {
      var a = pos, z = pos + n.data.length; pos = z;
      if (z <= start) continue; if (a >= end) break;
      segs.push({ n: n, from: Math.max(0, start - a), to: Math.min(n.data.length, end - a) });
    }
    segs.forEach(function (sg) {
      var t = sg.n; if (sg.to < t.data.length) t.splitText(sg.to);
      var mid = sg.from > 0 ? t.splitText(sg.from) : t;
      if (!mid.data.length) return;
      var mk = doc.createElement("mark"); mk.className = "yx-hl c-" + (m.c || "y") + (m.note ? " has-note" : ""); mk.setAttribute("data-mk", m.id);
      mid.parentNode.insertBefore(mk, mid); mk.appendChild(mid);
    });
  }
  function tqClear(root) {
    Array.prototype.slice.call(root.querySelectorAll("mark.yx-hl")).forEach(function (mk) { var p = mk.parentNode; while (mk.firstChild) p.insertBefore(mk.firstChild, mk); p.removeChild(mk); p.normalize(); });
  }
  function tqApply(root, list) {
    tqClear(root); if (!list.length) return;
    var full = tqText(root);
    list.forEach(function (m) { var at = tqLocate(full, m); if (at >= 0) tqWrap(root, at, at + m.exact.length, m); });
  }


  /* ---------- 阅读器（EPUB 和 PDF 共用一个窗口） ----------
   * EPUB：上面的解析器一章一章显示；PDF：用随站点一起放的 PDF.js（Mozilla 的开源 PDF 引擎，vendor/pdfjs）一页一页画，文字层可以选中、划线。
   * 读到哪一部分 / 哪一页、在里面的位置，记在这个浏览器里（换设备也能从 reading 记录接着读），同时写进阅读进度。 */
  var RD = null;
  function rdTheme() {
    var cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue("--leaf").trim() || "#FBF9F4", ink: cs.getPropertyValue("--ink").trim() || "#24211E", link: cs.getPropertyValue("--indigo").trim() || "#1F5FAE" };
  }
  function rdKey(id) { return (RD && RD.kind === "pdf" ? "yanxilu-pdf-" : "yanxilu-epub-") + id; }
  function rdLabel(loc) {
    if (!RD) return "";
    if (RD.kind === "pdf") {
      var tc = RD.pdf ? RD.pdf.toc.filter(function (t) { return t.page <= loc; }).pop() : null;
      return (tc ? tc.label + " · " : "") + "第 " + loc + " 页";
    }
    var k = epTocAt(loc), cur = k >= 0 ? RD.ep.toc[k] : null;
    return cur ? cur.label : "第 " + (loc + 1) + " 部分";
  }
  /* 第几部分对应目录里的哪一条：这一部分开头的那条；这一部分没有目录项，就用前面最近的一条 */
  function epTocAt(i) {
    var toc = RD && RD.ep ? RD.ep.toc : [], k, last = -1;
    for (k = 0; k < toc.length; k++) { if (toc[k].i === i) return k; if (toc[k].i < i) last = k; }
    return last;
  }
  function rdProgUI(pct) {
    if (!RD) return;
    var bar = RD.el.querySelector(".rd-pg i"), pc = RD.el.querySelector(".rd-pc"), dn = RD.el.querySelector(".rd-done");
    if (bar) bar.style.width = (pct * 100).toFixed(1) + "%";
    if (pc) pc.textContent = Math.round(pct * 100) + "%";
    if (dn) { var s0 = st(RD.id); dn.hidden = !(S.canEdit && pct >= 0.985 && s0 !== "done" && s0 !== "review"); }
  }
  function rdSave(force) {
    if (!RD) return;
    var rec = null;
    if (RD.kind === "pdf") rec = pdfPos();
    else if (RD.ep) {
      var f = RD.el.querySelector(".rd-frame"), y = 0, ep = RD.ep;
      try { var se = f.contentDocument.scrollingElement; y = se.scrollHeight > se.clientHeight ? se.scrollTop / (se.scrollHeight - se.clientHeight) : 0; } catch (e) { /* 忽略 */ }
      y = Math.max(0, Math.min(1, y));
      rec = { pct: ep.tot ? (ep.cum[RD.i] + y * ep.w[RD.i]) / ep.tot : (RD.i + y) / ep.spine.length, loc: RD.i, y: y, total: ep.spine.length, label: rdLabel(RD.i), kind: "epub" };
    }
    if (!rec) return;
    RD.last = rec;
    if (RD.mod) { var chn = rdChOf(rec.label); if (chn && chn !== RD.chAuto) { RD.chAuto = chn; if (RD.side && RD.tab === "ch" && !RD.chPick) rdSidePaint(); } }
    try { localStorage.setItem(rdKey(RD.id), JSON.stringify({ i: rec.loc, y: rec.y })); } catch (e) { /* 忽略 */ }
    readingSave(RD.id, rec, force);
    rdProgUI(rec.pct);
  }
  function rdResume(id, kind) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem((kind === "pdf" ? "yanxilu-pdf-" : "yanxilu-epub-") + id) || "null"); } catch (e) { /* 忽略 */ }
    if (saved) return saved;
    var rd = readingOf(id);
    return rd && rd.kind === kind ? { i: rd.loc, y: rd.y } : null;
  }
  function rdShow(i, opt) {
    if (!RD || !RD.ep) return;
    i = Math.max(0, Math.min(RD.ep.spine.length - 1, i));
    var seq = ++RD.seq, view = RD.el.querySelector(".rd-view");
    RD.el.querySelector(".rd-pos").textContent = "正在翻到这一部分……";
    rdTipHide();
    epChapter(RD.ep, i, rdTheme()).then(function (html) {
      if (!RD || RD.seq !== seq) return;
      RD.i = i;
      view.innerHTML = '<iframe class="rd-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="正文"></iframe>';
      var f = view.querySelector(".rd-frame");
      f.addEventListener("load", function () {
        var d = f.contentDocument; if (!d) return;
        var se = d.scrollingElement || d.documentElement;
        tqApply(d.body, marksOf(RD.id).filter(function (m) { return m.kind === "epub" && m.loc === i; }));
        if (opt && opt.mark) { var mk = d.querySelector('mark[data-mk="' + opt.mark + '"]'); if (mk) mk.scrollIntoView({ block: "center" }); }
        else if (opt && opt.frag) { var t = d.getElementById(opt.frag); if (t) t.scrollIntoView(); }
        else if (opt && opt.y) se.scrollTop = opt.y * (se.scrollHeight - se.clientHeight);
        else if (opt && opt.end) se.scrollTop = se.scrollHeight;
        d.addEventListener("click", function (e) {
          var hl = e.target.closest && e.target.closest("mark[data-mk]");
          if (hl && d.getSelection().isCollapsed) { rdPop(hl.getAttribute("data-mk")); return; }
          var a = e.target.closest && e.target.closest("a[data-ep]"); if (!a) return;
          e.preventDefault();
          var v = a.getAttribute("data-ep").split("#"), j = RD.ep.spine.findIndex(function (m) { return m.path === v[0]; });
          if (j === RD.i && v[1]) { var t2 = d.getElementById(v[1]); if (t2) t2.scrollIntoView(); }
          else if (j >= 0) rdShow(j, { frag: v[1] });
        });
        d.addEventListener("keydown", rdKeys);
        ["mouseup", "keyup", "touchend"].forEach(function (ev) { d.addEventListener(ev, rdTipSoon); });
        var timer = 0;
        d.addEventListener("scroll", function () { rdTipHide(); clearTimeout(timer); timer = setTimeout(function () { rdSave(); }, 400); });
        rdSave();
      });
      f.srcdoc = html;
      var n = RD.ep.spine.length;
      RD.el.querySelector(".rd-pos").textContent = "第 " + (i + 1) + " / " + n + " 部分";
      RD.el.querySelector('[data-act="rd-prev"]').disabled = i === 0;
      RD.el.querySelector('[data-act="rd-next"]').disabled = i === n - 1;
      var sel = RD.el.querySelector(".rd-toc"), cur = epTocAt(i);
      if (sel && cur >= 0) sel.value = String(cur);
    }, function (e) { if (RD && RD.seq === seq) rdFail(e); });
  }
  function rdFail(e) {
    var c = e && e.code, msg = {
      missing: "这个浏览器里找不到文件了，重新上传一次。",
      old_browser: "这个浏览器太旧，打不开 EPUB，换新版 Chrome、Edge 或 Safari 试试。",
      pdf_lib: "PDF 阅读器没加载上来。可以先关掉，用「新标签页打开」读。",
      pdf_lock: "这个 PDF 设了密码，在页面里打不开。可以用「新标签页打开」。",
      pdf_bad: "这个 PDF 打不开，可能文件有问题。可以试试「新标签页打开」。"
    }[c] || "这本 EPUB 打不开，可能文件有问题，或者带了加密（DRM）。";
    if (RD) { RD.el.querySelector(".rd-view").innerHTML = '<p class="rd-msg">' + msg + "</p>"; RD.el.querySelector(".rd-pos").textContent = ""; }
  }
  function rdStep(d) {
    if (!RD) return;
    if (RD.kind === "pdf") { if (RD.pdf) pdfGo(Math.max(1, Math.min(RD.pdf.n, pdfCur().n + d))); }
    else rdShow(RD.i + d);
  }
  function rdKeys(e) {
    if (!RD) return;
    if (e.key === "Escape") { e.preventDefault(); var pop = RD.el.querySelector(".rd-pop"); if (pop && !pop.hidden) { rdPopClose(); return; } readerClose(); return; }
    if ((e.altKey || e.ctrlKey) && e.key === "ArrowRight") { e.preventDefault(); rdStep(1); }
    else if ((e.altKey || e.ctrlKey) && e.key === "ArrowLeft") { e.preventDefault(); rdStep(-1); }
  }
  function ebBytes(id) {
    var eb = ebookOf(id);
    if (!eb) return Promise.reject(epErr("missing"));
    if (eb.local) return ebTx("readonly", function (st) { return st.get(id); }).then(function (rec) { if (!rec || !rec.blob) throw epErr("missing"); return rec.blob.arrayBuffer(); });
    return fetch("/_blob/" + eb.asset).then(function (r) {
      if (!r.ok) throw epErr("missing");
      return eb.enc === "b64" ? r.text().then(function (t) { var bin = atob(t.trim()), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u.buffer; }) : r.arrayBuffer();
    });
  }
  function readerOpen(id, opt) {
    readerClose();
    var eb = ebookOf(id), kind = eb && (eb.kind || "pdf") === "pdf" ? "pdf" : "epub";
    var it = ITEMS[id] || {}, title = (it.title || "").replace(/（.*）$/, "") || "电子书", nMk = marksOf(id).length;
    var el = document.createElement("div");
    el.className = "rd"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "阅读《" + title + "》");
    el.innerHTML = '<div class="rd-bar"><b class="rd-t">' + esc(title) + '</b><select class="rd-toc" aria-label="目录" disabled><option>目录</option></select>' +
      '<span class="rd-pos" aria-live="polite">正在打开……</span>' +
      (kind === "pdf" ? '<span class="rd-zoom"><button type="button" class="btn ghost small" data-act="rd-zoom" data-z="-1" aria-label="缩小">－</button><button type="button" class="btn ghost small" data-act="rd-zoom" data-z="1" aria-label="放大">＋</button></span>' : "") +
      (LIB.books[id] ? '<button type="button" class="btn ghost small rd-tb" data-act="rd-side" data-tab="ch" aria-pressed="false">本章精读</button>' : "") +
      '<button type="button" class="btn ghost small rd-tb rd-nb" data-act="rd-side" data-tab="mk" aria-pressed="false">笔记 <span class="rd-nbn">' + nMk + "</span></button>" +
      '<button type="button" class="btn ghost small" data-act="rd-close">关闭</button></div>' +
      '<div class="rd-main"><div class="rd-view"><p class="rd-msg">正在打开……</p></div><aside class="rd-side" aria-label="本章精读、划线和批注" hidden></aside></div>' +
      '<div class="rd-foot"><button type="button" class="btn ghost small" data-act="rd-prev">‹ ' + (kind === "pdf" ? "上一页" : "上一部分") + "</button>" +
      '<span class="rd-pg" aria-hidden="true"><i></i></span><span class="rd-pc">0%</span><button type="button" class="btn small rd-done" data-act="rd-done" hidden>读完了，标成已读</button>' +
      '<button type="button" class="btn ghost small" data-act="rd-next">' + (kind === "pdf" ? "下一页" : "下一部分") + " ›</button></div>" +
      '<div class="rd-tip" role="toolbar" aria-label="划线和批注" hidden>' + MK_COLORS.map(function (c) { return '<button type="button" class="rt-c c-' + c[0] + '" data-act="mk-add" data-c="' + c[0] + '" aria-label="' + c[1] + '色划线" title="' + c[1] + '色划线"></button>'; }).join("") +
      '<button type="button" class="rt-b" data-act="mk-note">批注</button><button type="button" class="rt-b" data-act="mk-copy">复制</button></div>' +
      '<div class="rd-pop" role="dialog" aria-label="这条划线" hidden></div>';
    document.body.appendChild(el); document.body.classList.add("rd-on");
    var mod = !!LIB.books[id], wide = window.innerWidth >= 1000;
    RD = { id: id, el: el, kind: kind, seq: 0, i: 0, back: document.activeElement, mod: mod, tab: opt && opt.notes ? "mk" : mod ? "ch" : "mk", side: !!(opt && opt.notes) || (mod && wide), chAuto: 0, chPick: 0 };
    ["mouseup", "keyup", "touchend"].forEach(function (ev) { el.addEventListener(ev, function (e) { if (!e.target.closest(".rd-tip, .rd-pop, .rd-bar, .rd-foot, .rd-side")) rdTipSoon(); }); });
    if (RD.side) rdSideToggle(true);
    el.querySelector('[data-act="rd-close"]').focus();
    if (kind === "pdf") { pdfStart(id); return; }
    ebBytes(id).then(epOpen).then(function (ep) {
      if (!RD || RD.id !== id) return;
      RD.ep = ep;
      var sel = el.querySelector(".rd-toc");
      if (ep.toc.length) {
        sel.innerHTML = ep.toc.map(function (t, k) { return '<option value="' + k + '">' + "　".repeat(Math.min(3, t.depth || 0)) + esc(t.label) + "</option>"; }).join("");
        sel.disabled = false;
      } else sel.hidden = true;
      var saved = rdResume(id, "epub");
      rdShow(saved && saved.i < ep.spine.length ? saved.i : 0, saved ? { y: saved.y } : null);
    }).catch(rdFail);
  }
  function readerClose() {
    if (!RD) return;
    rdSave(true);
    var P = RD.pdf;
    if (P) { try { P.io.disconnect(); } catch (e) { /* 忽略 */ } try { P.doc.destroy(); } catch (e2) { /* 忽略 */ } }
    var back = RD.back; RD.el.parentNode && RD.el.parentNode.removeChild(RD.el); document.body.classList.remove("rd-on"); RD = null;
    if (back && back.focus) try { back.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
    render();
  }
  /* 选中文字后浮出的小工具条：四种颜色划线、批注、复制 */
  var tipTimer = 0;
  function rdTipSoon() { clearTimeout(tipTimer); tipTimer = setTimeout(rdTip, 30); }
  function rdTipHide() { if (RD) { var tip = RD.el.querySelector(".rd-tip"); if (tip) tip.hidden = true; RD.sel = null; } }
  function rdSelInfo() {
    if (!RD) return null;
    if (RD.kind === "epub") {
      var f = RD.el.querySelector(".rd-frame"), d = f && f.contentDocument; if (!d || !d.body) return null;
      var sel = d.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
      var rg = sel.getRangeAt(0); if (!d.body.contains(rg.commonAncestorContainer)) return null;
      var r = rg.getBoundingClientRect(), fr = f.getBoundingClientRect();
      return { range: rg, sel: sel, root: d.body, loc: RD.i, rect: { left: fr.left + r.left, top: fr.top + r.top, bottom: fr.top + r.bottom, width: r.width } };
    }
    var s2 = window.getSelection(); if (!s2 || s2.isCollapsed || !s2.rangeCount) return null;
    var rg2 = s2.getRangeAt(0);
    function pg(nd) { var e = nd.nodeType === 1 ? nd : nd.parentNode; return e && e.closest ? e.closest(".pg") : null; }
    var pa = pg(rg2.startContainer), pb = pg(rg2.endContainer);
    if (!pa || !RD.el.contains(pa)) return null;
    if (pa !== pb) return { cross: true };
    var r2 = rg2.getBoundingClientRect();
    return { range: rg2, sel: s2, root: pa.querySelector(".textLayer"), loc: +pa.getAttribute("data-n"), rect: { left: r2.left, top: r2.top, bottom: r2.bottom, width: r2.width } };
  }
  function rdTip() {
    if (!RD) return;
    var tip = RD.el.querySelector(".rd-tip"), info = rdSelInfo();
    if (!info) { tip.hidden = true; RD.sel = null; return; }
    if (info.cross) { tip.hidden = true; toast("一次只能划同一页里的字"); return; }
    RD.sel = info;
    tip.querySelectorAll(".rt-c, [data-act=\"mk-note\"]").forEach(function (b) { b.hidden = !S.canEdit; });
    tip.hidden = false;
    var x = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, info.rect.left + info.rect.width / 2 - tip.offsetWidth / 2));
    var y = info.rect.top - tip.offsetHeight - 10; if (y < 56) y = info.rect.bottom + 10;
    tip.style.left = Math.round(x) + "px"; tip.style.top = Math.round(y) + "px";
  }
  function mkAdd(c, withNote) {
    var info = RD && RD.sel; if (!info || !info.range || !S.canEdit) return;
    var full = tqText(info.root), a = tqOff(info.root, info.range.startContainer, info.range.startOffset), z = tqOff(info.root, info.range.endContainer, info.range.endOffset);
    var exact = full.slice(a, z);
    if (!exact.trim()) return;
    if (exact.length > 3000) { toast("一次划得太长了，分几段划"); return; }
    var id = "mk-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    put("marks", id, { book: RD.id, kind: RD.kind, loc: info.loc, label: rdLabel(info.loc), exact: exact, prefix: full.slice(Math.max(0, a - 32), a), suffix: full.slice(z, z + 32), pos: a, c: c || "y", note: "", t: new Date().toISOString() });
    try { info.sel.removeAllRanges(); } catch (e) { /* 忽略 */ }
    rdTipHide(); rdMarksRefresh(info.loc);
    if (withNote) rdPop(id);
  }
  function mkCopy() {
    var info = RD && RD.sel; if (!info) return;
    var text = info.range.toString();
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast("已复制"); }, function () { toast("这个浏览器不让复制，用快捷键试试"); });
    rdTipHide();
  }
  function rdMarksRefresh(loc) {
    if (!RD) return;
    var list = marksOf(RD.id);
    if (RD.kind === "epub") {
      var f = RD.el.querySelector(".rd-frame"), d = f && f.contentDocument;
      if (d && d.body && (loc == null || loc === RD.i)) tqApply(d.body, list.filter(function (m) { return m.kind === "epub" && m.loc === RD.i; }));
    } else if (RD.pdf) {
      RD.pdf.boxes.forEach(function (bx) {
        var n = +bx.getAttribute("data-n"); if (loc != null && n !== loc) return;
        var tl = bx.querySelector(".textLayer"); if (bx.getAttribute("data-r")) tqApply(tl, list.filter(function (m) { return m.kind === "pdf" && m.loc === n; }));
      });
    }
    var nb = RD.el.querySelector(".rd-nbn"); if (nb) nb.textContent = list.length;
    if (RD.side) RD.el.querySelector(".rd-side").innerHTML = rdSideHTML();
  }
  /* 本章精读：原书读到哪一章，旁边就摆出精读模块里这一章的“带着问题读”、要点和思考题。
   * 第几章从电子书目录的标题里认（“第三章……”或含有章名），认不出就用下一章没精读完的，也可以在下拉框里自己选。 */
  function cnNum(t) {
    if (/^\d+$/.test(t)) return +t;
    var D = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }, n = 0, cur = 0;
    for (var i = 0; i < t.length; i++) { var c = t.charAt(i); if (c === "十") { n += (cur || 1) * 10; cur = 0; } else if (c === "百") { n += (cur || 1) * 100; cur = 0; } else if (D[c] != null) cur = D[c]; else return 0; }
    return n + cur;
  }
  function rdChOf(label) {
    var b = RD && LIB.books[RD.id]; if (!b || !label) return 0;
    var m = /第\s*([0-9一二三四五六七八九十百零〇两]+)\s*章/.exec(label), n = m ? cnNum(m[1]) : 0;
    if (n && b.chapters.some(function (c) { return c.n === n; })) return n;
    var hit = b.chapters.filter(function (c) { var t = c.title.replace(/（.*）$/, "").trim(); return t.length >= 2 && label.indexOf(t) >= 0; })[0];
    return hit ? hit.n : 0;
  }
  function rdCh() {
    var b = LIB.books[RD.id], bs = bookState(RD.id);
    return RD.chPick || RD.chAuto || (b ? b.chapters[Math.min(bs.done, b.chapters.length - 1)].n : 0);
  }
  function rdChHTML() {
    var b = LIB.books[RD.id], n = rdCh(), c = b.chapters.filter(function (x) { return x.n === n; })[0] || b.chapters[0], done = isDone(chId(RD.id, c.n));
    var how = RD.chPick ? "" : RD.chAuto ? "跟着你读到的位置" : "没从目录里认出是第几章，可以在上面选";
    var sel = '<select class="rs-chsel" aria-label="对应精读的哪一章">' + b.chapters.map(function (x) { return '<option value="' + x.n + '"' + (x.n === c.n ? " selected" : "") + ">第" + (CN[x.n] || x.n) + "章 " + esc(x.title) + (isDone(chId(RD.id, x.n)) ? " ✓" : "") + "</option>"; }).join("") + "</select>";
    return '<div class="rs-ch">' + sel + (how ? '<p class="rs-how">' + how + "</p>" : "") +
      (c.q ? '<div class="rs-q"><b>带着这个问题读</b><p>' + esc(c.q) + "</p></div>" : "") +
      (c.points && c.points.length ? '<details class="rs-pts"' + (RD.ptsOpen ? " open" : "") + '><summary>这一章的要点 · ' + c.points.length + ' 条</summary><ol>' + c.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></details>" : "") +
      (c.questions && c.questions.length ? '<div class="rs-qs"><b>读完想一想</b><ol>' + c.questions.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>" : "") +
      '<div class="rs-btns">' + (S.canEdit ? '<button type="button" class="btn small' + (done ? " ghost" : "") + '" data-act="rd-chdone" data-n="' + c.n + '" aria-pressed="' + done + '">' + (done ? "已精读完 ✓" : "这一章精读完了") + "</button>" : "") +
      '<button type="button" class="linkbtn" data-act="rd-chpage" data-n="' + c.n + '">打开本章精读页</button></div></div>';
  }
  function rdSideHTML() {
    var list = marksOf(RD.id);
    if (RD.mod && RD.tab === "ch") return rdChHTML();
    var head = '<div class="rs-h"><b>划线和批注</b><span>' + list.length + " 条</span></div>";
    if (!list.length) return head + '<p class="rs-empty">还没有划线。选中一段文字，就能划线或写批注。</p>';
    return head + '<ol class="rs-list">' + list.map(function (m) {
      return '<li class="c-' + esc(m.c || "y") + '"><button type="button" class="rs-go" data-act="mk-go" data-id="' + esc(m.id) + '"><small>' + esc(m.label || "") + '</small><span class="rs-q">' + esc(m.exact.length > 160 ? m.exact.slice(0, 160) + "……" : m.exact) + "</span>" +
        (m.note ? '<span class="rs-n">' + esc(m.note) + "</span>" : "") + "</button></li>";
    }).join("") + "</ol>";
  }
  /* 顶上的“本章精读”“笔记”两个按钮共用一个侧栏：点另一个就换内容，点正在看的那个就收起侧栏 */
  function rdSideToggle(on, tab) {
    if (!RD) return;
    var was = RD.side;
    if (tab && RD.side && on == null && tab !== RD.tab) { RD.tab = tab; on = true; }
    else if (tab) RD.tab = tab;
    RD.side = on == null ? !RD.side : on;
    rdSidePaint();
    RD.el.classList.toggle("side-on", RD.side);
    if (was !== RD.side && RD.kind === "pdf" && RD.pdf) { var cur = pdfCur(); setTimeout(function () { pdfLayout(); pdfGo(cur.n, null, cur.y); }, 0); }
  }
  function rdSidePaint() {
    var sd = RD.el.querySelector(".rd-side"); sd.hidden = !RD.side; if (RD.side) sd.innerHTML = rdSideHTML();
    RD.el.querySelectorAll(".rd-tb").forEach(function (b) { b.setAttribute("aria-pressed", String(RD.side && b.getAttribute("data-tab") === RD.tab)); });
  }
  function mkGo(mid) {
    var m = S.data.marks[mid]; if (!m || !RD) return;
    if (RD.kind === "epub") { if (m.loc === RD.i) { var d = RD.el.querySelector(".rd-frame").contentDocument, mk = d && d.querySelector('mark[data-mk="' + mid + '"]'); if (mk) mk.scrollIntoView({ block: "center", behavior: "smooth" }); } else rdShow(m.loc, { mark: mid }); }
    else pdfGo(m.loc, mid);
    if (window.innerWidth < 760) rdSideToggle(false);
  }
  function rdPop(mid) {
    var m = S.data.marks[mid]; if (!m || !RD) return;
    rdTipHide();
    var pop = RD.el.querySelector(".rd-pop"); RD.pop = mid;
    pop.innerHTML = '<p class="rp-q c-' + esc(m.c || "y") + '">' + esc(m.exact.length > 140 ? m.exact.slice(0, 140) + "……" : m.exact) + "</p>" +
      (S.canEdit ? '<div class="rp-cs">' + MK_COLORS.map(function (c) { return '<button type="button" class="rt-c c-' + c[0] + (m.c === c[0] ? " on" : "") + '" data-act="mk-color" data-c="' + c[0] + '" aria-label="改成' + c[1] + '色" aria-pressed="' + (m.c === c[0]) + '"></button>'; }).join("") + "</div>" +
        '<label class="rp-l"><span>批注</span><textarea class="rp-t" rows="4" maxlength="2000" placeholder="想到什么，写在这里">' + esc(m.note || "") + "</textarea></label>" +
        '<div class="rp-b"><button type="button" class="btn small" data-act="mk-save">保存</button><button type="button" class="linkbtn" data-act="mk-pop-close">关闭</button><button type="button" class="linkbtn danger" data-act="mk-del">删除这条划线</button></div>'
        : (m.note ? '<p class="rp-n">' + esc(m.note) + "</p>" : "") + '<div class="rp-b"><button type="button" class="linkbtn" data-act="mk-pop-close">关闭</button></div>');
    pop.hidden = false;
    var ta = pop.querySelector(".rp-t"); if (ta) ta.focus();
  }
  function rdPopClose() { if (RD) { RD.el.querySelector(".rd-pop").hidden = true; RD.pop = null; } }
  function mkUpdate(patch) {
    var mid = RD && RD.pop, m = mid && S.data.marks[mid]; if (!m) return;
    var v = Object.assign({}, m, patch); put("marks", mid, v); rdMarksRefresh(m.loc);
  }

  /* PDF：随站点放的 PDF.js；中文字体映射表（cmaps）和 14 种标准字体打包成 JSON，用到才下载 */
  var PDFJS = null, PDF_DATA = {};
  function pdfLib() {
    if (!PDFJS) {
      PDFJS = import(new URL("vendor/pdfjs/pdf.mjs", document.baseURI).href).then(function (m) {
        m.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.mjs", document.baseURI).href;
        return m;
      });
      PDFJS.catch(function () { PDFJS = null; });
    }
    return PDFJS;
  }
  function pdfData(name) {
    if (!PDF_DATA[name]) {
      PDF_DATA[name] = fetch(new URL("vendor/pdfjs/" + name + ".json", document.baseURI).href).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); });
      PDF_DATA[name].catch(function () { PDF_DATA[name] = null; });
    }
    return PDF_DATA[name];
  }
  function b64u8(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function PdfCMaps() { /* 由 PDF.js 调用 */ }
  PdfCMaps.prototype.fetch = function (o) { return pdfData("cmaps").then(function (m) { if (!m[o.name]) throw new Error("CMap " + o.name); return { cMapData: b64u8(m[o.name]), compressionType: 1 }; }); };
  function PdfFonts() { /* 由 PDF.js 调用 */ }
  PdfFonts.prototype.fetch = function (o) { return pdfData("fonts").then(function (m) { if (!m[o.filename]) throw new Error("Font " + o.filename); return b64u8(m[o.filename]); }); };
  function pdfZoomKey(id) { return "yanxilu-pdfzoom-" + id; }
  function pdfStart(id) {
    var view = RD.el.querySelector(".rd-view");
    var lib = pdfLib().catch(function () { throw epErr("pdf_lib"); });
    Promise.all([lib, ebBytes(id)]).then(function (r) {
      if (!RD || RD.id !== id) return null;
      var L = r[0];
      return L.getDocument({ data: new Uint8Array(r[1]), CMapReaderFactory: PdfCMaps, StandardFontDataFactory: PdfFonts, useWorkerFetch: false, isEvalSupported: false, cMapPacked: true }).promise.then(function (doc) {
        if (!RD || RD.id !== id) { doc.destroy(); return null; }
        return doc.getPage(1).then(function (p1) {
          var z = 1; try { z = +localStorage.getItem(pdfZoomKey(id)) || 1; } catch (e) { /* 忽略 */ }
          var P = RD.pdf = { lib: L, doc: doc, n: doc.numPages, base: p1.getViewport({ scale: 1 }), zoom: z, toc: [], boxes: [], scale: 1 };
          view.classList.add("pdf"); view.innerHTML = "";
          for (var k = 1; k <= P.n; k++) {
            var bx = document.createElement("div"); bx.className = "pg"; bx.setAttribute("data-n", k);
            bx.innerHTML = '<canvas aria-hidden="true"></canvas><div class="textLayer"></div><span class="pg-no" aria-hidden="true">' + k + "</span>";
            view.appendChild(bx); P.boxes.push(bx);
          }
          pdfLayout();
          P.io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { var n = +en.target.getAttribute("data-n"); if (en.isIntersecting) pdfRender(n); else pdfUnrender(n); }); }, { root: view, rootMargin: "1400px 0px" });
          P.boxes.forEach(function (b) { P.io.observe(b); });
          var tm = 0;
          view.addEventListener("scroll", function () { rdTipHide(); clearTimeout(tm); tm = setTimeout(function () { rdSave(); }, 300); });
          pdfOutline();
          var sv = rdResume(id, "pdf");
          pdfGo(sv && sv.i ? Math.min(P.n, sv.i) : 1, null, sv ? sv.y : 0);
          return null;
        });
      });
    }).catch(function (e) { rdFail(e && e.code ? e : epErr(e && e.name === "PasswordException" ? "pdf_lock" : "pdf_bad")); });
  }
  function pdfLayout() {
    var P = RD && RD.pdf; if (!P) return;
    var view = RD.el.querySelector(".rd-view"), W = Math.max(260, Math.min(880, view.clientWidth - 36));
    P.scale = Math.min(W / P.base.width, 2.4) * P.zoom;
    P.boxes.forEach(function (bx) {
      var w = bx.getAttribute("data-w"), h = bx.getAttribute("data-h");
      bx.style.width = Math.floor((w ? +w : P.base.width) * P.scale) + "px"; bx.style.height = Math.floor((h ? +h : P.base.height) * P.scale) + "px";
      bx.style.setProperty("--scale-factor", P.scale);
      if (bx.getAttribute("data-r")) { bx.removeAttribute("data-r"); bx._stale = true; }
    });
  }
  function pdfRender(n) {
    var P = RD && RD.pdf; if (!P) return Promise.resolve();
    var bx = P.boxes[n - 1]; if (!bx) return Promise.resolve();
    var key = String(P.scale);
    if (bx.getAttribute("data-r") === key) return bx._done || Promise.resolve();
    bx.setAttribute("data-r", key);
    if (bx._task) { try { bx._task.cancel(); } catch (e) { /* 忽略 */ } }
    bx._done = P.doc.getPage(n).then(function (page) {
      if (!RD || RD.pdf !== P || bx.getAttribute("data-r") !== key) return;
      var raw = page.getViewport({ scale: 1 }); bx.setAttribute("data-w", raw.width); bx.setAttribute("data-h", raw.height);
      var vp = page.getViewport({ scale: P.scale }), dpr = Math.min(2, window.devicePixelRatio || 1);
      bx.style.width = Math.floor(vp.width) + "px"; bx.style.height = Math.floor(vp.height) + "px";
      var cv = bx.querySelector("canvas"); cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr);
      cv.style.width = Math.floor(vp.width) + "px"; cv.style.height = Math.floor(vp.height) + "px";
      bx._task = page.render({ canvasContext: cv.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      return bx._task.promise.then(function () { return page.getTextContent(); }).then(function (tc) {
        if (!RD || RD.pdf !== P || bx.getAttribute("data-r") !== key) return;
        var tl = bx.querySelector(".textLayer"); tl.innerHTML = "";
        var layer = new P.lib.TextLayer({ textContentSource: tc, container: tl, viewport: vp });
        return layer.render().then(function () { bx._stale = false; tqApply(tl, marksOf(RD.id).filter(function (m) { return m.kind === "pdf" && m.loc === n; })); });
      });
    }).catch(function () { /* 翻得太快时会取消，忽略 */ });
    return bx._done;
  }
  function pdfUnrender(n) {
    var P = RD && RD.pdf; if (!P) return;
    var bx = P.boxes[n - 1]; if (!bx || !bx.getAttribute("data-r")) return;
    if (bx._task) { try { bx._task.cancel(); } catch (e) { /* 忽略 */ } }
    bx.removeAttribute("data-r"); var cv = bx.querySelector("canvas"); cv.width = 0; cv.height = 0; bx.querySelector(".textLayer").innerHTML = "";
  }
  function pdfCur() {
    var P = RD && RD.pdf, view = RD && RD.el.querySelector(".rd-view"); if (!P || !view) return { n: 1, y: 0 };
    var mark = view.scrollTop + view.clientHeight * 0.3;
    for (var k = 0; k < P.boxes.length; k++) {
      var bx = P.boxes[k], top = bx.offsetTop, h = bx.offsetHeight;
      if (top + h > mark || k === P.boxes.length - 1) return { n: k + 1, y: Math.max(0, Math.min(1, (view.scrollTop - top) / h)) };
    }
    return { n: 1, y: 0 };
  }
  function pdfPos() {
    var P = RD && RD.pdf; if (!P) return null;
    var c = pdfCur();
    RD.el.querySelector(".rd-pos").textContent = "第 " + c.n + " / " + P.n + " 页";
    RD.el.querySelector('[data-act="rd-prev"]').disabled = c.n <= 1;
    RD.el.querySelector('[data-act="rd-next"]').disabled = c.n >= P.n;
    var sel = RD.el.querySelector(".rd-toc"), cur = -1;
    P.toc.forEach(function (t, k) { if (t.page <= c.n) cur = k; });
    if (sel && !sel.disabled && cur >= 0) sel.value = String(cur);
    return { pct: Math.min(1, (c.n - 1 + c.y) / P.n), loc: c.n, y: c.y, total: P.n, label: rdLabel(c.n), kind: "pdf" };
  }
  function pdfGo(n, markId, y) {
    var P = RD && RD.pdf; if (!P) return;
    var view = RD.el.querySelector(".rd-view"), bx = P.boxes[n - 1]; if (!bx) return;
    view.scrollTop = bx.offsetTop + (y || 0) * bx.offsetHeight - 10;
    pdfRender(n).then(function () {
      if (!RD || RD.pdf !== P) return;
      if (markId) { var mk = bx.querySelector('mark[data-mk="' + markId + '"]'); if (mk) mk.scrollIntoView({ block: "center" }); }
      rdSave();
    });
  }
  function pdfZoom(d) {
    var P = RD && RD.pdf; if (!P) return;
    var cur = pdfCur();
    P.zoom = Math.max(0.5, Math.min(3, P.zoom * (d > 0 ? 1.15 : 1 / 1.15)));
    try { localStorage.setItem(pdfZoomKey(RD.id), String(Math.round(P.zoom * 100) / 100)); } catch (e) { /* 忽略 */ }
    pdfLayout(); pdfGo(cur.n, null, cur.y);
    for (var k = Math.max(1, cur.n - 1); k <= Math.min(P.n, cur.n + 2); k++) pdfRender(k);
  }
  function pdfOutline() {
    var P = RD.pdf;
    P.doc.getOutline().then(function (items) {
      if (!items || !items.length || !RD || RD.pdf !== P) { var s0 = RD && RD.el.querySelector(".rd-toc"); if (s0) s0.hidden = true; return; }
      var flat = [];
      (function walk(list, depth) { list.forEach(function (it) { flat.push({ label: it.title, dest: it.dest, depth: depth }); if (depth < 1 && it.items && it.items.length) walk(it.items, depth + 1); }); })(items, 0);
      return Promise.all(flat.slice(0, 300).map(function (t) {
        var dp = typeof t.dest === "string" ? P.doc.getDestination(t.dest) : Promise.resolve(t.dest);
        return dp.then(function (d) { return d && d[0] ? (typeof d[0] === "number" ? d[0] : P.doc.getPageIndex(d[0])) : null; }).then(function (pi) { return pi == null ? null : { label: String(t.label || "").trim(), page: pi + 1, depth: t.depth }; }, function () { return null; });
      })).then(function (res) {
        if (!RD || RD.pdf !== P) return;
        P.toc = res.filter(Boolean);
        var sel = RD.el.querySelector(".rd-toc");
        if (!P.toc.length) { sel.hidden = true; return; }
        sel.innerHTML = P.toc.map(function (t, k) { return '<option value="' + k + '">' + "　".repeat(t.depth) + esc(t.label) + "</option>"; }).join("");
        sel.disabled = false; rdSave();
      });
    }).catch(function () { /* 没有目录 */ });
  }
  /* 展台：上面一小块打着光的台子，封面立在左边，右边是书名、作者、领域和状态；
   * 下面只放三样：读到哪、下一步（继续读、打开电子书或挂一本电子书）、有几条划线。
   * 为什么读、批注、电子书文件、方向页和拿下这本书，都收在“更多”里（开合记在这次打开的页面里）。 */
  function daisId(title, meta, en, status, href) {
    var tt = esc(String(title).replace(/（.*）$/, ""));
    return '<div class="dz-id"><h2 id="pulled-h">' + (href ? '<a href="' + href + '" title="打开整本书的精读">' + tt + "</a>" : tt) + "</h2>" + (en ? '<p class="pb-en">' + esc(en) + "</p>" : "") +
      '<p class="meta">' + esc(meta.filter(Boolean).join(" · ")) + "</p>" + (status ? '<div class="pb-st">' + status + "</div>" : "") + "</div>";
  }
  function moreHTML(inner, hint) {
    if (!inner) return "";
    return '<details class="pb-more" data-more=""' + (S.moreOpen ? " open" : "") + '><summary><b>更多</b><small>' + esc(hint) + '</small></summary><div class="pb-more-in">' + inner + "</div></details>";
  }
  function bookDais(id) {
    var it = ITEMS[id], b = LIB.books[id], bs = bookState(id), dmi = domInfo(it.home), eb = ebookOf(id), rdg = readingOf(id);
    var pct = rdg && rdg.pct > 0.004 ? Math.round(rdg.pct * 100) : 0, acts = [];
    /* 一本书只有一个主按钮：有电子书就打开电子书接着读（精读书在旁边摆出本章精读）；精读书还没挂电子书，就打开下一章的精读页 */
    var next = b ? b.chapters[Math.min(bs.done, b.chapters.length - 1)] : null;
    if (eb) acts.push('<button type="button" class="btn eb-open" data-act="eb-read" data-id="' + esc(id) + '">' + (pct ? "接着读 · " + pct + "%" : "开始读") + "</button>");
    else if (b) acts.push('<button type="button" class="btn" data-act="open-ch" data-book="' + id + '" data-n="' + next.n + '">' + (bs.done ? "继续精读：第" : "开始精读：第") + CN[next.n] + "章</button>");
    if (/^cfa-/.test(id) && ROUTES["c-cfa"]) acts.push('<a class="btn ghost" href="#c-cfa">CFA 课程页</a>');
    if (!eb && !b) acts.push(ebUploadBtn(id, "＋ 挂一本电子书"));
    var nMk = marksOf(id).length;
    var mk = nMk ? '<p class="pb-mk">' + (eb ? '<button type="button" class="linkbtn" data-act="eb-read" data-id="' + esc(id) + '" data-notes="1">' + nMk + " 条划线和批注，在书里看</button>" : nMk + " 条划线和批注") + "</p>" : "";
    var links = (b ? '<p class="pb-links"><a class="linkbtn" href="#b-' + id + '">整本书的精读：导读、章节、论证地图、练习</a></p>' : "") +
      (eb && b ? '<p class="pb-links"><button type="button" class="linkbtn" data-act="open-ch" data-book="' + id + '" data-n="' + next.n + '">只看精读：第' + CN[next.n] + "章</button></p>" : "") +
      (dmi.href ? '<p class="pb-links"><a class="linkbtn" href="' + dmi.href + '">「' + esc(dmi.name) + "」方向的全部内容</a></p>" : "");
    var more = (it.why ? '<p class="pb-why">' + esc(it.why) + "</p>" : "") + noteBlock(id, "我的批注", "读到哪、想到什么，写在这里") + (eb ? ebFileHTML(id) : b && ebCanUpload() ? '<div class="pb-up">' + ebUploadBtn(id, "＋ 挂一本电子书").replace('class="btn ghost eb-up', 'class="btn ghost small eb-up') + '<span class="meta">挂上原书以后，主按钮就打开原书接着读，旁边摆着本章精读。</span></div>' : "") + links + shelfOpsHTML(id);
    var hint = [b ? "整本书" : "", it.why ? "为什么读" : "", "批注", eb ? "电子书文件" : b && ebCanUpload() ? "挂电子书" : "", S.canEdit && !/^cfa-/.test(id) ? "拿下" : ""].filter(Boolean).join(" · ");
    return { col: dmi.col, head: daisId(it.title, [it.by || (/^cfa-/.test(id) ? "CFA 一级" : ""), dmi.name, b ? "精读 " + bs.done + " / " + b.chapters.length + " 章" : ""], "", b ? "" : statusCtl(id, it.title), b ? "#b-" + id : ""),
      body: progCardHTML(id) + (acts.join("") ? '<div class="btns pb-acts">' + acts.join("") + "</div>" : "") + mk + moreHTML(more, hint) };
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
  function boxHTML(tp, wall) {
    var items = topicItems(tp), n = items.length, w = Math.min(150, 54 + 9 * Math.max(1, n)), col = SHELF_COL[tp.track] || "--ln-rev";
    var shown = items.slice(0, 10), step = (w - 22) / Math.max(1, shown.length);
    var slips = shown.map(function (rp, i) {
      var h = 12 + (i * 5) % 9;
      return '<i style="left:' + Math.round(11 + i * step + (step - 9) / 2) + "px;top:-" + h + "px;height:" + (h + 6) + "px;--k:var(" + KINDS[reportKind(rp)] + ')"></i>';
    }).join("");
    var on = wall ? S.shelfPick === "t:" + tp.id : S.archPick === tp.id;
    var cls = "abox" + (tp.status ? " " + tp.status : "") + (on ? " picked" : "") + (wall || archMatch(tp) ? "" : " dim");
    var act = wall ? 'data-act="pick" data-id="t:' + esc(tp.id) + '"' : 'data-act="abox" data-t="' + esc(tp.id) + '"';
    return '<button type="button" class="' + cls + '" ' + act + ' style="--c:var(' + col + ");width:" + w + 'px" title="' + esc(tp.title + (tp.question ? "：" + tp.question : "")) + '" aria-pressed="' + on + '">' +
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
  function archPanelHTML(tpArg) {
    var tp = tpArg || TOPIC[S.archPick]; if (!tp) return "";
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
      return '<button type="button" class="ms" data-act="pick-go" data-id="' + esc(b) + '" title="《' + esc(it.title) + "》" + esc(it.by || "") + '" aria-label="在书墙上看《' + esc(it.title) + '》" style="--c:var(' + c2 + ");height:" + (40 + (hashN(b) % 12)) + 'px"></button>';
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
    return '<nav class="seg shelf-seg" aria-label="书架里的两件家具"><a href="#shelf"' + (cur === "shelf" ? ' aria-current="page"' : "") + ">书墙 · " + nBooks + " 本</a>" +
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
      '<p class="lede">书挂在书墙上；自己做的研究按课题装进档案盒，书墙上也挂着一排，这里是完整的档案架。一个课题一盒，盒里按件编号，资料再多也只是盒子变厚、盒子变多。</p>' + shelfSeg("archive") +
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
    var books = allItems().filter(function (id) { return ITEMS[id].kind === "book" && !isHidden(id); });
    var cnt = { doing: 0, done: 0, todo: 0 };
    books.forEach(function (id) { var s = bookState(id).s; cnt[s === "review" ? "done" : s] = (cnt[s === "review" ? "done" : s] || 0) + 1; });
    EN_IDS.forEach(function (id) { var s = enState(id).s; cnt[s === "review" ? "done" : s] = (cnt[s === "review" ? "done" : s] || 0) + 1; });
    var nFilm = (EN.films || []).length, nAll = books.length + EN_IDS.length;
    var f = S.shelfF || "all";
    function chip(k, label, n) { return '<button type="button" class="chipbtn" data-act="shelf-f" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + ' <span class="segn">' + n + "</span></button>"; }
    return '<div class="view shelf wallv">' + bannerHTML() +
      '<header class="w-head"><h1>书架</h1>' + shelfSeg("shelf") + (S.canEdit ? '<button type="button" class="btn small w-add" data-act="add-book">＋ 加一本书</button>' : "") + '<div class="w-tools"><div class="chips" role="group" aria-label="只看">' + chip("all", "全部", nAll) + chip("doing", "在读", cnt.doing || 0) + chip("done", "读完", cnt.done || 0) + chip("todo", "还没读", cnt.todo || 0) + "</div>" + hangPicker() + "</div></header>" +
      '<div class="w-main"><div class="w-left">' + wallHTML() + wallLegend() + hiddenListHTML() + "</div>" + stageHTML() + "</div>" + addSheetHTML() + domSheetHTML() + "</div>";
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
    syncMyBooks();
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
    var sy = window.scrollY;
    $("#main").innerHTML = html;
    wallPack();
    if (!scrollTop && window.scrollY !== sy) window.scrollTo(0, sy);
    filmMount();
    ebHydrate();
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
    var hlm = RD && RD.kind === "pdf" && e.target.closest && e.target.closest(".rd mark.yx-hl");
    if (hlm && window.getSelection().isCollapsed) { rdPop(hlm.getAttribute("data-mk")); return; }
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "mst") { openStation(t.getAttribute("data-l"), +t.getAttribute("data-i")); return; }
    if (act === "mgs") { openGoalStop(t.getAttribute("data-g"), +t.getAttribute("data-i")); return; }
    if (act === "pick") {
      var pid = t.getAttribute("data-id"); if (pid !== S.shelfPick) S.flip = pid; S.shelfPick = pid;
      if (S.route !== "shelf") { location.hash = "#shelf"; return; }
      render(); var stg = document.querySelector(".dais-col");
      if (stg && window.getComputedStyle(stg).position !== "sticky") { var sr = stg.getBoundingClientRect(); if (sr.top < 0 || sr.top > window.innerHeight * 0.4) stg.scrollIntoView({ block: "start", behavior: REDUCE ? "auto" : "smooth" }); }
      return;
    }
    if (act === "hang") { hangSet(t.getAttribute("data-h")); var wl = document.querySelector(".wall"); if (wl) wl.className = "wall hang-" + hangGet(); document.querySelectorAll(".hang-b").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-h") === hangGet())); }); return; }
    if (act === "shelf-f") { S.shelfF = t.getAttribute("data-f"); render(); return; }
    if (act === "abox") { S.archPick = t.getAttribute("data-t"); render(); var ap = document.querySelector(".apanel"); if (ap && window.innerWidth < 1100) ap.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (act === "arch-f") { S.archF = t.getAttribute("data-f"); render(); return; }
    if (act === "abox-go") { S.archPick = t.getAttribute("data-t"); S.archF = "all"; closePop(); if (S.route === "archive") render(); else location.hash = "#archive"; return; }
    if (act === "eb-del") { S.ebConfirm = t.getAttribute("data-id"); render(); return; }
    if (act === "eb-del-no") { S.ebConfirm = null; render(); return; }
    if (act === "eb-del-yes") { ebRemove(t.getAttribute("data-id")); return; }
    if (act === "eb-read") { readerOpen(t.getAttribute("data-id"), { notes: t.getAttribute("data-notes") === "1" }); return; }
    if (act === "rd-close") { readerClose(); return; }
    if (act === "rd-prev") { rdStep(-1); return; }
    if (act === "rd-next") { rdStep(1); return; }
    if (act === "rd-zoom") { pdfZoom(+t.getAttribute("data-z")); return; }
    if (act === "rd-side") { rdSideToggle(null, t.getAttribute("data-tab")); return; }
    if (act === "rd-chdone") { if (RD) { var cn0 = +t.getAttribute("data-n"), cid = chId(RD.id, cn0); if (isDone(cid)) del("progress", cid); else put("progress", cid, { s: "done", t: new Date().toISOString() }); rdSidePaint(); } return; }
    if (act === "rd-chpage") { if (RD) { var bk = RD.id, cn1 = +t.getAttribute("data-n"); readerClose(); openChapter(bk, cn1); } return; }
    if (act === "rd-done") { if (RD) { put("progress", RD.id, { s: "done", t: new Date().toISOString() }); t.hidden = true; toast("标成已读完了"); } return; }
    if (act === "mk-add") { mkAdd(t.getAttribute("data-c")); return; }
    if (act === "mk-note") { mkAdd("y", true); return; }
    if (act === "mk-copy") { mkCopy(); return; }
    if (act === "mk-go") { mkGo(t.getAttribute("data-id")); return; }
    if (act === "mk-color") { mkUpdate({ c: t.getAttribute("data-c") }); if (RD && RD.pop) rdPop(RD.pop); return; }
    if (act === "mk-save") { var ta = RD && RD.el.querySelector(".rp-t"); if (ta) mkUpdate({ note: ta.value.trim() }); rdPopClose(); toast("批注存好了"); return; }
    if (act === "mk-del") { var dm = RD && RD.pop, dmk = dm && S.data.marks[dm]; if (dmk) { del("marks", dm); rdPopClose(); rdMarksRefresh(dmk.loc); } return; }
    if (act === "mk-pop-close") { rdPopClose(); return; }
    if (act === "eb-open-local") { var oid = t.getAttribute("data-id"); if (!S.ebUrls[oid]) { e.preventDefault(); ebOpenLocal(oid); } return; }
    if (act === "pick-go") { S.shelfPick = t.getAttribute("data-id"); S.shelfF = "all"; location.hash = "#shelf"; return; }
    if (act === "add-book") { S.addOpen = { track: t.getAttribute("data-t") || "", edit: t.getAttribute("data-edit") || "" }; render(); var ti = document.getElementById("add-title"); if (ti) ti.focus(); return; }
    if (act === "add-close") { S.addOpen = null; render(); return; }
    if (act === "dom-edit") { S.domOpen = t.getAttribute("data-k"); render(); var dn = document.querySelector('#dom-form [name="dname"]'); if (dn) dn.focus(); return; }
    if (act === "dom-close") { S.domOpen = null; render(); return; }
    if (act === "dom-del") { var dk = t.getAttribute("data-k"), dd = (S.data.domains || {})[dk]; if (dd && !domCount(dk)) { del("domains", dk); S.domOpen = null; render(); toast("「" + dd.name + "」这个领域删掉了"); } return; }
    if (act === "shelf-rm") { S.rmConfirm = t.getAttribute("data-id"); render(); return; }
    if (act === "shelf-rm-no") { S.rmConfirm = null; render(); return; }
    if (act === "shelf-rm-yes") { shelfRemove(t.getAttribute("data-id")); return; }
    if (act === "unhide") { var uh = t.getAttribute("data-id"); del("hidden", uh).then(function () { toast("《" + (ITEMS[uh] || {}).title + "》放回书墙了"); }); S.shelfPick = uh; S.flip = uh; render(); return; }
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
    if (act === "export") { copyText(JSON.stringify(Object.assign({}, S.data, { ebooks: undefined }), null, 2)); return; }
    if (act === "j-del") { S.confirmDel = t.getAttribute("data-id"); render(); return; }
    if (act === "j-del-no") { S.confirmDel = null; render(); return; }
    if (act === "j-del-yes") { var jid = t.getAttribute("data-id"); S.confirmDel = null; del("journal", jid); toast("已删除"); render(); return; }
  });
  document.addEventListener("keydown", function (e) { if (RD) { rdKeys(e); if (e.key === "Escape") e.stopImmediatePropagation(); } }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && (S.addOpen || S.domOpen)) { S.addOpen = null; S.domOpen = null; render(); } });
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
    if (t.classList && t.classList.contains("rs-chsel") && RD) { RD.chPick = +t.value; rdSidePaint(); return; }
    if (t.classList && t.classList.contains("rd-toc") && RD) {
      if (RD.pdf) { var tp = RD.pdf.toc[+t.value]; if (tp) pdfGo(tp.page); }
      else if (RD.ep) { var te = RD.ep.toc[+t.value]; if (te) rdShow(te.i, { frag: te.frag }); }
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-eb")) { var f = t.files && t.files[0]; t.value = ""; ebUpload(t.getAttribute("data-eb"), f); return; }
    if (t.matches && t.matches('select[data-act="status"]')) {
      var id = t.getAttribute("data-id"), v = t.value;
      if (v === "todo") del("progress", id); else put("progress", id, { s: v, t: new Date().toISOString() });
      t.blur(); render();
    }
  });
  document.addEventListener("toggle", function (e) {
    var d = e.target; if (d.matches && d.matches("details[data-more]")) { S.moreOpen = d.open; return; }
    if (d.matches && d.matches("details.rs-pts") && RD) { RD.ptsOpen = d.open; return; }
    if (!d.matches || !d.matches("details.ch")) return;
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
    if (e.target.id === "add-form") { e.preventDefault(); addSave(e.target); return; }
    if (e.target.id === "dom-form") { e.preventDefault(); domSave(e.target); return; }
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
  var wallT = 0;
  window.addEventListener("resize", function () { clearTimeout(wallT); wallT = setTimeout(function () { var w = document.querySelector(".wall"); if (w && Math.abs(w.clientWidth - WALL_W) > 1) wallRefresh(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (document.querySelector(".wall")) wallRefresh(); });
  var rzT = 0;
  window.addEventListener("resize", function () { if (!RD || RD.kind !== "pdf" || !RD.pdf) return; clearTimeout(rzT); rzT = setTimeout(function () { var c = pdfCur(); pdfLayout(); pdfGo(c.n, null, c.y); }, 200); });
  window.addEventListener("hashchange", function () {
    var r = readHash();
    S.route = r; S.confirmDel = null; render(true);
  });

  /* ---------- 启动 ---------- */
  S.route = readHash();
  if (window.claude && typeof window.claude.use === "function") { render(); connect(); }
  else enterLocal();
})();
