# Create a private TaskBoard board

Run this workflow only for an explicit create-board request carrying the setup request ID from TaskBoard. The UI action authorizes creating and publishing one private Site and connecting this Mac. Do not copy an existing board's credentials, import old task data, create a chat, or send messages to other chats.

## Read and resume the request

1. Call `taskboard_creation_status` with the exact request ID. Use its returned `sourceDirectory` as the setup workspace. The installed plugin root is three directories above this reference file.
2. If the request is complete, stop: this Mac is already connected. If its request ID is no longer active, stop without creating a Site.
3. Apply the Sites skill for all hosting operations. If Sites tools are unavailable, discover the Sites plugin through plugin management, mark this request `failed`, and explain the required connection or installation. Resume this same request after access is available.
4. Call `taskboard_update_creation` with status `provisioning`. Reuse any saved `projectId` and any `.openai/hosting.json` project ID. Never create another Site for this request if either already records an ID. If they differ, stop and reconcile the identities rather than overwrite one.

## Prepare the Site

5. For a new source directory, create it and initialize the Sites Vinext starter using the Sites skill's `project-setup.mjs` helper. For an existing Site, open its source and credentials through the Sites workflow before editing. Keep the source helper's returned checkout path when it selects one.
6. Run the installed TaskBoard helper, quoting its absolute paths:

   ```text
   sh <plugin-root>/scripts/launch-mcp.sh <plugin-root>/scripts/prepare-board.mjs <request-id>
   ```

   The helper overlays the TaskBoard API, status page, schema and generated migrations onto the starter, sets the logical D1 binding `DB`, and preserves a previously provisioned Site identity. It never copies the maintainer's Site ID or credentials. Do not replace the starter's build or publishing integration.
7. If no Site ID exists, call Sites `create_site` once, with `creation_intent: user_requested`. Use a unique slug such as `taskboard-<request-id>` and title `TaskBoard Shared`. Immediately persist the returned opaque ID into `.openai/hosting.json` and record it through `taskboard_update_creation`. Preserve `d1: "DB"` and `r2: "BUCKET"`. If interrupted after creation, recover that returned Site instead of creating another.
8. Install the starter's dependencies using the Sites helper. The bundled migrations are already generated, schema-only SQL; preserve them. Do not seed sample projects or tasks.

## Publish privately

9. Set this request's status to `publishing`, retaining its confirmed Site ID. Build, push source, package and publish through the Sites skill. Keep the Site owner-private. Reuse an existing saved version or deployment when resuming; confirm publication succeeds before connecting the plugin.
10. Call Sites `get_site` for this exact Site ID. Confirm it is the user's private Site and retain its returned `current_live_url` and `siwc_bypass_bearer_token` in tool-session memory only. If service access is unavailable, mark setup `failed` and explain the limitation; do not make the Site public or invent credentials.

## Connect this Mac without exposing the key

11. Launch the installed `scripts/complete-creation.mjs` with the bundled launcher in a retained terminal session with a PTY:

    ```text
    sh <plugin-root>/scripts/launch-mcp.sh <plugin-root>/scripts/complete-creation.mjs
    ```

12. After it prints `Board connection JSON on stdin (hidden).`, send one newline-terminated JSON object through stdin with these fields: `requestId`, `projectId`, `url`, `token`. Use only the exact IDs, live URL and service credential returned for this request's Site. Never put the token in command arguments, a temporary file, source, tool results, chat text or screenshots.
13. The helper validates board access, saves owner-only local connection settings with this Mac's device identity, and marks the request complete. It refuses to replace another saved board connection or a mismatched Site ID. TaskBoard detects the saved connection and opens the empty board automatically.
14. Confirm the saved request is complete through `taskboard_creation_status`. Report that the board is ready and provide its private Site URL. The user can export a private connection file later to connect additional Macs.

On failure, mark the request `failed` without copying logs or credentials into the status. Preserve its Site ID, source and deployment so **Retry creating board** resumes the existing work. Explain the actionable problem in the chat. Do not automatically install or update TaskBoard itself; the user tests plugin releases through GitHub.
