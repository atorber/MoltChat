import Foundation
import Combine
import CocoaMQTT

/// MChat MQTT 连接，对标 Android MChatConnection
enum MChatConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case error(String)
}

struct MqttResponse {
    let code: Int
    let message: String
    let data: String?
}

/// 根据 serviceId 生成 topic 前缀：有 serviceId 则 "{serviceId}/mchat"，否则 "mchat"
private func getTopicPrefix(_ serviceId: String?) -> String {
    guard let sid = serviceId?.trimmingCharacters(in: .whitespacesAndNewlines), !sid.isEmpty else {
        return "mchat"
    }
    return "\(sid)/mchat"
}

@MainActor
final class MChatConnection {
    private let brokerHost: String
    private let brokerPort: UInt16
    private let useTls: Bool
    private let username: String
    private let password: String
    private let employeeId: String
    /// 当前连接使用的员工 ID，用于按身份隔离历史会话缓存。
    var myEmployeeId: String { employeeId }
    private let clientIdValue: String
    /// 服务实例 ID，用于 Topic 域隔离
    private let serviceIdValue: String?
    
    private let topicPrefix: String
    private let reqPrefix: String
    private let respPrefixBase: String
    private let inboxPrefixBase: String
    private let requestTimeout: TimeInterval = 30
    private let initialReconnect: TimeInterval = 2
    private let maxReconnect: TimeInterval = 30
    
    private var mqtt: CocoaMQTT?
    private var onInboxMessage: ((String) -> Void)?
    private var pending: [String: CheckedContinuation<MqttResponse, Never>] = [:]
    private var reconnectTask: Task<Void, Never>?
    private var reconnectBackoff: TimeInterval = 2
    private var userDisconnect = false
    
    private(set) var state: MChatConnectionState = .disconnected {
        didSet { stateSubject.send(state) }
    }
    let stateSubject = CurrentValueSubject<MChatConnectionState, Never>(.disconnected)
    
    var clientId: String { clientIdValue }
    var respTopicPrefix: String { "\(respPrefixBase)\(clientIdValue)/" }
    var inboxTopic: String { "\(inboxPrefixBase)\(employeeId)" }
    
    init(brokerHost: String, brokerPort: Int, useTls: Bool, username: String, password: String, employeeId: String, clientId: String? = nil, serviceId: String? = nil) {
        self.brokerHost = brokerHost
        self.brokerPort = UInt16(min(max(brokerPort, 1), 65535))
        self.useTls = useTls
        self.username = username
        self.password = password
        self.employeeId = employeeId.trimmingCharacters(in: .whitespacesAndNewlines)
        self.clientIdValue = (clientId?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
            ?? "\(employeeId)_ios_\(UUID().uuidString.prefix(8))"
        self.serviceIdValue = serviceId?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.topicPrefix = getTopicPrefix(serviceId)
        self.reqPrefix = "\(self.topicPrefix)/msg/req/"
        self.respPrefixBase = "\(self.topicPrefix)/msg/resp/"
        self.inboxPrefixBase = "\(self.topicPrefix)/inbox/"
    }
    
    func setInboxCallback(_ callback: @escaping (String) -> Void) {
        onInboxMessage = callback
    }
    
    fileprivate func setState(_ s: MChatConnectionState) {
        state = s
    }
    
    func connect() {
        userDisconnect = false
        reconnectTask?.cancel()
        reconnectTask = nil
        performConnect()
    }
    
    func disconnect() {
        userDisconnect = true
        reconnectTask?.cancel()
        reconnectTask = nil
        mqtt?.disconnect()
        mqtt = nil
        for (_, cont) in pending {
            cont.resume(returning: MqttResponse(code: 500, message: "Disconnected", data: nil))
        }
        pending.removeAll()
        state = .disconnected
    }
    
    func request(action: String, params: [String: Any]) async -> MqttResponse {
        guard let mqtt = mqtt, mqtt.connState == .connected else {
            return MqttResponse(code: 500, message: "Not connected", data: nil)
        }
        let seqId = "seq_\(UUID().uuidString.prefix(8))_\(Int64(Date().timeIntervalSince1970 * 1000))"
        let topic = "\(reqPrefix)\(clientIdValue)/\(seqId)"
        var body: [String: Any] = ["action": action]
        for (k, v) in params { body[k] = v }
        guard let payloadData = try? JSONSerialization.data(withJSONObject: body),
              let payload = String(data: payloadData, encoding: .utf8) else {
            return MqttResponse(code: 400, message: "Invalid params", data: nil)
        }
        return await withCheckedContinuation { cont in
            pending[seqId] = cont
            mqtt.publish(topic, withString: payload, qos: .qos1)
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(requestTimeout * 1_000_000_000))
                if let c = pending.removeValue(forKey: seqId) {
                    c.resume(returning: MqttResponse(code: 504, message: "Request timeout", data: nil))
                }
            }
        }
    }
    
    private func performConnect() {
        state = .connecting
        // brokerUrl for logging purposes
        _ = "\(useTls ? "ssl" : "tcp")://\(brokerHost):\(brokerPort)"
        let mqtt = CocoaMQTT(clientID: clientIdValue, host: brokerHost, port: brokerPort)
        mqtt.username = username
        mqtt.password = password
        mqtt.keepAlive = 60
        mqtt.autoReconnect = false
        mqtt.cleanSession = true
        mqtt.enableSSL = useTls
        mqtt.allowUntrustCACertificate = useTls
        mqtt.delegate = MChatMQTTDelegate(connection: self)
        self.mqtt = mqtt
        
        guard mqtt.connect() else {
            state = .error("Connect failed")
            scheduleReconnect()
            return
        }
    }
    
    fileprivate func didConnect() {
        mqtt?.subscribe("\(respTopicPrefix)+", qos: .qos1)
        mqtt?.subscribe(inboxTopic, qos: .qos1)
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            let bindRes = await request(action: "auth.bind", params: ["employee_id": employeeId])
            if bindRes.code != 0 {
                state = .error("auth.bind: \(bindRes.message)")
                return
            }
            state = .connected
            reconnectBackoff = initialReconnect
        }
    }
    
    fileprivate func didDisconnect(_ error: Error?) {
        mqtt = nil
        for (_, cont) in pending {
            cont.resume(returning: MqttResponse(code: 500, message: "Disconnected", data: nil))
        }
        pending.removeAll()
        state = .disconnected
        if !userDisconnect { scheduleReconnect() }
    }
    
    fileprivate func messageArrived(topic: String, payload: String) {
        let cleaned = payload.replacingOccurrences(of: "\u{0}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return }
        if topic.hasPrefix(respTopicPrefix) {
            let seqId = String(topic.dropFirst(respTopicPrefix.count))
            if let cont = pending.removeValue(forKey: seqId) {
                let code = parseCode(cleaned)
                let msg = parseMessage(cleaned)
                let data = parseData(cleaned)
                cont.resume(returning: MqttResponse(code: code, message: msg, data: data))
            }
        } else if topic == inboxTopic {
            onInboxMessage?(cleaned)
        }
    }
    
    private func scheduleReconnect() {
        reconnectTask?.cancel()
        let delay = reconnectBackoff
        reconnectBackoff = min(reconnectBackoff * 2, maxReconnect)
        reconnectTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard !userDisconnect else { return }
            await MainActor.run { performConnect() }
        }
    }
    
    private func parseCode(_ payload: String) -> Int {
        guard let range = payload.range(of: "\"code\"") else { return 500 }
        let after = payload[range.upperBound...]
        guard let colon = after.firstIndex(of: ":") else { return 500 }
        let numPart = after[after.index(after: colon)...].prefix(10)
        return Int(String(numPart.filter { $0.isNumber || $0 == "-" })) ?? 500
    }
    
    private func parseMessage(_ payload: String) -> String {
        guard let range = payload.range(of: "\"message\"") else { return "" }
        let after = String(payload[range.upperBound...])
        guard let q1 = after.firstIndex(of: "\""),
              let q2 = after[after.index(after: q1)...].firstIndex(of: "\"") else { return "" }
        return String(after[after.index(after: q1)..<q2])
    }
    
    private func parseData(_ payload: String) -> String? {
        guard let range = payload.range(of: "\"data\"") else { return nil }
        let after = String(payload[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard after.first == ":" else { return nil }
        let rest = String(after.dropFirst()).trimmingCharacters(in: .whitespacesAndNewlines)
        if rest.hasPrefix("null") { return nil }
        if rest.hasPrefix("{") || rest.hasPrefix("[") {
            var depth = 0
            for (i, c) in rest.enumerated() {
                if c == "{" || c == "[" { depth += 1 }
                else if c == "}" || c == "]" {
                    depth -= 1
                    if depth == 0 { return String(rest.prefix(i + 1)) }
                }
            }
        }
        return nil
    }
}

/// CocoaMQTT 回调桥接
private class MChatMQTTDelegate: NSObject, CocoaMQTTDelegate {
    private weak var connection: MChatConnection?
    init(connection: MChatConnection) { self.connection = connection }
    
    func mqtt(_ mqtt: CocoaMQTT, didConnectAck ack: CocoaMQTTConnAck) {
        guard ack == .accept else {
            Task { @MainActor in
                connection?.setState(.error("Connect rejected"))
            }
            return
        }
        Task { @MainActor in
            connection?.didConnect()
        }
    }
    
    func mqttDidDisconnect(_ mqtt: CocoaMQTT, withError err: Error?) {
        Task { @MainActor in
            connection?.didDisconnect(err)
        }
    }
    
    func mqtt(_ mqtt: CocoaMQTT, didReceiveMessage message: CocoaMQTTMessage, id: UInt16) {
        let topic = message.topic
        let payload = message.string ?? ""
        Task { @MainActor in
            connection?.messageArrived(topic: topic, payload: payload)
        }
    }
    
    func mqtt(_ mqtt: CocoaMQTT, didSubscribeTopics success: NSDictionary, failed: [String]) {}
    func mqtt(_ mqtt: CocoaMQTT, didUnsubscribeTopics topics: [String]) {}
    func mqtt(_ mqtt: CocoaMQTT, didPublishMessage message: CocoaMQTTMessage, id: UInt16) {}
    func mqtt(_ mqtt: CocoaMQTT, didPublishAck id: UInt16) {}
    func mqttDidPing(_ mqtt: CocoaMQTT) {}
    func mqttDidReceivePong(_ mqtt: CocoaMQTT) {}
}
