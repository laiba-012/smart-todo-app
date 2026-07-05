/* ============================================================
   TO-DO APP — FULL FUNCTIONALITY (FINAL VERSION)
   Features: Add, Delete (+Undo), Edit, Complete, Search, Filter,
   Categories, Drag & Drop reorder, Dark Mode, Keyboard Shortcuts,
   Due Date Reminders, Local Storage, Dynamic Stats,
   Form Validation, Toast Notifications
   ============================================================ */

/* ---------------- STATE ---------------- */
let tasks = [];
let currentFilter = "all";       // all | pending | completed
let currentCategory = "all";     // all | Work | Study | Personal
let editingId = null;
let lastDeletedTask = null;
let undoTimeoutId = null;
let draggedId = null;

/* ---------------- DOM REFERENCES ---------------- */
const taskInput     = document.getElementById("taskInput");
const priorityEl    = document.getElementById("priority");
const categoryInput = document.getElementById("categoryInput");
const dateInput     = document.getElementById("dateInput");
const addTaskBtn    = document.getElementById("addTaskBtn");

const searchInput = document.getElementById("searchInput");

const allBtn       = document.getElementById("allBtn");
const pendingBtn   = document.getElementById("pendingBtn");
const completedBtn = document.getElementById("completedBtn");
const categoryFilterEl = document.getElementById("categoryFilter");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");

const taskList = document.getElementById("taskList");

const totalTasksEl     = document.getElementById("totalTasks");
const completedTasksEl = document.getElementById("completedTasks");
const pendingTasksEl   = document.getElementById("pendingTasks");

const toastContainer = document.getElementById("toastContainer");
const themeToggleBtn  = document.getElementById("themeToggleBtn");

const progressBarFill = document.getElementById("progressBarFill");
const progressLabel   = document.getElementById("progressLabel");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function saveTasks() {
    localStorage.setItem("todoTasks", JSON.stringify(tasks));
}

function loadTasks() {
    const stored = localStorage.getItem("todoTasks");
    if (stored) {
        tasks = JSON.parse(stored);
    } else {
        tasks = [
            { id: generateId(), text: "Learn HTML & CSS", priority: "High", category: "Study", date: "2026-07-15", completed: false, pinned: false },
            { id: generateId(), text: "Build Weather App", priority: "Medium", category: "Work", date: "2026-07-20", completed: false, pinned: false },
            { id: generateId(), text: "Practice JavaScript", priority: "Low", category: "Study", date: "2026-07-25", completed: false, pinned: false }
        ];
        saveTasks();
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   DARK MODE
   ============================================================ */
function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
        document.body.classList.add("dark-mode");
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
}

themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    themeToggleBtn.innerHTML = isDark
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
});

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = "success", onUndo = null) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation",
        info: "fa-circle-info"
    };

    toast.innerHTML = `
        <i class="fa-solid ${icons[type]}"></i>
        <span>${escapeHtml(message)}</span>
        ${onUndo ? `<button class="toast-undo-btn">Undo</button>` : ""}
    `;

    toastContainer.appendChild(toast);

    if (onUndo) {
        const undoBtn = toast.querySelector(".toast-undo-btn");
        undoBtn.onclick = () => {
            onUndo();
            toast.classList.add("toast-hide");
            setTimeout(() => toast.remove(), 300);
        };
    }

    setTimeout(() => {
        toast.classList.add("toast-hide");
        setTimeout(() => toast.remove(), 300);
    }, onUndo ? 4500 : 3000);
}

/* ============================================================
   HELPERS
   ============================================================ */
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return "No date";
    const d = new Date(dateStr + "T00:00:00");
    const options = { day: "numeric", month: "long" };
    return d.toLocaleDateString("en-GB", options);
}

// returns "overdue" | "today" | "upcoming"
function getDueStatus(dateStr) {
    if (!dateStr) return "upcoming";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T00:00:00");
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    return "upcoming";
}

/* ============================================================
   FORM VALIDATION
   ============================================================ */
function validateTaskForm() {
    const text = taskInput.value.trim();

    if (text === "") {
        showToast("Task name can't be empty!", "error");
        taskInput.focus();
        return false;
    }
    if (text.length < 3) {
        showToast("Task name is too short (min 3 characters).", "error");
        taskInput.focus();
        return false;
    }
    if (!dateInput.value) {
        showToast("Please select a due date.", "error");
        dateInput.focus();
        return false;
    }
    return true;
}

/* ============================================================
   ADD TASK
   ============================================================ */
function addTask() {
    if (!validateTaskForm()) return;

    const newTask = {
        id: generateId(),
        text: taskInput.value.trim(),
        priority: priorityEl.value,
        category: categoryInput.value,
        date: dateInput.value,
        completed: false,
        pinned: false
    };

    tasks.unshift(newTask);
    saveTasks();
    render();
    showToast("Task added successfully!", "success");

    taskInput.value = "";
    dateInput.value = "";
    priorityEl.value = "High";
    categoryInput.value = "Work";
    taskInput.focus();
}

/* ============================================================
   DELETE TASK (with Undo)
   ============================================================ */
function deleteTask(id) {
    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    lastDeletedTask = { task: tasks[index], index };

    const finishDelete = () => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        render();

        showToast("Task deleted.", "info", undoDelete);

        clearTimeout(undoTimeoutId);
        undoTimeoutId = setTimeout(() => {
            lastDeletedTask = null;
        }, 4500);
    };

    if (card) {
        card.classList.add("removing");
        setTimeout(finishDelete, 280);
    } else {
        finishDelete();
    }
}

function undoDelete() {
    if (!lastDeletedTask) return;
    const { task, index } = lastDeletedTask;
    tasks.splice(index, 0, task);
    lastDeletedTask = null;
    clearTimeout(undoTimeoutId);
    saveTasks();
    render();
    showToast("Task restored!", "success");
}

/* ============================================================
   CLEAR COMPLETED
   ============================================================ */
clearCompletedBtn.addEventListener("click", () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
        showToast("No completed tasks to clear.", "info");
        return;
    }
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
    showToast(`Cleared ${completedCount} completed task(s).`, "success");
});

/* ============================================================
   COMPLETE / TOGGLE TASK
   ============================================================ */
function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    render();

    showToast(task.completed ? "Nice! Task marked complete." : "Task marked as pending.",
        task.completed ? "success" : "info");
}

/* ============================================================
   PIN TASK
   ============================================================ */
function togglePin(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.pinned = !task.pinned;
    saveTasks();
    render();

    showToast(task.pinned ? "Task pinned to top." : "Task unpinned.", "info");
}

/* ============================================================
   EDIT TASK
   ============================================================ */
function startEdit(id) {
    editingId = id;
    render();
}

function cancelEdit() {
    editingId = null;
    render();
}

function saveEdit(id) {
    const textInput = document.querySelector(`#edit-text-${id}`);
    const priorityInput = document.querySelector(`#edit-priority-${id}`);
    const categorySelect = document.querySelector(`#edit-category-${id}`);
    const dateInputEl = document.querySelector(`#edit-date-${id}`);

    const newText = textInput.value.trim();

    if (newText === "") {
        showToast("Task name can't be empty!", "error");
        return;
    }
    if (newText.length < 3) {
        showToast("Task name is too short (min 3 characters).", "error");
        return;
    }
    if (!dateInputEl.value) {
        showToast("Please select a due date.", "error");
        return;
    }

    const task = tasks.find(t => t.id === id);
    task.text = newText;
    task.priority = priorityInput.value;
    task.category = categorySelect.value;
    task.date = dateInputEl.value;

    editingId = null;
    saveTasks();
    render();
    showToast("Task updated successfully!", "success");
}

/* ============================================================
   SEARCH + FILTER
   ============================================================ */
function setFilter(filter) {
    currentFilter = filter;
    [allBtn, pendingBtn, completedBtn].forEach(btn => btn.classList.remove("active"));
    if (filter === "all") allBtn.classList.add("active");
    if (filter === "pending") pendingBtn.classList.add("active");
    if (filter === "completed") completedBtn.classList.add("active");
    render();
}

categoryFilterEl.addEventListener("change", () => {
    currentCategory = categoryFilterEl.value;
    render();
});

function getFilteredTasks() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = tasks.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchTerm);
        const matchesFilter =
            currentFilter === "all" ||
            (currentFilter === "pending" && !task.completed) ||
            (currentFilter === "completed" && task.completed);
        const matchesCategory =
            currentCategory === "all" || task.category === currentCategory;

        return matchesSearch && matchesFilter && matchesCategory;
    });

    // pinned tasks always float to the top (stable sort preserves relative order otherwise)
    return filtered.slice().sort((a, b) => (b.pinned === true) - (a.pinned === true));
}

/* ============================================================
   DYNAMIC STATS
   ============================================================ */
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    animateNumber(totalTasksEl, total);
    animateNumber(completedTasksEl, completed);
    animateNumber(pendingTasksEl, pending);
}

function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const step = target > current ? 1 : -1;
    let value = current;
    const interval = setInterval(() => {
        value += step;
        el.textContent = value;
        if (value === target) clearInterval(interval);
    }, 40);
}

/* ============================================================
   PROGRESS BAR
   ============================================================ */
function updateProgressBar() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    progressBarFill.style.width = `${percent}%`;
    progressLabel.textContent = `${percent}% completed`;
}

/* ============================================================
   OVERDUE REMINDER (shown once on page load)
   ============================================================ */
function checkOverdueReminder() {
    const overdueCount = tasks.filter(
        t => !t.completed && getDueStatus(t.date) === "overdue"
    ).length;

    if (overdueCount > 0) {
        showToast(
            `You have ${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}!`,
            "error"
        );
    }
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>No tasks found</p>
            </div>
        `;
    } else {
        taskList.innerHTML = filtered.map(task => renderTaskCard(task)).join("");
    }

    updateStats();
    updateProgressBar();
    attachEventListeners();
    attachDragEvents();
}

function renderTaskCard(task) {
    const categoryClass = `category-${(task.category || "Work").toLowerCase()}`;
    const dueStatus = getDueStatus(task.date);
    const dueClass = !task.completed && dueStatus !== "upcoming" ? `due-${dueStatus}` : "";
    const dueLabel = !task.completed
        ? (dueStatus === "overdue" ? " (Overdue)" : dueStatus === "today" ? " (Today)" : "")
        : "";

    if (editingId === task.id) {
        return `
        <div class="task-card editing" data-id="${task.id}">
            <div class="task-content" style="width:100%">
                <input type="text" id="edit-text-${task.id}" value="${escapeHtml(task.text)}" class="edit-input">
                <div class="task-details">
                    <div class="select-wrapper">
                        <select id="edit-priority-${task.id}" class="edit-select">
                            <option value="High" ${task.priority === "High" ? "selected" : ""}>High</option>
                            <option value="Medium" ${task.priority === "Medium" ? "selected" : ""}>Medium</option>
                            <option value="Low" ${task.priority === "Low" ? "selected" : ""}>Low</option>
                        </select>
                        <i class="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                    <div class="select-wrapper">
                        <select id="edit-category-${task.id}" class="edit-select">
                            <option value="Work" ${task.category === "Work" ? "selected" : ""}>Work</option>
                            <option value="Study" ${task.category === "Study" ? "selected" : ""}>Study</option>
                            <option value="Personal" ${task.category === "Personal" ? "selected" : ""}>Personal</option>
                        </select>
                        <i class="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                    <input type="date" id="edit-date-${task.id}" value="${task.date}" class="edit-date">
                </div>
            </div>
            <div class="task-actions">
                <button class="save-btn" data-save="${task.id}"><i class="fa-solid fa-check"></i></button>
                <button class="cancel-btn" data-cancel="${task.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>`;
    }

    return `
    <div class="task-card ${task.completed ? "completed" : ""} ${task.pinned ? "pinned-task" : ""}" data-id="${task.id}" draggable="true">
        <div class="task-card-inner">
            <i class="fa-solid fa-grip-vertical drag-handle"></i>
            <div class="task-content">
                <h3>
                    <i class="fa-solid fa-thumbtack"></i>
                    ${escapeHtml(task.text)}
                </h3>
                <div class="task-details">
                    <span class="priority ${task.priority.toLowerCase()}">
                        <i class="fa-solid fa-circle"></i>
                        ${task.priority}
                    </span>
                    <span class="category-badge ${categoryClass}">${task.category || "Work"}</span>
                    <span class="${dueClass}">
                        <i class="fa-regular fa-calendar"></i>
                        ${formatDate(task.date)}${dueLabel}
                    </span>
                </div>
            </div>
        </div>
        <div class="task-actions">
            <button class="pin-btn ${task.pinned ? "pinned" : ""}" data-pin="${task.id}" title="Pin task">
                <i class="fa-solid fa-thumbtack"></i>
            </button>
            <button class="complete-btn ${task.completed ? "checked" : ""}" data-complete="${task.id}">
                <i class="fa-solid fa-check"></i>
            </button>
            <button class="edit-btn" data-edit="${task.id}">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="delete-btn" data-delete="${task.id}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    </div>`;
}

/* ============================================================
   EVENT LISTENERS FOR DYNAMICALLY RENDERED BUTTONS
   ============================================================ */
function attachEventListeners() {
    document.querySelectorAll("[data-complete]").forEach(btn => {
        btn.onclick = () => toggleComplete(btn.dataset.complete);
    });
    document.querySelectorAll("[data-pin]").forEach(btn => {
        btn.onclick = () => togglePin(btn.dataset.pin);
    });
    document.querySelectorAll("[data-edit]").forEach(btn => {
        btn.onclick = () => startEdit(btn.dataset.edit);
    });
    document.querySelectorAll("[data-delete]").forEach(btn => {
        btn.onclick = () => deleteTask(btn.dataset.delete);
    });
    document.querySelectorAll("[data-save]").forEach(btn => {
        btn.onclick = () => saveEdit(btn.dataset.save);
    });
    document.querySelectorAll("[data-cancel]").forEach(btn => {
        btn.onclick = () => cancelEdit();
    });
}

/* ============================================================
   DRAG & DROP REORDERING
   ============================================================ */
function attachDragEvents() {
    const cards = document.querySelectorAll(".task-card[draggable='true']");

    cards.forEach(card => {
        card.addEventListener("dragstart", () => {
            draggedId = card.dataset.id;
            setTimeout(() => card.classList.add("dragging"), 0);
        });

        card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            document.querySelectorAll(".task-card").forEach(c => c.classList.remove("drag-over"));
        });

        card.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (card.dataset.id !== draggedId) card.classList.add("drag-over");
        });

        card.addEventListener("dragleave", () => {
            card.classList.remove("drag-over");
        });

        card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("drag-over");

            const targetId = card.dataset.id;
            if (!draggedId || draggedId === targetId) return;

            const fromIndex = tasks.findIndex(t => t.id === draggedId);
            const toIndex = tasks.findIndex(t => t.id === targetId);
            if (fromIndex === -1 || toIndex === -1) return;

            const [moved] = tasks.splice(fromIndex, 1);
            tasks.splice(toIndex, 0, moved);

            draggedId = null;
            saveTasks();
            render();
        });
    });
}

/* ============================================================
   EXPORT TO CSV
   ============================================================ */
exportCsvBtn.addEventListener("click", () => {
    if (tasks.length === 0) {
        showToast("No tasks to export.", "error");
        return;
    }

    const headers = ["Task", "Priority", "Category", "Due Date", "Status", "Pinned"];
    const rows = tasks.map(t => [
        `"${t.text.replace(/"/g, '""')}"`,
        t.priority,
        t.category || "Work",
        t.date || "",
        t.completed ? "Completed" : "Pending",
        t.pinned ? "Yes" : "No"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "my-tasks.csv";
    link.click();
    URL.revokeObjectURL(url);

    showToast("Tasks exported as CSV!", "success");
});

/* ============================================================
   EXPORT TO PDF
   ============================================================ */
exportPdfBtn.addEventListener("click", () => {
    if (tasks.length === 0) {
        showToast("No tasks to export.", "error");
        return;
    }

    if (!window.jspdf) {
        showToast("PDF library failed to load. Check your internet connection.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text("My To-Do List", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 27);

    let y = 40;
    doc.setFontSize(11);

    tasks.forEach((t, i) => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        doc.setTextColor(30, 41, 59);
        doc.text(`${i + 1}. ${t.text}`, 14, y);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Priority: ${t.priority}   |   Category: ${t.category || "Work"}   |   Due: ${t.date || "N/A"}   |   Status: ${t.completed ? "Completed" : "Pending"}`,
            14,
            y + 6
        );

        doc.setFontSize(11);
        y += 16;
    });

    doc.save("my-tasks.pdf");
    showToast("Tasks exported as PDF!", "success");
});

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    const isTyping = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

    // "/" focuses the search bar (when not already typing somewhere)
    if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInput.focus();
    }

    // Escape cancels edit mode or blurs the search bar
    if (e.key === "Escape") {
        if (editingId) {
            cancelEdit();
        } else if (document.activeElement === searchInput) {
            searchInput.value = "";
            render();
            searchInput.blur();
        }
    }
});

/* ============================================================
   EVENT BINDINGS (static elements)
   ============================================================ */
addTaskBtn.addEventListener("click", addTask);

taskInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTask();
});

searchInput.addEventListener("input", render);

allBtn.addEventListener("click", () => setFilter("all"));
pendingBtn.addEventListener("click", () => setFilter("pending"));
completedBtn.addEventListener("click", () => setFilter("completed"));

/* ============================================================
   INIT
   ============================================================ */
initTheme();
loadTasks();
render();
checkOverdueReminder();