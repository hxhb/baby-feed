#!/usr/bin/env python3
"""
Baby Feed Webhook Receiver
==========================
接收 baby-feed 项目发送的所有 Webhook 事件，验证签名后持久化存储。

支持的事件类型:
  - feeding.created / feeding.updated / feeding.deleted
  - health.created / health.updated / health.deleted
  - memo.created / memo.updated / memo.deleted
  - user.deleted

用法:
  1. pip install -r requirements.txt
  2. 复制 .env.example 为 .env 并填写 WEBHOOK_SECRET
  3. python webhook_receiver.py

环境变量:
  WEBHOOK_SECRET  - Webhook 签名密钥 (创建 webhook 时返回的 secret)
  HOST            - 监听地址 (默认 0.0.0.0)
  PORT            - 监听端口 (默认 5000)
  DATA_DIR        - 事件存储目录 (默认 ./webhook_data)
"""

import hashlib
import hmac
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, request, jsonify
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

load_dotenv()

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5000"))
DATA_DIR = Path(os.getenv("DATA_DIR", "./webhook_data"))

# 创建数据存储目录
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(DATA_DIR / "webhook.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask 应用
# ---------------------------------------------------------------------------

app = Flask(__name__)


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """验证 HMAC-SHA256 签名"""
    if not secret:
        logger.warning("未配置 WEBHOOK_SECRET，跳过签名验证")
        return True

    if not signature:
        return False

    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


def save_event(event_type: str, event_data: dict) -> Path:
    """将事件保存到 JSON 文件，按日期和事件类型分类"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    event_dir = DATA_DIR / today / event_type.replace(".", "/")
    event_dir.mkdir(parents=True, exist_ok=True)

    event_id = event_data.get("id", "unknown")
    timestamp = datetime.now(timezone.utc).strftime("%H%M%S_%f")
    filename = f"{timestamp}_{event_id}.json"

    filepath = event_dir / filename
    filepath.write_text(
        json.dumps(event_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return filepath


def append_to_stream(event_type: str, event_data: dict):
    """追加到事件流文件 (JSONL 格式)，方便后续批量处理"""
    stream_file = DATA_DIR / "events.jsonl"
    record = {
        "received_at": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "payload": event_data,
    }
    with open(stream_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# 事件处理器
# ---------------------------------------------------------------------------

# 事件处理函数注册表 —— 可按需为不同事件类型添加自定义逻辑
EVENT_HANDLERS: dict[str, list] = {}


def on_event(event_type: str):
    """装饰器: 注册特定事件类型的处理函数"""
    def decorator(func):
        EVENT_HANDLERS.setdefault(event_type, []).append(func)
        return func
    return decorator


# ---- 示例处理器 (按需启用/修改) ----

@on_event("feeding.created")
def handle_feeding_created(data: dict):
    """处理新增喂养记录"""
    record = data.get("data", {})
    baby_name = record.get("baby", {}).get("name", "未知")
    feed_type = record.get("type", "未知")
    logger.info(f"🍼 新喂养记录: {baby_name} - {feed_type}")


@on_event("feeding.updated")
def handle_feeding_updated(data: dict):
    """处理更新喂养记录"""
    record = data.get("data", {})
    changes = record.get("changes", {})
    logger.info(f"📝 喂养记录更新: {record.get('recordId')} 变更字段: {list(changes.keys())}")


@on_event("feeding.deleted")
def handle_feeding_deleted(data: dict):
    """处理删除喂养记录"""
    record = data.get("data", {})
    logger.info(f"🗑️ 喂养记录删除: {record.get('recordId')}")


@on_event("health.created")
def handle_health_created(data: dict):
    """处理新增健康记录"""
    record = data.get("data", {})
    baby_name = record.get("baby", {}).get("name", "未知")
    health_type = record.get("type", "未知")
    logger.info(f"💊 新健康记录: {baby_name} - {health_type}")


@on_event("health.updated")
def handle_health_updated(data: dict):
    """处理更新健康记录"""
    record = data.get("data", {})
    logger.info(f"📝 健康记录更新: {record.get('recordId')}")


@on_event("health.deleted")
def handle_health_deleted(data: dict):
    """处理删除健康记录"""
    record = data.get("data", {})
    logger.info(f"🗑️ 健康记录删除: {record.get('recordId')}")


@on_event("memo.created")
def handle_memo_created(data: dict):
    """处理新增备忘录"""
    record = data.get("data", {})
    logger.info(f"📌 新备忘录: {record.get('title', '无标题')}")


@on_event("memo.updated")
def handle_memo_updated(data: dict):
    """处理更新备忘录"""
    record = data.get("data", {})
    logger.info(f"📝 备忘录更新: {record.get('recordId')}")


@on_event("memo.deleted")
def handle_memo_deleted(data: dict):
    """处理删除备忘录"""
    record = data.get("data", {})
    logger.info(f"🗑️ 备忘录删除: {record.get('recordId')}")


@on_event("user.deleted")
def handle_user_deleted(data: dict):
    """处理用户删除事件"""
    record = data.get("data", {})
    logger.info(f"👤 用户删除: {record.get('email')} (记录数: 喂养{record.get('feedingRecordsCount', 0)}, 健康{record.get('healthRecordsCount', 0)})")


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------

@app.route("/webhook", methods=["POST"])
def webhook_handler():
    """主 Webhook 接收端点"""
    # 读取原始请求体 (签名验证需要原始 bytes)
    payload = request.get_data()

    # 提取 Headers
    signature = request.headers.get("X-Webhook-Signature", "")
    event_type = request.headers.get("X-Webhook-Event-Type", "unknown")
    event_id = request.headers.get("X-Webhook-Event-ID", "")
    delivery_id = request.headers.get("X-Webhook-Delivery-ID", "")
    timestamp = request.headers.get("X-Webhook-Timestamp", "")

    logger.info(
        f"收到 Webhook: type={event_type} event_id={event_id} "
        f"delivery_id={delivery_id} timestamp={timestamp}"
    )

    # 验证签名
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        logger.warning(f"签名验证失败! event_id={event_id}")
        return jsonify({"error": "Invalid signature"}), 401

    # 解析 JSON
    try:
        event_data = json.loads(payload)
    except json.JSONDecodeError as e:
        logger.error(f"JSON 解析失败: {e}")
        return jsonify({"error": "Invalid JSON"}), 400

    # 持久化存储
    filepath = save_event(event_type, event_data)
    append_to_stream(event_type, event_data)
    logger.info(f"事件已保存: {filepath}")

    # 调用注册的事件处理器
    handlers = EVENT_HANDLERS.get(event_type, [])
    # 同时查找通配符处理器
    handlers += EVENT_HANDLERS.get("*", [])

    for handler in handlers:
        try:
            handler(event_data)
        except Exception as e:
            logger.error(f"处理器 {handler.__name__} 执行失败: {e}")

    return jsonify({"status": "ok", "event_id": event_id}), 200


@app.route("/health", methods=["GET"])
def health_check():
    """健康检查端点"""
    event_count = 0
    stream_file = DATA_DIR / "events.jsonl"
    if stream_file.exists():
        with open(stream_file, "r") as f:
            event_count = sum(1 for _ in f)

    return jsonify({
        "status": "healthy",
        "events_received": event_count,
        "data_dir": str(DATA_DIR.resolve()),
        "signature_verification": "enabled" if WEBHOOK_SECRET else "disabled",
    })


@app.route("/events", methods=["GET"])
def list_events():
    """查看最近的事件 (最多 50 条)"""
    stream_file = DATA_DIR / "events.jsonl"
    if not stream_file.exists():
        return jsonify({"events": [], "total": 0})

    events = []
    with open(stream_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    # 返回最近 50 条，最新的在前
    limit = request.args.get("limit", 50, type=int)
    events = events[-limit:]
    events.reverse()

    return jsonify({"events": events, "total": len(events)})


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Baby Feed Webhook Receiver")
    logger.info("=" * 60)
    logger.info(f"监听地址: {HOST}:{PORT}")
    logger.info(f"Webhook 端点: http://{HOST}:{PORT}/webhook")
    logger.info(f"健康检查: http://{HOST}:{PORT}/health")
    logger.info(f"事件查询: http://{HOST}:{PORT}/events")
    logger.info(f"数据目录: {DATA_DIR.resolve()}")
    logger.info(f"签名验证: {'✅ 已启用' if WEBHOOK_SECRET else '⚠️ 未配置 (跳过验证)'}")
    logger.info("=" * 60)

    if not WEBHOOK_SECRET:
        logger.warning(
            "⚠️ 未设置 WEBHOOK_SECRET 环境变量! "
            "建议在 .env 文件中配置以启用签名验证。"
        )

    app.run(host=HOST, port=PORT, debug=False)
