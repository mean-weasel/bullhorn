---
name: db-migrate
description: Create and apply a database migration. Usage: /db-migrate <migration_name>
disable-model-invocation: true
---

Create a new Supabase migration, write the SQL, apply it locally, and optionally push to remote.

## Arguments

`$ARGUMENTS` is the migration name in snake_case (e.g., `add_tags_column`). If missing, stop and ask the user for a name.

## Steps

1. **Show current state** — Run `supabase migration list` to display existing migrations so you understand what's already been applied.

2. **Create migration file** — Run `make db-new name=$ARGUMENTS` to scaffold the empty migration file. Note the path of the created file.

3. **Write SQL** — Read the new empty migration file. Based on the user's intent (from conversation context or `$ARGUMENTS`), write the appropriate SQL. If the intent is unclear, ask the user what schema changes they need before writing.

4. **Review** — Show the user the SQL you wrote and confirm they want to proceed.

5. **Apply locally** — Run `make db-migrate` (`supabase migration up`) to apply the migration to the local Supabase instance. If it fails, diagnose the error, fix the SQL, and retry.

6. **Verify** — Run `make db-diff` to confirm no remaining schema drift between local and remote.

7. **Prompt for remote push** — Ask the user: "Ready to push this migration to remote Supabase? This affects the production database." Only run `make db-push` after explicit confirmation.

## Constraints

- **Never edit existing migration files** — always create new ones
- **Always apply locally first** before pushing to remote
- **Require explicit user confirmation** before `make db-push`
- Migration names must be snake_case (e.g., `add_user_preferences`, `create_tags_table`)
- If the migration involves new tables, remind the user to add RLS policies (`auth.uid() = user_id`)
