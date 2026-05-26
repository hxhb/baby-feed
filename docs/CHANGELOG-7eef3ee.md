# 变更说明：7eef3eeb (Activity Logger + 提醒系统)

**提交**: `7eef3eeb0459fd2c28b475d85f6d6b039789bb2e`  
**规模**: 46 文件变更, +7111 / -807 行  

---

## 一、通用内存日志系统 (Activity Logger)

### 新增模块
| 文件 | 说明 |
|------|------|
| `lib/activity-logger.ts` | 通用内存日志存储，支持多数据源隔离、惰性 TTL 清理、可配置容量上限 |

### 数据源
- `api-key` — API Key 请求日志 (24h TTL, 500 条上限)
- `webhook` — Webhook 投递日志 (24h TTL, 1000 条上限)  
- `reminder` — 提醒执行日志 (72h TTL, 1000 条上限)

### API Key 请求日志
| 文件 | 说明 |
|------|------|
| `app/api/user/api-key-logs/route.ts` | GET/DELETE 日志查询与清理 |
| `lib/api-key.ts` | 认证成功时记录请求（method、path、IP） |
| `components/ApiKeyManager.tsx` | 新增"请求日志"UI卡片 |

### Webhook 日志迁移 (DB → 内存)
| 文件 | 说明 |
|------|------|
| `lib/webhook-runner.ts` | 重写：DB queue → 内存 retry queue + activity-logger |
| `lib/webhook-service.ts` | 重写：移除 DB 事件/投递创建，直接投递 + 记录 |
| `app/api/webhooks/deliveries/route.ts` | 改为从 activity-logger 读取 |
| `app/api/webhooks/route.ts` | deliveriesCount 改从内存获取 |
| `components/WebhookManager.tsx` | 适配新日志响应格式 |

### 数据库变更
- **删除** `WebhookEvent` 表
- **删除** `WebhookDelivery` 表
- 迁移: `20260526120000_remove_webhook_event_delivery`

---

## 二、智能提醒系统 (Reminder)

### 核心引擎
| 文件 | 说明 |
|------|------|
| `lib/reminder-scheduler.ts` | 进程内调度引擎 (60s tick)，含活跃窗口检查、nextCheckAt 优化 |
| `lib/reminder-dispatcher.ts` | 模板渲染 + webhook 发射 + activity-logger 记录 |
| `lib/reminder-validation.ts` | triggerConfig 校验（interval/cron/event_window） |
| `lib/cron-parser.ts` | 轻量 5 段 cron 匹配器（无外部依赖） |
| `instrumentation.ts` | Next.js 启动时初始化调度器 |

### 可插拔评估器
| 文件 | 触发类型 | 用途 |
|------|----------|------|
| `lib/reminder-evaluators/interval.ts` | interval | 喂养间隔 / 健康定期 |
| `lib/reminder-evaluators/cron.ts` | cron | 每日定时 (如AD) |
| `lib/reminder-evaluators/event-window.ts` | event_window | 疫苗后监测 |
| `lib/reminder-evaluators/index.ts` | — | 注册表 + 接口定义 |

### 疫苗自动提醒
| 文件 | 说明 |
|------|------|
| `lib/reminder-auto-vaccine.ts` | 记录疫苗时自动创建体温监测规则（含同日去重） |

### API 路由
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/reminders` | GET/POST | 规则列表 / 创建 |
| `/api/reminders/[id]` | PUT/DELETE | 更新 / 删除 |
| `/api/reminders/logs` | GET/DELETE | 执行日志 |
| `/api/reminders/config` | GET/PUT | 用户提醒偏好 (autoVaccine 等) |

### UI
| 文件 | 说明 |
|------|------|
| `components/ReminderManager.tsx` | 4 种场景模板（喂养超时/每日定时/疫苗监测/健康定期） |
| `app/settings/reminders/page.tsx` | 设置页面入口 |
| `components/Settings.tsx` | 添加"提醒管理"导航项 |

### 数据库变更
- **新增** `User.reminderSettings` 字段 (nullable TEXT, 存储 JSON 偏好)
- **新增** `ReminderRule` 表 (含 3 个索引)
- 迁移: `20260527180000_add_reminder_system`

---

## 三、Webhook 事件扩展

| 新增事件 | 说明 |
|----------|------|
| `reminder.fired` | 提醒触发时通过 webhook 推送 |

`components/WebhookManager.tsx` 中：
- EVENT_LABELS 新增"提醒触发"
- EVENT_GROUPS 新增"提醒"分组
- 新增"编辑事件"功能（编辑已有 webhook 的订阅事件）

---

## 四、其他优化

| 改动 | 文件 |
|------|------|
| 时间轴下拉菜单被裁切修复 | `components/Timeline.tsx` (移除 overflow-hidden) |
| 喂养类型选择器未选中变灰 | `components/FeedingForm.tsx` |
| 速率限制配置 | `lib/rate-limit-config.ts` (新增 6 个 reminder 条目) |
| 文档更新 | `README.md`, `docs/HTTP_REQUESTS.md` |

---

## 五、安全特性

- 所有路由: 认证 + 用户隔离 + CSRF + 速率限制
- triggerConfig 按类型严格校验 (拒绝 `*/0`、`* * * * *`、负数等)
- Cron 解析器: 防 step=0 无限循环、限制逗号分隔项数
- activeSchedule.windows 上限 10 个
- 调度器 globalThis 单例防 HMR 泄漏
- 自动疫苗去重按 name 前缀过滤
- scheduleStart/End 校验 HH:MM 格式
- parseInt NaN 兜底

---

## 六、数据库迁移安全性

两个迁移均为**纯增量操作**：

```sql
-- 迁移 1: 移除旧 webhook 日志表
DROP TABLE IF EXISTS "WebhookDelivery";
DROP TABLE IF EXISTS "WebhookEvent";

-- 迁移 2: 添加提醒系统
ALTER TABLE "User" ADD COLUMN "reminderSettings" TEXT;
CREATE TABLE "ReminderRule" (...);
CREATE INDEX ...;
```

- ✅ 不修改现有列
- ✅ 不删除仍在使用的表
- ✅ 新列为 nullable（无 NOT NULL 约束）
- ✅ 不影响现有功能的正常运行
