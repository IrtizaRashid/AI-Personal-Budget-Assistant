# Budget AI — AI Personal Budget Assistant

**Step 1: Project Foundation**

This repository contains the scaffolding for an AI Personal Budget Assistant.
At this stage there is **no budget logic, AI logic, dashboards, or database tables** —
only a clean, modular foundation that is ready to extend.

## Tech Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Frontend   | React (Vite) + Tailwind |
| HTTP       | Axios                   |
| Backend    | Node.js + Express       |
| Database   | MySQL (mysql2)          |
| Charts     | Chart.js *(added later)*|

## Folder Structure

```
budget-ai/
│
├── frontend/                 # React + Tailwind client
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Root component
│       ├── index.css         # Tailwind directives + global styles
│       ├── components/       # Reusable UI pieces (buttons, cards, ...)
│       ├── pages/            # Full pages / screens
│       │   └── Home.jsx      # Homepage with "Check Server" button
│       └── services/         # API layer (Axios)
│           └── api.js        # Axios instance + health endpoint call
│
├── backend/                  # Node.js + Express API
│   ├── server.js             # App entry point
│   ├── .env                  # Environment variables (DO NOT COMMIT)
│   ├── .env.example          # Template for .env
│   ├── package.json
│   ├── config/
│   │   └── env.js            # Centralised env loading
│   ├── controllers/
│   │   └── healthController.js   # GET /api/health handler
│   ├── routes/
│   │   └── healthRoutes.js   # /api/health route definitions
│   ├── database/
│   │   └── db.js             # MySQL connection pool (env-driven)
│   └── middleware/
│       └── errorHandler.js   # Central error-handling middleware
│
└── database/                 # SQL scripts / schema (empty for now)
    └── README.md
```

---

## Installation

### 1. Backend

```bash
cd budget-ai/backend
npm install
```

Create your environment file (copy the template and edit values):

```bash
cp .env.example .env
```

### 2. Frontend

```bash
cd budget-ai/frontend
npm install
```

---

## Running the App

Open **two terminals**.

### Terminal 1 — Backend (http://localhost:5001)

```bash
cd budget-ai/backend
npm run dev      # uses nodemon (auto-restart)
# or
npm start        # plain node
```

### Terminal 2 — Frontend (http://localhost:5173)

```bash
cd budget-ai/frontend
npm run dev
```

Visit **http://localhost:5173**, click **Check Server**, and you should see **Server Running**.

---

## API

| Method | Route          | Response                          |
| ------ | -------------- | --------------------------------- |
| GET    | `/api/health`  | `{ "status": "Server Running" }`  |

---

## What's Next (future steps)

- AI integration
- MySQL tables + migrations
- Budget dashboard
- Expense tracking
- Chart.js visualisations
