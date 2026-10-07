import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
const dir = "D:/dshproject/";
const docs = ["00-config.md","01-总体架构.md","02-数据底座.md","03-Agent清单与权限矩阵.md","04-AI治理与合规.md",
  "05-生产质量AI方案.md","06-供应链AI方案.md","07-销售渠道AI方案.md","08-财务AI方案.md","09-法务合规AI方案.md",
  "10-人力资源AI方案.md","11-客户服务AI方案.md","12-合规检查清单.md","13-路线图与ROI.md","14-风险清单.md","15-工具选型与预算.md",
  "README.md","agents/README.md","agents/prompts.md","agents/tools-contract.md","agents/test-cases.md"];
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
const cache = {}, problems = [];

for (const d of docs) {
  if (!existsSync(dir + d)) { problems.push("MISSING " + d); continue; }
  const t = readFileSync(dir + d, "utf8"); cache[d] = t;
  if (emojiRe.test(t)) problems.push(d + " 含 emoji");
}

// 链接解析：相对于文件所在目录
let totalLinks = 0, checked = 0;
for (const d of docs) {
  const base = dirname(join(dir, d));
  for (const m of cache[d].matchAll(/\]\(([^)]+?)\.md(?:#[^)]*)?\)/g)) {
    const target = normalize(join(base, m[1] + ".md"));
    totalLinks++;
    if (!existsSync(target)) { problems.push(d + " 断链 -> " + m[1] + ".md"); } else checked++;
  }
}
console.log("链接总数 " + totalLinks + "，可解析 " + checked + "，断链 " + (totalLinks - checked));

// Agent 登记一致性（排除"未登记/如需新增"等前瞻性表述所在行）
const reg = new Set([...cache["03-Agent清单与权限矩阵.md"].matchAll(/AGT-[A-Z]{2,3}-\d{2}/g)].map(m => m[0]));
console.log("03 分册登记 Agent 数: " + reg.size);
const mentionLine = (line) => /未登记|如需|二期|待登记|暂不新增|建议新增/.test(line);
for (const d of ["05-生产质量AI方案.md","06-供应链AI方案.md","07-销售渠道AI方案.md","08-财务AI方案.md","09-法务合规AI方案.md","10-人力资源AI方案.md","11-客户服务AI方案.md"]) {
  const bad = new Set();
  for (const line of cache[d].split(/\r?\n/)) {
    if (mentionLine(line)) continue;
    for (const m of line.matchAll(/AGT-[A-Z]{2,3}-\d{2}/g)) if (!reg.has(m[0])) bad.add(m[0]);
  }
  console.log(d + " 引用未登记 Agent: " + (bad.size ? [...bad].join(",") : "无"));
  if (bad.size) problems.push(d + " 引用未登记 Agent: " + [...bad].join(","));
}

// 红线语义检查（允许不同措辞）
const semantic = [
  ["05-生产质量AI方案.md", "不得自动", /不得自动改变工艺|不得控制阀门|不得自动调/],
  ["05-生产质量AI方案.md", "不得替代签字", /不得替代法定记录人|不替代签字/],
  ["07-销售渠道AI方案.md", "禁止对外发布", /对外发布全域禁止|禁止对外发布|禁止自动发布/],
  ["07-销售渠道AI方案.md", "警示语", /过量饮酒有害健康/],
  ["07-销售渠道AI方案.md", "未成年人", /未成年人/],
  ["08-财务AI方案.md", "不得发起付款", /无付款|只出草稿，付款由出纳|不得自动外发/],
  ["08-财务AI方案.md", "无过账权限", /无过账|未过账|不过账/],
  ["09-法务合规AI方案.md", "不出法律意见", /法律意见书/],
  ["09-法务合规AI方案.md", "不断言可签", /可以签/],
  ["10-人力资源AI方案.md", "不作人事决定", /不得作出录用|不得作出.*解雇|不得作出人事/],
  ["10-人力资源AI方案.md", "个人信息保护", /个人信息保护法/],
  ["11-客户服务AI方案.md", "未成年人营销红线", /未成年人/],
];
console.log("\n--- 红线语义检查 ---");
for (const [f, name, re] of semantic) {
  const ok = re.test(cache[f] || "");
  console.log(f + " " + name + ": " + (ok ? "到位" : "缺失"));
  if (!ok) problems.push(f + " 红线缺失: " + name);
}

// 关键数字一致性
console.log("\n--- 关键数字 ---");
const all = Object.values(cache).join("\n");
for (const k of ["218%","≤97.5%","88%","68 天","62 天","141.5","36 个 Agent","2.6%"]) {
  const c = all.split(k).length - 1;
  console.log(k + ": " + c);
}
console.log("\n问题汇总: " + (problems.length ? "\n" + problems.join("\n") : "无"));