# Automatic backup to Google Drive

Mom's phone sends the store backup to your Google Drive by itself: at most once an hour, only
when something changed, and only with internet. She never sees anything. This guide sets up the
Google side once. It's free and needs only your normal Google account.

Do steps 1–7 on a computer, signed in to the Google account whose Drive should hold the backups.

## 1. Create the script

1. Open <https://script.google.com> and click **New project**.
2. Click **Untitled project** at the top and rename it to `Bebie's Store backup`.
3. In `Code.gs`, select all the sample code and delete it.
4. Open [`Code.js`](Code.js) here on GitHub, click **Raw**, copy everything, and paste it into
   `Code.gs`.

## 2. Make your secret code

1. Make up a code of 20 or more random letters and numbers (no spaces or symbols), for example
   from a password generator.
2. In the pasted code, replace `PASTE-YOUR-SECRET-HERE` with it. Keep the quotes around it.
3. Save with Ctrl+S (Cmd+S on a Mac).

Keep the code somewhere safe; it goes into the phone link in step 5. Never put it on GitHub.

## 3. Approve and run the setup

1. In the toolbar, pick `setup` in the function dropdown, then click **Run**.
2. Google asks for permission. Click **Review permissions** and pick your account.
3. You'll see "Google hasn't verified this app". That's normal for a script you wrote yourself.
   Click **Advanced**, then **Go to Bebie's Store backup (unsafe)**, then **Allow**.
4. Check that it worked:
   - Your Google Drive now has a folder called **Bebie's Store backups**.
   - In Apps Script, the clock icon (**Triggers**) on the left shows `nightly`, daily at 11pm.

## 4. Publish it as a web app

1. Click **Deploy** → **New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
   ("Anyone" lets Mom's phone reach it without signing in; the secret code keeps others out.)
4. Click **Deploy**, then copy the **Web app URL**. It ends with `/exec`.

## 5. Build the setup link

The link is:

```
https://bebie-store.vercel.app/#sync=<web app URL, encoded>&key=<your secret code>
```

To encode the URL, open any browser tab, press F12 (or right-click → Inspect) → **Console**, and
run:

```js
'https://bebie-store.vercel.app/#sync=' +
  encodeURIComponent('PASTE-WEB-APP-URL') +
  '&key=PASTE-SECRET'
```

Copy the result, without the quotes around it.

## 6. Connect Mom's phone

1. Send the link to Mom's phone in a way only you can see (for example, message yourself and
   open it on her phone, then delete the message).
2. Open the link in **Chrome**, the browser the app was installed from. The store opens normally;
   nothing about backups shows.
3. Close that tab. The installed app shares the same data, so it's connected too.

## 7. Check it worked

Within a minute, a file like `bebie-store-2026-10-15.json` appears in **Bebie's Store backups**.
That's it.

## How it behaves

- **Files:** one per day; later uploads that day replace that day's file. Files older than 30 days
  are deleted every night.
- **Alert:** if nothing arrives for 2 days, you get an email at 11pm. Usually it just means the
  phone was offline; open the app with internet on.
- **Restoring:** on the new phone, install the app, download the newest file from Drive, then
  More → Restore → pick the file. Syncing reconnects by itself, because the file carries the setup.

## Changing the script later

After editing the code: **Deploy** → **Manage deployments** → pencil icon → Version: **New
version** → **Deploy**. This keeps the same URL, so Mom's phone needs nothing.

## Troubleshooting

- **No file after a few minutes:** make sure Mom's phone has internet and the app was opened. Then
  in Apps Script open **Executions** on the left and look for errors.
- **Executions show `wrong key`:** the secret in the link and in the script differ. Fix the script
  (and deploy a new version), or open a new link on her phone.
- **No executions at all:** the URL in the link is wrong, or the deployment's access isn't
  **Anyone**.
