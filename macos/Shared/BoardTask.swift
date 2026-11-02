import Foundation

struct BoardTask: Decodable, Sendable {
    let id: String
    let title: String
    let description: String
    let priority: String
    let due: String
    let projectId: String
    let statusId: String
}
