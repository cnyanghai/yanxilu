/* 课表的共用逻辑：读取 src/plan.js 和 study/progress.json，算出某天该学什么。
 * 被 today.js、checkin.js 使用。只依赖 Node 自带模块。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PROGRESS = path.join(__dirname, "progress.json");

function loadPlan() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "src/plan.js"), "utf8"), ctx);
  return ctx.window.YXL_PLAN;
}

function loadProgress() {
  return JSON.parse(fs.readFileSync(PROGRESS, "utf8"));
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS, JSON.stringify(p, null, 2) + "\n", "utf8");
}

/* CFA 按模块展开成一课一课 */
function lessonList(plan, subj) {
  const raw = plan.lessons[subj];
  if (!raw) return [];
  if (subj !== "cfa") return raw.map((t) => ({ title: t }));
  const out = [];
  raw.forEach(([code, cn, en, n]) => {
    for (let k = 1; k <= n; k++) out.push({ title: `${code} ${cn}（${k}/${n}）`, code, cn, en, part: k, parts: n });
  });
  return out;
}

/* 北京时间的今天 */
function todayBeijing() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function weekday(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysBetween(a, b) {
  const t = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

/* 一课的编号与文件：sql 第 1 课 → sql-01，study/lessons/sql/01.md */
function lessonKey(subj, index) { return `${subj}-${String(index + 1).padStart(2, "0")}`; }
function lessonFile(subj, index) { return `study/lessons/${subj}/${String(index + 1).padStart(2, "0")}.md`; }

/* 某天的安排：时段、每个时段的下一课（按当前进度指针） */
function dayPlan(plan, progress, date) {
  const wd = weekday(date);
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][wd];
  const offset = daysBetween(plan.start, date);
  const res = { date, weekday: WD, week: offset >= 0 ? Math.floor(offset / 7) + 1 : 0, prep: date === plan.prep, slots: [] };
  if (offset < 0 && !res.prep) { res.beforeStart = true; return res; }
  if (res.prep) {
    res.slots = [{ subj: "prep", name: "准备日", mins: 60, title: "准备日：装好工具、备好书", checklist: plan.prepDay }];
    return res;
  }
  const since = plan.since || {};
  const written = plan.written || [];
  let cfaToday = null;
  for (const [subj, mins, kind] of plan.week[wd]) {
    if (since[subj] && date < since[subj]) continue;
    const s = { subj, name: plan.subjects[subj].name, mins };
    const list = lessonList(plan, subj);
    const i = progress.next[subj] || 0;
    if (kind === "review") {
      /* 复习时段：把本周学过的几段连起来过一遍，不推进进度 */
      const from = Math.max(0, i - 6);
      s.review = true;
      s.title = i > 0 ? `本周复习：第 ${from + 1}—${i} 段连起来过一遍` : "本周复习：还没有学过的段落，今天可以先看一遍全片";
    } else if (subj !== "en") {
      s.index = i;
      s.total = list.length;
      if (i < list.length) Object.assign(s, list[i]);
      else s.title = "本阶段这一科已学完：做复习或提前进入下一阶段";
      if (i < list.length && written.includes(subj)) { s.lesson = lessonKey(subj, i); s.file = lessonFile(subj, i); }
      if (subj === "cfa") cfaToday = s;
    }
    res.slots.push(s);
  }
  const en = res.slots.find((s) => s.subj === "en");
  if (en) {
    if (cfaToday && cfaToday.en) en.title = `CFA 术语与短文：${cfaToday.en}`;
    else {
      const last = lessonList(plan, "cfa")[Math.max(0, (progress.next.cfa || 0) - 1)];
      en.title = wd === 0 ? "本周 CFA 词汇小测 + 1、3、7 天前的词复习" : `CFA 术语与短文：${last ? last.en : "Rates and Returns"}`;
    }
  }
  return res;
}

/* 记进 progress.json 的时段字段 */
function slotRecord(s) {
  const o = { subj: s.subj, mins: s.mins, title: s.title };
  if (typeof s.index === "number") o.index = s.index;
  if (s.lesson) { o.lesson = s.lesson; o.file = s.file; }
  if (s.review) o.review = true;
  return o;
}

module.exports = { loadPlan, loadProgress, saveProgress, lessonList, todayBeijing, dayPlan, slotRecord, lessonKey, lessonFile, weekday, daysBetween, ROOT };
