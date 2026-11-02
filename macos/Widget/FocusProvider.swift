import WidgetKit

struct FocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusEntry {
        let tasks = FocusSamples.tasks
        let snapshot = FocusSnapshot(tasks: tasks, updatedAt: .now)
        let state = FocusState.loaded(snapshot)
        return FocusEntry(date: .now, state: state)
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (FocusEntry) -> Void) {
        if context.isPreview {
            let entry = placeholder(in: context)
            completion(entry)
            return
        }
        Task {
            let entry = await load()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<FocusEntry>) -> Void) {
        Task {
            let entry = await load()
            let nextRefresh = Date.now.addingTimeInterval(15 * 60)
            let policy = TimelineReloadPolicy.after(nextRefresh)
            let timeline = Timeline(entries: [entry], policy: policy)
            completion(timeline)
        }
    }

    private func load() async -> FocusEntry {
        let state: FocusState
        do {
            let store = try ConnectionStore.shared()
            if let connection = try store.load() {
                let client = BoardClient()
                let snapshot = try await client.fetch(connection)
                state = .loaded(snapshot)
            } else {
                state = .notConnected
            }
        } catch {
            state = .failed(error.localizedDescription)
        }
        return FocusEntry(date: .now, state: state)
    }
}
