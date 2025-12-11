# Expense Trackr

A simple but full‑featured personal finance tracker with a modern UI, JWT‑based authentication, per‑user data, budgets, saving goals, charts, and CSV/JSON export.

- **Live app:** https://expense-trackr-app.netlify.app  
- **Backend API (health):** https://expense-trackr-backend.onrender.com/api/health  
- **Repo:** https://github.com/aldrinb77/expense-trackr

> Built as a full‑stack project using Node.js (Express), SQLite, vanilla HTML/CSS/JS, Netlify, Render, and Chart.js.

---

## Features

**Core**

- User registration & login with **JWT authentication**
- Separate data per user (multi‑user safe)
- Add **debit (expense)** and **credit (income)** transactions
- Categories + optional free‑text **notes**
- Filter transactions by type, category, and custom **date range**
- Quick category chips for fast entry

**Budgets & Goals**

- Per‑category **monthly budgets** with progress bars
- **Monthly saving goal** (based on month’s net = credit − debit)
- Visual progress bar and text explanations (remaining / exceeded)

**Insights & Analytics**

- Summary cards for **today, this week, this month, this year, overall**
- Charts (via Chart.js):
  - Expenses by category (this month)
  - Daily debits for last 7 days
  - 90‑day net cash‑flow trend
- Category totals table (this month) with % of total and “top categories” summary

**Profile & Activity**

- Profile section showing:
  - Total transactions
  - This month’s debit/credit/net
  - Last activity date
  - Active days in last 30 days
  - Current & best streak of active days
- Optional **avatar** upload (stored as base64 on backend)

**Data Export / Import**

- Download **CSV** of all transactions
- Download full **JSON backup** (transactions + budgets + saving goal + avatar meta)
- Import JSON backup to restore account data

**UX & Theming**

- **Dark mode** toggle, persisted via localStorage
- Smooth scroll navigation between sections
- Toast notifications for success/errors
- Responsive layout for desktop + mobile

---

## Tech Stack

**Frontend**

- HTML5, CSS3, vanilla JavaScript
- Chart.js for charts
- Deployed on **Netlify**

**Backend**

- Node.js + Express
- SQLite (via `sqlite3` driver)
- Authentication with **JWT** (`jsonwebtoken`) and password hashing with **bcryptjs**
- Deployed on **Render**

**Other**

- CORS configuration to allow only the Netlify frontend (and localhost for dev)
- JWT secret + environment variables managed via Render dashboard
- Git + GitHub for version control and CI-style deployments

---

## Architecture Overview

Mono‑repo structure:

```text
/ (repo root)
  frontend/
    index.html
    app.js
    style.css
    logo.png
    ...
  backend/
    server.js
    package.json
    data/expense-tracker.db (created at runtime)
