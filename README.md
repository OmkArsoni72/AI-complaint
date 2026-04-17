# AI Grievance Intelligence System

> Smart Sarkari Complaint Resolver — AI-powered smart city governance dashboard with 3-layer RBAC

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 3.4, Recharts, Leaflet, Framer Motion
- **Backend**: Express.js, TypeScript, Mongoose, JWT Auth
- **Database**: MongoDB

## 🏗️ Architecture — 3-Layer RBAC

### 👤 Layer 1: Public (Citizen)
- Submit complaints (text + voice + location)
- Track complaint status (timeline view)
- Give feedback (Satisfied / Not Satisfied → auto re-escalation)
- View notifications

### 👮 Layer 2: Admin (Department Officer)
- View department-filtered complaints
- Accept → In Progress → Resolve workflow
- Add notes, reassign within department
- SLA countdown & escalation alerts
- Performance metrics

### 🏛️ Layer 3: Super Admin (Control Room)
- City-wide dashboard with map + heatmap + KPIs
- User & role management (create admins, assign regions)
- SLA rule configuration per category
- Audit logs & compliance
- Override / force-assign / close cases

## 🚀 Quick Start

### Option A: Frontend Only (No Backend)

```bash
cd client
npm install   # or yarn install
npm run dev
```

Open **http://localhost:3000** → Click "Login" → Choose any role to explore!

### Option B: Full Stack

```bash
# Terminal 1: Server
cd server
npm install
npm run seed    # Creates users, officers, complaints, SLA configs
npm run dev     # Port 5000

# Terminal 2: Client
cd client
npm install
npm run dev     # Port 3000
```

## 🔐 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Citizen | citizen@demo.com | demo123 |
| Admin (Traffic) | admin@trafficpolice.gov.in | admin123 |
| Admin (Water) | admin@jalboard.gov.in | admin123 |
| Admin (Electricity) | admin@bses.gov.in | admin123 |
| Super Admin | superadmin@delhi.gov.in | super123 |

## 📄 Pages

| Page | URL | Role | Features |
|------|-----|------|----------|
| Login | `/login` | All | Demo login, email/password, register |
| Dashboard | `/` | All | Map, feed, stats, AI insights |
| Submit Complaint | `/complaints/new` | All | Voice, form, AI processing |
| Complaint Detail | `/complaints/[id]` | All | Timeline, feedback, officer actions |
| My Complaints | `/my-complaints` | Citizen | Status tracking, filters |
| Officer Panel | `/officer` | Admin | Dept complaints, performance |
| Analytics | `/analytics` | All | Charts, heatmap, trends |
| Admin Panel | `/admin` | Admin | Officers, complaint table |
| Super Admin | `/superadmin` | Super Admin | Dashboard, users, SLA, audit |

## 🔄 Complete Flow

```
Citizen submits complaint
    → AI categorizes + prioritizes
        → Routed to department
            → Admin gets SLA timer
                → No action? Auto-escalate
                    → Super Admin sees on dashboard
            → Admin resolves
                → Citizen gives feedback
                    → Not satisfied? Re-escalate!
```

## 🧠 AI Features
- **Public**: Smart NLP input, voice recognition
- **Admin**: Priority detection, duplicate hints
- **Super Admin**: Trend prediction, hotspot heatmaps

## 📁 Project Structure

```
github/
├── client/                  # Next.js 15 frontend
│   └── src/
│       ├── app/
│       │   ├── login/           # Auth pages
│       │   ├── my-complaints/   # Citizen tracking
│       │   ├── officer/         # Admin dashboard
│       │   ├── superadmin/      # Control room
│       │   ├── complaints/      # New + Detail
│       │   ├── analytics/       # Charts
│       │   └── admin/           # Officers
│       ├── components/
│       │   ├── admin/
│       │   ├── analytics/
│       │   ├── complaints/
│       │   ├── dashboard/
│       │   └── layout/
│       └── lib/
│           ├── api.ts           # API + fallback
│           ├── auth.tsx         # Auth context
│           ├── constants.ts
│           └── translations.ts
│
└── server/                  # Express.js backend
    └── src/
        ├── controllers/
        ├── middleware/
        │   └── auth.ts          # JWT + RBAC
        ├── models/
        │   ├── User.ts          # Roles
        │   ├── Complaint.ts     # Notes + Feedback
        │   ├── Officer.ts
        │   ├── Escalation.ts
        │   ├── AuditLog.ts
        │   └── SLAConfig.ts
        ├── routes/
        └── services/
```

## ⚙️ API Endpoints

### Auth
| Method | Route | Access |
|--------|-------|--------|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/register` | Public |

### Complaints
| Method | Route | Access |
|--------|-------|--------|
| GET/POST | `/api/complaints` | Public |
| PATCH | `/api/complaints/:id/status` | Admin |
| POST | `/api/complaints/:id/feedback` | Public |
| POST | `/api/complaints/:id/notes` | Admin |
| POST | `/api/complaints/:id/reassign` | Admin |

### Admin
| Method | Route | Access |
|--------|-------|--------|
| GET/POST | `/api/users` | Super Admin |
| GET/PATCH | `/api/sla` | Super Admin |
| GET | `/api/audit-logs` | Super Admin |
