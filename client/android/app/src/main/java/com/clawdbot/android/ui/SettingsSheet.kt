package com.clawdbot.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdbot.android.MainViewModel
import com.clawdbot.android.mchat.MChatConnectionState

@Composable
fun SettingsSheet(viewModel: MainViewModel) {
  val connectionState by viewModel.connectionState.collectAsState()
  val mqttBrokerUrl by viewModel.mqttBrokerUrl.collectAsState()
  val mqttUsername by viewModel.mqttUsername.collectAsState()
  val mqttPassword by viewModel.mqttPassword.collectAsState()
  val mchatEmployeeId by viewModel.mchatEmployeeId.collectAsState()
  val isConnected = connectionState is MChatConnectionState.Connected

  val statusText = when (connectionState) {
    is MChatConnectionState.Disconnected -> "未连接"
    is MChatConnectionState.Connecting -> "连接中…"
    is MChatConnectionState.Connected -> "已连接"
    is MChatConnectionState.Error -> "错误: ${(connectionState as MChatConnectionState.Error).message}"
  }

  LazyColumn(
    modifier = Modifier
      .fillMaxWidth()
      .imePadding()
      .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    item {
      Text("连接配置", style = MaterialTheme.typography.titleMedium)
      Text("填写员工连接信息后点击连接即可登录", style = MaterialTheme.typography.bodySmall)
    }
    item {
      Text("状态：$statusText", style = MaterialTheme.typography.bodyMedium)
    }
    item {
      OutlinedTextField(
        value = mqttBrokerUrl,
        onValueChange = viewModel::setMqttBrokerUrl,
        label = { Text("Broker 地址") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        placeholder = { Text("tcp://主机:1883 或 ssl://主机:8883") },
      )
    }
    item {
      OutlinedTextField(
        value = mqttUsername,
        onValueChange = viewModel::setMqttUsername,
        label = { Text("用户名（MQTT）") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
      )
    }
    item {
      OutlinedTextField(
        value = mqttPassword,
        onValueChange = viewModel::setMqttPassword,
        label = { Text("密码") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
      )
    }
    item {
      OutlinedTextField(
        value = mchatEmployeeId,
        onValueChange = viewModel::setMcHatEmployeeId,
        label = { Text("员工 ID") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        placeholder = { Text("与管理员下发的 employee_id 一致") },
      )
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        if (isConnected) {
          Button(onClick = { viewModel.disconnect() }, modifier = Modifier.fillMaxWidth()) {
            Text("断开连接")
          }
        } else {
          Button(
            onClick = { viewModel.connect() },
            modifier = Modifier.fillMaxWidth(),
            enabled = mqttBrokerUrl.trim().isNotEmpty() && mqttUsername.trim().isNotEmpty() && mchatEmployeeId.trim().isNotEmpty(),
          ) {
            Text("连接")
          }
        }
      }
    }
  }
}
