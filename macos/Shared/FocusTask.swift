import Foundation

struct FocusTask: Identifiable, Sendable {
    let id: String
    let title: String
    let description: String
    let project: String
    let priority: String
    let due: String

    var priorityRank: Int {
        switch priority {
        case "High": 0
        case "Medium": 1
        case "Low": 2
        default: 3
        }
    }

    var url: URL {
        var components = URLComponents()
        components.scheme = "taskboard-focus"
        components.host = "tasks"
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        return components.url!
    }

    static func identifier(from url: URL) -> String? {
        guard url.scheme == "taskboard-focus", url.host == "tasks" else { return nil }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let item = components?.queryItems?.first { $0.name == "id" }
        guard let identifier = item?.value, identifier.isEmpty == false else { return nil }
        return identifier
    }
}
