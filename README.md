# Baby Feed - 新生儿喂养记录系统

一个简洁易用的新生儿喂养记录 Web 应用，支持 Docker 自部署。

## 功能特性

### 喂养记录
- **母乳喂养**：支持亲喂（记录左右乳房喂养时长）和瓶喂（记录毫升数）
- **奶粉喂养**：记录奶粉喂养量和时间
- **AD滴剂**：记录每日 AD 服用情况

### 健康记录
- **体重记录**：随时记录宝宝体重变化
- **身高记录**：记录宝宝身高
- **体温记录**：记录宝宝体温
- **用药记录**：记录药物名称和剂量
- **疫苗记录**：记录疫苗接种情况
- **大小便记录**：记录小便/大便情况

### 数据展示
- **首页仪表盘**：今日概览、快捷记录入口
- **时间轴视图**：按日期平铺展示所有记录
- **统计图表**：喂养趋势、体重/体温变化曲线
- **AD日历**：直观展示 AD 服用情况

### 其他特性
- 多用户账号系统
- 支持多宝宝管理
- 移动端响应式设计
- Docker 一键部署
- 数据本地持久化

## 技术栈

- **前端框架**：Next.js 15 (App Router)
- **开发语言**：TypeScript
- **样式方案**：Tailwind CSS
- **数据库**：SQLite + Prisma ORM
- **认证系统**：NextAuth.js
- **图表库**：Recharts
- **部署方案**：Docker + Docker Compose

## Docker 部署指南

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

#### 4. 启动服务

```bash
docker-compose up -d
```

#### 5. 访问应用

打开浏览器访问 `http://localhost:3000`

#### 6. 停止服务

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

如果使用 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name baby.yourdomain.com;

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

#### HTTPS 配置

建议使用 HTTPS，可以使用 Let's Encrypt + Certbot：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d baby.yourdomain.com
```

### 数据备份与恢复

#### 备份数据

```bash
# 导出数据
docker run --rm \
  -v baby-feed_baby-feed-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/baby-feed-backup.tar.gz -C /data .

# 或者直接复制数据库文件
docker cp baby-feed:/app/data/baby-feed.db ./backup/
```

#### 恢复数据

```bash
# 恢复数据
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

# 重新构建并启动
docker-compose up -d --build
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
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

## 项目结构

```
baby-feed/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关
│   │   ├── babies/        # 婴儿管理
│   │   ├── feeding/       # 喂养记录
│   │   ├── health/        # 健康记录
│   │   └── stats/         # 统计数据
│   ├── login/             # 登录页面
│   ├── register/          # 注册页面
│   ├── add/               # 添加记录页面
│   ├── timeline/          # 时间轴页面
│   ├── stats/             # 统计页面
│   └── settings/          # 设置页面
├── components/            # React 组件
│   ├── Navbar.tsx        # 导航栏
│   ├── Dashboard.tsx     # 首页仪表盘
│   ├── Timeline.tsx      # 时间轴组件
│   ├── Stats.tsx         # 统计组件
│   ├── Settings.tsx      # 设置组件
│   ├── FeedingForm.tsx   # 喂养记录表单
│   └── HealthForm.tsx    # 健康记录表单
├── lib/                   # 工具库
│   ├── prisma.ts         # Prisma 客户端
│   └── auth.ts           # 认证配置
├── prisma/               # 数据库配置
│   └── schema.prisma     # 数据库模型
├── types/                # TypeScript 类型定义
├── Dockerfile            # Docker 镜像配置
├── docker-compose.yml    # Docker Compose 配置
└── README.md             # 项目文档
```

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | SQLite 数据库路径 | `file:/app/data/baby-feed.db` |
| NEXTAUTH_SECRET | NextAuth 密钥 | 随机字符串（至少32位） |
| NEXTAUTH_URL | 应用访问地址 | `http://localhost:3000` |

## 常见问题

### 1. 如何修改端口？

修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "8080:3000"  # 将 3000 改为其他端口
```

### 2. 如何重置密码？

目前需要直接操作数据库，后续版本会添加密码重置功能。

### 3. 数据存储在哪里？

- Docker 部署：数据存储在 Docker Volume `baby-feed-data` 中
- 本地开发：数据存储在 `dev.db` 文件中

### 4. 如何查看日志？

```bash
docker-compose logs -f
```

### 5. 如何重启服务？

```bash
docker-compose restart
```

## 开发计划

- [ ] 密码重置功能
- [ ] 数据导出功能（CSV/Excel）
- [ ] 消息推送提醒
- [ ] 多语言支持
- [ ] PWA 支持
- [ ] 数据同步功能

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
