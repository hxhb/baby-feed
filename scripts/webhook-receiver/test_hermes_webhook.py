#!/usr/bin/env python3
"""
Hermes Webhook 验证脚本
======================
模拟 baby-feed 发送 webhook 到 Hermes，验证配置是否正常工作。

用法:
  python test_hermes_webhook.py --url https://hermes-webhook.yourdomain.com/webhooks/baby-feed --secret YOUR_WEBHOOK_SECRET

参数:
  --url      Hermes webhook 完整地址
  --secret   Webhook 签名密钥（创建 webhook 时返回的 secret）
  --event    要测试的事件类型 (默认 feeding.created)
             可选: feeding.created, feeding.updated, feeding.deleted,
                   health.created, health.updated, health.deleted,
                   memo.created, memo.updated, memo.deleted
  --all      测试所有事件类型
  --no-sign  跳过签名（测试 Hermes 是否拒绝无签名请求）
"""

import argparse
import hashlib
import hmac
import json
import sys
import uuid
from datetime import datetime, timezone, timedelta

try:
    import requests
except ImportError:
    print("需要安装 requests: pip install requests")
    sys.exit(1)


# ===========================================================================
# 测试 Payload 模板
# ===========================================================================

def now_iso():
    return datetime.now(timezone(timedelta(hours=8))).isoformat()


def make_event_id():
    return f"evt_test_{uuid.uuid4().hex[:12]}"


def make_record_id():
    return f"c{''.join(uuid.uuid4().hex[:24])}"


BABY_INFO = {
    "id": make_record_id(),
    "name": "测试宝宝",
    "birthDate": "2024-06-15T00:00:00.000Z",
    "gender": "MALE",
}

PAYLOADS = {
    "feeding.created": {
        "id": make_event_id(),
        "type": "feeding.created",
        "timestamp": now_iso(),
        "userId": "test_user_002",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "BREAST_MILK",
            "leftBreastDuration": 11,
            "rightBreastDuration": 10,
            "breastMilkAmount": None,
            "formulaAmount": None,
            "startTime": (datetime.now(timezone(timedelta(hours=8))) - timedelta(minutes=22)).isoformat(),
            "endTime": now_iso(),
            "notes": "宝宝吃得很好",
            "createdAt": now_iso(),
            "baby": BABY_INFO,
        },
    },
    "feeding.updated": {
        "id": make_event_id(),
        "type": "feeding.updated",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "BREAST_MILK",
            "changes": {
                "rightBreastDuration": {"old": 10, "new": 15},
                "notes": {"old": "宝宝吃得很好", "new": "宝宝吃得很好，右侧多吃了5分钟"},
            },
            "leftBreastDuration": 12,
            "rightBreastDuration": 15,
            "startTime": (datetime.now(timezone(timedelta(hours=8))) - timedelta(minutes=27)).isoformat(),
            "endTime": now_iso(),
            "notes": "宝宝吃得很好，右侧多吃了5分钟",
            "updatedAt": now_iso(),
            "baby": {"id": BABY_INFO["id"], "name": BABY_INFO["name"]},
        },
    },
    "feeding.deleted": {
        "id": make_event_id(),
        "type": "feeding.deleted",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "FORMULA",
            "startTime": (datetime.now(timezone(timedelta(hours=8))) - timedelta(hours=2)).isoformat(),
            "endTime": (datetime.now(timezone(timedelta(hours=8))) - timedelta(hours=1, minutes=45)).isoformat(),
            "deletedAt": now_iso(),
        },
    },
    "health.created": {
        "id": make_event_id(),
        "type": "health.created",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "WEIGHT",
            "weight": 7.8,
            "height": None,
            "temperature": None,
            "recordedAt": now_iso(),
            "notes": "体重增长正常",
            "createdAt": now_iso(),
            "baby": BABY_INFO,
        },
    },
    "health.updated": {
        "id": make_event_id(),
        "type": "health.updated",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "WEIGHT",
            "changes": {
                "weight": {"old": 7.8, "new": 7.9},
            },
            "weight": 7.9,
            "recordedAt": now_iso(),
            "notes": "修正体重读数",
            "updatedAt": now_iso(),
            "baby": {"id": BABY_INFO["id"], "name": BABY_INFO["name"]},
        },
    },
    "health.deleted": {
        "id": make_event_id(),
        "type": "health.deleted",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "type": "TEMPERATURE",
            "recordedAt": (datetime.now(timezone(timedelta(hours=8))) - timedelta(days=1)).isoformat(),
            "deletedAt": now_iso(),
        },
    },
    "memo.created": {
        "id": make_event_id(),
        "type": "memo.created",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "title": "接种乙肝疫苗第三针",
            "content": "带上疫苗接种本，提前预约社区医院",
            "scheduledAt": (datetime.now(timezone(timedelta(hours=8))) + timedelta(days=3)).isoformat(),
            "completed": False,
            "createdAt": now_iso(),
            "baby": {"id": BABY_INFO["id"], "name": BABY_INFO["name"]},
        },
    },
    "memo.updated": {
        "id": make_event_id(),
        "type": "memo.updated",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "title": "接种乙肝疫苗第三针",
            "content": "已完成接种，无不良反应",
            "scheduledAt": now_iso(),
            "completed": True,
            "completedAt": now_iso(),
            "changes": {
                "completed": {"old": False, "new": True},
                "content": {"old": "带上疫苗接种本", "new": "已完成接种，无不良反应"},
            },
            "updatedAt": now_iso(),
            "baby": {"id": BABY_INFO["id"], "name": BABY_INFO["name"]},
        },
    },
    "memo.deleted": {
        "id": make_event_id(),
        "type": "memo.deleted",
        "timestamp": now_iso(),
        "userId": "test_user_001",
        "data": {
            "recordId": make_record_id(),
            "babyId": BABY_INFO["id"],
            "title": "已过期的提醒",
            "deletedAt": now_iso(),
        },
    },
}


# ===========================================================================
# 签名与发送
# ===========================================================================

def sign_payload(payload_bytes: bytes, secret: str) -> str:
    """HMAC-SHA256 签名"""
    return hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()


def send_webhook(url: str, payload: dict, secret: str | None, event_type: str) -> dict:
    """发送 Webhook 请求"""
    payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event-Type": event_type,
        "X-Webhook-Event-ID": payload.get("id", ""),
        "X-Webhook-Delivery-ID": f"del_test_{uuid.uuid4().hex[:12]}",
        "X-Webhook-Timestamp": payload.get("timestamp", now_iso()),
    }

    if secret:
        headers["X-Webhook-Signature"] = sign_payload(payload_bytes, secret)

    try:
        resp = requests.post(url, data=payload_bytes, headers=headers, timeout=30)
        return {
            "status_code": resp.status_code,
            "body": resp.text[:500],
            "headers": dict(resp.headers),
        }
    except requests.exceptions.ConnectionError as e:
        return {"error": f"连接失败: {e}"}
    except requests.exceptions.Timeout:
        return {"error": "请求超时 (30s)"}
    except Exception as e:
        return {"error": f"未知错误: {e}"}


# ===========================================================================
# 主程序
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(description="测试 Hermes Webhook 配置")
    parser.add_argument("--url", required=True, help="Hermes webhook 完整 URL")
    parser.add_argument("--secret", default="", help="Webhook 签名密钥")
    parser.add_argument("--event", default="feeding.created",
                        choices=list(PAYLOADS.keys()),
                        help="要测试的事件类型")
    parser.add_argument("--all", action="store_true", help="测试所有事件类型")
    parser.add_argument("--no-sign", action="store_true", help="不附加签名（测试拒绝）")
    args = parser.parse_args()

    events_to_test = list(PAYLOADS.keys()) if args.all else [args.event]
    secret = None if args.no_sign else args.secret

    print("=" * 60)
    print("Hermes Webhook 验证工具")
    print("=" * 60)
    print(f"目标地址: {args.url}")
    print(f"签名验证: {'❌ 跳过' if args.no_sign else ('✅ 已配置' if secret else '⚠️ 未提供 secret')}")
    print(f"测试事件: {', '.join(events_to_test)}")
    print("=" * 60)

    results = []

    for event_type in events_to_test:
        print(f"\n▶ 发送 {event_type} ...")
        payload = PAYLOADS[event_type]
        result = send_webhook(args.url, payload, secret, event_type)

        if "error" in result:
            status = "❌ 失败"
            detail = result["error"]
        elif result["status_code"] in (200, 202):
            status = "✅ 成功"
            detail = result["body"][:200]
        elif result["status_code"] == 401:
            status = "🔒 签名验证失败"
            detail = "Hermes 拒绝了请求（签名不匹配或未提供）"
        elif result["status_code"] == 429:
            status = "⚡ 被限流"
            detail = "请求过于频繁"
        else:
            status = f"⚠️ HTTP {result['status_code']}"
            detail = result["body"][:200]

        print(f"  {status}")
        print(f"  响应: {detail}")
        results.append({"event": event_type, "status": status})

    # 汇总
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    for r in results:
        print(f"  {r['status']}  {r['event']}")

    success_count = sum(1 for r in results if "✅" in r["status"])
    print(f"\n通过: {success_count}/{len(results)}")

    if success_count == len(results):
        print("\n🎉 所有测试通过！Hermes webhook 配置正常。")
        print("   接下来请检查你的 IM（QQ Bot）是否收到了 AI 分析消息。")
    elif any("🔒" in r["status"] for r in results):
        print("\n💡 提示: 签名验证失败，请检查:")
        print("   1. --secret 参数是否与 Hermes 配置中的 secret 一致")
        print("   2. baby-feed 创建 webhook 时返回的 secret 是否正确填入")
    elif any("❌" in r["status"] for r in results):
        print("\n💡 提示: 连接失败，请检查:")
        print("   1. Hermes gateway 是否正在运行 (hermes gateway status)")
        print("   2. URL 是否正确（端口、路径）")
        print("   3. 防火墙/NPM 是否放行了该端口")


if __name__ == "__main__":
    main()
