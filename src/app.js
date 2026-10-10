(function () {
  "use strict";
  document.documentElement.lang = "zh-CN";

  var LIB = window.YXL_LIB, REC = window.YXL_RECORD || { data: {} };
  var PLAN = window.YXL_PLAN || null, STUDY_SNAP = window.YXL_STUDY || { next: {}, days: {}, streak: 0 };
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
    mapMode: "trunk", mapOpen: {}
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
    return '<div class="strip" role="list" aria-label="章节进度">' + b.chapters.map(function (c) {
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

  /* ---------- 侧栏 ---------- */
  function railHTML() {
    var r = S.route;
    function cur(h) { return r === h ? ' aria-current="page"' : ""; }
    var mode = S.mode === "db" ? (S.canEdit ? ["db", "云端记录 · 可编辑"] : ["db", "只读浏览"]) : S.mode === "local" ? ["local", "公开阅读版"] : ["", "正在连接记录"];
    var h = '<a class="brand" href="#home"><span class="seal" aria-hidden="true">研习</span><span class="bt"><b>研习录</b><small>从对话到体系</small></span></a>' +
      '<div class="mode ' + mode[0] + '"><i></i>' + mode[1] + "</div>" +
      '<nav class="nav" aria-label="目录"><a href="#home"' + cur("home") + "><span>总览</span></a>" +
      (PLAN ? '<a href="#plan"' + cur("plan") + "><span>每日课表</span>" + planBadge() + "</a>" : "") +
      '<div class="lab">学习方向</div>';
    LIB.tracks.forEach(function (t) { var p = trackProg(t); h += '<a href="#t-' + t.id + '"' + cur("t-" + t.id) + "><span>" + esc(t.short) + '</span><span class="n">' + p.done + "/" + p.total + "</span></a>"; });
    h += '<div class="lab">精读</div>';
    Object.keys(LIB.books).forEach(function (id) {
      var b = LIB.books[id], p = bookProg(id), here = r === "b-" + id || r.indexOf("r-" + id + "-") === 0;
      h += '<a href="#b-' + id + '"' + (here ? ' aria-current="page"' : "") + "><span>" + esc(b.short) + '</span><span class="n">' + p.done + "/" + p.total + "</span></a>";
    });
    var due = dueCards().length;
    h += '<div class="lab">记录</div><a href="#journal"' + cur("journal") + '><span>学习足迹</span><span class="n">' + Object.keys(S.data.journal).length + "</span></a>" +
      '<a href="#review"' + cur("review") + "><span>复习</span>" + (due ? '<span class="n due">' + due + "</span>" : "") + "</a></nav>";
    return h;
  }

  /* ---------- 总览 ---------- */
  function homeHTML() {
    var fid = LIB.focus, f = LIB.books[fid], bp = bookProg(fid);
    var next = f.chapters.filter(function (c) { return !isDone(chId(fid, c.n)); })[0] || f.chapters[0];
    var items = allItems(), doneN = items.filter(isDone).length;
    var js = journalEntries(), mins = js.reduce(function (a, e) { return a + (Number(e.minutes) || 0); }, 0);
    var due = dueCards().length;
    var rows = LIB.tracks.map(function (t) {
      var p = trackProg(t), pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      return '<a class="trow" href="#t-' + t.id + '"><span class="tname">' + esc(t.name) + '</span><span class="tgoal">' + esc(t.goal) + '</span>' +
        '<span class="tprog"><span class="bar"><span style="width:' + pct + '%"></span></span><span>' + p.done + " / " + p.total + " 项" + (p.doing ? " · " + p.doing + " 项进行中" : "") + "</span></span></a>";
    }).join("");
    return '<div class="view">' + bannerHTML() +
      '<header><p class="eyebrow">个人知识库 · 始于 2026 年 10 月</p><h1>研习录</h1>' +
      '<p class="lede">学习计划、读书精读和复习都留在这里：给自己复盘，也留给后来的人。</p>' +
      '<div class="stats"><span><b>' + doneN + "</b>/ " + items.length + ' 项已完成</span><span><b>' + js.length + '</b>条学习足迹</span><span><b>' + (Math.round(mins / 6) / 10) + '</b>小时累计</span><span><b>' + due + "</b>张概念卡待复习</span></div></header>" +
      todayBlockHTML() +
      '<section class="focus" aria-labelledby="focus-h"><p class="eyebrow">正在精读</p>' +
      '<h2 id="focus-h"><a href="#b-' + fid + '">' + esc(f.title) + '</a></h2><p class="meta">' + esc(f.author) + " · 已读完 " + bp.done + " / " + bp.total + " 章</p>" +
      stripHTML(fid) +
      '<div class="btns"><button type="button" class="btn" data-act="open-ch" data-book="' + fid + '" data-n="' + next.n + '">继续：第' + CN[next.n] + "章 " + esc(next.title) + "</button>" +
      Object.keys(f.deep || {}).map(function (k) { return '<a class="btn ghost" href="#r-' + fid + "-" + k + '">第' + CN[+k] + "章精读稿</a>"; }).join("") +
      '<a class="btn ghost" href="#review">复习概念卡</a></div></section>' +
      '<section><h2>五个学习方向</h2><div class="tracks">' + rows + "</div></section>" +
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
        if (also.length) links.push('<span class="also">亦属：' + also.join("、") + "</span>");
        return '<li class="item"><div class="main-col"><div><span class="kind">' + esc(LIB.kinds[it.kind] || "") + '</span><span class="t">' + (it.kind === "book" ? "《" + esc(it.title) + "》" : esc(it.title)) + "</span>" +
          (it.by ? '<span class="by">' + esc(it.by) + "</span>" : "") + "</div>" +
          '<p class="why">' + esc(it.why) + "</p>" + (links.length ? '<div class="links">' + links.join("") + "</div>" : "") + "</div>" +
          '<div class="side-col">' + statusCtl(it.id, it.title) + "</div></li>";
      }).join("");
      return '<section class="stage"><h2><span class="no">阶段' + CN[si + 1] + " · " + sd + " / " + ids.length + "</span>" + esc(s.name) + '</h2><p class="desc">' + esc(s.desc) + '</p><ul class="items">' + lis + "</ul></section>";
    }).join("");
    return '<div class="view">' + bannerHTML() + '<header><p class="eyebrow">学习方向</p><h1>' + esc(t.name) + '</h1><p class="goal"><b>目标</b>　' + esc(t.goal) + "</p>" +
      '<div class="stats"><span><b>' + p.done + "</b>/ " + p.total + ' 项已完成</span><span><b>' + p.doing + "</b>项进行中</span></div></header>" + stages + "</div>";
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
      '<p class="sub">' + esc(b.en) + " · " + esc(b.author) + "</p>" +
      '<div class="book-prog"><span class="meta">已读完 ' + bp.done + " / " + bp.total + " 章</span>" + stripHTML(bid) + '<div class="whole">' + statusCtl(bid, b.title) + '<span class="meta">整本书</span></div></div></header>' +
      tabs + '<div class="tabbody" role="tabpanel" aria-labelledby="tab-' + S.bookTab + '">' + body + "</div></div>";
  }
  function introTab(bid) {
    var b = LIB.books[bid];
    var deepNs = Object.keys(b.deep || {});
    return '<p class="thesis"><span class="k">主旨</span>' + esc(b.thesis) + "</p>" +
      (deepNs.length ? '<p class="deep-line"><span class="k">精读稿</span>已完成 ' + deepNs.length + " / " + b.chapters.length + " 章：" + deepNs.map(function (k) { return '<a href="#r-' + bid + "-" + k + '">第' + CN[+k] + "章</a>"; }).join("、") + "。其余章节按你的阅读进度补齐。</p>" : "") +
      '<section><h2>这本书</h2><dl class="facts">' + b.facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></section>" +
      '<section><h2>理论链条</h2><ol class="chain">' + b.chain.map(function (c) { return '<li><span class="k">' + esc(c[0]) + "</span><span>" + esc(c[1]) + "</span></li>"; }).join("") + "</ol></section>" +
      '<section><h2>建议的阅读顺序</h2><ol class="order">' + b.order.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ol></section>" +
      "<section>" + noteBlock(bid, "整本书的批注", "读完全书后的总体判断：同意什么，怀疑什么，它改变了你对哪件事的看法？") + "</section>";
  }
  function chaptersTab(bid) {
    var b = LIB.books[bid];
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
        (c.cases ? '<div><h4>历史案例与要点</h4><p>' + esc(c.cases) + "</p></div>" : "") +
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
    return '<section><h2>其他理论怎么看</h2><div class="views">' + b.debate.map(function (d) {
      return '<div class="v"><h3>' + esc(d.who) + '</h3><span class="who">' + esc(d.reps) + "</span><p>" + esc(d.text) + "</p></div>";
    }).join("") + "</div></section>" +
      '<section><h2>读的时候带着这些问题</h2><ul class="plain">' + b.challenges.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></section>" +
      '<section><h2>延伸阅读</h2><ul class="further">' + further + "</ul></section>";
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
      '<p class="meta fw-foot">用法：选一场冲突，把清单复制到和 Claude 的对话里逐条回答；分析成文后，可以作为“专题实战”的成果收进研习录。</p>';
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
    return '<div class="map-head"><p>全书的论证长成一棵树：根是全书的核心论点，往下是前提、推论、证据，以及批评者的反驳。第二章的节点直接连到精读稿的对应单元，其他章节的精读稿写好后会接上。</p>' +
      '<div class="legend">' + Object.keys(MAP_TYPE).map(function (t) { return '<span class="lg t-' + t + '"><span class="mtype">' + MAP_TYPE[t] + "</span></span>"; }).join("") + "</div>" +
      '<div class="seg" role="group" aria-label="展开程度"><button type="button" data-act="map-mode" data-m="trunk" aria-pressed="' + (S.mapMode === "trunk") + '">只看主干</button><button type="button" data-act="map-mode" data-m="all" aria-pressed="' + (S.mapMode === "all") + '">全部展开</button></div></div>' +
      '<div class="mapwrap"><ul class="mtree">' + nodeHTML(root, "r", 0) + "</ul></div>";
  }

  /* ---------- 精读稿（伸缩阅读 + 嵌入自测） ---------- */
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
          return '<li><span class="etag">' + esc(e.tag) + '</span><span class="esrc ' + (e.src === "书" ? "book" : "added") + '">' + (e.src === "书" ? "书中" : "补充") + "</span><span>" + esc(e.text) + "</span></li>";
        }).join("") + "</ul></div>";
        if (s.replies.length) h += '<div class="blk"><h4>反驳与回应</h4>' + s.replies.map(function (r) {
          return '<div class="qa"><p class="obj"><span class="k">有人说</span>' + esc(r.obj) + '</p><p class="ans"><span class="k">作者答</span>' + esc(r.ans) + "</p></div>";
        }).join("") + "</div>";
        if (s.practice) h += '<p class="go-practice"><button type="button" class="xref" data-act="goto-switch" data-book="' + bid + '">去练习：用假设开关检验这五条</button></p>';
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
      '<div class="btns"><a class="btn ghost" href="#b-' + bid + '">返回《' + esc(b.title) + '》</a><button type="button" class="btn ghost" data-act="goto-switch" data-book="' + bid + '">假设开关</button><button type="button" class="btn ghost" data-act="goto-map" data-book="' + bid + '">论证地图</button></div></section></div>';
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
  function lessonHref(file) { return PLAN.repo + file; }
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
      '<div class="btns">' + (rec && rec.file ? '<a class="btn" href="' + esc(lessonHref(rec.file)) + '" target="_blank" rel="noopener">打开今天的讲义</a>' : '<span class="meta">讲义每天早上 ' + PLAN.push + "（" + PLAN.tz + "）推送</span>") +
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
        (r.minutes ? '<span class="jmin">' + esc(r.minutes) + " 分钟</span>" : "") + (r.file ? '<a href="' + esc(lessonHref(r.file)) + '" target="_blank" rel="noopener">讲义</a>' : "") + "</div>" +
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
        '<div class="acts"><a class="btn ghost" href="#b-' + LIB.focus + '">回到精读</a>' + (dueCards().length ? '<button type="button" class="btn" data-act="rv-restart">再来一轮</button>' : "") + "</div></div></div>";
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

  /* ---------- 主渲染 ---------- */
  var ROUTES = { home: 1, journal: 1, review: 1 };
  if (PLAN) ROUTES.plan = 1;
  LIB.tracks.forEach(function (t) { ROUTES["t-" + t.id] = 1; });
  Object.keys(LIB.books).forEach(function (b) {
    ROUTES["b-" + b] = 1;
    Object.keys(LIB.books[b].deep || {}).forEach(function (n) { ROUTES["r-" + b + "-" + n] = 1; });
  });
  function readHash() { var h = (location.hash || "").slice(1); return ROUTES[h] ? h : "home"; }

  function render(scrollTop) {
    $("#rail").innerHTML = railHTML();
    var r = S.route, html, rm = /^r-(.+)-(\d+)$/.exec(r);
    if (rm) html = readerHTML(rm[1], +rm[2]);
    else if (r.indexOf("t-") === 0) html = trackHTML(r.slice(2));
    else if (r.indexOf("b-") === 0) html = bookHTML(r.slice(2));
    else if (r === "journal") html = journalHTML();
    else if (r === "plan") html = planHTML();
    else if (r === "review") html = reviewHTML();
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
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act");
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
    if (act === "goto-switch") { S.practice = "switch"; gotoBookTab(t.getAttribute("data-book"), "practice"); return; }
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
    if (act === "export") { copyText(JSON.stringify(S.data, null, 2)); return; }
    if (act === "j-del") { S.confirmDel = t.getAttribute("data-id"); render(); return; }
    if (act === "j-del-no") { S.confirmDel = null; render(); return; }
    if (act === "j-del-yes") { var jid = t.getAttribute("data-id"); S.confirmDel = null; del("journal", jid); toast("已删除"); render(); return; }
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
