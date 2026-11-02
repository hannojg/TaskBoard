import SwiftUI

struct TaskMetadataView: View {
    let task: FocusTask

    var body: some View {
        HStack(spacing: 10) {
            if task.priority != "None" {
                Label(task.priority, systemImage: "flag.fill")
                    .foregroundStyle(task.priority == "High" ? .orange : .secondary)
            }
            if task.due.isEmpty == false {
                Label(task.due, systemImage: "calendar")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.caption)
    }
}
