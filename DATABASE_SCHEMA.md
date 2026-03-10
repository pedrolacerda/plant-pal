# Database Schema — Meu Jardim

> Auto-generated on 2026-03-09

## Enums

### `light_level`

| Value    |
|----------|
| `low`    |
| `medium` |
| `high`   |

---

## Tables

### `plants`

Stores each user's registered plants with care settings.

| Column            | Type                       | Nullable | Default                  | Notes                          |
|-------------------|----------------------------|----------|--------------------------|--------------------------------|
| `id`              | `uuid`                     | NO       | `gen_random_uuid()`      | Primary Key                    |
| `user_id`         | `uuid`                     | NO       | —                        | FK → `auth.users(id)` ON DELETE CASCADE |
| `name`            | `text`                     | NO       | —                        | Plant display name             |
| `light`           | `light_level` (enum)       | NO       | `'medium'`               | Light requirement              |
| `photo`           | `text`                     | YES      | —                        | Base64 data URL of plant photo |
| `tip`             | `text`                     | YES      | —                        | AI-generated care tip          |
| `care_intervals`  | `jsonb`                    | YES      | `'{}'`                   | `{ water, fertilize, spray }` in days |
| `next_care_dates` | `jsonb`                    | YES      | `'{}'`                   | `{ water?, fertilize?, spray? }` ISO dates |
| `created_at`      | `timestamp with time zone` | NO       | `now()`                  |                                |
| `updated_at`      | `timestamp with time zone` | NO       | `now()`                  |                                |

### RLS Policies (Row Level Security)

| Policy                       | Operation | Role          | Rule                      |
|------------------------------|-----------|---------------|---------------------------|
| Users can view own plants    | SELECT    | authenticated | `auth.uid() = user_id`    |
| Users can insert own plants  | INSERT    | authenticated | `auth.uid() = user_id`    |
| Users can update own plants  | UPDATE    | authenticated | `auth.uid() = user_id`    |
| Users can delete own plants  | DELETE    | authenticated | `auth.uid() = user_id`    |
