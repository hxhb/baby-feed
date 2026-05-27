# Webhook Receiver

接收 baby-feed 项目所有 Webhook 事件的 Python 服务。

## 快速开始

```bash
cd scripts/webhook-receiver

# 安装依赖
pip install -r requirements.txt

# 配置
cp .env.example .env
# 编辑 .env，填入你的 WEBHOOK_SECRET

# 启动
python webhook_receiver.py
```

## 在 baby-feed 中注册 Webhook

通过 API 创建 Webhook 端点（订阅所有事件）：

```bash
curl -X POST https://your-baby-feed-app.com/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "url": "http://your-server:5000/webhook",
    "description": "Python 数据收集器",
    "events": ["*"],
    "maxRetries": 5,
    "retryDelay": 60
  }'
```

⚠️ **保存返回的 `secret` 字段**，填入 `.env` 的 `WEBHOOK_SECRET`。

## 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/webhook` | POST | Webhook 接收端点 |
| `/health` | GET | 健康检查 |
| `/events` | GET | 查看最近事件（支持 `?limit=N`）|

## 数据存储结构

```
webhook_data/
├── events.jsonl              # 所有事件的流式记录 (JSONL)
├── webhook.log               # 运行日志
└── 2024-01-15/               # 按日期分目录
    ├── feeding/
    │   ├── created/
    │   │   └── 123045_evt_abc.json
    │   ├── updated/
    │   └── deleted/
    ├── health/
    │   ├── created/
    │   ├── updated/
    │   └── deleted/
    └── memo/
        ├── created/
        ├── updated/
        └── deleted/
```

- **events.jsonl**: 所有事件按时间顺序追加，适合批量处理/导入
- **分目录 JSON**: 按日期+类型分类，方便按需查找单个事件

## 扩展处理逻辑

在 `webhook_receiver.py` 中使用 `@on_event` 装饰器注册自定义处理器：

```python
@on_event("feeding.created")
def my_custom_handler(data: dict):
    """你的自定义逻辑"""
    record = data["data"]
    # 例如: 发送通知、写入数据库、触发自动化...
    print(f"Baby {record['baby']['name']} 刚吃了奶!")
```

通配符 `"*"` 可匹配所有事件：

```python
@on_event("*")
def log_everything(data: dict):
    """记录所有事件到外部系统"""
    send_to_external_service(data)
```

## Docker 部署（可选）

```bash
docker run -d \
  --name webhook-receiver \
  -p 5000:5000 \
  -e WEBHOOK_SECRET=your_secret \
  -v $(pwd)/webhook_data:/app/webhook_data \
  python:3.12-slim \
  bash -c "pip install flask python-dotenv && python /app/webhook_receiver.py"
```

## 注意事项

- 确保 baby-feed 服务器能访问到此接收端点的地址
- 如果部署在内网，需要通过反向代理或端口转发暴露端点
- `WEBHOOK_SECRET` 为空时会跳过签名验证（仅用于测试）
