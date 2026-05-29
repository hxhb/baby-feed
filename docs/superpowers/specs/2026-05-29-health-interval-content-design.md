# 健康定期提醒：自定义提醒内容

**日期**：2026-05-29
**范围**：`components/ReminderManager.tsx`（仅前端）
**类型**：UI 增强

## 背景

当前在 **设置 → 提醒管理** 中创建/编辑 **健康定期提醒（health_interval）** 时，用户无法填写自定义提醒内容；与之对照，**每日定时提醒（cron）** 则提供了"提醒内容"输入框。

健康定期提醒的用途不仅限于"测量"类指标（体重、身高、体温），还可能用于"观察"类指标（如根据上次睡眠间隔进行提醒）。当前默认文案中的 `测量` / `检测` 不够通用。

## 目标

1. 在健康定期提醒表单中新增一个 **可选** 的"提醒内容"输入框，用户填写的文本会追加到通知正文（`notifyBody`）。
2. 优化默认文案，使其同时适配测量类与观察类健康项目。
3. 编辑现有规则时正确回填用户自定义内容。

## 非目标

- 不改 API、Prisma schema、数据库迁移。
- 不改其他三类提醒（interval / cron / event_window）的现有行为。
- 不引入新的模板变量。

## 设计

### 1. 默认文案变更

| 字段 | 原文案 | 新文案 |
|---|---|---|
| `name` | `健康定期提醒` | `健康定期提醒`（不变） |
| `notifyTitle` | `该给{{babyName}}测量${itemsText}了` | `该关注一下{{babyName}}的${itemsText}了` |
| `notifyBody`（base） | `定期检测提醒：${itemsText}` | `定期提醒：${itemsText}` |

`{{babyName}}` 仍由 `lib/reminder-dispatcher.ts` 的 `renderTemplate` 在派发时替换，无需前端处理。`${itemsText}` 仍由 `HEALTH_TYPES` 标签拼接得出（如「体重、身高」）。

### 2. UI

在 `health_interval` 表单"提醒间隔"行之后追加一个输入框：

```
提醒内容（可选）
[                                            ]
留空则使用默认提醒文案
```

- `maxLength={100}`，与 cron 的 `cronContent` 一致。
- placeholder：`如：该测一下睡眠了`。

### 3. 状态

新增组件状态 `healthContent: string`（初始 `''`）。

### 4. 提交逻辑（`handleCreate`，`formType === 'health_interval'` 分支）

```ts
const baseBody = `定期提醒：${itemsText}`
const userNote = healthContent.trim()
body = {
  ...body,
  name: '健康定期提醒',
  triggerType: 'interval',
  triggerConfig: {
    sourceType: 'health',
    intervalMinutes: totalMinutes,
    filterCondition: healthTypes.length > 0 ? { type: healthTypes } : undefined,
  },
  activeSchedule: null,
  advanceMinutes: 0,
  notifyTitle: `该关注一下{{babyName}}的${itemsText}了`,
  notifyBody: userNote ? `${baseBody}\n${userNote}` : baseBody,
}
```

`\n` 作为分隔符：base 部分由前端生成、不含换行，因此 `\n` 唯一标记了"用户内容起点"。

### 5. 编辑回填（`handleEdit`，health 分支）

在原有 health 分支内追加：

```ts
const body = rule.notifyBody || ''
const newlineIdx = body.indexOf('\n')
setHealthContent(newlineIdx >= 0 ? body.slice(newlineIdx + 1) : '')
```

打开模态框前还需要在 `openCreateModal` 中重置 `setHealthContent('')`，避免上一次编辑残留。

### 6. 模态框关闭/重新选择类型时的清理

- `openCreateModal`：`setHealthContent('')`。
- 其他切换路径（如 `setModalStep('type')` 重新选类型）保持现有行为，不主动清理。

## 边界与兼容

- **历史数据迁移**：旧规则的 `notifyBody = "定期检测提醒：…"` 在用户**编辑保存**后会变为 `定期提醒：…`，相当于一次顺带的文案升级；不编辑则保持原样，不自动改写。
- **{{babyName}} 模板**：用户在自定义内容里写 `{{babyName}}` 也会被 `renderTemplate` 替换，与 cron 行为一致。
- **校验**：API 层 `notifyBody` 已限制 ≤ 500 字符；前端 `maxLength={100}` 加上 base 段（最多约 30 字符）远未触顶。

## 测试计划

手动验证：
1. 创建健康定期提醒，不填内容 → Webhook 收到 `定期提醒：体重、身高`。
2. 创建健康定期提醒，填写 `如：该测睡眠了` → Webhook 收到 `定期提醒：睡眠\n该测睡眠了`。
3. 编辑步骤 2 的规则 → 输入框回填 `该测睡眠了`。
4. 编辑步骤 1 的规则 → 输入框为空。
5. 旧版规则（含"定期检测提醒：…" body）打开编辑 → 输入框为空，保存后 body 升级为新格式。

## 涉及文件

- `components/ReminderManager.tsx`（唯一修改文件）

## 不涉及的文件

- API：`app/api/reminders/route.ts`、`app/api/reminders/[id]/route.ts`
- Schema：`prisma/schema.prisma`
- Dispatcher：`lib/reminder-dispatcher.ts`
- 自动疫苗：`lib/reminder-auto-vaccine.ts`
