# Create your first board

Install TaskBoard from the [GitHub marketplace](../README.md#install), then open it from Codex's sidebar. On an unconnected Mac, the welcome screen offers **Create a new board** and **Connect to an existing board**.

Choose **Create a new board** if this is your first board. If you already have a board on another Mac, [connect using its private connection file](connecting-another-mac.md) instead.

## Create and connect

1. Click **Create a new board**. TaskBoard saves a setup request and sends it to the Codex chat.
2. Codex uses the **Sites** plugin to create and publish a private Site with a database. Sites must be installed and connected with access to create private Sites; the chat will explain any missing setup.
3. Keep TaskBoard open while setup runs. It displays progress and opens the empty board automatically once the private connection has been validated and saved on this Mac.

The Site remains private. The access key stays out of the embedded page, chat text and repository. Local connection settings are stored with owner-only file permissions outside the plugin cache, so plugin updates preserve your connection.

## Resume interrupted setup

Reopen TaskBoard to see the saved progress. If the chat stopped, choose **Continue setup in chat**. If setup reports a problem, resolve the issue shown in the chat and choose **Retry creating board**.

Both actions resume the saved request and its existing Site. They do not intentionally create another board. Keep the local TaskBoard settings and setup source in place while recovering an interrupted setup.

## Add another Mac

After your board opens, ask Codex to export its private connection file and transfer that file privately to the other Mac. On that Mac, install TaskBoard and choose **Connect to an existing board**. See the [full connection guide](connecting-another-mac.md).
