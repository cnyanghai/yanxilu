#!/usr/bin/env node
/* 晚上打卡：记下完成了哪些科目，并把这些科目的进度指针往前推一课。
 * 用法：
 *   node study/checkin.js YYYY-MM-DD --done sql,cfa,en --minutes 95 --note "回归那节没太懂"
 *   --done all     当天全部完成
 *   --done none    当天没学（记为未完成，进度不动）
 * 同一天重复打卡会覆盖当天记录，进度指针只会前进、不会重复前进。
 */
const L = require("./lib");
const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || L.todayBeijing();
const opt = (k) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : undefined; };

const plan = L.loadPlan();
const progress = L.loadProgress();
const day = progress.days[date] || {};
if (!day.planned) {
  const d = L.dayPlan(plan, progress, date);
  day.planned = d.slots.map((s) => ({ subj: s.subj, mins: s.mins, index: s.index, title: s.title }));
  day.file = day.file || `study/daily/${date}.md`;
}

const doneArg = (opt("done") || "none").trim();
const subjs = day.planned.map((s) => s.subj);
const done = doneArg === "all" ? subjs : doneArg === "none" ? [] : doneArg.split(/[,，\s]+/).filter((s) => subjs.includes(s));

done.forEach((subj) => {
  const slot = day.planned.find((s) => s.subj === subj);
  if (slot && typeof slot.index === "number") progress.next[subj] = Math.max(progress.next[subj] || 0, slot.index + 1);
});

day.done = done;
day.status = done.length === 0 ? "missed" : done.length === subjs.length ? "done" : "partial";
const mins = Number(opt("minutes"));
day.minutes = Number.isFinite(mins) ? mins : day.planned.filter((s) => done.includes(s.subj)).reduce((a, s) => a + (s.mins || 0), 0);
if (opt("note") !== undefined) day.note = opt("note");
day.checkedAt = new Date().toISOString();
progress.days[date] = day;

/* 连续打卡天数：从这一天往前数，完成或部分完成都算 */
let streak = 0, cur = date;
for (;;) {
  const d = progress.days[cur];
  if (!d || !(d.status === "done" || d.status === "partial")) break;
  streak++;
  const [y, m, dd] = cur.split("-").map(Number);
  cur = new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
}
progress.streak = streak;
progress.updated = date;
L.saveProgress(progress);
console.log(JSON.stringify({ date, status: day.status, done, minutes: day.minutes, next: progress.next, streak }, null, 2));
