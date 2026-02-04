#!/usr/bin/env python3
"""
MChat Python SDK 示例

使用前：
1. 在 client/python 下安装：pip install -e .
2. 设置环境变量后执行：python main.py 或 python -m example.main

环境变量（必填）：
  MCHAT_BROKER_HOST   Broker 主机
  MCHAT_BROKER_PORT   Broker 端口（如 1883）
  MCHAT_USERNAME      MQTT 用户名（如 employee_id）
  MCHAT_PASSWORD      MQTT 密码
  MCHAT_EMPLOYEE_ID   员工 ID（与 auth.bind 一致，通常同 username）

可选：
  MCHAT_USE_TLS       为 1 时使用 TLS
  MCHAT_SEND_TO       若设置，连接后会向该 employee_id 发一条测试消息
"""

import os
import signal
import sys

from mchat_client import (
    MChatClient,
    get_agent_capability_list,
    get_org_tree,
    send_private_message,
)


def main() -> None:
    host = os.environ.get("MCHAT_BROKER_HOST", "localhost")
    port = int(os.environ.get("MCHAT_BROKER_PORT", "1883"), 10)
    use_tls = os.environ.get("MCHAT_USE_TLS") == "1"
    username = os.environ.get("MCHAT_USERNAME")
    password = os.environ.get("MCHAT_PASSWORD")
    employee_id = os.environ.get("MCHAT_EMPLOYEE_ID") or username
    send_to = os.environ.get("MCHAT_SEND_TO")

    if not username or not password:
        print("请设置 MCHAT_USERNAME 和 MCHAT_PASSWORD", file=sys.stderr)
        sys.exit(1)

    client = MChatClient(
        broker_host=host,
        broker_port=port,
        use_tls=use_tls,
        username=username,
        password=password,
        employee_id=employee_id,
        request_timeout_ms=15000,
    )

    client.on("connect", lambda: print("[example] 已连接"))
    client.on("offline", lambda: print("[example] 已断开"))
    client.on("error", lambda err: print("[example] 错误:", err, file=sys.stderr))
    client.on("inbox", lambda payload: print("[example] 收件箱消息:", payload))
    client.on("group", lambda group_id, payload: print("[example] 群消息", group_id, payload))

    try:
        client.connect()
        print("[example] client_id:", client.get_client_id())

        tree = get_org_tree(client)
        data = tree.get("data") or {}
        deps = data.get("departments") or []
        emps = data.get("employees") or []
        print("[example] 组织架构 - 部门数:", len(deps), "员工数:", len(emps))

        agents = get_agent_capability_list(client)
        agent_data = agents.get("data") or {}
        agent_ids = agent_data.get("agent_ids") or []
        if agent_ids:
            print("[example] Agent 列表:", agent_ids)

        if send_to:
            send_private_message(client, send_to, "来自 Python 示例的测试消息")
            print("[example] 已向", send_to, "发送测试消息")

        print("[example] 运行中，收件箱/群消息将打印在上方。按 Ctrl+C 退出。")

        # 保持运行
        try:
            signal.pause()
        except AttributeError:
            import time
            while True:
                time.sleep(3600)
    except Exception as e:
        print("[example] 失败:", e, file=sys.stderr)
        sys.exit(1)
    finally:
        print("\n[example] 正在断开...")
        client.disconnect()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
