// server.js - 整合了 AI 核心、MongoDB 連線、角色創建和短期記憶體

// =========================================================
// 1. 載入必要的函式庫和資料模型
// =========================================================
import * as dotenv from 'dotenv'; // 載入 dotenv 套件
dotenv.config(); // 讀取 .env 檔案的內容，並加載到 process.env 變數中
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { OpenAI } from "openai";
import mongoose from 'mongoose'; 
import ChatLog from './models/ChatLog.js';     // 聊天紀錄模型 (短期記憶)
import Character from './models/Character.js'; // 角色資料模型
import passport from 'passport'; // google相關登入
import session from 'express-session'; // google相關登入
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // google相關登入
import ChatHistory from './models/ChatHistory.js';

// =========================================================
// 2. 環境變數設定 (請替換為你的真實值)
// =========================================================
const PORT = 3000; 

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;


// ❗ 測試用：請替換成你用 Thunder Client 創建角色後拿到的真實 Character _id 字串
const TARGET_CHARACTER_ID = "6914b57be382ade03c24cfda"; 

// ❗ 這是 Live Server 啟動的網址
const ALLOWED_ORIGINS_STRING = process.env.ALLOWED_ORIGINS_STRING;
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING ? ALLOWED_ORIGINS_STRING.split(',') : [];
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;


// =========================================================
// 3. 應用程式初始化與資料庫連線
// =========================================================
const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 資料庫連線
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 連線成功!'))
  .catch(err => console.error('❌ MongoDB 連線失敗:', err));


// =========================================================
// 4. Passport 驗證配置
// =========================================================

// 配置：將用戶資訊 (Google ID) 存入 Session
passport.serializeUser((user, done) => {
    // 這裡 user 是一個 Google profile 物件
    // ❗ 保持將整個 profile 存入，以利後續取出 displayName
    done(null, user); 
});

// 配置：從 Session 中讀取用戶資訊
passport.deserializeUser((user, done) => {
    // 這裡的 user 是從 Session 讀出的完整 profile 物件
    // ❗ 確保傳給 done 的物件具有 id 和 displayName 屬性
    // 確保這裡的 displayName 是正確的 Google 名字
    
    // 檢查 Google profile 的 displayName 是否在頂層
    const finalUser = {
        id: user.id, // Google ID
        displayName: user.displayName || user.name.givenName || user.name, // 確保取出名字
    };
    
    done(null, finalUser); // 傳遞具有正確屬性的物件
});

// 配置 Google OAuth 策略
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    // ❗ 確保這裡的 callbackURL 必須是 localhost
    callbackURL: 'http://localhost:3000/auth/google/callback', 
},
async (accessToken, refreshToken, profile, done) => {
    // 驗證成功後，這裡可以寫入 Mongoose 程式碼來處理用戶資料庫的創建/更新
    // 暫時直接傳回 Google 的 profile
    return done(null, profile);
}));


// =========================================================
// 5. 設定中介軟體 (Middleware) - Session, Passport, BodyParser
// =========================================================

// server.js (修正後的順序)

// 1. CORS - 必須是第一個處理跨域問題的
app.use(cors({
    origin: (origin, callback) => {
        // 允許：
        // 1. 請求沒有來源 (例如：本地 Postman 測試)
        // 2. 來源在 ALLOWED_ORIGINS 陣列中 (經過 trim() 處理，確保沒有空格)
        if (!origin || ALLOWED_ORIGINS.some(allowed => allowed.trim() === origin)) {
            callback(null, true);
        } else {
            console.error(`CORS 拒絕連線：${origin}`); 
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// 2. Body Parser - 處理所有請求的內文
app.use(bodyParser.json());


// 3. Session 配置 (放在 Passport 初始化之前)
app.use(session({
    secret: SESSION_SECRET,
    // ❗ 修正：明確設定為 false
    resave: false, 
    // ❗ 修正：明確設定為 false
    saveUninitialized: false, 
    cookie: {
        sameSite: 'lax', 
        secure: false,   
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// 4. 啟用 Passport
app.use(passport.initialize());
app.use(passport.session());


// =========================================================
// 6. 登入/登出 API 路由
// =========================================================

// 導向 Google 登入頁面
app.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
);

// Google 驗證成功後的回調路徑
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }), 
    (req, res) => {
        // ❗ 使用修正後的 BASE URL
        res.redirect(FRONTEND_BASE_URL); 
    }
);

// 登出
app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        
        // ❗ 修正：將使用者直接導向前端應用程式的完整網址
        res.redirect(FRONTEND_BASE_URL); 
    });
});

// 登入狀態檢查路由 (這是你的自訂中介軟體)
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    // 如果未登入，導向首頁
    res.redirect('/');
};

// 登入成功後的頁面 (使用 ensureAuthenticated 來保護)
app.get('/success', ensureAuthenticated, (req, res) => {
    res.send(`
        <h1>登入成功！</h1>
        <p>歡迎, ${req.user.displayName} (您的ID: ${req.user.id})</p>
        <p>現在您可以開始使用應用程式功能了。</p>
        <p>此 ID (${req.user.id}) 將取代程式碼中的 TEMPORARY_USER_ID。</p>
        <a href="/auth/logout">登出</a>
    `);
}); // <-- 確保這裡的結尾是 });


// =========================================================
// 7. API 路由 - 角色創建 (使用真實的用戶 ID)
// =========================================================

// ❗ 確保用戶已登入才能創建角色
app.post('/api/characters', ensureAuthenticated, async (req, res) => {
    // 獲取登入用戶的真實 ID 和名稱
    const creatorId = req.user.id; 
    const creatorName = req.user.displayName; 
    
    const { name, description, systemPrompt } = req.body;
    // ... (後續驗證與儲存邏輯與之前相同)

    if (!name || !description || !systemPrompt) {
        return res.status(400).json({ error: '角色名稱、描述和核心設定不能為空。' });
    }

    try {
        const newCharacter = new Character({
            creatorId: creatorId, // <--- 使用真實 ID
            creatorName: creatorName, // <--- 使用真實名稱
            name,
            description,
            systemPrompt,
        });

        const savedCharacter = await newCharacter.save();

        res.status(201).json({ 
            message: "角色創建成功！",
            character: savedCharacter 
        });

    } catch (error) {
        if (error.code === 11000) { 
             return res.status(409).json({ error: '角色名稱已存在，請換一個名稱。' });
        }
        console.error("角色創建失敗:", error);
        res.status(500).json({ error: '伺服器儲存角色資料時發生錯誤。' });
    }
});


// =========================================================
// 8. API 路由 - 聊天與短期記憶體 (使用真實的用戶 ID)
// =========================================================

// ❗ 確保用戶已登入才能聊天
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
    try {
        // 1. 確保登入用戶 ID 和目標角色 ID
        const userId = req.user.id; // 從 Passport 取得登入用戶 ID
        // 由於我們還沒有前端傳入角色 ID 的邏輯，這裡先硬編碼
        const characterId = '6914ddea9d8fafba3f01368d'; 
        const { message } = req.body; // 從前端取得最新訊息

        // 2. 角色設定 (系統提示) - 確保它在你的程式碼頂部有定義
        const SYSTEM_PROMPT = "你是一位充滿活力和幽默感的超級英雄，名字叫「雷霆使者」..."; // 確保這段程式碼在頂部定義

        // 3. 讀取歷史紀錄
        let chatRecord = await ChatHistory.findOne({ userId, characterId });
        
        // 如果沒有紀錄，則創建一個新的紀錄
        if (!chatRecord) {
            chatRecord = new ChatHistory({ userId, characterId, history: [] });
        }

        // 4. 建構發送給 Gemini API 的訊息陣列
        let messages = [];

        // 4.1. 添加系統提示（作為第一條訊息，設定 AI 個性）
        messages.push({ role: 'system', content: SYSTEM_PROMPT });

        // 4.2. 添加歷史紀錄
        // ⚠️ 這裡要確保歷史紀錄的 role 匹配 Gemini/OpenAI 格式 ('user', 'model')
        messages.push(...chatRecord.history.map(msg => ({ 
            role: msg.role === 'model' ? 'assistant' : 'user', // 將 model 轉換為 assistant
            content: msg.content 
        })));
        
        // 4.3. 添加最新用戶訊息
        messages.push({ role: 'user', content: message });
        
        // 5. ❗ 這裡呼叫你的 Gemini 或 OpenAI API，並使用這個 messages 陣列
        // 由於你還在使用 OpenAI 格式，我們這裡假設你使用 OpenAI
        
        // --- 呼叫 OpenAI API (或你現在使用的模型) ---
        const completion = await openai.chat.completions.create({
             model: "gpt-3.5-turbo", // 或你設定的 Gemini 模型名稱
             messages: messages, // ❗ 傳入帶有歷史紀錄的 messages
        });
        
        const assistantResponse = completion.choices[0].message.content;
        
        // 6. 儲存最新訊息到歷史紀錄
        // 6.1. 儲存用戶訊息 (使用你資料庫的 role: 'user')
        chatRecord.history.push({ role: 'user', content: message });
        
        // 6.2. 儲存 AI 回應 (使用你資料庫的 role: 'model')
        chatRecord.history.push({ role: 'model', content: assistantResponse });

        // 6.3. 儲存到資料庫
        await chatRecord.save();
        
        // 7. 返回回應給前端
        res.json({ response: assistantResponse });

    } catch (error) {
        console.error('聊天 API 錯誤:', error);
        res.status(500).json({ error: '聊天處理失敗' });
    }
});

// =========================================================
// 9. 啟動伺服器
// =========================================================

app.listen(PORT, () => {
    console.log(`✅ 後端伺服器已啟動並在 http://localhost:${PORT} 運行`);
});