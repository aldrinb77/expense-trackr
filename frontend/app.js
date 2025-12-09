// Frontend logic for Expense Trackr
// Features: multi-user auth, avatars, notes, budgets, saving goal, charts,
// date-range filter, profile activity/streaks, JSON backup, CSV export, etc.

// Use local backend when running from file:// or localhost,
// otherwise use the deployed backend on Render.
const isLocal =
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

const API_BASE_URL = isLocal
    ? "http://localhost:4000"
    : "https://expense-trackr-backend.onrender.com";

// LocalStorage keys
const AUTH_TOKEN_KEY = "expense-tracker-auth-token-v1";
const AUTH_USER_KEY = "expense-tracker-auth-user-v1";
const THEME_KEY = "expense-tracker-theme-v1";

// In-memory data
const transactions = [];
const categoryBudgets = [];
let savingGoalAmount = null;
let categoryChart = null;
let dailyChart = null;
let netTrendChart = null;
let editingTransactionId = null;

// Auth state
let authToken = null;
let currentUser = null;

// Filters
const filters = {
    type: "all",
    category: ""
};

// Date range filter for transaction list
const currentRange = {
    from: null,
    to: null
};

// Default quick categories
const DEFAULT_QUICK_CATEGORIES = [
    "Food",
    "Groceries",
    "Transport",
    "Rent",
    "Shopping",
    "Bills",
    "Others"
];

document.addEventListener("DOMContentLoaded", () => {
    // === Element references ===

    // Theme / global
    const themeToggleCheckbox = document.getElementById(
        "theme-toggle-checkbox"
    );
    const toastContainer = document.getElementById("toast-container");
    const globalLoadingEl = document.getElementById("global-loading");
    const statusElement = document.getElementById("status-text");

    // Profile & avatar
    const profileAvatarEl = document.getElementById("profile-avatar");
    const profileMemberSinceEl = document.getElementById("profile-member-since");
    const profileTotalTransactionsEl = document.getElementById(
        "profile-total-transactions"
    );
    const profileMonthDebitEl = document.getElementById("profile-month-debit");
    const profileMonthCreditEl = document.getElementById("profile-month-credit");
    const profileMonthNetEl = document.getElementById("profile-month-net");
    const profileLastActivityEl = document.getElementById(
        "profile-last-activity"
    );
    const profileActiveDays30El = document.getElementById(
        "profile-active-days-30"
    );
    const profileCurrentStreakEl = document.getElementById(
        "profile-current-streak"
    );
    const profileBestStreakEl = document.getElementById(
        "profile-best-streak"
    );
    const changeAvatarButton = document.getElementById("change-avatar-button");
    const avatarModal = document.getElementById("avatar-modal");
    const avatarPreviewEl = document.getElementById("avatar-preview");
    const avatarFileInput = document.getElementById("avatar-file-input");
    const avatarErrorEl = document.getElementById("avatar-error");
    const avatarRemoveButton = document.getElementById("avatar-remove-button");
    const avatarCancelButton = document.getElementById("avatar-cancel-button");
    const avatarSaveButton = document.getElementById("avatar-save-button");

    // Help/About + nav
    const helpButton = document.getElementById("help-button");
    const helpModal = document.getElementById("help-modal");
    const helpModalClose = document.getElementById("help-modal-close");
    const navButtons = document.querySelectorAll(
        ".nav-link[data-scroll-target]"
    );
    const appTitleEl = document.querySelector(".brand-text h1");

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

    // Transaction form & list
    const form = document.getElementById("transaction-form");
    const amountInput = document.getElementById("amount");
    const typeInput = document.getElementById("type");
    const categoryInput = document.getElementById("category");
    const noteInput = document.getElementById("note");
    const formError = document.getElementById("form-error");
    const submitButton = document.getElementById("transaction-submit-button");
    const cancelEditButton = document.getElementById("transaction-cancel-edit");
    const editingHint = document.getElementById("editing-hint");
    const transactionList = document.getElementById("transaction-list");
    const noTransactionsText = document.getElementById("no-transactions");
    const noTransactionsFilteredText = document.getElementById(
        "no-transactions-filtered"
    );

    // Filters
    const filterTypeSelect = document.getElementById("filter-type");
    const filterCategoryInput = document.getElementById("filter-category");
    const filterResetButton = document.getElementById("filter-reset");
    const downloadCsvButton = document.getElementById("download-csv");
    const downloadJsonButton = document.getElementById("download-json");
    const importJsonButton = document.getElementById("import-json");
    const jsonImportInput = document.getElementById("json-import-input");

    // Date range
    const rangePresetSelect = document.getElementById("range-preset");
    const rangeFromInput = document.getElementById("range-from");
    const rangeToInput = document.getElementById("range-to");
    const rangeApplyButton = document.getElementById("range-apply");
    const rangeClearButton = document.getElementById("range-clear");
    const rangeSummaryText = document.getElementById("range-summary-text");

    // Summary
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

    // Saving goal
    const savingGoalForm = document.getElementById("saving-goal-form");
    const savingGoalInput = document.getElementById("saving-goal-amount");
    const savingGoalError = document.getElementById("saving-goal-error");
    const savingCurrentNetEl = document.getElementById("saving-current-net");
    const savingGoalDisplayEl = document.getElementById("saving-goal-display");
    const savingGoalStatusEl = document.getElementById("saving-goal-status");
    const savingGoalProgressEl = document.getElementById("saving-goal-progress");

    // Chart empties
    const categoryChartEmpty = document.getElementById("category-chart-empty");
    const dailyChartEmpty = document.getElementById("daily-chart-empty");
    const netTrendChartEmpty = document.getElementById("net-trend-chart-empty");

    // Category totals & budgets
    const categoryTotalsBody = document.getElementById("category-totals-body");
    const categoryTotalsEmpty = document.getElementById("category-totals-empty");
    const topCategoriesSummaryEl = document.getElementById(
        "top-categories-summary"
    );
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
    const quickCategoryChipsContainer = document.getElementById(
        "quick-category-chips"
    );

    // --- Status ---

    if (statusElement) {
        const now = new Date();
        statusElement.textContent =
            "JavaScript is working. Page loaded at: " +
            now.toLocaleString();
        statusElement.style.color = "#2e7d32";
    }

    // === Theme ===

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

    // === Toast + loading ===

    function showToast(message, type = "success") {
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("visible"));
        setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    let loadingCount = 0;

    function showGlobalLoading() {
        loadingCount++;
        if (globalLoadingEl) {
            globalLoadingEl.style.display = "flex";
        }
    }

    function hideGlobalLoading() {
        loadingCount = Math.max(0, loadingCount - 1);
        if (loadingCount === 0 && globalLoadingEl) {
            globalLoadingEl.style.display = "none";
        }
    }

    // === Auth storage ===

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
        } catch (e) {
            console.error("Failed to parse stored user:", e);
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
        } catch (e) {
            console.error("Failed to save auth:", e);
        }
    }

    function clearAuthFromStorage() {
        try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
        } catch (e) {
            console.error("Failed to clear auth:", e);
        }
    }

    function formatDateOnly(iso) {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit"
        });
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

        if (profileAvatarEl) {
            if (loggedIn && currentUser.avatar) {
                profileAvatarEl.style.backgroundImage =
                    `url(${currentUser.avatar})`;
                profileAvatarEl.textContent = "";
            } else if (loggedIn && currentUser.username) {
                profileAvatarEl.style.backgroundImage = "none";
                profileAvatarEl.textContent = currentUser.username
                    .charAt(0)
                    .toUpperCase();
            } else {
                profileAvatarEl.style.backgroundImage = "none";
                profileAvatarEl.textContent = "";
            }
        }

        if (profileMemberSinceEl) {
            if (loggedIn && currentUser.createdAt) {
                const formatted = formatDateOnly(currentUser.createdAt);
                profileMemberSinceEl.textContent = formatted
                    ? `Member since ${formatted}`
                    : "Member since —";
            } else {
                profileMemberSinceEl.textContent = "Member since —";
            }
        }

        authRequiredSections.forEach((section) => {
            section.style.display = loggedIn ? "block" : "none";
        });
    }

    function setAuth(user, token) {
        currentUser = user;
        authToken = token;
        saveAuthToStorage();

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

    // === Date helpers ===

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

    function getStartOfWeek() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
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
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getStartOfNextYear() {
        const d = getStartOfYear();
        d.setFullYear(d.getFullYear() + 1);
        return d;
    }

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
            )}, Credit: Rs ${credit.toFixed(
                2
            )}, Net: Rs ${net.toFixed(
                2
            )}. (Range affects the transactions list only.)`;
    }

    // === Activity & streaks ===

    function computeActivityStats() {
        const stats = {
            lastActivity: null,
            activeDaysLast30: 0,
            currentStreak: 0,
            bestStreak: 0
        };

        if (transactions.length === 0) return stats;

        const dayMs = 24 * 60 * 60 * 1000;
        const today = getStartOfToday();
        const todayIdx = Math.floor(today.getTime() / dayMs);

        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 29);
        cutoff.setHours(0, 0, 0, 0);
        const cutoffIdx = Math.floor(cutoff.getTime() / dayMs);

        const daySet = new Set();
        let lastActivityDate = null;

        transactions.forEach((tx) => {
            const d = new Date(tx.createdAt);
            if (isNaN(d.getTime())) return;
            const d0 = new Date(d);
            d0.setHours(0, 0, 0, 0);
            const idx = Math.floor(d0.getTime() / dayMs);
            daySet.add(idx);
            if (!lastActivityDate || d > lastActivityDate) {
                lastActivityDate = d;
            }
        });

        stats.lastActivity = lastActivityDate;

        let active30 = 0;
        daySet.forEach((idx) => {
            if (idx >= cutoffIdx && idx <= todayIdx) active30++;
        });
        stats.activeDaysLast30 = active30;

        const daysArr = Array.from(daySet).sort((a, b) => a - b);
        if (daysArr.length === 0) {
            stats.bestStreak = 0;
            stats.currentStreak = 0;
            return stats;
        }

        let best = 1;
        let current = 1;
        for (let i = 1; i < daysArr.length; i++) {
            if (daysArr[i] === daysArr[i - 1] + 1) {
                current++;
                if (current > best) best = current;
            } else {
                current = 1;
            }
        }
        stats.bestStreak = best;

        if (!daySet.has(todayIdx)) {
            stats.currentStreak = 0;
        } else {
            let streak = 1;
            let idx = todayIdx - 1;
            while (daySet.has(idx)) {
                streak++;
                idx--;
            }
            stats.currentStreak = streak;
        }

        return stats;
    }

    // === Quick category chips ===

    function createQuickChip(label) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quick-chip";
        btn.textContent = label;
        btn.addEventListener("click", () => {
            if (categoryInput) {
                categoryInput.value = label;
                categoryInput.focus();
            }
        });
        return btn;
    }

    function populateQuickCategoryChips(categoriesArray) {
        if (!quickCategoryChipsContainer) return;
        quickCategoryChipsContainer.innerHTML = "";

        const source =
            categoriesArray && categoriesArray.length > 0
                ? categoriesArray
                : DEFAULT_QUICK_CATEGORIES;

        source.forEach((cat) => {
            quickCategoryChipsContainer.appendChild(createQuickChip(cat));
        });
    }

    // === API helpers ===

    async function fetchJson(url, options = {}) {
        const headers = options.headers ? { ...options.headers } : {};
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        const resp = await fetch(url, { ...options, headers });
        let data = null;
        try {
            data = await resp.json();
        } catch (_) {}
        if (!resp.ok) {
            const error = new Error(
                data && data.error
                    ? data.error
                    : `Request failed with status ${resp.status}`
            );
            error.status = resp.status;
            throw error;
        }
        return data;
    }

    async function loadTransactionsFromServer() {
        const data = await fetchJson(`${API_BASE_URL}/api/transactions`);
        transactions.length = 0;
        data.forEach((tx) => transactions.push(tx));
    }

    async function loadSavingGoalFromServer() {
        try {
            const data = await fetchJson(`${API_BASE_URL}/api/saving-goal`);
            if (data && typeof data.goal === "number" && data.goal >= 0) {
                savingGoalAmount = data.goal;
            } else {
                savingGoalAmount = null;
            }
        } catch (e) {
            console.error("Failed to load saving goal:", e);
            savingGoalAmount = null;
        }
    }

    async function saveSavingGoalToServer(goal) {
        const data = await fetchJson(`${API_BASE_URL}/api/saving-goal`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal })
        });
        if (data && typeof data.goal === "number" && data.goal >= 0) {
            savingGoalAmount = data.goal;
        } else {
            savingGoalAmount = null;
        }
    }

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
        } catch (e) {
            console.error("Failed to load budgets:", e);
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

    async function createTransactionOnServer(amount, type, category, note) {
        return fetchJson(`${API_BASE_URL}/api/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, type, category, note })
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

    async function downloadJsonBackup() {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/export/json`,
                {
                    headers: authToken
                        ? { Authorization: `Bearer ${authToken}` }
                        : {}
                }
            );

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                throw new Error(
                    `Export failed (${response.status}): ${text}`
                );
            }

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json"
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const stamp = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `expense-trackr-backup-${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast("JSON backup downloaded.", "success");
        } catch (e) {
            console.error("JSON export error:", e);
            showToast("Failed to download JSON backup.", "error");
        }
    }

    async function importJsonBackupFromFile(file) {
        if (!file) return;
        try {
            const text = await file.text();
            let parsed = null;
            try {
                parsed = JSON.parse(text);
            } catch (_) {
                showToast("Invalid JSON file.", "error");
                return;
            }

            const confirmed = window.confirm(
                "Importing a backup will replace your current transactions, budgets, and saving goal for this account. Continue?"
            );
            if (!confirmed) return;

            showGlobalLoading();
            try {
                await fetchJson(`${API_BASE_URL}/api/import/json`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed)
                });

                await loadTransactionsFromServer();
                await loadSavingGoalFromServer();
                await loadCategoryBudgetsFromServer();

                renderTransactions();
                updateSummaries();

                showToast("Backup imported successfully.", "success");
            } finally {
                hideGlobalLoading();
            }
        } catch (e) {
            console.error(e);
            if (e.status === 401) {
                showToast(
                    "Your session has expired. Please log in again.",
                    "error"
                );
                clearAuthState();
            } else {
                showToast("Failed to import JSON backup.", "error");
            }
        } finally {
            if (jsonImportInput) jsonImportInput.value = "";
        }
    }

    // === Saving goal UI ===

    function syncSavingGoalInput() {
        if (!savingGoalInput) return;
        if (savingGoalAmount === null) {
            savingGoalInput.value = "";
        } else {
            savingGoalInput.value = savingGoalAmount.toString();
        }
    }

    function updateSavingGoalUI(currentMonthNet) {
        if (
            !savingCurrentNetEl ||
            !savingGoalDisplayEl ||
            !savingGoalStatusEl ||
            !savingGoalProgressEl
        )
            return;

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

    // === Chart helpers ===

    function getCategoryTotalsForCurrentMonth() {
        const monthStart = getStartOfMonth();
        const nextMonthStart = getStartOfNextMonth();
        const totals = {};

        transactions.forEach((tx) => {
            if (tx.type !== "debit") return;
            const created = new Date(tx.createdAt);
            if (isNaN(created.getTime())) return;
            if (created >= monthStart && created < nextMonthStart) {
                const cat = tx.category || "Uncategorized";
                totals[cat] = (totals[cat] || 0) + tx.amount;
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

    function updateCategoryChart() {
        const canvas = document.getElementById("category-chart");
        if (!canvas) return;

        const totals = getCategoryTotalsForCurrentMonth();
        const labels = Object.keys(totals);
        const data = Object.values(totals);

        if (!labels.length) {
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
            (_, i) => baseColors[i % baseColors.length]
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
                    datasets: [{ data, backgroundColor: colors }]
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
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true }
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
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    function updateCharts() {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js not loaded");
            return;
        }
        updateCategoryChart();
        updateDailyChart();
        updateNetTrendChart();
    }

    // === Category totals & top summary ===

    function renderCategoryTotalsTable() {
        if (!categoryTotalsBody || !categoryTotalsEmpty) return;

        const totals = getCategoryTotalsForCurrentMonth();
        const categories = Object.keys(totals);

        categoryTotalsBody.innerHTML = "";
        const table = categoryTotalsBody.closest("table");

        if (!categories.length) {
            if (categoryTotalsEmpty) categoryTotalsEmpty.style.display = "block";
            if (table) table.style.display = "none";
            if (topCategoriesSummaryEl) {
                topCategoriesSummaryEl.textContent =
                    "No expenses yet to highlight top categories.";
            }
            populateQuickCategoryChips([]);
            return;
        }

        if (categoryTotalsEmpty) categoryTotalsEmpty.style.display = "none";
        if (table) table.style.display = "table";

        const grandTotal = categories.reduce(
            (sum, cat) => sum + totals[cat],
            0
        );
        const sorted = categories.sort((a, b) => totals[b] - totals[a]);

        if (topCategoriesSummaryEl) {
            const top = sorted.slice(0, 3).map((cat) => {
                const amt = totals[cat];
                const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0;
                return `${cat} (Rs ${amt.toFixed(2)}, ${pct.toFixed(1)}%)`;
            });
            topCategoriesSummaryEl.textContent =
                "Top categories: " + top.join(" · ");
        }

        populateQuickCategoryChips(sorted.slice(0, 6));

        sorted.forEach((cat) => {
            const amt = totals[cat];
            const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${cat}</td>
                <td class="amount-cell">Rs ${amt.toFixed(2)}</td>
                <td class="percent-cell">${pct.toFixed(1)}%</td>
            `;
            categoryTotalsBody.appendChild(tr);
        });
    }

    // === Category budgets ===

    function renderCategoryBudgetsTable() {
        if (
            !categoryBudgetsBody ||
            !categoryBudgetsEmpty ||
            !categoryBudgetsTable
        )
            return;

        categoryBudgetsBody.innerHTML = "";

        if (!categoryBudgets.length) {
            categoryBudgetsEmpty.style.display = "block";
            categoryBudgetsTable.style.display = "none";
            return;
        }

        categoryBudgetsEmpty.style.display = "none";
        categoryBudgetsTable.style.display = "table";

        const monthTotals = getCategoryTotalsForCurrentMonth();
        const sorted = categoryBudgets
            .slice()
            .sort((a, b) =>
                a.category.toLowerCase().localeCompare(b.category.toLowerCase())
            );

        sorted.forEach((b) => {
            const category = b.category;
            const limit = b.monthlyBudget;
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
                    <button type="button" class="secondary-button small delete-budget-button" data-category="${category}">
                        Delete
                    </button>
                </td>
            `;
            categoryBudgetsBody.appendChild(tr);
        });
    }

    // === Summaries ===

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
            const amt = tx.amount;
            const isDebit = tx.type === "debit";

            if (isDebit) overall.debit += amt;
            else overall.credit += amt;

            const created = new Date(tx.createdAt);
            if (isNaN(created.getTime())) return;

            if (created >= todayStart && created < tomorrowStart) {
                if (isDebit) today.debit += amt;
                else today.credit += amt;
            }

            if (created >= weekStart && created < nextWeekStart) {
                if (isDebit) week.debit += amt;
                else week.credit += amt;
            }

            if (created >= monthStart && created < nextMonthStart) {
                if (isDebit) month.debit += amt;
                else month.credit += amt;
            }

            if (created >= yearStart && created < nextYearStart) {
                if (isDebit) year.debit += amt;
                else year.credit += amt;
            }
        });

        const todayNet = today.credit - today.debit;
        const weekNet = week.credit - week.debit;
        const monthNet = month.credit - month.debit;
        const yearNet = year.credit - year.debit;
        const overallNet = overall.credit - overall.debit;

        const fmt = (v) => `Rs ${v.toFixed(2)}`;

        if (todayDebitEl) todayDebitEl.textContent = fmt(today.debit);
        if (todayCreditEl) todayCreditEl.textContent = fmt(today.credit);
        if (todayNetEl) todayNetEl.textContent = fmt(todayNet);

        if (weekDebitEl) weekDebitEl.textContent = fmt(week.debit);
        if (weekCreditEl) weekCreditEl.textContent = fmt(week.credit);
        if (weekNetEl) weekNetEl.textContent = fmt(weekNet);

        if (monthDebitEl) monthDebitEl.textContent = fmt(month.debit);
        if (monthCreditEl) monthCreditEl.textContent = fmt(month.credit);
        if (monthNetEl) monthNetEl.textContent = fmt(monthNet);

        if (yearDebitEl) yearDebitEl.textContent = fmt(year.debit);
        if (yearCreditEl) yearCreditEl.textContent = fmt(year.credit);
        if (yearNetEl) yearNetEl.textContent = fmt(yearNet);

        if (overallDebitEl) overallDebitEl.textContent = fmt(overall.debit);
        if (overallCreditEl) overallCreditEl.textContent = fmt(overall.credit);
        if (overallNetEl) overallNetEl.textContent = fmt(overallNet);

        if (profileTotalTransactionsEl) {
            profileTotalTransactionsEl.textContent = String(transactions.length);
        }
        if (profileMonthDebitEl) {
            profileMonthDebitEl.textContent = fmt(month.debit);
        }
        if (profileMonthCreditEl) {
            profileMonthCreditEl.textContent = fmt(month.credit);
        }
        if (profileMonthNetEl) {
            profileMonthNetEl.textContent = fmt(monthNet);
        }

        const activity = computeActivityStats();
        if (profileLastActivityEl) {
            if (activity.lastActivity) {
                profileLastActivityEl.textContent =
                    activity.lastActivity.toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    });
            } else {
                profileLastActivityEl.textContent = "—";
            }
        }
        if (profileActiveDays30El) {
            profileActiveDays30El.textContent = String(
                activity.activeDaysLast30
            );
        }
        if (profileCurrentStreakEl) {
            profileCurrentStreakEl.textContent = String(
                activity.currentStreak
            );
        }
        if (profileBestStreakEl) {
            profileBestStreakEl.textContent = String(activity.bestStreak);
        }

        updateSavingGoalUI(monthNet);
        updateCharts();
        renderCategoryTotalsTable();
        renderCategoryBudgetsTable();
        updateRangeSummary();
    }

    // === Nav & help ===

    function scrollToSection(id) {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-scroll-target");
            if (targetId) scrollToSection(targetId);
        });
    });

    if (helpButton && helpModal && helpModalClose) {
        helpButton.addEventListener("click", () => {
            helpModal.style.display = "flex";
        });
        helpModal.addEventListener("click", (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = "none";
            }
        });
        helpModalClose.addEventListener("click", () => {
            helpModal.style.display = "none";
        });
    }

    if (appTitleEl && helpModal) {
        appTitleEl.style.cursor = "pointer";
        appTitleEl.addEventListener("click", () => {
            helpModal.style.display = "flex";
        });
    }

    // Avatar modal
    if (changeAvatarButton && avatarModal && avatarPreviewEl) {
        changeAvatarButton.addEventListener("click", () => {
            pendingAvatarDataUrl = null;
            if (avatarErrorEl) avatarErrorEl.textContent = "";
            setAvatarPreviewFromCurrentUser();
            avatarModal.style.display = "flex";
        });
    }

    if (avatarCancelButton && avatarModal) {
        avatarCancelButton.addEventListener("click", () => {
            avatarModal.style.display = "none";
        });
    }

    if (avatarModal) {
        avatarModal.addEventListener("click", (e) => {
            if (e.target === avatarModal) {
                avatarModal.style.display = "none";
            }
        });
    }

    if (avatarFileInput) {
        avatarFileInput.addEventListener("change", () => {
            if (avatarErrorEl) avatarErrorEl.textContent = "";
            const file = avatarFileInput.files && avatarFileInput.files[0];
            if (!file) return;
            if (file.size > 200 * 1024) {
                if (avatarErrorEl) {
                    avatarErrorEl.textContent =
                        "File is too large. Please select an image under 200 KB.";
                }
                avatarFileInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === "string") {
                    pendingAvatarDataUrl = reader.result;
                    setAvatarPreviewFromDataUrl(pendingAvatarDataUrl);
                }
            };
            reader.onerror = () => {
                if (avatarErrorEl) {
                    avatarErrorEl.textContent =
                        "Failed to read file. Please try again.";
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (avatarSaveButton) {
        avatarSaveButton.addEventListener("click", async () => {
            if (avatarErrorEl) avatarErrorEl.textContent = "";
            if (!currentUser) {
                if (avatarErrorEl) {
                    avatarErrorEl.textContent = "You must be logged in.";
                }
                return;
            }
            if (!pendingAvatarDataUrl) {
                if (avatarErrorEl) {
                    avatarErrorEl.textContent =
                        "Please choose an image or click Remove avatar.";
                }
                return;
            }
            try {
                const data = await saveAvatarOnServer(pendingAvatarDataUrl);
                currentUser.avatar = data.avatar || null;
                saveAuthToStorage();
                updateAuthUI();
                avatarModal.style.display = "none";
                avatarFileInput.value = "";
                showToast("Avatar updated.", "success");
            } catch (e) {
                console.error(e);
                if (e.status === 401) {
                    if (avatarErrorEl) {
                        avatarErrorEl.textContent =
                            "Your session has expired. Please log in again.";
                    }
                    clearAuthState();
                } else if (avatarErrorEl) {
                    avatarErrorEl.textContent =
                        "Failed to save avatar. Please try again.";
                }
            }
        });
    }

    if (avatarRemoveButton) {
        avatarRemoveButton.addEventListener("click", async () => {
            if (avatarErrorEl) avatarErrorEl.textContent = "";
            if (!currentUser) {
                if (avatarErrorEl) {
                    avatarErrorEl.textContent = "You must be logged in.";
                }
                return;
            }
            try {
                const data = await saveAvatarOnServer(null);
                currentUser.avatar = data.avatar || null;
                saveAuthToStorage();
                updateAuthUI();
                avatarModal.style.display = "none";
                avatarFileInput.value = "";
                showToast("Avatar removed.", "success");
            } catch (e) {
                console.error(e);
                if (e.status === 401) {
                    if (avatarErrorEl) {
                        avatarErrorEl.textContent =
                            "Your session has expired. Please log in again.";
                    }
                    clearAuthState();
                } else if (avatarErrorEl) {
                    avatarErrorEl.textContent =
                        "Failed to remove avatar. Please try again.";
                }
            }
        });
    }

    // === Transactions rendering & edit ===

    function renderTransactions() {
        if (!transactionList) return;

        transactionList.innerHTML = "";

        if (!transactions.length) {
            if (noTransactionsText) noTransactionsText.style.display = "block";
            if (noTransactionsFilteredText)
                noTransactionsFilteredText.style.display = "none";
            return;
        } else if (noTransactionsText) {
            noTransactionsText.style.display = "none";
        }

        const filtered = transactions.filter((tx) => {
            if (filters.type !== "all" && tx.type !== filters.type) return false;
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

        if (!filtered.length) {
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
                ${
                    tx.note
                        ? `<div class="transaction-note">${tx.note}</div>`
                        : ""
                }
                <div class="transaction-meta">
                    <span class="transaction-type">${
                        isCredit ? "Credit" : "Debit"
                    }</span>
                    <span class="transaction-time">${dateTime}</span>
                    <button class="edit-button" data-id="${
                        tx.id
                    }">Edit</button>
                    <button class="delete-button" data-id="${
                        tx.id
                    }">Delete</button>
                </div>
            `;
            transactionList.appendChild(li);
        });
    }

    function enterEditMode(tx) {
        editingTransactionId = tx.id;
        amountInput.value = tx.amount.toString();
        typeInput.value = tx.type;
        categoryInput.value = tx.category;
        if (noteInput) noteInput.value = tx.note || "";
        if (submitButton) submitButton.textContent = "Save Changes";
        if (cancelEditButton) cancelEditButton.style.display = "inline-block";
        if (editingHint) editingHint.style.display = "block";
        formError.textContent = "";
    }

    function exitEditMode() {
        editingTransactionId = null;
        if (submitButton) submitButton.textContent = "Add Transaction";
        if (cancelEditButton) cancelEditButton.style.display = "none";
        if (editingHint) editingHint.style.display = "none";
        if (formError) formError.textContent = "";
        if (noteInput) noteInput.value = "";
    }

    if (transactionList) {
        transactionList.addEventListener("click", async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            if (target.classList.contains("delete-button")) {
                const idStr = target.getAttribute("data-id");
                if (!idStr) return;
                const id = Number(idStr);
                if (!window.confirm("Delete this transaction?")) return;
                try {
                    await deleteTransactionOnServer(id);
                    const idx = transactions.findIndex((t) => t.id === id);
                    if (idx !== -1) transactions.splice(idx, 1);
                    renderTransactions();
                    updateSummaries();
                } catch (err) {
                    console.error(err);
                    if (err.status === 401) {
                        showToast(
                            "Your session has expired. Please log in again.",
                            "error"
                        );
                        clearAuthState();
                    } else {
                        showToast(
                            "Failed to delete transaction from server.",
                            "error"
                        );
                    }
                }
                return;
            }

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

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            formError.textContent = "";

            const amountValue = parseFloat(amountInput.value);
            const typeValue = typeInput.value;
            const categoryValue = categoryInput.value.trim();
            const noteValue = noteInput ? noteInput.value.trim() : "";

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
                        categoryValue,
                        noteValue
                    );
                    transactions.push(created);
                    showToast("Transaction added.", "success");
                } else {
                    const updated = await updateTransactionOnServer(
                        editingTransactionId,
                        {
                            amount: amountValue,
                            type: typeValue,
                            category: categoryValue,
                            note: noteValue
                        }
                    );
                    const idx = transactions.findIndex(
                        (t) => t.id === editingTransactionId
                    );
                    if (idx !== -1) transactions[idx] = updated;
                    showToast("Transaction updated.", "success");
                }

                renderTransactions();
                updateSummaries();
                form.reset();
                exitEditMode();
                amountInput.focus();
            } catch (err) {
                console.error(err);
                if (err.status === 401) {
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

    if (cancelEditButton) {
        cancelEditButton.addEventListener("click", () => {
            form.reset();
            exitEditMode();
            amountInput.focus();
        });
    }

    // === Filters ===

    if (filterTypeSelect) {
        filterTypeSelect.value = filters.type;
        filterTypeSelect.addEventListener("change", () => {
            filters.type = filterTypeSelect.value;
            renderTransactions();
        });
    }

    if (filterCategoryInput) {
        filterCategoryInput.addEventListener("input", () => {
            filters.category = filterCategoryInput.value
                .trim()
                .toLowerCase();
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

    if (downloadCsvButton) {
        downloadCsvButton.addEventListener("click", async () => {
            if (!authToken) {
                showToast("Please log in first.", "error");
                return;
            }
            try {
                const resp = await fetch(
                    `${API_BASE_URL}/api/transactions/export/csv`,
                    {
                        headers: { Authorization: `Bearer ${authToken}` }
                    }
                );
                if (!resp.ok) throw new Error("Failed to download CSV");
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "transactions.csv";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast("CSV downloaded.", "success");
            } catch (err) {
                console.error(err);
                showToast("Failed to download CSV.", "error");
            }
        });
    }

    if (downloadJsonButton) {
        downloadJsonButton.addEventListener("click", () => {
            if (!authToken) {
                showToast("Please log in first.", "error");
                return;
            }
            downloadJsonBackup();
        });
    }

    if (importJsonButton && jsonImportInput) {
        importJsonButton.addEventListener("click", () => {
            if (!authToken) {
                showToast("Please log in first.", "error");
                return;
            }
            jsonImportInput.click();
        });

        jsonImportInput.addEventListener("change", () => {
            const file =
                jsonImportInput.files && jsonImportInput.files[0];
            if (file) importJsonBackupFromFile(file);
        });
    }

    // === Saving goal form ===

    if (savingGoalForm) {
        savingGoalForm.addEventListener("submit", async (e) => {
            e.preventDefault();
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
                showToast("Saving goal updated.", "success");
            } catch (err) {
                console.error(err);
                if (err.status === 401) {
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

    // === Budgets ===

    if (categoryBudgetForm) {
        categoryBudgetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
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
                showToast("Budget saved.", "success");
            } catch (err) {
                console.error(err);
                if (err.status === 401) {
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

    if (categoryBudgetsBody) {
        categoryBudgetsBody.addEventListener("click", async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.classList.contains("delete-budget-button")) return;

            const category = target.getAttribute("data-category");
            if (!category) return;

            if (!window.confirm(`Delete budget for "${category}"?`)) return;

            try {
                await deleteCategoryBudgetOnServer(category);
                const idx = categoryBudgets.findIndex(
                    (b) => b.category === category
                );
                if (idx !== -1) categoryBudgets.splice(idx, 1);
                renderCategoryBudgetsTable();
                updateSummaries();
                showToast("Budget deleted.", "success");
            } catch (err) {
                console.error(err);
                if (err.status === 401) {
                    showToast(
                        "Your session has expired. Please log in again.",
                        "error"
                    );
                    clearAuthState();
                } else {
                    showToast("Failed to delete budget.", "error");
                }
            }
        });
    }

    // === Date range UI events ===

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
                window.alert("From date cannot be after To date.");
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

    // === Auth UI events (login/register/logout) ===

    if (showRegisterButton) {
        showRegisterButton.addEventListener("click", () => {
            if (loginForm) loginForm.style.display = "none";
            if (registerForm) registerForm.style.display = "block";
            if (loginErrorEl) loginErrorEl.textContent = "";
            if (registerErrorEl) registerErrorEl.textContent = "";
        });
    }

    if (showLoginButton) {
        showLoginButton.addEventListener("click", () => {
            if (registerForm) registerForm.style.display = "none";
            if (loginForm) loginForm.style.display = "block";
            if (loginErrorEl) loginErrorEl.textContent = "";
            if (registerErrorEl) registerErrorEl.textContent = "";
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
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
                const resp = await fetch(
                    `${API_BASE_URL}/api/auth/login`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password })
                    }
                );
                const data = await resp.json().catch(() => null);

                if (!resp.ok) {
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
                } catch (err) {
                    console.error("Error loading data after login:", err);
                }

                syncSavingGoalInput();
                renderTransactions();
                updateSummaries();
                loginForm.reset();
                if (registerForm) registerForm.reset();
            } catch (err) {
                console.error(err);
                if (loginErrorEl) {
                    loginErrorEl.textContent =
                        "Network error while logging in. Please try again.";
                }
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
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
                    registerErrorEl.textContent =
                        "Passwords do not match.";
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
                const resp = await fetch(
                    `${API_BASE_URL}/api/auth/register`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password })
                    }
                );
                const data = await resp.json().catch(() => null);

                if (!resp.ok) {
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
                } catch (err) {
                    console.error(
                        "Error loading data after register:",
                        err
                    );
                }

                syncSavingGoalInput();
                renderTransactions();
                updateSummaries();
                registerForm.reset();
                if (loginForm) loginForm.reset();
            } catch (err) {
                console.error(err);
                if (registerErrorEl) {
                    registerErrorEl.textContent =
                        "Network error while registering. Please try again.";
                }
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearAuthState();
        });
    }

    // === Initial load ===

    async function init() {
        loadTheme();
        loadAuthFromStorage();
        updateAuthUI();

        showGlobalLoading();
        try {
            if (authToken && currentUser) {
                try {
                    const me = await fetchJson(
                        `${API_BASE_URL}/api/auth/me`
                    );
                    currentUser = me.user;
                    saveAuthToStorage();
                    await loadTransactionsFromServer();
                    await loadSavingGoalFromServer();
                    await loadCategoryBudgetsFromServer();
                } catch (err) {
                    console.error("Auto-login failed:", err);
                    clearAuthState();
                }
            } else {
                savingGoalAmount = null;
                categoryBudgets.length = 0;
            }
            syncSavingGoalInput();
            renderTransactions();
            updateSummaries();
        } finally {
            hideGlobalLoading();
        }
    }

    init();
});