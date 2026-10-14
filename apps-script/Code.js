// Bebie's Store: saves the phone's backups to Google Drive.
// Setup steps: apps-script/README.md in https://github.com/janing06/bebie-store

const SECRET = 'PASTE-YOUR-SECRET-HERE'
const FOLDER_NAME = "Bebie's Store backups"
const TIME_ZONE = 'Asia/Manila'
const KEEP_DAYS = 30
const ALERT_AFTER_DAYS = 2
const DAY_MS = 24 * 60 * 60 * 1000

/** Run once from the editor: approves permissions, makes the folder, schedules nightly(). */
function setup() {
  backupFolder()
  for (const trigger of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(trigger)
  ScriptApp.newTrigger('nightly').timeBased().everyDays(1).atHour(23).inTimezone(TIME_ZONE).create()
  PropertiesService.getScriptProperties().setProperty('lastReceivedAt', new Date().toISOString())
}

/** Called by the phone. Saves today's backup file, replacing an earlier one from today. */
function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  if (body.key !== SECRET) return reply({ ok: false, error: 'wrong key' })

  const gzip = Utilities.newBlob(Utilities.base64Decode(body.gzip), 'application/x-gzip')
  const json = Utilities.ungzip(gzip).getDataAsString('UTF-8')
  if (JSON.parse(json).app !== 'bebie-store') return reply({ ok: false, error: 'not a backup' })

  const day = Utilities.formatDate(new Date(body.exportedAt), TIME_ZONE, 'yyyy-MM-dd')
  const name = `bebie-store-${day}.json`
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const folder = backupFolder()
    const older = folder.getFilesByName(name)
    // The new file goes in before the old one is trashed, so a crash never leaves zero copies.
    folder.createFile(name, json, 'application/json')
    while (older.hasNext()) older.next().setTrashed(true)
    PropertiesService.getScriptProperties().setProperty('lastReceivedAt', new Date().toISOString())
  } finally {
    lock.releaseLock()
  }
  return reply({ ok: true })
}

/** Every night: trash old backups, and email the owner if the phone stopped sending. */
function nightly() {
  const files = backupFolder().getFiles()
  while (files.hasNext()) {
    const file = files.next()
    if (Date.now() - file.getLastUpdated().getTime() > KEEP_DAYS * DAY_MS) file.setTrashed(true)
  }

  const last = PropertiesService.getScriptProperties().getProperty('lastReceivedAt')
  if (Date.now() - Date.parse(last) > ALERT_AFTER_DAYS * DAY_MS) {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      "Bebie's Store: no backup for 2 days",
      `The last backup arrived ${last}. Open the app on Mom's phone with internet on.`,
    )
  }
}

function backupFolder() {
  const found = DriveApp.getFoldersByName(FOLDER_NAME)
  return found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME)
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
