package com.clawdbot.android.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdbot.android.MainViewModel
import com.clawdbot.android.chat.ChatMessage
import com.clawdbot.android.mchat.MChatChatController

@Composable
fun ChatSheetContent(viewModel: MainViewModel) {
  val employees by viewModel.chatEmployees.collectAsState()
  val currentPeerId by viewModel.chatCurrentPeerId.collectAsState()
  val messages = viewModel.currentChatMessages()
  val errorText by viewModel.chatErrorText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()

  if (currentPeerId != null) {
    ChatConversation(
      peerId = currentPeerId!!,
      peerName = employees.find { it.employee_id == currentPeerId }?.name ?: currentPeerId!!,
      messages = messages,
      errorText = errorText,
      canSend = isConnected,
      onBack = { viewModel.selectPeer(null) },
      onSend = { text -> viewModel.sendMessage(currentPeerId!!, text) },
    )
  } else {
    ChatEmployeeList(
      employees = employees,
      isConnected = isConnected,
      onSelectEmployee = { viewModel.selectPeer(it.employee_id) },
    )
  }
}

@Composable
private fun ChatEmployeeList(
  employees: List<MChatChatController.EmployeeEntry>,
  isConnected: Boolean,
  onSelectEmployee: (MChatChatController.EmployeeEntry) -> Unit,
) {
  Column(Modifier.fillMaxSize()) {
    Text(
      "选择联系人",
      style = MaterialTheme.typography.titleMedium,
      modifier = Modifier.padding(12.dp),
    )
    if (!isConnected) {
      Text(
        "请先在设置中连接",
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.padding(horizontal = 12.dp),
      )
    }
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
      items(employees) { emp ->
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = isConnected) { onSelectEmployee(emp) }
            .padding(16.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(emp.name, style = MaterialTheme.typography.bodyLarge)
          Text(
            "  (${emp.employee_id})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          if (emp.is_ai_agent) {
            Text(
              " AI",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.primary,
              modifier = Modifier.padding(start = 8.dp),
            )
          }
        }
      }
    }
  }
}

@Composable
private fun ChatConversation(
  peerId: String,
  peerName: String,
  messages: List<ChatMessage>,
  errorText: String?,
  canSend: Boolean,
  onBack: () -> Unit,
  onSend: (String) -> Unit,
) {
  var input by rememberSaveable { mutableStateOf("") }

  Column(Modifier.fillMaxSize()) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      IconButton(onClick = onBack) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
      }
      Text("$peerName ($peerId)", style = MaterialTheme.typography.titleMedium)
    }
    if (errorText != null) {
      Text(errorText, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 12.dp))
    }
    ChatMessageListCard(
      messages = messages,
      pendingRunCount = 0,
      pendingToolCalls = emptyList(),
      streamingAssistantText = null,
      modifier = Modifier.weight(1f),
    )
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(8.dp),
      verticalAlignment = Alignment.Bottom,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      OutlinedTextField(
        value = input,
        onValueChange = { input = it },
        modifier = Modifier.weight(1f),
        placeholder = { Text("输入消息") },
        singleLine = false,
        maxLines = 4,
      )
      androidx.compose.material3.FilledTonalButton(
        onClick = {
          val t = input.trim()
          if (t.isNotEmpty() && canSend) {
            onSend(t)
            input = ""
          }
        },
        enabled = canSend && input.trim().isNotEmpty(),
      ) {
        Icon(Icons.Default.ArrowUpward, contentDescription = "发送")
      }
    }
  }
}
