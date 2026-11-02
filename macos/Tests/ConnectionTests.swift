import Foundation
import Testing
@testable import TaskBoardCore

struct ConnectionTests {
    @Test func exportImportsWithoutReusingAnotherDevicesIdentity() throws {
        let data = Data(#"{"url":"https://board.example/path?q=1#x","token":" secret ","deviceId":"00000000-0000-0000-0000-000000000000"}"#.utf8)
        let connection = try BoardConnection(data: data)
        let request = connection.request()
        #expect(request.url?.absoluteString == "https://board.example/api/board")
        #expect(request.httpMethod == "GET")
        #expect(request.httpBody == nil)
        #expect(request.value(forHTTPHeaderField: "OAI-Sites-Authorization") == "Bearer secret")
        #expect(connection.deviceId.uuidString != "00000000-0000-0000-0000-000000000000")
    }

    @Test(arguments: [
        #"{"url":"http://board.example","token":"secret"}"#,
        #"{"url":"https://user:password@board.example","token":"secret"}"#,
        #"{"url":"https://board.example","token":"  "}"#,
        #"{"url":"file:///tmp/board","token":"secret"}"#,
        #"{"url":"https://board.example","token":"secret\r\nheader"}"#
    ])
    func invalidConnectionsAreRejected(json: String) {
        let data = Data(json.utf8)
        #expect(throws: (any Error).self) {
            try BoardConnection(data: data)
        }
    }

    @Test func sharedStoragePreservesIdentityAndDisconnectRemovesCredentials() throws {
        let manager = FileManager.default
        let identifier = UUID().uuidString
        let directory = manager.temporaryDirectory.appendingPathComponent(identifier)
        defer { try? manager.removeItem(at: directory) }
        let store = ConnectionStore(directory: directory)
        let data = Data(#"{"url":"https://board.example","token":"secret"}"#.utf8)
        let connection = try BoardConnection(data: data)
        let missing = try store.load()
        #expect(missing == nil)
        try store.save(connection)
        let loaded = try store.load()
        #expect(loaded?.deviceId == connection.deviceId)
        #expect(loaded?.token == "secret")
        let file = directory.appendingPathComponent("focus-connection.json")
        let attributes = try manager.attributesOfItem(atPath: file.path)
        #expect(attributes[.posixPermissions] as? Int == 0o600)
        try store.remove()
        let removed = try store.load()
        #expect(removed == nil)
        try store.remove()
    }

    @Test func taskLinksRoundTrip() {
        let task = FocusTask(id: "task / spaces ? & #", title: "Task", description: "", project: "Project", priority: "None", due: "")
        let identifier = FocusTask.identifier(from: task.url)
        #expect(identifier == task.id)
        let unrelated = URL(string: "https://example.com/tasks/123")!
        #expect(FocusTask.identifier(from: unrelated) == nil)
    }
}
