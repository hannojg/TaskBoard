// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TaskBoardFocus",
    platforms: [.macOS(.v14)],
    products: [.library(name: "TaskBoardCore", targets: ["TaskBoardCore"])],
    targets: [
        .target(name: "TaskBoardCore", path: "Shared"),
        .testTarget(
            name: "TaskBoardCoreTests",
            dependencies: ["TaskBoardCore"],
            path: "Tests",
            resources: [.copy("Fixtures")]
        )
    ]
)
