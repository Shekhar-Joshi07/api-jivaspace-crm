# Complete CRM Backend

Production-style Express and MongoDB API for authentication, role-based access, leads, pipeline, tasks, activities, communications, files, notifications, Excel workflows, dashboard metrics, and reports.

## Requirements

- Node.js 18.18 or newer
- MongoDB 6 or newer, locally or through MongoDB Atlas

## Local installation

From the project root:

```powershell
cd server
Copy-Item .env.example .env
npm install
npm run dev
```

Or run `npm run server` from the project root after dependencies are installed.

Set a real `MONGO_URI` and a random `JWT_SECRET` containing at least 32 characters in `.env`. The API starts at `http://localhost:5000`; health status is available at `GET /api/health`.

Optional setup commands:

```powershell
npm run seed:demo
npm run migrate
npm run reminders
```

- `seed:demo` creates users, teams, properties, leads, and tasks.
- `migrate` upgrades legacy roles to the three-role `User` model.
- `reminders` creates due follow-up, task reminder, and overdue-task notifications. Run it on a recurring schedule in production.

Demo password for all seeded users: `Demo@123`.

| Role | Email |
| --- | --- |
| Superadmin | `superadmin@jivaspace.com` |
| Admin | `admin@jivaspace.com` |
| Business Executive | `executive@jivaspace.com` |
| Business Executive | `executive2@jivaspace.com` |

## Roles and access

- `superadmin`: unrestricted access, including user and team administration.
- `admin`: users, leads, tasks, and reports for teams they manage.
- `business_executive`: assigned leads and tasks.

The first public registration becomes the superadmin. Later public registrations become business executives. Only a superadmin can create users or change roles.

## Environment variables

See `.env.example` for the full template.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret, minimum 32 characters |
| `JWT_EXPIRES_IN` | JWT lifetime, default `7d` |
| `CLIENT_URL` | Comma-separated allowed browser origins |
| `MAX_FILE_SIZE_MB` | Local upload limit, default 10 MB |
| `SMTP_*` | Nodemailer SMTP configuration |
| `SMS_API_*` | Placeholder SMS provider configuration |

SMTP and SMS use safe simulated transports outside production when provider settings are absent. Production rejects sends until a provider is configured.

## API conventions

Use `Authorization: Bearer <token>` for protected endpoints. JSON responses follow:

```json
{
  "success": true,
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

Validation and runtime failures use `{ "success": false, "message": "...", "errors": [] }`.

List endpoints support `page` and `limit`. Lead lists also support `search`, `status`, `priority`, `source`, `assignedTo`, date filters, and sorting.

## Endpoint reference

### Authentication

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password/:token` | Public |
| GET | `/api/auth/me` | Authenticated |
| PUT | `/api/auth/change-password` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |

### Users

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/users` | Superadmin, Admin |
| GET | `/api/users/:id` | Superadmin, Admin |
| POST | `/api/users` | Superadmin |
| PUT | `/api/users/:id` | Superadmin |
| DELETE | `/api/users/:id` | Superadmin; soft deactivates |

### Leads and pipeline

| Method | Endpoint | Access |
| --- | --- | --- |
| GET, POST | `/api/leads` | CRM roles / sales roles |
| GET, PUT, DELETE | `/api/leads/:id` | Scoped by role |
| PATCH | `/api/leads/:id/assign` | Superadmin, Admin |
| POST | `/api/leads/:id/notes` | CRM roles |
| GET | `/api/leads/pipeline` | CRM roles |
| GET | `/api/leads/pending` | CRM roles |
| GET | `/api/leads/responses` | CRM roles |
| POST | `/api/leads/transfer` | Superadmin, Admin |
| POST | `/api/leads/import` | All CRM roles; multipart field `file` |
| POST | `/api/leads/bulk-import` | All CRM roles; JSON compatibility |
| GET | `/api/leads/export` | CRM roles; downloads XLSX |

### Tasks

| Method | Endpoint |
| --- | --- |
| GET, POST | `/api/tasks` |
| GET, PUT, DELETE | `/api/tasks/:id` |

Task list filters include `status`, `priority`, `assignedTo`, `relatedLead`, `overdue`, `dueFrom`, and `dueTo`.

### Activities

| Method | Endpoint |
| --- | --- |
| GET, POST | `/api/activities` |
| GET, PUT, DELETE | `/api/activities/:id` |

Activity types include notes, calls, status changes, assignments, task updates, uploads, email, and SMS.

### Notifications

| Method | Endpoint |
| --- | --- |
| GET, POST | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PATCH | `/api/notifications/read-all` |
| PATCH | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |

### Files

| Method | Endpoint |
| --- | --- |
| GET, POST | `/api/files` |
| GET, PATCH, DELETE | `/api/files/:id` |
| GET | `/api/files/:id/download` |

Uploads use `multipart/form-data` with `file`, `leadId`, and optional `category`. Files are type checked, size limited, stored outside the public web root, and streamed only after authorization.

### Email and SMS

| Method | Endpoint |
| --- | --- |
| GET | `/api/communications` |
| POST | `/api/communications/leads/:leadId/email` |
| POST | `/api/communications/leads/:leadId/sms` |

Every successful or failed send is stored in the communication log and successful sends appear in the lead activity timeline.

### Dashboard and reports

| Method | Endpoint |
| --- | --- |
| GET | `/api/dashboard/stats` |
| GET | `/api/reports/summary` |
| GET | `/api/reports/lead-conversion` |
| GET | `/api/reports/pipeline` |
| GET | `/api/reports/task-completion` |
| GET | `/api/reports/user-performance` |
| GET | `/api/reports/monthly-leads` |
| GET | `/api/reports/sources` |
| GET | `/api/reports/revenue` |
| GET | `/api/reports/export` |

Reports accept optional ISO date query parameters `from` and `to`. Report routes are restricted to admins and managers and are scoped to the manager's teams.

The existing real-estate modules remain available at `/api/properties`, `/api/teams`, and `/api/transfers/logs`.

## Testing

```powershell
cd server
npm test
npm run check
npm audit --omit=dev
```

The test suite checks health/error contracts, JWT protection, and spreadsheet round-tripping/validation. For a manual smoke test:

1. Start MongoDB and the API.
2. Register the first admin at `POST /api/auth/register`.
3. Copy the returned token into the Bearer header.
4. Create a user, lead, and task.
5. Move the lead through pipeline statuses and verify `/api/activities`.
6. Upload a document and verify authorized download.
7. Import/export an XLSX file and open the result.
8. Run `npm run reminders` and check `/api/notifications`.

## Render and MongoDB Atlas deployment

1. Create an Atlas cluster and database user. Add the Render outbound network range to Atlas Network Access, or temporarily allow all IPs while testing.
2. Create a Render Web Service from the repository.
3. Set the root directory to `server`, build command to `npm ci`, and start command to `npm start`.
4. Add `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and provider credentials as Render environment variables.
5. Confirm `GET https://your-service.onrender.com/api/health`.
6. Add a Render Cron Job using the same server root and `npm run reminders` on the desired schedule.
7. Local Multer files require a Render persistent disk mounted at the server `uploads` directory. For horizontally scaled or ephemeral deployments, replace disk storage in `uploadMiddleware.js` with Cloudinary or object storage while retaining the File model metadata.

Never commit `.env`, real credentials, or uploaded customer documents.
