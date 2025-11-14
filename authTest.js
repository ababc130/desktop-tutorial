// authTest.js - 最小化部署測試

import express from 'express';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as dotenv from 'dotenv'; 
dotenv.config(); 

const TEST_PORT = 10000; // ❗ 確保在本地和部署上 Port 都可以使用

// 部署環境變數 (必須從 process.env 讀取，並假設在 Render 後台已設置)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET; 

// 部署目標 URL (硬編碼確保正確性)
const RENDER_CALLBACK_URL = 'https://ai-chat-backend-service.onrender.com/auth/google/callback';
const RENDER_PUBLIC_URL = 'https://ai-chat-backend-service.onrender.com'; // 應用程式的根目錄


// 應用程式實例化與配置 (最小化)
const app = express();
app.set('trust proxy', 1); // 信任代理，處理 HTTPS

// Passport 邏輯
passport.serializeUser((user, done) => { done(null, user); });
passport.deserializeUser((user, done) => { done(null, user); });

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: RENDER_CALLBACK_URL, // ❗ 使用 Render URL
},
(accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// 中介軟體
app.use(session({ 
    secret: SESSION_SECRET, 
    resave: false, 
    saveUninitialized: false, 
    cookie: {
        secure: true,   // ❗ 必須：HTTPS
        sameSite: 'None', // ❗ 必須：跨域
        maxAge: 1000 * 60 * 60 * 24 
    }
}));
app.use(passport.initialize());
app.use(passport.session());


// ---------------------------------------------
// 測試路由
// ---------------------------------------------

// 1. 啟動登入
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. 回調路由
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }), 
    (req, res) => {
        // 成功後導向簡單的成功頁面
        res.send(`<h1>部署測試成功！</h1><p>名字: ${req.user.displayName}</p>`); 
    }
);

// 3. 根目錄 (顯示登入連結)
app.get('/', (req, res) => {
    res.send(`<h1>最小化部署測試服務</h1><a href="${RENDER_PUBLIC_URL}/auth/google">點擊這裡 Google 登入</a>`);
});


// 啟動伺服器
app.listen(TEST_PORT, () => {
    console.log(`✅ 測試服務已啟動: http://localhost:${TEST_PORT}`);
});