(function () {
  "use strict";
  document.documentElement.lang = "zh-CN";

  var LIB = window.YXL_LIB, REC = window.YXL_RECORD || { data: {} };
  var PLAN = window.YXL_PLAN || null, STUDY_SNAP = window.YXL_STUDY || { next: {}, days: {}, streak: 0 };
  var LESSON_SNAP = window.YXL_LESSONS || {};
  var COLLS = ["progress", "notes", "journal", "cards", "study"];
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
  function emptyData() { return { progress: {}, notes: {}, journal: {}, cards: {}, study: {} }; }

  /* ---------- 索引 ---------- */
  var ITEMS = {};
  LIB.tracks.forEach(function (t) {
    t.stages.forEach(function (s) { s.items.forEach(function (it) { if (typeof it === "object") ITEMS[it.id] = Object.assign({ tracks: [] }, it); }); });
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
    if (ref === "plan") return "每日课表";
    if (ITEMS[ref]) return ITEMS[ref].kind === "book" ? "《" + ITEMS[ref].title + "》" : ITEMS[ref].title;
    var m = /^(.+)-ch(\d+)$/.exec(ref);
    if (m && LIB.books[m[1]]) return "《" + LIB.books[m[1]].title + "》第" + CN[+m[2]] + "章";
    return "";
  }
  function refHref(ref) {
    if (!ref) return "";
    if (ref === "plan") return "#plan";
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
    var r = S.route, sec = r === "plan" || /^l-/.test(r) ? "plan" : r === "shelf" || /^[tbr]-/.test(r) ? "shelf" : r;
    var due = dueCards().length;
    function it(id, label, extra) { return '<a href="#' + id + '"' + (sec === id ? ' aria-current="page"' : "") + ">" + ICON[id] + "<span>" + label + "</span>" + (extra || "") + "</a>"; }
    var mode = S.mode === "db" ? (S.canEdit ? ["db", "云端记录"] : ["db", "只读浏览"]) : S.mode === "local" ? ["local", "公开阅读版"] : ["", "正在连接"];
    return '<div class="tb-in"><a class="brand" href="#home" aria-label="研习录，回到线网"><span class="roundel" aria-hidden="true"><i></i></span><b>研习录</b></a>' +
      '<nav class="mainnav" aria-label="主导航">' + it("home", "线网") + (PLAN ? it("plan", "课表") : "") + it("shelf", "书架") +
      it("review", "复习", due ? '<span class="nb">' + due + "</span>" : "") + it("journal", "足迹") + "</nav>" +
      '<span class="mode ' + mode[0] + '"><i></i>' + mode[1] + "</span></div>";
  }

  /* ---------- 专题（独立页面，新标签页打开；按 reportGroups 分组） ---------- */
  var IN_ARTIFACT = !!(window.claude && typeof window.claude.use === "function");
  var REPORTS = LIB.reports || [];
  var RGROUPS = LIB.reportGroups || [{ id: "data", name: "数据专题", trackHead: "用数据看这个方向" }];
  function reportsIn(gid, list) { return (list || REPORTS).filter(function (rp) { return (rp.group || "data") === gid; }); }
  function reportHref(rp) { return IN_ARTIFACT && rp.artifact ? rp.artifact : rp.href; }
  function reportRows(list) {
    return list.map(function (rp) {
      var tr = (rp.tracks || []).map(function (x) { return TRACK[x] ? TRACK[x].short : ""; }).filter(Boolean).join("、");
      return '<a class="rrow" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><span class="rname">' + esc(rp.title) + '<span class="ext" aria-hidden="true">↗</span></span>' +
        '<span class="rdesc">' + esc(rp.desc) + '</span><span class="rmeta">' + esc(rp.date.replace("-", " 年 ") + " 月") + (tr ? " · " + esc(tr) : "") + "</span></a>";
    }).join("");
  }

  /* ---------- 总览 ---------- */
  function focusBlock(fid) {
    var f = LIB.books[fid], bp = bookProg(fid);
    var next = f.chapters.filter(function (c) { return !isDone(chId(fid, c.n)); })[0] || f.chapters[0];
    return '<div class="fb"><h2><a href="#b-' + fid + '">' + esc(f.title) + '</a></h2><p class="meta">' + esc(f.author) + " · 已读完 " + bp.done + " / " + bp.total + " 章</p>" +
      stripHTML(fid) +
      '<div class="btns"><button type="button" class="btn" data-act="open-ch" data-book="' + fid + '" data-n="' + next.n + '">继续：第' + CN[next.n] + "章 " + esc(next.title) + "</button>" +
      Object.keys(f.deep || {}).map(function (k) { return '<a class="btn ghost" href="#r-' + fid + "-" + k + '">第' + CN[+k] + "章精读稿</a>"; }).join("") + "</div></div>";
  }
  function shelfHTML() {
    var items = allItems(), doneN = items.filter(isDone).length;
    var js = journalEntries(), mins = js.reduce(function (a, e) { return a + (Number(e.minutes) || 0); }, 0);
    var due = dueCards().length;
    var rows = LIB.tracks.map(function (t) {
      var p = trackProg(t), pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      return '<a class="trow" href="#t-' + t.id + '"><span class="tname">' + esc(t.name) + '</span><span class="tgoal">' + esc(t.goal) + '</span>' +
        '<span class="tprog"><span class="bar"><span style="width:' + pct + '%"></span></span><span>' + p.done + " / " + p.total + " 项" + (p.doing ? " · " + p.doing + " 项进行中" : "") + "</span></span></a>";
    }).join("");
    return '<div class="view">' + bannerHTML() +
      '<header><p class="eyebrow">研习录 · 始于 2026 年 10 月</p><h1>书架</h1>' +
      '<p class="lede">正在精读的书、五个学习方向和全部专题都在这里。每天学什么，回到首页的线网看。</p>' +
      '<div class="stats"><span><b>' + doneN + "</b>/ " + items.length + ' 项已完成</span><span><b>' + js.length + '</b>条学习足迹</span><span><b>' + (Math.round(mins / 6) / 10) + '</b>小时累计</span><span><b>' + due + "</b>张概念卡待复习</span></div></header>" +
      '<section class="focus" aria-label="正在精读"><div class="focus-top"><p class="eyebrow">正在精读</p><a class="btn small ghost" href="#review">复习概念卡</a></div>' +
      FOCUS.map(focusBlock).join("") + "</section>" +
      '<section><h2>五个学习方向</h2><div class="tracks">' + rows + "</div></section>" +
      RGROUPS.map(function (g) { var rs = reportsIn(g.id);
        return rs.length ? '<section><h2>' + esc(g.name) + '</h2><div class="reports">' + reportRows(rs) + "</div></section>" : ""; }).join("") +
      '<section class="pair"><div class="col"><h2>最近的学习足迹</h2>' + journalList(js.slice(0, 4), false) + '<p class="more"><a href="#journal">全部足迹</a></p></div>' +
      '<div class="col"><h2>怎么用</h2><ol class="steps">' +
      "<li><span><b>读与问</b>按路线图读书；有疑问就在对话里和 Claude 讨论。</span></li>" +
      "<li><span><b>留痕</b>在这里标进度、写批注、记一笔学习足迹。</span></li>" +
      "<li><span><b>整理入库</b>讨论完说一句“更新研习录”，讨论成果会写进对应模块。</span></li>" +
      "<li><span><b>同步</b>每次更新都推送到 GitHub，保留完整的版本历史。</span></li>" +
      "<li><span><b>复习</b>概念卡按 1、3、7、16、35 天的间隔安排复习。</span></li>" +
      "</ol></div></section></div>";
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
    return '<div class="cards-head"><p>点卡片翻面。复习时按记忆程度分盒，记得越牢，下次复习隔得越久。' + (nPrompt ? "精读稿里另有 " + nPrompt + " 道嵌入自测题，读到并自评之后才进入复习。" : "") + '</p><a class="btn" href="#review">' + (due ? "开始复习（" + due + " 张到期）" : "今天没有到期的卡片") + "</a></div>" +
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
  function journalHTML() {
    var js = journalEntries(), mins = js.reduce(function (a, e) { return a + (Number(e.minutes) || 0); }, 0);
    var days = {}; js.forEach(function (e) { days[e.date] = 1; });
    var form = S.canEdit ? '<form class="jform" id="j-form" autocomplete="off"><h2>记一笔</h2><div class="row">' +
      '<label class="field"><span>日期</span><input type="date" id="j-date" value="' + today() + '"></label>' +
      '<label class="field"><span>用时（分钟）</span><input type="number" id="j-min" min="0" step="5" inputmode="numeric" placeholder="例如 45"></label>' +
      '<label class="field ref"><span>关联内容</span><select id="j-ref">' + refOptions() + "</select></label></div>" +
      '<label class="field"><span>这次学了什么、想明白了什么</span><textarea id="j-text" rows="3" placeholder="例如：读完第二章。五个假设里，我最怀疑“理性行为体”这一条，因为……"></textarea></label>' +
      '<div><button class="btn" type="submit">保存这条足迹</button></div></form>' : "";
    var groups = {}, order = [];
    js.forEach(function (e) { var m = String(e.date).slice(0, 7); if (!groups[m]) { groups[m] = []; order.push(m); } groups[m].push(e); });
    var out = order.map(function (m) {
      return '<section class="month"><h2>' + m.replace("-", " 年 ") + " 月</h2>" + journalList(groups[m], true) + "</section>";
    }).join("");
    return '<div class="view">' + bannerHTML() + '<header><p class="eyebrow">记录</p><h1>学习足迹</h1>' +
      '<p class="lede">每次学习留一笔：读了什么、用了多久、想明白了什么。日积月累，就是一份可以回看的学习史。</p>' +
      '<div class="stats"><span><b>' + js.length + '</b>条足迹</span><span><b>' + Object.keys(days).length + '</b>个学习日</span><span><b>' + (Math.round(mins / 6) / 10) + "</b>小时累计</span></div></header>" +
      form + (out || '<p class="empty-line">还没有学习足迹。</p>') + "</div>";
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
  function dayPlan(date) {
    var STUDY = curStudy();
    var wd = new Date(utcDay(date)).getUTCDay(), res = { date: date, wd: wd, slots: [] };
    if (date === PLAN.prep) { res.prep = true; return res; }
    if (dayDiff(PLAN.start, date) < 0) { res.before = true; return res; }
    var cfa = null;
    PLAN.week[wd].forEach(function (x) {
      var s = { subj: x[0], mins: x[1] };
      if (x[0] !== "en") {
        var list = lessonList(x[0]), i = STUDY.next[x[0]] || 0;
        s.index = i; s.total = list.length;
        s.title = i < list.length ? list[i].title : "这一科本阶段已学完";
        if (x[0] === "cfa") cfa = list[i];
      }
      res.slots.push(s);
    });
    res.slots.forEach(function (s) { if (s.subj === "en") s.title = wd === 0 ? "本周 CFA 词汇小测 + 1、3、7 天前的词复习" : "CFA 术语与短文" + (cfa ? "：" + cfa.en : ""); });
    return res;
  }
  function lessonDate(file) { var m = /(\d{4}-\d{2}-\d{2})\.md$/.exec(file || ""); return m ? m[1] : ""; }
  function lessonHref(file) { var d = lessonDate(file); return d ? "#l-" + d : PLAN.repo + file; }

  /* ---------- 讲义阅读 ---------- */
  /* 讲义正文：云端版按需读 lessons/<日期> 文档（早上定时任务写入），读不到就用构建时嵌入的快照 */
  var LESSON = {};   // 日期 -> { md } | { loading: true } | { missing: true }
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
      var m = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(url);
      if (m) return '<a href="#l-' + m[1] + '">' + txt + "</a>";
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
  function lessonHTML(date) {
    var md = lessonMd(date), c = LESSON[date] || {}, STUDY = curStudy(), days = Object.keys(STUDY.days).filter(function (d) { return STUDY.days[d].file; }).sort();
    var k = days.indexOf(date), prev = k > 0 ? days[k - 1] : "", next = k >= 0 && k < days.length - 1 ? days[k + 1] : "";
    var nav = '<nav class="lnav">' + (prev ? '<a class="btn ghost small" href="#l-' + prev + '">← ' + prev + "</a>" : "<span></span>") +
      '<a class="btn ghost small" href="#plan">课表</a>' + (next ? '<a class="btn ghost small" href="#l-' + next + '">' + next + " →</a>" : "<span></span>") + "</nav>";
    var gh = PLAN.repo + "study/daily/" + date + ".md";
    var body = md ? '<article class="md">' + mdHTML(md) + "</article>"
      : c.loading ? '<p class="empty-line">讲义加载中……</p>'
      : '<p class="empty-line">研习录里还没有这天的讲义。可以先看 <a href="' + gh + '" target="_blank" rel="noopener">GitHub 上的版本</a>。</p>';
    return '<div class="view lesson"><p class="eyebrow"><a href="#plan">每日课表</a> · 讲义</p>' + nav + body + nav +
      '<p class="meta src">原文件：<a href="' + gh + '" target="_blank" rel="noopener">study/daily/' + date + ".md</a></p></div>";
  }
  function planBadge() {
    var t = bjToday(), w = weekNo(t);
    if (t === PLAN.prep) return '<span class="n due">今天准备</span>';
    return w ? '<span class="n">第' + w + "周</span>" : "";
  }
  function slotRows(day, rec) {
    if (day.prep) return '<ul class="slots"><li><span class="subj">准备日</span><div><b>装好工具、备好书</b><ol class="check">' +
      PLAN.prepDay.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div><span class=\"mins\">约 60 分钟</span></li></ul>";
    var planned = rec && rec.planned ? rec.planned : day.slots, done = (rec && rec.done) || [];
    return '<ul class="slots">' + planned.map(function (s) {
      var ok = done.indexOf(s.subj) >= 0;
      return '<li class="' + (ok ? "ok" : "") + '"><span class="subj">' + esc((PLAN.subjects[s.subj] || {}).name || s.subj) + "</span><div><b>" + esc(s.title || "") + "</b></div>" +
        '<span class="mins">' + (ok ? "✓ " : "") + s.mins + " 分钟</span></li>";
    }).join("") + "</ul>";
  }
  function todayBlockHTML() {
    var STUDY = curStudy();
    if (!PLAN) return "";
    var t = bjToday(), day = dayPlan(t), rec = STUDY.days[t];
    if (day.before) return "";
    var total = day.prep ? 60 : day.slots.reduce(function (a, s) { return a + s.mins; }, 0);
    return '<section class="today" aria-labelledby="today-h"><p class="eyebrow">今天 · ' + t + " " + WD[day.wd] + (day.prep ? " · 准备日" : " · 第" + weekNo(t) + "周") + "</p>" +
      '<h2 id="today-h"><a href="#plan">今天的课</a><span class="tot">' + total + " 分钟</span></h2>" + slotRows(day, rec) +
      '<div class="btns">' + (rec && rec.file ? '<a class="btn" href="' + esc(lessonHref(rec.file)) + '">打开今天的讲义</a>' : '<span class="meta">讲义每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送</span>") +
      '<a class="btn ghost" href="#plan">看整张课表</a></div></section>';
  }
  function planHTML() {
    var STUDY = curStudy();
    var t = bjToday(), days = Object.keys(STUDY.days).sort().reverse();
    var learned = days.filter(function (d) { var s = STUDY.days[d].status; return s === "done" || s === "partial"; });
    var mins = learned.reduce(function (a, d) { return a + (Number(STUDY.days[d].minutes) || 0); }, 0);
    var subjOrder = ["sql", "py", "cfa", "geo", "rev"];
    var prog = subjOrder.map(function (k) {
      var list = lessonList(k), i = Math.min(STUDY.next[k] || 0, list.length), pct = list.length ? Math.round(i / list.length * 100) : 0;
      return '<a class="trow" href="#ls-' + k + '"><span class="tname">' + esc(PLAN.subjects[k].name) + '</span><span class="tgoal">' + (i < list.length ? "下一课：" + esc(list[i].title) : "本阶段已学完") + "</span>" +
        '<span class="tprog"><span class="bar"><span style="width:' + pct + '%"></span></span><span>' + i + " / " + list.length + " 课</span></span></a>";
    }).join("");
    var wk = [1, 2, 3, 4, 5, 6, 0].map(function (wd) {
      var sl = PLAN.week[wd], tot = sl.reduce(function (a, x) { return a + x[1]; }, 0);
      return "<tr><th scope=\"row\">" + WD[wd] + "</th><td>" + sl.map(function (x) { return esc(PLAN.subjects[x[0]].name) + " " + x[1]; }).join(" · ") + '</td><td class="num">' + tot + "</td></tr>";
    }).join("");
    var log = days.length ? '<ul class="jlist">' + days.map(function (d) {
      var r = STUDY.days[d], st = r.status || "pushed";
      var names = (r.done || []).map(function (k) { return (PLAN.subjects[k] || {}).name || (k === "prep" ? "准备日" : k); });
      return '<li><span class="jdate">' + esc(d) + '</span><div class="jbody"><div class="jmeta"><span class="dst ' + st + '">' + esc(DAY_STATUS[st] || st) + "</span>" +
        (r.minutes ? '<span class="jmin">' + esc(r.minutes) + " 分钟</span>" : "") + (r.file ? '<a href="' + esc(lessonHref(r.file)) + '">讲义</a>' : "") + "</div>" +
        (names.length ? '<p class="jtext">完成：' + esc(names.join("、")) + "</p>" : "") + (r.note ? '<p class="jtext">' + esc(r.note) + "</p>" : "") + "</div></li>";
    }).join("") + "</ul>" : '<p class="empty-line">还没有打卡记录。第一份讲义 ' + PLAN.prep + " 早上推送。</p>";
    var seq = subjOrder.map(function (k) {
      var list = lessonList(k), i = STUDY.next[k] || 0;
      return '<details class="lsq" id="ls-' + k + '"><summary><b>' + esc(PLAN.subjects[k].name) + '</b><span class="meta">' + list.length + " 课 · 已学 " + Math.min(i, list.length) + "</span></summary>" +
        '<p class="why">' + esc(PLAN.subjects[k].why) + "</p><ol>" + list.map(function (x, j) { return '<li class="' + (j < i ? "ok" : j === i ? "cur" : "") + '">' + esc(x.title) + "</li>"; }).join("") + "</ol></details>";
    }).join("") + '<details class="lsq"><summary><b>英语</b><span class="meta">每天 20 分钟</span></summary><p class="why">' + esc(PLAN.subjects.en.why) + "</p></details>";
    return '<div class="view">' + '<header><p class="eyebrow">每日 · ' + esc(PLAN.phase) + "</p><h1>每日课表</h1>" +
      '<p class="lede">' + PLAN.weeks + " 周，" + PLAN.start + " 开课，每天 1.5–2 小时。每天早上 " + PLAN.push + "（" + PLAN.tz + "）推送当天讲义，晚上 " + PLAN.checkin + " 打卡。没学完的课下次接着学，不跳过。</p>" +
      '<div class="stats"><span><b>' + (weekNo(t) || 0) + "</b>/ " + PLAN.weeks + ' 周</span><span><b>' + learned.length + '</b>天已打卡</span><span><b>' + (STUDY.streak || 0) + '</b>天连续</span><span><b>' + (Math.round(mins / 6) / 10) + "</b>小时累计</span></div></header>" +
      todayBlockHTML() +
      '<section><h2>各科进度</h2><div class="tracks">' + prog + "</div></section>" +
      '<section><h2>一周安排</h2><table class="wk"><thead><tr><th scope="col">星期</th><th scope="col">时段（分钟）</th><th scope="col" class="num">合计</th></tr></thead><tbody>' + wk + "</tbody></table></section>" +
      '<section><h2>打卡记录</h2>' + log + "</section>" +
      '<section><h2>课程顺序</h2>' + seq + "</section></div>";
  }

  /* ---------- 复习 ---------- */
  function startReview() {
    var q = dueCards().sort(function (a, b) { return boxOf(a.id) - boxOf(b.id) || a.id.localeCompare(b.id); }).slice(0, 15).map(function (c) { return c.id; });
    S.rv = { q: q, i: 0, show: false, tally: { again: 0, hard: 0, good: 0 } };
  }
  function nextDue() {
    var ds = CARDS.map(function (c) { var s = S.data.cards[c.id]; return s && s.due; }).filter(Boolean).sort();
    return ds[0] || "";
  }
  function reviewHTML() {
    if (!S.rv) startReview();
    var rv = S.rv, head = '<header><p class="eyebrow">记录</p><h1>复习</h1><p class="lede">间隔重复：记住了的卡片升一盒，下次隔得更久；没记住的回到第一盒。各盒间隔依次为 1、3、7、16、35 天。</p></header>';
    var boxes = [0, 0, 0, 0, 0, 0]; CARDS.forEach(function (c) { if (c.prompt && !S.data.cards[c.id]) return; boxes[boxOf(c.id)]++; });
    var boxLine = '<div class="boxes" aria-label="各盒卡片数">' + boxes.map(function (n, i) { return '<span class="bx"><b>' + n + "</b>" + (i ? "第" + i + "盒" : "新卡") + "</span>"; }).join("") + "</div>";
    if (!rv.q.length || rv.i >= rv.q.length) {
      var done = rv.q.length && rv.i >= rv.q.length;
      var nd = nextDue();
      return '<div class="view">' + bannerHTML() + head + boxLine + '<div class="rv rest"><p class="front">' + (done ? "这一轮复习完成" : "今天没有到期的卡片") + "</p>" +
        (done ? "<p>记住 " + rv.tally.good + " 张，模糊 " + rv.tally.hard + " 张，没记住 " + rv.tally.again + " 张。</p>" : "") +
        (nd ? '<p class="meta">下一张到期：' + esc(nd) + "</p>" : "") +
        '<div class="acts"><a class="btn ghost" href="#b-' + FOCUS[0] + '">回到精读</a>' + (dueCards().length ? '<button type="button" class="btn" data-act="rv-restart">再来一轮</button>' : "") + "</div></div></div>";
    }
    var c = CARD[rv.q[rv.i]], b = LIB.books[c.book];
    var acts;
    if (!rv.show) acts = '<div class="acts"><button type="button" class="btn" data-act="reveal">显示解释</button></div>';
    else if (S.canEdit) acts = '<div class="acts"><button type="button" class="btn again" data-act="grade" data-g="again">没记住</button><button type="button" class="btn hard" data-act="grade" data-g="hard">模糊</button><button type="button" class="btn good" data-act="grade" data-g="good">记住了</button></div>';
    else acts = '<div class="acts"><button type="button" class="btn" data-act="rv-skip">下一张</button><span class="meta">只读浏览，复习结果不会保存。</span></div>';
    return '<div class="view">' + bannerHTML() + head + boxLine +
      '<div class="rv"><div class="rv-top"><span class="meta">' + (rv.i + 1) + " / " + rv.q.length + "</span><span class=\"meta\">《" + esc(b.title) + "》第" + CN[c.ch] + "章 · " + esc(cardMeta(c.id)) + "</span></div>" +
      '<p class="front">' + esc(c.f) + "</p>" + (rv.show ? '<p class="back">' + esc(c.b) + "</p>" : "") + acts + "</div></div>";
  }
  function grade(g) {
    var rv = S.rv, id = rv.q[rv.i];
    gradeCard(id, g);
    rv.tally[g]++; rv.i++; rv.show = false; render();
  }

  /* ---------- 线网（首页） ---------- */
  var M = window.YXL_METRO || null;
  var LINE_COLOR = { en: "--ln-en", sql: "--ln-sql", py: "--ln-py", cfa: "--ln-cfa", geo: "--ln-geo", rev: "--ln-rev", prep: "--ln-rev", tao: "--ln-tao", mm: "--ln-mm" };
  var DARK_INK = { en: 1, mm: 1 };
  var MCACHE = {};
  function subjName(s) { return s === "prep" ? "准备日" : ((PLAN && PLAN.subjects[s]) || {}).name || s; }
  function lineById(id) { return M.lines.filter(function (l) { return l.id === id; })[0]; }
  function lineOfSubj(subj) { return M.lines.filter(function (l) { return l.subj === subj && l.src; })[0]; }
  function addDaysBJ(d, n) { return new Date(utcDay(d) + n * 86400000).toISOString().slice(0, 10); }
  function wdOf(d) { return new Date(utcDay(d)).getUTCDay(); }
  function cnDate(d) { return +d.slice(5, 7) + "月" + +d.slice(8, 10) + "日"; }
  function onDay(subj, d) { return (PLAN.week[wdOf(d)] || []).some(function (x) { return x[0] === subj; }); }
  function plannedBy(subj, d) { var n = 0, k = dayDiff(PLAN.start, d); for (var i = 0; i < k; i++) if (onDay(subj, addDaysBJ(PLAN.start, i))) n++; return n; }
  function checkedIn(rec) { return !!(rec && rec.status && rec.status !== "pushed"); }
  /* 晚点（正数）/ 早到（负数）几站：按时刻表到今天该走完几站，减去实际走完几站 */
  function lineDelay(subj) {
    var t = bjToday(), STUDY = curStudy(), list = lessonList(subj);
    var plan = plannedBy(subj, t) + (checkedIn(STUDY.days[t]) && onDay(subj, t) ? 1 : 0);
    return Math.min(plan, list.length) - Math.min(STUDY.next[subj] || 0, list.length);
  }
  function nextWhen(subj) {
    var t = bjToday();
    for (var k = 0; k < 8; k++) { var d = addDaysBJ(t, k); if (onDay(subj, d)) return k === 0 ? "今天" : k === 1 ? "明天" : WD[wdOf(d)]; }
    return "";
  }
  function mmWeek() { return Math.max(0, Math.min(11, Math.floor(dayDiff(PLAN.start, bjToday()) / 7))); }
  function stationXY(ln) {
    if (MCACHE[ln.id]) return MCACHE[ln.id];
    var p = ln.pts, cum = [0], out = [], A = ln.anchors || [];
    for (var k = 1; k < p.length; k++) cum[k] = cum[k - 1] + Math.abs(p[k][0] - p[k - 1][0]) + Math.abs(p[k][1] - p[k - 1][1]);
    function at(d) {
      for (var k = 1; k < p.length; k++) if (d <= cum[k] + 0.001) { var f = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f]; }
      return p[p.length - 1];
    }
    for (var a = 0; a < A.length - 1; a++) {
      var i0 = A[a][0], p0 = A[a][1], i1 = A[a + 1][0], p1 = A[a + 1][1], last = a === A.length - 2;
      for (var i = i0; i < (last ? i1 + 1 : i1); i++) { var xy = at(cum[p0] + (cum[p1] - cum[p0]) * (i - i0) / (i1 - i0)); out.push([Math.round(xy[0] * 10) / 10, Math.round(xy[1] * 10) / 10]); }
    }
    return (MCACHE[ln.id] = out);
  }
  function linePath(pts, rad) {
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i];
      if (i < pts.length - 1) {
        var a = pts[i - 1], b = pts[i + 1];
        var straight = (a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]);
        if (!straight) {
          var r = Math.min(rad, (Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1])) / 2, (Math.abs(b[0] - p[0]) + Math.abs(b[1] - p[1])) / 2);
          var ux = Math.sign(p[0] - a[0]), uy = Math.sign(p[1] - a[1]), vx = Math.sign(b[0] - p[0]), vy = Math.sign(b[1] - p[1]);
          d += " L" + (p[0] - ux * r) + " " + (p[1] - uy * r) + " Q" + p[0] + " " + p[1] + " " + (p[0] + vx * r) + " " + (p[1] + vy * r);
          continue;
        }
      }
      d += " L" + p[0] + " " + p[1];
    }
    return d;
  }
  /* 一条线上每一站的内容和状态：done 学完 / cur 下一站 / todo 未到 / free 自由线的下一章 / week 本周 */
  function lineStops(ln) {
    var STUDY = curStudy(), out = [];
    if (!ln.src) return out;
    if (ln.src.indexOf("plan:") === 0) {
      var subj = ln.src.slice(5), list = lessonList(subj), nx = STUDY.next[subj] || 0;
      list.forEach(function (x, i) { out.push({ title: x.title, state: i < nx ? "done" : i === nx ? "cur" : "todo" }); });
    } else if (ln.src.indexOf("book:") === 0) {
      var bid = ln.src.slice(5), b = LIB.books[bid], first = -1;
      b.chapters.forEach(function (c, i) { var dn = isDone(chId(bid, c.n)); if (!dn && first < 0) first = i; out.push({ title: "第" + CN[c.n] + "章 " + c.title, n: c.n, state: dn ? "done" : "todo" }); });
      if (first >= 0) out[first].state = "free";
    } else if (ln.src === "mm") {
      var wk = mmWeek();
      M.mmWeeks.forEach(function (t, i) { out.push({ title: "第 " + (i + 1) + " 周 · " + t, state: i === wk ? "week" : "todo" }); });
    }
    return out;
  }
  function todayInfo() {
    var STUDY = curStudy(), t = bjToday(), rec = STUDY.days[t], day = dayPlan(t), slots;
    if (rec && rec.planned && rec.planned.length) {
      slots = rec.planned.map(function (p) {
        var o = { subj: p.subj, mins: p.mins, title: p.title, index: p.index };
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
  /* 保底：只走英语一站；标准：时刻表；加开：再多走一站，优先补晚点最多的线 */
  function routeFor(ti, mode) {
    var slots = ti.slots;
    if (mode === "min") { var en = slots.filter(function (s) { return s.subj === "en"; }); return { stops: en.length ? en : slots.slice(0, 1) }; }
    if (mode !== "plus") return { stops: slots };
    function mk(subj, ahead) {
      var list = lessonList(subj), i = (curStudy().next[subj] || 0) + ahead;
      if (i >= list.length) return null;
      return { subj: subj, mins: subj === "cfa" ? 35 : subj === "geo" ? 30 : 45, title: list[i].title, index: i, total: list.length, extra: true };
    }
    var late = ["sql", "py", "cfa", "geo"].map(function (s) { return { s: s, d: lineDelay(s) }; }).filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d; });
    for (var k = 0; k < late.length; k++) {
      var s = late[k].s, inToday = slots.some(function (x) { return x.subj === s; });
      var ex = mk(s, inToday ? 1 : 0);
      if (ex && (!inToday || late[k].d > 1)) return { stops: slots.concat([ex]), catchUp: { subj: s, d: late[k].d } };
    }
    var base = slots.filter(function (x) { return x.subj !== "en" && PLAN.lessons[x.subj]; })[0], ex2 = base ? mk(base.subj, 1) : null;
    return { stops: ex2 ? slots.concat([ex2]) : slots };
  }

  function stopSeq(s) {
    if (s.subj === "en") return "跟着 CFA 主题";
    if (!PLAN.lessons[s.subj]) return "";
    return "第 " + ((s.index || 0) + 1) + " / " + (s.total || lessonList(s.subj).length) + " 站";
  }
  function todayStripHTML(ti) {
    var mode = metroMode(), r = routeFor(ti, mode), stops = r.stops, t = ti.t, rec = ti.rec, day = ti.day;
    var total = stops.reduce(function (a, s) { return a + (s.mins || 0); }, 0);
    var head = '<div class="ts-top"><div><p class="eyebrow">今天 · ' + cnDate(t) + " " + WD[day.wd] + (day.prep ? " · 准备日" : day.before ? "" : " · 第 " + weekNo(t) + " 周第 " + (dayDiff(PLAN.start, t) % 7 + 1) + " 天") + '</p><h1 id="ts-h">今日路线</h1></div>' +
      '<div class="seg" role="group" aria-label="今天坐多远">' + [["min", "保底"], ["std", "标准"], ["plus", "加开"]].map(function (m) {
        var mins = m[0] === "std" ? ti.slots.reduce(function (a, s) { return a + (s.mins || 0); }, 0) : routeFor(ti, m[0]).stops.reduce(function (a, s) { return a + (s.mins || 0); }, 0);
        return '<button type="button" data-act="metro-mode" data-m="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + ' <span class="segn">' + mins + "′</span></button>";
      }).join("") + "</div></div>";
    if (!stops.length) {
      return '<section class="tstrip" aria-labelledby="ts-h">' + head + '<p class="ts-note" style="margin-top:16px">今天没有排课。讲义每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送。</p></section>";
    }
    var route = stops.map(function (s) {
      var c = LINE_COLOR[s.subj] || "--ln-rev";
      return '<div class="stp' + (s.extra ? " extra" : "") + '" style="--c:var(' + c + ');flex-grow:' + (s.mins || 20) + '"><span class="stp-dot" aria-hidden="true"></span><span class="stp-bar" aria-hidden="true"></span>' +
        '<div class="stp-tx"><span class="stp-tag"><b class="lbadge' + (DARK_INK[s.subj] ? " dk" : "") + '">' + esc(subjName(s.subj)) + (s.extra ? " · 加开" : "") + '</b><span class="stp-min">' + (s.mins || "") + "′</span></span>" +
        '<span class="stp-title">' + esc(s.title || "") + '</span><span class="stp-seq">' + esc(stopSeq(s)) + "</span></div></div>";
    }).join("") + '<div class="stp end"><span class="stp-dot" aria-hidden="true"></span><div class="stp-tx"><span class="stp-min">' + PLAN.checkin + '</span><span class="stp-title">终点 · 报站</span></div></div>';
    var note = mode === "min" ? "时间不够或状态不好就选它，走一站就算没停运。其余几站下次接着走，不会堆成欠账。"
      : mode === "plus" ? (r.catchUp ? subjName(r.catchUp.subj) + "线晚点 " + r.catchUp.d + " 站，多走这一站正好补上。" : "多走一站。早到不改时刻表，下次从再下一站开始。")
      : "按时刻表走。哪一站没走完，下次从这一站接着走。";
    var btn = rec && rec.file ? '<a class="btn" href="' + esc(lessonHref(rec.file)) + '">打开今天的讲义</a>' : '<span class="meta">讲义每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送</span>";
    var y = addDaysBJ(t, -1), yr = curStudy().days[y], warn = "";
    if (yr && !checkedIn(yr)) warn = '<p class="ts-warn"><b>' + cnDate(y) + "还没报站。</b>按没学处理，那几站下次接着走；其实学了的话，晚上报站时一起说，位置就会更新。</p>";
    return '<section class="tstrip" aria-labelledby="ts-h">' + head + '<div class="ts-route">' + route + "</div>" +
      '<div class="ts-foot">' + btn + '<p class="ts-note">全程 ' + total + " 分钟。" + note + "</p></div>" + warn + "</section>";
  }

  function metroSVG(ti) {
    var todaySub = {}; ti.slots.forEach(function (s) { todaySub[s.subj] = s; });
    var h = ['<svg class="metro' + (S.metroToday ? " today-only" : "") + '" viewBox="0 0 ' + M.w + " " + M.h + '" role="group" aria-label="线网图：学习线路、换乘站和地标">'];
    function tx(x, y, b, t, cls, anchor) {
      return '<text x="' + x + '" y="' + y + '"' + (cls ? ' class="' + cls + '"' : "") + (anchor ? ' text-anchor="' + anchor + '"' : "") + ">" + (b ? '<tspan font-weight="700">' + esc(b) + "</tspan>" : "") + esc(t || "") + "</text>";
    }
    function textW(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 12.5 : 7.4; return Math.round(w); }
    M.zones.forEach(function (z) {
      h.push('<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="14" style="' + (z.dashed ? "fill:none;stroke:var(--rule-strong);stroke-width:2;stroke-dasharray:7 6" : "fill:var(" + z.fill + ")") + '"/>');
      if (!z.name) return;
      var lab = '<text x="' + z.lx + '" y="' + z.ly + '" class="mzl" style="fill:var(' + z.ink + ')">' + esc(z.name) + "</text>";
      h.push(z.track && TRACK[z.track] ? '<a href="#t-' + z.track + '" class="mzone">' + lab + "</a>" : lab);
    });
    /* 图例 */
    h.push('<g class="mlg"><rect x="40" y="40" width="470" height="236" rx="14" style="fill:var(--map-bg);stroke:var(--rule)"/>' +
      '<text x="58" y="70" class="h">图例</text>' +
      '<path d="M58 100 L98 100" style="stroke:var(--ln-sql);stroke-width:6;stroke-linecap:round"/><circle cx="72" cy="100" r="4.6" style="fill:var(--map-bg);stroke:var(--ln-sql);stroke-width:2.4"/><circle cx="88" cy="100" r="4.6" style="fill:var(--ln-sql);stroke:var(--map-bg);stroke-width:1.6"/>' +
      '<text x="112" y="104">一条线是一门课或一本书；空心站未到，实心站已学完</text>' +
      '<circle cx="78" cy="130" r="9" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:4"/><text x="112" y="134">黑圈是每条线的下一站；标“今天”的是今天要走的站</text>' +
      '<circle cx="78" cy="160" r="9" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:3.5"/><path d="M58 160 L69 160 M87 160 L98 160" style="stroke:var(--ln-py);stroke-width:5"/><text x="112" y="164">换乘站：两条线在这里用到同一块知识</text>' +
      '<rect x="70" y="182" width="16" height="16" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:3"/><text x="112" y="194">地标：讨论和查到的资料，随时去看，不算进度</text>' +
      '<path d="M58 220 L98 220" style="stroke:var(--ln-cfa);stroke-width:5;stroke-dasharray:9 6"/><text x="112" y="224">虚线：规划中的线路</text>' +
      '<rect x="58" y="242" width="40" height="18" rx="4" style="fill:var(--z-data)"/><text x="112" y="256">底色区域是学习方向，点区域名进入</text></g>');
    /* 线路与站 */
    var overlay = [];
    M.lines.forEach(function (ln) {
      var col = "var(" + ln.color + ")", w = (ln.r || 4) * 2, isToday = ln.id === "en" || !!todaySub[ln.subj];
      h.push('<g class="mline' + (isToday ? " is-today" : "") + '" data-l="' + ln.id + '">');
      h.push('<path d="' + linePath(ln.pts, 16) + '" style="fill:none;stroke:' + col + ";stroke-width:" + w + ";stroke-linejoin:round;stroke-linecap:" + (ln.dash ? "butt;stroke-dasharray:10 7" : "round") + '"/>');
      if (ln.dash) h.push('<circle cx="' + ln.pts[ln.pts.length - 1][0] + '" cy="' + ln.pts[ln.pts.length - 1][1] + '" r="7" style="fill:var(--map-bg);stroke:' + col + ';stroke-width:2.5;stroke-dasharray:3 3"/>');
      var stops = lineStops(ln), xy = stationXY(ln), hubs = ln.hubs || [];
      stops.forEach(function (s, i) {
        var p = xy[i]; if (!p) return;
        var x = p[0], y = p[1], end = i === 0 || i === stops.length - 1;
        var r = ln.small && !end ? 3.4 : end ? 6 : 4.6, label = ln.name + " 第 " + (i + 1) + " 站：" + s.title;
        if (s.state === "cur" || s.state === "week" || s.state === "free") overlay.push({ ln: ln, i: i, x: x, y: y, s: s, label: label });
        if (hubs.indexOf(i) >= 0) return;
        var dot = s.state === "done" ? '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" style="fill:' + col + ';stroke:var(--map-bg);stroke-width:1.6"/>'
          : '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" style="fill:var(--map-bg);stroke:' + col + ";stroke-width:" + (end ? 3.5 : 2.4) + '"/>';
        h.push('<g class="mst" data-act="mst" data-l="' + ln.id + '" data-i="' + i + '" tabindex="-1" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title><circle class="hit" cx="' + x + '" cy="' + y + '" r="' + (ln.small ? 8 : 11) + '"/>' + dot + "</g>");
      });
      h.push("</g>");
    });
    /* 换乘站 */
    M.hubs.forEach(function (hb, k) {
      var shape = hb.cap ? '<rect x="' + (hb.x - 11) + '" y="' + (hb.y - 21) + '" width="22" height="42" rx="11" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:4"/>'
        : '<circle cx="' + hb.x + '" cy="' + hb.y + '" r="10" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:4"/>';
      h.push('<g class="mst" data-act="mhub" data-h="' + k + '" tabindex="0" role="button" aria-label="换乘站：' + esc(hb.name) + '"><title>换乘站：' + esc(hb.name) + "</title>" + shape + "</g>");
    });
    /* 地标 */
    M.landmarks.forEach(function (lm) {
      var rp = REPORTS.filter(function (x) { return x.id === lm.report; })[0]; if (!rp) return;
      if (lm.walk) h.push('<path d="M' + lm.walk[0][0] + " " + lm.walk[0][1] + " L" + lm.walk[1][0] + " " + lm.walk[1][1] + '" style="stroke:var(--ink);stroke-width:2;stroke-dasharray:2 4;stroke-linecap:round"/>');
      h.push('<a href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener" class="mlm" aria-label="地标：' + esc(rp.title) + '（新标签页打开）"><rect x="' + (lm.x - 8) + '" y="' + (lm.y - 8) + '" width="16" height="16" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:3"/>' +
        tx(lm.lx, lm.ly, rp.title, "") + (lm.sub ? tx(lm.lx, lm.ly + 17, "", lm.sub, "mut") : "") + "</a>");
    });
    /* 文字与线名牌 */
    M.labels.forEach(function (l) { h.push(tx(l.x, l.y, l.b, l.t, l.muted ? "mut" : "", l.anchor)); });
    M.badges.forEach(function (b) {
      var ln = lineById(b.line), w = textW(b.t) + 14;
      h.push('<g class="mbdg"><rect x="' + b.x + '" y="' + b.y + '" width="' + w + '" height="19" rx="4" style="fill:var(' + ln.color + ')"/><text x="' + (b.x + 7) + '" y="' + (b.y + 14) + '" style="fill:var(' + (b.dark ? "--bdg-on-dk" : "--bdg-on") + ')">' + esc(b.t) + "</text></g>");
    });
    /* 下一站、本周、今天 */
    overlay.forEach(function (o) {
      var col = "var(" + o.ln.color + ")", x = o.x, y = o.y, ring;
      if (o.s.state === "cur") ring = '<circle class="mhalo" cx="' + x + '" cy="' + y + '" r="13" style="stroke:' + col + '"/><circle cx="' + x + '" cy="' + y + '" r="9" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:4.5"/>';
      else if (o.s.state === "week") ring = '<circle cx="' + x + '" cy="' + y + '" r="8" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:3.2"/>';
      else ring = '<circle cx="' + x + '" cy="' + y + '" r="7.5" style="fill:var(--map-bg);stroke:var(--ink);stroke-width:2.4;stroke-dasharray:3.5 2.5"/>';
      var tag = "", sl = todaySub[o.ln.subj];
      if (o.s.state === "cur" && sl && sl.index === o.i) tag = "今天";
      else if (o.s.state === "week") tag = "本周";
      var tagSvg = tag ? '<g class="mtag" aria-hidden="true"><rect x="' + (x + 9) + '" y="' + (y - 31) + '" width="34" height="18" rx="3" style="fill:' + (tag === "今天" ? "var(--ink)" : "var(--map-bg)") + ';stroke:var(--ink);stroke-width:1.5"/><text x="' + (x + 26) + '" y="' + (y - 17.5) + '" text-anchor="middle" style="fill:' + (tag === "今天" ? "var(--map-bg)" : "var(--ink)") + ';stroke:none;font-size:12px;font-weight:700">' + tag + "</text></g>" : "";
      h.push('<g class="mst mline' + (o.ln.id === "en" || todaySub[o.ln.subj] ? " is-today" : "") + '" data-act="mst" data-l="' + o.ln.id + '" data-i="' + o.i + '" tabindex="0" role="button" aria-label="' + esc(o.label) + "（" + ({ cur: "下一站", week: "本周", free: "下一章" })[o.s.state] + (tag === "今天" ? "，今天要走" : "") + '）"><title>' + esc(o.label) + '</title><circle class="hit" cx="' + x + '" cy="' + y + '" r="14"/>' + ring + tagSvg + "</g>");
    });
    h.push("</svg>");
    return h.join("");
  }

  function boardHTML(ti) {
    var STUDY = curStudy(), rows = [];
    function row(id, name, color, dark, next, when, pill) {
      return '<div class="brow"><span class="bline"><b class="lbadge' + (dark ? " dk" : "") + '" style="--c:var(' + color + ')">' + esc(name) + '</b></span><span class="bnext">' + esc(next) + '</span><span class="bwhen">' + esc(when) + "</span>" + pill + "</div>";
    }
    var en = ti.slots.filter(function (s) { return s.subj === "en"; })[0];
    rows.push(row("en", "英语", "--ln-en", true, en ? en.title : "每天跟着当天的 CFA 主题", "每天", '<span class="pill free">每天</span>'));
    var late = [];
    ["sql", "py", "cfa", "geo", "rev"].forEach(function (s) {
      if (!PLAN.lessons[s]) return;
      var list = lessonList(s), nx = STUDY.next[s] || 0, d = lineDelay(s);
      if (d > 0) late.push({ s: s, d: d });
      var pill = d > 0 ? '<span class="pill late">晚点 ' + d + " 站</span>" : d < 0 ? '<span class="pill early">早到 ' + -d + " 站</span>" : '<span class="pill">正点</span>';
      rows.push(row(s, subjName(s), LINE_COLOR[s], false, nx < list.length ? "第 " + (nx + 1) + " 站 · " + list[nx].title : "本阶段已走完", nextWhen(s), pill));
    });
    var wk = mmWeek();
    rows.push(row("mm", "做市商研习", "--ln-mm", true, "第 " + (wk + 1) + " 周 · " + M.mmWeeks[wk], "本周", '<span class="pill free">按周走</span>'));
    var zb = LIB.books.zhoulu, fc = zb ? zb.chapters.filter(function (c) { return !isDone(chId("zhoulu", c.n)); })[0] : null;
    if (zb) rows.push(row("tao", "涛动周期录", "--ln-tao", false, fc ? "第" + CN[fc.n] + "章 " + fc.title : "已读完", "随时", '<span class="pill free">自由线</span>'));
    var adv = [];
    var y = addDaysBJ(ti.t, -1), yr = STUDY.days[y];
    if (late.length) {
      var max = Math.max.apply(null, late.map(function (x) { return x.d; }));
      adv.push(late.map(function (x) { return subjName(x.s); }).join("、") + "晚点" + (late.length === 1 ? " " + late[0].d + " 站" : "") + "。" + (max >= 3 ? "晚点 3 站以上的线，周日复盘时选一种调度：坐快车、顺延终点或暂停一条线。" : "找一天选“加开”就能补上。"));
      if (yr && !checkedIn(yr)) adv.push(cnDate(y) + "还没报站，所以先按没学算。");
    } else adv.push("各条线都正点。");
    return '<section class="panel" aria-labelledby="bd-h"><h2 id="bd-h">各线到站</h2>' + rows.join("") + '<p class="badvice">' + esc(adv.join("")) + "</p></section>";
  }
  function landmarkPanel() {
    var lineReports = M.lines.map(function (l) { return l.report; }).filter(Boolean);
    var list = REPORTS.filter(function (rp) { return lineReports.indexOf(rp.id) < 0; });
    return '<section class="panel" aria-labelledby="lm-h"><h2 id="lm-h">地标</h2><p class="meta" style="margin-top:6px">讨论和查到的资料，随时去看，不算进度。以后讨论完说一句“放进研习录”，就多一个地标。</p><div class="lmk-list">' +
      list.map(function (rp) { return '<a class="lmk" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener"><span class="lmk-sq" aria-hidden="true"></span><span class="lmk-t">' + esc(rp.title) + ' <span aria-hidden="true">↗</span></span><span class="lmk-d">' + esc(rp.desc) + "</span></a>"; }).join("") + "</div></section>";
  }
  function homeHTML() {
    if (!M || !PLAN) return shelfHTML();
    var ti = todayInfo();
    var nLines = M.lines.filter(function (l) { return l.src || l.id === "en"; }).length;
    return '<div class="view home">' + bannerHTML() + todayStripHTML(ti) +
      '<section class="mwrap" aria-labelledby="mw-h"><div class="mhead"><div><h2 id="mw-h">线网图</h2><p class="meta">' + esc(PLAN.phase) + " · " + nLines + " 条线 · " + M.hubs.length + " 个换乘站 · " + M.landmarks.length + ' 个地标</p></div>' +
      '<button type="button" class="chipbtn" data-act="metro-today" aria-pressed="' + !!S.metroToday + '">只看今天的线</button></div>' +
      '<div class="mscroll"><div class="minner" id="minner">' + metroSVG(ti) + '<div class="mpop" id="mpop" role="dialog" aria-label="站点详情" hidden></div></div></div>' +
      '<p class="meta mhint">点任意一站看详情和讲义；屏幕窄时可以左右拖动地图。</p></section>' +
      '<div class="hgrid">' + boardHTML(ti) + landmarkPanel() + "</div>" +
      '<details class="rules"><summary>运行规则</summary><ol>' +
      "<li>位置只看“学完”，不看日期。哪一站没走完，下次接着走，不会堆成欠账。</li>" +
      "<li>每天出发前选今天坐多远：保底只走英语一站，标准按时刻表走，加开多走一站。</li>" +
      "<li>每条线跟时刻表比，显示正点、晚点或早到。晚点 1–2 站，找一天加开补上。</li>" +
      "<li>晚点 3 站以上，周日复盘时三选一：坐快车（只走每课的必经部分），顺延这条线的终点，或者暂停一条线一周。</li>" +
      "<li>早到了，可以接着往前，也可以换乘自由线去读书。时刻表不变。</li>" +
      "<li>晚上 9 点报站。没报站，位置原地不动，不算失败。</li></ol></details></div>";
  }
  /* 站点详情 */
  function latestLesson(subj, i) {
    var STUDY = curStudy(), best = "";
    Object.keys(STUDY.days).forEach(function (d) { var r = STUDY.days[d]; if (r.file && (r.planned || []).some(function (p) { return p.subj === subj && p.index === i; }) && d > best) best = d; });
    return best;
  }
  function stationPopHTML(lid, i) {
    var ln = lineById(lid), stops = lineStops(ln), s = stops[i]; if (!s) return "";
    var stTxt = { done: "已学完", cur: "下一站", todo: "还没到", free: "下一章 · 自由线，想读就读", week: "本周这一站" }[s.state];
    var sl = todayInfo().slots.filter(function (x) { return x.subj === ln.subj; })[0];
    if (s.state === "cur" && sl && sl.index === i) stTxt += " · 今天要走";
    var links = [];
    if (ln.subj && PLAN.lessons[ln.subj]) {
      var d = latestLesson(ln.subj, i);
      if (d) links.push('<a class="btn small" href="#l-' + d + '">打开讲义（' + cnDate(d) + "）</a>");
      links.push('<a class="btn small ghost" href="#plan">在课表里看</a>');
    }
    if (ln.id === "geo" && i < 20) {
      var ch = Math.floor(i / 2) + 1, tb = LIB.books.tragedy;
      links.push(tb.deep && tb.deep[ch] ? '<a class="btn small ghost" href="#r-tragedy-' + ch + '">第' + CN[ch] + "章精读稿</a>" : '<button type="button" class="btn small ghost" data-act="open-ch" data-book="tragedy" data-n="' + ch + '">第' + CN[ch] + "章导读</button>");
    }
    if (ln.src && ln.src.indexOf("book:") === 0) {
      var bid = ln.src.slice(5), bk = LIB.books[bid];
      if (bk.deep && bk.deep[s.n]) links.push('<a class="btn small" href="#r-' + bid + "-" + s.n + '">精读稿</a>');
      links.push('<button type="button" class="btn small ghost" data-act="open-ch" data-book="' + bid + '" data-n="' + s.n + '">本章导读</button>');
    }
    if (ln.report) { var rp = REPORTS.filter(function (x) { return x.id === ln.report; })[0]; if (rp) links.push('<a class="btn small ghost" href="' + esc(reportHref(rp)) + '" target="_blank" rel="noopener">打开研习计划 ↗</a>'); }
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b class="lbadge' + (DARK_INK[ln.id] ? " dk" : "") + '" style="--c:var(' + ln.color + ')">' + esc(ln.name) + '</b><span class="mp-pos">第 ' + (i + 1) + " / " + stops.length + ' 站</span></div>' +
      '<p class="mp-t">' + esc(s.title) + '</p><p class="mp-s">' + esc(stTxt) + "</p>" + (links.length ? '<div class="btns">' + links.join("") + "</div>" : "");
  }
  function hubPopHTML(k) {
    var hb = M.hubs[k];
    return '<button type="button" class="mp-x" data-act="mpop-close" aria-label="关闭">×</button><div class="mp-h"><b>换乘站 · ' + esc(hb.name) + '</b></div><p class="mp-s" style="margin-top:6px">' + esc(hb.sub) + "</p><ul>" +
      hb.at.map(function (a) { var ln = lineById(a[0]), s = lineStops(ln)[a[1]]; return '<li><button type="button" class="linkrow" data-act="mst" data-l="' + a[0] + '" data-i="' + a[1] + '"><b class="lbadge' + (DARK_INK[a[0]] ? " dk" : "") + '" style="--c:var(' + ln.color + ')">' + esc(ln.name) + "</b> " + esc(s ? s.title : "") + "</button></li>"; }).join("") + "</ul>";
  }
  function openPop(html, x, y) {
    var inner = document.getElementById("minner"), pop = document.getElementById("mpop");
    if (!inner || !pop) return;
    var sc = inner.clientWidth / M.w;
    pop.innerHTML = html; pop.hidden = false;
    var px = x * sc, py = y * sc, pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(8, px - pw / 2), inner.clientWidth - pw - 8), top = py + 18;
    if (top + ph > inner.clientHeight - 8) top = py - ph - 18;
    pop.style.left = left + "px"; pop.style.top = Math.max(8, top) + "px";
    var f = pop.querySelector("a,button:not(.mp-x)") || pop.querySelector(".mp-x"); if (f) f.focus({ preventScroll: true });
  }
  function closePop() { var pop = document.getElementById("mpop"); if (pop && !pop.hidden) { pop.hidden = true; pop.innerHTML = ""; } }
  function openStation(lid, i) { var ln = lineById(lid), p = ln && stationXY(ln)[i]; if (p) openPop(stationPopHTML(lid, i), p[0], p[1]); }
  function openHub(k) { var hb = M.hubs[k]; if (hb) openPop(hubPopHTML(k), hb.x, hb.y); }

  /* ---------- 主渲染 ---------- */
  var ROUTES = { home: 1, shelf: 1, journal: 1, review: 1 };
  if (PLAN) ROUTES.plan = 1;
  LIB.tracks.forEach(function (t) { ROUTES["t-" + t.id] = 1; });
  Object.keys(LIB.books).forEach(function (b) {
    ROUTES["b-" + b] = 1;
    Object.keys(LIB.books[b].deep || {}).forEach(function (n) { ROUTES["r-" + b + "-" + n] = 1; });
  });
  function readHash() { var h = (location.hash || "").slice(1); return ROUTES[h] || (PLAN && /^l-\d{4}-\d{2}-\d{2}$/.test(h)) ? h : "home"; }

  function render(scrollTop) {
    $("#rail").innerHTML = railHTML();
    var r = S.route, html, rm = /^r-(.+)-(\d+)$/.exec(r);
    if (rm) html = readerHTML(rm[1], +rm[2]);
    else if (r.indexOf("t-") === 0) html = trackHTML(r.slice(2));
    else if (r.indexOf("b-") === 0) html = bookHTML(r.slice(2));
    else if (r === "journal") html = journalHTML();
    else if (r === "plan") html = planHTML();
    else if (/^l-\d{4}-\d{2}-\d{2}$/.test(r)) html = lessonHTML(r.slice(2));
    else if (r === "review") html = reviewHTML();
    else if (r === "shelf") html = shelfHTML();
    else html = homeHTML();
    $("#main").innerHTML = html;
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
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove();
      toast(ok ? "已复制" : "浏览器阻止了复制，请手动选择文字复制");
    }
    try { navigator.clipboard.writeText(text).then(function () { toast("已复制"); }, fallback); } catch (e) { fallback(); }
  }
  function openChapter(bid, n) {
    var id = chId(bid, n); S.openCh[id] = true; S.bookTab = "chapters";
    if (S.route !== "b-" + bid) { location.hash = "b-" + bid; }
    else render();
    setTimeout(function () { var el = document.getElementById("d-" + id); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 80);
  }

  document.addEventListener("click", function (e) {
    var pop = document.getElementById("mpop");
    if (pop && !pop.hidden && !e.target.closest("#mpop") && !e.target.closest('[data-act="mst"],[data-act="mhub"]')) closePop();
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "mst") { openStation(t.getAttribute("data-l"), +t.getAttribute("data-i")); return; }
    if (act === "mhub") { openHub(+t.getAttribute("data-h")); return; }
    if (act === "mpop-close") { closePop(); return; }
    if (act === "metro-mode") { S.metroMode = t.getAttribute("data-m"); try { localStorage.setItem("yanxilu-route-" + bjToday(), S.metroMode); } catch (e2) {} render(); return; }
    if (act === "metro-today") { S.metroToday = !S.metroToday; render(); return; }
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
    if (act === "reveal") { S.rv.show = true; render(); return; }
    if (act === "grade") { grade(t.getAttribute("data-g")); return; }
    if (act === "rv-skip") { S.rv.i++; S.rv.show = false; render(); return; }
    if (act === "rv-restart") { startReview(); render(); return; }
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
    var g = e.target && e.target.closest ? e.target.closest('.metro [data-act="mst"], .metro [data-act="mhub"]') : null;
    if (!g) return;
    e.preventDefault();
    if (g.getAttribute("data-act") === "mhub") openHub(+g.getAttribute("data-h")); else openStation(g.getAttribute("data-l"), +g.getAttribute("data-i"));
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
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
    var t = e.target; if (!t.hasAttribute || !t.hasAttribute("data-note")) return;
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
    if (r === "review" && S.route !== "review") S.rv = null;
    S.route = r; S.confirmDel = null; render(true);
  });

  /* ---------- 启动 ---------- */
  S.route = readHash();
  if (window.claude && typeof window.claude.use === "function") { render(); connect(); }
  else enterLocal();
})();
