import Foundation
import Security
import Combine

/// 安全存储连接配置，对标 Android SecurePrefs
final class SecurePrefs: ObservableObject {
    private let defaults = UserDefaults.standard
    private let keychainService = "com.atorber.moltchat"
    
    private func keychainKey(_ key: String) -> String { "\(keychainService).\(key)" }
    
    private func getKeychain(_ key: String) -> String? {
        let k = keychainKey(key)
        var result: AnyObject?
        let q: [String: Any] = [
            String(kSecClass): kSecClassGenericPassword,
            String(kSecAttrService): k,
            String(kSecReturnData): true,
            String(kSecMatchLimit): kSecMatchLimitOne
        ]
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func setKeychain(_ key: String, value: String) {
        let k = keychainKey(key)
        let data = value.data(using: .utf8)!
        let add: [String: Any] = [
            String(kSecClass): kSecClassGenericPassword,
            String(kSecAttrService): k,
            String(kSecValueData): data
        ]
        let deleteQuery: [String: Any] = [
            String(kSecClass): kSecClassGenericPassword,
            String(kSecAttrService): k
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        SecItemAdd(add as CFDictionary, nil)
    }
    
    @Published var mqttBrokerUrl: String {
        didSet {
            defaults.set(mqttBrokerUrl, forKey: "gateway.mqtt.brokerUrl")
        }
    }
    @Published var mqttUsername: String {
        didSet { defaults.set(mqttUsername, forKey: "gateway.mqtt.username") }
    }
    @Published var mqttPassword: String {
        didSet { setKeychain("gateway.mqtt.password", value: mqttPassword) }
    }
    @Published var mchatEmployeeId: String {
        didSet { defaults.set(mchatEmployeeId, forKey: "mchat.employeeId") }
    }
    
    init() {
        self.mqttBrokerUrl = defaults.string(forKey: "gateway.mqtt.brokerUrl")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.mqttUsername = defaults.string(forKey: "gateway.mqtt.username")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.mqttPassword = getKeychain("gateway.mqtt.password") ?? ""
        self.mchatEmployeeId = defaults.string(forKey: "mchat.employeeId")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    
    func setMqttBrokerUrl(_ value: String) {
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if mqttBrokerUrl != t { mqttBrokerUrl = t }
    }
    func setMqttUsername(_ value: String) {
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if mqttUsername != t { mqttUsername = t }
    }
    func setMqttPassword(_ value: String) {
        if mqttPassword != value { mqttPassword = value }
    }
    func setMchatEmployeeId(_ value: String) {
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if mchatEmployeeId != t { mchatEmployeeId = t }
    }
}
