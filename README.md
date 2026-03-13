# 🍼 Baby Feed - 新生儿喂养记录系统

一个简洁易用的新生儿喂养记录 Web 应用，支持 PWA 离线访问和 Docker 自部署。

## ✨ 功能特性

### 📋 喂养记录
- **母乳亲喂**：记录左右乳房喂养时长
- **母乳瓶喂**：记录瓶喂毫升数
- **奶粉喂养**：记录奶粉喂养量和时间
- **AD 滴剂**：记录每日 AD 服用情况

### 🏥 健康记录
- **体重记录**：随时记录宝宝体重变化
- **身高记录**：记录宝宝身高
- **体温记录**：记录宝宝体温
- **用药记录**：记录药物名称和剂量
- **疫苗记录**：记录疫苗接种情况
- **大小便记录**：记录小便/大便情况

### 📊 数据展示
- **首页仪表盘**：今日概览、快捷记录入口
- **时间轴视图**：按日期平铺展示所有记录
- **统计图表**：喂养趋势、体重/体温变化曲线（基于 Recharts）
- **AD 日历**：直观展示 AD 服用情况

### 👤 账户管理
- **用户注册/登录**：邮箱 + 密码认证
- **修改用户名**：随时更新个人昵称
- **修改密码**：验证旧密码 + 新密码强度校验（≥8位，含字母+数字）
- **退出登录**：一键安全退出
- **注销账户**：双重确认（密码 + 文本确认），永久删除账户及所有关联数据

### 🎯 其他特性
- 多用户账号系统
- 支持多宝宝管理（增删改）
- 移动端响应式设计
- **PWA 支持**：可安装到手机桌面，支持离线访问
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
│   │   ├── auth/               # 认证（NextAuth + 注册 + 会话）
│   │   ├── babies/             # 宝宝管理 CRUD
│   │   ├── feeding/            # 喂养记录 CRUD
│   │   ├── health/             # 健康记录 CRUD
│   │   ├── stats/              # 统计数据（总览 + 按日）
│   │   └── user/               # 用户管理（资料/密码/注销）
│   └── generated/prisma/       # Prisma 自动生成的客户端代码
├── components/                 # React 组件
│   ├── Dashboard.tsx           # 首页仪表盘
│   ├── FeedingForm.tsx         # 喂养记录表单
│   ├── HealthForm.tsx          # 健康记录表单
│   ├── Navbar.tsx              # 响应式导航栏
│   ├── Providers.tsx           # NextAuth SessionProvider 封装
│   ├── Settings.tsx            # 设置组件（账户管理 + 宝宝管理）
│   ├── Stats.tsx               # 统计图表组件
│   └── Timeline.tsx            # 时间轴组件
├── lib/                        # 工具库
│   ├── prisma.ts               # Prisma 客户端实例
│   └── auth.ts                 # NextAuth 认证配置
├── prisma/                     # 数据库配置
│   ├── schema.prisma           # 数据库模型定义
│   └── migrations/             # 数据库迁移文件
├── scripts/
│   └── migrate.mjs             # 轻量级迁移脚本（无需 Prisma CLI）
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

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 认证入口 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/session` | GET | 获取当前会话 |
| `/api/user/profile` | GET/PUT | 获取/修改用户资料 |
| `/api/user/password` | PUT | 修改密码 |
| `/api/user/delete` | DELETE | 注销账户 |
| `/api/babies` | GET/POST | 宝宝列表/添加宝宝 |
| `/api/babies/[id]` | PUT/DELETE | 修改/删除宝宝 |
| `/api/feeding` | GET/POST | 喂养记录列表/添加记录 |
| `/api/feeding/[id]` | PUT/DELETE | 修改/删除喂养记录 |
| `/api/health` | GET/POST | 健康记录列表/添加记录 |
| `/api/health/[id]` | PUT/DELETE | 修改/删除健康记录 |
| `/api/stats` | GET | 统计数据总览 |
| `/api/stats/day` | GET | 按日统计数据 |

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
