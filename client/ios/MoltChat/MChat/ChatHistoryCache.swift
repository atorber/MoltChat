import Foundation

/// 将员工 ID 转为安全文件名（仅保留字母数字、下划线、连字符、点）
private func sanitizeEmployeeIdForFile(_ employeeId: String) -> String {
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_.-"))
    let trimmed = employeeId.trimmingCharacters(in: .whitespacesAndNewlines)
    let filtered = trimmed.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
    let result = String(filtered)
    return result.isEmpty ? "default" : result
}

/// 本地历史消息缓存，对标 Android ChatHistoryCache。
/// 按「当前登录员工 + 会话（peer employee_id）」持久化，不同员工身份与同一联系人的对话分别存储。
final class ChatHistoryCache {
    private let filesDir: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let queue = DispatchQueue(label: "mchat.history", qos: .utility)
    
    private let maxMessagesPerPeer = 500
    private let maxPeers = 100
    private let filenamePrefix = "mchat_history_"
    private let filenameSuffix = ".json"
    private let legacyFilename = "mchat_history.json"
    
    init() {
        self.filesDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    private func fileURL(for myEmployeeId: String) -> URL {
        filesDir.appendingPathComponent("\(filenamePrefix)\(sanitizeEmployeeIdForFile(myEmployeeId))\(filenameSuffix)")
    }
    
    private struct CacheRoot: Codable {
        var peers: [String: [ChatMessage]] = [:]
    }
    
    /// 加载当前员工身份下的全部会话缓存。
    /// - Parameter myEmployeeId: 当前登录/连接的员工 ID，用于区分不同身份下的会话文件。
    func loadAll(myEmployeeId: String) async -> [String: [ChatMessage]] {
        await withCheckedContinuation { cont in
            queue.async {
                let fileURL = self.fileURL(for: myEmployeeId)
                if FileManager.default.fileExists(atPath: fileURL.path),
                   let data = try? Data(contentsOf: fileURL),
                   let root = try? self.decoder.decode(CacheRoot.self, from: data),
                   !root.peers.isEmpty {
                    cont.resume(returning: root.peers)
                    return
                }
                // 兼容旧版单文件：若新文件不存在则从旧文件迁移一次
                let legacyURL = self.filesDir.appendingPathComponent(self.legacyFilename)
                if FileManager.default.fileExists(atPath: legacyURL.path),
                   let data = try? Data(contentsOf: legacyURL),
                   let root = try? self.decoder.decode(CacheRoot.self, from: data),
                   !root.peers.isEmpty {
                    if let encoded = try? self.encoder.encode(root) {
                        try? encoded.write(to: fileURL)
                        try? FileManager.default.removeItem(at: legacyURL)
                    }
                    cont.resume(returning: root.peers)
                    return
                }
                cont.resume(returning: [:])
            }
        }
    }
    
    /// 保存当前员工身份下与某联系人的消息列表。
    /// - Parameters:
    ///   - myEmployeeId: 当前登录/连接的员工 ID
    ///   - peerId: 对方联系人 employee_id
    func save(myEmployeeId: String, peerId: String, messages: [ChatMessage]) async {
        guard !messages.isEmpty else { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            queue.async {
                let fileURL = self.fileURL(for: myEmployeeId)
                var current: [String: [ChatMessage]] = [:]
                if FileManager.default.fileExists(atPath: fileURL.path),
                   let data = try? Data(contentsOf: fileURL),
                   let root = try? self.decoder.decode(CacheRoot.self, from: data) {
                    current = root.peers
                }
                let trimmed = Array(messages.suffix(self.maxMessagesPerPeer))
                current[peerId] = trimmed
                if current.count > self.maxPeers {
                    let byLast = current.compactMap { (id, list) -> (String, Int64)? in
                        let t = list.compactMap(\.timestampMs).max() ?? 0
                        return (id, t)
                    }.sorted { $0.1 < $1.1 }
                    let toRemove = byLast.prefix(current.count - self.maxPeers).map(\.0)
                    toRemove.forEach { current.removeValue(forKey: $0) }
                }
                let root = CacheRoot(peers: current)
                if let data = try? self.encoder.encode(root) {
                    try? data.write(to: fileURL)
                }
                cont.resume()
            }
        }
    }
}
