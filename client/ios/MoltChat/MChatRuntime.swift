import Foundation
import Combine

/// MChat 运行时，对标 Android MChatRuntime
@MainActor
final class MChatRuntime: ObservableObject {
    let prefs = SecurePrefs()
    private let historyCache = ChatHistoryCache()
    
    @Published private(set) var connectionState: MChatConnectionState = .disconnected
    @Published private(set) var isConnected = false
    @Published var chatEmployees: [EmployeeEntry] = []
    @Published var chatMessagesByPeer: [String: [ChatMessage]] = [:]
    @Published var chatCurrentPeerId: String?
    @Published var chatErrorText: String?
    @Published var chatSessions: [ChatSessionEntry] = []
    
    private var connection: MChatConnection?
    private var chatController: MChatChatController?
    private var cancellables = Set<AnyCancellable>()
    private var connectionStateCancellable: AnyCancellable?
    
    var mqttBrokerUrl: String {
        get { prefs.mqttBrokerUrl }
        set { prefs.setMqttBrokerUrl(newValue) }
    }
    var mqttUsername: String {
        get { prefs.mqttUsername }
        set { prefs.setMqttUsername(newValue) }
    }
    var mqttPassword: String {
        get { prefs.mqttPassword }
        set { prefs.setMqttPassword(newValue) }
    }
    var mchatEmployeeId: String {
        get { prefs.mchatEmployeeId }
        set { prefs.setMchatEmployeeId(newValue) }
    }
    
    init() {
        prefs.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }
    
    func connect() {
        let url = prefs.mqttBrokerUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        let username = prefs.mqttUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let password = prefs.mqttPassword
        let employeeId = prefs.mchatEmployeeId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty, !username.isEmpty, !employeeId.isEmpty else {
            connectionState = .error("请填写 Broker 地址、用户名与员工 ID")
            return
        }
        let (host, port, useTls) = parseBrokerUrl(url)
        guard let host = host, let port = port else {
            connectionState = .error("Broker 地址格式错误，应为 tcp://host:port 或 ssl://host:port")
            return
        }
        disconnect()
        connectionState = .connecting
        let conn = MChatConnection(
            brokerHost: host,
            brokerPort: port,
            useTls: useTls,
            username: username,
            password: password,
            employeeId: employeeId
        )
        Task { @MainActor in
            let cached = await historyCache.loadAll(myEmployeeId: employeeId)
            let controller = MChatChatController(
                connection: conn,
                historyCache: historyCache,
                initialMessagesByPeer: cached.isEmpty ? nil : cached
            )
            conn.setInboxCallback { [weak controller] payload in
                Task { @MainActor in
                    controller?.handleInboxMessage(payload)
                }
            }
            controller.onEmployeesChanged = { [weak self] in self?.chatEmployees = $0 }
            controller.onMessagesChanged = { [weak self] in self?.chatMessagesByPeer = $0 }
            controller.onCurrentPeerChanged = { [weak self] in self?.chatCurrentPeerId = $0 }
            controller.onErrorChanged = { [weak self] in self?.chatErrorText = $0 }
            controller.onSessionsChanged = { [weak self] in self?.chatSessions = $0 }
            connectionStateCancellable?.cancel()
            connectionStateCancellable = conn.stateSubject
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in
                    self?.connectionState = state
                    self?.isConnected = (state == .connected)
                    if case .connected = state {
                        controller.selectPeer(nil)
                        controller.loadEmployees()
                    }
                }
            connection = conn
            chatController = controller
            conn.connect()
        }
    }
    
    func disconnect() {
        connection?.disconnect()
        connection = nil
        chatController = nil
        connectionStateCancellable?.cancel()
        connectionStateCancellable = nil
    }
    
    func loadEmployees() { chatController?.loadEmployees() }
    func selectPeer(_ employeeId: String?) { chatController?.selectPeer(employeeId) }
    func sendMessage(peerEmployeeId: String, text: String) {
        chatController?.sendMessage(peerEmployeeId: peerEmployeeId, text: text)
    }
    func currentChatMessages() -> [ChatMessage] { chatController?.currentMessages() ?? [] }
    
    private func parseBrokerUrl(_ url: String) -> (host: String?, port: Int?, useTls: Bool) {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let useTls = trimmed.lowercased().hasPrefix("ssl://")
        let prefix = useTls ? "ssl://" : "tcp://"
        guard trimmed.lowercased().hasPrefix(prefix) else { return (nil, nil, false) }
        let rest = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let colon = rest.firstIndex(of: ":") else { return (rest.isEmpty ? nil : rest, nil, useTls) }
        let host = String(rest[..<colon]).trimmingCharacters(in: .whitespacesAndNewlines)
        let portStr = String(rest[rest.index(after: colon)...]).prefix(5).filter { $0.isNumber }
        let port = Int(portStr).map { min(max($0, 1), 65535) }
        return (host.isEmpty ? nil : host, port, useTls)
    }
}
