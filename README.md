# StudyVault

An offline study workspace built with React Native, Expo, and local storage.

## Run

1. Run `npm install` (this also prepares the bundled PDF viewer).
2. Run `npx expo start --clear`.
3. Open the browser with `w`, or use Expo Go on a supported Android/iOS device.

Development tooling and the initial installation require a connection. Notes and
study tools use local data; the PDF viewer bundles its engine without a CDN.

## Features

- **Notes:** create and edit notes, attach files (20 MB per file), add code and
  output for Code Snippets, organize by module/folder/chapter, search and favorite.
- **File previews:** preview PDFs with page controls and common image formats
  inside the app. Other file types can be downloaded or opened with another app.
- **To Do:** create tasks, link notes, set High/Medium/Low priority, add due dates
  and reminders, complete/reopen tasks, filter lists, and remove tasks.
- **Study / Timer:** configurable focus sessions, a five-minute break, pause/resume,
  and automatic session logging. Timer deadlines survive navigation and reloads.
  A discarded session is not logged.
- **Study / Flashcards:** create question-and-answer cards, optionally link a note,
  filter by module, reveal answers, and record self-assessment.
- **Study / Calendar:** view task deadlines, add exams, and browse months/days.
- **Study / Statistics:** view study minutes and completed tasks for the last seven
  days, reviewed cards, and study time by module.
- **Settings & backup:** toggle persistent dark mode; export and restore notes,
  attachments, tasks, flashcards, exams, study sessions, and preferences as JSON.
  Restore validates the backup and requires confirmation before replacing data.
  Export the current data first if you want to keep a separate copy.

## Reminders

Enter a reminder as `YYYY-MM-DD HH:mm` in local device time and select **Enable
notifications**, then save the task. Due dates use `YYYY-MM-DD`.

Browser notifications and in-app reminders require StudyVault to stay open.
Android/iOS use local scheduled notifications after permission is granted;
actual delivery depends on device notification settings. No push server is used.
New notification plugin configuration requires rebuilding an existing custom
native development/release build. Verify reminder delivery on a physical device.

## Storage and migration

Android/iOS store data in SQLite (`studyvault.db`). The browser uses IndexedDB
(`studyvault-browser`). Upgrades retain existing data. Deleting a linked note
clears its links in tasks and flashcards while keeping those study items.
Browser data belongs to the site's origin and browser profile. Older browser
SQLite data is left untouched and is not automatically imported into IndexedDB.

Backup restores are transactional. Malformed backups are rejected, and a failed
write rolls back the restore. A backup is a plain JSON file containing your data,
including attachments; keep it in a trusted location.

## Checks

- `npm test`: storage migrations, tasks, reminders, backup validation and restore.
- `npx expo export --platform all`: web, Android, and iOS bundle validation.
- `node scripts/browser-check.cjs`: browser smoke checks against an exported
  `dist` build using headless Microsoft Edge on Windows. The script uses an
  isolated test browser profile and localhost port 8090; it never edits the
  normal app's browser database. Screenshots are written under `.preview`.

The PDF engine is generated from the installed `pdfjs-dist` package with
`node scripts/prepare-pdf.cjs`. Its Apache-2.0 license is preserved alongside the
generated modules in `src/generated`.
