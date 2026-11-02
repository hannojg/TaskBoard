import SwiftUI
import WidgetKit

struct FocusWidgetView: View {
    let entry: FocusEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        FocusWidgetContent(entry: entry, family: family)
    }
}
