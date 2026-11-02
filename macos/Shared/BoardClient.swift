import Foundation

final class BoardClient: NSObject, URLSessionTaskDelegate, Sendable {
    func fetch(_ connection: BoardConnection) async throws -> FocusSnapshot {
        let configuration = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let request = connection.request()
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw FocusError.serverUnavailable
        }
        guard let response = response as? HTTPURLResponse else { throw FocusError.invalidResponse }
        return try Self.snapshot(data: data, response: response)
    }

    static func snapshot(data: Data, response: HTTPURLResponse) throws -> FocusSnapshot {
        if response.statusCode == 401 || response.statusCode == 403 { throw FocusError.accessDenied }
        guard response.statusCode == 200 else { throw FocusError.serverUnavailable }
        let contentType = response.value(forHTTPHeaderField: "Content-Type")
        guard let contentType, contentType.contains("application/json") else {
            throw FocusError.invalidResponse
        }
        let board: BoardResponse
        do {
            let decoder = JSONDecoder()
            board = try decoder.decode(BoardResponse.self, from: data)
        } catch {
            throw FocusError.invalidResponse
        }
        guard board.state.version == 3 else { throw FocusError.invalidResponse }
        let tasks = board.state.focusTasks()
        return FocusSnapshot(tasks: tasks, updatedAt: .now)
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}
