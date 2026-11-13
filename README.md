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
`FRONTEND_URLS` setting. In this workspace, the API project is in
`node_backend`.

## Frontend system guide

### What the frontend does

This is a Vue single-page application for signing in, switching between a
user's businesses, recording and reviewing business activity, and administering
business accounts. It communicates with the Node API; business records,
authentication decisions, and final permission checks belong to the API.

There is no public account-registration or payment-processing flow in this
frontend. A business owner creates employee accounts from the Employees area.

### Startup and request flow

1. [`src/main.js`](./src/main.js) creates the Vue app and installs Pinia,
   Vue Router, Vue I18n, and the global stylesheet. English is the default
   language; the selected language is stored in `localStorage`.
2. [`src/App.vue`](./src/App.vue) renders the active route and initializes the
   authentication store.
3. [`src/router/index.js`](./src/router/index.js) checks authentication and
   role before entering protected pages. It redirects signed-out users to
   `/login`, sends platform administrators to `/admin`, and sends business
   users to `/`.
4. [`src/views/LoginView.vue`](./src/views/LoginView.vue) handles sign-in and
   password-reset flows. Successful sign-in stores the access and refresh
   tokens through the auth store.
5. [`src/services/api.js`](./src/services/api.js) uses `VITE_API_URL` as its
   base URL, attaches the access token to requests, and attempts one token
   refresh after an eligible `401` response. If refresh fails, it clears the
   session and returns the user to sign-in.
6. [`src/views/WorkspaceView.vue`](./src/views/WorkspaceView.vue) loads the
   signed-in user's business memberships, selects a business, and requests
   that business's data when the active section or its filters change.

The local API URL fallback is `http://localhost:4000/api`. Set
`VITE_API_URL` in `.env.local` when using a different API. Values prefixed
with `VITE_` are included in browser code; never put passwords, API secrets,
or other credentials in them.

### Main frontend modules

| File | Responsibility |
| --- | --- |
| [`src/main.js`](./src/main.js) | App setup, plugins, locale initialization, and stylesheet loading. |
| [`src/App.vue`](./src/App.vue) | Root component and authentication initialization. |
| [`src/router/index.js`](./src/router/index.js) | Lazy-loaded routes and navigation guards. |
| [`src/stores/auth.js`](./src/stores/auth.js) | Current user, login, logout, token storage, and session initialization. |
| [`src/services/api.js`](./src/services/api.js) | Axios instance, bearer token, refresh-and-retry behavior. |
| [`src/views/LoginView.vue`](./src/views/LoginView.vue) | Sign-in, forgot-password, reset-password, and lock countdown UI. |
| [`src/views/WorkspaceView.vue`](./src/views/WorkspaceView.vue) | Business workspace, navigation, records, reports, employee and inbox UI. |
| [`src/components/ProductsPanel.vue`](./src/components/ProductsPanel.vue) | Permission-gated product list, filters, CRUD form, image previews, and upload progress. |
| [`src/views/AdminView.vue`](./src/views/AdminView.vue) | Platform-level business administration. |
| [`src/locales/en.json`](./src/locales/en.json), [`src/locales/sw.json`](./src/locales/sw.json) | English and Kiswahili interface strings. |
| [`src/style.css`](./src/style.css) | Shared layouts, forms, tables, responsive rules, and visual styling. |

### Roles and access in the interface

| Role | How the frontend identifies it | Main interface |
| --- | --- | --- |
| Platform administrator | `user.is_platform_admin` | `/admin`: list businesses, create an account, change its status, and remove or restore it. |
| Business owner | The selected business membership has `role: "owner"` and `is_active: true`. | Business dashboard, sales, income, expenses, debts, reports, employee management, and inbox. |
| Employee | The selected business membership has `role: "employee"` and `is_active: true`. | Sales, products, income, expenses, debts, and inbox, subject to the UI permission rules below. |

The platform administrator role is separate from a business membership. The
router redirects platform administrators away from the regular workspace and
prevents non-administrators from entering `/admin`.

The workspace gets the selected membership from the selected business's
`pivot` or `membership` data. If a user belongs to multiple businesses, the
business switcher changes the membership used by the workspace and stores the
selected business ID in `localStorage`.

### Employee role and components

An employee is a business member, not a platform administrator. The owner
creates employee accounts from the workspace's **Employees** section. The
employee form collects a name and sign-in email, with optional phone and
password fields; a supplied password must be at least 12 characters. The
owner can deactivate an employee or restore a previously deactivated employee.
Deactivation is an `is_active: false` update, not a permanent delete.

For an active employee membership, the workspace:

- Builds the sidebar from the employee navigation set: income, expenses,
  debts, sales, products, inbox, and sign out. A data section is shown only when its
  corresponding `*.view` check passes.
- Reads the membership's `permissions` array for normal view/create checks.
  The current frontend explicitly allows employee `debts.view` and
  `debts.create`; sales, income, and expense creation controls are shown only
  when the corresponding `*.create` check passes.
- Shows the Products section when `products.view` is granted. Product create,
  edit, and delete controls independently require `products.create`,
  `products.edit`, and `products.delete`. The backend migration grants these
  four permissions to existing employees, and new employees receive them by
  default; the API still checks each permission on every request.
- Does not show the owner-only dashboard, reports, or employee-management
  sections. Employee account creation, deactivation, and restoration controls
  are owner-only.
- Shows the inbox to active members. The compose action is owner-only; a
  recipient can mark a received message as read.
- Uses the selected business context for record forms and API requests, so
  records are sent to that business's endpoint rather than a global endpoint.

Permission-filtered navigation and action controls require an active business
membership; some sections have explicit role-specific handling. These checks
shape the UI; they are not a security boundary. The API must independently
validate the authenticated user, active membership, and permission for every
read or write request.

### Business workspace behavior

The workspace contains these sections:

- **Dashboard**: owner overview and recent activity.
- **Sales**: completed sales, with sale details and related payment actions.
- **Income / Expenses**: separate business records with searchable,
  paginated lists and entry forms.
- **Debts**: unpaid sales and business loans, including loan repayment.
- **Products**: business-scoped product search and stock/category filters,
  product details and inventory, plus permission-gated add/edit/delete forms.
  The form previews multiple image uploads and displays transfer progress.
  The backend validates and optimizes images before storing them; consult the
  Node backend README for migration, R2 environment variables, and exact
  upload limits. R2 credentials must never be added to frontend configuration.
- **Reports**: owner reporting for a selected date range and printing.
- **Employees**: owner tools for listing, creating, deactivating, and restoring
  employees.
- **Inbox**: business messages; owners can compose messages for active
  employees.

Data requests use routes under `/businesses/{businessId}`. For example, the
workspace reads `/businesses/{businessId}/sales` and posts an employee account
to `/businesses/{businessId}/employees`. The API controls the canonical data
and may reject a request even when the corresponding UI action is visible.

### Localization, accessibility, and layout

English (`en`) and Kiswahili (`sw`) strings live in `src/locales/` and are
selected through Vue I18n. The locale is persisted under the `language`
`localStorage` key. The stylesheet contains responsive workspace and sign-in
layouts; role-dependent navigation and controls are rendered from the current
membership and permission data.

### Build and deploy

Run `npm run build` to create the production bundle in `dist/`. Deploy the
static frontend separately from the Node API, set `VITE_API_URL` to the public
API URL, configure the API's `FRONTEND_URLS` with the exact deployed frontend
origin, and ensure the host rewrites client-side routes to `index.html`.
