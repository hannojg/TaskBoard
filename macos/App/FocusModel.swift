import Foundation
import Observation
import WidgetKit

@MainActor
@Observable
final class FocusModel {
    var state: FocusState = .notConnected
    var isLoading = false
    var selectedID: String?

    func refresh() async {
        guard isLoading == false else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let store = try ConnectionStore.shared()
            guard let connection = try store.load() else {
                state = .notConnected
                return
            }
            let client = BoardClient()
            let snapshot = try await client.fetch(connection)
            state = .loaded(snapshot)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func connect(from url: URL) async {
        guard isLoading == false else { return }
        isLoading = true
        defer { isLoading = false }
        let access = url.startAccessingSecurityScopedResource()
        defer {
            if access { url.stopAccessingSecurityScopedResource() }
        }
        do {
            let data = try Data(contentsOf: url)
            let connection = try BoardConnection(data: data)
            let client = BoardClient()
            let snapshot = try await client.fetch(connection)
            let store = try ConnectionStore.shared()
            try store.save(connection)
            selectedID = nil
            state = .loaded(snapshot)
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func disconnect() {
        do {
            let store = try ConnectionStore.shared()
            try store.remove()
            selectedID = nil
            state = .notConnected
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
