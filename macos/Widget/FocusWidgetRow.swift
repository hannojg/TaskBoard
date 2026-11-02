import SwiftUI

struct FocusWidgetRow: View {
    let task: FocusTask
    let compact: Bool

    private var accent: Color {
        if task.priority == "High" { return .orange }
        return .blue.opacity(0.6)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if compact {
                RoundedRectangle(cornerRadius: 2)
                    .fill(accent)
                    .frame(width: 3)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(compact ? .subheadline : .headline)
                    .fontWeight(.semibold)
                    .lineLimit(compact ? 1 : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 5) {
                    Text(task.project).lineLimit(1)
                    if task.priority == "High" {
                        Image(systemName: "flag.fill").foregroundStyle(.orange)
                            .accessibilityLabel("High priority")
                    }
                    if compact && task.due.isEmpty == false {
                        Spacer(minLength: 0)
                        Text(task.due).lineLimit(1)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}
