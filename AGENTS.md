# AGENTS.md — 米酒厂 AI 管理体系（本仓库常驻指令）

本仓库是**文档与工程交付物仓库**，不是可运行的应用。内容为《米酒厂 AI 管理体系》全套方案（16 个编号分册 + agents/ 工程文件 + tools/ 生成脚本）。

## 常驻指令

1. **先读 [PROJECT-STATE.md](PROJECT-STATE.md)**：它记录项目目标、profile 参数、已决策事项、进度与下一步。跨会话、跨电脑续接工作前必读。
2. **单一事实来源是 [00-config.md](00-config.md)**：主数据编码、指标基线、Agent 权限（L0–L4）、硬性约束。任何分册与之冲突时以它为准；要改口径先改 00-config，再同步受影响分册。
3. **改了文档就跑审计**：`node tools/audit-docs.mjs` 必须输出“问题汇总: 无”。它检查交叉链接可解析性、Agent 登记一致性、红线语义、emoji。
4. **格式约定**：简体中文；正文禁用 emoji；Agent 命名 `AGT-{域}-{序号}`；新增 Agent 必须先登记在 [03-Agent清单与权限矩阵.md](03-Agent清单与权限矩阵.md)；文档间引用只能指向已存在的分册文件名。
5. **红线不得放宽**：AI 不得自动改变工艺参数、不得发起付款或过账、不得签署合同、不得对外发布内容、不得作出人事决定。任何对外内容需人工审核 + AI 生成合成内容标识。
6. **数字要有出处**：文档中的指标值要么来自 00-config 第 4 节基线，要么在 00-config 第 7.1 节登记为“待治理确认”。禁止虚构法规条款号、税率或行业数据。
7. **改了测算模型要重新生成并自校验**：`node tools/build-estimate-model.mjs`（纯 Node 标准库，无需安装依赖）。

## 常用命令

```powershell
node tools/audit-docs.mjs           # 文档一致性审计
node tools/build-estimate-model.mjs # 重新生成 tools/estimate-model.xlsx 并自校验
```