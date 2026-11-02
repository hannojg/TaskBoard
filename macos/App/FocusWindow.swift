import SwiftUI
import UniformTypeIdentifiers
import WidgetKit

struct FocusWindow: View {
    @Bindable var model: FocusModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openWindow) private var openWindow
    @State private var isImporting = false
    @State private var importError: String?

    var body: some View {
        Group {
            switch model.state {
            case .notConnected:
                connectionView
            case .failed(let message):
                ContentUnavailableView {
                    Label("Couldn’t load your board", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await model.refresh() } }
                    Button("Choose connection file…") { isImporting = true }
                }
            case .loaded(let snapshot):
                FocusListView(snapshot: snapshot, selectedID: $model.selectedID)
            }
        }
        .frame(minWidth: 660, minHeight: 420)
        .overlay(alignment: .topTrailing) {
            if model.isLoading { ProgressView().controlSize(.small).padding() }
        }
        .toolbar {
            ToolbarItem {
                Button("Refresh", systemImage: "arrow.clockwise") {
                    Task {
                        await model.refresh()
                        WidgetCenter.shared.reloadAllTimelines()
                    }
                }
                .keyboardShortcut("r")
                .disabled(model.isLoading)
            }
            ToolbarItem {
                Menu("Board", systemImage: "ellipsis.circle") {
                    Button("Connect to board…") { isImporting = true }
                    Button("Disconnect", role: .destructive) { model.disconnect() }
                }
                .disabled(model.isLoading)
            }
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json]) { result in
            switch result {
            case .success(let url):
                Task { await model.connect(from: url) }
            case .failure:
                importError = "Could not open the connection file. Try choosing it again."
            }
        }
        .alert("Couldn’t open file", isPresented: showingImportError) {
            Button("OK") { importError = nil }
        } message: {
            Text(importError ?? "")
        }
        .task(id: scenePhase) {
            if scenePhase == .active { await model.refresh() }
        }
        .onOpenURL { url in
            model.selectedID = FocusTask.identifier(from: url)
            openWindow(id: "focus")
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }

    private var showingImportError: Binding<Bool> {
        Binding(
            get: { importError != nil },
            set: { if $0 == false { importError = nil } }
        )
    }

    private var connectionView: some View {
        ContentUnavailableView {
            Label("Make room for focused work", systemImage: "circle.inset.filled")
        } description: {
            VStack(spacing: 12) {
                Text("See only your In progress tasks, on your desktop and in Notification Center.")
                Text("Export your private board connection from TaskBoard in Codex, then choose that file here.")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: 400)
        } actions: {
            Button("Choose connection file…") { isImporting = true }
                .buttonStyle(.borderedProminent)
                .disabled(model.isLoading)
        }
    }
}
