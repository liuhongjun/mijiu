# 项目状态与工作交接

> 用途：**换电脑后继续工作的唯一入口**。新会话/新机器上的 AI 助手读完本文件即可接着干；人也看这一份。
> 本文件随 Git 仓库走，是跨机器的持久记忆。最后更新：2026-10-07。

## 1. 项目是什么

为**通用中型米酒厂**设计一套覆盖全业务的 AI 落地体系：从生产酿造、质量食安，到供应链、销售、财务、法务、人力、客服。产出是**方案 + 工程规格**，不是软件产品。

- 仓库：https://github.com/liuhongjun/mijiu
- 规模：21 个 Markdown（3600+ 行）+ 1 个 Excel 测算模型 + 3 个 Node 脚本
- 约定与红线：见 [AGENTS.md](AGENTS.md)（AI 常驻指令）与 [00-config.md](00-config.md)（口径来源）

## 2. 目标 profile（假设参数，改这里全套跟着改）

| 项 | 值 |
|---|---|
| 年产能 | 3000 吨（甜米酒/醪糟 1200t、半干型黄酒 1000t、米香型白酒 500t、定制 300t） |
| 员工 | 120 人（生产 70、品控 8、供应链 6、销售 18、财务 5、法务 2、人力行政 5、IT/数据 3） |
| 产线 | 2 条灌装线（玻璃瓶线 + 袋装/杯装线） |
| 发酵容器 | 陶坛 + 不锈钢罐（高端年份酒用陶坛） |
| 现有系统 | 金蝶/用友 ERP 为主 + Excel/纸单；**无 MES、无电子化 LIMS**，有微信订货 |
| 渠道 | 经销商 60%、商超 15%、电商 15%、团购宴席 10% |
| 预算量级 | 首年 30–80 万元 |

> 这些假设**尚未用真实工厂数据替换**。接手后第一件事通常是向用户确认规模与现有系统。

## 3. 交付物地图

| 类别 | 文件 | 说明 |
|---|---|---|
| 总览 | [README.md](README.md) | 阅读顺序、文件清单、质量校验结论 |
| 0x 骨架 | 00 config / 01 架构 / 02 数据底座 / 03 Agent 清单 / 04 治理合规 | **公共约束层，先改这里** |
| 0x 域分册 | 05 生产质量 / 06 供应链 / 07 销售 / 08 财务 / 09 法务 / 10 人力 / 11 客服 | 统一九节结构，各 317–435 行 |
| 1x 工具 | 12 合规清单 / 13 路线图与 ROI / 14 风险 / 15 选型预算 | 可勾选清单与决策依据 |
| 工程 | [agents/](agents/README.md) | prompts 提示词契约 / tools-contract 接口与审计 Schema / test-cases 验收框架 |
| 脚本 | [tools/build-estimate-model.mjs](tools/build-estimate-model.mjs) | 生成 xlsx（手写 OOXML，无第三方依赖） |
| 脚本 | [tools/audit-docs.mjs](tools/audit-docs.mjs) | 文档一致性审计，改动后必跑 |
| 模型 | [tools/estimate-model.xlsx](tools/estimate-model.xlsx) | 4 表公式驱动：参数 / 投资明细 / 收益测算 / 说明 |
| 认证 | [tools/git-askpass.cmd](tools/git-askpass.cmd) + [tools/git-askpass.ps1](tools/git-askpass.ps1) | 沙箱内推送 GitHub 的替代认证路径（脚本本身不含任何明文密钥） |

## 4. 已确定的结论（不要重复推翻）

1. **人机边界**：AI 一律只出建议 + 证据链，人工签字才生效；AI 不直连设备做闭环控制。全域**无 L4**（对外发布），无付款/过账权限。
2. **36 个 Agent**，分 8 域；首批上线 6 个：AGT-MFG-01 发酵预测、AGT-QC-03 标签审核、AGT-FIN-02 对账、AGT-FIN-01 票据草稿、AGT-LEG-01 合同审查、AGT-SAL-01 经销商 360°。
3. **技术核心是批次主键 `FB-{YYYYMMDD}-{序号}`**：全厂数据围绕它对齐，目标是“批次闭环率 ≥95%”。
4. **数据分级**：配方/成本/薪酬为 S3，**仅本地推理**，禁止进入公有云 API。
5. **投资口径**：P0 8.0 万 + P1 33.5 万 + P2 48.0 万 + P3 52.0 万 = **141.5 万元（三年）**，首年 41.5 万。
6. **收益口径**：中档情景首年约 86 万、三年约 474 万，投入产出比约 1 : 3.4。
7. 坛储损耗场景的真实现金价值有限，其价值在**资产账实与年份酒可售量**，不要用虚高 ROI 论证（06 分册已明确写入）。

## 5. 记住的坑（踩过的）

| 坑 | 教训 |
|---|---|
| 并行编写多分册会产生口径冲突 | 骨架文件（00–04）必须先定稿，再委派分册；分册定稿后**必跑审计 + 人工复核冲突点** |
| 本机 `workspace-write` 沙箱偶发 ACL 授权失败 | 表现为 SetNamedSecurityInfoW ... grantWrite，重试或修 ACL 后恢复 |
| 沙箱内无法调用 Excel COM | CO_E_SERVER_EXEC_FAILURE，xlsx 只能做结构级校验，无法做“Excel 实际打开”验证 |
| PowerShell 内嵌 Node 单行脚本极易引号地狱 | 一律写成 .mjs 文件再 node x.mjs 执行 |
| 生成脚本里用 `46 * i` 当中央目录步长会读错 | ZIP 中央目录每条长度是 `46 + 文件名长度 + 扩展字段长度`，必须累加 |
| 沙箱内 `git push` 报 `sh.exe: fatal error - NtCreateDirectoryObject ... 0xC0000022` | Git Credential Manager 需 fork `sh.exe`，被沙箱挡住。解法：`git -c credential.helper= push`，并让 `GIT_ASKPASS` 指向 [tools/git-askpass.cmd](tools/git-askpass.cmd)（纯 .NET 直读 Windows 凭据管理器，不 fork sh） |
| .gitattributes 若把 `*.cmd` 归一成 LF，换电脑 clone 后脚本无法执行 | Windows 批处理必须 CRLF，已对 `.cmd/.bat/.ps1` 指定 `eol=crlf` |

## 6. 在上次计算机上未完成 / 待确认

1. tools/estimate-model.xlsx **未在真实 Excel 中打开验证过**（沙箱限制）。首次打开请确认无修复提示；若报错，把公式中的中文工作表名用单引号包裹（如 '参数'!B6）后重新生成。
2. 测算表的参数（均价 28,000 元/吨、各成本占比、坛储在库 300 吨、平均库存 320 万）是**假设值**，需替换为本厂真实财务数据。
3. 工艺参数区间与预警阈值（05 分册）标注为“初始建议值”，须用近 24 个月历史批次标定后才能作为考核依据。
4. 00-config 第 7.1 节的补充指标（物流时效、OTD、破损率、预测 MAPE 等）**待治理例会确认后转正**，转正前不作考核。
5. 未做：管理层汇报版 PPT、按真实工厂数据重算的测算表。

## 7. 新电脑上的恢复步骤

```powershell
git clone https://github.com/liuhongjun/mijiu.git
cd mijiu
node tools/audit-docs.mjs           # 应输出“问题汇总: 无”
node tools/build-estimate-model.mjs # 应输出“自校验通过”
```

然后在 **mijiu 目录**下启动 DSH 会话即可：AGENTS.md 会被自动加载为常驻指令，本文件提供完整上下文。若希望跨项目也有个人偏好，可把常用规则放入用户全局 AGENTS.md（位于 DSH_HOME，默认 ~/.dsh；该文件不随本仓库走，需自行同步）。

### 推送到 GitHub（新电脑上）

Windows 凭据管理器里存的 GitHub 凭据**不随仓库走**。新电脑首次推送时二选一：

- 常规：装 Git Credential Manager，首次推送会弹浏览器登录，之后自动记住。
- 沙箱/无交互环境：用本仓库自带的 askpass 绕开（不 fork sh，纯 .NET 直读凭据管理器）：

```powershell
$env:GIT_TERMINAL_PROMPT='0'
$env:GIT_ASKPASS        = (Resolve-Path .\tools\git-askpass.cmd).Path
$env:GIT_ASKPASS_SCRIPT = (Resolve-Path .\tools\git-askpass.ps1).Path
git -c credential.helper= push origin main
```

若该机凭据管理器里没有 GitHub token，需先在 GitHub 生成 Personal Access Token（勾选 **repo** 权限）再写入凭据管理器或 `git credential approve`。`tools/git-askpass.ps1` 只做读取，**不会也不应把 token 写进仓库**。

## 8. 下一步建议（按优先级）

1. 用用户提供的**真实参数**替换 00-config 第 1、3 节与测算表参数表。
2. 确定首批落地场景（建议：标签合规审核 + 经销商对账，两者数据依赖最低、见效最快）。
3. 从 [agents/prompts.md](agents/prompts.md) 取 3 个完整提示词，接入实际数据源做影子运行。
4. 需要的话产出管理层汇报版（PPT）。