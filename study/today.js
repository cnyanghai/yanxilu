#!/usr/bin/env node
/* 用法：
 *   node study/today.js [YYYY-MM-DD]          打印这一天的安排（默认北京时间今天）
 *   node study/today.js [YYYY-MM-DD] --record 同时把安排记进 progress.json（早上推送时用）
 */
const L = require("./lib");
const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || L.todayBeijing();
const plan = L.loadPlan();
const progress = L.loadProgress();
const day = L.dayPlan(plan, progress, date);
day.file = `study/daily/${date}.md`;

if (args.includes("--record") && !day.beforeStart) {
  const prev = progress.days[date] || {};
  progress.days[date] = Object.assign(prev, {
    planned: day.slots.map((s) => ({ subj: s.subj, mins: s.mins, index: s.index, title: s.title })),
    file: day.file,
    status: prev.status && prev.status !== "pushed" ? prev.status : "pushed"
  });
  progress.updated = date;
  L.saveProgress(progress);
}
console.log(JSON.stringify(day, null, 2));
