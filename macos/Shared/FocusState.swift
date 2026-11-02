import Foundation

enum FocusState: Sendable {
    case notConnected
    case loaded(FocusSnapshot)
    case failed(String)
}
