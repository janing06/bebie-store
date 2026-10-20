// Bebie's Store: saves the phone's backups to Google Drive.
// Setup steps: apps-script/README.md in https://github.com/janing06/bebie-store

const SECRET = 'PASTE-YOUR-SECRET-HERE'
const FOLDER_NAME = "Bebie's Store backups"
const TIME_ZONE = 'Asia/Manila'
const KEEP_FILES = 30 // one per day
const ALERT_AFTER_DAYS = 2
const DAY_MS = 24 * 60 * 60 * 1000

const LAST_RECEIVED = 'lastReceivedAt:' // + phone name; one per phone

/** Run once from the editor: approves permissions, makes the folder, schedules nightly(). */
function setup() {
  backupFolder()
  for (const trigger of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(trigger)
  ScriptApp.newTrigger('nightly').timeBased().everyDays(1).atHour(23).inTimezone(TIME_ZONE).create()
}

/** Called by a phone. Saves its backup file for today, replacing its earlier one from today. */
function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  if (body.key !== SECRET) return reply({ ok: false, error: 'wrong key' })

  const gzip = Utilities.newBlob(Utilities.base64Decode(body.gzip), 'application/x-gzip')
  const json = Utilities.ungzip(gzip).getDataAsString('UTF-8')
  if (JSON.parse(json).app !== 'bebie-store') return reply({ ok: false, error: 'not a backup' })

  // Cleaned again here: the name ends up in a file name.
  const phone = String(body.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20)
  const day = Utilities.formatDate(new Date(body.exportedAt), TIME_ZONE, 'yyyy-MM-dd')
  const name = `${filePrefix(phone)}${day}.json`
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const folder = backupFolder()
    // Listed before the new file exists, so only older copies get trashed. The new file goes in
    // before they are trashed, so a crash never leaves zero copies.
    const older = list(folder.getFilesByName(name))
    folder.createFile(name, json, 'application/json')
    for (const file of older) file.setTrashed(true)
    PropertiesService.getScriptProperties().setProperty(
      LAST_RECEIVED + phone,
      new Date().toISOString(),
    )
  } finally {
    lock.releaseLock()
  }
  return reply({ ok: true })
}

/** Every night: trash all but each phone's newest backups, and email if a phone stopped. */
function nightly() {
  // Grouped by phone (the name without its date), newest first by name. Counting files, not
  // days, so a long silence (a broken phone) can never empty a phone's backups.
  const byPhone = {}
  for (const file of list(backupFolder().getFiles())) {
    const match = file.getName().match(/^(bebie-store-.*)\d{4}-\d{2}-\d{2}\.json$/)
    if (!match) continue
    byPhone[match[1]] = byPhone[match[1]] || []
    byPhone[match[1]].push(file)
  }
  for (const files of Object.values(byPhone)) {
    files.sort((a, b) => b.getName().localeCompare(a.getName()))
    for (const file of files.slice(KEEP_FILES)) file.setTrashed(true)
  }

  const quiet = Object.entries(PropertiesService.getScriptProperties().getProperties())
    .filter(([key, last]) => key.startsWith(LAST_RECEIVED) && quietFor(last))
    .map(([key, last]) => `${key.slice(LAST_RECEIVED.length) || 'phone'}: last backup ${last}`)
  if (quiet.length > 0) {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      `Bebie's Store: no backup for ${ALERT_AFTER_DAYS} days`,
      `${quiet.join('\n')}\n\nOpen the app on that phone with internet on.`,
    )
  }
}

function quietFor(last) {
  return Date.now() - Date.parse(last) > ALERT_AFTER_DAYS * DAY_MS
}

function filePrefix(phone) {
  return phone ? `bebie-store-${phone}-` : 'bebie-store-'
}

function backupFolder() {
  const found = DriveApp.getFoldersByName(FOLDER_NAME)
  return found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME)
}

function list(iterator) {
  const items = []
  while (iterator.hasNext()) items.push(iterator.next())
  return items
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
