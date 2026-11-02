# TaskBoard Focus for macOS

A native SwiftUI companion with WidgetKit desktop and Notification Center widgets. Requires macOS 14 or newer and Xcode 16 or newer.

The companion reads your existing shared TaskBoard API. It needs no plugin or Site update. It shows only saved tasks whose status is **In progress**, across all projects. High priority comes first, then Medium, Low and None; within each priority, earlier due dates come first, followed by undated tasks. Ties keep their board order.

## Build and run

1. Open `TaskBoardFocus.xcodeproj` in Xcode.
2. Select your Apple development team in **Signing & Capabilities** for **both** TaskBoardFocus and TaskBoardWidget. Both must use the same team.
3. Run the **TaskBoardFocus** scheme on **My Mac**.

The App Group is `$(DEVELOPMENT_TEAM).com.hannojg.TaskBoardFocus`. Xcode expands the same value into both targets’ entitlements and Info.plist files. This uses the macOS team-prefixed App Group format. No manually registered group is needed. Unsigned builds are useful for compilation checks; a signed build is needed to validate the shared container and widget on your Mac.

## Connect your board

1. In Codex, ask: **“Use the TaskBoard skill to export my private board connection file to Downloads. Do not display the access key.”**
2. In TaskBoard Focus, choose **Choose connection file…** and select the exported `TaskBoard-connection.json`.
3. Right-click your desktop, select **Edit Widgets**, search for **TaskBoard Focus**, and add **In progress** in small, medium or large size. You can also add it in Notification Center.

The small widget shows the first task, medium shows three, and large shows six. Additional tasks appear as a count. Click a task to view its details in the companion. Widget links don’t change status or create a Codex chat. Manage tasks in TaskBoard in Codex.

## Refresh behavior

The widget fetches the board independently, including when the companion is closed. It asks WidgetKit to refresh after 15 minutes. macOS decides when to honor that request, so this is not a live status display. The time at the bottom records the last successful load. Open the companion and choose **Refresh** to fetch immediately and request a widget reload. The companion also refreshes when its window becomes active.

Disconnected, empty and unavailable boards have separate states. Failed requests show an unavailable state instead of cached tasks. The companion never writes to the board.

## Connection privacy

The app validates access before saving the connection. Credentials stay in a private App Group file shared only by the companion and its widget, with owner-only file permissions. They are not put in widget URLs or timelines. The companion creates its own device identity and leaves the Codex plugin’s connection settings untouched. **Board → Disconnect** deletes the companion’s saved connection and requests a widget reload. Remove any desktop widget too if you need its already-rendered content gone immediately.

## Checks

```sh
swift test --package-path macos
xcodebuild -project macos/TaskBoardFocus.xcodeproj \
  -scheme TaskBoardFocus -configuration Debug \
  -derivedDataPath macos/build CODE_SIGNING_ALLOWED=NO build
```

Run these commands from the repository root. Swift tests cover the shared API contract, status filtering, stable ordering, connection validation, file permissions, disconnect, rejected redirects and task links. The Node suite checks that the Swift fixture round-trips through the actual shared API. CI compiles the app and embedded widget on macOS without signing. Signed gallery rendering and a live board connection still need a manual check before distributing a release.

This is a separate app, not part of the Codex plugin bundle. Distribution requires signing and notarizing the containing app and its embedded widget.
