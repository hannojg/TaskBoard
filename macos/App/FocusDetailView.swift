import SwiftUI

struct FocusDetailView: View {
    let task: FocusTask
    private let codexURL = URL(string: "codex://")!

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Label(task.project, systemImage: "folder")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(task.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                TaskMetadataView(task: task)
                Divider()
                if task.description.isEmpty {
                    Text("No description. You can add context in TaskBoard.")
                        .foregroundStyle(.secondary)
                } else {
                    Text(task.description).textSelection(.enabled)
                }
                Link("Open Codex", destination: codexURL)
                    .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(28)
        }
    }
}
