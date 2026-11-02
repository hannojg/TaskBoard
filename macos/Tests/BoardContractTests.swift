import Foundation
import Testing
@testable import TaskBoardCore

struct BoardContractTests {
    private func fixture() throws -> Data {
        let url = Bundle.module.url(forResource: "board", withExtension: "json", subdirectory: "Fixtures")!
        return try Data(contentsOf: url)
    }

    private func response(status: Int = 200, type: String = "application/json") -> HTTPURLResponse {
        let url = URL(string: "https://example.com/api/board")!
        return HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": type])!
    }

    @Test func activeTasksAcrossProjectsAreRankedWithStableTies() throws {
        let data = try fixture()
        let response = response()
        let snapshot = try BoardClient.snapshot(data: data, response: response)
        let identifiers = snapshot.tasks.map(\.id)
        #expect(identifiers == ["high-first", "high-tie", "high-later", "high-no-date", "medium", "none"])
        #expect(snapshot.tasks[1].project == "Website")
        #expect(snapshot.tasks[0].description == "Keep focus visible.")
    }

    @Test func anEmptyBoardHasNoFocusTasks() throws {
        let data = Data(#"{"state":{"version":3,"projects":[],"tasks":[]}}"#.utf8)
        let response = response()
        let snapshot = try BoardClient.snapshot(data: data, response: response)
        #expect(snapshot.tasks.isEmpty)
    }

    @Test(arguments: [401, 403, 302, 500])
    func errorResponsesNeverAppearAsAnEmptyBoard(status: Int) throws {
        let data = try fixture()
        let response = response(status: status)
        #expect(throws: FocusError.self) {
            try BoardClient.snapshot(data: data, response: response)
        }
    }

    @Test func aLoginPageIsRejected() throws {
        let data = Data("<html>Sign in</html>".utf8)
        let response = response(type: "text/html")
        #expect(throws: FocusError.self) {
            try BoardClient.snapshot(data: data, response: response)
        }
    }

    @Test func unsupportedSchemaIsRejected() {
        let data = Data(#"{"state":{"version":4,"projects":[],"tasks":[]}}"#.utf8)
        let response = response()
        #expect(throws: FocusError.self) {
            try BoardClient.snapshot(data: data, response: response)
        }
    }

    @Test func credentialsAreNeverForwardedThroughRedirects() async {
        let client = BoardClient()
        let response = response(status: 302)
        let target = URL(string: "https://another-site.example/api/board")!
        let request = URLRequest(url: target)
        let task = URLSession.shared.dataTask(with: target)
        await withCheckedContinuation { continuation in
            client.urlSession(
                URLSession.shared,
                task: task,
                willPerformHTTPRedirection: response,
                newRequest: request
            ) { redirected in
                #expect(redirected == nil)
                continuation.resume()
            }
        }
        task.cancel()
    }
}
