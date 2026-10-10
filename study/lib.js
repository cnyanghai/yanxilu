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
  let cfaToday = null;
  for (const [subj, mins] of plan.week[wd]) {
    const s = { subj, name: plan.subjects[subj].name, mins };
    if (subj !== "en") {
      const list = lessonList(plan, subj);
      const i = progress.next[subj] || 0;
      s.index = i;
      s.total = list.length;
      if (i < list.length) Object.assign(s, list[i]);
      else s.title = "本阶段这一科已学完：做复习或提前进入下一阶段";
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

module.exports = { loadPlan, loadProgress, saveProgress, lessonList, todayBeijing, dayPlan, weekday, daysBetween, ROOT };
