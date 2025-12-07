// Frontend logic for Expense Tracker
// Features:
// - Multi-user auth (login/register, JWT)
// - Per-user transactions in backend (SQLite)
// - Per-user monthly saving goal
// - Daily/weekly/monthly/yearly summaries
// - Charts: category (month), debit 7 days, net cash flow 90 days
// - Category totals table (month)
// - Category budgets (per month, per user) with progress
// - Optional date range filter for the transactions list
// - Dark mode toggle

// Backend base URL
const API_BASE_URL = "http://localhost:4000";

// Keys for LocalStorage
const AUTH_TOKEN_KEY = "expense-tracker-auth-token-v1";
const AUTH_USER_KEY = "expense-tracker-auth-user-v1";
const THEME_KEY = "expense-tracker-theme-v1";

// In-memory data
const transactions = [];
const categoryBudgets = []; // { category, monthlyBudget }
let savingGoalAmount = null; // number or null
let categoryChart = null;
let dailyChart = null;
let netTrendChart = null;
let editingTransactionId = null;

// Auth state
let authToken = null; // JWT token string or null
let currentUser = null; // { id, username } or null

// Filters
const filters = {
    type: "all", // "all" | "debit" | "credit"
    category: "" // lowercase substring
};

// Date range filter (affects transactions list + range summary)
const currentRange = {
    from: null, // Date or null (inclusive)
    to: null // Date or null (inclusive)
};

document.addEventListener("DOMContentLoaded", () => {
    // === Element references ===

    // Theme
    const themeToggleCheckbox = document.getElementById(
        "theme-toggle-checkbox"
    );

    // Auth
    const authLoggedOut = document.getElementById("auth-logged-out");
    const authLoggedIn = document.getElementById("auth-logged-in");
    const currentUsernameEl = document.getElementById("current-username");

    const loginForm = document.getElementById("login-form");
    const loginUsernameInput = document.getElementById("login-username");
    const loginPasswordInput = document.getElementById("login-password");
    const loginErrorEl = document.getElementById("login-error");

    const registerForm = document.getElementById("register-form");
    const registerUsernameInput = document.getElementById("register-username");
    const registerPasswordInput = document.getElementById("register-password");
    const registerPassword2Input = document.getElementById("register-password2");
    const registerErrorEl = document.getElementById("register-error");

    const showRegisterButton = document.getElementById("show-register");
    const showLoginButton = document.getElementById("show-login");
    const logoutButton = document.getElementById("logout-button");

    const authRequiredSections = document.querySelectorAll(".requires-auth");

    // Status
    const statusElement = document.getElementById("status-text");

    // Transactions
    const form = document.getElementById("transaction-form");
    const amountInput = document.getElementById("amount");
    const typeInput = document.getElementById("type");
    const categoryInput = document.getElementById("category");
    const formError = document.getElementById("form-error");

    const submitButton = document.getElementById("transaction-submit-button");
    const cancelEditButton = document.getElementById("transaction-cancel-edit");
    const editingHint = document.getElementById("editing-hint");

    const transactionList = document.getElementById("transaction-list");
    const noTransactionsText = document.getElementById("no-transactions");
    const noTransactionsFilteredText = document.getElementById(
        "no-transactions-filtered"
    );

    // Filters (type/category)
    const filterTypeSelect = document.getElementById("filter-type");
    const filterCategoryInput = document.getElementById("filter-category");
    const filterResetButton = document.getElementById("filter-reset");
    const downloadCsvButton = document.getElementById("download-csv");

    // Date range filter
    const rangePresetSelect = document.getElementById("range-preset");
    const rangeFromInput = document.getElementById("range-from");
    const rangeToInput = document.getElementById("range-to");
    const rangeApplyButton = document.getElementById("range-apply");
    const rangeClearButton = document.getElementById("range-clear");
    const rangeSummaryText = document.getElementById("range-summary-text");

    // Summary elements
    const todayDebitEl = document.getElementById("today-debit");
    const todayCreditEl = document.getElementById("today-credit");
    const todayNetEl = document.getElementById("today-net");

    const weekDebitEl = document.getElementById("week-debit");
    const weekCreditEl = document.getElementById("week-credit");
    const weekNetEl = document.getElementById("week-net");

    const monthDebitEl = document.getElementById("month-debit");
    const monthCreditEl = document.getElementById("month-credit");
    const monthNetEl = document.getElementById("month-net");

    const yearDebitEl = document.getElementById("year-debit");
    const yearCreditEl = document.getElementById("year-credit");
    const yearNetEl = document.getElementById("year-net");

    const overallDebitEl = document.getElementById("overall-debit");
    const overallCreditEl = document.getElementById("overall-credit");
    const overallNetEl = document.getElementById("overall-net");

    // Saving goal elements
    const savingGoalForm = document.getElementById("saving-goal-form");
    const savingGoalInput = document.getElementById("saving-goal-amount");
    const savingGoalError = document.getElementById("saving-goal-error");
    const savingCurrentNetEl = document.getElementById("saving-current-net");
    const savingGoalDisplayEl = document.getElementById("saving-goal-display");
    const savingGoalStatusEl = document.getElementById("saving-goal-status");
    const savingGoalProgressEl = document.getElementById("saving-goal-progress");

    // Charts empties
    const categoryChartEmpty = document.getElementById("category-chart-empty");
    const dailyChartEmpty = document.getElementById("daily-chart-empty");
    const netTrendChartEmpty = document.getElementById("net-trend-chart-empty");

    // Category totals table
    const categoryTotalsBody = document.getElementById("category-totals-body");
    const categoryTotalsEmpty = document.getElementById("category-totals-empty");

    // Category budgets elements
    const categoryBudgetForm = document.getElementById("category-budget-form");
    const budgetCategoryInput = document.getElementById("budget-category");
    const budgetAmountInput = document.getElementById("budget-amount");
    const budgetErrorEl = document.getElementById("budget-error");
    const categoryBudgetsBody = document.getElementById("category-budgets-body");
    const categoryBudgetsEmpty = document.getElementById(
        "category-budgets-empty"
    );
    const categoryBudgetsTable = document.getElementById(
        "category-budgets-table"
    );

    // === Status text ===
    if (statusElement) {
        const now = new Date();
        const formattedTime = now.toLocaleString();
        statusElement.textContent = `JavaScript is working. Page loaded at: ${formattedTime}`;
        statusElement.style.color = "#2e7d32";
    }

    // === Theme helpers ===

    function applyTheme(theme) {
        const mode = theme === "dark" ? "dark" : "light";
        if (mode === "dark") {
            document.body.classList.add("dark-theme");
            if (themeToggleCheckbox) themeToggleCheckbox.checked = true;
        } else {
            document.body.classList.remove("dark-theme");
            if (themeToggleCheckbox) themeToggleCheckbox.checked = false;
        }
    }

    function loadTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        applyTheme(stored === "dark" ? "dark" : "light");
    }

    function saveTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
    }

    if (themeToggleCheckbox) {
        themeToggleCheckbox.addEventListener("change", () => {
            const theme = themeToggleCheckbox.checked ? "dark" : "light";
            applyTheme(theme);
            saveTheme(theme);
        });
    }

    // === Saving goal API helpers ===

    async function loadSavingGoalFromServer() {
        try {
            const data = await fetchJson(`${API_BASE_URL}/api/saving-goal`);
            if (data && typeof data.goal === "number" && data.goal >= 0) {
                savingGoalAmount = data.goal;
            } else {
                savingGoalAmount = null;
            }
        } catch (error) {
            console.error("Failed to load saving goal from server:", error);
            savingGoalAmount = null;
        }
    }

    async function saveSavingGoalToServer(goal) {
        const body = { goal };
        const data = await fetchJson(`${API_BASE_URL}/api/saving-goal`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (data && typeof data.goal === "number" && data.goal >= 0) {
            savingGoalAmount = data.goal;
        } else {
            savingGoalAmount = null;
        }
    }

    function syncSavingGoalInput() {
        if (!savingGoalInput) return;
        if (savingGoalAmount === null) {
            savingGoalInput.value = "";
        } else {
            savingGoalInput.value = savingGoalAmount.toString();
        }
    }

    // === Category budgets API helpers ===

    async function loadCategoryBudgetsFromServer() {
        try {
            const data = await fetchJson(`${API_BASE_URL}/api/category-budgets`);
            categoryBudgets.length = 0;
            data.forEach((row) => {
                if (
                    row &&
                    typeof row.category === "string" &&
                    typeof row.monthlyBudget === "number"
                ) {
                    categoryBudgets.push({
                        category: row.category,
                        monthlyBudget: row.monthlyBudget
                    });
                }
            });
        } catch (error) {
            console.error("Failed to load category budgets from server:", error);
            categoryBudgets.length = 0;
        }
    }

    async function saveCategoryBudgetOnServer(category, monthlyBudget) {
        return fetchJson(`${API_BASE_URL}/api/category-budgets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category, monthlyBudget })
        });
    }

    async function deleteCategoryBudgetOnServer(category) {
        const encoded = encodeURIComponent(category);
        return fetchJson(`${API_BASE_URL}/api/category-budgets/${encoded}`, {
            method: "DELETE"
        });
    }

    // === Auth LocalStorage helpers ===

    function loadAuthFromStorage() {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const userJson = localStorage.getItem(AUTH_USER_KEY);

        if (!token || !userJson) {
            authToken = null;
            currentUser = null;
            return;
        }

        try {
            const user = JSON.parse(userJson);
            if (
                user &&
                typeof user.id === "number" &&
                typeof user.username === "string"
            ) {
                authToken = token;
                currentUser = user;
            } else {
                authToken = null;
                currentUser = null;
            }
        } catch (error) {
            console.error("Error parsing auth user from LocalStorage:", error);
            authToken = null;
            currentUser = null;
        }
    }

    function saveAuthToStorage() {
        try {
            if (!authToken || !currentUser) {
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(AUTH_USER_KEY);
                return;
            }
            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
        } catch (error) {
            console.error("Error saving auth to LocalStorage:", error);
        }
    }

    function clearAuthFromStorage() {
        try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
        } catch (error) {
            console.error("Error clearing auth from LocalStorage:", error);
        }
    }

    function updateAuthUI() {
        const loggedIn = !!currentUser;

        if (authLoggedIn) {
            authLoggedIn.style.display = loggedIn ? "block" : "none";
        }
        if (authLoggedOut) {
            authLoggedOut.style.display = loggedIn ? "none" : "block";
        }
        if (currentUsernameEl) {
            currentUsernameEl.textContent = loggedIn ? currentUser.username : "";
        }

        authRequiredSections.forEach((section) => {
            section.style.display = loggedIn ? "block" : "none";
        });
    }

    function setAuth(user, token) {
        currentUser = user;
        authToken = token;
        saveAuthToStorage();

        // When user changes, reset local data, budgets and saving goal
        transactions.length = 0;
        categoryBudgets.length = 0;
        savingGoalAmount = null;
        syncSavingGoalInput();
        clearRangeInternal(false);

        renderTransactions();
        updateSummaries();

        updateAuthUI();
    }

    function clearAuthState() {
        authToken = null;
        currentUser = null;
        clearAuthFromStorage();

        transactions.length = 0;
        categoryBudgets.length = 0;
        savingGoalAmount = null;
        syncSavingGoalInput();
        clearRangeInternal(false);

        renderTransactions();
        updateSummaries();

        updateAuthUI();
    }

    // === Backend API helpers ===

    async function fetchJson(url, options = {}) {
        const headers = options.headers ? { ...options.headers } : {};

        // Attach auth token if we have one
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
        }

        const finalOptions = { ...options, headers };

        const response = await fetch(url, finalOptions);

        let data = null;
        try {
            data = await response.json();
        } catch {
            // response had no JSON body (e.g., empty)
        }

        if (!response.ok) {
            const error = new Error(
                data && data.error
                    ? data.error
                    : `Request failed with status ${response.status}`
            );
            error.status = response.status;
            throw error;
        }

        return data;
    }

    async function loadTransactionsFromServer() {
        const data = await fetchJson(`${API_BASE_URL}/api/transactions`);
        transactions.length = 0;
        data.forEach((tx) => transactions.push(tx));
    }

    async function createTransactionOnServer(amount, type, category) {
        return fetchJson(`${API_BASE_URL}/api/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, type, category })
        });
    }

    async function updateTransactionOnServer(id, payload) {
        return fetchJson(`${API_BASE_URL}/api/transactions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }

    async function deleteTransactionOnServer(id) {
        return fetchJson(`${API_BASE_URL}/api/transactions/${id}`, {
            method: "DELETE"
        });
    }

    // === Date helper functions ===

    function getStartOfToday() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getStartOfTomorrow() {
        const d = getStartOfToday();
        d.setDate(d.getDate() + 1);
        return d;
    }

    // Week: Monday as first day of week
    function getStartOfWeek() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const day = d.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = day === 0 ? -6 : 1 - day; // move to Monday
        d.setDate(d.getDate() + diff);
        return d;
    }

    function getStartOfNextWeek() {
        const d = getStartOfWeek();
        d.setDate(d.getDate() + 7);
        return d;
    }

    function getStartOfMonth() {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getStartOfNextMonth() {
        const d = getStartOfMonth();
        d.setMonth(d.getMonth() + 1);
        return d;
    }

    function getStartOfYear() {
        const d = new Date();
        d.setMonth(0, 1); // Jan 1
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getStartOfNextYear() {
        const d = getStartOfYear();
        d.setFullYear(d.getFullYear() + 1);
        return d;
    }

    // Date range helpers
    function parseDateInput(value) {
        if (!value) return null;
        const d = new Date(value + "T00:00:00");
        if (isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDateForDisplay(date) {
        return date.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function isInRange(date, range) {
        if (range.from && date < range.from) return false;
        if (range.to) {
            const end = new Date(range.to);
            end.setDate(end.getDate() + 1);
            end.setHours(0, 0, 0, 0);
            if (date >= end) return false;
        }
        return true;
    }

    function setRange(from, to, updatePreset = false) {
        currentRange.from = from || null;
        currentRange.to = to || null;
        updateRangeSummary();
        renderTransactions();
        if (updatePreset && rangePresetSelect) {
            rangePresetSelect.value = "custom";
        }
    }

    function clearRangeInternal(updatePreset = true) {
        currentRange.from = null;
        currentRange.to = null;
        if (rangeFromInput) rangeFromInput.value = "";
        if (rangeToInput) rangeToInput.value = "";
        if (updatePreset && rangePresetSelect) {
            rangePresetSelect.value = "none";
        }
        updateRangeSummary();
        renderTransactions();
    }

    function updateRangeSummary() {
        if (!rangeSummaryText) return;

        if (!currentRange.from && !currentRange.to) {
            rangeSummaryText.textContent =
                "No custom date range selected. Showing all transactions.";
            return;
        }

        let debit = 0;
        let credit = 0;

        transactions.forEach((tx) => {
            const d = new Date(tx.createdAt);
            if (isNaN(d.getTime())) return;
            if (!isInRange(d, currentRange)) return;

            if (tx.type === "debit") debit += tx.amount;
            else if (tx.type === "credit") credit += tx.amount;
        });

        const net = credit - debit;
        const parts = [];

        if (currentRange.from)
            parts.push(formatDateForDisplay(currentRange.from));
        else parts.push("…");

        parts.push("to");

        if (currentRange.to)
            parts.push(formatDateForDisplay(currentRange.to));
        else parts.push("…");

        rangeSummaryText.textContent =
            `${parts.join(" ")} – Debit: Rs ${debit.toFixed(
                2
            )}, ` +
            `Credit: Rs ${credit.toFixed(
                2
            )}, Net: Rs ${net.toFixed(
                2
            )}. (Range affects the transactions list only.)`;
    }

    // === Saving goal UI update ===

    function updateSavingGoalUI(currentMonthNet) {
        if (
            !savingCurrentNetEl ||
            !savingGoalDisplayEl ||
            !savingGoalStatusEl ||
            !savingGoalProgressEl
        ) {
            return;
        }

        savingCurrentNetEl.textContent = `Rs ${currentMonthNet.toFixed(2)}`;

        if (savingGoalAmount === null) {
            savingGoalDisplayEl.textContent = "Not set";
            savingGoalStatusEl.textContent = "Set a goal to see your progress.";
            savingGoalProgressEl.style.width = "0%";
            return;
        }

        savingGoalDisplayEl.textContent = `Rs ${savingGoalAmount.toFixed(2)}`;

        if (savingGoalAmount === 0) {
            savingGoalStatusEl.textContent =
                "Goal is zero. Any positive saving is progress.";
            savingGoalProgressEl.style.width = "0%";
            return;
        }

        if (currentMonthNet <= 0) {
            savingGoalStatusEl.textContent =
                "You haven't saved anything yet this month.";
            savingGoalProgressEl.style.width = "0%";
            return;
        }

        const ratio = Math.max(0, Math.min(1, currentMonthNet / savingGoalAmount));
        const percent = (ratio * 100).toFixed(0);
        savingGoalProgressEl.style.width = `${percent}%`;

        if (currentMonthNet >= savingGoalAmount) {
            const extra = currentMonthNet - savingGoalAmount;
            savingGoalStatusEl.textContent = `Goal reached! You are Rs ${extra.toFixed(
                2
            )} above your goal.`;
        } else {
            const remaining = savingGoalAmount - currentMonthNet;
            savingGoalStatusEl.textContent = `Rs ${remaining.toFixed(
                2
            )} more to reach your goal. (${percent}% done)`;
        }
    }

    // === Chart data helpers ===

    function getCategoryTotalsForCurrentMonth() {
        const monthStart = getStartOfMonth();
        const nextMonthStart = getStartOfNextMonth();
        const totals = {};

        transactions.forEach((tx) => {
            if (tx.type !== "debit") return;

            const created = new Date(tx.createdAt);
            if (isNaN(created.getTime())) return;

            if (created >= monthStart && created < nextMonthStart) {
                const category = tx.category || "Uncategorized";
                totals[category] = (totals[category] || 0) + tx.amount;
            }
        });

        return totals;
    }

    function getDailyDebitTotalsLast7Days() {
        const results = [];
        const today = getStartOfToday();

        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(today.getDate() - i);
            const nextDay = new Date(dayStart);
            nextDay.setDate(dayStart.getDate() + 1);

            let total = 0;

            transactions.forEach((tx) => {
                if (tx.type !== "debit") return;
                const created = new Date(tx.createdAt);
                if (isNaN(created.getTime())) return;
                if (created >= dayStart && created < nextDay) {
                    total += tx.amount;
                }
            });

            const label = dayStart.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short"
            });

            results.push({ label, total });
        }

        return results;
    }

    function getNetDailyTotalsLastNDays(days = 90) {
        const results = [];
        const today = getStartOfToday();

        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(today.getDate() - i);
            const nextDay = new Date(dayStart);
            nextDay.setDate(dayStart.getDate() + 1);

            let debit = 0;
            let credit = 0;

            transactions.forEach((tx) => {
                const created = new Date(tx.createdAt);
                if (isNaN(created.getTime())) return;
                if (created >= dayStart && created < nextDay) {
                    if (tx.type === "debit") debit += tx.amount;
                    else if (tx.type === "credit") credit += tx.amount;
                }
            });

            const net = credit - debit;
            const label = dayStart.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short"
            });

            results.push({ label, net });
        }

        return results;
    }

    // === Chart update functions ===

    function updateCategoryChart() {
        const canvas = document.getElementById("category-chart");
        if (!canvas) return;

        const totals = getCategoryTotalsForCurrentMonth();
        const labels = Object.keys(totals);
        const data = Object.values(totals);

        if (labels.length === 0 || data.length === 0) {
            if (categoryChart) {
                categoryChart.destroy();
                categoryChart = null;
            }
            canvas.style.display = "none";
            if (categoryChartEmpty) categoryChartEmpty.style.display = "block";
            return;
        }

        canvas.style.display = "block";
        if (categoryChartEmpty) categoryChartEmpty.style.display = "none";

        const baseColors = [
            "#4caf50",
            "#2196f3",
            "#ff9800",
            "#e91e63",
            "#9c27b0",
            "#009688",
            "#795548",
            "#3f51b5",
            "#ffc107",
            "#607d8b"
        ];
        const colors = labels.map(
            (_, index) => baseColors[index % baseColors.length]
        );

        if (categoryChart) {
            categoryChart.data.labels = labels;
            categoryChart.data.datasets[0].data = data;
            categoryChart.data.datasets[0].backgroundColor = colors;
            categoryChart.update();
        } else if (typeof Chart !== "undefined") {
            categoryChart = new Chart(canvas, {
                type: "doughnut",
                data: {
                    labels,
                    datasets: [
                        {
                            data,
                            backgroundColor: colors
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    }

    function updateDailyChart() {
        const canvas = document.getElementById("daily-chart");
        if (!canvas) return;

        const dailyData = getDailyDebitTotalsLast7Days();
        const labels = dailyData.map((d) => d.label);
        const data = dailyData.map((d) => Number(d.total.toFixed(2)));

        const allZero = data.every((v) => v === 0);

        if (allZero) {
            if (dailyChart) {
                dailyChart.destroy();
                dailyChart = null;
            }
            canvas.style.display = "none";
            if (dailyChartEmpty) dailyChartEmpty.style.display = "block";
            return;
        }

        canvas.style.display = "block";
        if (dailyChartEmpty) dailyChartEmpty.style.display = "none";

        if (dailyChart) {
            dailyChart.data.labels = labels;
            dailyChart.data.datasets[0].data = data;
            dailyChart.update();
        } else if (typeof Chart !== "undefined") {
            dailyChart = new Chart(canvas, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Debit (Rs)",
                            data,
                            backgroundColor: "#4a90e2"
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    function updateNetTrendChart() {
        const canvas = document.getElementById("net-trend-chart");
        if (!canvas) return;

        const dataPoints = getNetDailyTotalsLastNDays(90);
        const labels = dataPoints.map((d) => d.label);
        const data = dataPoints.map((d) => Number(d.net.toFixed(2)));

        const allZero = data.every((v) => v === 0);

        if (allZero) {
            if (netTrendChart) {
                netTrendChart.destroy();
                netTrendChart = null;
            }
            canvas.style.display = "none";
            if (netTrendChartEmpty) netTrendChartEmpty.style.display = "block";
            return;
        }

        canvas.style.display = "block";
        if (netTrendChartEmpty) netTrendChartEmpty.style.display = "none";

        if (netTrendChart) {
            netTrendChart.data.labels = labels;
            netTrendChart.data.datasets[0].data = data;
            netTrendChart.update();
        } else if (typeof Chart !== "undefined") {
            netTrendChart = new Chart(canvas, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Net (Credit - Debit)",
                            data,
                            borderColor: "#ff9800",
                            backgroundColor: "rgba(255, 152, 0, 0.15)",
                            tension: 0.2,
                            fill: true,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    function updateCharts() {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js not loaded; charts will not be displayed.");
            return;
        }
        updateCategoryChart();
        updateDailyChart();
        updateNetTrendChart();
    }

    // === Category totals table ===

    function renderCategoryTotalsTable() {
        if (!categoryTotalsBody || !categoryTotalsEmpty) return;

        const totals = getCategoryTotalsForCurrentMonth();
        const categories = Object.keys(totals);

        categoryTotalsBody.innerHTML = "";

        const table = categoryTotalsBody.closest("table");

        if (categories.length === 0) {
            if (categoryTotalsEmpty) categoryTotalsEmpty.style.display = "block";
            if (table) table.style.display = "none";
            return;
        }

        if (categoryTotalsEmpty) categoryTotalsEmpty.style.display = "none";
        if (table) table.style.display = "table";

        const grandTotal = categories.reduce(
            (sum, cat) => sum + totals[cat],
            0
        );

        const sortedCategories = categories.sort(
            (a, b) => totals[b] - totals[a]
        );

        sortedCategories.forEach((category) => {
            const amount = totals[category];
            const percent =
                grandTotal > 0 ? (amount / grandTotal) * 100 : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${category}</td>
                <td class="amount-cell">Rs ${amount.toFixed(2)}</td>
                <td class="percent-cell">${percent.toFixed(1)}%</td>
            `;
            categoryTotalsBody.appendChild(tr);
        });
    }

    // === Category budgets table ===

    function renderCategoryBudgetsTable() {
        if (
            !categoryBudgetsBody ||
            !categoryBudgetsEmpty ||
            !categoryBudgetsTable
        ) {
            return;
        }

        categoryBudgetsBody.innerHTML = "";

        if (categoryBudgets.length === 0) {
            categoryBudgetsEmpty.style.display = "block";
            categoryBudgetsTable.style.display = "none";
            return;
        }

        categoryBudgetsEmpty.style.display = "none";
        categoryBudgetsTable.style.display = "table";

        const monthTotals = getCategoryTotalsForCurrentMonth();

        const sortedBudgets = categoryBudgets
            .slice()
            .sort((a, b) =>
                a.category.toLowerCase().localeCompare(b.category.toLowerCase())
            );

        sortedBudgets.forEach((budget) => {
            const category = budget.category;
            const limit = budget.monthlyBudget;
            const spent = monthTotals[category] || 0;
            const remaining = limit - spent;
            const usedRatio =
                limit > 0 ? Math.max(0, Math.min(1, spent / limit)) : 0;
            const usedPercent = (usedRatio * 100).toFixed(0);

            const statusText =
                remaining >= 0
                    ? `Rs ${remaining.toFixed(2)} left`
                    : `Over by Rs ${Math.abs(remaining).toFixed(2)}`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${category}</td>
                <td class="amount-cell">Rs ${limit.toFixed(2)}</td>
                <td class="amount-cell">
                    Rs ${spent.toFixed(2)}
                    <div class="budget-progress">
                        <div class="budget-progress-fill" style="width: ${usedPercent}%"></div>
                    </div>
                </td>
                <td class="amount-cell">${statusText}</td>
                <td>
                    <button
                        type="button"
                        class="secondary-button small delete-budget-button"
                        data-category="${category}"
                    >
                        Delete
                    </button>
                </td>
            `;
            categoryBudgetsBody.appendChild(tr);
        });
    }

    // === Summary calculation and rendering ===

    function updateSummaries() {
        const todayStart = getStartOfToday();
        const tomorrowStart = getStartOfTomorrow();

        const weekStart = getStartOfWeek();
        const nextWeekStart = getStartOfNextWeek();

        const monthStart = getStartOfMonth();
        const nextMonthStart = getStartOfNextMonth();

        const yearStart = getStartOfYear();
        const nextYearStart = getStartOfNextYear();

        const today = { debit: 0, credit: 0 };
        const week = { debit: 0, credit: 0 };
        const month = { debit: 0, credit: 0 };
        const year = { debit: 0, credit: 0 };
        const overall = { debit: 0, credit: 0 };

        transactions.forEach((tx) => {
            const amount = tx.amount;
            const isDebit = tx.type === "debit";

            // Overall
            if (isDebit) {
                overall.debit += amount;
            } else {
                overall.credit += amount;
            }

            const created = new Date(tx.createdAt);
            if (isNaN(created.getTime())) return;

            // Today
            if (created >= todayStart && created < tomorrowStart) {
                if (isDebit) {
                    today.debit += amount;
                } else {
                    today.credit += amount;
                }
            }

            // This week
            if (created >= weekStart && created < nextWeekStart) {
                if (isDebit) {
                    week.debit += amount;
                } else {
                    week.credit += amount;
                }
            }

            // This month
            if (created >= monthStart && created < nextMonthStart) {
                if (isDebit) {
                    month.debit += amount;
                } else {
                    month.credit += amount;
                }
            }

            // This year
            if (created >= yearStart && created < nextYearStart) {
                if (isDebit) {
                    year.debit += amount;
                } else {
                    year.credit += amount;
                }
            }
        });

        const todayNet = today.credit - today.debit;
        const weekNet = week.credit - week.debit;
        const monthNet = month.credit - month.debit;
        const yearNet = year.credit - year.debit;
        const overallNet = overall.credit - overall.debit;

        function formatAmount(value) {
            return `Rs ${value.toFixed(2)}`;
        }

        if (todayDebitEl) todayDebitEl.textContent = formatAmount(today.debit);
        if (todayCreditEl) todayCreditEl.textContent = formatAmount(today.credit);
        if (todayNetEl) todayNetEl.textContent = formatAmount(todayNet);

        if (weekDebitEl) weekDebitEl.textContent = formatAmount(week.debit);
        if (weekCreditEl) weekCreditEl.textContent = formatAmount(week.credit);
        if (weekNetEl) weekNetEl.textContent = formatAmount(weekNet);

        if (monthDebitEl) monthDebitEl.textContent = formatAmount(month.debit);
        if (monthCreditEl) monthCreditEl.textContent = formatAmount(month.credit);
        if (monthNetEl) monthNetEl.textContent = formatAmount(monthNet);

        if (yearDebitEl) yearDebitEl.textContent = formatAmount(year.debit);
        if (yearCreditEl) yearCreditEl.textContent = formatAmount(year.credit);
        if (yearNetEl) yearNetEl.textContent = formatAmount(yearNet);

        if (overallDebitEl) overallDebitEl.textContent = formatAmount(overall.debit);
        if (overallCreditEl)
            overallCreditEl.textContent = formatAmount(overall.credit);
        if (overallNetEl) overallNetEl.textContent = formatAmount(overallNet);

        updateSavingGoalUI(monthNet);
        updateCharts();
        renderCategoryTotalsTable();
        renderCategoryBudgetsTable();
        updateRangeSummary();
    }

    // === Edit mode helpers ===

    function enterEditMode(transaction) {
        editingTransactionId = transaction.id;

        amountInput.value = transaction.amount.toString();
        typeInput.value = transaction.type;
        categoryInput.value = transaction.category;

        if (submitButton) submitButton.textContent = "Save Changes";
        if (cancelEditButton) cancelEditButton.style.display = "inline-block";
        if (editingHint) editingHint.style.display = "block";

        if (formError) formError.textContent = "";
    }

    function exitEditMode() {
        editingTransactionId = null;

        if (submitButton) submitButton.textContent = "Add Transaction";
        if (cancelEditButton) cancelEditButton.style.display = "none";
        if (editingHint) editingHint.style.display = "none";
        if (formError) formError.textContent = "";
    }

    // === Rendering transactions (with type/category + range filters) ===

    function renderTransactions() {
        if (!transactionList) return;

        transactionList.innerHTML = "";

        if (transactions.length === 0) {
            if (noTransactionsText) noTransactionsText.style.display = "block";
            if (noTransactionsFilteredText)
                noTransactionsFilteredText.style.display = "none";
            return;
        } else if (noTransactionsText) {
            noTransactionsText.style.display = "none";
        }

        const filtered = transactions.filter((tx) => {
            if (filters.type !== "all" && tx.type !== filters.type) {
                return false;
            }
            if (filters.category) {
                const cat = (tx.category || "").toLowerCase();
                if (!cat.includes(filters.category)) return false;
            }

            if (currentRange.from || currentRange.to) {
                const created = new Date(tx.createdAt);
                if (isNaN(created.getTime())) return false;
                if (!isInRange(created, currentRange)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            if (noTransactionsFilteredText)
                noTransactionsFilteredText.style.display = "block";
            return;
        } else if (noTransactionsFilteredText) {
            noTransactionsFilteredText.style.display = "none";
        }

        const sorted = filtered
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        sorted.forEach((tx) => {
            const li = document.createElement("li");
            li.classList.add("transaction-item");

            const isCredit = tx.type === "credit";
            const sign = isCredit ? "+" : "-";
            const amountFormatted = tx.amount.toFixed(2);
            const dateTime = new Date(tx.createdAt).toLocaleString();

            li.innerHTML = `
                <div class="transaction-main">
                    <span class="transaction-category">${tx.category}</span>
                    <span class="transaction-amount ${
                        isCredit ? "amount-credit" : "amount-debit"
                    }">
                        ${sign} Rs ${amountFormatted}
                    </span>
                </div>
                <div class="transaction-meta">
                    <span class="transaction-type">${
                        isCredit ? "Credit" : "Debit"
                    }</span>
                    <span class="transaction-time">${dateTime}</span>
                    <button class="edit-button" data-id="${
                        tx.id
                    }" aria-label="Edit transaction">Edit</button>
                    <button class="delete-button" data-id="${
                        tx.id
                    }" aria-label="Delete transaction">Delete</button>
                </div>
            `;

            transactionList.appendChild(li);
        });
    }

    // === Click handler for edit/delete transaction buttons ===

    if (transactionList) {
        transactionList.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            // Delete transaction
            if (target.classList.contains("delete-button")) {
                const idStr = target.getAttribute("data-id");
                if (!idStr) return;
                const id = Number(idStr);

                const confirmed = window.confirm("Delete this transaction?");
                if (!confirmed) return;

                try {
                    await deleteTransactionOnServer(id);
                    const index = transactions.findIndex((tx) => tx.id === id);
                    if (index !== -1) {
                        transactions.splice(index, 1);
                    }
                    renderTransactions();
                    updateSummaries();
                } catch (error) {
                    console.error(error);
                    if (error.status === 401) {
                        alert("Your session has expired. Please log in again.");
                        clearAuthState();
                    } else {
                        alert("Failed to delete transaction from server.");
                    }
                }
                return;
            }

            // Edit
            if (target.classList.contains("edit-button")) {
                const idStr = target.getAttribute("data-id");
                if (!idStr) return;
                const id = Number(idStr);

                const tx = transactions.find((t) => t.id === id);
                if (!tx) return;

                enterEditMode(tx);
                amountInput.focus();
            }
        });
    }

    // === Transaction form handler (add or edit) ===

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            formError.textContent = "";

            const amountValue = parseFloat(amountInput.value);
            const typeValue = typeInput.value;
            const categoryValue = categoryInput.value.trim();

            if (isNaN(amountValue) || amountValue <= 0) {
                formError.textContent = "Please enter a valid positive amount.";
                return;
            }

            if (!categoryValue) {
                formError.textContent =
                    "Please enter a category (e.g. Food, Petrol).";
                return;
            }

            try {
                if (editingTransactionId === null) {
                    const created = await createTransactionOnServer(
                        amountValue,
                        typeValue,
                        categoryValue
                    );
                    transactions.push(created);
                } else {
                    const updated = await updateTransactionOnServer(
                        editingTransactionId,
                        {
                            amount: amountValue,
                            type: typeValue,
                            category: categoryValue
                        }
                    );
                    const index = transactions.findIndex(
                        (t) => t.id === editingTransactionId
                    );
                    if (index !== -1) {
                        transactions[index] = updated;
                    }
                }

                renderTransactions();
                updateSummaries();

                form.reset();
                exitEditMode();
                amountInput.focus();
            } catch (error) {
                console.error(error);
                if (error.status === 401) {
                    formError.textContent =
                        "Your session has expired. Please log in again.";
                    clearAuthState();
                } else {
                    formError.textContent =
                        "Failed to save transaction to server. Please try again.";
                }
            }
        });
    }

    // === Cancel edit button ===

    if (cancelEditButton) {
        cancelEditButton.addEventListener("click", () => {
            form.reset();
            exitEditMode();
            amountInput.focus();
        });
    }

    // === Type/Category filters ===

    if (filterTypeSelect) {
        filterTypeSelect.value = filters.type;
        filterTypeSelect.addEventListener("change", () => {
            filters.type = filterTypeSelect.value;
            renderTransactions();
        });
    }

    if (filterCategoryInput) {
        filterCategoryInput.addEventListener("input", () => {
            filters.category = filterCategoryInput.value.trim().toLowerCase();
            renderTransactions();
        });
    }

    if (filterResetButton) {
        filterResetButton.addEventListener("click", () => {
            filters.type = "all";
            filters.category = "";
            if (filterTypeSelect) filterTypeSelect.value = "all";
            if (filterCategoryInput) filterCategoryInput.value = "";
            renderTransactions();
        });
    }

    // === CSV download ===

    if (downloadCsvButton) {
        downloadCsvButton.addEventListener("click", async () => {
            if (!authToken) {
                alert("Please log in first.");
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/transactions/export/csv`,
                    {
                        headers: {
                            Authorization: `Bearer ${authToken}`
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to download CSV");
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "transactions.csv";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error(error);
                alert("Failed to download CSV.");
            }
        });
    }

    // === Saving goal form handler ===

    if (savingGoalForm) {
        savingGoalForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (savingGoalError) savingGoalError.textContent = "";

            if (!savingGoalInput) return;

            const rawValue = parseFloat(savingGoalInput.value);

            if (isNaN(rawValue) || rawValue < 0) {
                if (savingGoalError) {
                    savingGoalError.textContent =
                        "Please enter a valid amount (0 or more).";
                }
                return;
            }

            const newGoal = rawValue === 0 ? null : rawValue;

            try {
                await saveSavingGoalToServer(newGoal);
                syncSavingGoalInput();
                updateSummaries();
            } catch (error) {
                console.error(error);
                if (error.status === 401) {
                    if (savingGoalError) {
                        savingGoalError.textContent =
                            "Your session has expired. Please log in again.";
                    }
                    clearAuthState();
                } else if (savingGoalError) {
                    savingGoalError.textContent =
                        "Failed to save saving goal. Please try again.";
                }
            }
        });
    }

    // === Category budget form handler ===

    if (categoryBudgetForm) {
        categoryBudgetForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (budgetErrorEl) budgetErrorEl.textContent = "";

            const categoryRaw = budgetCategoryInput.value.trim();
            const budgetRaw = parseFloat(budgetAmountInput.value);

            if (!categoryRaw) {
                if (budgetErrorEl) {
                    budgetErrorEl.textContent =
                        "Please enter a category name.";
                }
                return;
            }

            if (isNaN(budgetRaw) || budgetRaw <= 0) {
                if (budgetErrorEl) {
                    budgetErrorEl.textContent =
                        "Please enter a positive budget amount.";
                }
                return;
            }

            try {
                const saved = await saveCategoryBudgetOnServer(
                    categoryRaw,
                    budgetRaw
                );

                const idx = categoryBudgets.findIndex(
                    (b) =>
                        b.category.toLowerCase() ===
                        saved.category.toLowerCase()
                );
                if (idx !== -1) {
                    categoryBudgets[idx].category = saved.category;
                    categoryBudgets[idx].monthlyBudget = saved.monthlyBudget;
                } else {
                    categoryBudgets.push({
                        category: saved.category,
                        monthlyBudget: saved.monthlyBudget
                    });
                }

                budgetCategoryInput.value = "";
                budgetAmountInput.value = "";
                renderCategoryBudgetsTable();
                updateSummaries();
            } catch (error) {
                console.error(error);
                if (error.status === 401) {
                    if (budgetErrorEl) {
                        budgetErrorEl.textContent =
                            "Your session has expired. Please log in again.";
                    }
                    clearAuthState();
                } else if (budgetErrorEl) {
                    budgetErrorEl.textContent =
                        "Failed to save budget. Please try again.";
                }
            }
        });
    }

    // === Delete budget buttons (event delegation) ===

    if (categoryBudgetsBody) {
        categoryBudgetsBody.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.classList.contains("delete-budget-button")) return;

            const category = target.getAttribute("data-category");
            if (!category) return;

            const confirmed = window.confirm(
                `Delete budget for category "${category}"?`
            );
            if (!confirmed) return;

            try {
                await deleteCategoryBudgetOnServer(category);
                const idx = categoryBudgets.findIndex(
                    (b) => b.category === category
                );
                if (idx !== -1) {
                    categoryBudgets.splice(idx, 1);
                }
                renderCategoryBudgetsTable();
                updateSummaries();
            } catch (error) {
                console.error(error);
                if (error.status === 401) {
                    alert("Your session has expired. Please log in again.");
                    clearAuthState();
                } else {
                    alert("Failed to delete budget.");
                }
            }
        });
    }

    // === Date range filter handlers ===

    if (rangePresetSelect) {
        rangePresetSelect.addEventListener("change", () => {
            const v = rangePresetSelect.value;

            if (v === "none") {
                clearRangeInternal(false);
                return;
            }

            const today = getStartOfToday();
            let from = null;
            let to = null;

            if (v === "today") {
                from = today;
                to = today;
            } else if (v === "thisWeek") {
                from = getStartOfWeek();
                to = new Date(from);
                to.setDate(to.getDate() + 6);
            } else if (v === "thisMonth") {
                from = getStartOfMonth();
                const nm = getStartOfNextMonth();
                to = new Date(nm);
                to.setDate(to.getDate() - 1);
            } else if (v === "thisYear") {
                from = getStartOfYear();
                const ny = getStartOfNextYear();
                to = new Date(ny);
                to.setDate(to.getDate() - 1);
            } else if (v === "last30") {
                to = today;
                from = new Date(today);
                from.setDate(from.getDate() - 29);
            } else if (v === "custom") {
                // wait for Apply
                return;
            }

            if (rangeFromInput && from)
                rangeFromInput.valueAsDate = from;
            if (rangeToInput && to) rangeToInput.valueAsDate = to;

            setRange(from, to, false);
        });
    }

    if (rangeApplyButton) {
        rangeApplyButton.addEventListener("click", () => {
            const from = parseDateInput(rangeFromInput.value);
            const to = parseDateInput(rangeToInput.value);

            if (from && to && from > to) {
                alert("From date cannot be after To date.");
                return;
            }

            setRange(from, to, true);
        });
    }

    if (rangeClearButton) {
        rangeClearButton.addEventListener("click", () => {
            clearRangeInternal(true);
        });
    }

    // === Auth event handlers ===

    // Switch to register form
    if (showRegisterButton) {
        showRegisterButton.addEventListener("click", () => {
            if (loginForm) loginForm.style.display = "none";
            if (registerForm) registerForm.style.display = "block";
            if (loginErrorEl) loginErrorEl.textContent = "";
            if (registerErrorEl) registerErrorEl.textContent = "";
        });
    }

    // Switch to login form
    if (showLoginButton) {
        showLoginButton.addEventListener("click", () => {
            if (registerForm) registerForm.style.display = "none";
            if (loginForm) loginForm.style.display = "block";
            if (loginErrorEl) loginErrorEl.textContent = "";
            if (registerErrorEl) registerErrorEl.textContent = "";
        });
    }

    // Handle login
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (loginErrorEl) loginErrorEl.textContent = "";

            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value;

            if (!username || !password) {
                if (loginErrorEl) {
                    loginErrorEl.textContent =
                        "Please enter both username and password.";
                }
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/auth/login`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password })
                    }
                );

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    const msg =
                        data && data.error
                            ? data.error
                            : "Login failed. Please try again.";
                    if (loginErrorEl) loginErrorEl.textContent = msg;
                    return;
                }

                setAuth(data.user, data.token);

                try {
                    await loadTransactionsFromServer();
                    await loadSavingGoalFromServer();
                    await loadCategoryBudgetsFromServer();
                } catch (error) {
                    console.error(
                        "Error loading data after login:",
                        error
                    );
                }

                syncSavingGoalInput();
                renderTransactions();
                updateSummaries();

                loginForm.reset();
                if (registerForm) registerForm.reset();
            } catch (error) {
                console.error(error);
                if (loginErrorEl) {
                    loginErrorEl.textContent =
                        "Network error while logging in. Please try again.";
                }
            }
        });
    }

    // Handle register
    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (registerErrorEl) registerErrorEl.textContent = "";

            const username = registerUsernameInput.value.trim();
            const password = registerPasswordInput.value;
            const password2 = registerPassword2Input.value;

            if (!username || !password || !password2) {
                if (registerErrorEl) {
                    registerErrorEl.textContent =
                        "Please fill in all fields.";
                }
                return;
            }

            if (password !== password2) {
                if (registerErrorEl) {
                    registerErrorEl.textContent = "Passwords do not match.";
                }
                return;
            }

            if (password.length < 6) {
                if (registerErrorEl) {
                    registerErrorEl.textContent =
                        "Password must be at least 6 characters.";
                }
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/auth/register`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password })
                    }
                );

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    const msg =
                        data && data.error
                            ? data.error
                            : "Registration failed. Please try again.";
                    if (registerErrorEl) registerErrorEl.textContent = msg;
                    return;
                }

                setAuth(data.user, data.token);

                try {
                    await loadTransactionsFromServer();
                    await loadSavingGoalFromServer();
                    await loadCategoryBudgetsFromServer();
                } catch (error) {
                    console.error(
                        "Error loading data after register:",
                        error
                    );
                }

                syncSavingGoalInput();
                renderTransactions();
                updateSummaries();

                registerForm.reset();
                if (loginForm) loginForm.reset();
            } catch (error) {
                console.error(error);
                if (registerErrorEl) {
                    registerErrorEl.textContent =
                        "Network error while registering. Please try again.";
                }
            }
        });
    }

    // Logout
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearAuthState();
        });
    }

    // === Initial load ===

    async function init() {
        loadTheme();            // 0) Theme
        loadAuthFromStorage();  // 1) Auth
        updateAuthUI();

        // 2) If we have a token, verify it and load this user's data
        if (authToken && currentUser) {
            try {
                const me = await fetchJson(`${API_BASE_URL}/api/auth/me`);
                currentUser = me.user;
                saveAuthToStorage();

                await loadTransactionsFromServer();
                await loadSavingGoalFromServer();
                await loadCategoryBudgetsFromServer();
            } catch (error) {
                console.error("Auto-login failed:", error);
                clearAuthState();
            }
        } else {
            savingGoalAmount = null;
            categoryBudgets.length = 0;
        }

        syncSavingGoalInput();

        renderTransactions();
        updateSummaries();
    }

    init();
});