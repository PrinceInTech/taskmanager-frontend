// ===== CONFIG =====
// Replace this with your Render backend URL after deployment
const API_URL = 'https://taskmanager-backend-jsrg.onrender.com/api';

let currentUser = null;
let editingTaskId = null;
let allTasks = [];

// ===== INIT =====
window.onload = () => {
  const saved = localStorage.getItem('taskflow_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
};

// ===== AUTH TABS =====
function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  hideAuthMsg();
}

// ===== REGISTER =====
async function register() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !email || !password) return showAuthMsg('Please fill all fields', 'error');
  if (password.length < 6) return showAuthMsg('Password must be at least 6 characters', 'error');

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!res.ok) return showAuthMsg(data.message, 'error');

    currentUser = data;
    localStorage.setItem('taskflow_user', JSON.stringify(data));
    showDashboard();
  } catch {
    showAuthMsg('Cannot connect to server. Check API URL.', 'error');
  }
}

// ===== LOGIN =====
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) return showAuthMsg('Please fill all fields', 'error');

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) return showAuthMsg(data.message, 'error');

    currentUser = data;
    localStorage.setItem('taskflow_user', JSON.stringify(data));
    showDashboard();
  } catch {
    showAuthMsg('Cannot connect to server. Check API URL.', 'error');
  }
}

// ===== LOGOUT =====
function logout() {
  currentUser = null;
  localStorage.removeItem('taskflow_user');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  switchTab('login');
}

// ===== SHOW DASHBOARD =====
function showDashboard() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('navUser').textContent = currentUser.name;
  document.getElementById('roleTag').textContent = currentUser.role;
  loadTasks();
  updateStats();
}

// ===== LOAD TASKS =====
async function loadTasks() {
  try {
    const res = await fetch(`${API_URL}/tasks`, {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });

    if (res.status === 401) return logout();
    const tasks = await res.json();
    allTasks = tasks;
    renderTasks(tasks);
    updateStatsFromTasks(tasks);
  } catch {
    console.error('Failed to load tasks');
  }
}

// ===== RENDER TASKS =====
function renderTasks(tasks) {
  const statusFilter = document.getElementById('filterStatus').value;
  const priorityFilter = document.getElementById('filterPriority').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = tasks.filter(t => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    const matchSearch = !search || t.title.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search);
    return matchStatus && matchPriority && matchSearch;
  });

  const lists = {
    todo: document.getElementById('list-todo'),
    'in-progress': document.getElementById('list-progress'),
    completed: document.getElementById('list-done')
  };
  const counts = {
    todo: document.getElementById('count-todo'),
    'in-progress': document.getElementById('count-progress'),
    completed: document.getElementById('count-done')
  };

  Object.values(lists).forEach(l => l.innerHTML = '');

  const buckets = { todo: [], 'in-progress': [], completed: [] };
  filtered.forEach(t => { if (buckets[t.status]) buckets[t.status].push(t); });

  Object.entries(buckets).forEach(([status, taskArr]) => {
    counts[status].textContent = taskArr.length;
    taskArr.forEach(task => {
      lists[status].appendChild(createTaskCard(task));
    });
  });

  const total = filtered.length;
  document.getElementById('emptyState').style.display = total === 0 ? 'block' : 'none';
}

// ===== CREATE TASK CARD =====
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';

  const isOwner = task.user._id === currentUser._id || task.user === currentUser._id;
  const canEdit = isOwner || currentUser.role === 'admin';

  const dueStr = task.dueDate ? formatDate(task.dueDate) : '';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const isDone = task.status === 'completed';

  const ownerInfo = currentUser.role === 'admin' && task.user?.name
    ? `<span class="task-owner">👤 ${task.user.name}</span>`
    : '';

  card.innerHTML = `
    <div class="task-card-top">
      <span class="task-title ${isDone ? 'done-title' : ''}">${escHtml(task.title)}</span>
      ${canEdit ? `
      <div class="task-actions">
        <button class="task-btn edit" onclick="editTask('${task._id}')">Edit</button>
        <button class="task-btn delete" onclick="deleteTask('${task._id}')">Del</button>
      </div>` : ''}
    </div>
    ${task.description ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
    <div class="task-footer">
      <span class="priority-badge priority-${task.priority}">${task.priority}</span>
      ${dueStr ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⚠ ' : ''}${dueStr}</span>` : ''}
      ${ownerInfo}
    </div>
  `;

  return card;
}

// ===== STATS =====
async function updateStats() {
  // Stats calculated from tasks for all users
}

function updateStatsFromTasks(tasks) {
  document.getElementById('statTotal').textContent = tasks.length;
  document.getElementById('statTodo').textContent = tasks.filter(t => t.status === 'todo').length;
  document.getElementById('statProgress').textContent = tasks.filter(t => t.status === 'in-progress').length;
  document.getElementById('statDone').textContent = tasks.filter(t => t.status === 'completed').length;
}

// ===== MODAL =====
function openModal(task = null) {
  editingTaskId = task ? task._id : null;
  document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'Add Task';
  document.getElementById('taskTitle').value = task ? task.title : '';
  document.getElementById('taskDesc').value = task ? (task.description || '') : '';
  document.getElementById('taskStatus').value = task ? task.status : 'todo';
  document.getElementById('taskPriority').value = task ? task.priority : 'medium';
  document.getElementById('taskDue').value = task && task.dueDate ? task.dueDate.split('T')[0] : '';
  document.getElementById('modalMsg').className = 'auth-msg';
  document.getElementById('modalMsg').textContent = '';
  document.getElementById('taskModal').style.display = 'flex';
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  document.getElementById('taskModal').style.display = 'none';
  editingTaskId = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('taskModal')) closeModal();
}

// ===== SAVE TASK =====
async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    showModalMsg('Title is required', 'error');
    return;
  }

  const payload = {
    title,
    description: document.getElementById('taskDesc').value.trim(),
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    dueDate: document.getElementById('taskDue').value || null
  };

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const url = editingTaskId ? `${API_URL}/tasks/${editingTaskId}` : `${API_URL}/tasks`;
    const method = editingTaskId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) { showModalMsg(data.message, 'error'); return; }

    closeModal();
    loadTasks();
  } catch {
    showModalMsg('Server error. Try again.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Task';
  }
}

// ===== EDIT TASK =====
function editTask(id) {
  const task = allTasks.find(t => t._id === id);
  if (task) openModal(task);
}

// ===== DELETE TASK =====
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;

  try {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });

    if (!res.ok) { const d = await res.json(); alert(d.message); return; }
    loadTasks();
  } catch {
    alert('Error deleting task');
  }
}

// ===== HELPERS =====
function showAuthMsg(msg, type) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
}
function hideAuthMsg() {
  const el = document.getElementById('authMsg');
  el.className = 'auth-msg';
}
function showModalMsg(msg, type) {
  const el = document.getElementById('modalMsg');
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Keyboard shortcut — Escape closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
