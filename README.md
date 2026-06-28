# 💸 AI Personal Budget Assistant

A full-stack web application that lets you set up a monthly budget, track expenses, and **manage everything using natural language**. Type *"I spent 500 on pizza"* and the AI categorises it, saves it, and updates your dashboard and charts in real time.

---

## 📋 Description

The AI Personal Budget Assistant helps users plan and monitor their monthly spending. After a one-time budget setup, users get a professional dashboard with summary cards, charts, and an expense history. An integrated AI assistant understands plain-English commands to add, view, and delete expenses — while **all calculations and database operations are performed by the backend**, never the AI.

---

## ✨ Features

- **Budget setup** — enter a monthly budget and get recommended category allocations (editable).
- **Dashboard** — summary cards (Monthly Budget, Total Spent, Remaining, Total Expenses).
- **Charts** — budget allocation pie, spending pie, and an allocated-vs-spent-vs-remaining bar chart.
- **AI chat** — add/view/delete expenses and check budgets in natural language.
- **Expense history** — searchable, deletable table with confirmation.
- **Recent expenses** — quick view of the latest 5.
- **Real-time refresh** — cards, charts, and tables update automatically after any change (no page reload).
- **Robust validation & error handling** throughout the stack.

---

## 🛠 Technology Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Frontend  | React (Vite), React Router, Tailwind CSS |
| Charts    | Chart.js + react-chartjs-2              |
| HTTP      | Axios                                    |
| Backend   | Node.js, Express.js                      |
| Database  | MySQL (mysql2)                           |
| AI        | OpenAI SDK (OpenAI-compatible; works with Groq) |

---

## 📁 Folder Structure

```
budget-ai/
├── README.md
├── .gitignore
│
├── database/
│   └── schema.sql                # Creates the database + 3 tables
│
├── backend/
│   ├── server.js                 # App entry: middleware + routes
│   ├── .env                      # Secrets (NOT committed)
│   ├── .env.example              # Template for .env
│   ├── package.json
│   ├── config/
│   │   └── env.js                # Centralised env loading
│   ├── database/
│   │   └── db.js                 # MySQL connection pool
│   ├── middleware/
│   │   ├── asyncHandler.js       # Async error forwarding
│   │   └── errorHandler.js       # Central error + 404 handlers
│   ├── routes/                   # One router per resource
│   ├── controllers/              # Request handling + validation
│   └── services/                 # All SQL + OpenAI calls
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── main.jsx              # Entry + BrowserRouter
        ├── App.jsx               # Routes
        ├── pages/                # BudgetSetup, Dashboard
        ├── components/           # Reusable UI (cards, tables, chat, charts)
        ├── services/             # Axios API helpers
        └── utils/                # Formatting helpers
```

---

## ⚙️ Installation Guide

**Prerequisites:** Node.js 18+, MySQL 8+, and an AI API key (free [Groq](https://console.groq.com) key recommended, or an OpenAI key).

```bash
# 1. Clone
git clone https://github.com/IrtizaRashid/AI-Personal-Budget-Assistant.git
cd AI-Personal-Budget-Assistant

# 2. Create the database + tables
mysql -u root -p < database/schema.sql

# 3. Backend
cd backend
npm install
cp .env.example .env        # then edit values (see below)

# 4. Frontend
cd ../frontend
npm install
```

---

## 🔐 Environment Variables

Create `backend/.env` (copy from `.env.example`):

```env
# Server
PORT=5001

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=budget_ai

# AI provider (OpenAI-compatible)
# Groq (free):   https://api.groq.com/openai/v1  + model llama-3.3-70b-versatile
# OpenAI (paid): leave OPENAI_BASE_URL blank      + model gpt-4.1-mini
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=llama-3.3-70b-versatile
```

> `.env` is gitignored and never committed.

---

## ▶️ How to Run

Open **two terminals**:

```bash
# Terminal 1 — backend (http://localhost:5001)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

Then open **http://localhost:5173**.

---

## 🌐 API Endpoints

| Method | Endpoint                       | Description                                       |
| ------ | ------------------------------ | ------------------------------------------------- |
| GET    | `/api/health`                  | Health check                                      |
| POST   | `/api/setup-budget`            | Create user + categories (transaction)            |
| POST   | `/api/users`                   | Create a user                                     |
| POST   | `/api/categories`              | Bulk-save categories                              |
| GET    | `/api/categories/:userId`      | Categories with `remaining = allocated − spent`   |
| POST   | `/api/expenses`                | Insert an expense                                 |
| GET    | `/api/expenses/:userId`        | All expenses (newest first)                       |
| DELETE | `/api/expenses/:expenseId`     | Delete an expense + update `spent_amount`         |
| GET    | `/api/dashboard/:userId`       | `{ monthlyBudget, totalSpent, remainingBudget }`  |
| GET    | `/api/statistics/:userId`      | Chart data: allocated/spent/remaining + count     |
| POST   | `/api/chat`                    | Natural-language command → action                 |

---

## 🤖 AI Workflow

```
React → Express → OpenAI (interpret only) → VALIDATE → MySQL → React
```

1. The user types a message (e.g. *"I spent 500 on pizza"*).
2. The backend sends it to the AI with a strict system prompt. The AI returns **only** a JSON intent:
   ```json
   { "intent": "add_expense", "category": "Food", "amount": 500, "description": "Pizza" }
   ```
3. The **backend** validates the intent (known category, positive amount, …) and performs all DB work and calculations. The AI never runs SQL or does math.
4. Supported intents: `add_expense`, `remaining_budget`, `remaining_category_budget`, `show_expenses`, `show_category_expenses`, `show_today_expenses`, `delete_last_expense`, `unknown`.

---

## 🖼 Screenshots

> _Add screenshots here before submission._

- **Budget Setup** — `docs/screenshots/setup.png`
- **Dashboard (cards + charts)** — `docs/screenshots/dashboard.png`
- **AI Chat** — `docs/screenshots/chat.png`
- **Expense History** — `docs/screenshots/history.png`

---

## 🚀 Future Improvements

- User authentication & multiple accounts
- Monthly/yearly reports and trends
- Recurring expenses and budget reminders
- Export to CSV/PDF
- Editable expenses (not just add/delete)
- Multi-currency support
- Deployment (Vercel + Railway/Render + managed MySQL)

---

## 📄 License

MIT — for educational/demonstration use.
