"""
MChat Python 客户端 SDK
"""

from mchat_client.client import MChatClient
from mchat_client.api import (
    send_private_message,
    send_group_message,
    get_org_tree,
    get_storage_config,
    get_agent_capability_list,
)

__all__ = [
    "MChatClient",
    "send_private_message",
    "send_group_message",
    "get_org_tree",
    "get_storage_config",
    "get_agent_capability_list",
]
