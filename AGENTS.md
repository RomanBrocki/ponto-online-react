# Project Rules for Codex

## Context
This is a React + TypeScript web app deployed via GitHub Pages.
Backend is Supabase (Auth + RLS).

## Hard Rules (DO NOT BREAK)
- Do NOT modify Supabase schema, RLS, or policies.
- Do NOT use Supabase service_role or secret keys.
- Use only the publishable (public/anon) key already configured.
- Do NOT touch legacy Python/Streamlit code (outside this repo).
- Do NOT add backend servers. Frontend-only app.

## Auth Model
- Supabase Auth with email/password.
- User role is stored in public.profiles.role.
- profiles RLS allows users to read ONLY their own profile.
- App must read the role after login and store it in context.

## App Roles
- admin
- empregada

## Business Rules
- empregada can ONLY:
  - view her own records
  - insert/update today's record in sequence:
    entrada → saida_almoco → volta_almoco → saida_final
- admin can:
  - view all records
  - edit any day
  - add observation (e.g. feriado, folga)

## UI Rules
- Simple, clean UI. No heavy styling.
- Prefer clarity over aesthetics.

## Tech Stack
- React + TypeScript
- react-router-dom
- @supabase/supabase-js
