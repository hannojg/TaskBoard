import SwiftUI
import WidgetKit

@main
struct TaskBoardWidget: Widget {
    private let provider = FocusProvider()

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TaskBoardInProgress", provider: provider) { entry in
            FocusWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("In progress")
        .description("Keep your active TaskBoard work in sight.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
