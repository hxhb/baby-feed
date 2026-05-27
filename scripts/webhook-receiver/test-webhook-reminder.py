#!/usr/bin/env python3
"""
Webhook 提醒通知功能验证脚本

用法:
    python scripts/test-webhook-reminder.py <BASE_URL> <API_KEY> <WEBHOOK_RECEIVER_URL>

示例:
    python scripts/test-webhook-reminder.py http://localhost:3000 bfk_xxx http://example.com/webhook

此脚本会:
  1. 创建一个 webhook endpoint 指向你的接收地址，订阅 reminder.fired 事件
  2. 创建一个"每日定时"提醒规则（设为当前北京时间 +2 分钟触发）
  3. 输出预计触发时间，等待你在接收端确认收到通知
  4. 清理：删除提醒规则和 webhook endpoint
"""

import sys
import json
import time
import requests
from datetime import datetime, timezone, timedelta

BEIJING_TZ = timezone(timedelta(hours=8))


def main():
    if len(sys.argv) < 4:
        print("用法: python scripts/test-webhook-reminder.py <BASE_URL> <API_KEY> <WEBHOOK_RECEIVER_URL>")
        print("示例: python scripts/test-webhook-reminder.py http://localhost:3000 bfk_xxx http://example.com/hook")
        sys.exit(1)

    base_url = sys.argv[1].rstrip("/")
    api_key = sys.argv[2]
    receiver_url = sys.argv[3]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    webhook_id = None
    reminder_id = None

    def api(method, path, body=None):
        url = f"{base_url}{path}"
        resp = requests.request(method, url, headers=headers, json=body, timeout=10)
        data = resp.json() if resp.content else None
        if not resp.ok:
            raise Exception(f"{method} {path} → {resp.status_code}: {json.dumps(data, ensure_ascii=False)}")
        return data

    try:
        # 1. 获取宝宝列表
        print("\n🔍 获取宝宝列表...")
        babies = api("GET", "/api/babies")
        if not babies:
            raise Exception("没有找到宝宝，请先创建一个宝宝记录")
        baby = babies[0]
        print(f"   找到宝宝: {baby['name']} ({baby['id']})")

        # 2. 创建 webhook endpoint
        print(f"\n🔗 创建 Webhook Endpoint...")
        print(f"   接收地址: {receiver_url}")
        print(f"   订阅事件: reminder.fired")
        webhook = api("POST", "/api/webhooks", {
            "url": receiver_url,
            "description": "提醒通知测试 (自动创建，稍后删除)",
            "events": ["reminder.fired"],
        })
        webhook_id = webhook["id"]
        print(f"   ✅ 已创建: {webhook_id}")
        if webhook.get("secret"):
            print(f"   🔑 签名密钥: {webhook['secret']}")

        # 3. 创建定时提醒规则 (2分钟后触发)
        now_bj = datetime.now(BEIJING_TZ)
        target = now_bj + timedelta(minutes=2)
        cron_expr = f"{target.minute} {target.hour} * * *"

        print(f"\n⏰ 创建定时提醒规则...")
        print(f"   Cron: \"{cron_expr}\"")
        print(f"   预计触发: {target.strftime('%H:%M')} (北京时间)")

        reminder = api("POST", "/api/reminders", {
            "name": "Webhook 通知测试",
            "babyId": baby["id"],
            "triggerType": "cron",
            "triggerConfig": {"cronExpr": cron_expr},
            "activeSchedule": None,
            "advanceMinutes": 0,
            "notifyTitle": "测试通知 · {{babyName}}",
            "notifyBody": "这是一条验证 Webhook 提醒通知功能的测试消息",
        })
        reminder_id = reminder["id"]
        print(f"   ✅ 已创建: {reminder_id}")

        # 4. 等待用户确认
        print(f"\n{'─' * 50}")
        print(f"📮 请在接收端等待 Webhook 回调通知")
        print(f"   预计时间: {target.strftime('%Y-%m-%d %H:%M')} (北京时间)")
        print(f"   接收地址: {receiver_url}")
        print(f"{'─' * 50}")
        print(f"\n   提醒调度器每分钟检查一次，请耐心等待约 2 分钟。")
        print(f"   收到通知后，按 Enter 继续清理测试数据...")

        try:
            input()
        except (EOFError, KeyboardInterrupt):
            print()

        # 5. 查看执行日志确认
        print("\n📋 检查执行日志...")
        logs = api("GET", "/api/reminders/logs?limit=5")
        if logs and logs.get("logs"):
            for log in logs["logs"][:3]:
                status_icon = "✅" if log["status"] == "success" else "❌"
                print(f"   {status_icon} {log['summary']}")
        else:
            print("   (暂无日志，可能尚未触发)")

    finally:
        # 6. 清理
        print("\n🧹 清理测试数据...")

        if reminder_id:
            try:
                api("DELETE", f"/api/reminders/{reminder_id}")
                print(f"   ✅ 已删除提醒规则: {reminder_id}")
            except Exception as e:
                print(f"   ⚠️  删除提醒失败: {e}")

        if webhook_id:
            try:
                api("DELETE", f"/api/webhooks/{webhook_id}")
                print(f"   ✅ 已删除 Webhook: {webhook_id}")
            except Exception as e:
                print(f"   ⚠️  删除 Webhook 失败: {e}")

        print("\n✨ 测试完成\n")


if __name__ == "__main__":
    main()
