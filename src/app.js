(function () {
  "use strict";
  document.documentElement.lang = "zh-CN";

  var LIB = window.YXL_LIB, REC = window.YXL_RECORD || { data: {} };
  var COLLS = ["progress", "notes", "journal", "cards"];
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
  function emptyData() { return { progress: {}, notes: {}, journal: {}, cards: {} }; }

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
    confirmDel: null, dirty: false, raf: 0
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
  function dueCards() { var t = today(); return CARDS.filter(function (c) { var s = S.data.cards[c.id]; return !s || !s.due || s.due <= t; }); }
  function journalEntries() {
    return Object.keys(S.data.journal).map(function (k) { return Object.assign({ id: k }, S.data.journal[k]); })
      .sort(function (a, b) { return a.date === b.date ? String(b.t || "").localeCompare(String(a.t || "")) : String(b.date).localeCompare(String(a.date)); });
  }
  function refLabel(ref) {
    if (!ref) return "";
    if (ITEMS[ref]) return ITEMS[ref].kind === "book" ? "《" + ITEMS[ref].title + "》" : ITEMS[ref].title;
    var m = /^(.+)-ch(\d+)$/.exec(ref);
    if (m && LIB.books[m[1]]) return "《" + LIB.books[m[1]].title + "》第" + CN[+m[2]] + "章";
    return "";
  }
  function refHref(ref) {
    if (!ref) return "";
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
      '<div class="lab">学习方向</div>';
    LIB.tracks.forEach(function (t) { var p = trackProg(t); h += '<a href="#t-' + t.id + '"' + cur("t-" + t.id) + "><span>" + esc(t.short) + '</span><span class="n">' + p.done + "/" + p.total + "</span></a>"; });
    h += '<div class="lab">精读</div>';
    Object.keys(LIB.books).forEach(function (id) { var b = LIB.books[id], p = bookProg(id); h += '<a href="#b-' + id + '"' + cur("b-" + id) + "><span>" + esc(b.short) + '</span><span class="n">' + p.done + "/" + p.total + "</span></a>"; });
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
      '<section class="focus" aria-labelledby="focus-h"><p class="eyebrow">正在精读</p>' +
      '<h2 id="focus-h"><a href="#b-' + fid + '">' + esc(f.title) + '</a></h2><p class="meta">' + esc(f.author) + " · 已读完 " + bp.done + " / " + bp.total + " 章</p>" +
      stripHTML(fid) +
      '<div class="btns"><button type="button" class="btn" data-act="open-ch" data-book="' + fid + '" data-n="' + next.n + '">继续：第' + CN[next.n] + "章 " + esc(next.title) + '</button><a class="btn ghost" href="#review">复习概念卡</a></div></section>' +
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
  var TABS = [["intro", "导读"], ["chapters", "章节精读"], ["cards", "概念卡"], ["debate", "争鸣与延伸"], ["framework", "分析框架"]];
  function bookHTML(bid) {
    var b = LIB.books[bid], bp = bookProg(bid), tr = TRACK[b.track];
    var tabs = '<div class="tabs" role="tablist">' + TABS.map(function (x) {
      return '<button type="button" role="tab" id="tab-' + x[0] + '" aria-selected="' + (S.bookTab === x[0]) + '" data-act="tab" data-tab="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    var body = S.bookTab === "chapters" ? chaptersTab(bid) : S.bookTab === "cards" ? cardsTab(bid) : S.bookTab === "debate" ? debateTab(bid) : S.bookTab === "framework" ? frameworkTab(bid) : introTab(bid);
    return '<div class="view">' + bannerHTML() + '<header><p class="eyebrow">精读 · <a href="#t-' + tr.id + '">' + esc(tr.name) + "</a></p><h1>" + esc(b.title) + "</h1>" +
      '<p class="sub">' + esc(b.en) + " · " + esc(b.author) + "</p>" +
      '<div class="book-prog"><span class="meta">已读完 ' + bp.done + " / " + bp.total + " 章</span>" + stripHTML(bid) + '<div class="whole">' + statusCtl(bid, b.title) + '<span class="meta">整本书</span></div></div></header>' +
      tabs + '<div class="tabbody" role="tabpanel" aria-labelledby="tab-' + S.bookTab + '">' + body + "</div></div>";
  }
  function introTab(bid) {
    var b = LIB.books[bid];
    return '<p class="thesis"><span class="k">主旨</span>' + esc(b.thesis) + "</p>" +
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
      return '<details class="ch" id="d-' + id + '" data-ch="' + id + '"' + (open ? " open" : "") + "><summary>" +
        '<span class="no">第' + CN[c.n] + "章</span><span class=\"ttl\">" + esc(c.title) + '<span class="depth">' + esc(c.depth) + "</span></span>" + statusChip(id) + "</summary>" +
        '<div class="ch-body"><div class="ch-st">' + statusCtl(id, "第" + CN[c.n] + "章") + "</div>" +
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
    return "第" + c.box + " 盒 · 下次 " + (c.due || "");
  }
  function cardsTab(bid) {
    var b = LIB.books[bid], due = dueCards().filter(function (c) { return c.book === bid; }).length;
    return '<div class="cards-head"><p>点卡片翻面。复习时按记忆程度分盒，记得越牢，下次复习隔得越久。</p><a class="btn" href="#review">' + (due ? "开始复习（" + due + " 张到期）" : "今天没有到期的卡片") + "</a></div>" +
      '<div class="cards">' + b.cards.map(function (c) {
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

  /* ---------- 学习足迹 ---------- */
  function refOptions() {
    var h = '<option value="">（不关联）</option>';
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
    var boxes = [0, 0, 0, 0, 0, 0]; CARDS.forEach(function (c) { boxes[boxOf(c.id)]++; });
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
    var rv = S.rv, id = rv.q[rv.i], cur = S.data.cards[id] || {}, box = cur.box || 0;
    if (g === "again") box = 1; else if (g === "good") box = Math.min(5, box + 1); else box = Math.max(1, box);
    put("cards", id, { box: box, due: addDays(today(), BOX_DAYS[box]), last: today() });
    rv.tally[g]++; rv.i++; rv.show = false; render();
  }

  /* ---------- 主渲染 ---------- */
  var ROUTES = { home: 1, journal: 1, review: 1 };
  LIB.tracks.forEach(function (t) { ROUTES["t-" + t.id] = 1; });
  Object.keys(LIB.books).forEach(function (b) { ROUTES["b-" + b] = 1; });
  function readHash() { var h = (location.hash || "").slice(1); return ROUTES[h] ? h : "home"; }

  function render(scrollTop) {
    $("#rail").innerHTML = railHTML();
    var r = S.route, html;
    if (r.indexOf("t-") === 0) html = trackHTML(r.slice(2));
    else if (r.indexOf("b-") === 0) html = bookHTML(r.slice(2));
    else if (r === "journal") html = journalHTML();
    else if (r === "review") html = reviewHTML();
    else html = homeHTML();
    $("#main").innerHTML = html;
    if (scrollTop) window.scrollTo(0, 0);
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
    if (act === "goto-card") {
      var k = t.getAttribute("data-card"); S.bookTab = "cards"; S.flipped[k] = true; S.hl = k; render();
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
