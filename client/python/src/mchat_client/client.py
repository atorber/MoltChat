"""
MChat Python 客户端：MQTT 连接、请求-响应、收件箱/群订阅与事件
"""

import json
import random
import string
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import paho.mqtt.client as mqtt

REQ_PREFIX = "mchat/msg/req/"
RESP_PREFIX = "mchat/msg/resp/"
INBOX_PREFIX = "mchat/inbox/"
GROUP_PREFIX = "mchat/group/"
STATUS_PREFIX = "mchat/status/"


def _gen_seq_id() -> str:
    return "seq_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=10)) + "_" + str(int(time.time() * 1000))


def _gen_client_id(employee_id: str, device_id: Optional[str] = None) -> str:
    dev = device_id or "py"
    uid = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{employee_id}_{dev}_{uid}"


class MChatClient:
    """MChat 客户端，与《消息交互接口与示例》一致。"""

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        username: str,
        password: str,
        employee_id: str,
        use_tls: bool = False,
        client_id: Optional[str] = None,
        device_id: Optional[str] = None,
        request_timeout_ms: int = 30000,
        skip_auth_bind: bool = False,
    ):
        self._broker_host = broker_host
        self._broker_port = broker_port
        self._use_tls = use_tls
        self._username = username
        self._password = password
        self._employee_id = employee_id
        self._client_id = (client_id or "").strip() or _gen_client_id(employee_id, device_id)
        self._request_timeout_ms = request_timeout_ms
        self._skip_auth_bind = skip_auth_bind

        self._client: Optional[mqtt.Client] = None
        self._pending: Dict[str, Dict[str, Any]] = {}
        self._pending_lock = threading.Lock()
        self._connect_event = threading.Event()
        self._connect_error: Optional[Exception] = None

        self._listeners: Dict[str, List[Callable[..., None]]] = {
            "inbox": [],
            "group": [],
            "connect": [],
            "offline": [],
            "error": [],
        }

    @property
    def connected(self) -> bool:
        return self._client is not None and self._client.is_connected()

    def get_client_id(self) -> str:
        return self._client_id

    def connect(self) -> None:
        """连接 Broker，订阅 resp/inbox，可选 auth.bind，发布 online。"""
        self._connect_event.clear()
        self._connect_error = None

        try:
            client = mqtt.Client(
                callback_api_version=getattr(mqtt.CallbackAPIVersion, "VERSION1", None) or mqtt.CallbackAPIVersion.VERSION1,
                client_id=self._client_id,
                protocol=mqtt.MQTTv311,
            )
            client.username_pw_set(self._username, self._password)

            will_payload = json.dumps({"status": "offline", "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())})
            client.will_set(
                f"{STATUS_PREFIX}{self._employee_id}",
                will_payload,
                qos=1,
                retain=True,
            )

            client.on_connect = self._on_connect
            client.on_message = self._on_message
            client.on_disconnect = self._on_disconnect
            if hasattr(client, "on_connect_fail"):
                client.on_connect_fail = self._on_connect_fail

            if self._use_tls:
                client.tls_set()

            client.connect(self._broker_host, self._broker_port, 60)
            self._client = client
            client.loop_start()

            if not self._connect_event.wait(timeout=15):
                raise TimeoutError("Connection timeout")
            if self._connect_error:
                raise self._connect_error

        except Exception:
            self._client = None
            raise

    def _on_connect(self, client: mqtt.Client, userdata: Any, flags: Any, rc: int) -> None:
        if rc != 0:
            self._connect_error = ConnectionError(f"Connect failed: {rc}")
            self._connect_event.set()
            return
        try:
            client.subscribe(f"{RESP_PREFIX}{self._client_id}/+", qos=1)
            client.subscribe(f"{INBOX_PREFIX}{self._employee_id}", qos=1)
            online_payload = json.dumps({"status": "online", "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())})
            client.publish(f"{STATUS_PREFIX}{self._employee_id}", online_payload, qos=1, retain=True)
            if not self._skip_auth_bind:
                try:
                    r = self._request_impl(client, "auth.bind", {"employee_id": self._employee_id})
                    if r.get("code") != 0:
                        print(f"[mchat] auth.bind failed: {r.get('message')}")
                except Exception as e:
                    print(f"[mchat] auth.bind error: {e}")
            for fn in self._listeners["connect"]:
                try:
                    fn()
                except Exception:
                    pass
        except Exception as e:
            self._connect_error = e
        finally:
            self._connect_event.set()

    def _on_message(self, client: mqtt.Client, userdata: Any, msg: Any) -> None:
        topic = msg.topic
        try:
            payload_str = msg.payload.decode("utf-8") if isinstance(msg.payload, bytes) else msg.payload
        except Exception:
            return
        if topic.startswith(RESP_PREFIX + self._client_id + "/"):
            seq_id = topic[len(RESP_PREFIX + self._client_id + "/") :]
            with self._pending_lock:
                p = self._pending.pop(seq_id, None)
            if p:
                try:
                    body = json.loads(payload_str)
                    p["event"].set()
                    p["result"] = body
                except Exception:
                    p["event"].set()
                    p["error"] = ValueError("Invalid response JSON")
            return
        if topic == f"{INBOX_PREFIX}{self._employee_id}":
            try:
                body = json.loads(payload_str)
                for fn in self._listeners["inbox"]:
                    try:
                        fn(body)
                    except Exception:
                        pass
            except Exception:
                pass
            return
        if topic.startswith(GROUP_PREFIX):
            group_id = topic[len(GROUP_PREFIX) :]
            try:
                body = json.loads(payload_str)
                for fn in self._listeners["group"]:
                    try:
                        fn(group_id, body)
                    except Exception:
                        pass
            except Exception:
                pass

    def _on_disconnect(self, client: mqtt.Client, userdata: Any, rc: int) -> None:
        for fn in self._listeners["offline"]:
            try:
                fn()
            except Exception:
                pass

    def _on_connect_fail(self, client: mqtt.Client, userdata: Any) -> None:
        self._connect_error = ConnectionError("Connect failed")
        self._connect_event.set()

    def _request_impl(self, client: mqtt.Client, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        seq_id = _gen_seq_id()
        topic = f"{REQ_PREFIX}{self._client_id}/{seq_id}"
        payload = json.dumps({"action": action, **params})
        event = threading.Event()
        with self._pending_lock:
            self._pending[seq_id] = {"event": event, "result": None, "error": None}
        client.publish(topic, payload, qos=1)
        timeout_s = self._request_timeout_ms / 1000.0
        if not event.wait(timeout=timeout_s):
            with self._pending_lock:
                self._pending.pop(seq_id, None)
            raise TimeoutError("Request timeout")
        with self._pending_lock:
            p = self._pending.get(seq_id)
        if p and p.get("error"):
            raise p["error"]
        if p and p.get("result") is not None:
            return p["result"]
        raise RuntimeError("No response")

    def request(self, action: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """发起一次请求，成功时返回 data 在其中的响应体；code!=0 或异常时抛错。"""
        if not self._client or not self._client.is_connected():
            raise RuntimeError("Not connected")
        params = params or {}
        r = self._request_impl(self._client, action, params)
        if r.get("code") != 0:
            raise RuntimeError(r.get("message") or f"code {r.get('code')}")
        return r

    def subscribe_group(self, group_id: str) -> None:
        """订阅群消息。"""
        if not self._client or not self._client.is_connected():
            raise RuntimeError("Not connected")
        self._client.subscribe(f"{GROUP_PREFIX}{group_id}", qos=1)

    def unsubscribe_group(self, group_id: str) -> None:
        """取消订阅群。"""
        if self._client:
            self._client.unsubscribe(f"{GROUP_PREFIX}{group_id}")

    def on(self, event: str, fn: Callable[..., None]) -> None:
        """注册事件：inbox, group, connect, offline, error。"""
        if event in self._listeners:
            self._listeners[event].append(fn)

    def disconnect(self) -> None:
        """断开连接。"""
        if self._client:
            with self._pending_lock:
                for p in self._pending.values():
                    p["event"].set()
                    p["error"] = RuntimeError("Disconnected")
                self._pending.clear()
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None
