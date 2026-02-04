package com.clawdbot.android.mchat

import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallback
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "MChatConnection"
private const val REQ_PREFIX = "mchat/msg/req/"
private const val RESP_PREFIX = "mchat/msg/resp/"
private const val INBOX_PREFIX = "mchat/inbox/"
private const val QOS = 1
private val UTF8 = Charsets.UTF_8
private const val REQUEST_TIMEOUT_MS = 30_000L

sealed class MChatConnectionState {
  data object Disconnected : MChatConnectionState()
  data object Connecting : MChatConnectionState()
  data object Connected : MChatConnectionState()
  data class Error(val message: String) : MChatConnectionState()
}

/**
 * MChat MQTT 连接：使用员工连接信息连接 Broker，auth.bind，订阅收件箱，支持 request(action, params) 与收件箱消息回调。
 */
class MChatConnection(
  private val scope: CoroutineScope,
  brokerHost: String,
  brokerPort: Int,
  useTls: Boolean,
  username: String,
  password: String,
  employeeId: String,
  clientId: String? = null,
) {
  @Volatile private var onInboxMessage: ((String) -> Unit)? = null
  fun setInboxCallback(callback: (String) -> Unit) { onInboxMessage = callback }
  private val connectUsername = username
  private val connectPassword = password
  private val clientIdValue = clientId?.trim()?.takeIf { it.isNotEmpty() }
    ?: "${employeeId}_android_${UUID.randomUUID().toString().take(8)}"

  private val brokerUrl = buildString {
    append(if (useTls) "ssl://" else "tcp://")
    append(brokerHost.trim())
    append(":")
    append(brokerPort.coerceIn(1, 65535))
  }

  private val _state = MutableStateFlow<MChatConnectionState>(MChatConnectionState.Disconnected)
  val state: StateFlow<MChatConnectionState> = _state.asStateFlow()

  private val pending = ConcurrentHashMap<String, CompletableDeferred<MqttResponse>>()
  @Volatile private var client: MqttAsyncClient? = null
  @Volatile private var connectionDeferred: CompletableDeferred<Unit>? = null

  private val employeeIdValue = employeeId.trim()
  private val respTopicPrefix = "$RESP_PREFIX$clientIdValue/"
  private val inboxTopic = "$INBOX_PREFIX$employeeIdValue"

  data class MqttResponse(val code: Int, val message: String, val data: String?)

  fun connect() {
    scope.launch(Dispatchers.IO) {
      doConnect(connectUsername, connectPassword)
    }
  }

  fun disconnect() {
    scope.launch(Dispatchers.IO) {
      try {
        client?.disconnect()?.waitForCompletion(2000)
        client?.close(true)
      } catch (_: Throwable) {}
      client = null
      connectionDeferred = null
      pending.values.forEach { it.completeExceptionally(IllegalStateException("Disconnected")) }
      pending.clear()
      _state.value = MChatConnectionState.Disconnected
    }
  }

  suspend fun request(action: String, params: Map<String, Any?>): MqttResponse {
    ensureConnected()
    val seqId = "seq_${UUID.randomUUID().toString().take(8)}_${System.currentTimeMillis()}"
    val topic = "${REQ_PREFIX}$clientIdValue/$seqId"
    val payload = buildString {
      append("{\"action\":\"$action\"")
      params.forEach { (k, v) ->
        when (v) {
          null -> append(",\"$k\":null")
          is String -> append(",\"$k\":${jsonEscape(v)}")
          is Number -> append(",\"$k\":$v")
          is Boolean -> append(",\"$k\":$v")
          else -> append(",\"$k\":\"$v\"")
        }
      }
      append("}")
    }
    val deferred = CompletableDeferred<MqttResponse>()
    pending[seqId] = deferred
    try {
      val c = client ?: throw IllegalStateException("Not connected")
      if (!c.isConnected) throw IllegalStateException("Not connected")
      c.publish(topic, payload.toByteArray(UTF8), QOS, false)
      return withTimeoutOrNull(REQUEST_TIMEOUT_MS) {
        deferred.await()
      } ?: MqttResponse(504, "Request timeout", null)
    } finally {
      pending.remove(seqId)
    }
  }

  private suspend fun ensureConnected() {
    val c = client
    if (c?.isConnected == true) return
    val def = connectionDeferred ?: throw IllegalStateException("Not connected")
    def.await()
  }

  private suspend fun doConnect(username: String, password: String) = withContext(Dispatchers.IO) {
    if (client?.isConnected == true) return@withContext
    _state.value = MChatConnectionState.Connecting
    val deferred = CompletableDeferred<Unit>()
    connectionDeferred = deferred

    val opts = MqttConnectOptions().apply {
      isCleanSession = true
      keepAliveInterval = 60
      connectionTimeout = 30
      mqttVersion = MqttConnectOptions.MQTT_VERSION_3_1_1
      this.userName = username
      this.password = password.toCharArray()
    }

    val mqtt = MqttAsyncClient(brokerUrl, clientIdValue, MemoryPersistence())
    client = mqtt

    mqtt.setCallback(object : MqttCallback {
      override fun connectionLost(cause: Throwable?) {
        Log.w(TAG, "connectionLost: ${cause?.message}")
        client = null
        connectionDeferred = null
        pending.values.forEach { it.cancel() }
        pending.clear()
        _state.value = MChatConnectionState.Disconnected
      }

      override fun messageArrived(topic: String, message: MqttMessage) {
        val raw = message.payload?.toString(UTF8) ?: return
        val payload = raw.replace("\u0000", "").trim()
        if (payload.isEmpty()) return

        when {
          topic.startsWith(respTopicPrefix) -> {
            val seqId = topic.removePrefix(respTopicPrefix)
            val deferred = pending[seqId] ?: return
            try {
              val code = parseCode(payload)
              val msg = parseMessage(payload)
              val data = parseData(payload)
              deferred.complete(MqttResponse(code, msg, data))
            } catch (e: Throwable) {
              deferred.complete(MqttResponse(500, e.message ?: "Parse error", null))
            }
          }
          topic == inboxTopic -> onInboxMessage?.invoke(payload)
        }
      }

      override fun deliveryComplete(token: org.eclipse.paho.client.mqttv3.IMqttDeliveryToken?) {}
    })

    try {
      mqtt.connect(opts).waitForCompletion(15_000)
      if (!mqtt.isConnected) {
        _state.value = MChatConnectionState.Error("Connect failed")
        deferred.completeExceptionally(IllegalStateException("Not connected"))
        return@withContext
      }
      mqtt.subscribe("$respTopicPrefix+", QOS).waitForCompletion(5_000)
      mqtt.subscribe(inboxTopic, QOS).waitForCompletion(5_000)

      val bindRes = request("auth.bind", mapOf("employee_id" to employeeIdValue))
      if (bindRes.code != 0) {
        _state.value = MChatConnectionState.Error("auth.bind: ${bindRes.message}")
        deferred.completeExceptionally(IllegalStateException(bindRes.message))
        return@withContext
      }

      _state.value = MChatConnectionState.Connected
      deferred.complete(Unit)
    } catch (e: Throwable) {
      Log.e(TAG, "connect failed", e)
      _state.value = MChatConnectionState.Error(e.message ?: "Connect failed")
      client = null
      connectionDeferred = null
      deferred.completeExceptionally(e)
    }
  }

  private fun parseCode(payload: String): Int {
    val i = payload.indexOf("\"code\"")
    if (i < 0) return 500
    val start = payload.indexOf(':', i)
    if (start < 0) return 500
    val end = payload.indexOf(',', start).let { if (it < 0) payload.indexOf('}', start) else it }
    return payload.substring(start + 1, end).trim().toIntOrNull() ?: 500
  }

  private fun parseMessage(payload: String): String {
    val i = payload.indexOf("\"message\"")
    if (i < 0) return ""
    val start = payload.indexOf('"', i + 10)
    if (start < 0) return ""
    val end = payload.indexOf('"', start + 1)
    return if (end > start) payload.substring(start + 1, end) else ""
  }

  private fun parseData(payload: String): String? {
    val i = payload.indexOf("\"data\"")
    if (i < 0) return null
    val colon = payload.indexOf(':', i)
    if (colon < 0) return null
    val rest = payload.substring(colon + 1).trim()
    return when {
      rest.startsWith("null") -> null
      rest.startsWith("{") || rest.startsWith("[") -> {
        var depth = 0
        var j = 0
        for (c in rest) {
          when (c) {
            '{', '[' -> depth++
            '}', ']' -> { depth--; if (depth == 0) return rest.substring(0, j + 1) }
          }
          j++
        }
        null
      }
      else -> null
    }
  }

  private fun jsonEscape(s: String): String =
    "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
}
