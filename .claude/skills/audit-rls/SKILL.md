---
name: audit-rls
description: Scan Supabase for tables missing RLS policies. Usage: /audit-rls
---

Audit all tables in the Supabase database for missing or incomplete Row Level Security (RLS) policies.

## Steps

1. **List tables** — Use the Supabase MCP `list_tables` tool to get all tables in the `public` schema for project `<your-supabase-project-ref>`.

2. **Check RLS status** — Use the Supabase MCP `execute_sql` tool to query which tables have RLS enabled:

   ```sql
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

3. **Get existing policies** — For each table, query the existing RLS policies:

   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

4. **Analyze gaps** — For each table, check:
   - Is RLS enabled (`rowsecurity = true`)?
   - Does it have policies for SELECT, INSERT, UPDATE, DELETE?
   - Do policies include `auth.uid() = user_id` condition?
   - Are there any overly permissive policies (e.g., `true` as qual)?

5. **Report findings** — Output a summary table:

   ```
   ## RLS Audit Report

   | Table | RLS Enabled | SELECT | INSERT | UPDATE | DELETE | Issue |
   |-------|------------|--------|--------|--------|--------|-------|
   ```

   For each issue found, provide the suggested fix SQL:

   ```sql
   ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "<table>_select" ON public.<table>
     FOR SELECT USING (auth.uid() = user_id);

   CREATE POLICY "<table>_insert" ON public.<table>
     FOR INSERT WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "<table>_update" ON public.<table>
     FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "<table>_delete" ON public.<table>
     FOR DELETE USING (auth.uid() = user_id);
   ```

## Constraints

- This is a read-only audit — never apply fixes automatically
- Present suggested SQL but require user confirmation before any changes
- Flag tables without a `user_id` column separately (they may use different ownership patterns)
- Ignore Supabase internal tables (e.g., `schema_migrations`, tables in `auth`/`storage` schemas)
