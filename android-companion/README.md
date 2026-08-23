# Habit Tracker Android Companion

This is a separate Android companion app for the existing Habit Streak Tracker web app.

It does one job:

- reads Android app usage with Usage Access permission
- calculates total screen time, social media minutes, and late-night phone minutes
- uploads one row per day to the existing Supabase project

The web tracker remains the main app. This companion app does not overwrite habit scores or streaks.

## Database

Run `../supabase/phone_usage_days.sql` in the Supabase SQL editor before uploading data.

## Build

Open this folder in Android Studio:

`android-companion`

Then build and run the `app` configuration on your Android phone.

## Required phone permission

The app needs Android Usage Access:

Settings -> Apps -> Special app access -> Usage access -> Habit Companion -> Allow

## Default social apps

The current social-media package list includes Instagram, TikTok, Snapchat, Facebook, Messenger, X/Twitter, Reddit, YouTube, Discord, and Telegram.

We can later make this list editable inside the app.
