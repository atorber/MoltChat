package com.clawdbot.android.mchat

import android.util.Log
import com.clawdbot.android.chat.ChatMessage
import com.clawdbot.android.chat.ChatMessageContent
import com.clawdbot.android.chat.ChatSessionEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID

/**
 * MChat 聊天控制：会话=员工(employee_id)，发 msg.send_private，收件箱投递解析后按 from_employee_id 归入会话；员工列表来自 org.tree。
 * 支持历史消息缓存：切换回对话时显示本地缓存，收发消息时写入缓存。
 */
class MChatChatController(
  private val scope: CoroutineScope,
  private val connection: MChatConnection,
  private val historyCache: ChatHistoryCache? = null,
  initialMessagesByPeer: Map<String, List<ChatMessage>>? = null,
) {
  private val json = Json { ignoreUnknownKeys = true }

  private val _employees = MutableStateFlow<List<EmployeeEntry>>(emptyList())
  val employees: StateFlow<List<EmployeeEntry>> = _employees.asStateFlow()

  private val _messagesByPeer = MutableStateFlow<Map<String, List<ChatMessage>>>(initialMessagesByPeer ?: emptyMap())
  val messagesByPeer: StateFlow<Map<String, List<ChatMessage>>> = _messagesByPeer.asStateFlow()

  private val _currentPeerId = MutableStateFlow<String?>(null)
  val currentPeerId: StateFlow<String?> = _currentPeerId.asStateFlow()

  private val _errorText = MutableStateFlow<String?>(null)
  val errorText: StateFlow<String?> = _errorText.asStateFlow()

  private val _sessions = MutableStateFlow<List<ChatSessionEntry>>(emptyList())
  val sessions: StateFlow<List<ChatSessionEntry>> = _sessions.asStateFlow()

  init {
    (initialMessagesByPeer ?: emptyMap()).takeIf { it.isNotEmpty() }?.let { updateSessionsFromPeers(it.keys) }
  }

  data class EmployeeEntry(
    val employee_id: String,
    val name: String,
    val department_id: String?,
    val is_ai_agent: Boolean,
  )

  fun setInboxCallback() {
    // Inbox callback is set on connection; we handle in onInboxMessage which is passed from runtime
  }

  fun handleInboxMessage(payload: String) {
    try {
      val obj = json.parseToJsonElement(payload).jsonObject
      val from = obj["from_employee_id"]?.jsonPrimitive?.content ?: return
      val content = obj["content"]
      val text = when (content) {
        is kotlinx.serialization.json.JsonPrimitive -> content.content
        is kotlinx.serialization.json.JsonObject -> content["text"]?.jsonPrimitive?.content ?: content.toString()
        else -> content?.toString() ?: ""
      }
      val msgId = obj["msg_id"]?.jsonPrimitive?.content ?: UUID.randomUUID().toString()
      val sentAt = obj["sent_at"]?.jsonPrimitive?.content ?: ""
      val msg = ChatMessage(
        id = msgId,
        role = "assistant",
        content = listOf(ChatMessageContent(type = "text", text = text)),
        timestampMs = parseIsoOrNull(sentAt) ?: System.currentTimeMillis(),
      )
      scope.launch(Dispatchers.Main) {
        val map = _messagesByPeer.value.toMutableMap()
        val list = (map[from] ?: emptyList()).toMutableList()
        list.add(msg)
        map[from] = list
        _messagesByPeer.value = map
        updateSessionsFromPeers(map.keys)
        historyCache?.let { scope.launch { it.save(connection.myEmployeeId, from, list) } }
      }
    } catch (e: Throwable) {
      Log.w("MChatChat", "handleInboxMessage parse error", e)
    }
  }

  fun loadEmployees() {
    scope.launch(Dispatchers.IO) {
      _errorText.value = null
      val res = connection.request("org.tree", emptyMap())
      if (res.code != 0) {
        _errorText.value = res.message
        return@launch
      }
      val data = res.data ?: return@launch
      try {
        val root = json.parseToJsonElement(data).jsonObject
        val empArray = root["employees"]?.jsonArray ?: return@launch
        val list = empArray.mapNotNull { el ->
          val o = el.jsonObject
          EmployeeEntry(
            employee_id = o["employee_id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            name = o["name"]?.jsonPrimitive?.content ?: "",
            department_id = o["department_id"]?.jsonPrimitive?.content,
            is_ai_agent = o["is_ai_agent"]?.jsonPrimitive?.content == "true",
          )
        }
        _employees.value = list
        updateSessionsFromPeers(_messagesByPeer.value.keys)
      } catch (e: Throwable) {
        _errorText.value = e.message
      }
    }
  }

  fun selectPeer(employeeId: String?) {
    _currentPeerId.value = employeeId
  }

  fun sendMessage(peerEmployeeId: String, text: String) {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return
    scope.launch(Dispatchers.IO) {
      _errorText.value = null
      val optimisticId = UUID.randomUUID().toString()
      val optimistic = ChatMessage(
        id = optimisticId,
        role = "user",
        content = listOf(ChatMessageContent(type = "text", text = trimmed)),
        timestampMs = System.currentTimeMillis(),
      )
      scope.launch(Dispatchers.Main) {
        val map = _messagesByPeer.value.toMutableMap()
        val list = (map[peerEmployeeId] ?: emptyList()).toMutableList()
        list.add(optimistic)
        map[peerEmployeeId] = list
        _messagesByPeer.value = map
        updateSessionsFromPeers(map.keys)
        historyCache?.let { scope.launch { it.save(connection.myEmployeeId, peerEmployeeId, list) } }
      }
      val res = connection.request("msg.send_private", mapOf(
        "to_employee_id" to peerEmployeeId,
        "content" to trimmed,
      ))
      if (res.code != 0) {
        _errorText.value = res.message
      }
    }
  }

  fun getEmployee(employeeId: String, onResult: (EmployeeEntry?) -> Unit) {
    scope.launch(Dispatchers.IO) {
      val res = connection.request("employee.get", mapOf("employee_id" to employeeId))
      if (res.code != 0) {
        scope.launch(Dispatchers.Main) { onResult(null) }
        return@launch
      }
      val data = res.data ?: run {
        scope.launch(Dispatchers.Main) { onResult(null) }
        return@launch
      }
      try {
        val o = json.parseToJsonElement(data).jsonObject
        val entry = EmployeeEntry(
          employee_id = o["employee_id"]?.jsonPrimitive?.content ?: employeeId,
          name = o["name"]?.jsonPrimitive?.content ?: "",
          department_id = o["department_id"]?.jsonPrimitive?.content,
          is_ai_agent = o["is_ai_agent"]?.jsonPrimitive?.content == "true",
        )
        scope.launch(Dispatchers.Main) { onResult(entry) }
      } catch (_: Throwable) {
        scope.launch(Dispatchers.Main) { onResult(null) }
      }
    }
  }

  fun currentMessages(): List<ChatMessage> {
    val peer = _currentPeerId.value ?: return emptyList()
    return _messagesByPeer.value[peer] ?: emptyList()
  }

  private fun updateSessionsFromPeers(peerIds: Set<String>) {
    val employeesMap = _employees.value.associateBy { it.employee_id }
    _sessions.value = peerIds.map { id ->
      val name = employeesMap[id]?.name ?: id
      ChatSessionEntry(key = id, updatedAtMs = null, displayName = name)
    }.sortedByDescending { (_, u, _) -> u ?: 0L }
  }

  private fun parseIsoOrNull(s: String): Long? {
    return try {
      java.time.Instant.parse(s).toEpochMilli()
    } catch (_: Throwable) {
      null
    }
  }
}
