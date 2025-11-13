// models/ChatLog.js

import mongoose from 'mongoose';

// 定義聊天紀錄的資料庫結構
const ChatLogSchema = new mongoose.Schema({
    // 1. 識別哪位使用者 (User ID)
    // 之後串接 Google 登入後，我們會用這個 ID 來區分不同的使用者
    userId: { 
        type: String, 
        required: true,
        index: true, 
    },
    
    // 2. 識別正在跟哪個角色聊天 (Character ID)
    characterId: { 
        type: mongoose.Schema.Types.ObjectId, // 這裡儲存 Character Model 的 ID
        ref: 'Character', // 指向 Character Model
        required: true,
        index: true,
    },

    // 3. 訊息發送者 (role)
    // 'user' 代表使用者輸入，'assistant' 代表 AI 回覆
    role: {
        type: String,
        enum: ['user', 'assistant'], // 只能是這兩種值
        required: true,
    },

    // 4. 訊息內容
    content: {
        type: String,
        required: true,
    },
}, {
    // 讓 MongoDB 自動記錄這條訊息產生的時間
    timestamps: true 
});

// 匯出模型
const ChatLog = mongoose.model('ChatLog', ChatLogSchema);
export default ChatLog;