# Deadliner Agent Commands & Style

## Commands

- **Run Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## Coding Standards

- **Component Style:** Functional components with named exports.
- **Styling:** Use Tailwind utility classes.
- **State:** Use `useState` for local state.
- **Types:** Explicitly type all props and API responses.
- **API Routes:** Use Next.js App Router standard (`app/api/.../route.ts`).

## Error Handling

- Wrap all API calls in `try/catch`.
- Display user-friendly error messages (e.g., "File too large").
