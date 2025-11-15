// server.js - 最終版本：解決 Render 部署的時序和憑證問題

// =========================================================
// 1. 載入必要的函式庫和資料模型 (包含 Dotenv)
// =========================================================
import * as dotenv from 'dotenv'; 
dotenv.config(); // ❗ 確保在所有 process.env 讀取之前執行

import User from './models/User.js'; // ❗ 新增
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { OpenAI } from "openai";
import mongoose from 'mongoose'; 
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import MongoStore from 'connect-mongo'; // ✅ 放在這裡
import path from 'path'; 
import { fileURLToPath } from 'url';

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

// 管理員
const ADMIN_GOOGLE_ID = process.env.ADMIN_GOOGLE_ID;

// 由於使用 ESM，需要手動定義 __filename 和 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 部署與 CORS 相關變數
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL; 

// ❗ 關鍵修正：將逗號分隔的字串轉換為陣列，用於 CORS 檢查
const ALLOWED_ORIGINS_STRING = process.env.ALLOWED_ORIGINS_STRING;
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING ? ALLOWED_ORIGINS_STRING.split(',') : [];


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
// 5. 設定中介軟體 (Middleware) - 最終修正版
// =========================================================

app.set('trust proxy', 1); // 信任代理，處理 HTTPS

// 1. CORS：必須在處理 Session 之前
app.use(cors({
    origin: true, // 允許所有 origin (你的配置，或者你可以更嚴謹)
    credentials: true, // 允許 Cookie 跨域傳輸
}));

// 2. body-parser
app.use(bodyParser.json({ limit: '1mb', type: 'application/json' }));

// 3. session
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 24 * 60 * 60 // 1 天有效
    }),
    cookie: {
        path: '/',
        sameSite: 'None',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24,
    }
}));

// 4. passport 初始化 (依賴 Session)
app.use(passport.initialize());
app.use(passport.session());

// ❗ 靜態檔案服務：讓 Express 伺服器知道去根目錄找檔案
app.use(express.static(__dirname));

// =========================================================
// ❗ ❗ ❗ 6. 安全區塊：延後實例化 ❗ ❗ ❗
// 確保在所有環境變數和中介軟體配置完成後，才實例化需要憑證的類別
// =========================================================

// 實例化 OpenAI (確保它在 dotenv.config() 之後)
openai = new OpenAI({ apiKey: OPENAI_API_KEY }); 

// 實例化 Passport 策略
passport.use(new GoogleStrategy({
    // ...
},
async (accessToken, refreshToken, profile, done) => {
    // ❗ 核心修正：檢查用戶是否存在於資料庫
    let currentUser = await User.findOne({ googleId: profile.id });

    if (!currentUser) {
        // 如果不存在，則創建新用戶
        currentUser = await new User({
            googleId: profile.id,
            displayName: profile.displayName,
        }).save();
    }

    // 將用戶資訊傳給 Passport 處理
    return done(null, currentUser); 
}));


// =========================================================
// 7. API 路由 (確保所有路由都在實例化之後)
// =========================================================

// ---------------------------------------------
// A. 路由保護函數定義 (必須在所有 app.get/app.post 之前)
// ---------------------------------------------    

// server.js - 修正後的路由保護函數
const ensureAuthenticated = (req, res, next) => {
    // 如果用戶已登入，繼續執行路由
    if (req.isAuthenticated()) {
        return next();
    }
    
    // ❗ 關鍵修正：對於 API 請求，應該回傳 401 Unauthorized
    // 而不是導向 HTML 頁面
    res.status(401).json({ 
        error: "Unauthorized", 
        message: "請先登入才能存取此資源。" 
    });
    
    // 如果你絕對需要導向，請確保在前端處理 401 狀態碼
    // res.redirect('/'); // 刪除或註釋掉這行
};

// server.js - 管理員保護函數
const ensureAdmin = (req, res, next) => {
    // 1. 先確認是否已登入 (req.isAuthenticated())
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized", message: "請先登入才能存取此管理資源。" });
    }

    // 2. 檢查 Google ID 是否為管理員 ID
    // ❗ 這裡的 ADMIN_GOOGLE_ID 必須和你的 Google ID 匹配
    if (req.user.id !== ADMIN_GOOGLE_ID) {
        // 如果 ID 不匹配，則拒絕存取
        console.warn(`❌ 拒絕非管理員存取: ${req.user.displayName} (ID: ${req.user.id})`);
        return res.status(403).json({ error: "Forbidden", message: "您沒有存取此管理功能的權限。" });
    }

    // ID 匹配，允許存取
    return next();
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

// 7. 管理員：獲取所有角色列表 API (用於後台表格資料來源)
app.get('/api/admin/characters', ensureAdmin, async (req, res) => {
    try {
        // 讀取 Character model 中的所有數據
        const characters = await Character.find({}); 
        
        // 額外資訊：我們將用戶的 Google ID 轉換為字串，因為 req.user.id 是字串
        const userId = req.user.id; 
        
        // 這裡可以加入邏輯：如果不是超級管理員，則只顯示該用戶自己的角色
        // 但目前我們使用 ensureAdmin，所以直接返回所有角色
        
        res.json(characters);
    } catch (error) {
        console.error('❌ 獲取角色列表失敗:', error);
        res.status(500).json({ error: '無法獲取角色列表。' });
    }
});

// 9. 用戶：創建新角色 API
// ❗ 使用 ensureAuthenticated 確保任何已登入用戶都能存取
app.post('/api/character/create', ensureAuthenticated, async (req, res) => {
    try {
        // 從請求中取得前端傳來的新角色資訊
        const { name, systemPrompt, description } = req.body;
        
        // 確保核心欄位存在
        if (!name || !systemPrompt) {
            return res.status(400).json({ error: '角色名稱和性格(System Prompt)為必填欄位。' });
        }
        
        // 創建 Mongoose 文件
        const newCharacter = await Character.create({
            name: name,
            systemPrompt: systemPrompt,
            description: description, 
            
            // 欄位 1: 專屬編號 (使用登入用戶的 Google ID 作為角色作者 ID)
            creatorId: req.user.id, 
            // 欄位 2: 作者名稱
            creatorName: req.user.displayName,
        });

        console.log(`✅ 新角色已創建: ${newCharacter.name} (作者: ${req.user.displayName})`);
        res.status(201).json({ 
            message: '角色創建成功', 
            characterId: newCharacter._id 
        });

    } catch (error) {
        // 處理 Mongoose 的唯一索引錯誤 (通常是角色名稱重複)
        if (error.code === 11000) { 
             return res.status(409).json({ error: '角色名稱已存在，請換一個名稱。' });
        }
        console.error('❌ 創建角色失敗:', error);
        res.status(500).json({ error: '後端創建角色時發生錯誤。' });
    }
});

// 10. 獲取單個角色資料 API (任何已登入用戶可存取)
app.get('/api/character/:id', ensureAuthenticated, async (req, res) => {
    try {
        const characterId = req.params.id;
        const userId = req.user.googleId; // ❗ 從 Passport 讀取 Google ID (User Model 使用 googleId)

        // 查詢角色資料
        const character = await Character.findById(characterId);
        
        if (!character) {
            return res.status(404).json({ error: '找不到指定的角色 ID' });
        }

        // 查找用戶紀錄，並檢查收藏狀態
        const user = await User.findOne({ googleId: userId }); 
        
        let isFavorite = false;
        if (user) {
            // 檢查角色的 ID 是否存在於用戶的 favoriteCharacters 陣列中
            isFavorite = user.favoriteCharacters.map(id => id.toString()).includes(characterId);
        }
        
        // 返回角色的公開資訊 和 收藏狀態
        res.json({
            id: character._id,
            name: character.name,
            description: character.description,
            systemPrompt: character.systemPrompt,
            isFavorite: isFavorite // ❗ 新增：告訴前端是否已收藏
        });

    } catch (error) {
        console.error('❌ 獲取角色詳情失敗:', error);
        res.status(500).json({ error: '後端服務錯誤。' });
    }
});

// 11. 用戶：獲取特定角色聊天歷史紀錄 API
// ❗ 任何人登入後，可讀取自己與該角色的歷史紀錄
app.get('/api/chat/history/:characterId', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const characterId = req.params.characterId;

        // ❗ 核心修正：使用 ChatLog.find() 查詢所有匹配的紀錄，並按時間排序
        const historyLogs = await ChatLog.find({ userId, characterId })
            .sort({ createdAt: 1 }); // 1 = 升序，確保最舊的訊息在最前面

        if (!historyLogs || historyLogs.length === 0) {
            // 如果沒有找到任何記錄，返回空陣列
            return res.json([]); 
        }

        // 返回所有歷史紀錄 (這會被前端的 loadChatHistory() 接收)
        res.json(historyLogs);

    } catch (error) {
        // 確保錯誤被捕捉，並打印到 Render 日誌
        console.error('❌ 獲取聊天歷史紀錄失敗:', error); 
        res.status(500).json({ error: '後端服務錯誤：無法讀取歷史訊息。' });
    }
});

// 12. 用戶：收藏或取消收藏角色 API
app.post('/api/user/favorite/:characterId', ensureAuthenticated, async (req, res) => {
    try {
        const characterId = req.params.characterId;
        const userId = req.user.id; // 從 Passport 取得 Google ID

        // 查找用戶紀錄
        const user = await User.findOne({ googleId: userId });

        if (!user) {
            return res.status(404).json({ error: '找不到使用者紀錄' });
        }

        const isFavorite = user.favoriteCharacters.includes(characterId);

        if (isFavorite) {
            // 取消收藏：從陣列中移除 ID
            user.favoriteCharacters.pull(characterId);
            await user.save();
            return res.json({ message: '已取消收藏', isFavorite: false });
        } else {
            // 收藏：將 ID 加入陣列
            user.favoriteCharacters.push(characterId);
            await user.save();
            return res.json({ message: '已成功收藏', isFavorite: true });
        }
    } catch (error) {
        console.error('❌ 收藏操作失敗:', error);
        res.status(500).json({ error: '收藏服務處理失敗。' });
    }
});

// 5. 聊天 API 路由 
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
    // 1. 獲取真實的用戶 ID
    const userId = req.user.id; // 來自 Google 登入的真實唯一 ID
    
    // 2. 獲取角色 ID 和用戶訊息 (使用硬編碼 ID，這是目前的方法)
    const { message, characterId } = req.body; // 👈 這裡從 req.body 讀取 characterId

    if (!message || !characterId) {
        // 檢查 characterId 是否存在
        return res.status(400).json({ error: '缺少訊息內容或角色 ID' });
    }

    const targetCharacterId = characterId;

    try {
        // ❗ ❗ ❗ 診斷日誌：確認用戶 ID 和目標 ID ❗ ❗ ❗
        console.log(`[Chat Debug] User ID: ${userId}, Character ID: ${targetCharacterId}`);

        // 3. 獲取角色設定 (System Prompt)
        const character = await Character.findById(targetCharacterId);
        if (!character) {
            return res.status(404).json({ error: '找不到指定的角色。' });
        }
        const systemPrompt = character.systemPrompt;

        // 4. 讀取最近的歷史對話 (短期記憶)
        const historyLogs = await ChatLog.find({ 
            userId: userId, 
            characterId: targetCharacterId 
        })
        .sort({ createdAt: -1 }) 
        .limit(10); 

        // ❗ ❗ 診斷日誌 2：確認是否成功載入歷史紀錄 ❗ ❗
        console.log(`[Chat Debug] Retrieved history logs count: ${historyLogs.length}`);

        // 轉換歷史紀錄 (從舊到新排列)
        const historyMessages = historyLogs.reverse().map(log => ({
            role: log.role, // 確保這裡使用 'user' 或 'assistant'
            content: log.content,
        }));

        // 5. 組合完整的 Messages 陣列給 AI
        const messages = [
            { role: "system", content: systemPrompt }, 
            ...historyMessages,                        
            { role: "user", content: message }         
        ];

        // 6. 呼叫 OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
        });

        const aiResponseContent = completion.choices[0].message.content;

        // 7. 儲存新的對話紀錄 (實現記憶體)
        await ChatLog.create({
            userId: userId,
            characterId: targetCharacterId,
            role: 'user',
            content: message,
        });
        await ChatLog.create({
            userId: userId,
            characterId: targetCharacterId,
            role: 'assistant', // 確保使用 'assistant'
            content: aiResponseContent,
        });

        // 8. 將 AI 的回覆送回給網頁
        res.json({ response: aiResponseContent });

    } catch (error) {
        // ❗ 如果是 OpenAI 錯誤或資料庫錯誤，會在 Render 日誌中顯示
        console.error("❌ 聊天處理失敗:", error); 
        res.status(500).json({ error: '後端聊天服務處理失敗，請檢查日誌。' });
    }
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