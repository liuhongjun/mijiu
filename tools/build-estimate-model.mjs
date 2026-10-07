// tools/build-estimate-model.mjs
// 生成《米酒厂 AI 投资测算表》.xlsx 并自校验结构。
// 纯 Node 标准库实现（手写 OOXML + 内置 zlib），无需 npm install。
// 用法: node tools/build-estimate-model.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- CRC32 / ZIP ----------
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function zipStore(files) {
  const locals = [], centrals = []; let off = 0;
  for (const f of files) {
    const raw = Buffer.from(f.data, "utf8");
    const comp = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const name = Buffer.from(f.name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    centrals.push(ch, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

// ---------- XLSX ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (n) => { let s = "", x = n + 1; while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = (x - m - 1) / 26; } return s; };
const STYLES = { h: 1, t: 2, ch: 3, in: 4, p: 5, tot: 6 };

function cellXml(ref, c) {
  if (c === null || c === undefined || c === "") return "";
  let v = c, t = "s", f = null, style = 0;
  if (typeof c === "object") { v = c.v ?? ""; t = c.t ?? (typeof v === "number" ? "n" : "s"); f = c.f ?? null; style = STYLES[c.style] ?? 0; }
  else { t = typeof v === "number" ? "n" : "s"; }
  const sf = f ? "<f>" + esc(f) + "</f>" : "";
  if (t === "n") return '<c r="' + ref + '" s="' + style + '">' + sf + "<v>" + v + "</v></c>";
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
}
function sheetXml(sheet) {
  const widths = (sheet.widths ?? []).map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("");
  const rows = sheet.rows.map((row, ri) => '<row r="' + (ri + 1) + '">' + row.map((c, ci) => cellXml(colName(ci) + (ri + 1), c)).join("") + "</row>").join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (widths ? "<cols>" + widths + "</cols>" : "") + "<sheetData>" + rows + "</sheetData></worksheet>";
}
function buildXlsx(sheets) {
  const files = sheets.map((s, i) => ({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: sheetXml(s) }));
  files.push({ name: "[Content_Types].xml", data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' });
  files.push({ name: "_rels/.rels", data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
  files.push({ name: "xl/workbook.xml", data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>" });
  files.push({ name: "xl/_rels/workbook.xml.rels", data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
  files.push({ name: "xl/styles.xml", data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.0"/></numFmts>' +
    '<fonts count="4"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>' +
    '<font><b/><sz val="11"/><name val="Microsoft YaHei"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Microsoft YaHei"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF1FB"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="7"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' +
    '<xf xfId="0" fontId="2" applyFont="1"/><xf xfId="0" fontId="2" fillId="3" applyFont="1" applyFill="1"/>' +
    '<xf xfId="0" fillId="3" applyFill="1"/><xf xfId="0" numFmtId="164" applyNumberFormat="1"/>' +
    '<xf xfId="0" fontId="2" fillId="3" applyFont="1" applyFill="1" numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>' });
  return zipStore(files);
}

// ---------- 工作簿定义 ----------
const H = { style: "h" }, T = (v) => ({ v, style: "t" }), CH = (v) => ({ v, style: "ch" });
const IN = (v, t) => ({ v, t: t ?? (typeof v === "number" ? "n" : "s"), style: "in" });
const FN = (v, f) => ({ v, t: "n", f });
const N = (v) => ({ v, t: "n" });

const 参数 = { name: "参数", widths: [26, 12, 12, 12, 44], rows: [
  [H, H, H, H, H],
  [T("经营参数（改浅蓝格，其余表自动重算）"), "", "", "", ""],
  [CH("参数"), CH("值"), "", "", CH("说明")],
  ["年产量（吨）", IN(3000), "", "", "与 00-config 通用 profile 一致"],
  ["出厂均价（元/吨）", IN(28000), "", "", "按产品结构加权"],
  ["营业收入（元）", FN(0, "B4*B5"), "", "", "= 年产量 × 均价"],
  ["原粮+曲种占比", IN(0.42, "n"), "", "", "占营业收入比，含损耗"],
  ["包材占比", IN(0.1, "n"), "", "", "瓶、盖、标、箱"],
  ["能耗占比", IN(0.021, "n"), "", "", "约 180 万/年"],
  ["人工占比", IN(0.12, "n"), "", "", "生产与管理"],
  ["制造费用占比", IN(0.06, "n"), "", "", "折旧、维修、坛损"],
  ["坛储在库（吨）", IN(300), "", "", "用于坛储损耗收益"],
  ["平均库存金额（元）", IN(3200000), "", "", "原粮+在制+成品"],
  ["资金成本率", IN(0.02, "n"), "", "", "年化，保守取值"],
  ["财务人员年成本（元/人）", IN(80000), "", "", "与 13 分册一致"],
  ["客服人员年成本（元/人）", IN(60000), "", "", "与 13 分册一致"],
  ["库存周转天数基线（天）", IN(68), "", "", "见 00-config 指标基线"],
  ["", "", "", "", ""],
  [T("AI 改善幅度（首年保守口径，低/中/高 = 0.5 / 1.0 / 2.0 倍）"), "", "", "", ""],
  [CH("改善项"), CH("低"), CH("中"), CH("高"), CH("说明")],
  ["出酒率提升（对营收等效）", IN(0.005, "n"), IN(0.01, "n"), IN(0.02, "n"), "每 1pt 约等效 +1% 营收"],
  ["单位能耗下降", IN(0.025, "n"), IN(0.05, "n"), IN(0.1, "n"), "蒸汽与电耗优化"],
  ["坛储损耗率下降", IN(0.004, "n"), IN(0.008, "n"), IN(0.016, "n"), "2.6% -> 1.8%"],
  ["库存周转天数下降", IN(6), IN(13), IN(26), "68 -> 55 / 50 天"],
  ["财务对账人力节省比例", IN(0.2, "n"), IN(0.4, "n"), IN(0.6, "n"), "2 人 × 比例"],
  ["客服人力节省比例", IN(0.2, "n"), IN(0.4, "n"), IN(0.6, "n"), "1.5 人 × 比例"],
  ["标签/证照返工规避（元）", IN(50000), IN(100000), IN(200000), "避免下架返工"],
  ["优质品率提升（对营收等效）", IN(0.01, "n"), IN(0.02, "n"), IN(0.04, "n"), "81% -> 84% / 88%"],
]};

const 投资明细 = { name: "投资明细", widths: [8, 32, 12, 36], rows: [
  [H, H, H, H],
  [T("投资分项（单位：万元）——与 13-路线图与ROI.md 第 3 节同源"), "", "", ""],
  [CH("阶段"), CH("项目"), CH("金额"), CH("说明")],
  ["P0", "数字化专员 1 人（2 个月）", N(3), "内部人力，按年 18 万计"],
  ["P0", "编码与模板改造、数据清洗支持", N(2), "外部顾问 5 人天"],
  ["P0", "打印/标签/单据耗材", N(0.5), "FB 号条码化"],
  ["P0", "数据质量监控脚本与看板", N(2.5), "外部开发 6 人天"],
  ["P1", "温度采集试点（10 罐）", N(6), "约 0.6 万/罐"],
  ["P1", "化验室 LIMS-lite", N(3), "化验录入、批次绑定"],
  ["P1", "便携快检器具", N(2), "折光仪、pH 计、电子秤"],
  ["P1", "ERP/Excel 数据集成", N(5), "中间库/视图 12 人天"],
  ["P1", "Agent 平台（本地编排+审计日志）", N(4), "部署与配置"],
  ["P1", "首批 3 个 Agent 实施", N(8), "标签审核、对账、票据"],
  ["P1", "云 API 与算力（4 个月）", N(1), "仅非敏感任务"],
  ["P1", "培训与手册", N(1.5), "分岗位培训"],
  ["P1", "评测集标注与影子运行", N(3), "200 条/Agent 样本"],
  ["P2", "温度采集全罐+坛（约 40 罐）", N(18), "含网关扩容"],
  ["P2", "坛存称重与盘点 App", N(5), "秤+移动端+标签"],
  ["P2", "4 个 Agent 实施", N(12), "发酵、坛储、经销商、预测"],
  ["P2", "客服与一物一码", N(8), "编码、验真、知识库"],
  ["P2", "算力与云 API（6 个月）", N(2), ""],
  ["P2", "运营人力（第 2 人）", N(3), "内部人力"],
  ["P3", "本地 GPU 推理服务器", N(15), "32B 级量化推理"],
  ["P3", "私有化模型部署与调优", N(6), "S3 数据本地推理"],
  ["P3", "视觉质检试点（1 条线）", N(12), "相机+光源+边缘盒"],
  ["P3", "批次成本与经营驾驶舱", N(10), "指标 API + 问答"],
  ["P3", "能耗计量补点", N(6), "分摊到批次成本"],
  ["P3", "算力与运维", N(3), ""],
  ["", "合计", { v: 0, t: "n", f: "SUM(C4:C29)", style: "tot" }, "应为 141.5"],
  ["", "P0 小计", FN(0, 'SUMIF(A4:A29,"P0",C4:C29)'), "8.0"],
  ["", "P1 小计", FN(0, 'SUMIF(A4:A29,"P1",C4:C29)'), "33.5"],
  ["", "P2 小计", FN(0, 'SUMIF(A4:A29,"P2",C4:C29)'), "48.0"],
  ["", "P3 小计", FN(0, 'SUMIF(A4:A29,"P3",C4:C29)'), "52.0"],
]};

const 收益测算 = { name: "收益测算", widths: [26, 16, 16, 16, 34], rows: [
  [H, H, H, H, H],
  [T("首年收益测算（元）——公式驱动，改参数表即重算"), "", "", "", ""],
  [CH("收益项"), CH("低"), CH("中"), CH("高"), CH("计算口径")],
  ["出酒率提升", FN(0, "参数!B6*参数!B21"), FN(0, "参数!B6*参数!C21"), FN(0, "参数!B6*参数!D21"), "营收 × 提升幅度"],
  ["单位能耗下降", FN(0, "参数!B6*参数!B9*参数!B22"), FN(0, "参数!B6*参数!B9*参数!C22"), FN(0, "参数!B6*参数!B9*参数!D22"), "营收 × 能耗占比 × 降幅"],
  ["坛储损耗下降", FN(0, "参数!B13*参数!B5*参数!B23"), FN(0, "参数!B13*参数!B5*参数!C23"), FN(0, "参数!B13*参数!B5*参数!D23"), "坛储吨 × 均价 × 降幅"],
  ["库存资金占用下降", FN(0, "参数!B15*参数!B14*(参数!B24/参数!B18)"), FN(0, "参数!B15*参数!B14*(参数!C24/参数!B18)"), FN(0, "参数!B15*参数!B14*(参数!D24/参数!B18)"), "库存 × 资金成本 × 周转加速"],
  ["财务对账人力节省", FN(0, "2*参数!B16*参数!B25"), FN(0, "2*参数!B16*参数!C25"), FN(0, "2*参数!B16*参数!D25"), "2 人 × 年成本 × 比例"],
  ["客服人力节省", FN(0, "1.5*参数!B17*参数!B26"), FN(0, "1.5*参数!B17*参数!C26"), FN(0, "1.5*参数!B17*参数!D26"), "1.5 人 × 年成本 × 比例"],
  ["标签与证照返工规避", FN(0, "参数!B27"), FN(0, "参数!C27"), FN(0, "参数!D27"), "直接取值"],
  ["优质品率提升", FN(0, "参数!B6*参数!B28"), FN(0, "参数!B6*参数!C28"), FN(0, "参数!B6*参数!D28"), "营收 × 提升幅度"],
  ["首年收益合计", { v: 0, t: "n", f: "SUM(B4:B11)", style: "tot" }, { v: 0, t: "n", f: "SUM(C4:C11)", style: "tot" }, { v: 0, t: "n", f: "SUM(D4:D11)", style: "tot" }, "元/年"],
  ["", "", "", "", ""],
  [T("三年口径"), "", "", "", ""],
  [CH("项目"), CH("低"), CH("中"), CH("高"), CH("说明")],
  ["第 1 年收益", FN(0, "B12"), FN(0, "C12"), FN(0, "D12"), "同首年测算"],
  ["第 2 年收益（×2.0）", FN(0, "B15*2"), FN(0, "C15*2"), FN(0, "D15*2"), "规模效应与场景扩面"],
  ["第 3 年收益（×2.5）", FN(0, "B15*2.5"), FN(0, "C15*2.5"), FN(0, "D15*2.5"), "成本精细化与排产优化"],
  ["三年收益合计", { v: 0, t: "n", f: "SUM(B15:B17)", style: "tot" }, { v: 0, t: "n", f: "SUM(C15:C17)", style: "tot" }, { v: 0, t: "n", f: "SUM(D15:D17)", style: "tot" }, "元"],
  ["三年投入（万元）", N(141.5), N(141.5), N(141.5), "见投资明细合计"],
  ["投入产出比", FN(0, "B18/(B19*10000)"), FN(0, "C18/(C19*10000)"), FN(0, "D18/(D19*10000)"), ">1 即回本"],
  ["回收期（月）", FN(0, "B19*10000/(B15/12)"), FN(0, "C19*10000/(C15/12)"), FN(0, "D19*10000/(D15/12)"), "按首年收益折算"],
]};

const 说明 = { name: "说明", widths: [120], rows: [
  [T("使用说明")],
  ["1. 本表是《米酒厂 AI 管理体系》配套测算工具，与 13-路线图与ROI.md 数字同源。"],
  ["2. 只改“参数”表浅蓝底色单元格，“收益测算”表自动重算；公式为静态文本，Excel/WPS 打开即生效。"],
  ["3. 低/中/高三档 = 首年改善幅度的 0.5 / 1.0 / 2.0 倍，用于给立项决策留区间。"],
  ["4. 收益为量级估算，未含停产改造损失、人员学习成本与第 2 年起的运维（约 6–10 万/年）。"],
  ["5. 出厂均价与各成本占比须按本厂实际财务数据替换后，再用于正式立项决策。"],
  ["6. 生成方式：node tools/build-estimate-model.mjs（纯 Node 标准库，无需安装依赖）。"],
]};

// ---------- 生成 + 自校验 ----------
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "estimate-model.xlsx");
const buf = buildXlsx([参数, 投资明细, 收益测算, 说明]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log("生成:", out, buf.length, "bytes");
console.log("签名:", buf.readUInt32LE(0).toString(16), "(期望 4034b50)");

// 自校验：按中央目录读取每个条目并解压
const n = buf.readUInt16LE(buf.length - 14);
const cdOff = buf.readUInt32LE(buf.length - 6);
const names = [];
let bad = 0;
let o = cdOff;
for (let i = 0; i < n; i++) {
  const nl = buf.readUInt16LE(o + 28);
  const el = buf.readUInt16LE(o + 30);
  const name = buf.slice(o + 46, o + 46 + nl).toString("utf8");
  const cl = buf.readUInt32LE(o + 20);
  const lo = buf.readUInt32LE(o + 42);
  const lnl = buf.readUInt16LE(lo + 26);
  const lel = buf.readUInt16LE(lo + 28);
  const start = lo + 30 + lnl + lel;
  const data = buf.slice(start, start + cl);
  const xml = inflateRawSync(data).toString("utf8");
  names.push(name);
  if (!xml.startsWith("<?xml")) { bad++; console.log("  XML-BAD:", name); }
  if (name === "xl/workbook.xml") console.log("  工作表:", [...xml.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]).join(" | "));
  if (name.startsWith("xl/worksheets/")) console.log("   " + name, "行数", (xml.match(/<row /g) || []).length, "公式", (xml.match(/<f>/g) || []).length);
  o += 46 + nl + el;
}
const required = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet4.xml"];
const missing = required.filter((r) => !names.includes(r));
console.log("条目数:", n, "| 缺失部件:", missing.length ? missing.join(",") : "无", "| 非法XML:", bad);
console.log(missing.length === 0 && bad === 0 ? "自校验通过" : "自校验未通过");
