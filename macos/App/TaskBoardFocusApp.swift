import SwiftUI

@main
struct TaskBoardFocusApp: App {
    @State private var model = FocusModel()

    var body: some Scene {
        Window("TaskBoard Focus", id: "focus") {
            FocusWindow(model: model)
        }
        .defaultSize(width: 780, height: 540)
    }
}
