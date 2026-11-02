import SwiftUI
import WidgetKit

struct FocusWidgetContent: View {
    let entry: FocusEntry
    let family: WidgetFamily

    private var capacity: Int {
        switch family {
        case .systemSmall: 1
        case .systemLarge: 6
        default: 3
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "circle.inset.filled").foregroundStyle(.blue)
                Text("IN PROGRESS")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .tracking(1)
                Spacer(minLength: 0)
                if case .loaded(let snapshot) = entry.state {
                    Text("\(snapshot.tasks.count)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.secondary)
                }
            }
            switch entry.state {
            case .notConnected:
                message("Your focus, at a glance", detail: "Open TaskBoard Focus to connect your board.")
            case .failed:
                message("Board unavailable", detail: "Open TaskBoard Focus to reconnect or try again.")
            case .loaded(let snapshot):
                if snapshot.tasks.isEmpty {
                    message("Room to focus", detail: "Move a task to In progress when you’re ready.")
                } else {
                    taskList(snapshot)
                }
            }
        }
        .widgetURL(destination)
    }

    private var destination: URL {
        if family == .systemSmall, case .loaded(let snapshot) = entry.state,
           let task = snapshot.tasks.first {
            return task.url
        }
        return URL(string: "taskboard-focus://focus")!
    }

    private func taskList(_ snapshot: FocusSnapshot) -> some View {
        let visible = Array(snapshot.tasks.prefix(capacity))
        let remaining = snapshot.tasks.count - visible.count
        return VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 4) {
            ForEach(visible) { task in
                Link(destination: task.url) {
                    FocusWidgetRow(task: task, compact: family != .systemSmall)
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
            HStack {
                if remaining > 0 {
                    Text("+\(remaining) more").font(.caption2)
                }
                Spacer(minLength: 0)
                Text(snapshot.updatedAt, style: .time).font(.caption2)
            }
            .foregroundStyle(.secondary)
        }
    }

    private func message(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Spacer(minLength: 0)
            Text(title).font(.headline)
            Text(detail).font(.caption).foregroundStyle(.secondary)
            Spacer(minLength: 0)
        }
    }
}
