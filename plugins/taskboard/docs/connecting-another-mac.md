# Connect another Mac to your shared board

Each Mac installs the same public TaskBoard plugin. A separate, private connection file grants access to your shared board. The Macs can use different Codex accounts.

You need Codex for macOS, its `codex` command, and an existing TaskBoard Shared board. For your first board, follow [Create your first board](creating-a-board.md). Installing the public plugin does not grant access to someone else's board.

## 1. Export the connection on a connected Mac

In a Codex chat with TaskBoard installed, ask:

> Use the TaskBoard skill to export my private board connection file to Downloads. Do not display the access key.

TaskBoard creates `~/Downloads/TaskBoard-connection.json` and provides a link to it. Exporting again reuses an identical file. If a different board's connection file already exists at that location, choose another output path.

This file contains the Site address and access key. It grants read and write access to the whole board. It does not contain your Codex sign-in, projects, tasks, or the exporting Mac's device identity.

## 2. Transfer the file privately

Transfer `TaskBoard-connection.json` to a trusted Mac using AirDrop, an encrypted file transfer, or another private channel. Put the received file in that Mac's **Downloads** folder.

Keep this file out of the Git repository, GitHub issues, public messages and screenshots. Do not paste its contents into a chat. Transfer the exported file, rather than copying `~/Library/Application Support/TaskBoard/connection.json`: the latter contains the original Mac's device identity.

## 3. Install the plugin from GitHub

On the new Mac, add this repository as a marketplace in Codex's plugin settings:

```text
https://github.com/hannojg/TaskBoard
```

Select the **TaskBoard** marketplace and install **TaskBoard**. If you prefer Terminal, run:

```sh
codex plugin marketplace add hannojg/TaskBoard
codex plugin add taskboard@taskboard-local
```

The repository includes the built plugin. No source build or separate Node installation is required. Open **TaskBoard** from the sidebar after installing.

## 4. Import the private file

TaskBoard opens a welcome screen with two choices. Click **Connect to an existing board** and select the received `TaskBoard-connection.json` in Codex's file picker. **Create a new board** creates separate storage; use the connection option to share the board you already have.

TaskBoard reads the file locally, checks access to the shared board, saves the connection privately on this Mac, and opens the board immediately. The access key is not sent to the embedded page or chat. If you cancel the picker, the setup screen remains available. If the file is invalid or access fails, the screen explains the problem and lets you choose again; failed validation does not replace existing settings.

Setup generates a distinct identity for the new Mac. Reconnecting a previously configured Mac preserves its existing identity. Connection settings are stored outside the plugin cache with owner-only file permissions, so plugin updates preserve them.

After confirming the new Mac can open the board, you can delete the transferred copy from Downloads. Deleting this exported copy does not disconnect an already configured Mac.

## 5. Link this Mac's local projects

Choose **Sync Codex projects** and let the agent refresh the picker. For a shared project that already exists, edit that project and choose its Codex project on this Mac. This adds the local folder mapping without replacing the other Mac's mapping.

Use **Sync chats** to refresh this Mac's chat picker. Existing chat links stay attached to their owning Mac. Sharing the board does not grant one Codex account access to the other account's chats.

Project names, tasks and column order are shared. Use **Refresh board** to load another Mac's changes. Editing requires an internet connection; a stale save is rejected so it cannot overwrite someone else's changes.

## Update the plugin

Refresh the Git marketplace and install its latest version:

```sh
codex plugin marketplace upgrade taskboard-local
codex plugin add taskboard@taskboard-local
```

Reload Codex afterward. The private connection file does not need to be imported again. These commands follow Codex's [marketplace update flow](https://developers.openai.com/plugins/build/plugins).

If this Mac previously installed TaskBoard from a local checkout or transfer bundle, replace that marketplace registration once:

```sh
codex plugin marketplace remove taskboard-local
codex plugin marketplace add hannojg/TaskBoard
codex plugin add taskboard@taskboard-local
```

This changes the plugin's update source. It leaves the imported board connection and shared board data in place.

## Troubleshooting

- **The skill is unavailable:** install TaskBoard and start a new Codex chat.
- **The connection file cannot be found:** locate the received file in Finder, then select it with **Connect to an existing board**.
- **Access is denied:** obtain a current export from a Mac that can still access the board and select that file. Existing settings remain unchanged if validation fails.
- **The board changed elsewhere:** choose **Refresh board**, then reapply your edit.
- **Projects have no local folders:** sync this Mac's Codex projects and link them as described above.
