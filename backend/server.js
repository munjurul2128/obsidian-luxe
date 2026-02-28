console.log("🔥🔥🔥 AUTH SERVER VERSION 2 RUNNING 🔥🔥🔥");
console.log("SERVER FILE LOADED SUCCESSFULLY");
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const userRequestMap = new Map();

const supabase = require("./config/supabase");
console.log("🔥 THIS IS THE REAL SERVER FILE 🔥");
console.log("🚨 REAL SERVER FILE LOADED 🚨");

const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN);

// ==========================
// USER BASED RATE LIMIT
// ==========================


const app = express();

app.set('trust proxy', 1);   // 🔥 Render proxy fix

// ==========================
// TELEGRAM AUTH VERIFY
// ==========================

function verifyTelegramAuth(initData, botToken) {

    const secret = crypto
        .createHmac("sha256", botToken)
        .update("WebAppData")
        .digest();

    const parsed = new URLSearchParams(initData);
    const hash = parsed.get("hash");
    parsed.delete("hash");

    const dataCheckString = [...parsed.entries()]
        .sort()
        .map(([key, val]) => `${key}=${val}`)
        .join("\n");

    const hmac = crypto
        .createHmac("sha256", secret)
        .update(dataCheckString)
        .digest("hex");

    return hmac === hash;
}


app.use(cors());
app.use(express.json());

const path = require("path");





app.use("/admin", express.static(path.join(__dirname, "../admin")));

const frontendPath = path.resolve(__dirname, "..", "frontend");

console.log("Serving frontend from:", frontendPath);

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});


// ==========================
// USER BASED RATE LIMIT MIDDLEWARE
// ==========================
function userRateLimiter(req, res, next) {

    // যদি body না থাকে → skip
    if (!req.body || !req.body.telegram_id) {
        return next();
    }

    const telegram_id = req.body.telegram_id;

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 120;

    if (!userRequestMap.has(telegram_id)) {
        userRequestMap.set(telegram_id, []);
    }

    const timestamps = userRequestMap.get(telegram_id);

    const filtered = timestamps.filter(
        time => now - time < windowMs
    );

    filtered.push(now);

    userRequestMap.set(telegram_id, filtered);

    if (filtered.length > maxRequests) {
        return res.status(429).json({
            error: "Too many actions. Slow down."
        });
    }

    next();
}



// ==========================
// GLOBAL RATE LIMIT
// ==========================
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // max 60 requests per minute per IP
    message: {
        error: "Too many requests. Please slow down."
    }
});

app.use(limiter);




// Test database connection
app.get("/test-db", async (req, res) => {
    const { data, error } = await supabase.from("users").select("*").limit(1);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data });
});








// ==========================
// TELEGRAM LOGIN
// ==========================

app.post("/auth/telegram", async (req, res) => {

    const { initData } = req.body;

    if (!initData) {
        return res.status(400).json({ error: "No initData provided" });
    }

    // 🔥 Parse user directly (Telegram already validated inside WebApp)
    const parsed = new URLSearchParams(initData);
    const userRaw = parsed.get("user");

    if (!userRaw) {
        return res.status(400).json({ error: "User data missing" });
    }

    const userData = JSON.parse(userRaw);

    const telegramId = userData.id;
    const username = userData.username || "unknown";

    const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .single();

    // 🔥 Get referral start_param
    const startParam = req.body.startParam || null;
    console.log("START PARAM:", startParam);

    if (!existingUser) {

        const newRefCode = "REF" + Math.floor(100000 + Math.random() * 900000);

        // ✅ Create new user with 200 signup coin
        const { data: newUser } = await supabase
            .from("users")
            .insert([
                {
                    telegram_id: telegramId,
                    username: username,
                    coin_balance: 200,
                    cash_balance: 0,
                    referral_code: newRefCode,
                    referred_by: startParam || null
                }
            ])
            .select()
            .single();

        // 🎁 If referral used → reward referrer
        if (startParam) {

            const { data: referrer } = await supabase
                .from("users")
                .select("*")
                .eq("referral_code", startParam)
                .single();

            if (referrer && referrer.telegram_id !== telegramId) {

                await supabase.rpc("increment_coin", {
                    user_telegram_id: referrer.telegram_id,
                    amount_to_add: 1000
                });

                await supabase
                    .from("users")
                    .update({
                        total_ref_earned: (referrer.total_ref_earned || 0) + 1000
                    })
                    .eq("id", referrer.id);


                // 🔥 রেফারেল বোনাসের ট্রানজেকশন যোগ করা
                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: referrer.id,
                            type: "referral_income",
                            amount: 1000
                        }
                    ]);




                await supabase
                    .from("referrals")
                    .insert([
                        {
                            referrer_id: referrer.id,
                            referred_user_id: newUser.id
                        }
                    ]);
            }
        }
    }

    const { data: fullUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .single();

    res.json({
        success: true,
        ...fullUser
    });
});




// AUTH ROUTE



// ==========================
// TAP ROUTE
// ==========================
app.post("/tap", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {

    const tapEnabled = await getBoolSetting("tap_enabled");

    if (!tapEnabled) {
        return res.status(403).json({
            error: "Tap currently disabled by admin."
        });
    }

    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: "Telegram ID required" });
    }

    // Get user
    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const tapLimit = await getSetting("tap_daily_limit");

    if (user.daily_tap_count >= tapLimit) {
        return res.status(400).json({ error: "Daily tap limit reached" });
    }


    const newTapCount = user.daily_tap_count + 1;

    // 🔐 Atomic coin increment
    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: 1
    });

    // Update tap count separately
    await supabase
        .from("users")
        .update({
            daily_tap_count: newTapCount
        })
        .eq("telegram_id", telegram_id);

    // Log transaction
    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "tap",
                amount: 1
            }
        ]);


    // 1% referral income
    if (user.referred_by) {

        const { data: referrer } =
            await supabase
                .from("users")
                .select("*")
                .eq("referral_code", user.referred_by)
                .single();

        if (referrer) {

            const referralReward =
                Math.floor(user.tap_power * 0.01);

            if (referralReward > 0) {

                // 🔐 Atomic referral increment
                await supabase.rpc("increment_coin", {
                    user_telegram_id: referrer.telegram_id,
                    amount_to_add: referralReward
                });

                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: referrer.id,
                            type: "referral_income",
                            amount: referralReward
                        }
                    ]);
            }
        }
    }

    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance")
            .eq("telegram_id", telegram_id)
            .single();



    res.json({
        success: true,
        coin_balance: updatedUser.coin_balance,
        tap_power: user.tap_power,
        daily_tap_count: newTapCount
    });
});



// ==========================
// SECURE SPIN ROUTE
// ==========================
app.post("/spin", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {

    const spinEnabled = await getBoolSetting("spin_enabled");

    if (!spinEnabled) {
        return res.status(403).json({
            error: "Spin currently disabled."
        });
    }

    const { telegram_id, spin_type } = req.body;

    if (!["free", "ad"].includes(spin_type)) {
        return res.status(400).json({ error: "Invalid spin type" });
    }

    // spin_type = "free" or "ad"

    if (!telegram_id || !spin_type) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Daily reset
    if (user.last_spin_reset !== today) {
        await supabase
            .from("users")
            .update({
                daily_spin_count: 0,
                spin_ad_count: 0,
                last_spin_reset: today
            })
            .eq("telegram_id", telegram_id);

        user.daily_spin_count = 0;
        user.spin_ad_count = 0;
    }

    // FREE SPIN
    if (spin_type === "free") {
        if (user.daily_spin_count >= 1) {
            return res.status(400).json({ error: "Free spin already used today" });
        }

        await supabase
            .from("users")
            .update({
                daily_spin_count: user.daily_spin_count + 1
            })
            .eq("telegram_id", telegram_id);
    }

    // AD SPIN
    if (spin_type === "ad") {

        // Cooldown check (30 sec)
        if (user.last_ad_watch) {
            const lastWatch = new Date(user.last_ad_watch);
            const now = new Date();
            const diff = (now - lastWatch) / 1000;

            if (diff < 30) {
                return res.status(400).json({
                    error: "Please wait before watching another spin ad"
                });
            }
        }

        if (user.spin_ad_count >= 200) {
            return res.status(400).json({ error: "Ad spin limit reached" });
        }

        await supabase
            .from("users")
            .update({
                spin_ad_count: user.spin_ad_count + 1,
                last_ad_watch: new Date().toISOString()
            })
            .eq("telegram_id", telegram_id);
    }

    // Official spin reward list (same as frontend)
    const spinRewards = [10, 75, 40, 15, 100, 20, 65, 150, 0, 90, 55, 30, 70, 85, 200];

    const random = Math.random() * 100;
    let reward;

    if (random < 95) {
        const lowRewards = spinRewards.filter(r => r >= 10 && r <= 55);
        reward = lowRewards[Math.floor(Math.random() * lowRewards.length)];
    }
    else if (random < 97) {
        const midRewards = spinRewards.filter(r => r > 55 && r <= 85);
        reward = midRewards[Math.floor(Math.random() * midRewards.length)];
    }
    else if (random < 99) {
        const highRewards = spinRewards.filter(r => r > 85 && r <= 100);
        reward = highRewards[Math.floor(Math.random() * highRewards.length)];
    }
    else if (random < 99.5) {
        const rareRewards = spinRewards.filter(r => r > 100 && r <= 150);
        reward = rareRewards[Math.floor(Math.random() * rareRewards.length)];
    }
    else {
        const ultraRare = spinRewards.filter(r => r > 150);
        reward = ultraRare[Math.floor(Math.random() * ultraRare.length)];
    }


    // 🔐 Atomic coin increment
    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: reward
    });

    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "spin",
                amount: reward
            }
        ]);


    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance")
            .eq("telegram_id", telegram_id)
            .single();



    res.json({
        success: true,
        reward,
        newBalance: updatedUser.coin_balance
    });
});




// ==========================
// WATCH AD ROUTE BACKEND
// ==========================



// ==========================
// SHORTLINK ROUTE
// ==========================
app.post("/shortlink", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {

    const shortlinkEnabled = await getBoolSetting("shortlink_enabled");

    if (!shortlinkEnabled) {
        return res.status(403).json({
            error: "Shortlink currently disabled."
        });
    }


    const { telegram_id, timeSpent } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: "Telegram ID required" });
    }

    if (!timeSpent || timeSpent < 20) {
        return res.status(400).json({ error: "Shortlink not completed properly" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();


    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // Cooldown check (30 sec)
    if (user.last_shortlink_watch) {
        const lastWatch = new Date(user.last_shortlink_watch);
        const now = new Date();
        const diff = (now - lastWatch) / 1000;

        if (diff < 30) {
            return res.status(400).json({
                error: "Please wait before opening another shortlink"
            });
        }
    }



    const shortlinkLimit = await getSetting("shortlink_daily_limit");

    if (user.daily_shortlink_count >= shortlinkLimit) {
        return res.status(400).json({ error: "Daily shortlink limit reached" });
    }

    const reward = 80;

    // 🔐 Atomic coin increment
    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: reward
    });

    // Update shortlink count + last watch time
    await supabase
        .from("users")
        .update({
            daily_shortlink_count: user.daily_shortlink_count + 1,
            last_shortlink_watch: new Date().toISOString()
        })
        .eq("telegram_id", telegram_id);

    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "shortlink",
                amount: reward
            }
        ]);


    // 1% referral income
    if (user.referred_by) {

        const { data: referrer } =
            await supabase
                .from("users")
                .select("*")
                .eq("referral_code", user.referred_by)
                .single();

        if (referrer) {

            const referralReward =
                Math.floor(reward * 0.01);

            if (referralReward > 0) {

                await supabase.rpc("increment_coin", {
                    user_telegram_id: referrer.telegram_id,
                    amount_to_add: referralReward
                });

                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: referrer.id,
                            type: "referral_income",
                            amount: referralReward
                        }
                    ]);
            }
        }
    }


    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance")
            .eq("telegram_id", telegram_id)
            .single();




    res.json({
        success: true,
        reward,
        newBalance: updatedUser.coin_balance
    });
});





// ==========================
// WITHDRAW ROUTE FROM BACKEND
// ==========================
app.post("/withdraw", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {

    const withdrawEnabled = await getBoolSetting("withdraw_enabled");

    if (!withdrawEnabled) {
        return res.status(403).json({
            error: "Withdraw currently disabled."
        });
    }

    const { telegram_id, name, method, payment_id, amount } = req.body;

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "Invalid withdraw amount" });
    }

    if (!Number.isFinite(Number(amount))) {
        return res.status(400).json({
            error: "Invalid amount"
        });
    }

    if (!telegram_id || !name || !method || !payment_id || !amount) {
        return res.status(400).json({ error: "All fields required" });
    }

    const withdrawMin = await getSetting("min_withdraw") || 1000;

    if (amount < withdrawMin) {
        return res.status(400).json({
            error: `Minimum withdraw is ${withdrawMin} ৳`
        });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // 🚫 Prevent multiple pending withdraw
    const { data: pendingRequest } =
        await supabase
            .from("withdraw_requests")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "pending");

    if (pendingRequest && pendingRequest.length > 0) {
        return res.status(400).json({
            error: "You already have a pending withdraw request"
        });
    }



    if (Number(user.cash_balance) < Number(amount)) {
        return res.status(400).json({ error: "Insufficient cash balance" });
    }

    // 🔐 Atomic cash decrement
    await supabase.rpc("decrement_cash", {
        user_telegram_id: telegram_id,
        amount_to_subtract: amount
    });

    await supabase
        .from("withdraw_requests")
        .insert([
            {
                user_id: user.id,
                name,
                method,
                payment_id,
                amount
            }
        ]);

    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("cash_balance")
            .eq("telegram_id", telegram_id)
            .single();

    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "withdraw",
                amount: amount
            }
        ]);

    res.json({
        success: true,
        newCashBalance: updatedUser.cash_balance
    });
});




// ==========================
// CONVERT COIN TO CASH ROUTE
// ==========================
app.post("/convert", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {
    const { telegram_id, coin_amount } = req.body;

    if (!coin_amount || Number(coin_amount) <= 0) {
        return res.status(400).json({ error: "Invalid coin amount" });
    }


    if (!telegram_id || !coin_amount) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const convertMin = await getSetting("convert_minimum") || 1000000;
    const rate = await getSetting("coin_rate") || 1000;

    if (coin_amount < convertMin) {
        return res.status(400).json({
            error: "Minimum convert is 1,000,000 coin"
        });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    if (user.coin_balance < coin_amount) {
        return res.status(400).json({
            error: "Insufficient coin balance"
        });
    }

    const cashEarned = coin_amount / rate;

    // 🔐 Atomic coin decrement
    await supabase.rpc("decrement_coin", {
        user_telegram_id: telegram_id,
        amount_to_subtract: coin_amount
    });

    // Cash increment
    await supabase
        .from("users")
        .update({
            cash_balance: user.cash_balance + cashEarned
        })
        .eq("telegram_id", telegram_id);

    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "convert",
                amount: coin_amount
            }
        ]);

    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance, cash_balance")
            .eq("telegram_id", telegram_id)
            .single();


    res.json({
        success: true,
        newCoinBalance: updatedUser.coin_balance,
        newCashBalance: updatedUser.cash_balance
    });
});







// ==========================
// REFERRAL STATS ROUTE
// ==========================
app.post("/referral-stats", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {
    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: "Telegram ID required" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // Total referred users
    const { data: referredUsers } = await supabase
        .from("users")
        .select("id, username, coin_balance")
        .eq("referred_by", user.referral_code);

    const totalReferred = referredUsers ? referredUsers.length : 0;

    // Total earned from transactions
    const { data: refTransactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .in("type", ["referral_bonus", "referral_income"]);

    let totalEarned = 0;
    if (refTransactions) {
        refTransactions.forEach(tx => {
            totalEarned += tx.amount;
        });
    }

    res.json({
        success: true,
        totalReferred,
        totalEarned,
        referredUsers: referredUsers || []
    });
});





// ==========================
// DAILY BONUS ROUTE
// ==========================
app.post("/daily-bonus", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {
    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: "Telegram ID required" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const today = new Date().toISOString().split("T")[0];

    if (user.last_bonus_date === today) {
        return res.status(400).json({ error: "Already claimed today" });
    }

    const reward = await getSetting("daily_bonus_amount");


    // 🔐 Atomic coin increment
    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: reward
    });

    // Update last bonus date
    await supabase
        .from("users")
        .update({
            last_bonus_date: today
        })
        .eq("telegram_id", telegram_id);


    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "daily_bonus",
                amount: reward
            }
        ]);


    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance")
            .eq("telegram_id", telegram_id)
            .single();

    res.json({
        success: true,
        reward,
        newBalance: updatedUser.coin_balance
    });
});



// ==========================
// 30 DAYS LOGIN BONUS ROUTE
// ==========================
app.post("/claim-login-bonus", checkMaintenance, checkUserSuspended, userRateLimiter, async (req, res) => {

    const loginBonusEnabled = await getBoolSetting("login_bonus_enabled");
    if (!loginBonusEnabled) {
        return res.status(403).json({ error: "Login bonus disabled." });
    }

    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: "Telegram ID required" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const today = new Date().toISOString().split("T")[0];

    if (!user.login_start_date) {
        return res.status(400).json({ error: "Login bonus not available" });
    }

    const start = new Date(user.login_start_date + "T00:00:00");
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays =
        Math.floor((todayDate - start) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 30) {
        return res.status(400).json({ error: "Login bonus finished" });
    }

    if (user.login_last_claim_date === today) {
        return res.status(400).json({ error: "Already claimed today" });
    }

    if (user.login_claimed_days?.includes(diffDays)) {
        return res.status(400).json({ error: "Already claimed this day" });
    }

    const reward = diffDays * 10;

    // 🔐 Atomic increment
    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: reward
    });

    await supabase
        .from("users")
        .update({
            login_last_claim_date: today,
            login_claimed_days: [
                ...(user.login_claimed_days || []),
                diffDays
            ]
        })
        .eq("telegram_id", telegram_id);

    await supabase
        .from("transactions")
        .insert([
            {
                user_id: user.id,
                type: "login_bonus",
                amount: reward
            }
        ]);

    const { data: updatedUser } =
        await supabase
            .from("users")
            .select("coin_balance")
            .eq("telegram_id", telegram_id)
            .single();

    res.json({
        success: true,
        reward,
        newBalance: updatedUser.coin_balance,
        currentDay: diffDays
    });
});




// Admin Login

app.post("/admin/login", async (req, res) => {
    const { username, password } = req.body;

    const { data: admin } = await supabase
        .from("admins")
        .select("*")
        .eq("username", username)
        .single();

    if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
        { adminId: admin.id },
        process.env.ADMIN_JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.json({ token });
});



// ==========================
// ADMIN TEST ROUTE
// ==========================
app.get("/admin/test", verifyAdmin, (req, res) => {
    res.json({
        success: true,
        message: "Admin authenticated successfully",
        adminId: req.adminId
    });
});




// ==========================
// ADMIN - GET WITHDRAW LIST
// ==========================
app.get("/admin/withdraw-list", verifyAdmin, async (req, res) => {
    const { status } = req.query; // optional filter

    let query = supabase
        .from("withdraw_requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: "Failed to fetch withdraws" });
    }

    res.json({ withdraws: data });
});


// ==========================
// ADMIN - APPROVE WITHDRAW
// ==========================
app.post("/admin/approve-withdraw", verifyAdmin, async (req, res) => {
    const { withdraw_id } = req.body;

    const { data: withdraw, error } = await supabase
        .from("withdraw_requests")
        .select("*")
        .eq("id", withdraw_id)
        .single();

    if (error || !withdraw) {
        return res.status(404).json({ error: "Withdraw not found" });
    }

    if (withdraw.status !== "pending") {
        return res.status(400).json({ error: "Already processed" });
    }

    const { error: updateError } = await supabase
        .from("withdraw_requests")
        .update({ status: "approved" })
        .eq("id", withdraw_id);

    if (updateError) {
        return res.status(500).json({ error: "Failed to approve withdraw" });
    }

    res.json({ success: true });
});




// ==========================
// ADMIN - REJECT WITHDRAW
// ==========================
app.post("/admin/reject-withdraw", verifyAdmin, async (req, res) => {

    const { withdraw_id, reason } = req.body;

    const { data: withdraw, error } = await supabase
        .from("withdraw_requests")
        .select("*")
        .eq("id", withdraw_id)
        .single();

    if (error || !withdraw) {
        return res.status(404).json({ error: "Withdraw not found" });
    }

    if (withdraw.status !== "pending") {
        return res.status(400).json({ error: "Already processed" });
    }

    // 1️⃣ Refund cash using user_id
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("cash_balance")
        .eq("id", withdraw.user_id)
        .single();

    if (userError || !user) {
        return res.status(500).json({ error: "User not found" });
    }

    const newBalance = Number(user.cash_balance) + Number(withdraw.amount);

    const { error: refundError } = await supabase
        .from("users")
        .update({ cash_balance: newBalance })
        .eq("id", withdraw.user_id);

    if (refundError) {
        return res.status(500).json({ error: "Refund failed" });
    }

    // 2️⃣ Update withdraw status
    const { error: updateError } = await supabase
        .from("withdraw_requests")
        .update({
            status: "rejected",
            reject_reason: reason || null
        })
        .eq("id", withdraw_id);

    if (updateError) {
        return res.status(500).json({ error: "Failed to update withdraw" });
    }

    res.json({ success: true });
});



// ==========================
// ADMIN - GET USERS (SEARCH)
// ==========================
app.get("/admin/users", verifyAdmin, async (req, res) => {
    const { search } = req.query;

    let query = supabase
        .from("users")
        .select("id, telegram_id, username, coin_balance, cash_balance, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    if (search) {

        const trimmed = search.trim();

        const isNumber = /^\d+$/.test(trimmed);

        if (isNumber) {

            query = query.eq("telegram_id", Number(trimmed));

        } else {

            query = query.ilike("username", `%${trimmed}%`);

        }
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: "Failed to fetch users" });
    }

    res.json({ users: data });
});


// ==========================
// ADMIN - GET SINGLE USER
// ==========================
app.get("/admin/user/:id", verifyAdmin, async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: data });
});



// ==========================
// ADMIN - UPDATE COIN
// ==========================
app.post("/admin/update-coin", verifyAdmin, async (req, res) => {
    const { user_id, amount } = req.body;

    if (!amount || !user_id) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("coin_balance")
        .eq("id", user_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const newBalance = Number(user.coin_balance) + Number(amount);

    if (newBalance < 0) {
        return res.status(400).json({ error: "Balance cannot be negative" });
    }

    await supabase
        .from("users")
        .update({ coin_balance: newBalance })
        .eq("id", user_id);

    res.json({ success: true, newBalance });
});



// ==========================
// ADMIN - UPDATE CASH
// ==========================
app.post("/admin/update-cash", verifyAdmin, async (req, res) => {
    const { user_id, amount } = req.body;

    if (!amount || !user_id) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const { data: user } = await supabase
        .from("users")
        .select("cash_balance")
        .eq("id", user_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const newBalance = Number(user.cash_balance) + Number(amount);

    if (newBalance < 0) {
        return res.status(400).json({ error: "Balance cannot be negative" });
    }

    await supabase
        .from("users")
        .update({ cash_balance: newBalance })
        .eq("id", user_id);

    res.json({ success: true, newBalance });
});



// ==========================
// ADMIN - TOGGLE SUSPEND
// ==========================
app.post("/admin/toggle-suspend", verifyAdmin, async (req, res) => {
    const { user_id } = req.body;

    const { data: user } = await supabase
        .from("users")
        .select("is_suspended")
        .eq("id", user_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const newStatus = !user.is_suspended;

    await supabase
        .from("users")
        .update({ is_suspended: newStatus })
        .eq("id", user_id);

    res.json({ success: true, is_suspended: newStatus });
});












// ==========================
// ADMIN AUTH MIDDLEWARE
// ==========================
function verifyAdmin(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.ADMIN_JWT_SECRET
        );

        req.adminId = decoded.adminId;

        next();

    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}



// ==========================
// GET SETTING VALUE
// ==========================
async function getSetting(key) {

    const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

    if (error || !data) {
        console.log("Missing setting:", key);
        return null;
    }

    const num = Number(data.value);

    return isNaN(num) ? data.value : num;
}



// ==========================
// GET BOOLEAN SETTING
// ==========================
async function getBoolSetting(key) {

    const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", key)
        .single();

    if (!data) return false;

    return data.value === "true";
}







// ==========================
// USER SUSPENSION CHECK
// ==========================
async function checkUserSuspended(req, res, next) {

    // GET request হলে skip
    if (!req.body) {
        return next();
    }

    const telegram_id = req.body.telegram_id;

    // telegram_id না থাকলে skip
    if (!telegram_id) {
        return next();
    }

    const { data: user } = await supabase
        .from("users")
        .select("is_suspended")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    if (user.is_suspended) {
        return res.status(403).json({
            error: "Account suspended. Contact support."
        });
    }

    next();
}



// ==========================
// MAINTENANCE MODE CHECK
// ==========================
async function checkMaintenance(req, res, next) {

    const maintenance = await getBoolSetting("maintenance_mode");

    if (maintenance) {
        return res.status(503).json({
            error: "System under maintenance. Try later."
        });
    }

    next();
}







// ==========================
// ADMIN - DASHBOARD STATS
// ==========================
app.get("/admin/dashboard", verifyAdmin, async (req, res) => {

    try {

        // Total users
        const { count: totalUsers } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true });

        // Today new users
        const today = new Date().toISOString().split("T")[0];

        const { count: todayUsers } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .gte("created_at", today);

        // Total coin circulation
        const { data: coinData } = await supabase
            .from("users")
            .select("coin_balance");

        const totalCoins =
            coinData?.reduce((sum, u) =>
                sum + Number(u.coin_balance || 0), 0) || 0;

        // Total cash circulation
        const { data: cashData } = await supabase
            .from("users")
            .select("cash_balance");

        const totalCash =
            cashData?.reduce((sum, u) =>
                sum + Number(u.cash_balance || 0), 0) || 0;

        // Withdraw stats
        const { count: pendingWithdraw } = await supabase
            .from("withdraw_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending");

        const { count: approvedWithdraw } = await supabase
            .from("withdraw_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "approved");

        const { count: rejectedWithdraw } = await supabase
            .from("withdraw_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "rejected");

        // Login bonus total
        const { data: loginTx } = await supabase
            .from("transactions")
            .select("amount")
            .eq("type", "login_bonus");

        const totalLoginBonus =
            loginTx?.reduce((sum, tx) =>
                sum + Number(tx.amount || 0), 0) || 0;

        // Referral total
        const { data: refTx } = await supabase
            .from("transactions")
            .select("amount")
            .in("type", ["referral_bonus", "referral_income"]);

        const totalReferral =
            refTx?.reduce((sum, tx) =>
                sum + Number(tx.amount || 0), 0) || 0;


        // 🔥 TODAY EARNINGS CALCULATION

        const { data: todayTransactions } = await supabase
            .from("transactions")
            .select("*")
            .gte("created_at", today);

        let todayAd = 0;
        let todaySpin = 0;
        let todayShortlink = 0;

        todayTransactions?.forEach(t => {
            if (t.type === "ad") todayAd += Number(t.amount || 0);
            if (t.type === "spin") todaySpin += Number(t.amount || 0);
            if (t.type === "shortlink") todayShortlink += Number(t.amount || 0);
        });

        const todayTotal = todayAd + todaySpin + todayShortlink;

        res.json({
            totalUsers,
            todayUsers,
            totalCoins,
            totalCash,
            pendingWithdraw,
            approvedWithdraw,
            rejectedWithdraw,
            totalLoginBonus,
            totalReferral,

            todayAd,
            todaySpin,
            todayShortlink,
            todayTotal,
        });

    } catch (err) {
        res.status(500).json({ error: "Dashboard failed" });
    }
});



// ==========================
// ADMIN - GET ALL SETTINGS
// ==========================
app.get("/admin/settings", verifyAdmin, async (req, res) => {

    const { data } = await supabase
        .from("settings")
        .select("*");

    res.json({ settings: data });
});


// ==========================
// ADMIN - UPDATE SETTING
// ==========================
app.post("/admin/update-setting", verifyAdmin, async (req, res) => {

    const { key, value } = req.body;

    await supabase
        .from("settings")
        .update({ value })
        .eq("key", key);

    res.json({ success: true });
});



// ==========================
// ADMIN - GET TOGGLES
// ==========================
app.get("/admin/toggles", verifyAdmin, async (req, res) => {

    const { data } = await supabase
        .from("settings")
        .select("*")
        .in("key", [
            "tap_enabled",
            "withdraw_enabled",
            "spin_enabled",
            "shortlink_enabled",
            "maintenance_mode"
        ]);

    res.json({ toggles: data });
});


// ==========================
// ADMIN - UPDATE TOGGLE
// ==========================
app.post("/admin/update-toggle", verifyAdmin, async (req, res) => {

    const { key, value } = req.body;

    await supabase
        .from("settings")
        .update({ value })
        .eq("key", key);

    res.json({ success: true });
});



// ==========================
// ADMIN - SET ANNOUNCEMENT
// ==========================
app.post("/admin/set-announcement", verifyAdmin, async (req, res) => {

    const { message, is_active } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message required" });
    }

    // Deactivate old announcements
    await supabase
        .from("announcements")
        .update({ is_active: false })
        .eq("is_active", true);

    // Insert new announcement
    const { error } = await supabase
        .from("announcements")
        .insert([
            {
                message,
                is_active: is_active ?? true
            }
        ]);

    if (error) {
        return res.status(500).json({ error: "Failed to set announcement" });
    }

    res.json({ success: true });
});


// ==========================
// ADMIN - GET ANNOUNCEMENT
// ==========================
app.get("/admin/get-announcement", verifyAdmin, async (req, res) => {

    const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!data) {
        return res.json({ announcement: null });
    }

    res.json({ announcement: data });
});


// ==========================
// GET ACTIVE ANNOUNCEMENT
// ==========================
app.get("/announcement", async (req, res) => {

    const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!data) {
        return res.json({ active: false });
    }

    res.json({
        active: true,
        message: data.message
    });
});















// ==========================
// PUBLIC SETTINGS FOR FRONTEND
// ==========================
app.get("/settings/public", async (req, res) => {

    const { data } = await supabase
        .from("settings")
        .select("*");

    let result = {};

    data.forEach(s => {
        result[s.key] = s.value;
    });

    res.json(result);
});

// ==========================
// MONETAG POSTBACK ROUTE
// ==========================

app.get("/monetag-postback", async (req, res) => {

    const { sub_id, event } = req.query;

    if (!sub_id) {
        return res.send("No sub_id");
    }

    const telegram_id = sub_id;

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .single();

    if (!user) {
        return res.send("User not found");
    }

    // 30 sec cooldown
    if (user.last_ad_watch) {
        const lastWatch = new Date(user.last_ad_watch);
        const now = new Date();
        const diff = (now - lastWatch) / 1000;

        if (diff < 30) {
            return res.send("Cooldown active");
        }
    }

    let reward = 75; // default Watch Ad

    if (event === "shortlink") {
        reward = 80;
    }

    if (event === "spin") {

        const spinRewards = [10,75,40,15,100,20,65,150,0,90,55,30,70,85,200];
        reward = spinRewards[Math.floor(Math.random() * spinRewards.length)];
    }

    await supabase.rpc("increment_coin", {
        user_telegram_id: telegram_id,
        amount_to_add: reward
    });

    await supabase
        .from("users")
        .update({
            daily_ad_count: user.daily_ad_count + 1,
            last_ad_watch: new Date().toISOString()
        })
        .eq("telegram_id", telegram_id);

    await supabase
        .from("transactions")
        .insert([{
            user_id: user.id,
            type: event || "ad",
            amount: reward
        }]);

    res.send("Reward added");
});








bot.onText(/\/start (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;
    const referralCode = match[1];

    console.log("Bot Start With Referral:", referralCode);

    bot.sendMessage(chatId, "Welcome to Obsidian Luxe!", {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🚀 Open App",
                        web_app: {
                            url: `https://obsidianluxebd.com/?start=${referralCode}`
                        }
                    }
                ]
            ]
        }
    });
});


bot.onText(/\/start$/, (msg) => {

    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "Welcome!", {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🚀 Open App",
                        web_app: {
                            url: "https://obsidianluxebd.com"
                        }
                    }
                ]
            ]
        }
    });
});






































// ==========================
// SEED DEFAULT ADMIN
// ==========================







console.log("SERVER DATE:", new Date().toISOString());



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});