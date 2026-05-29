# 健康定期提醒：自定义提醒内容 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ReminderManager 的"健康定期提醒"表单中加入可选的"提醒内容"输入框，并优化默认通知文案使其同时适配测量类与观察类指标。

**Architecture:** 仅修改 `components/ReminderManager.tsx` 单个文件。新增 `healthContent` 字符串 state，在 health_interval 表单渲染输入框；`handleCreate` 用更通用的默认文案，并把用户内容用 `\n` 分隔符追加到 `notifyBody`；`handleEdit` 通过查找首个 `\n` 把存量 body 拆分回填。API、Prisma schema、reminder dispatcher 均不变。

**Tech Stack:** Next.js 15 + React 18 + TypeScript + Tailwind（已有 stack，未引入新依赖）

**Spec:** `docs/superpowers/specs/2026-05-29-health-interval-content-design.md`

**项目无测试框架（package.json 中无 jest/vitest）**，因此每个任务以 `npm run lint` + `npm run build` 作为自动化校验门，并在最后一个任务做手动冒烟测试。

---

## 文件结构

仅一个文件被修改：

| 文件 | 责任 | 改动范围 |
|---|---|---|
| `components/ReminderManager.tsx` | 提醒规则的创建/编辑/列表 UI | 新增 1 个 state、1 个 UI 字段；改动 `handleCreate` health 分支、`handleEdit` health 分支、`openCreateModal` |

---

## Task 1: 新增 `healthContent` state、UI 输入框与重置逻辑

**Files:**
- Modify: `components/ReminderManager.tsx`

**目的:** 引入 state，并把它绑定到表单 UI 上；不修改提交/编辑逻辑（下两个任务再做）。这一步保证 lint/build 通过，state 被 UI 消费。

- [ ] **Step 1: 新增 state**

在 `components/ReminderManager.tsx` 第 211 行（现有 `const [healthHours, setHealthHours] = useState(0)` 之后）追加：

```tsx
  const [healthContent, setHealthContent] = useState('')
```

最终该区域应为：

```tsx
  // Health interval form
  const [healthTypes, setHealthTypes] = useState<string[]>(['WEIGHT', 'HEIGHT'])
  const [healthDays, setHealthDays] = useState(14)
  const [healthHours, setHealthHours] = useState(0)
  const [healthContent, setHealthContent] = useState('')
```

- [ ] **Step 2: 在 `openCreateModal` 中重置**

定位 `openCreateModal`（约第 338–347 行）。在末尾、`setAnchorDate(...)` 之后追加重置：

```tsx
    setAnchorDate(now.toISOString().slice(0, 10))
    setHealthContent('')
  }
```

- [ ] **Step 3: 在 health_interval 表单 UI 中追加输入框**

定位 health_interval 表单（约第 1167–1220 行）。在"提醒间隔"输入块（以 `<p className="text-xs text-gray-400 mt-1">距上次检测超过此时间后提醒</p>` 结尾的 `<div>`）之后、`</>` 之前，追加：

```tsx
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒内容（可选）</label>
                        <input
                          type="text"
                          value={healthContent}
                          onChange={e => setHealthContent(e.target.value)}
                          placeholder="如：该测一下睡眠了"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">留空则使用默认提醒文案</p>
                      </div>
```

- [ ] **Step 4: 校验 lint**

Run:
```bash
npm run lint
```
Expected: PASS（无新增 warning / error）。

- [ ] **Step 5: 校验 build**

Run:
```bash
npm run build
```
Expected: 编译成功。如果出现 `'healthContent' is assigned a value but never used` 之类的警告，确认 Step 3 的 UI 已正确接入 state。

- [ ] **Step 6: Commit**

```bash
git add components/ReminderManager.tsx
git commit -m "$(cat <<'EOF'
feat(reminders): 健康定期提醒新增"提醒内容"输入框

新增 healthContent state、UI 输入框，并在打开创建模态框时重置。
本次仅引入字段，提交/编辑逻辑下一步处理。
EOF
)"
```

---

## Task 2: 在 `handleCreate` 中应用新默认文案并追加用户内容

**Files:**
- Modify: `components/ReminderManager.tsx`（`handleCreate` 中 `formType === 'health_interval'` 分支，约第 408–427 行）

- [ ] **Step 1: 替换 health_interval 分支**

定位 `} else if (formType === 'health_interval') {` 块。整体替换为：

```tsx
      } else if (formType === 'health_interval') {
        const totalMinutes = healthDays * 24 * 60 + healthHours * 60
        const healthLabels = healthTypes
          .map(t => HEALTH_TYPES.find(ht => ht.value === t)?.label)
          .filter(Boolean)
        const itemsText = healthLabels.length > 0 ? healthLabels.join('、') : '健康指标'
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
      }
```

变化点（与原版对比）：
- `notifyTitle`：`该给{{babyName}}测量${itemsText}了` → `该关注一下{{babyName}}的${itemsText}了`
- `notifyBody`：`定期检测提醒：${itemsText}` → `定期提醒：${itemsText}`，并在用户填写时追加 `\n${userNote}`
- 新增局部变量 `baseBody`、`userNote`

- [ ] **Step 2: 校验 lint**

Run:
```bash
npm run lint
```
Expected: PASS。

- [ ] **Step 3: 校验 build**

Run:
```bash
npm run build
```
Expected: 编译成功。

- [ ] **Step 4: Commit**

```bash
git add components/ReminderManager.tsx
git commit -m "$(cat <<'EOF'
feat(reminders): 健康定期提醒支持自定义内容并优化默认文案

- 默认 notifyTitle 改为"该关注一下{{babyName}}的X了"，适配观察类指标
- 默认 notifyBody base 改为"定期提醒：X"
- 用户填写的"提醒内容"以 \n 分隔追加到 notifyBody
EOF
)"
```

---

## Task 3: 在 `handleEdit` 中根据 notifyBody 回填 `healthContent`

**Files:**
- Modify: `components/ReminderManager.tsx`（`handleEdit` 内 health interval 分支，约第 502–519 行）

- [ ] **Step 1: 在 health 分支末尾追加回填**

定位 `handleEdit` 内的：

```tsx
      if (config.sourceType === 'health') {
        setHealthDays(Math.floor(mins / (24 * 60)))
        setHealthHours(Math.round((mins % (24 * 60)) / 60))
        const filter = config.filterCondition as { type?: string[] } | undefined
        setHealthTypes(filter?.type || ['WEIGHT', 'HEIGHT'])
      } else {
```

在 `setHealthTypes(...)` 之后、`}` 之前追加：

```tsx
        setHealthTypes(filter?.type || ['WEIGHT', 'HEIGHT'])
        const body = rule.notifyBody || ''
        const newlineIdx = body.indexOf('\n')
        setHealthContent(newlineIdx >= 0 ? body.slice(newlineIdx + 1) : '')
      } else {
```

整体看应是：

```tsx
      if (config.sourceType === 'health') {
        setHealthDays(Math.floor(mins / (24 * 60)))
        setHealthHours(Math.round((mins % (24 * 60)) / 60))
        const filter = config.filterCondition as { type?: string[] } | undefined
        setHealthTypes(filter?.type || ['WEIGHT', 'HEIGHT'])
        const body = rule.notifyBody || ''
        const newlineIdx = body.indexOf('\n')
        setHealthContent(newlineIdx >= 0 ? body.slice(newlineIdx + 1) : '')
      } else {
```

- [ ] **Step 2: 校验 lint**

Run:
```bash
npm run lint
```
Expected: PASS。

- [ ] **Step 3: 校验 build**

Run:
```bash
npm run build
```
Expected: 编译成功。

- [ ] **Step 4: Commit**

```bash
git add components/ReminderManager.tsx
git commit -m "$(cat <<'EOF'
feat(reminders): 编辑健康定期提醒时回填自定义内容

按 notifyBody 中第一个换行符切分，将用户自定义部分回填到 healthContent。
旧规则（无换行）回填为空字符串，保存后 body 自然升级为新格式。
EOF
)"
```

---

## Task 4: 手动冒烟测试

**Files:** 无文件修改。

**前提:** 本地 `.env` 已配置（参见 `CLAUDE.md` 的 Environment Variables），且 `npm run dev` 可访问 `http://localhost:3000`。需要至少 1 个已注册用户和 1 个 baby。

- [ ] **Step 1: 启动开发服务器**

Run:
```bash
npm run dev
```

Expected: `▲ Next.js ... - Local: http://localhost:3000` 出现且无编译错误。

- [ ] **Step 2: 用例 1 — 创建健康定期提醒（不填内容）**

1. 浏览器访问 `http://localhost:3000`，登录。
2. 进入 **设置 → 提醒管理**。
3. 点击 **创建** → **健康定期提醒**。
4. 选项：选 1 个或多个检测项目（如"体重、身高"），间隔填 14 天 0 小时。
5. **不填**"提醒内容"输入框。
6. 提交。

Expected:
- 列表中出现新规则。
- 用 DevTools / 直接查 SQLite（`prisma/dev.db`）或在编辑模态中观察：
  - `notifyTitle` = `该关注一下{{babyName}}的体重、身高了`
  - `notifyBody` = `定期提醒：体重、身高`
  - 不含 `\n`

- [ ] **Step 3: 用例 2 — 创建健康定期提醒（填内容）**

1. 重复 Step 2 的 1–4。
2. 检测项目改选"睡眠"，**"提醒内容"填写** `该测一下睡眠了`。
3. 提交。

Expected:
- `notifyTitle` = `该关注一下{{babyName}}的睡眠了`
- `notifyBody` = `定期提醒：睡眠\n该测一下睡眠了`（"\n"是真实换行）

- [ ] **Step 4: 用例 3 — 编辑用例 2 的规则，回填正确**

1. 在列表中点击用例 2 规则的 ⋮ → **编辑**。
2. 观察"提醒内容"输入框。

Expected: 输入框值为 `该测一下睡眠了`，其他字段（检测项目=睡眠、间隔等）也正确回填。

- [ ] **Step 5: 用例 4 — 编辑用例 1 的规则，输入框为空**

1. 在列表中点击用例 1 规则的 ⋮ → **编辑**。

Expected: "提醒内容"输入框为空，其他字段正确回填。

- [ ] **Step 6: 用例 5 — 旧版规则（如有）打开编辑后保存升级**

如果数据库中已存在 `notifyBody = "定期检测提醒：…"` 的旧规则：
1. 编辑该规则、不改任何字段、点击保存。
2. 再次编辑或在 DB 中确认：`notifyBody` 变为 `定期提醒：…`，`notifyTitle` 变为 `该关注一下{{babyName}}的…了`。

如果当前数据库无旧规则，跳过此步并在最终汇报中注明。

- [ ] **Step 7: 用例 6 — 切换创建/编辑后 healthContent 不残留**

1. 创建一条健康定期提醒并填写内容 `测试残留`，提交。
2. 立刻点击 **创建** → **健康定期提醒**。

Expected: "提醒内容"输入框为空（不应残留 `测试残留`）。

- [ ] **Step 8: 用例 7 — 其他三类提醒不受影响**

快速过一遍：创建一条"喂养超时提醒"、一条"每日定时提醒"、一条"疫苗后监测提醒"——确认表单与提交均无回归。

- [ ] **Step 9: 汇报结果并清理测试数据（可选）**

在最终汇报中列出每个用例的实际观察结果。如果创建了大量测试规则，可在 UI 中删除。

---

## 验收标准

- [x] 设计文档已存在并经用户审阅（`docs/superpowers/specs/2026-05-29-health-interval-content-design.md`）。
- [ ] `npm run lint` 通过。
- [ ] `npm run build` 通过。
- [ ] 手动冒烟测试用例 1–7 全部通过。
- [ ] 三次提交可独立读懂（state/UI、handleCreate、handleEdit）。
