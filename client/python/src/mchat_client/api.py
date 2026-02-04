"""
便捷 API：基于 request 封装的常用方法
"""

from typing import Any, Dict, Optional, Union

from mchat_client.client import MChatClient


def send_private_message(
    client: MChatClient,
    to_employee_id: str,
    content: Union[str, Dict[str, Any]],
    quote_msg_id: Optional[str] = None,
) -> Dict[str, Any]:
    """发送私聊消息。"""
    params: Dict[str, Any] = {"to_employee_id": to_employee_id, "content": content}
    if quote_msg_id is not None:
        params["quote_msg_id"] = quote_msg_id
    return client.request("msg.send_private", params)


def send_group_message(
    client: MChatClient,
    group_id: str,
    content: Union[str, Dict[str, Any]],
    quote_msg_id: Optional[str] = None,
) -> Dict[str, Any]:
    """发送群消息。"""
    params: Dict[str, Any] = {"group_id": group_id, "content": content}
    if quote_msg_id is not None:
        params["quote_msg_id"] = quote_msg_id
    return client.request("msg.send_group", params)


def get_org_tree(client: MChatClient) -> Dict[str, Any]:
    """获取组织架构（部门、员工）。"""
    return client.request("org.tree")


def get_storage_config(client: MChatClient) -> Dict[str, Any]:
    """获取存储配置。"""
    return client.request("config.storage")


def get_agent_capability_list(
    client: MChatClient,
    skill: Optional[str] = None,
) -> Dict[str, Any]:
    """获取 Agent 能力列表。"""
    params: Dict[str, Any] = {}
    if skill is not None:
        params["skill"] = skill
    return client.request("agent.capability_list", params)
