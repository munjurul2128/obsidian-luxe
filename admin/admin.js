const API_BASE = "https://obsidian-luxe.onrender.com";

async function adminLogin() {

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    const errorMsg = document.getElementById("errorMsg");
    errorMsg.innerText = "";

    if (!username || !password) {
        errorMsg.innerText = "All fields required";
        return;
    }

    const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    const data = await res.json();

    if (data.token) {

        localStorage.setItem("adminToken", data.token);

        window.location.href = "dashboard.html";

    } else {
        errorMsg.innerText = data.error || "Login failed";
    }
}



// ==========================
// VERIFY TOKEN
// ==========================
function verifyToken() {

    const token = localStorage.getItem("adminToken");

    if (!token) {
        window.location.href = "login.html";
    }
}

// ==========================
// LOGOUT
// ==========================
function logout() {
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
}

// ==========================
// LOAD DASHBOARD
// ==========================
async function loadDashboard() {

    document.getElementById("pageTitle").innerText = "Dashboard";

    const token = localStorage.getItem("adminToken");

    const res = await fetch("http://localhost:5000/admin/dashboard", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();

    document.getElementById("contentArea").innerHTML = `
        <div class="stats-grid">

            <div class="stat-card">
                <h3>Total Users</h3>
                <h1>${data.totalUsers}</h1>
            </div>

            <div class="stat-card">
                <h3>Today Users</h3>
                <h1>${data.todayUsers}</h1>
            </div>

            <div class="stat-card">
                <h3>Total Coins</h3>
                <h1>${data.totalCoins}</h1>
            </div>

            <div class="stat-card">
                <h3>Total Cash</h3>
                <h1>${data.totalCash}</h1>
            </div>

            <div class="stat-card">
                <h3>Pending Withdraw</h3>
                <h1>${data.pendingWithdraw}</h1>
            </div>

            <div class="stat-card">
                <h3>Approved Withdraw</h3>
                <h1>${data.approvedWithdraw}</h1>
            </div>

            <div class="stat-card">
                <h3>Rejected Withdraw</h3>
                <h1>${data.rejectedWithdraw}</h1>
            </div>

            <div class="stat-card">
                <h3>Total Login Bonus</h3>
                <h1>${data.totalLoginBonus}</h1>
            </div>

            <div class="stat-card">
                <h3>Total Referral Earn</h3>
                <h1>${data.totalReferral}</h1>
            </div>

            <div class="stat-card">
    <h3>Today Earnings</h3>
    <p>Ad: ${data.todayAd}</p>
    <p>Spin: ${data.todaySpin}</p>
    <p>Shortlink: ${data.todayShortlink}</p>
    <h2>Total: ${data.todayTotal}</h2>
</div>

        </div>
    `;
}




// ==========================
// LOAD WITHDRAW REQUESTS
// ==========================
async function loadWithdraw(status = "all") {

    document.getElementById("pageTitle").innerText = "Withdraw Management";

    const token = localStorage.getItem("adminToken");

    let url = "http://localhost:5000/admin/withdraw-list";

    if (status !== "all") {
        url += `?status=${status}`;
    }

    const res = await fetch(url, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    const requests = data.withdraws || [];

    let filterDropdown = `
        <select id="statusFilter"
        onchange="loadWithdraw(this.value)"
        style="margin-bottom:15px; padding:8px; border-radius:8px;">
            <option value="all" ${status === "all" ? "selected" : ""}>All</option>
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="approved" ${status === "approved" ? "selected" : ""}>Approved</option>
            <option value="rejected" ${status === "rejected" ? "selected" : ""}>Rejected</option>
        </select>
    `;

    if (requests.length === 0) {
        document.getElementById("contentArea").innerHTML =
            filterDropdown + "<p>No withdraw requests.</p>";
        return;
    }

    let table = `
        <table class="admin-table">
            <tr>
                <th>User</th>
                <th>Method</th>
                <th>Payment ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
    `;

    requests.forEach(r => {
        table += `
            <tr>
                <td>${r.name}</td>
                <td>${r.method}</td>
                <td>${r.payment_id}</td>
                <td>${r.amount}</td>
                <td>${r.status}</td>
                <td>
                    ${r.status === "pending" ? `
                        <button onclick="approveWithdraw('${r.id}')">Approve</button>
                        <button onclick="rejectWithdraw('${r.id}')">Reject</button>
                    ` : "-"}
                </td>
            </tr>
        `;
    });

    table += "</table>";

    document.getElementById("contentArea").innerHTML =
        filterDropdown + table;
}



async function approveWithdraw(id) {

    const token = localStorage.getItem("adminToken");

    await fetch("http://localhost:5000/admin/approve-withdraw", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ withdraw_id: id })
    });

    loadWithdraw();
}

async function rejectWithdraw(id) {

    const reason = prompt("Enter reject reason:");

    if (!reason) {
        alert("Reject reason required");
        return;
    }

    const token = localStorage.getItem("adminToken");

    await fetch("http://localhost:5000/admin/reject-withdraw", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            withdraw_id: id,
            reason: reason
        })
    });

    loadWithdraw();
}



// ==========================
// LOAD USERS LIST
// ==========================
// ==========================
// LOAD USERS LIST
// ==========================
async function loadUsers(search = "") {

    document.getElementById("pageTitle").innerText = "User Management";

    const token = localStorage.getItem("adminToken");

    const res = await fetch(
        `http://localhost:5000/admin/users?search=${search}`,
        {
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    const data = await res.json();
    const users = data.users;



    let table = `
    <input type="text" id="userSearch"
    value="${search}"
    placeholder="Search user..."
    onkeyup="searchUsers(this.value)"
    style="padding:10px; margin-bottom:15px;
    width:100%; border-radius:10px;">

    <table class="admin-table">
            <tr>
                <th>Username</th>
                <th>Telegram ID</th>
                <th>Coins</th>
                <th>Cash</th>
                <th>Action</th>
            </tr>
    `;

    if (!users || users.length === 0) {
        table += `
        </table>
        <p style="margin-top:15px;">No users found.</p>
    `;
        document.getElementById("contentArea").innerHTML = table;
        return;
    }

    users.forEach(u => {
        table += `
            <tr>
                <td>${u.username || "N/A"}</td>
                <td>${u.telegram_id}</td>
                <td>${u.coin_balance}</td>
                <td>${u.cash_balance}</td>
                <td>
                    <button onclick="viewUser('${u.id}')">View</button>
                </td>
            </tr>
        `;
    });

    table += "</table>";

    document.getElementById("contentArea").innerHTML = table;
}


let searchTimeout;

function searchUsers(value) {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {

        loadUsers(value.trim());

    }, 400);
}

// ==========================
// VIEW SINGLE USER
// ==========================
async function viewUser(id) {

    const token = localStorage.getItem("adminToken");

    const res = await fetch(`http://localhost:5000/admin/user/${id}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    const user = data.user;

    document.getElementById("pageTitle").innerText = "User Details";

    document.getElementById("contentArea").innerHTML = `
    <div class="stat-card">

        <h2>User Profile</h2>
        <hr><br>

        <h3>Basic Info</h3>
        <p><b>Username:</b> ${user.username || "N/A"}</p>
        <p><b>Telegram ID:</b> ${user.telegram_id}</p>
        <p><b>VIP Tier:</b> ${user.vip_tier || "None"}</p>
        <p><b>Account Created:</b> ${new Date(user.created_at).toLocaleString()}</p>

        <hr><br>

        <h3>Balances</h3>
        <p><b>Coin Balance:</b> ${user.coin_balance}</p>
        <input type="number" id="coinAmount" placeholder="Enter coin amount (+/-)">
        <button onclick="updateCoin('${user.id}')">Update Coin</button>

        <p><b>Cash Balance:</b> ${user.cash_balance}</p>
        <input type="number" id="cashAmount" placeholder="Enter cash amount (+/-)">
        <button onclick="updateCash('${user.id}')">Update Cash</button>

        <hr><br>

        <h3>Daily Activity</h3>
        <p><b>Daily Tap Count:</b> ${user.daily_tap_count}</p>
        <p><b>Daily Ad Count:</b> ${user.daily_ad_count}</p>
        <p><b>Daily Shortlink Count:</b> ${user.daily_shortlink_count}</p>
        <p><b>Daily Spin Count:</b> ${user.daily_spin_count}</p>

        <hr><br>

        <h3>Referral & Bonus</h3>
        <p><b>Total Referral Earn:</b> ${user.total_ref_earned}</p>
        <p><b>Login Claimed Days:</b> ${user.login_claimed_days?.length || 0}</p>
        <p><b>Last Bonus Date:</b> 
${user.last_bonus_date ? new Date(user.last_bonus_date).toLocaleDateString() : "N/A"}
</p>

        <hr><br>

        <h3>Account Status</h3>
        <p>${user.is_suspended ? "Suspended ❌" : "Active ✅"}</p>
        <button onclick="toggleSuspend('${user.id}')">
            ${user.is_suspended ? "Unsuspend" : "Suspend"}
        </button>

        <br><br>
        <button onclick="loadUsers()">⬅ Back to Users</button>

    </div>
`;
}



// ==========================
// UPDATE COIN
// ==========================
async function updateCoin(userId) {

    const amount = document.getElementById("coinAmount").value;
    const token = localStorage.getItem("adminToken");

    await fetch("http://localhost:5000/admin/update-coin", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            user_id: userId,
            amount: amount
        })
    });

    viewUser(userId);
}



// ==========================
// UPDATE CASH
// ==========================
async function updateCash(userId) {

    const amount = document.getElementById("cashAmount").value;
    const token = localStorage.getItem("adminToken");

    await fetch("http://localhost:5000/admin/update-cash", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            user_id: userId,
            amount: amount
        })
    });

    viewUser(userId);
}



// ==========================
// TOGGLE SUSPEND
// ==========================
async function toggleSuspend(userId) {

    const token = localStorage.getItem("adminToken");

    await fetch("http://localhost:5000/admin/toggle-suspend", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            user_id: userId
        })
    });

    viewUser(userId);
}




// ==========================
// LOAD SETTINGS PANEL
// ==========================
async function loadSettings() {

    document.getElementById("pageTitle").innerText = "System Settings";

    const token = localStorage.getItem("adminToken");

    const res = await fetch("http://localhost:5000/admin/settings", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    const settings = data.settings;

    function getVal(key, def = "") {
        return settings.find(s => s.key === key)?.value || def;
    }

    // Temp add, if any problen the we paste old code from notepad
    document.getElementById("contentArea").innerHTML = `
    <div class="stat-card">

        <h3>=== SYSTEM TOGGLES ===</h3>

        <h3>Spin Enabled</h3>
        <input type="checkbox" id="spin_enabled" ${getVal("spin_enabled") === "true" ? "checked" : ""}>

        <h3>Shortlink Enabled</h3>
        <input type="checkbox" id="shortlink_enabled" ${getVal("shortlink_enabled") === "true" ? "checked" : ""}>

        <h3>Withdraw Enabled</h3>
        <input type="checkbox" id="withdraw_enabled" ${getVal("withdraw_enabled") === "true" ? "checked" : ""}>

        <h3>Login Bonus Enabled</h3>
        <input type="checkbox" id="login_bonus_enabled" ${getVal("login_bonus_enabled") === "true" ? "checked" : ""}>

        <hr><br>

        <h3>=== DAILY LIMITS ===</h3>

        <h3>Daily Tap Limit</h3>
        <input type="number" id="tap_daily_limit" value="${getVal("tap_daily_limit", 500)}">

        <h3>Daily Ad Limit</h3>
        <input type="number" id="ad_daily_limit" value="${getVal("ad_daily_limit", 300)}">

        <h3>Daily Shortlink Limit</h3>
        <input type="number" id="shortlink_daily_limit" value="${getVal("shortlink_daily_limit", 200)}">

        <hr><br>

        <h3>=== REWARD SETTINGS ===</h3>

        <h3>Daily Bonus Reward</h3>
        <input type="number" id="daily_bonus_amount" value="${getVal("daily_bonus_amount", 100)}">

        <h3>Convert Minimum Coin</h3>
        <input type="number" id="convert_minimum" value="${getVal("convert_minimum", 1000000)}">

        <h3>Minimum Withdraw Amount</h3>
        <input type="number" id="min_withdraw" value="${getVal("min_withdraw", 1000)}">

        <h3>Coin To Cash Rate</h3>
        <input type="number" id="coin_rate" value="${getVal("coin_rate", 1000)}">

        <br><br>
        <button onclick="saveSettings()">Save Settings</button>

    </div>
`;

}





// ==========================
// SAVE SETTINGS
// ==========================
async function saveSettings() {

    const token = localStorage.getItem("adminToken");

    const settingsToUpdate = [

        { key: "spin_enabled", value: document.getElementById("spin_enabled").checked.toString() },
        { key: "shortlink_enabled", value: document.getElementById("shortlink_enabled").checked.toString() },
        { key: "withdraw_enabled", value: document.getElementById("withdraw_enabled").checked.toString() },
        { key: "login_bonus_enabled", value: document.getElementById("login_bonus_enabled").checked.toString() },

        { key: "tap_daily_limit", value: document.getElementById("tap_daily_limit")?.value || 500 },
        { key: "ad_daily_limit", value: document.getElementById("ad_daily_limit")?.value || 300 },
        { key: "shortlink_daily_limit", value: document.getElementById("shortlink_daily_limit")?.value || 200 },

        { key: "daily_bonus_amount", value: document.getElementById("daily_bonus_amount")?.value || 100 },
        { key: "convert_minimum", value: document.getElementById("convert_minimum")?.value || 1000000 },

        { key: "min_withdraw", value: document.getElementById("min_withdraw").value },
        { key: "coin_rate", value: document.getElementById("coin_rate").value }

    ];
    for (let s of settingsToUpdate) {

        await fetch("http://localhost:5000/admin/update-setting", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(s)
        });
    }

    alert("Settings saved successfully ✅");
}




// ==========================
// LOAD ANNOUNCEMENT PANEL
// ==========================
async function loadAnnouncement() {

    document.getElementById("pageTitle").innerText = "Announcement System";

    const token = localStorage.getItem("adminToken");

    const res = await fetch("http://localhost:5000/admin/get-announcement", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    const announcement = data.announcement || {};

    document.getElementById("contentArea").innerHTML = `
        <div class="stat-card">

            <h3>Global Announcement Message</h3>

            <textarea id="announcementMessage"
                style="width:100%; height:120px; padding:10px; border-radius:10px;">
${announcement.message || ""}
            </textarea>

            <br><br>

            <label>
                <input type="checkbox" id="announcementActive"
                ${announcement.is_active ? "checked" : ""}>
                Active
            </label>

            <br><br>

            <button onclick="saveAnnouncement()">Save Announcement</button>

        </div>
    `;
}



// ==========================
// SAVE ANNOUNCEMENT
// ==========================
async function saveAnnouncement() {

    const token = localStorage.getItem("adminToken");

    const message =
        document.getElementById("announcementMessage").value;

    const is_active =
        document.getElementById("announcementActive").checked;

    await fetch("http://localhost:5000/admin/set-announcement", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            message,
            is_active
        })
    });

    alert("Announcement saved successfully ✅");
}











