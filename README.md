# Baby Feed - 新生儿喂养记录系统

一个简洁易用的新生儿喂养记录 Web 应用，支持 PWA 离线访问和 Docker 自部署。

## 功能特性

### 喂养记录
- **母乳亲喂**：记录左右乳喂养时长
- **母乳瓶喂**：记录瓶喂毫升数
- **奶粉喂养**：记录奶粉喂养量和时间
- **辅食记录**：记录辅食名称和用量

### 健康记录
- **体重/身高**：追踪宝宝生长发育
- **体温记录**：记录宝宝体温
- **用药记录**：记录药物名称和剂量
- **疫苗记录**：记录接种情况（含厂家、针次）
- **大小便记录**：记录排便情况及状态
- **AD 滴剂**：记录每日 AD 服用情况
- **睡眠记录**：记录睡眠起止时间和质量

### 数据展示
- **首页仪表盘**：今日概览、快捷记录入口
- **时间轴视图**：按日期平铺展示所有记录
- **统计图表**：喂养趋势、体重/身高/体温变化曲线
- **BMI 计算**：根据体重和身高自动计算
- **睡眠趋势**：柱状图展示每日睡眠时长与次数
- **AD 日历**：直观展示 AD 服用情况

### 其他特性
- 多用户账号系统
- 支持多宝宝管理
- **备忘录**：创建定时备忘（如疫苗接种提醒、体检日期），支持完成标记和日期范围查询
- 移动端响应式设计
- **PWA 支持**：可安装到手机桌面，支持离线访问
- **API Key 外部集成**：支持通过 HTTP API 对接外部程序（iOS 快捷指令、自动化脚本等）
- **AI Agent 集成**：内置 Agent Skill，可接入 Claude Code 等 AI 平台，用自然语言查询和记录喂养数据
- **智能提醒系统**：支持喂养间隔提醒、定时循环提醒（如每日AD）、事件窗口提醒（如疫苗后测体温），支持静默时段和 Webhook 通知
- **管理员面板**：管理用户、控制注册开放
- Docker 一键部署
- 数据本地持久化（SQLite）
- 启动时自动数据库迁移

## 快速开始

### 方式一：Docker Run（最快）

```bash
docker run -d \
  --name baby-feed \
  -p 3000:3000 \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e DATABASE_URL="file:/app/data/baby-feed.db" \
  -e TRUST_PROXY="true" \
  -v ./data:/app/data \
  --restart unless-stopped \
  ahzknarf/baby-feed:latest
```

打开浏览器访问 `http://localhost:3000`，首次使用需注册账号。

### 方式二：Docker Compose（推荐）

创建一个 `docker-compose.yml` 文件：

```yaml
services:
  baby-feed:
    image: ahzknarf/baby-feed:latest
    container_name: baby-feed
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/baby-feed.db
      - NEXTAUTH_SECRET=your-random-secret-at-least-32-chars  # 必须修改！
      - NEXTAUTH_URL=http://localhost:3000                     # 修改为实际访问地址
      - TRUST_PROXY=true                                       # 信任代理头，用于正确识别客户端 IP
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

然后启动：

```bash
docker-compose up -d
```

### 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 是 | SQLite 数据库路径，Docker 中使用 `file:/app/data/baby-feed.db` |
| `NEXTAUTH_SECRET` | 是 | JWT 加密密钥，至少 32 位随机字符串，用 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | 是 | 应用访问地址，如 `http://localhost:3000` 或 `https://baby.yourdomain.com` |
| `CORS_ALLOWED_ORIGIN` | 否 | 自定义 CORS 来源，默认使用 `NEXTAUTH_URL` |
| `TRUST_PROXY` | 否 | 设为 `true` 时信任反向代理传递的 `X-Forwarded-For` 头（用于正确识别客户端 IP 以实施速率限制）。使用 Nginx/Traefik 等反向代理时**必须设为 `true`**，默认 `true` |
| `REMINDER_ENABLED` | 否 | 设为 `false` 禁用提醒调度器（默认启用） |

> **注意**：如果使用 HTTPS 反向代理，`NEXTAUTH_URL` 必须以 `https://` 开头。

## 高级配置

### 修改端口

修改 `docker-compose.yml` 中的端口映射，同时更新 `NEXTAUTH_URL`：

```yaml
ports:
  - "8080:3000"
environment:
  - NEXTAUTH_URL=http://localhost:8080
```

### 反向代理（Nginx + HTTPS）

```nginx
server {
    listen 80;
    server_name baby.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name baby.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

同时设置：`NEXTAUTH_URL=https://baby.yourdomain.com`

建议使用 Let's Encrypt + Certbot 获取免费 SSL 证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d baby.yourdomain.com
```

### 数据备份与恢复

```bash
# 备份
docker cp baby-feed:/app/data/baby-feed.db ./backup/

# 恢复
docker cp ./backup/baby-feed.db baby-feed:/app/data/
```

### 更新应用

```bash
docker pull ahzknarf/baby-feed:latest
docker-compose up -d
```

数据库迁移会在容器启动时自动执行。

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，本地开发建议：
#   DATABASE_URL="file:./dev.db"
#   NEXTAUTH_SECRET="dev-secret-key-for-local-development"
#   NEXTAUTH_URL="http://localhost:3000"

# 3. 初始化数据库
npx prisma generate
npx prisma migrate deploy

# 4. 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`。

## PWA 支持

本应用支持 PWA（渐进式 Web 应用），可安装到手机或桌面：

1. 使用 Chrome/Edge 等现代浏览器访问应用
2. 点击地址栏的安装图标，或使用浏览器菜单中的"安装应用"
3. 安装后可像原生 App 一样从桌面启动

特性：离线访问已缓存页面、智能缓存策略、自适应图标。

## API 接口

所有业务 API 均需认证（Cookie 或 API Key），在 **设置 → API Key 管理** 中创建密钥。

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/babies` | GET/POST | 宝宝列表 / 添加宝宝 |
| `/api/babies/[id]` | GET/PUT/DELETE | 宝宝详情 / 修改 / 删除 |
| `/api/feeding` | GET/POST | 喂养记录列表 / 添加记录 |
| `/api/feeding/[id]` | PUT/DELETE | 修改 / 删除喂养记录 |
| `/api/health` | GET/POST | 健康记录列表 / 添加记录 |
| `/api/health/[id]` | PUT/DELETE | 修改 / 删除健康记录 |
| `/api/memo` | GET/POST | 备忘录列表 / 创建备忘 |
| `/api/memo/[id]` | PUT/DELETE | 更新（含标记完成） / 删除备忘 |
| `/api/sleep-summary` | GET | 按日汇总的睡眠数据 |
| `/api/stats` | GET | 多日统计数据 |
| `/api/stats/day` | GET | 单日统计数据 |
| `/api/timeline-dates` | GET | 时间轴有效日期 |
| `/api/user/api-keys` | GET/POST/DELETE | API Key 管理 |
| `/api/user/api-key-logs` | GET/DELETE | API Key 请求日志（内存存储，24h 自动清理） |
| `/api/reminders` | GET/POST | 提醒规则列表 / 创建规则 |
| `/api/reminders/[id]` | PUT/DELETE | 更新 / 删除提醒规则 |
| `/api/reminders/logs` | GET/DELETE | 提醒执行日志 |
| `/api/admin/*` | GET/PUT/DELETE | 管理员接口 |

完整的请求示例和参数说明见 [HTTP API 文档](docs/HTTP_REQUESTS.md)。

## AI Agent 集成

本项目内置了 **Agent Skill**（`.claude/skills/baby-feed-assistant/`），可以将 HTTP API 接入 AI Agent 平台（如 Claude Code），实现用自然语言查询和记录宝宝的喂养数据。

### 工作原理

```
用户 → "宝宝今天吃了多少？"
  ↓
AI Agent 加载 Skill（API 文档 + 调用规范）
  ↓
Agent 通过 HTTP API + API Key 访问 Baby Feed
  ↓
返回自然语言摘要："今天亲喂母乳 7 次，共 60 分钟..."
```

Skill 本质上是一份结构化的 API 使用文档（`SKILL.md`），告诉 Agent 如何调用各个接口、如何处理时间戳、如何组织返回结果。Agent 读取后即可自主完成数据查询和记录创建。

### 支持的交互示例

| 用户说 | Agent 行为 |
|--------|-----------|
| "宝宝今天状况怎么样" | 并行查询喂养/睡眠/换尿布/疫苗等，生成日报 |
| "记录一下刚喂了 120ml 配方奶" | 调用 POST /api/feeding 创建记录 |
| "最近一周体重变化趋势" | 查询 /api/stats 的 weightTrend，生成分析 |
| "有什么备忘" | 查询未完成的备忘录列表 |

### 接入步骤

#### 1. 创建 API Key

在 Baby Feed 应用的 **设置 → API Key 管理** 中创建密钥，获得 `bfk_` 开头的 Key。

#### 2. 配置 Skill 凭证

```bash
cd .claude/skills/baby-feed-assistant/
cp config.local.example config.local
```

编辑 `config.local`，填入实际值：

```bash
BABY_FEED_BASE_URL=https://your-baby-feed-instance.example.com
BABY_FEED_API_KEY=bfk_your_api_key_here
```

> `config.local` 已在 `.gitignore` 中，不会被提交到仓库。

#### 3. 在 AI Agent 中使用

以 Claude Code 为例，在项目目录下启动后，Skill 会被自动发现。直接用自然语言提问即可：

```
> 宝宝今天吃了多少？
> 记录体温 37.2
> 最近睡眠情况怎么样？
```

### 适配其他 Agent 平台

Skill 的核心是 `SKILL.md` 文件，包含完整的 API 调用规范。如需接入其他 AI Agent 平台：

1. 将 `SKILL.md` 的内容作为系统提示或知识库注入 Agent
2. 配置 Agent 可调用 HTTP 请求（curl 或等效工具）
3. 提供 `BABY_FEED_BASE_URL` 和 `BABY_FEED_API_KEY` 作为环境变量

关键要点（详见 `SKILL.md`）：
- 所有写入时间戳必须带 `+08:00` 偏移量（如 `2026-05-15T15:00:00+08:00`）
- API 返回的时间是 UTC（`Z` 后缀），展示时需转为北京时间
- 查询参数中的 `date` 直接使用北京日期（`YYYY-MM-DD`）

## 文档

| 文档 | 说明 |
|------|------|
| [HTTP API 文档](docs/HTTP_REQUESTS.md) | 完整的 API 接口文档，含请求示例和参数说明 |
| [技术栈与数据模型](docs/TECH_STACK.md) | 技术选型、数据模型、认证系统详情 |
| [项目结构](docs/PROJECT_STRUCTURE.md) | 目录结构和文件说明 |
| [Agent Skill](.claude/skills/baby-feed-assistant/SKILL.md) | AI Agent 集成的 API 调用规范和时间戳处理说明 |

## 常见问题

**如何修改端口？** 修改 `docker-compose.yml` 端口映射，同时更新 `NEXTAUTH_URL`。

**忘记密码？** 设置页面可修改密码（需旧密码）。完全忘记需直接操作数据库重置。

**数据存储在哪？** Docker 部署在宿主机 `./data` 目录；本地开发在项目根目录 `dev.db`。

**支持哪些浏览器？** 所有现代浏览器（Chrome、Firefox、Edge、Safari），推荐 Chrome/Edge 以获得完整 PWA 体验。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
