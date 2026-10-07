# agents/ 说明

本目录把 [03-Agent清单与权限矩阵.md](../03-Agent清单与权限矩阵.md) 的名录落成**可直接接入 DSH（或任意 Agent 运行时）的工程文件**。

| 文件 | 内容 | 谁用 |
|---|---|---|
| [prompts.md](prompts.md) | 通用提示词骨架 + AGT-MFG-01 / AGT-QC-03 / AGT-FIN-02 完整可用提示词 | Agent 开发者、Agent Owner |
| [tools-contract.md](tools-contract.md) | 只读工具清单、指标定义、证据链结构、审计日志 Schema | 开发、审计 |
| [test-cases.md](test-cases.md) | 上岗验收的测试用例框架与判定标准 | Agent Owner、复核人 |

## 接入顺序（新 Agent 上线的固定动作）

1. 从 03 分册确认 Agent ID 与权限等级（默认 L1，L4 全域禁止）。
2. 按 [prompts.md](prompts.md) 写提示词：角色、背景、可用数据、任务、硬性约束、输出 Schema 六段齐备。
3. 只挂载 [tools-contract.md](tools-contract.md) 中**该 Agent 需要的**工具，多余工具一律不挂。
4. 用 [test-cases.md](test-cases.md) 建评测集（≥200 条真实样本，含 20% 边界与反例），跑一致性与越权测试。
5. 记录模型与提示词版本号 → 影子运行 30 天 → Owner 签字 → 放权限。

## 三条不可协商的约定

1. **输出即建议**：所有输出字段里必须有 `evidence`（证据链）与 `confidence`（置信度），缺一即视为不合格输出，运行时直接判失败。
2. **禁止动作**：不写设备、不发付款、不签合同、不对外发布、不作人事决定。提示词第 5 段必须原文包含这些禁令。
3. **版本可回滚**：提示词、模型、工具契约任一变更都要留版本号，且保留上一版本可随时回退。
