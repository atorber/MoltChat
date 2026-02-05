import Foundation

/// MChat 聊天控制器，对标 Android MChatChatController
@MainActor
final class MChatChatController {
    private let connection: MChatConnection
    private let historyCache: ChatHistoryCache?
    
    private(set) var employees: [EmployeeEntry] = []
    private(set) var messagesByPeer: [String: [ChatMessage]] = [:]
    private(set) var currentPeerId: String?
    private(set) var errorText: String?
    private(set) var sessions: [ChatSessionEntry] = []
    
    var onEmployeesChanged: (([EmployeeEntry]) -> Void)?
    var onMessagesChanged: (([String: [ChatMessage]]) -> Void)?
    var onCurrentPeerChanged: ((String?) -> Void)?
    var onErrorChanged: ((String?) -> Void)?
    var onSessionsChanged: (([ChatSessionEntry]) -> Void)?
    
    init(connection: MChatConnection, historyCache: ChatHistoryCache?, initialMessagesByPeer: [String: [ChatMessage]]?) {
        self.connection = connection
        self.historyCache = historyCache
        if let initial = initialMessagesByPeer {
            self.messagesByPeer = initial
            updateSessionsFromPeers(Set(initial.keys))
        }
    }
    
    func setInboxCallback(_ callback: @escaping (String) -> Void) {
        connection.setInboxCallback(callback)
    }
    
    func handleInboxMessage(_ payload: String) {
        guard let data = payload.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let from = obj["from_employee_id"] as? String else { return }
        var text = ""
        if let content = obj["content"] {
            if let s = content as? String { text = s }
            else if let o = content as? [String: Any], let t = o["text"] as? String { text = t }
        }
        let msgId = obj["msg_id"] as? String ?? UUID().uuidString
        let sentAt = obj["sent_at"] as? String ?? ""
        let timestampMs = parseIso(sentAt) ?? Int64(Date().timeIntervalSince1970 * 1000)
        let msg = ChatMessage(
            id: msgId,
            role: "assistant",
            content: [ChatMessageContent(type: "text", text: text)],
            timestampMs: timestampMs
        )
        var map = messagesByPeer
        var list = map[from] ?? []
        list.append(msg)
        map[from] = list
        messagesByPeer = map
        onMessagesChanged?(map)
        updateSessionsFromPeers(Set(map.keys))
        if let cache = historyCache {
            Task { await cache.save(myEmployeeId: connection.myEmployeeId, peerId: from, messages: list) }
        }
    }
    
    func loadEmployees() {
        errorText = nil
        onErrorChanged?(nil)
        Task {
            let res = await connection.request(action: "org.tree", params: [:])
            if res.code != 0 {
                errorText = res.message
                onErrorChanged?(res.message)
                return
            }
            guard let dataStr = res.data, let data = dataStr.data(using: .utf8),
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let empArray = root["employees"] as? [[String: Any]] else { return }
            var list: [EmployeeEntry] = []
            for o in empArray {
                guard let eid = o["employee_id"] as? String else { continue }
                list.append(EmployeeEntry(
                    employeeId: eid,
                    name: o["name"] as? String ?? "",
                    departmentId: o["department_id"] as? String,
                    isAiAgent: (o["is_ai_agent"] as? String) == "true"
                ))
            }
            employees = list
            onEmployeesChanged?(list)
            updateSessionsFromPeers(Set(messagesByPeer.keys))
        }
    }
    
    func selectPeer(_ employeeId: String?) {
        currentPeerId = employeeId
        onCurrentPeerChanged?(employeeId)
    }
    
    func sendMessage(peerEmployeeId: String, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        errorText = nil
        onErrorChanged?(nil)
        let optimistic = ChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: [ChatMessageContent(type: "text", text: trimmed)],
            timestampMs: Int64(Date().timeIntervalSince1970 * 1000)
        )
        var map = messagesByPeer
        var list = map[peerEmployeeId] ?? []
        list.append(optimistic)
        map[peerEmployeeId] = list
        messagesByPeer = map
        onMessagesChanged?(map)
        updateSessionsFromPeers(Set(map.keys))
        if let cache = historyCache {
            Task { await cache.save(myEmployeeId: connection.myEmployeeId, peerId: peerEmployeeId, messages: list) }
        }
        Task {
            let res = await connection.request(action: "msg.send_private", params: [
                "to_employee_id": peerEmployeeId,
                "content": trimmed
            ])
            if res.code != 0 {
                errorText = res.message
                onErrorChanged?(res.message)
            }
        }
    }
    
    func getEmployee(employeeId: String) async -> EmployeeEntry? {
        let res = await connection.request(action: "employee.get", params: ["employee_id": employeeId])
        guard res.code == 0, let dataStr = res.data, let data = dataStr.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return EmployeeEntry(
            employeeId: o["employee_id"] as? String ?? employeeId,
            name: o["name"] as? String ?? "",
            departmentId: o["department_id"] as? String,
            isAiAgent: (o["is_ai_agent"] as? String) == "true"
        )
    }
    
    func currentMessages() -> [ChatMessage] {
        guard let peer = currentPeerId else { return [] }
        return messagesByPeer[peer] ?? []
    }
    
    private func updateSessionsFromPeers(_ peerIds: Set<String>) {
        let empMap = Dictionary(uniqueKeysWithValues: employees.map { ($0.employeeId, $0.name) })
        sessions = peerIds.map { id in
            ChatSessionEntry(key: id, updatedAtMs: nil, displayName: empMap[id] ?? id)
        }
    }
    
    private func parseIso(_ s: String) -> Int64? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = formatter.date(from: s) {
            return Int64(d.timeIntervalSince1970 * 1000)
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let d = formatter.date(from: s) {
            return Int64(d.timeIntervalSince1970 * 1000)
        }
        return nil
    }
}
