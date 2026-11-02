import Foundation

struct ConnectionStore: Sendable {
    let directory: URL

    static func shared() throws -> ConnectionStore {
        let identifier = Bundle.main.object(forInfoDictionaryKey: "TaskBoardAppGroup") as? String
        guard let identifier, identifier.isEmpty == false else {
            throw FocusError.sharedContainerUnavailable
        }
        let manager = FileManager.default
        let directory = manager.containerURL(forSecurityApplicationGroupIdentifier: identifier)
        guard let directory else { throw FocusError.sharedContainerUnavailable }
        return ConnectionStore(directory: directory)
    }

    func load() throws -> BoardConnection? {
        let file = directory.appendingPathComponent("focus-connection.json")
        let data: Data
        do {
            data = try Data(contentsOf: file)
        } catch CocoaError.fileReadNoSuchFile {
            return nil
        }
        let decoder = JSONDecoder()
        return try decoder.decode(BoardConnection.self, from: data)
    }

    func save(_ connection: BoardConnection) throws {
        let manager = FileManager.default
        try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent("focus-connection.json")
        let encoder = JSONEncoder()
        let data = try encoder.encode(connection)
        try data.write(to: file, options: [.atomic, .completeFileProtection])
        try manager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }

    func remove() throws {
        let file = directory.appendingPathComponent("focus-connection.json")
        do {
            try FileManager.default.removeItem(at: file)
        } catch CocoaError.fileNoSuchFile {
            return
        }
    }
}
