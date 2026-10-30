# Link Asana tickets

TaskBoard explicitly references the official **Asana** plugin as an optional connection. Its setup and linking requests select that plugin directly. Other TaskBoard features work without Asana, and you do not need a separate Asana developer application or personal access token.

1. Open **Asana…** in TaskBoard's sidebar and choose **Check Asana connection**. Codex checks the connection and helps you install/connect Asana when needed.
2. Paste an Asana task link, choose its TaskBoard project and click **Link ticket through Codex**. From a new ticket, the **Asana icon** at the top also preserves the selected workflow status.
3. Codex reads the selected task and creates its linked board entry. Linking the same Asana task again opens the existing ticket.

The connection check succeeds only after Asana can be read inside that chat. A legacy MCP configuration or an external connection test does not establish this access. If the official plugin is installed but its tools are missing from the chat, start a new chat with Asana selected or reload Codex, then retry. Account and workspace availability still apply; TaskBoard cannot bypass them.

Asana owns the title and description. They are read-only in TaskBoard, and the title on the card opens the original Asana task. Edit those fields in Asana, then refresh. TaskBoard keeps its own workflow status, priority, due date, references and Codex chat links. Refreshing source content preserves that extra context.

Use **Refresh linked tickets** to request a refresh through Codex, or **Save and refresh from Asana** inside a ticket to save local edits first. **Set up hourly sync** asks Codex to configure recurring refreshes on this Mac. Codex verifies the connections and existing schedules before creating one. The schedule also includes tickets linked later. Keep Codex and its connections available on the Mac running the schedule.

The board reloads saved changes every five seconds while visible and no editor is open. That reload displays results already saved by Codex; Asana reads run when requested or by the configured schedule. Unsaved editor contents are preserved.

If a source cannot be read, its last successful sync time and an error remain visible. It stays owned by Asana. **Remove from board** removes only the TaskBoard entry.

Existing shared boards need the current Site API bundle as well as the updated plugin. If the Site does not advertise Asana support, TaskBoard disables linking until it is updated. Asana source data is stored in the same private shared board as its linked chats and references; link only tasks intended for that board's audience.
