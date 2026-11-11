# Biashara Manager frontend

Vue 3, Vite, Vue Router, Pinia, Axios, Vue I18n, and Tailwind CSS 4.

## Run locally

```sh
npm install
npm run dev
```

Set `VITE_API_URL` in `.env.local` to the Node API URL ending in `/api` (local
default: `http://localhost:4000/api`). The frontend runs on port `3000`; replace
`localhost` with the appropriate host name when frontend and backend run on
separate machines. Platform Admins use the admin page in this Vue app, and
business Owners and Employees use the business workspace. Never put backend
credentials or secrets in a `VITE_` variable. The interface does not provide
public registration or payment processing.

Create a production build with `npm run build`. Vercel rewrites client routes
to `index.html`. Deploy the Node API separately, set `VITE_API_URL` to its
public API URL, and configure the frontend's exact origin in the API's
`FRONTEND_URLS` setting. In this workspace, the API project is in `node
backend`.
