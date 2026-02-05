package com.clawdbot.android.mchat

import android.content.Context
import android.util.Log
import com.clawdbot.android.chat.ChatMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

private const val TAG = "ChatHistoryCache"
private const val FILENAME_PREFIX = "mchat_history_"
private const val FILENAME_SUFFIX = ".json"
private const val LEGACY_FILENAME = "mchat_history.json"
private const val MAX_MESSAGES_PER_PEER = 500
private const val MAX_PEERS = 100

/** 将员工 ID 转为安全文件名（仅保留字母数字、下划线、连字符）。 */
private fun sanitizeEmployeeIdForFile(employeeId: String): String =
  employeeId.trim().replace(Regex("[^a-zA-Z0-9_.-]"), "_").ifEmpty { "default" }

/**
 * 本地历史消息缓存：按「当前登录员工 + 会话（peer employee_id）」持久化消息。
 * 不同员工身份与同一联系人的对话分别存储，互不覆盖。
 */
class ChatHistoryCache(context: Context) {
  private val filesDir = context.filesDir
  private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
  }

  @Serializable
  private data class CacheRoot(val peers: Map<String, List<ChatMessage>> = emptyMap())

  private fun fileFor(employeeId: String): File =
    File(filesDir, "$FILENAME_PREFIX${sanitizeEmployeeIdForFile(employeeId)}$FILENAME_SUFFIX")

  /**
   * 加载当前员工身份下的全部会话缓存，用于连接后恢复会话列表与各会话历史。
   * @param myEmployeeId 当前登录/连接的员工 ID，用于区分不同身份下的会话文件。
   */
  suspend fun loadAll(myEmployeeId: String): Map<String, List<ChatMessage>> = withContext(Dispatchers.IO) {
    val file = fileFor(myEmployeeId)
    if (file.exists()) {
      try {
        val raw = file.readText(Charsets.UTF_8).trim()
        if (raw.isNotEmpty()) {
          val root = json.decodeFromString<CacheRoot>(raw)
          return@withContext root.peers
        }
      } catch (e: Throwable) {
        Log.w(TAG, "loadAll failed employeeId=$myEmployeeId", e)
      }
    }
    // 兼容旧版单文件：若新文件不存在则从旧文件迁移一次
    val legacyFile = File(filesDir, LEGACY_FILENAME)
    if (legacyFile.exists()) {
      try {
        val raw = legacyFile.readText(Charsets.UTF_8).trim()
        if (raw.isNotEmpty()) {
          val root = json.decodeFromString<CacheRoot>(raw)
          if (root.peers.isNotEmpty()) {
            val rootToWrite = CacheRoot(root.peers)
            file.writeText(json.encodeToString(CacheRoot.serializer(), rootToWrite), Charsets.UTF_8)
            legacyFile.delete()
            return@withContext root.peers
          }
        }
      } catch (e: Throwable) {
        Log.w(TAG, "migrate from legacy failed", e)
      }
    }
    emptyMap()
  }

  /**
   * 保存当前员工身份下与某联系人的消息列表（会裁剪到 MAX_MESSAGES_PER_PEER 条）。
   * @param myEmployeeId 当前登录/连接的员工 ID。
   * @param peerId 对方联系人 employee_id。
   */
  suspend fun save(myEmployeeId: String, peerId: String, messages: List<ChatMessage>) = withContext(Dispatchers.IO) {
    if (messages.isEmpty()) return@withContext
    val file = fileFor(myEmployeeId)
    try {
      val current = loadAll(myEmployeeId).toMutableMap()
      val trimmed = messages.takeLast(MAX_MESSAGES_PER_PEER)
      current[peerId] = trimmed
      if (current.size > MAX_PEERS) {
        val byLast = current.entries
          .mapNotNull { (id, list) -> list.maxOfOrNull { it.timestampMs ?: 0L }?.let { id to it } }
          .sortedBy { it.second }
        val toRemove = byLast.take((current.size - MAX_PEERS).coerceAtLeast(0)).map { it.first }
        toRemove.forEach { current.remove(it) }
      }
      val root = CacheRoot(current)
      file.writeText(json.encodeToString(CacheRoot.serializer(), root), Charsets.UTF_8)
    } catch (e: Throwable) {
      Log.w(TAG, "save failed myEmployeeId=$myEmployeeId peer=$peerId", e)
    }
  }
}
