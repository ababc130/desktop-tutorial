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
// 5. 設定中介軟體 (Middleware) - 順序必須正確
// =========================================================

// 1. CORS - 必須是第一個，並使用彈性邏輯
app.use(cors({
    origin: (origin, callback) => {
        // 允許：沒有來源(Postman) 或 來源包含在白名單陣列中
        if (!origin || ALLOWED_ORIGINS.some(allowed => allowed.trim() === origin)) {
            callback(null, true);
        } else {
            console.error(`CORS 拒絕連線：${origin}`); 
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// 2. Body Parser - 處理 JSON
app.use(bodyParser.json());

// 3. Session 配置 (放在 Passport 初始化之前)
app.use(session({
    secret: SESSION_SECRET,
    resave: false, 
    saveUninitialized: false, 
    cookie: {
        sameSite: 'None', 
        secure: true,   
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

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
    callbackURL: 'http://localhost:3000/auth/google/callback', // 部署時使用 Render URL
},
async (accessToken, refreshToken, profile, done) => {
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
app.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
);

// 2. Google 驗證成功後的回調路徑
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }), 
    (req, res) => {
        // 驗證成功，導回前端應用程式
        res.redirect(FRONTEND_BASE_URL); 
    }
);

// 3. 登出路由
app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        // 登出成功，導回前端
        res.redirect(FRONTEND_BASE_URL); 
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

app.listen(PORT, () => {
    console.log(`✅ 後端伺服器已啟動並在 http://localhost:${PORT} 運行`);
});