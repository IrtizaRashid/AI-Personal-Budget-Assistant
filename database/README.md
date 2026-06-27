# database/

SQL scripts and schema definitions will live here in a later step.

**Step 1: intentionally empty** — no tables are created yet.

Planned for future steps:
- `schema.sql` — table definitions (users, budgets, expenses, categories…)
- `seed.sql` — sample/seed data
- migration scripts

The backend connects to MySQL via `backend/database/db.js` using the
credentials in `backend/.env`. Create the database referenced by `DB_NAME`
before running queries:

```sql
CREATE DATABASE budget_ai;
```
