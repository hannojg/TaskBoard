# TaskBoard workflow

- Validate plugin releases through the public GitHub marketplace. The user updates the test Mac manually; do not sideload fixes or run plugin updates on their Macs.
- Use SSH on the other Mac for investigation only unless the user explicitly requests a change. Do not copy or import a private connection file as part of diagnosis.
- Run local unit, protocol and UI checks before publishing. Commit the regenerated `plugins/taskboard/` bundle with source changes.
