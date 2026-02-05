import SwiftUI

struct ChatConversation: View {
    let peerId: String
    let peerName: String
    let messages: [ChatMessage]
    let errorText: String?
    let canSend: Bool
    let onBack: () -> Void
    let onSend: (String) -> Void
    
    @State private var inputText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                }
                Text("\(peerName) (\(peerId))")
                    .font(.headline)
                Spacer()
            }
            .padding(8)
            
            if let err = errorText {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
            }
            
            ChatMessageListCard(messages: messages)
                .frame(maxWidth: .infinity)
                .layoutPriority(1)
            
            HStack(alignment: .bottom, spacing: 8) {
                if #available(iOS 16.0, *) {
                    TextField("输入消息", text: $inputText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1...4)
                } else {
                    TextField("输入消息", text: $inputText)
                        .textFieldStyle(.roundedBorder)
                }
                Button {
                    let t = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !t.isEmpty && canSend {
                        onSend(t)
                        inputText = ""
                    }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                }
                .disabled(!canSend || inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(8)
        }
    }
}
