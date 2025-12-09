// Expense Tracker backend - SQLite + JWT auth + per-user data
// Features: avatars, notes, saving goals, category budgets, CSV+JSON export/import

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---

app.use(express.json());

// CORS: allow only Netlify + tools without origin (curl/file://)
const allowedOrigins = [
    "https://expense-trackr-app.netlify.app"
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || origin === "null") {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            console.warn("CORS blocked for origin:", origin);
            return callback(new Error("Not allowed by CORS"));
        }
    })
);

// Static (optional, not used by your current frontend)
const PUBLIC_DIR = path.join(__dirname, "public");
console.log("Serving static files from:", PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

app.get(["/", "/index.html"], (req, res) => {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    fs.access(indexPath, fs.constants.F_OK, (err) => {
        if (err) {
            return res
                .status(404)
                .send(
                    "Frontend index.html not found on server. " +
                        "In development you can open index.html directly."
                );
        }
        res.sendFile(indexPath);
    });
});

// --- JWT config ---

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

// --- Database setup ---

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "expense-tracker.db");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("Failed to open SQLite database:", err);
        process.exit(1);
    } else {
        console.log("Connected to SQLite database:", DB_FILE);
    }
});

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");

    // Users table (with avatar)
    db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            avatar TEXT
        )
        `,
        (err) => {
            if (err) {
                console.error("Failed to create users table:", err);
                process.exit(1);
            }
        }
    );

    // Ensure avatar column exists
    db.run("ALTER TABLE users ADD COLUMN avatar TEXT", (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
            console.error("Failed to add avatar column:", err);
        }
    });

    // Transactions (with note)
    db.run(
        `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
            category TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            note TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
        `,
        (err) => {
            if (err) {
                console.error("Failed to create transactions table:", err);
                process.exit(1);
            }
        }
    );

    // Ensure note column exists
    db.run("ALTER TABLE transactions ADD COLUMN note TEXT", (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
            console.error("Failed to add note column:", err);
        }
    });

    // Saving goals
    db.run(
        `
        CREATE TABLE IF NOT EXISTS saving_goals (
            userId INTEGER PRIMARY KEY,
            monthlyGoal REAL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
        `,
        (err) => {
            if (err) {
                console.error("Failed to create saving_goals table:", err);
                process.exit(1);
            }
        }
    );

    // Category budgets
    db.run(
        `
        CREATE TABLE IF NOT EXISTS category_budgets (
            userId INTEGER NOT NULL,
            category TEXT NOT NULL,
            monthlyBudget REAL NOT NULL,
            updatedAt TEXT NOT NULL,
            PRIMARY KEY (userId, category),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
        `,
        (err) => {
            if (err) {
                console.error("Failed to create category_budgets table:", err);
                process.exit(1);
            }
        }
    );
});

// --- DB helpers ---

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function validateFullTransaction(body) {
    const errors = [];

    if (body.amount === undefined) {
        errors.push("amount is required");
    } else {
        const amountNumber = Number(body.amount);
        if (Number.isNaN(amountNumber) || amountNumber <= 0) {
            errors.push("amount must be a positive number");
        }
    }

    if (body.type !== "debit" && body.type !== "credit") {
        errors.push('type must be "debit" or "credit"');
    }

    if (!body.category || typeof body.category !== "string") {
        errors.push("category is required and must be a string");
    }

    return errors;
}

function generateToken(user) {
    const payload = {
        sub: user.id,
        username: user.username,
        createdAt: user.createdAt,
        avatar: user.avatar || null
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res
            .status(401)
            .json({ error: "Missing or invalid Authorization header" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.sub,
            username: payload.username,
            createdAt: payload.createdAt,
            avatar: payload.avatar || null
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// Users
function findUserByUsername(username) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, username, passwordHash, createdAt, avatar FROM users WHERE username = ?",
            [username],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

function createUser(username, password) {
    const createdAt = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 10);

    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO users (username, passwordHash, createdAt, avatar) VALUES (?, ?, ?, NULL)",
            [username, passwordHash, createdAt],
            function (err) {
                if (err) {
                    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
                        const e = new Error("USERNAME_TAKEN");
                        return reject(e);
                    }
                    return reject(err);
                }
                resolve({ id: this.lastID, username, createdAt, avatar: null });
            }
        );
    });
}

function updateUserAvatar(userId, avatar) {
    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE users SET avatar = ? WHERE id = ?",
            [avatar, userId],
            function (err) {
                if (err) return reject(err);
                resolve(avatar || null);
            }
        );
    });
}

// Transactions
function getAllTransactionsForUser(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT id, amount, type, category, createdAt, note FROM transactions WHERE userId = ? ORDER BY datetime(createdAt) ASC",
            [userId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            }
        );
    });
}

function createTransaction(userId, amount, type, category, note) {
    const createdAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO transactions (userId, amount, type, category, createdAt, note) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, amount, type, category, createdAt, note],
            function (err) {
                if (err) return reject(err);
                const newTx = {
                    id: this.lastID,
                    amount,
                    type,
                    category,
                    createdAt,
                    note
                };
                resolve(newTx);
            }
        );
    });
}

function updateTransaction(userId, id, amount, type, category, note) {
    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE transactions SET amount = ?, type = ?, category = ?, note = ? WHERE id = ? AND userId = ?",
            [amount, type, category, note, id, userId],
            function (err) {
                if (err) return reject(err);
                if (this.changes === 0) {
                    return resolve(null);
                }

                db.get(
                    "SELECT id, amount, type, category, createdAt, note FROM transactions WHERE id = ? AND userId = ?",
                    [id, userId],
                    (err2, row) => {
                        if (err2) return reject(err2);
                        resolve(row || null);
                    }
                );
            }
        );
    });
}

function deleteTransaction(userId, id) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, amount, type, category, createdAt, note FROM transactions WHERE id = ? AND userId = ?",
            [id, userId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) {
                    return resolve(null);
                }

                db.run(
                    "DELETE FROM transactions WHERE id = ? AND userId = ?",
                    [id, userId],
                    function (err2) {
                        if (err2) return reject(err2);
                        resolve(row);
                    }
                );
            }
        );
    });
}

// Saving goals
function getSavingGoalForUser(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT monthlyGoal FROM saving_goals WHERE userId = ?",
            [userId],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

function upsertSavingGoalForUser(userId, goal) {
    const updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        if (goal === null) {
            db.run(
                "DELETE FROM saving_goals WHERE userId = ?",
                [userId],
                function (err) {
                    if (err) return reject(err);
                    resolve(null);
                }
            );
        } else {
            db.run(
                `
                INSERT INTO saving_goals (userId, monthlyGoal, updatedAt)
                VALUES (?, ?, ?)
                ON CONFLICT(userId) DO UPDATE SET
                    monthlyGoal = excluded.monthlyGoal,
                    updatedAt = excluded.updatedAt
                `,
                [userId, goal, updatedAt],
                function (err) {
                    if (err) return reject(err);
                    resolve({ monthlyGoal: goal, updatedAt });
                }
            );
        }
    });
}

// Category budgets
function getCategoryBudgetsForUser(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT category, monthlyBudget FROM category_budgets WHERE userId = ? ORDER BY LOWER(category) ASC",
            [userId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            }
        );
    });
}

function upsertCategoryBudgetForUser(userId, category, monthlyBudget) {
    const updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO category_budgets (userId, category, monthlyBudget, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(userId, category) DO UPDATE SET
                monthlyBudget = excluded.monthlyBudget,
                updatedAt = excluded.updatedAt
            `,
            [userId, category, monthlyBudget, updatedAt],
            function (err) {
                if (err) return reject(err);
                resolve({ category, monthlyBudget });
            }
        );
    });
}

function deleteCategoryBudgetForUser(userId, category) {
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM category_budgets WHERE userId = ? AND category = ?",
            [userId, category],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

// Import user data from JSON backup
async function importUserData(userId, data) {
    const { savingGoal, categoryBudgets, transactions, user } = data || {};

    const txList = Array.isArray(transactions) ? transactions : [];
    const budgetList = Array.isArray(categoryBudgets) ? categoryBudgets : [];

    try {
        await runAsync("BEGIN TRANSACTION");

        await runAsync("DELETE FROM transactions WHERE userId = ?", [userId]);
        await runAsync("DELETE FROM category_budgets WHERE userId = ?", [userId]);
        await runAsync("DELETE FROM saving_goals WHERE userId = ?", [userId]);

        if (user && typeof user.avatar === "string") {
            await updateUserAvatar(userId, user.avatar);
        }

        if (savingGoal && typeof savingGoal.monthlyGoal === "number") {
            await upsertSavingGoalForUser(userId, savingGoal.monthlyGoal);
        }

        for (const b of budgetList) {
            if (
                b &&
                typeof b.category === "string" &&
                typeof b.monthlyBudget === "number"
            ) {
                await upsertCategoryBudgetForUser(
                    userId,
                    b.category,
                    b.monthlyBudget
                );
            }
        }

        for (const t of txList) {
            if (!t) continue;
            const amount = Number(t.amount);
            const type = t.type;
            const category = typeof t.category === "string" ? t.category : "";
            if (
                !type ||
                (type !== "debit" && type !== "credit") ||
                !category ||
                Number.isNaN(amount) ||
                amount <= 0
            ) {
                continue;
            }

            let createdAt = t.createdAt;
            const note =
                typeof t.note === "string" && t.note.trim().length > 0
                    ? t.note.trim()
                    : null;

            const d = new Date(createdAt);
            if (!createdAt || Number.isNaN(d.getTime())) {
                createdAt = new Date().toISOString();
            }

            await runAsync(
                "INSERT INTO transactions (userId, amount, type, category, createdAt, note) VALUES (?, ?, ?, ?, ?, ?)",
                [userId, amount, type, category, createdAt, note]
            );
        }

        await runAsync("COMMIT");
        return {
            transactions: txList.length,
            categoryBudgets: budgetList.length,
            savingGoal: savingGoal && typeof savingGoal.monthlyGoal === "number"
        };
    } catch (err) {
        try {
            await runAsync("ROLLBACK");
        } catch (e) {}
        throw err;
    }
}

// --- Routes ---

// Health
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Expense Tracker backend is running"
    });
});

// Auth
app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || typeof username !== "string" || username.length < 3) {
        return res
            .status(400)
            .json({ error: "Username must be at least 3 characters." });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
        return res
            .status(400)
            .json({ error: "Password must be at least 6 characters." });
    }

    try {
        const existing = await findUserByUsername(username);
        if (existing) {
            return res.status(400).json({ error: "Username already taken." });
        }

        const user = await createUser(username, password);
        const token = generateToken(user);

        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt,
                avatar: user.avatar || null
            },
            token
        });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Failed to register user" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || typeof username !== "string") {
        return res.status(400).json({ error: "Username is required." });
    }
    if (!password || typeof password !== "string") {
        return res.status(400).json({ error: "Password is required." });
    }

    try {
        const user = await findUserByUsername(username);
        if (!user) {
            return res
                .status(401)
                .json({ error: "Invalid username or password." });
        }

        const valid = bcrypt.compareSync(password, user.passwordHash);
        if (!valid) {
            return res
                .status(401)
                .json({ error: "Invalid username or password." });
        }

        const token = generateToken(user);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt,
                avatar: user.avatar || null
            },
            token
        });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Failed to login" });
    }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            createdAt: req.user.createdAt,
            avatar: req.user.avatar || null
        }
    });
});

// Avatar update
app.put("/api/user/avatar", authMiddleware, async (req, res) => {
    const { avatar } = req.body || {};

    if (avatar !== null && avatar !== undefined) {
        if (typeof avatar !== "string") {
            return res
                .status(400)
                .json({ error: "avatar must be a string or null." });
        }
        if (avatar.length > 300000) {
            return res.status(400).json({
                error: "Avatar image is too large. Please use a smaller image."
            });
        }
    }

    try {
        const saved = await updateUserAvatar(req.user.id, avatar || null);
        res.json({ avatar: saved });
    } catch (error) {
        console.error("Error updating avatar:", error);
        res.status(500).json({ error: "Failed to update avatar" });
    }
});

// Saving goal
app.get("/api/saving-goal", authMiddleware, async (req, res) => {
    try {
        const row = await getSavingGoalForUser(req.user.id);
        const goal =
            row && typeof row.monthlyGoal === "number"
                ? row.monthlyGoal
                : null;
        res.json({ goal });
    } catch (error) {
        console.error("Error getting saving goal:", error);
        res.status(500).json({ error: "Failed to get saving goal" });
    }
});

app.put("/api/saving-goal", authMiddleware, async (req, res) => {
    const { goal } = req.body || {};

    if (goal === null) {
        try {
            await upsertSavingGoalForUser(req.user.id, null);
            return res.json({ goal: null });
        } catch (error) {
            console.error("Error clearing saving goal:", error);
            return res.status(500).json({ error: "Failed to save saving goal" });
        }
    }

    const numGoal = Number(goal);
    if (Number.isNaN(numGoal) || numGoal < 0) {
        return res.status(400).json({
            error: "Goal must be a number 0 or greater."
        });
    }

    try {
        await upsertSavingGoalForUser(req.user.id, numGoal);
        res.json({ goal: numGoal });
    } catch (error) {
        console.error("Error saving saving goal:", error);
        res.status(500).json({ error: "Failed to save saving goal" });
    }
});

// Category budgets
app.get("/api/category-budgets", authMiddleware, async (req, res) => {
    try {
        const rows = await getCategoryBudgetsForUser(req.user.id);
        res.json(rows);
    } catch (error) {
        console.error("Error getting category budgets:", error);
        res.status(500).json({ error: "Failed to get category budgets" });
    }
});

app.post("/api/category-budgets", authMiddleware, async (req, res) => {
    let { category, monthlyBudget } = req.body || {};

    if (!category || typeof category !== "string") {
        return res
            .status(400)
            .json({ error: "Category is required and must be a string." });
    }
    category = category.trim();
    if (!category) {
        return res.status(400).json({ error: "Category cannot be empty." });
    }

    const numBudget = Number(monthlyBudget);
    if (Number.isNaN(numBudget) || numBudget <= 0) {
        return res.status(400).json({
            error: "Monthly budget must be a positive number."
        });
    }

    try {
        const result = await upsertCategoryBudgetForUser(
            req.user.id,
            category,
            numBudget
        );
        res.status(201).json(result);
    } catch (error) {
        console.error("Error saving category budget:", error);
        res.status(500).json({ error: "Failed to save category budget" });
    }
});

app.delete(
    "/api/category-budgets/:category",
    authMiddleware,
    async (req, res) => {
        const encodedCategory = req.params.category;
        if (!encodedCategory) {
            return res.status(400).json({ error: "Category is required." });
        }
        const category = decodeURIComponent(encodedCategory);

        try {
            const deleted = await deleteCategoryBudgetForUser(
                req.user.id,
                category
            );
            if (!deleted) {
                return res
                    .status(404)
                    .json({ error: "Category budget not found" });
            }
            res.json({ success: true });
        } catch (error) {
            console.error("Error deleting category budget:", error);
            res.status(500).json({ error: "Failed to delete category budget" });
        }
    }
);

// Transactions
app.get("/api/transactions", authMiddleware, async (req, res) => {
    try {
        const rows = await getAllTransactionsForUser(req.user.id);
        res.json(rows);
    } catch (error) {
        console.error("Error getting transactions:", error);
        res.status(500).json({ error: "Failed to get transactions" });
    }
});

app.post("/api/transactions", authMiddleware, async (req, res) => {
    const errors = validateFullTransaction(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const amount = Number(req.body.amount);
    const type = req.body.type;
    const category = req.body.category.trim();
    const note =
        typeof req.body.note === "string" && req.body.note.trim().length > 0
            ? req.body.note.trim()
            : null;

    try {
        const created = await createTransaction(
            req.user.id,
            amount,
            type,
            category,
            note
        );
        res.status(201).json(created);
    } catch (error) {
        console.error("Error creating transaction:", error);
        res.status(500).json({ error: "Failed to create transaction" });
    }
});

app.put("/api/transactions/:id", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);

    const errors = validateFullTransaction(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const amount = Number(req.body.amount);
    const type = req.body.type;
    const category = req.body.category.trim();
    const note =
        typeof req.body.note === "string" && req.body.note.trim().length > 0
            ? req.body.note.trim()
            : null;

    try {
        const updated = await updateTransaction(
            req.user.id,
            id,
            amount,
            type,
            category,
            note
        );
        if (!updated) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.json(updated);
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).json({ error: "Failed to update transaction" });
    }
});

app.delete("/api/transactions/:id", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);

    try {
        const deleted = await deleteTransaction(req.user.id, id);
        if (!deleted) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.json({ success: true, deleted });
    } catch (error) {
        console.error("Error deleting transaction:", error);
        res.status(500).json({ error: "Failed to delete transaction" });
    }
});

// JSON export/import
app.get("/api/export/json", authMiddleware, async (req, res) => {
    try {
        const [txRows, budgetRows, savingRow] = await Promise.all([
            getAllTransactionsForUser(req.user.id),
            getCategoryBudgetsForUser(req.user.id),
            getSavingGoalForUser(req.user.id)
        ]);

        const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            user: {
                username: req.user.username,
                createdAt: req.user.createdAt,
                avatar: req.user.avatar || null
            },
            savingGoal:
                savingRow && typeof savingRow.monthlyGoal === "number"
                    ? { monthlyGoal: savingRow.monthlyGoal }
                    : null,
            categoryBudgets: budgetRows || [],
            transactions: txRows || []
        };

        res.json(backup);
    } catch (error) {
        console.error("Error exporting JSON:", error);
        res.status(500).json({ error: "Failed to export JSON" });
    }
});

app.post("/api/import/json", authMiddleware, async (req, res) => {
    const data = req.body || {};

    if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "Invalid backup format." });
    }

    try {
        const result = await importUserData(req.user.id, data);
        res.json({
            success: true,
            imported: result
        });
    } catch (error) {
        console.error("Error importing JSON:", error);
        res.status(500).json({ error: "Failed to import JSON backup" });
    }
});

// CSV export
app.get(
    "/api/transactions/export/csv",
    authMiddleware,
    async (req, res) => {
        try {
            const rows = await getAllTransactionsForUser(req.user.id);

            const header = [
                "id",
                "amount",
                "type",
                "category",
                "createdAt",
                "note"
            ];
            const lines = [header.join(",")];

            for (const row of rows) {
                const fields = [
                    row.id,
                    row.amount,
                    row.type,
                    row.category,
                    row.createdAt,
                    row.note
                ].map((value) => {
                    if (value === null || value === undefined) return "";
                    const str = String(value);
                    const escaped = str
                        .replace(/"/g, '""')
                        .replace(/\r?\n/g, " ");
                    if (/[",\n\r]/.test(escaped)) {
                        return `"${escaped}"`;
                    }
                    return escaped;
                });
                lines.push(fields.join(","));
            }

            const csv = lines.join("\r\n");

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="transactions.csv"'
            );
            res.send(csv);
        } catch (error) {
            console.error("Error exporting CSV:", error);
            res.status(500).json({ error: "Failed to export CSV" });
        }
    }
);

// --- Start server ---

app.listen(PORT, () => {
    console.log(`Backend server is listening on http://localhost:${PORT}`);
});