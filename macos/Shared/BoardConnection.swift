import Foundation

struct BoardConnection: Codable, Sendable {
    let url: URL
    let token: String
    let deviceId: UUID

    init(data: Data) throws {
        let decoder = JSONDecoder()
        let file: ConnectionFile
        do {
            file = try decoder.decode(ConnectionFile.self, from: data)
        } catch {
            throw FocusError.invalidConnection
        }
        let components = URLComponents(string: file.url)
        let token = file.token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components,
              components.scheme == "https",
              let host = components.host,
              host.isEmpty == false,
              components.user == nil,
              components.password == nil,
              token.isEmpty == false,
              token.rangeOfCharacter(from: .newlines) == nil else {
            throw FocusError.invalidConnection
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        guard let origin = components.url else { throw FocusError.invalidConnection }
        url = origin
        self.token = token
        deviceId = UUID()
    }

    func request() -> URLRequest {
        let endpoint = url.appendingPathComponent("api/board")
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer " + token, forHTTPHeaderField: "OAI-Sites-Authorization")
        let identifier = deviceId.uuidString
        request.setValue(identifier, forHTTPHeaderField: "X-TaskBoard-Device")
        request.setValue("TaskBoard%20Focus", forHTTPHeaderField: "X-TaskBoard-Name")
        return request
    }
}
