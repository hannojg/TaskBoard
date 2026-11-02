import Foundation

struct BoardState: Decodable, Sendable {
    let version: Int
    let projects: [BoardProject]
    let tasks: [BoardTask]

    func focusTasks() -> [FocusTask] {
        var result: [FocusTask] = []
        for task in tasks where task.statusId == "progress" {
            guard let project = projects.first(where: { $0.id == task.projectId }) else {
                continue
            }
            let item = FocusTask(
                id: task.id,
                title: task.title,
                description: task.description,
                project: project.name,
                priority: task.priority,
                due: task.due
            )
            result.append(item)
        }
        return result.sorted { left, right in
            if left.priorityRank != right.priorityRank {
                return left.priorityRank < right.priorityRank
            }
            if left.due.isEmpty != right.due.isEmpty {
                return right.due.isEmpty
            }
            return left.due < right.due
        }
    }
}
