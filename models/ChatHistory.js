// models/ChatHistory.js

import mongoose from 'mongoose';

const ChatHistorySchema = new mongoose.Schema({
    // 儲存聊天紀錄所屬的用戶 ID (從 req.user.id 取得)
    userId: {
        type: String,
        required: true
    },
    // 儲存聊天紀錄所屬的角色 ID
    characterId: {
        type: String, 
        required: true
    },
    // 儲存所有訊息的陣列
    history: [{
        // 誰發的訊息：'user' 或 'model'
        role: {
            type: String,
            enum: ['user', 'model'],
            required: true
        },
        // 訊息內容
        content: {
            type: String,
            required: true
        },
        // 訊息時間
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { 
    // 設定 timestamps: true 會自動添加 createdAt 和 updatedAt 欄位
    timestamps: true 
});

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
export default ChatHistory;