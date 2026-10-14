#!/usr/bin/env node
/* 用法：
 *   node study/today.js [YYYY-MM-DD]          打印这一天的安排（默认北京时间今天）
 *   node study/today.js [YYYY-MM-DD] --record 同时把安排记进 progress.json（早上推送时用）
 *
 * 输出里每个时段的 lesson / file 是这一课的讲义文件；exists 表示文件已经写过（以前排到过这一课），
 * 写过的不要重写，只在路线单里链过去。电影线没有讲义文件，用研习录的跟读播放器。
 */
const fs = require("fs");
const path = require("path");
const L = require("./lib");
const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || L.todayBeijing();
const plan = L.loadPlan();
const progress = L.loadProgress();
const day = L.dayPlan(plan, progress, date);
day.file = `study/daily/${date}.md`;
day.slots.forEach((s) => { if (s.file) s.exists = fs.existsSync(path.join(L.ROOT, s.file)); });

if (args.includes("--record") && !day.beforeStart) {
  const prev = progress.days[date] || {};
  progress.days[date] = Object.assign(prev, {
    planned: day.slots.map(L.slotRecord),
    file: day.file,
    status: prev.status && prev.status !== "pushed" ? prev.status : "pushed"
  });
  /* issued：每科已经写好讲义的课数（课程页据此显示哪些课能打开） */
  progress.issued = progress.issued || {};
  day.slots.forEach((s) => { if (s.lesson) progress.issued[s.subj] = Math.max(progress.issued[s.subj] || 0, s.index + 1); });
  progress.updated = date;
  L.saveProgress(progress);
}
console.log(JSON.stringify(day, null, 2));
