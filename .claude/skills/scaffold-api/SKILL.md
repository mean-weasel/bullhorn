---
name: scaffold-api
description: Generate a boilerplate API route following project conventions. Usage: /scaffold-api <path> <methods>
disable-model-invocation: true
---

Generate an API route file with standard boilerplate following Bullhorn conventions.

## Arguments

`$ARGUMENTS` should be `<path> <methods>` where:
- `<path>` is the route path (e.g., `tags`, `projects/[id]/members`)
- `<methods>` is a comma-separated list of HTTP methods (e.g., `GET,POST,PUT,DELETE`)

If arguments are missing or unclear, ask the user for the route path and methods.

## Steps

1. **Parse arguments** — Extract the route path and HTTP methods from `$ARGUMENTS`. Default to `GET` if no methods specified.

2. **Check for conflicts** — Verify `src/app/api/<path>/route.ts` doesn't already exist. If it does, show the existing file and ask the user how to proceed.

3. **Generate route file** — Create `src/app/api/<path>/route.ts` with handlers for each method. Use this template per method:

   **GET** (list):
   ```typescript
   export async function GET() {
     try {
       const { userId } = await requireAuth()
       const supabase = await createClient()

       const { data, error } = await supabase
         .from('TABLE_NAME')
         .select('*')
         .eq('user_id', userId)

       if (error) throw error

       return Response.json({ items: data })
     } catch (error) {
       if ((error as Error).message === 'Unauthorized') {
         return Response.json({ error: 'Unauthorized' }, { status: 401 })
       }
       return Response.json({ error: 'Internal server error' }, { status: 500 })
     }
   }
   ```

   **POST** (create):
   ```typescript
   export async function POST(request: Request) {
     try {
       const { userId } = await requireAuth()
       const supabase = await createClient()
       const body = await request.json()

       const { data, error } = await supabase
         .from('TABLE_NAME')
         .insert({ ...body, user_id: userId })
         .select()
         .single()

       if (error) throw error

       return Response.json({ item: data }, { status: 201 })
     } catch (error) {
       if ((error as Error).message === 'Unauthorized') {
         return Response.json({ error: 'Unauthorized' }, { status: 401 })
       }
       return Response.json({ error: 'Internal server error' }, { status: 500 })
     }
   }
   ```

   **PUT** (update):
   ```typescript
   export async function PUT(request: Request) {
     try {
       const { userId } = await requireAuth()
       const supabase = await createClient()
       const body = await request.json()
       const { id, ...updates } = body

       const { data, error } = await supabase
         .from('TABLE_NAME')
         .update(updates)
         .eq('id', id)
         .eq('user_id', userId)
         .select()
         .single()

       if (error) throw error

       return Response.json({ item: data })
     } catch (error) {
       if ((error as Error).message === 'Unauthorized') {
         return Response.json({ error: 'Unauthorized' }, { status: 401 })
       }
       return Response.json({ error: 'Internal server error' }, { status: 500 })
     }
   }
   ```

   **DELETE**:
   ```typescript
   export async function DELETE(request: Request) {
     try {
       const { userId } = await requireAuth()
       const supabase = await createClient()
       const { searchParams } = new URL(request.url)
       const id = searchParams.get('id')

       if (!id) {
         return Response.json({ error: 'Missing id' }, { status: 400 })
       }

       const { error } = await supabase
         .from('TABLE_NAME')
         .delete()
         .eq('id', id)
         .eq('user_id', userId)

       if (error) throw error

       return Response.json({ success: true })
     } catch (error) {
       if ((error as Error).message === 'Unauthorized') {
         return Response.json({ error: 'Unauthorized' }, { status: 401 })
       }
       return Response.json({ error: 'Internal server error' }, { status: 500 })
     }
   }
   ```

4. **Add imports** — Include at the top of the file:
   ```typescript
   import { requireAuth } from '@/lib/auth'
   import { createClient } from '@/lib/supabase/server'
   ```

5. **Add TODOs** — Insert comments for the user to fill in:
   - `// TODO: Replace TABLE_NAME with actual table name`
   - `// TODO: Add transformXFromDb() to responses`
   - `// TODO: Add input validation for request body`

6. **Remind about RLS** — After generating, remind the user: "If this route uses a new table, ensure RLS policies are set up (`/audit-rls` can help)."

## Constraints

- Always use `requireAuth()` — never create unauthenticated routes
- Always filter by `user_id` in queries
- Use `Response.json()` (not `NextResponse.json()`)
- Follow Prettier config: no semicolons, single quotes, 2-space indent
