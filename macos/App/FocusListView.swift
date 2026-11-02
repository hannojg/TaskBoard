import SwiftUI

struct FocusListView: View {
    let snapshot: FocusSnapshot
    @Binding var selectedID: String?

    var body: some View {
        NavigationSplitView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("In progress")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text("\(snapshot.tasks.count) active · one thing at a time")
                        .foregroundStyle(.secondary)
                }
                .padding(20)
                List(snapshot.tasks, selection: $selectedID) { task in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(task.title).font(.headline).lineLimit(2)
                        Text(task.project).font(.subheadline).foregroundStyle(.secondary)
                        TaskMetadataView(task: task)
                    }
                    .padding(.vertical, 6)
                    .tag(task.id)
                }
                Text("Updated \(snapshot.updatedAt, style: .time)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding()
            }
            .navigationSplitViewColumnWidth(min: 260, ideal: 300)
        } detail: {
            if snapshot.tasks.isEmpty {
                ContentUnavailableView {
                    Label("A clear focus list", systemImage: "checkmark.circle")
                } description: {
                    Text("Move a task to In progress in TaskBoard when you’re ready to work on it.")
                }
            } else if let task = snapshot.tasks.first(where: { $0.id == selectedID }) {
                FocusDetailView(task: task)
            } else {
                ContentUnavailableView {
                    Label(
                        selectedID == nil ? "Choose your next task" : "This task is no longer in progress",
                        systemImage: "cursorarrow.click"
                    )
                } description: {
                    Text("Pick an active task from the list. Manage your board in Codex.")
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack {
                Text("Add the In progress widget: right-click your desktop → Edit Widgets → TaskBoard Focus.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(12)
            .background(.bar)
        }
    }
}
