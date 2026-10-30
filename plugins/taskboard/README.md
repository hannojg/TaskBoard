# TaskBoard

A Codex desktop plugin for one shared project and task overview across Macs, including Macs signed in to different Codex accounts. Projects live in the sidebar; the overview groups tasks by project or status. Tasks support Markdown descriptions, priorities, due dates, GitHub issue imports and links to Codex chats.

The plugin is public. Your board is private and requires a separate connection file.

## Install

Add this GitHub repository as a marketplace in Codex's plugin settings, then install **TaskBoard**:

```text
https://github.com/hannojg/TaskBoard
```

Or use the Codex CLI:

```sh
codex plugin marketplace add hannojg/TaskBoard
codex plugin add taskboard@taskboard-local
```

The installable bundle is committed under `plugins/taskboard/`, so installation does not require a build. This plugin requires Codex for macOS and uses its bundled Node runtime.

## Connect to your board

1. On a Mac already connected to the board, ask Codex: **“Use the TaskBoard skill to export my private board connection file to Downloads. Do not display the access key.”**
2. Transfer `TaskBoard-connection.json` privately to the new Mac's Downloads folder.
3. Install TaskBoard on the new Mac and start a new chat. Ask: **“Use the TaskBoard skill to connect this Mac with ~/Downloads/TaskBoard-connection.json. Do not display the file contents or access key.”**
4. Reload Codex and open **TaskBoard** from the sidebar.

The exported file grants read and write access to the shared board. Keep it private. It is never included in this repository or the plugin bundle.

See [Connect another Mac](docs/connecting-another-mac.md) for the full walkthrough, local project linking, updates and troubleshooting. A new installation requires access to an existing TaskBoard Shared Site; installing the public plugin does not provision a hosted board.

## Updates

```sh
codex plugin marketplace upgrade taskboard-local
codex plugin add taskboard@taskboard-local
```

Reload Codex after updating. Connection settings and this Mac's device identity are stored outside the plugin cache and survive updates. If you previously installed from a local checkout or transfer bundle, follow the guide's [one-time marketplace migration](docs/connecting-another-mac.md#update-the-plugin).

## Using the board

Open **TaskBoard** from Codex's plugin sidebar. A separate entrypoint opens it beside a chat. Project and status views share the same tasks and column order. Drag a column's handle to reorder it, or focus the handle and press Alt+Left/Right.

**Sync Codex projects** asks the agent to refresh the project picker. Edit an existing shared project to link its local Codex project on this Mac. **Sync chats** refreshes recent chat metadata; **Reload list** loads that catalog without discarding unsaved task edits. The embedded page uses TaskBoard tools; project and chat discovery runs through the agent.

Linked chats can be searched, attached and opened from cards or the task editor. **Create agent chat** saves the ticket and opens an unsent Codex draft containing its context. Opening a draft does not create a chat relation; after you send it, the agent can link the confirmed chat back to the ticket. Chat activity does not automatically change task status.

**Import from GitHub** previews an issue URL or searches a repository, then imports the selected issue. It requires the GitHub CLI to be installed and signed in. These requests are read-only. Imported title, body, labels and open/closed state form a source snapshot; local notes, title, workflow status and chat links remain independent. **Refresh from GitHub** updates only that snapshot. Reimporting an issue opens its existing task.

## Storage and privacy

One private OpenAI Site and its D1 database store the shared board. Each Mac has a separate identity, project bindings and project/chat catalogs. Native chat links retain their owning Mac, avoiding collisions between identical local chat IDs.

Saves require an internet connection. Revision checks reject stale changes; **Refresh board** loads the latest saved data. Connection errors do not create an offline board.

Local settings live at `~/Library/Application Support/TaskBoard/connection.json`, with owner-only file permissions. The transferable file contains only the Site address and access key. Do not copy the complete local settings file to another Mac, since it also contains this Mac's identity. `TASKBOARD_DATA_DIR` selects an isolated settings directory for development.

## Development

Development requires Node.js 22.13 or newer and the Codex CLI:

```sh
npm ci
npm test
npm run build
node scripts/smoke.mjs
npm run package
npm run install:local
```

`npm run package` regenerates `plugins/taskboard/` and the marketplace catalog. Commit the updated bundle alongside source changes and bump the version in the manifests and runtime entrypoints before publishing an update. The packaged bundle includes the same connection and export scripts as the source checkout. `npm run check:host` verifies the installed plugin against the configured board without writing board data.

From a source checkout, the underlying connection commands are:

```sh
node scripts/share-connection.mjs
node scripts/connect.mjs "$HOME/Downloads/TaskBoard-connection.json"
```

Exporting creates a private file in Downloads. An optional output path is accepted; an identical existing export is reused, and a different connection file is never overwritten. Importing generates a new device ID on a new Mac and preserves the ID on reconnection. Use the bundled skill for setup when Node is not installed separately.

`node scripts/migrate-shared.mjs` imports the previous local SQLite board into an empty shared board and refuses to overwrite existing shared changes. The original database is retained as a migration snapshot; the plugin no longer uses it for board storage.

The shared API source is `src/cloud/board-api.mjs`. `npm run build` also bundles it into `site/lib/board-api.mjs`. The `site/` directory contains the OpenAI Sites deployment source, currently linked to the maintainer's private Site. To host your own board, provision your own private Site and use its project ID and service access credential. Generate schema migrations from `site/` with `npm run db:generate`, then publish through the Sites workflow. Publishing this Git repository does not publish the Site or expose its board data.
