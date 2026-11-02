import Foundation

enum FocusError: LocalizedError {
    case invalidConnection
    case sharedContainerUnavailable
    case accessDenied
    case invalidResponse
    case serverUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidConnection:
            "Choose a TaskBoard connection file with a valid HTTPS Site address and access key."
        case .sharedContainerUnavailable:
            "The shared widget container is unavailable. Check App Groups and signing for both targets in Xcode."
        case .accessDenied:
            "Board access was denied. Reconnect using a current TaskBoard connection file."
        case .invalidResponse:
            "The Site did not return compatible TaskBoard data. Check your board connection."
        case .serverUnavailable:
            "Could not reach your board. Check your internet connection and try again."
        }
    }
}
