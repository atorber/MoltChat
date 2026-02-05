package com.clawdbot.android

import android.content.Context
import com.clawdbot.android.mchat.MChatChatController
import com.clawdbot.android.mchat.MChatConnection
import com.clawdbot.android.mchat.MChatConnectionState
import com.clawdbot.android.mchat.ChatHistoryCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * MChat 运行时：仅包含连接配置、MQTT 连接与聊天（员工列表、单聊收发）。
 */
class MChatRuntime(context: Context) {
  private val appContext = context.applicationContext
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

  val prefs = SecurePrefs(appContext)

  private var connection: MChatConnection? = null
  private var chatController: MChatChatController? = null

  private val _connectionState = MutableStateFlow<MChatConnectionState>(MChatConnectionState.Disconnected)
  val connectionState: StateFlow<MChatConnectionState> = _connectionState.asStateFlow()

  private val _isConnected = MutableStateFlow(false)
  val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

  val mqttBrokerUrl: StateFlow<String> = prefs.mqttBrokerUrl
  val mqttUsername: StateFlow<String> = prefs.mqttUsername
  val mqttPassword: StateFlow<String> = prefs.mqttPassword
  val mchatEmployeeId: StateFlow<String> = prefs.mchatEmployeeId

  private val _chatEmployees = MutableStateFlow<List<MChatChatController.EmployeeEntry>>(emptyList())
  val chatEmployees: StateFlow<List<MChatChatController.EmployeeEntry>> = _chatEmployees.asStateFlow()
  private val _chatMessagesByPeer = MutableStateFlow<Map<String, List<com.clawdbot.android.chat.ChatMessage>>>(emptyMap())
  val chatMessagesByPeer: StateFlow<Map<String, List<com.clawdbot.android.chat.ChatMessage>>> = _chatMessagesByPeer.asStateFlow()
  private val _chatCurrentPeerId = MutableStateFlow<String?>(null)
  val chatCurrentPeerId: StateFlow<String?> = _chatCurrentPeerId.asStateFlow()
  private val _chatErrorText = MutableStateFlow<String?>(null)
  val chatErrorText: StateFlow<String?> = _chatErrorText.asStateFlow()
  private val _chatSessions = MutableStateFlow<List<com.clawdbot.android.chat.ChatSessionEntry>>(emptyList())
  val chatSessions: StateFlow<List<com.clawdbot.android.chat.ChatSessionEntry>> = _chatSessions.asStateFlow()

  fun setMqttBrokerUrl(value: String) = prefs.setMqttBrokerUrl(value)
  fun setMqttUsername(value: String) = prefs.setMqttUsername(value)
  fun setMqttPassword(value: String) = prefs.setMqttPassword(value)
  fun setMcHatEmployeeId(value: String) = prefs.setMcHatEmployeeId(value)

  private val historyCache = ChatHistoryCache(appContext)

  init {
    scope.launch {
      if (hasRequiredConfig()) connect()
    }
  }

  private fun hasRequiredConfig(): Boolean {
    val url = prefs.mqttBrokerUrl.value.trim()
    val username = prefs.mqttUsername.value.trim()
    val employeeId = prefs.mchatEmployeeId.value.trim()
    if (url.isEmpty() || username.isEmpty() || employeeId.isEmpty()) return false
    val (host, port, _) = parseBrokerUrl(url)
    return host != null && port != null
  }

  fun connect() {
    val url = prefs.mqttBrokerUrl.value.trim()
    val username = prefs.mqttUsername.value.trim()
    val password = prefs.mqttPassword.value
    val employeeId = prefs.mchatEmployeeId.value.trim()
    if (url.isEmpty() || username.isEmpty() || employeeId.isEmpty()) {
      _connectionState.value = MChatConnectionState.Error("请填写 Broker 地址、用户名与员工 ID")
      return
    }
    val (host, port, useTls) = parseBrokerUrl(url)
    if (host == null || port == null) {
      _connectionState.value = MChatConnectionState.Error("Broker 地址格式错误，应为 tcp://host:port 或 ssl://host:port")
      return
    }
    disconnect()
    _connectionState.value = MChatConnectionState.Connecting
    scope.launch {
      val cached = withContext(Dispatchers.IO) { historyCache.loadAll(employeeId) }
      val conn = MChatConnection(
        scope = scope,
        brokerHost = host,
        brokerPort = port,
        useTls = useTls,
        username = username,
        password = password,
        employeeId = employeeId,
      )
      val controller = MChatChatController(
        scope = scope,
        connection = conn,
        historyCache = historyCache,
        initialMessagesByPeer = cached,
      )
      conn.setInboxCallback { controller.handleInboxMessage(it) }
      connection = conn
      chatController = controller
      launch {
        conn.state.collect { state ->
          _connectionState.value = state
          _isConnected.value = state is MChatConnectionState.Connected
          if (state is MChatConnectionState.Connected) {
            controller.selectPeer(null)
            controller.loadEmployees()
          }
        }
      }
      launch { controller.employees.collect { _chatEmployees.value = it } }
      launch { controller.messagesByPeer.collect { _chatMessagesByPeer.value = it } }
      launch { controller.currentPeerId.collect { _chatCurrentPeerId.value = it } }
      launch { controller.errorText.collect { _chatErrorText.value = it } }
      launch { controller.sessions.collect { _chatSessions.value = it } }
      conn.connect()
    }
  }

  fun disconnect() {
    connection?.disconnect()
    connection = null
    chatController = null
  }

  fun loadEmployees() = chatController?.loadEmployees()
  fun selectPeer(employeeId: String?) = chatController?.selectPeer(employeeId)
  fun sendMessage(peerEmployeeId: String, text: String) = chatController?.sendMessage(peerEmployeeId, text)
  fun getEmployee(employeeId: String, onResult: (MChatChatController.EmployeeEntry?) -> Unit) =
    chatController?.getEmployee(employeeId, onResult)

  fun currentChatMessages(): List<com.clawdbot.android.chat.ChatMessage> =
    chatController?.currentMessages() ?: emptyList()

  private fun parseBrokerUrl(url: String): Triple<String?, Int?, Boolean> {
    val trimmed = url.trim()
    val useTls = trimmed.startsWith("ssl://", ignoreCase = true)
    val prefix = if (useTls) "ssl://" else "tcp://"
    if (!trimmed.lowercase().startsWith(prefix)) return Triple(null, null, false)
    val rest = trimmed.substring(prefix.length).trim()
    val colon = rest.indexOf(':')
    if (colon <= 0) return Triple(rest.ifEmpty { null }, null, useTls)
    val host = rest.substring(0, colon).trim()
    val portStr = rest.substring(colon + 1).trim().takeWhile { it.isDigit() }
    val port = portStr.toIntOrNull()?.coerceIn(1, 65535)
    return Triple(host.ifEmpty { null }, port, useTls)
  }
}
