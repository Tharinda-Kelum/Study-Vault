# StudyVault – Offline Academic Note & Lecture Hub

React Native + Expo + SQLite individual academic project. Fully offline after initial app installation; no cloud database, public APIs, login, or internet access needed for app features.

## Setup

1. Install Node.js LTS and VS Code.
2. Open this directory in a terminal.
3. Run `npm install`.
4. Run `npx expo start`.
5. Scan the QR code with Expo Go on Android, or launch an emulator. Expo Go and development tooling may require network connectivity during initial setup; the app's data operations do not.

## Main Screens

- Home: note counts, modules, favorites, revision progress
- Directory: keyword search across title, content, module, tags and category
- Filters: module, note category and priority
- Detail: read note content, favorite, edit, delete
- Revision: completion checklist, reflection notes, progress bar
- NoteForm: add/edit note, validation and local persistence

## Database

`expo-sqlite` stores notes and revision records in `studyvault.db` on device. On first launch, the app seeds five sample notes for IT3133, IT3162, IT3152 and IT3142. All subsequent changes persist across restarts. No remote services are called.

## Demo Checklist

1. Start the app and show seeded notes and counts.
2. Search for `React` and show filtered results.
3. Filter by `High Importance` and a module.
4. Open a note, favorite it, and verify the Dashboard.
5. Add a note, edit it, restart the app and confirm persistence.
6. Mark a revision complete and save a reflection.
7. Turn on airplane mode and repeat search, filter and revision operations.

## Notes

The detail screen provides lightweight Markdown-like heading and inline marker display, not a full Markdown renderer. Flashcards are represented by a revision/self-assessment log, not spaced-repetition question-answer cards. A true peer-to-peer sharing feature is intentionally excluded because the assignment requires a fully local offline application.
