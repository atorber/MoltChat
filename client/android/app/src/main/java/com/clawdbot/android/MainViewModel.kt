package com.clawdbot.android

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.clawdbot.android.mchat.MChatConnectionState
import com.clawdbot.android.mchat.MChatChatController
import kotlinx.coroutines.flow.StateFlow

class MainViewModel(app: Application) : AndroidViewModel(app) {
  private val runtime: MChatRuntime = (app as NodeApp).runtime

  val isConnected: StateFlow<Boolean> = runtime.isConnected
  val connectionState: StateFlow<MChatConnectionState> = runtime.connectionState
  val mqttBrokerUrl: StateFlow<String> = runtime.mqttBrokerUrl
  val mqttUsername: StateFlow<String> = runtime.mqttUsername
  val mqttPassword: StateFlow<String> = runtime.mqttPassword
  val mchatEmployeeId: StateFlow<String> = runtime.mchatEmployeeId

  val chatEmployees: StateFlow<List<MChatChatController.EmployeeEntry>> = runtime.chatEmployees
  val chatMessagesByPeer: StateFlow<Map<String, List<com.clawdbot.android.chat.ChatMessage>>> = runtime.chatMessagesByPeer
  val chatCurrentPeerId: StateFlow<String?> = runtime.chatCurrentPeerId
  val chatErrorText: StateFlow<String?> = runtime.chatErrorText
  val chatSessions: StateFlow<List<com.clawdbot.android.chat.ChatSessionEntry>> = runtime.chatSessions

  fun setMqttBrokerUrl(value: String) = runtime.setMqttBrokerUrl(value)
  fun setMqttUsername(value: String) = runtime.setMqttUsername(value)
  fun setMqttPassword(value: String) = runtime.setMqttPassword(value)
  fun setMcHatEmployeeId(value: String) = runtime.setMcHatEmployeeId(value)

  fun connect() = runtime.connect()
  fun disconnect() = runtime.disconnect()

  fun loadEmployees() = runtime.loadEmployees()
  fun selectPeer(employeeId: String?) = runtime.selectPeer(employeeId)
  fun sendMessage(peerEmployeeId: String, text: String) = runtime.sendMessage(peerEmployeeId, text)
  fun getEmployee(employeeId: String, onResult: (MChatChatController.EmployeeEntry?) -> Unit) =
    runtime.getEmployee(employeeId, onResult)

  fun currentChatMessages(): List<com.clawdbot.android.chat.ChatMessage> = runtime.currentChatMessages()
}
