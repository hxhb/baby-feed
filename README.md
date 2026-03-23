# 🍼 Baby Feed - 新生儿喂养记录系统

一个简洁易用的新生儿喂养记录 Web 应用，支持 PWA 离线访问和 Docker 自部署。

## ✨ 功能特性

### 📋 喂养记录
- **母乳亲喂**：记录左右乳房喂养时长
- **母乳瓶喂**：记录瓶喂毫升数
- **奶粉喂养**：记录奶粉喂养量和时间
- **辅食记录**：记录辅食名称和用量

### 🏥 健康记录
- **体重记录**：随时记录宝宝体重变化
- **身高记录**：记录宝宝身高
- **体温记录**：记录宝宝体温
- **用药记录**：记录药物名称和剂量
- **疫苗记录**：记录疫苗接种情况（含厂家、针次信息）
- **大小便记录**：记录小便/大便情况及状态
- **AD 滴剂**：记录每日 AD 服用情况
- **睡眠记录**：记录睡眠起止时间和睡眠质量

### 📊 数据展示
- **首页仪表盘**：今日概览、快捷记录入口
- **时间轴视图**：按日期平铺展示所有记录
- **统计图表**：喂养趋势、体重/身高/体温变化曲线（基于 Recharts）
- **BMI 计算**：根据体重和身高自动计算 BMI
- **每日睡眠趋势**：柱状图展示每日睡眠时长与次数
- **AD 日历**：直观展示 AD 服用情况

### 👤 账户管理
- **用户注册/登录**：邮箱 + 密码认证
- **修改用户名**：随时更新个人昵称
- **修改密码**：验证旧密码 + 新密码强度校验（≥8位，含字母+数字）
- **退出登录**：一键安全退出
- **注销账户**：双重确认（密码 + 文本确认），永久删除账户及所有关联数据

### 🔧 管理功能
- **管理员面板**：管理所有用户、修改用户角色
- **站点设置**：控制是否允许开放注册
- **用户管理**：查看/删除用户及其所有数据

### 🎯 其他特性
- 多用户账号系统
- 支持多宝宝管理（增删改查）
- 移动端响应式设计
- **PWA 支持**：可安装到手机桌面，支持离线访问
- **API Key 外部集成**：支持通过 HTTP API 从外部程序（iOS 快捷指令、自动化脚本等）读写数据
- Docker 一键部署
- 数据本地持久化（SQLite）
- 启动时自动数据库迁移

## 🛠️ 技术栈

| 领域 | 技术 |
|------|------|
| **前端框架** | Next.js 15（App Router，Standalone 模式） |
| **开发语言** | TypeScript |
| **样式方案** | Tailwind CSS |
| **数据库** | SQLite（通过 libsql） |
| **ORM** | Prisma + @prisma/adapter-libsql |
| **认证系统** | NextAuth.js |
| **密码加密** | bcryptjs |
| **图表库** | Recharts |
| **图标库** | Lucide React |
| **PWA** | 自定义 Service Worker + Web App Manifest |
| **部署方案** | Docker（Alpine 多阶段构建） |

## 📁 项目结构

```
baby-feed/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 根布局（PWA、字体、Service Worker 注册）
│   ├── page.tsx                # 首页（仪表盘）
│   ├── add/                    # 添加记录页面
│   ├── login/                  # 登录页面
│   ├── register/               # 注册页面
│   ├── offline/                # 离线回退页面（PWA）
│   ├── settings/               # 设置页面（账户管理 + 宝宝管理）
│   ├── stats/                  # 统计页面
│   ├── timeline/               # 时间轴页面
│   ├── api/                    # API 路由
│   │   ├── admin/              # 管理员接口（身份检查/站点设置/用户管理）
│   │   ├── auth/               # 认证（NextAuth + 注册 + 会话）
│   │   ├── babies/             # 宝宝管理 CRUD
│   │   ├── feeding/            # 喂养记录 CRUD
│   │   ├── health/             # 健康记录 CRUD
│   │   ├── site/               # 站点公开接口（注册状态查询）
│   │   ├── stats/              # 统计数据（总览 + 按日）
│   │   ├── timeline-dates/     # 时间轴有效日期
│   │   └── user/               # 用户管理（资料/密码/注销/API Key）
│   └── generated/prisma/       # Prisma 自动生成的客户端代码
├── components/                 # React 组件
│   ├── AdminPanel.tsx           # 管理员面板
│   ├── ApiKeyManager.tsx       # API Key 管理组件
│   ├── Dashboard.tsx           # 首页仪表盘
│   ├── FeedingForm.tsx         # 喂养记录表单
│   ├── FeedingRecordFields.tsx # 喂养记录字段组件
│   ├── HealthForm.tsx          # 健康记录表单
│   ├── HealthRecordFields.tsx  # 健康记录字段组件
│   ├── Navbar.tsx              # 响应式导航栏
│   ├── Providers.tsx           # NextAuth SessionProvider 封装
│   ├── RecordActionBar.tsx     # 记录操作栏组件
│   ├── RecordMetaFields.tsx    # 记录元信息字段组件
│   ├── Settings.tsx            # 设置组件（账户管理 + 宝宝管理）
│   ├── Stats.tsx               # 统计图表组件
│   ├── StatsUi.tsx             # 统计 UI 辅助组件
│   ├── Timeline.tsx            # 时间轴组件
│   └── TimelineEditRecordModal.tsx # 时间轴编辑记录弹窗
├── lib/                        # 工具库
│   ├── admin.ts                # 管理员权限验证
│   ├── api-helpers.ts          # API 响应辅助函数
│   ├── api-key.ts              # API Key 生成、验证
│   ├── auth.ts                 # NextAuth 认证配置（支持 Cookie + API Key）
│   ├── client-request-cache.ts # 客户端请求缓存
│   ├── feeding-records.ts      # 喂养记录工具函数
│   ├── health-records.ts       # 健康记录工具函数
│   ├── prisma.ts               # Prisma 客户端实例
│   ├── rate-limit.ts           # 速率限制
│   ├── record-display.tsx      # 记录展示组件
│   ├── server-auth.ts          # 服务端认证辅助
│   ├── server-babies.ts        # 服务端宝宝数据
│   ├── server-dashboard.ts     # 服务端仪表盘数据
│   ├── server-stats.ts         # 服务端统计数据
│   ├── server-timeline.ts      # 服务端时间轴数据
│   ├── site-settings.ts        # 站点设置管理
│   ├── time.ts                 # 时间处理工具
│   └── validation.ts           # 输入验证
├── prisma/                     # 数据库配置
│   ├── schema.prisma           # 数据库模型定义
│   └── migrations/             # 数据库迁移文件
├── scripts/
│   ├── migrate.mjs             # 轻量级迁移脚本（无需 Prisma CLI）
│   └── set-admin.mjs           # 设置管理员脚本
├── public/                     # 静态资源
│   ├── manifest.json           # PWA 配置
│   ├── sw.js                   # Service Worker
│   └── *.svg                   # 应用图标
├── types/                      # TypeScript 类型定义
│   └── next-auth.d.ts          # NextAuth 类型扩展
├── middleware.ts                # NextAuth 路由保护中间件
├── Dockerfile                  # 多阶段 Docker 构建
├── docker-compose.yml          # Docker Compose 编排
├── start.sh                    # 容器启动脚本（迁移 + 启动）
└── README.md                   # 项目文档
```

## 🐳 Docker 部署指南

### 方式一：使用 Docker Compose（推荐）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd baby-feed
```

#### 2. 创建环境变量文件

```bash
cp .env.example .env
```

#### 3. 修改环境变量

编辑 `.env` 文件，修改以下配置：

```env
# 数据库路径（Docker 容器内路径，无需修改）
DATABASE_URL="file:/app/data/baby-feed.db"

# NextAuth 密钥（必须修改为随机字符串）
NEXTAUTH_SECRET="your-random-secret-key-at-least-32-characters"

# 应用访问地址（修改为你的实际访问地址）
NEXTAUTH_URL="http://localhost:3000"
```

> **重要**：
> - `NEXTAUTH_SECRET` 必须修改为随机字符串，建议使用 `openssl rand -base64 32` 生成
> - `NEXTAUTH_URL` 需要修改为实际访问地址，如 `http://your-domain.com` 或 `https://baby.yourdomain.com`
> - 如果使用 HTTPS 反向代理，`NEXTAUTH_URL` 必须以 `https://` 开头

#### 4. 启动服务

```bash
docker-compose up -d
```

#### 5. 访问应用

打开浏览器访问 `http://localhost:3000`，首次使用需注册账号。

#### 6. 查看日志

```bash
docker-compose logs -f
```

#### 7. 停止服务

```bash
docker-compose down
```

### 方式二：使用 Docker 命令

#### 1. 构建镜像

```bash
docker build -t baby-feed .
```

#### 2. 运行容器

```bash
docker run -d \
  --name baby-feed \
  -p 3000:3000 \
  -e DATABASE_URL="file:/app/data/baby-feed.db" \
  -e NEXTAUTH_SECRET="your-random-secret-key" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -v baby-feed-data:/app/data \
  baby-feed
```

### 配置说明

#### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:/app/data/baby-feed.db` |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥（至少32位随机字符串） | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 应用访问地址 | `http://localhost:3000` |
| `DATA_PATH`（可选） | 宿主机数据存储路径 | `./data`（默认值） |

#### 端口修改

如需修改端口，编辑 `docker-compose.yml`：

```yaml
ports:
  - "8080:3000"  # 将 3000 改为其他端口
```

同时修改 `.env` 中的 `NEXTAUTH_URL`：

```env
NEXTAUTH_URL="http://localhost:8080"
```

#### 反向代理配置（Nginx）

如果使用 Nginx 反向代理并启用 HTTPS：

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

修改 `.env`：

```env
NEXTAUTH_URL="https://baby.yourdomain.com"
```

#### HTTPS 证书

建议使用 Let's Encrypt + Certbot 获取免费 SSL 证书：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d baby.yourdomain.com
```

### 数据备份与恢复

#### 备份数据

```bash
# 导出数据卷
docker run --rm \
  -v baby-feed_baby-feed-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/baby-feed-backup.tar.gz -C /data .

# 或者直接复制数据库文件
docker cp baby-feed:/app/data/baby-feed.db ./backup/
```

#### 恢复数据

```bash
# 从备份恢复
docker run --rm \
  -v baby-feed_baby-feed-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/baby-feed-backup.tar.gz"

# 或者直接复制数据库文件
docker cp ./backup/baby-feed.db baby-feed:/app/data/
```

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动（数据库迁移会在启动时自动执行）
docker-compose up -d --build
```

## 💻 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，本地开发建议配置：

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="dev-secret-key-for-local-development"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 访问应用

打开浏览器访问 `http://localhost:3000`

## 📱 PWA 支持

本应用支持 PWA（渐进式 Web 应用），可以安装到手机或桌面：

1. 使用 Chrome/Edge 等现代浏览器访问应用
2. 浏览器会提示"安装应用"或点击地址栏的安装图标
3. 安装后可像原生 App 一样从桌面启动

**PWA 特性：**
- 📲 可安装到桌面，独立窗口运行
- 📴 离线访问：已缓存的页面在断网时仍可查看
- 🔄 智能缓存：静态资源缓存优先，页面网络优先
- 🖼️ 自适应图标，支持各种设备

## 🗄️ 数据模型

```
User（用户）
 ├── Baby（宝宝）     ← 一对多
 │    ├── FeedingRecord（喂养记录）  ← 一对多
 │    └── HealthRecord（健康记录）   ← 一对多
 ├── FeedingRecord（喂养记录）       ← 一对多（冗余关联，便于查询）
 └── HealthRecord（健康记录）        ← 一对多（冗余关联，便于查询）
```

所有关联均设置了 **级联删除**（`onDelete: Cascade`），删除用户或宝宝时会自动清理关联记录。

## 🔌 API 接口

所有业务 API 接口均需要认证，支持两种认证方式：

1. **Cookie/Session 认证**（Web 端登录后自动使用）
2. **API Key 认证**（适用于外部程序调用，如 iOS 快捷指令、自动化脚本等）

### API Key 认证

#### 获取 API Key

登录 Web 端后，进入 **设置 → API Key 管理**，创建一个新的 API Key。Key 创建后**仅显示一次**，请立即保存。

#### 使用方式

在 HTTP 请求头中携带 `Authorization: Bearer <your-api-key>`：

```bash
curl -H "Authorization: Bearer bfk_your_api_key_here" \
  "https://your-domain/api/babies"
```

#### 安全说明

| 安全措施 | 说明 |
|---|---|
| **哈希存储** | 数据库只存储 Key 的 SHA-256 哈希值，即使数据库泄露也不会暴露明文 |
| **单次显示** | API Key 创建时显示一次，关闭后无法再查看 |
| **用户隔离** | 每个 Key 绑定创建者，只能操作该用户的数据 |
| **速率限制** | 每 IP 每分钟最多 30 次失败认证，防止暴力枚举 |
| **过期机制** | 支持设置 7/30/90/180/365 天有效期 |
| **数量上限** | 每用户最多 10 个 Key |
| **CORS 支持** | 业务 API 已开启 CORS，支持跨域调用 |

---

### 接口概览

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 认证入口 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/session` | GET | 获取当前会话 |
| `/api/site/registration-status` | GET | 查询是否允许注册（公开接口） |
| `/api/user/profile` | GET/PUT | 获取/修改用户资料 |
| `/api/user/password` | PUT | 修改密码 |
| `/api/user/delete` | DELETE | 注销账户 |
| `/api/user/api-keys` | GET/POST/DELETE | API Key 管理（列出/创建/吊销） |
| `/api/babies` | GET/POST | 宝宝列表/添加宝宝 |
| `/api/babies/[id]` | GET/PUT/DELETE | 获取/修改/删除宝宝 |
| `/api/feeding` | GET/POST | 喂养记录列表/添加记录 |
| `/api/feeding/[id]` | PUT/DELETE | 修改/删除喂养记录 |
| `/api/health` | GET/POST | 健康记录列表/添加记录 |
| `/api/health/[id]` | PUT/DELETE | 修改/删除健康记录 |
| `/api/stats` | GET | 统计数据总览 |
| `/api/stats/day` | GET | 按日统计数据 |
| `/api/timeline-dates` | GET | 获取时间轴有效日期 |
| `/api/admin/check` | GET | 检查管理员身份 |
| `/api/admin/settings` | GET/PUT | 获取/修改站点设置 |
| `/api/admin/users` | GET/PUT/DELETE | 用户管理（列出/修改角色/删除） |

---

### 接口详细说明

> 以下所有接口均需认证（Cookie 或 API Key），未认证返回 `401: { error: "未授权" }`。
> 所有时间字段使用 ISO 8601 格式（如 `2026-03-16T08:00:00+08:00`）。

#### 🍼 宝宝管理

##### GET /api/babies — 获取宝宝列表

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/babies"
```

**响应：**
```json
[
  {
    "id": "cm...",
    "name": "宝宝",
    "birthDate": "2026-01-01T00:00:00.000Z",
    "gender": "MALE",
    "userId": "...",
    "createdAt": "..."
  }
]
```

##### POST /api/babies — 添加宝宝

```bash
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name":"宝宝","birthDate":"2026-01-01","gender":"MALE"}' \
  "https://your-domain/api/babies"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 宝宝名称 |
| `birthDate` | string | ✅ | 出生日期（ISO 格式） |
| `gender` | string | ✅ | 性别，可选值：`MALE`、`FEMALE`、`UNKNOWN` |

##### GET /api/babies/{id} — 获取宝宝详情

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/babies/baby_id"
```

##### PUT /api/babies/{id} — 修改宝宝信息

```bash
curl -X PUT -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name":"新名字"}' \
  "https://your-domain/api/babies/baby_id"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 宝宝名称 |
| `birthDate` | string | 否 | 出生日期（ISO 格式） |
| `gender` | string | 否 | 性别，可选值：`MALE`、`FEMALE`、`UNKNOWN` |

##### DELETE /api/babies/{id} — 删除宝宝

```bash
curl -X DELETE -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/babies/baby_id"
```

---

#### 🍼 喂养记录

##### GET /api/feeding — 获取喂养记录列表

```bash
# 获取所有记录
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/feeding"

# 按宝宝和日期筛选
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/feeding?babyId=xxx&date=2026-03-16"
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `babyId` | string | 否 | 按宝宝 ID 过滤 |
| `date` | string | 否 | 按日期过滤，格式 `YYYY-MM-DD`（北京时间） |

##### POST /api/feeding — 添加喂养记录

```bash
# 奶粉喂养
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "babyId": "xxx",
    "type": "FORMULA",
    "startTime": "2026-03-16T08:00:00+08:00",
    "formulaAmount": 120
  }' \
  "https://your-domain/api/feeding"

# 母乳亲喂
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "babyId": "xxx",
    "type": "BREAST_MILK",
    "startTime": "2026-03-16T10:00:00+08:00",
    "leftBreastDuration": 15,
    "rightBreastDuration": 10
  }' \
  "https://your-domain/api/feeding"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `babyId` | string | ✅ | 宝宝 ID |
| `type` | string | ✅ | 喂养类型：`BREAST_MILK`（亲喂）、`BREAST_MILK_BOTTLE`（母乳瓶喂）、`FORMULA`（奶粉）、`SOLID_FOOD`（辅食） |
| `startTime` | string | ✅ | 开始时间（ISO 格式） |
| `leftBreastDuration` | number | 否 | 左乳喂养时长（分钟），`BREAST_MILK` 类型时使用 |
| `rightBreastDuration` | number | 否 | 右乳喂养时长（分钟），`BREAST_MILK` 类型时使用 |
| `breastMilkAmount` | number | 否 | 母乳瓶喂量（毫升），`BREAST_MILK_BOTTLE` 类型时使用 |
| `formulaAmount` | number | 否 | 奶粉喂养量（毫升），`FORMULA` 类型时使用 |
| `solidFoodName` | string | 否 | 辅食名称，`SOLID_FOOD` 类型时使用 |
| `solidFoodAmount` | string | 否 | 辅食用量，`SOLID_FOOD` 类型时使用 |
| `endTime` | string | 否 | 结束时间（ISO 格式） |
| `notes` | string | 否 | 备注 |

##### PUT /api/feeding/{id} — 修改喂养记录

```bash
curl -X PUT -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"formulaAmount": 150, "notes": "宝宝吃得多"}' \
  "https://your-domain/api/feeding/record_id"
```

##### DELETE /api/feeding/{id} — 删除喂养记录

```bash
curl -X DELETE -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/feeding/record_id"
```

---

#### 🏥 健康记录

##### GET /api/health — 获取健康记录列表

```bash
# 获取所有记录
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/health"

# 按宝宝、日期、类型筛选
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/health?babyId=xxx&date=2026-03-16&type=WEIGHT"
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `babyId` | string | 否 | 按宝宝 ID 过滤 |
| `date` | string | 否 | 按日期过滤，格式 `YYYY-MM-DD` |
| `type` | string | 否 | 按类型过滤：`WEIGHT`、`HEIGHT`、`TEMPERATURE`、`MEDICATION`、`VACCINE`、`DIAPER` |

##### POST /api/health — 添加健康记录

```bash
# 体重记录
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "babyId": "xxx",
    "type": "WEIGHT",
    "recordedAt": "2026-03-16T09:00:00+08:00",
    "weight": 5.2
  }' \
  "https://your-domain/api/health"

# 体温记录
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "babyId": "xxx",
    "type": "TEMPERATURE",
    "recordedAt": "2026-03-16T09:00:00+08:00",
    "temperature": 36.5
  }' \
  "https://your-domain/api/health"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `babyId` | string | ✅ | 宝宝 ID |
| `type` | string | ✅ | 记录类型：`WEIGHT`、`HEIGHT`、`TEMPERATURE`、`MEDICATION`、`VACCINE`、`DIAPER`、`AD_VITAMIN`、`SLEEP` |
| `recordedAt` | string | ✅ | 记录时间（ISO 格式） |
| `weight` | number | 否 | 体重（kg），`WEIGHT` 类型时使用 |
| `height` | number | 否 | 身高（cm），`HEIGHT` 类型时使用 |
| `temperature` | number | 否 | 体温（°C），`TEMPERATURE` 类型时使用 |
| `medicationName` | string | 否 | 药物名称，`MEDICATION` 类型时使用 |
| `medicationDose` | string | 否 | 药物剂量，`MEDICATION` 类型时使用 |
| `vaccineName` | string | 否 | 疫苗名称，`VACCINE` 类型时必填 |
| `vaccineManufacturer` | string | 否 | 疫苗厂家，`VACCINE` 类型时使用 |
| `vaccineDoseNumber` | number | 否 | 当前针次，`VACCINE` 类型时必填 |
| `vaccineTotalDoses` | number | 否 | 总针数，`VACCINE` 类型时必填 |
| `diaperType` | string | 否 | 大小便类型（`PEE`/`POOP`/`BOTH`），`DIAPER` 类型时使用 |
| `diaperStatus` | string | 否 | 大小便状态，`DIAPER` 类型时使用 |
| `adGiven` | boolean | 否 | 是否已服用 AD，`AD_VITAMIN` 类型时使用 |
| `sleepStartTime` | string | 否 | 睡眠开始时间（ISO 格式），`SLEEP` 类型时使用 |
| `sleepEndTime` | string | 否 | 睡眠结束时间（ISO 格式），`SLEEP` 类型时使用 |
| `sleepQuality` | string | 否 | 睡眠质量，`SLEEP` 类型时使用 |
| `notes` | string | 否 | 备注 |

##### PUT /api/health/{id} — 修改健康记录

```bash
curl -X PUT -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"weight": 5.3}' \
  "https://your-domain/api/health/record_id"
```

##### DELETE /api/health/{id} — 删除健康记录

```bash
curl -X DELETE -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/health/record_id"
```

---

#### 📅 时间轴

##### GET /api/timeline-dates — 获取时间轴有效日期

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/timeline-dates?babyId=xxx"
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `babyId` | string | ✅ | 宝宝 ID |

---

#### 📊 统计数据

##### GET /api/stats — 获取多日统计

```bash
# 默认最近 7 天
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/stats?babyId=xxx"

# 最近 30 天
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/stats?babyId=xxx&days=30"
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `babyId` | string | ✅ | 宝宝 ID |
| `days` | number | 否 | 统计天数，默认 7，范围 1-365 |

**响应示例：**
```json
{
  "baby": { "id": "...", "name": "宝宝", "birthDate": "..." },
  "todayStats": {
    "date": "2026-03-16",
    "breastFeedingCount": 3,
    "totalBreastDuration": 45,
    "breastBottleCount": 1,
    "totalBreastMilkAmount": 80,
    "formulaCount": 2,
    "totalFormulaAmount": 240,
    "adGiven": true,
    "weight": 5.2,
    "temperature": 36.5
  },
  "lastDays": [ "..." ],
  "totalStats": {
    "totalFeedings": 42,
    "totalFormulaAmount": 2520,
    "totalBreastDuration": 630,
    "totalBreastMilkAmount": 560
  },
  "weightTrend": [
    { "date": "2026-03-10", "weight": 5.0 },
    { "date": "2026-03-14", "weight": 5.2 }
  ]
}
```

##### GET /api/stats/day — 获取单日统计

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/stats/day?babyId=xxx&date=2026-03-16"
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `babyId` | string | ✅ | 宝宝 ID |
| `date` | string | ✅ | 日期，格式 `YYYY-MM-DD` |

---

#### 🔑 API Key 管理

##### GET /api/user/api-keys — 获取 Key 列表

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/user/api-keys"
```

**响应：**
```json
[
  {
    "id": "...",
    "name": "iOS快捷指令",
    "prefix": "bfk_a1b2",
    "lastUsedAt": "2026-03-16T08:00:00.000Z",
    "expiresAt": "2026-06-16T00:00:00.000Z",
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
]
```

##### POST /api/user/api-keys — 创建新 Key

```bash
curl -X POST -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name":"自动化脚本","expiresInDays":90}' \
  "https://your-domain/api/user/api-keys"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Key 名称（最长 100 字符） |
| `expiresInDays` | number | 否 | 有效天数（1-365），不填则永不过期 |

**响应（⚠️ 明文 Key 仅此一次返回）：**
```json
{
  "id": "...",
  "name": "自动化脚本",
  "prefix": "bfk_a1b2",
  "expiresAt": "2026-06-16T00:00:00.000Z",
  "createdAt": "2026-03-16T00:00:00.000Z",
  "key": "bfk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "请立即保存此 API Key，之后将无法再次查看完整 Key。"
}
```

##### DELETE /api/user/api-keys — 吊销 Key

```bash
curl -X DELETE -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"keyId":"key_id_here"}' \
  "https://your-domain/api/user/api-keys"
```

---

#### 🌐 站点公开接口

##### GET /api/site/registration-status — 查询注册开放状态

此接口无需认证。

```bash
curl "https://your-domain/api/site/registration-status"
```

**响应：**
```json
{
  "allowRegistration": true
}
```

---

#### 🛡️ 管理员接口

> 以下接口仅限管理员（`role: ADMIN`）访问，非管理员返回 `403`。

##### GET /api/admin/check — 检查管理员身份

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/admin/check"
```

**响应：**
```json
{
  "isAdmin": true
}
```

##### GET /api/admin/settings — 获取站点设置

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/admin/settings"
```

##### PUT /api/admin/settings — 修改站点设置

```bash
curl -X PUT -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"allowRegistration": false}' \
  "https://your-domain/api/admin/settings"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `allowRegistration` | boolean | 否 | 是否允许新用户注册 |

##### GET /api/admin/users — 获取用户列表

```bash
curl -H "Authorization: Bearer bfk_xxx" \
  "https://your-domain/api/admin/users"
```

**响应示例：**
```json
[
  {
    "id": "...",
    "email": "user@example.com",
    "name": "用户名",
    "role": "USER",
    "createdAt": "...",
    "_count": {
      "babies": 1,
      "feedingRecords": 42,
      "healthRecords": 15
    }
  }
]
```

##### PUT /api/admin/users — 修改用户角色

```bash
curl -X PUT -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_id", "role": "ADMIN"}' \
  "https://your-domain/api/admin/users"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | ✅ | 用户 ID |
| `role` | string | ✅ | 角色，可选值：`USER`、`ADMIN` |

##### DELETE /api/admin/users — 删除用户

```bash
curl -X DELETE -H "Authorization: Bearer bfk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_id"}' \
  "https://your-domain/api/admin/users"
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | ✅ | 要删除的用户 ID（不能删除自己） |

---

### 错误响应格式

所有接口的错误响应统一为 JSON 格式：

```json
{
  "error": "错误描述信息"
}
```

常见 HTTP 状态码：

| 状态码 | 说明 |
|--------|------|
| `200` | 请求成功 |
| `201` | 创建成功 |
| `400` | 请求参数错误 |
| `401` | 未授权（未登录或 API Key 无效/过期） |
| `403` | 禁止访问（非管理员访问管理接口、注册功能已关闭等） |
| `404` | 资源不存在 |
| `429` | 请求过于频繁（触发速率限制） |
| `500` | 服务器内部错误 |

## ❓ 常见问题

### 1. 如何修改端口？

修改 `docker-compose.yml` 中的端口映射，同时更新 `.env` 中的 `NEXTAUTH_URL`：
```yaml
ports:
  - "8080:3000"
```

### 2. 忘记密码怎么办？

在设置页面可以修改密码（需验证旧密码）。如果完全忘记密码，需要直接操作数据库重置。

### 3. 数据存储在哪里？

- **Docker 部署**：数据存储在宿主机 `./data` 目录（或 `DATA_PATH` 指定的路径）
- **本地开发**：数据存储在项目根目录 `dev.db` 文件中

### 4. 如何查看容器日志？

```bash
docker-compose logs -f
```

### 5. 如何重启服务？

```bash
docker-compose restart
```

### 6. 支持哪些浏览器？

支持所有现代浏览器（Chrome、Firefox、Edge、Safari），推荐使用 Chrome/Edge 以获得完整的 PWA 体验。

## 📝 开发计划

- [ ] 数据导出功能（CSV/Excel）
- [ ] 消息推送提醒
- [ ] 多语言支持
- [ ] 数据同步功能
- [ ] 成长曲线对比（WHO 标准）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
