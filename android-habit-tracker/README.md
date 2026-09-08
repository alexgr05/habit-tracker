# Android Habit Tracker

Native Android frontend for the existing Habit Streak Tracker.

The web app remains available. This Android app uses the same Supabase project and the same `habit_days` table, so tracked data stays shared between phone and laptop.

## First version

- sign in with the existing Supabase habit tracker account
- load today's habit row from Supabase
- edit the Today page natively
- save today's row back to Supabase
- calculate the daily score with the same core scoring rules as the web app

Phone usage collection is still in `android-companion` for now. It can be moved into this app after the native Today page is stable.
