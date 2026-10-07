# 工具契约（Agent 可调用的数据接口）

## 1. 只读工具（默认对全部 Agent 开放，按需挂载）

| 工具 | 入参 | 返回 | 用途 |
|---|---|---|---|
| `read_batch_panorama` | `fb` | 投粮量、曲种、曲量、容器、温度曲线、糖度/pH 序列、化验记录、出酒率 | 生产与质量类 Agent 的主数据源 |
| `read_lab_history` | `fb` 或 `starter`, `months` | 同曲种历史批次的化验值与最终结果 | 预测类 Agent 的对照样本 |
| `read_kpi` | `name`, `period`, `dim` | 指标值 + 计算口径 + 取数时间 | 所有分析类 Agent |
| `read_orders` | `date_from`, `date_to`, `customer?` | 销售订单、发货、退货 | 销售/财务/客服 |
| `read_inventory` | `type`(原粮/在制/成品/包材), `loc?` | 数量、批次、库龄、金额 | 供应链/财务 |
| `read_vessels` | `type`(坛/罐), `year?` | 坛号级台账、入库量、盘点量、损耗率 | 供应链/生产 |
| `read_bank_flow` | `date_from`, `date_to` | 银行流水 | 财务 |
| `read_erp_payments` | `date_from`, `date_to`, `type` | 收付款单 | 财务 |
| `read_customer_master` | `customer?` | 区域、渠道、信用额度、账期、分级 | 销售/财务 |
| `read_licenses` | — | 证照清单、编号、有效期 | 法务/品控 |
| `search_regulation` | `query`, `scope` | 法规/标准**原文片段** + 来源 + 生效日期 | 品控/法务/人力 |
| `search_sop` | `query` | 本厂 SOP 与工艺文档片段 | 生产/人力 |
| `read_tickets` | `date_from`, `date_to`, `channel?` | 客诉/咨询工单 | 客服/品控 |

## 2. 写入工具（受控，必须登记权限等级）

| 工具 | 最低权限 | 前置条件 | 禁止事项 |
|---|---|---|---|
| `create_maintenance_ticket` | L2 | 班组长 App 确认 | 不得直接停机或改设备参数 |
| `mark_lab_release` | L2 | 品控负责人复核签字 | 不得代替签字 |
| `create_voucher_draft` | L2 | 会计复核后过账 | **不得发起付款、不得改已过账凭证** |
| `create_renewal_task` | L2 | 法务确认 | — |
| `create_training_plan` | L2 | 人力/安全员确认 | — |
| `send_internal_notice` | L2 | 固定模板、不含价格 | 不得对外发送 |
| `send_customer_reply` | L2 | 客服主管审核 | 不得含功效表述、不得触达未成年人 |
| 任何对外公开发布 | — | **不存在此工具** | 全域禁止 |

## 3. 指标定义（指标 API 的唯一口径）

| 指标 | 公式 | 维度 | 刷新 |
|---|---|---|---|
| 出酒率 | 成品酒量(L) ÷ 投粮量(kg) × 100% | 批次/SKU/班组/月 | 每批 + 日汇总 |
| 发酵成功率 | 无酸败停滞批次数 ÷ 总批次数 | 月/曲种/容器类型 | 每日 |
| 优质品率 | 一级及以上产量 ÷ 总产量 | SKU/月 | 每日 |
| 吨酒制造成本 | 制造成本合计 ÷ 产量(t) | 批次/SKU/月 | 每日 + 月结 |
| 单位产品综合能耗 | 总能耗(kgce) ÷ 产量(t) | 车间/月 | 每日 |
| 库存周转天数 | 平均库存 ÷ 日均出库 | 物料类别 | 每日 |
| 应收账款周转天数 | 平均应收 ÷ 日均销售 | 客户/区域 | 每日 |
| 订单按时履约率 | 按时交付订单 ÷ 总订单 | 渠道/月 | 每日 |
| 账实差异率（坛储） | (账面量 − 盘点量) ÷ 账面量 | 坛号/年份 | 盘点时 |
| 客诉率 | 客诉件数 ÷ 万瓶 | 渠道/批次 | 每日 |

**规则**：Agent 引用指标时必须同时返回 `formula` 与 `as_of`（取数时间）；不一致时以指标 API 为准，禁止 Agent 自行用原始表拼算。

## 4. 证据链结构（所有输出必带）

```json
{
  "evidence": {
    "batch_ids": ["FB-20250901-02"],
    "doc_ids": ["DN-20250901-014", "INV-20250901-233"],
    "regulation_refs": [ { "name": "标准/法规名称", "quote": "原文片段", "effective_date": "YYYY-MM-DD" } ],
    "kpi_refs": [ { "name": "出酒率", "value": 0, "as_of": "ISO8601", "formula": "" } ],
    "sop_refs": ["SOP-发酵-03"]
  },
  "confidence": 0.0,
  "model_version": "",
  "prompt_version": "",
  "generated_at": "ISO8601"
}
```

## 5. 审计日志 Schema（运行时强制写入，不可由 Agent 关闭）

```json
{
  "ts": "ISO8601", "agent_id": "AGT-MFG-01", "trigger": "schedule|event|manual",
  "input_digest": "sha256", "input_summary": "文本摘要，不含 S3/S4 原文",
  "data_ids": ["FB-..."], "model": "", "model_version": "", "prompt_version": "",
  "output": "完整输出文本或 JSON", "confidence": 0.0,
  "human_action": "采纳|修改|驳回|未处理", "human_user": "EMP-...", "human_ts": "ISO8601",
  "data_class": "S1|S2|S3|S4", "egress": "none|internal|public"
}
```

**留存**：食品安全相关不少于保质期满后 6 个月；财税相关按会计档案规定；其余不少于 2 年。
**导出**：必须支持按月导出为 CSV/JSON，供内审与监管检查。
**告警**：出现 `egress=public` 或 `data_class=S3/S4` 且 `egress!=none` 时立即告警并阻断。

## 6. 运行时保障

| 项 | 要求 |
|---|---|
| 超时 | 单次调用 60s；超时返回"未能完成"，不返回半成品结论 |
| 重试 | 工具类失败最多重试 1 次；模型输出不合 Schema 时最多重试 2 次 |
| 配额 | 每 Agent 每月 token 配额，超 80% 告警 |
| 熔断 | 某 Agent 连续 5 次输出不合格 → 自动降级为只读并通知 Owner |
| 降级 | 每个 Agent 必须文档化"AI 不可用时的人工流程" |
