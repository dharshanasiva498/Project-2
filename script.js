/* ==========================================================
   script.js
   Handles all frontend logic:
   - Login / Register (calls FastAPI backend)
   - Video upload + AI analysis result display
   - Dashboard charts (Chart.js)
   - History table
   ========================================================== */

// Change this if your backend runs on a different host/port
const API_BASE = "http://127.0.0.1:8000/api";

let statusPieChart = null;
let historyLineChart = null;

// ---------------------------------------------------------
// On page load: check if user is already logged in
// ---------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (token && username) {
    showDashboard(username);
    loadDashboardData();
  } else {
    showAuth();
  }
});

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);

  try {
    const res = await fetch(`${API_BASE}/login`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Login failed");

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);

    showDashboard(data.username);
    loadDashboardData();
  } catch (err) {
    showAuthError(err.message);
  }
});

// ---------------------------------------------------------
// REGISTER
// ---------------------------------------------------------
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value.trim();

  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);

  try {
    const res = await fetch(`${API_BASE}/register`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Registration failed");

    alert("Registration successful! Please login.");
    document.getElementById("regUsername").value = "";
    document.getElementById("regPassword").value = "";
  } catch (err) {
    showAuthError(err.message);
  }
});

// ---------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  showAuth();
}

// ---------------------------------------------------------
// VIDEO UPLOAD + AI ANALYSIS
// ---------------------------------------------------------
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("videoFile");
  const statusDiv = document.getElementById("uploadStatus");

  if (!fileInput.files.length) return;

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  statusDiv.innerHTML = `<div class="alert alert-info">
      <span class="spinner-border spinner-border-sm"></span>
      Processing video with YOLOv8... this may take a moment.
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
      body: formData
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Upload failed");

    statusDiv.innerHTML = `<div class="alert alert-success">Video analyzed successfully!</div>`;
    displayResult(data.results);
    loadDashboardData(); // refresh charts + history
  } catch (err) {
    statusDiv.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
});

// ---------------------------------------------------------
// Display latest single-video result
// ---------------------------------------------------------
function displayResult(results) {
  document.getElementById("resultCard").classList.remove("d-none");
  document.getElementById("statAvgCount").innerText = results.avg_vehicle_count;
  document.getElementById("statMaxCount").innerText = results.max_vehicle_count;
  document.getElementById("statFrames").innerText = results.total_frames_analyzed;

  const badge = document.getElementById("statusBadge");
  badge.innerText = results.traffic_status;
  badge.className = "badge fs-6 " + statusBadgeClass(results.traffic_status);
}

function statusBadgeClass(status) {
  if (status === "Low") return "badge-low";
  if (status === "Medium") return "badge-medium";
  return "badge-high";
}

// ---------------------------------------------------------
// Load dashboard summary + history + charts
// ---------------------------------------------------------
async function loadDashboardData() {
  const token = localStorage.getItem("token");
  const headers = { "Authorization": `Bearer ${token}` };

  try {
    const [summaryRes, historyRes] = await Promise.all([
      fetch(`${API_BASE}/stats/summary`, { headers }),
      fetch(`${API_BASE}/history`, { headers })
    ]);

    const summary = await summaryRes.json();
    const history = await historyRes.json();

    renderStatusPieChart(summary.status_counts);
    renderHistoryLineChart(history.history);
    renderHistoryTable(history.history);
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}

// ---------------------------------------------------------
// Chart: Pie chart of Low/Medium/High counts
// ---------------------------------------------------------
function renderStatusPieChart(statusCounts) {
  const ctx = document.getElementById("statusPieChart");
  const data = [statusCounts.Low, statusCounts.Medium, statusCounts.High];

  if (statusPieChart) statusPieChart.destroy();
  statusPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Low", "Medium", "High"],
      datasets: [{
        data: data,
        backgroundColor: ["#2ecc71", "#f1c40f", "#e74c3c"]
      }]
    },
    options: { responsive: true }
  });
}

// ---------------------------------------------------------
// Chart: Line chart of avg vehicle count over time
// ---------------------------------------------------------
function renderHistoryLineChart(history) {
  const ctx = document.getElementById("historyLineChart");
  const reversed = [...history].reverse(); // oldest -> newest for the line chart

  const labels = reversed.map((_, i) => `#${i + 1}`);
  const values = reversed.map(h => h.avg_vehicle_count);

  if (historyLineChart) historyLineChart.destroy();
  historyLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Avg Vehicle Count",
        data: values,
        borderColor: "#12796a",
        backgroundColor: "rgba(18,121,106,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: { responsive: true }
  });
}

// ---------------------------------------------------------
// History table
// ---------------------------------------------------------
function renderHistoryTable(history) {
  const tbody = document.getElementById("historyTableBody");
  tbody.innerHTML = "";

  history.forEach((item, index) => {
    const date = new Date(item.created_at).toLocaleString();
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${date}</td>
        <td>${item.avg_vehicle_count}</td>
        <td>${item.max_vehicle_count}</td>
        <td><span class="badge ${statusBadgeClass(item.traffic_status)}">${item.traffic_status}</span></td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// ---------------------------------------------------------
// UI helpers
// ---------------------------------------------------------
function showAuth() {
  document.getElementById("authSection").classList.remove("d-none");
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("navUserBox").classList.add("d-none");
}

function showDashboard(username) {
  document.getElementById("authSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
  document.getElementById("navUserBox").classList.remove("d-none");
  document.getElementById("navUsername").innerText = `Hi, ${username}`;
}

function showAuthError(message) {
  const alertBox = document.getElementById("authAlert");
  alertBox.innerText = message;
  alertBox.classList.remove("d-none");
  setTimeout(() => alertBox.classList.add("d-none"), 4000);
}
