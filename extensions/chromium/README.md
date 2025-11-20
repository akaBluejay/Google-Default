# Gmail Default Account Setter (dev)

Local development build for setting a default Gmail account index and redirecting `gmail.com` to the selected `/u/<index>/` mailbox using Manifest V3 `declarativeNetRequest`.

Install (load unpacked):

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

Enable in Incognito (optional):

1. On `chrome://extensions`, click **Details** on the extension.
2. Toggle **Allow in Incognito**.

Notes:
- This is an early dev MVP. Emails are stored in `chrome.storage.local` as plaintext.
- dNR rules are used to redirect `gmail.com` requests to `mail.google.com/u/<index>/...`.
- Replace the `icons/*` placeholders with real PNGs.



