// server.js - 最終版本：解決 Render 部署的時序和憑證問題

// =========================================================
// 1. 載入必要的函式庫和資料模型 (包含 Dotenv)
// =========================================================
import * as dotenv from 'dotenv'; 
dotenv.config(); // ❗ 確保在所有 process.env 讀取之前執行

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { OpenAI } from "openai";
import mongoose from 'mongoose'; 
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import MongoStore from 'connect-mongo'; // ✅ 放在這裡

// =========================================================
// 🚀 啟動檢查用 Log（用來確認 Render 執行的是這個檔案）
// =========================================================
console.log("🚀 server.js is running and handling requests!");

// 載入資料模型
import ChatLog from './models/ChatLog.js';     
import Character from './models/Character.js'; 


// =========================================================
// 2. 環境變數定義 (只讀取 process.env)
// =========================================================
const PORT = 3000; 

// 核心憑證
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

// 部署與 CORS 相關變數
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL; 

// ❗ 關鍵修正：將逗號分隔的字串轉換為陣列，用於 CORS 檢查
const ALLOWED_ORIGINS_STRING = process.env.ALLOWED_ORIGINS_STRING;
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING ? ALLOWED_ORIGINS_STRING.split(',') : [];

// 測試用 ID (確保在本地和部署時，所有 ID 都已經被替換為變數或真實值)
const TARGET_CHARACTER_ID = "6914b57be382ade03c24cfda"; 

// 宣告變數 (不賦值)，以便在所有配置完成後，安全地實例化
let openai;
// let mongooseModel; // Mongoose 模型不需要這樣，它會被 export default 處理


// =========================================================
// 3. 應用程式初始化與資料庫連線
// =========================================================
const app = express();
app.set('trust proxy', 1);

// 資料庫連線
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 連線成功!'))
  .catch(err => console.error('❌ MongoDB 連線失敗:', err));


// =========================================================
// 4. Passport 驗證配置 (只定義邏輯)
// =========================================================

// 配置：將用戶資訊 (Google ID) 存入 Session
passport.serializeUser((user, done) => {
    done(null, user); 
});

// 配置：從 Session 中讀取用戶資訊
passport.deserializeUser((user, done) => {
    const finalUser = {
        id: user.id, // Google ID
        displayName: user.displayName || user.name.givenName || user.name, 
    };
    done(null, finalUser); 
});


// =========================================================
// 5. 設定中介軟體 (Middleware) - 修正版
// =========================================================
app.set('trust proxy', 1);

// ✅ 1. CORS（放寬判斷 + 確保 Google 可通過）
app.use(cors({
  origin: true,
  credentials: true,
}));

// ✅ 2. body-parser 限制型
app.use(bodyParser.json({ limit: '1mb', type: 'application/json' }));

// ✅ 3. session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 天有效
  }),
  cookie: {
    sameSite: 'None',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
  }
}));

// ✅ 4. passport
app.use(passport.initialize());
app.use(passport.session());

// 4. 啟用 Passport
app.use(passport.initialize());
app.use(passport.session());

// 根目錄路由 (處理所有找不到其他路由的請求)
app.get('/', (req, res) => {
    res.send('<h1>歡迎來到 AI 應用程式後端</h1><p>請通過前端網頁存取服務。</p>');
});

// =========================================================
// ❗ ❗ ❗ 6. 安全區塊：延後實例化 ❗ ❗ ❗
// 確保在所有環境變數和中介軟體配置完成後，才實例化需要憑證的類別
// =========================================================

// 實例化 OpenAI (確保它在 dotenv.config() 之後)
openai = new OpenAI({ apiKey: OPENAI_API_KEY }); 

// 實例化 Passport 策略
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://ai-chat-backend-service.onrender.com/auth/google/callback',
},
(accessToken, refreshToken, profile, done) => {
    console.log("🎯 GoogleStrategy 被觸發", profile?.displayName);
    return done(null, profile);
}));


// =========================================================
// 7. API 路由 (確保所有路由都在實例化之後)
// =========================================================

// ---------------------------------------------
// A. 路由保護函數定義 (必須在所有 app.get/app.post 之前)
// ---------------------------------------------

const ensureAuthenticated = (req, res, next) => {
    // 如果用戶已登入，繼續執行路由
    if (req.isAuthenticated()) {
        return next();
    }
    // 如果未登入，導向根目錄（Express 會導向首頁 HTML）
    res.redirect('/');
};


// ---------------------------------------------
// B. 登入/登出核心路由 (不需要 ensureAuthenticated)
// ---------------------------------------------

// 1. 啟動 Google 登入流程 (你點擊按鈕後導向這裡)
app.get('/auth/google', (req, res, next) => {
  console.log("🚦 /auth/google 被呼叫");
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }), (req, res) => {
  console.log("⚠️ passport.authenticate 沒有 redirect (這不應該發生)");
  res.send("未進入 Google OAuth 流程");
});


// 2. Google 驗證成功後的回調路徑（加上日誌）
app.get('/auth/google/callback', (req, res, next) => {
  console.log("🌀 Google callback triggered:", req.query);
  next();
}, passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  console.log("✅ Google login success, user:", req.user);
  res.redirect(FRONTEND_BASE_URL);
});

// 3. 登出路由
app.get('/auth/logout', (req, res, next) => {
    // 步驟 1: 呼叫 req.logout 移除 req.user
    req.logout((err) => {
        if (err) { 
            console.error("❌ Passport 登出失敗:", err);
            return next(err);
        }
        
        // 步驟 2: 銷毀 Session，這會將 Session 從 MongoDB 移除
        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Session 銷毀失敗:", err);
                return next(err);
            }
            
            // 步驟 3: (可選，但安全起見) 清除瀏覽器端的 Cookie
            // 通常 req.session.destroy 會自動處理，但針對跨域問題，明確清除更保險
            res.clearCookie('connect.sid', { 
                sameSite: 'None', 
                secure: true, 
                path: '/' 
            });

            console.log("✅ 成功登出並銷毀 Session");
            // 步驟 4: 導回前端
            res.redirect('https://ababc130.github.io/desktop-tutorial/'); 
        });
    });
});


// ---------------------------------------------
// C. 受保護的應用程式路由 (需要 ensureAuthenticated)
// ---------------------------------------------

// 4. 登入成功後的頁面 (前端檢查 Session 使用)
app.get('/success', ensureAuthenticated, (req, res) => {
    // ❗ 修正：回傳 JSON，以避免 Render 上的 HTML 格式錯誤
    res.json({
        isLoggedIn: true,
        displayName: req.user.displayName,
        id: req.user.id
    });
});

// 5. 聊天 API 路由 
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
    // ❗ 這裡的邏輯需要您補齊，但結構是正確的
    // ... (讀取歷史紀錄、調用 openai、儲存紀錄的邏輯) ...
    res.status(501).json({ error: "聊天邏輯尚未實作或載入" }); 
});

// 6. 根目錄路由 (如果找不到其他路由，會導向這裡)
app.get('/', (req, res) => {
    res.send('<h1>歡迎來到 AI 應用程式後端</h1><p>請通過前端網頁存取服務。</p>');
});

// =========================================================
// 8. 啟動伺服器
// =========================================================

// ❗ 關鍵修正：使用 Render 環境提供的 PORT 變數，如果沒有則使用 3000 (用於本地測試)
const HOST_PORT = process.env.PORT || PORT; 

app.listen(HOST_PORT, () => {
    // 讓 Log 顯示正確的 Port，方便除錯
    console.log(`✅ 後端伺服器已啟動並在 Port ${HOST_PORT} 運行`);
});