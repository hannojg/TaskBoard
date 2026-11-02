import Foundation

struct FocusSnapshot: Sendable {
    let tasks: [FocusTask]
    let updatedAt: Date
}
