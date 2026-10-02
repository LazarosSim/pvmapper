# Feature checklist

Every feature the app has today. Each phase of `docs/improvement-plan.md` must keep all of
them working; check them before merging a phase.

## Accounts
- [ ] Log in with username and password
- [ ] Register a new account (becomes "waiting for approval" once `01_security.sql` is applied)
- [ ] Manager approves a pending account (Dashboard → Users)
- [ ] Log out
- [ ] Session survives a reload, online and offline

## Parks (home page)
- [ ] List of parks with progress, row count and barcode count
- [ ] Search parks by name
- [ ] Manager: create, edit (name, expected barcodes, length validation), archive, restore, delete
- [ ] Manager: show archived parks (Settings)
- [ ] Export to Excel: Standard (Summary tab + one tab per row, natural order)
- [ ] Export to Excel: Metlen (Summary tab + one Barcodes sheet)

## Rows
- [ ] Rows of a park, grouped and in natural order; search
- [ ] Add a row (next "Row N"), bulk add rows with optional counts, add subrow (Row 5 → 5_a, 5_b)
- [ ] Edit a row (name, expected barcodes); rename from the scan page
- [ ] Delete a row (managers only when it has an expected count)
- [ ] Reset a row (deletes its barcodes, including unsent ones)

## Scanning
- [ ] Select park → select row → scan
- [ ] Hardware scanner (types the code + Enter) and manual entry with the Add button
- [ ] Length rule 19–26 characters when the park requires it
- [ ] Duplicate rejected within the row (ignoring case and spaces)
- [ ] Placeholder for a missing/unreadable panel
- [ ] GPS saved with the first barcode of a row when enabled
- [ ] Success and error sounds, vibration, inline confirmation under the input
- [ ] Progress bar; "Row complete" with a button to the next row
- [ ] Last 10 scans with sync status
- [ ] Counter "Scanned: n / expected"

## Row detail
- [ ] All barcodes with number, time and sync status; search; pages of 50
- [ ] Edit a barcode (offline edits wait in the outbox)
- [ ] Insert a barcode after another one
- [ ] Delete a barcode
- [ ] Add a barcode

## Offline
- [ ] App opens with no connection (after one online visit)
- [ ] Scans saved offline and uploaded with Sync
- [ ] Pending count and sync progress
- [ ] All active parks available offline automatically (replaces "Prepare for offline")
- [ ] Sync chip: waiting count, Sync now, refused changes can be retried or discarded

## Search
- [ ] Search barcodes from the bottom menu (offline: active parks on the phone)

## Statistics
- [ ] Profile: daily and total scans
- [ ] Dashboard: totals, today, park progress, user comparison, calendar, monthly trend
