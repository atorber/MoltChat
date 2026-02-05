import SwiftUI

struct SettingsSheet: View {
    @ObservedObject var runtime: MChatRuntime
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        if #available(iOS 16.0, *) {
            NavigationStack {
                settingsForm
            }
        } else {
            NavigationView {
                settingsForm
            }
            .navigationViewStyle(.stack)
        }
    }
    
    private var settingsForm: some View {
        Form {
            Section {
                Text(statusText)
            } header: {
                Text("连接配置")
            } footer: {
                Text("填写员工连接信息后点击连接即可登录")
            }
            
            Section {
                TextField("Broker 地址", text: Binding(
                    get: { runtime.mqttBrokerUrl },
                    set: { runtime.mqttBrokerUrl = $0 }
                ), prompt: Text("tcp://主机:1883 或 ssl://主机:8883"))
                TextField("用户名（MQTT）", text: Binding(
                    get: { runtime.mqttUsername },
                    set: { runtime.mqttUsername = $0 }
                ))
                SecureField("密码", text: Binding(
                    get: { runtime.mqttPassword },
                    set: { runtime.mqttPassword = $0 }
                ))
                TextField("员工 ID", text: Binding(
                    get: { runtime.mchatEmployeeId },
                    set: { runtime.mchatEmployeeId = $0 }
                ), prompt: Text("与管理员下发的 employee_id 一致"))
            }
            
            Section {
                if runtime.isConnected {
                    Button("断开连接", role: .destructive) {
                        runtime.disconnect()
                    }
                } else {
                    Button("连接") {
                        runtime.connect()
                    }
                    .disabled(
                        runtime.mqttBrokerUrl.trimmingCharacters(in: .whitespaces).isEmpty ||
                        runtime.mqttUsername.trimmingCharacters(in: .whitespaces).isEmpty ||
                        runtime.mchatEmployeeId.trimmingCharacters(in: .whitespaces).isEmpty
                    )
                }
            }
        }
        .navigationTitle("设置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("完成") { dismiss() }
            }
        }
    }
    
    private var statusText: String {
        switch runtime.connectionState {
        case .disconnected: return "状态：未连接"
        case .connecting: return "状态：连接中…"
        case .connected: return "状态：已连接"
        case .error(let msg): return "状态：错误: \(msg)"
        }
    }
}
