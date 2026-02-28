const API_BASE = window.location.origin;
let currentUser = null;









let MIN_WITHDRAW = 0;
let COIN_RATE = 1000;

// ==========================
// TELEGRAM REAL AUTH
// ==========================

async function telegramLogin() {

    const tg = window.Telegram.WebApp;
    tg.expand();

    // ✅ আগে URL থেকে referral নাও
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get("start");

    const res = await fetch("/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            initData: tg.initData,
            startParam: startParam
        })
    });

    const data = await res.json();

    if (data.success) {
        currentUser = data;
        console.log("Telegram Auth Success:", currentUser);
    } else {
        alert("Telegram Auth Failed");
    }
}








async function loadSettings() {

    const res = await fetch(`${API_BASE}/settings/public`);
    const settings = await res.json();

    MIN_WITHDRAW = Number(settings.min_withdraw || 0);
    COIN_RATE = Number(settings.coin_rate || 1000);

    // 🔥 Update Wallet UI dynamically

    const walletCards =
        document.querySelectorAll("#walletPage .card");

    // 🔥 Update Earn Page Limits Dynamically

    const earnCards =
        document.querySelectorAll("#earnPage .card");

    if (earnCards.length >= 4) {

        // Watch Ad Card
        const adPs = earnCards[0].querySelectorAll("p");

        adPs[1].innerText =
            `Daily Limit: ${settings.ad_daily_limit || 300}`;

        // Shortlink Card
        const shortlinkPs = earnCards[3].querySelectorAll("p");

        shortlinkPs[1].innerText =
            `Daily Limit: ${settings.shortlink_daily_limit || 200}`;
    }

    if (walletCards.length >= 2) {

        // Convert Card
        const convertPs = walletCards[0].querySelectorAll("p");

        convertPs[0].innerText =
            `Rate: ${COIN_RATE} Coin = 1 ৳`;

        convertPs[1].innerText =
            `Minimum Convert: 1000000 Coin`;

        // Withdraw Card
        const withdrawPs = walletCards[1].querySelectorAll("p");

        withdrawPs[0].innerText =
            `Minimum Withdraw: ${MIN_WITHDRAW} ৳`;
    }



}














// TELEGRAM INIT
const tg = window.Telegram.WebApp;
tg.expand();

// =============================
// CORE STATE
// =============================

let state = {
    coinBalance: 0,
    cashBalance: 0,
    tapPower: 1,
    dailyTapCount: 0,
    dailyTapLimit: 500,
    dailyAdCount: 0,
    dailyAdLimit: 300,
    adCooldown: false,
    dailyBonusClaimed: false,
    dailyShortlinkCount: 0,
    dailyShortlinkLimit: 200,
    shortlinkCooldown: false,
    shortlinkPending: false,
    shortlinkStartTime: 0,
    spinUsedToday: false,
    spinAdPending: false,
    spinAdStartTime: 0,
    loginStartDate: null,
    loginLastClaimDate: null,
    loginClaimedDays: [],
    refCode: null,
    totalReferred: 0,
    refEarned: 0,
    refList: [],
    adCooldownTimer: null,
    shortlinkCooldownTimer: null,
};

const spinRewards = [10, 75, 40, 15, 100, 20, 65, 150, 0, 90, 55, 30, 70, 85, 200];


// =============================
// TOAST SYSTEM
// =============================

function showToast(message, type = "success") {

    const container =
        document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// =============================
// PAGE SWITCH
// =============================

function switchPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });
    document.getElementById(pageId).classList.add("active");
}

// =============================
// UPDATE UI
// =============================

function updateBalance() {
    document.getElementById("coinBalance").innerText = state.coinBalance;
    document.getElementById("cashBalance").innerText =
        state.cashBalance.toFixed(2) + " ৳";

    document.getElementById("tapPowerDisplay").innerText =
        "Tap Power: x" + state.tapPower;
}

// =============================
// TAP SYSTEM Backend
// =============================

const tapButton = document.getElementById("tapButton");

tapButton.addEventListener("click", async () => {

    if (!currentUser) {
        alert("User not authenticated yet");
        return;
    }

    const res = await fetch(`${API_BASE}/tap`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id
        })
    });

    const data = await res.json();

    if (data.success) {
        state.coinBalance = data.coin_balance;
        updateBalance();
        animateCoin();
        createParticles();
    } else {
        alert(data.error);
    }
});

// =============================
// ADD COIN
// =============================

function addCoin(amount) {
    state.coinBalance += amount;
    animateCoin();
    updateBalance();
}




// =============================
// COIN ANIMATION
// =============================

function animateCoin() {
    const coin = document.createElement("div");
    coin.innerText = "🪙";
    coin.style.position = "absolute";
    coin.style.left = "50%";
    coin.style.top = "50%";
    coin.style.fontSize = "24px";
    coin.style.transform = "translate(-50%, -50%)";
    coin.style.transition = "all 0.8s ease";
    document.body.appendChild(coin);

    setTimeout(() => {
        coin.style.top = "20px";
        coin.style.opacity = "0";
    }, 50);

    setTimeout(() => {
        coin.remove();
    }, 900);
}


// =============================
// TAP PARTICLE BURST
// =============================

function createParticles() {

    const tapButton = document.getElementById("tapButton");
    const rect = tapButton.getBoundingClientRect();

    for (let i = 0; i < 8; i++) {

        const particle = document.createElement("div");
        particle.innerText = "✨";

        particle.style.position = "fixed";
        particle.style.left = rect.left + rect.width / 2 + "px";
        particle.style.top = rect.top + rect.height / 2 + "px";
        particle.style.pointerEvents = "none";
        particle.style.fontSize = "16px";
        particle.style.transition = "all 0.8s ease";
        particle.style.zIndex = "999";

        document.body.appendChild(particle);

        const angle = Math.random() * 2 * Math.PI;
        const distance = 60 + Math.random() * 40;

        setTimeout(() => {
            particle.style.left =
                rect.left + rect.width / 2 + Math.cos(angle) * distance + "px";
            particle.style.top =
                rect.top + rect.height / 2 + Math.sin(angle) * distance + "px";
            particle.style.opacity = "0";
        }, 10);

        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}








// =============================
// INITIAL LOAD
// =============================


// Wallet Section

async function convertCoin() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    const input =
        document.getElementById("convertAmount");

    const amount = parseInt(input.value);

    if (!amount || amount <= 0) {
        showToast("Enter valid coin amount", "error");
        return;
    }

    const button =
        document.querySelector("#walletPage .card:nth-child(1) button");

    button.disabled = true;
    button.innerText = "Converting...";

    const res = await fetch(`${API_BASE}/convert`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id,
            coin_amount: amount
        })
    });

    const data = await res.json();

    if (data.success) {

        state.coinBalance = data.newCoinBalance;
        state.cashBalance = data.newCashBalance;

        updateBalance();

        showToast("Conversion successful!", "success");

        input.value = "";

    } else {
        showToast(data.error, "error");
    }

    button.disabled = false;
    button.innerText = "Convert";
}



// Watch Ad

async function watchAd() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    if (state.adCooldown) {
        showToast("Please wait before next ad", "error");
        return;
    }

    const button =
        document.querySelector("#earnPage .card:nth-child(1) button");

    button.disabled = true;
    button.innerText = "Loading Ad...";

    try {

        // 🔥 Monetag Rewarded Interstitial
        await show_10659418();

        // ✅ Only after ad completed
        const res = await fetch("/watch-ad", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                telegram_id: currentUser.telegram_id,
                timeSpent: 25
            })
        });

        const data = await res.json();

        if (data.success) {

            state.coinBalance = data.newBalance;
            updateBalance();
            showToast("+75 Coin Added", "success");

            startAdCooldown(30);

        } else {
            showToast(data.error, "error");
        }

    } catch (err) {

        showToast("Ad not completed!", "error");

    }

    button.disabled = false;
    button.innerText = "Watch Now";
}

// Daily Bonus

async function claimDailyBonus() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    const button =
        document.querySelector("#earnPage .card:nth-child(3) button");

    button.disabled = true;
    button.innerText = "Processing...";

    const res = await fetch(`${API_BASE}/daily-bonus`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id
        })
    });

    const data = await res.json();

    if (data.success) {

        state.coinBalance = data.newBalance;
        updateBalance();

        showToast("Daily bonus claimed! +" + data.reward + " coin", "success");

    } else {
        showToast(data.error, "error");
    }

    button.disabled = false;
    button.innerText = "Claim";
}


// ShortLink


async function openShortlink() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    if (state.shortlinkCooldown) {
        showToast("Please wait before next ad", "error");
        return;
    }

    const buttons =
        document.querySelectorAll("#earnPage .card button");

    const shortlinkButton = buttons[3];

    shortlinkButton.disabled = true;
    shortlinkButton.innerText = "Loading Ad...";

    try {

        await show_10659418();

        const res = await fetch("/shortlink", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                telegram_id: currentUser.telegram_id,
                timeSpent: 25
            })
        });

        const data = await res.json();

        if (data.success) {

            state.coinBalance = data.newBalance;
            updateBalance();
            showToast("+80 Coin Added", "success");

            startShortlinkCooldown(30);

        } else {
            showToast(data.error, "error");
        }

    } catch (err) {

        showToast("Ad not completed!", "error");

    }

    shortlinkButton.disabled = false;
    shortlinkButton.innerText = "Open Shortlink";
}

// Spin System



function getWeightedReward() {

    const random = Math.random() * 100;

    if (random < 95) {
        // 10–55 range
        const lowRewards = spinRewards.filter(r => r >= 10 && r <= 55);
        return lowRewards[Math.floor(Math.random() * lowRewards.length)];
    }

    if (random < 97) {
        // 55–85
        const midRewards = spinRewards.filter(r => r > 55 && r <= 85);
        return midRewards[Math.floor(Math.random() * midRewards.length)];
    }

    if (random < 99) {
        // 85–100
        const highRewards = spinRewards.filter(r => r > 85 && r <= 100);
        return highRewards[Math.floor(Math.random() * highRewards.length)];
    }

    if (random < 99.5) {
        // 100–150
        const rareRewards = spinRewards.filter(r => r > 100 && r <= 150);
        return rareRewards[Math.floor(Math.random() * rareRewards.length)];
    }

    // 150–200
    const ultraRare = spinRewards.filter(r => r > 150);
    return ultraRare[Math.floor(Math.random() * ultraRare.length)];
}




// Spin Route Backend


async function spinWheel() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    if (state.spinAnimating) {
        showToast("Spin already in progress", "error");
        return;
    }

    const buttons =
        document.querySelectorAll("#earnPage .card button");

    const spinButton = buttons[4];

    spinButton.disabled = true;
    spinButton.innerText = "Spinning...";

    state.spinAnimating = true;

    const res = await fetch(`${API_BASE}/spin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id,
            spin_type: "free"
        })
    });

    const data = await res.json();

    if (!data.success) {

        showToast(data.error || "Spin failed", "error");

        spinButton.disabled = false;
        spinButton.innerText = "Spin";

        state.spinAnimating = false;
        return;
    }

    const reward = data.reward;

    const canvas = document.getElementById("spinCanvas");

    const rewardIndex = spinRewards.indexOf(reward);
    const sliceAngle = 360 / spinRewards.length;

    const stopAngle =
        360 - (rewardIndex * sliceAngle + sliceAngle / 2);

    const totalRotation = 360 * 5 + stopAngle;

    canvas.style.transition =
        "transform 4s cubic-bezier(0.33, 1, 0.68, 1)";

    canvas.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {

        state.coinBalance = data.newBalance;
        updateBalance();

        document.getElementById("spinResult").innerText =
            "You won: " + reward + " coin!";

        canvas.style.boxShadow =
            "0 0 60px gold";

        showToast("You won " + reward + " coin!", "success");

        setTimeout(() => {
            canvas.style.boxShadow =
                "0 0 30px rgba(0,255,255,0.6)";
        }, 2000);

        spinButton.disabled = false;
        spinButton.innerText = "Spin";

        state.spinAnimating = false;

    }, 4000);
}


// Spin For Ads

async function spinViaAd() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    if (state.spinAdCooldown) {
        showToast("Please wait before next ad", "error");
        return;
    }

    const buttons =
        document.querySelectorAll("#earnPage .card button");

    const spinAdButton = buttons[5];

    spinAdButton.disabled = true;
    spinAdButton.innerText = "Loading Ad...";

    try {

        await show_10659418();

        const res = await fetch("/spin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                telegram_id: currentUser.telegram_id,
                spin_type: "ad"
            })
        });

        const data = await res.json();

        if (data.success) {

            state.coinBalance = data.newBalance;
            updateBalance();

            document.getElementById("spinResult").innerText =
                "You won: " + data.reward + " coin!";

            startSpinAdCooldown(30);

        } else {
            showToast(data.error, "error");
        }

    } catch (err) {

        showToast("Ad not completed!", "error");

    }

    spinAdButton.disabled = false;
    spinAdButton.innerText = "Watch Ad for Spin";
}



function startSpinAdCooldown(seconds) {

    state.spinAdCooldown = true;

    const buttons =
        document.querySelectorAll("#earnPage .card button");

    const spinAdButton = buttons[5];

    let remaining = seconds;

    spinAdButton.disabled = true;

    const timer = setInterval(() => {

        spinAdButton.innerText = `Wait ${remaining}s`;

        remaining--;

        if (remaining < 0) {
            clearInterval(timer);
            state.spinAdCooldown = false;
            spinAdButton.disabled = false;
            spinAdButton.innerText = "Watch Ad for Spin";
        }

    }, 1000);
}


let currentAngle = 0;

function drawWheel() {

    const canvas = document.getElementById("spinCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const center = 150;
    const radius = 150;

    const numSlices = spinRewards.length;
    const arcSize = (2 * Math.PI) / numSlices;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < numSlices; i++) {

        const angle = i * arcSize;

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, angle, angle + arcSize);
        ctx.closePath();

        ctx.fillStyle = i % 2 === 0 ? "#6a00ff" : "#00f2ff";
        ctx.fill();

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(angle + arcSize / 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Poppins";
        ctx.textAlign = "center";
        ctx.fillText(spinRewards[i], radius - 40, 5);
        ctx.restore();
    }
}


// 30 Days Login Bonus

// ============================
// LOGIN BONUS SYSTEM
// ============================


function getLoginDayNumber() {

    const start = new Date(state.loginStartDate);
    const now = new Date();

    const diffTime = now - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays + 1;
}

function renderLoginGrid() {

    const grid = document.getElementById("loginGrid");
    grid.innerHTML = "";

    const todayDay = getLoginDayNumber();

    if (todayDay > 30) {
        document.getElementById("loginBonusCard").style.display = "none";
        return;
    }

    for (let i = 1; i <= 30; i++) {

        const div = document.createElement("div");
        div.className = "login-day";

        const reward = i * 10;

        div.innerText = "Day " + i + "\n" + reward;

        if (state.loginClaimedDays.includes(i)) {
            div.classList.add("claimed");
        }

        if (i === todayDay) {
            div.classList.add("today");
        }

        grid.appendChild(div);
    }
}

async function claimLoginBonus() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    const button =
        document.querySelector("#loginBonusCard button");

    button.disabled = true;
    button.innerText = "Processing...";

    const res = await fetch(`${API_BASE}/claim-login-bonus`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id
        })
    });

    const data = await res.json();

    if (data.success) {

        state.coinBalance = data.newBalance;
        updateBalance();

        showToast(
            "Day " + data.currentDay +
            " claimed: +" + data.reward + " coin",
            "success"
        );

        renderLoginGridBackend(data.currentDay);

    } else {
        showToast(data.error, "error");
    }

    button.disabled = false;
    button.innerText = "Claim Today";
}



// Referral System

function generateRefCode() {
    return "REF" + Math.floor(Math.random() * 1000000);
}



function copyRefLink() {

    if (!currentUser || !currentUser.referral_code) {
        showToast("Referral code not loaded yet.", "error");
        return;
    }

    const link =
        `https://t.me/obsidianluxebot?start=${currentUser.referral_code}`;

    navigator.clipboard.writeText(link);

    showToast("Referral link copied!", "success");
}


function renderReferralUI() {

    document.getElementById("totalReferred").innerText =
        state.totalReferred;

    document.getElementById("refEarned").innerText =
        state.refEarned;

    const list = document.getElementById("refList");
    list.innerHTML = "";

    state.refList.forEach(ref => {
        const div = document.createElement("div");
        div.innerText =
            ref.name + " (+ " + ref.earned + " coin)";
        list.appendChild(div);
    });
}



// Withdraw System

async function submitWithdraw() {

    if (!currentUser) {
        showToast("User not authenticated", "error");
        return;
    }

    const name =
        document.getElementById("withdrawName").value.trim();

    const method =
        document.getElementById("withdrawMethod").value;

    const number =
        document.getElementById("withdrawNumber").value.trim();

    const amount =
        parseFloat(
            document.getElementById("withdrawAmount").value
        );

    if (!name || !method || !number || !amount) {
        showToast("Please fill all fields", "error");
        return;
    }

    if (amount < MIN_WITHDRAW) {
        showToast(`Minimum withdraw is ${MIN_WITHDRAW} ৳`, "error");
        return;
    }

    const button =
        document.querySelector("#walletPage .card:nth-child(2) button");

    button.disabled = true;
    button.innerText = "Submitting...";

    const res = await fetch(`${API_BASE}/withdraw`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id,
            name,
            method,
            payment_id: number,
            amount
        })
    });

    const data = await res.json();

    if (data.success) {

        state.cashBalance = data.newCashBalance;
        updateBalance();

        showToast("Withdraw request submitted!", "success");

        document.getElementById("withdrawName").value = "";
        document.getElementById("withdrawMethod").value = "";
        document.getElementById("withdrawNumber").value = "";
        document.getElementById("withdrawAmount").value = "";

    } else {
        showToast(data.error, "error");
    }

    button.disabled = false;
    button.innerText = "Submit Request";
}



document.addEventListener("DOMContentLoaded", async function () {

    await loadSettings();

    await telegramLogin();   // 🔥 Real Telegram Auth

    if (!currentUser) {
        alert("Telegram authentication failed");
        return;
    }

    // 🔥 Get referral code from URL parameter
    let startParam = null;

    const urlParams = new URLSearchParams(window.location.search);
    startParam = urlParams.get("start");

    console.log("Referral Start Param:", startParam);

    state.coinBalance = currentUser.coin_balance;
    state.cashBalance = currentUser.cash_balance || 0;
    state.tapPower = 1;

    updateBalance();
    drawWheel();

    state.refCode = currentUser.referral_code;
    document.getElementById("refCodeText").innerText = state.refCode;

    loadReferralStats();
    checkAnnouncement();
});






// ==========================
// CHECK ANNOUNCEMENT
// ==========================
async function checkAnnouncement() {

    const res = await fetch(`${API_BASE}/announcement`);
    const data = await res.json();

    if (data.active) {
        showToast(data.message, "success");
    }
}


// Watch Ad Cooldown

function startAdCooldown(seconds) {

    state.adCooldown = true;

    const button = document.querySelector("#earnPage .card button");

    let remaining = seconds;

    button.disabled = true;

    state.adCooldownTimer = setInterval(() => {

        button.innerText = `Wait ${remaining}s`;

        remaining--;

        if (remaining < 0) {
            clearInterval(state.adCooldownTimer);
            state.adCooldown = false;
            button.disabled = false;
            button.innerText = "Watch Now";
        }

    }, 1000);
}




// ShortLink Cooldown

function startShortlinkCooldown(seconds) {

    state.shortlinkCooldown = true;

    const buttons = document.querySelectorAll("#earnPage .card button");
    const shortlinkButton = buttons[3]; // Shortlink button index

    let remaining = seconds;

    shortlinkButton.disabled = true;

    state.shortlinkCooldownTimer = setInterval(() => {

        shortlinkButton.innerText = `Wait ${remaining}s`;

        remaining--;

        if (remaining < 0) {
            clearInterval(state.shortlinkCooldownTimer);
            state.shortlinkCooldown = false;
            shortlinkButton.disabled = false;
            shortlinkButton.innerText = "Open Shortlink";
        }

    }, 1000);
}



// REferral Backend

async function loadReferralStats() {

    if (!currentUser) return;

    const res = await fetch(`${API_BASE}/referral-stats`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegram_id: currentUser.telegram_id
        })
    });

    const data = await res.json();

    if (data.success) {

        document.getElementById("totalReferred").innerText =
            data.totalReferred;

        document.getElementById("refEarned").innerText =
            data.totalEarned;

        const list = document.getElementById("refList");
        list.innerHTML = "";

        data.referredUsers.forEach(user => {
            const div = document.createElement("div");
            div.innerText = user.username || "User";
            list.appendChild(div);
        });
    }
}




function renderLoginGridBackend(currentDay) {

    const grid = document.getElementById("loginGrid");
    grid.innerHTML = "";

    for (let i = 1; i <= 30; i++) {

        const div = document.createElement("div");
        div.className = "login-day";

        const reward = i * 10;
        div.innerText = "Day " + i + "\n" + reward;

        if (i < currentDay) {
            div.classList.add("claimed");
        }

        if (i === currentDay) {
            div.classList.add("today");
        }

        grid.appendChild(div);
    }
}










