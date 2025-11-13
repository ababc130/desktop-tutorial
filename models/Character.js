// models/Character.js

import mongoose from 'mongoose';

// 定義角色的資料庫結構 (Schema)
const CharacterSchema = new mongoose.Schema({
    // 1. 創作者資訊 (用於 Google 登入後判斷誰擁有這個角色)
    creatorId: {
        type: String, // 儲存 Google 的 User ID
        required: true,
        index: true, // 建立索引，方便查找
    },
    creatorName: {
        type: String, // 儲存創作者的名稱
        required: true,
    },

    // 2. 角色基本資訊 (公開資訊)
    name: {
        type: String,
        required: true,
        unique: true, // 確保角色的名稱是唯一的
        trim: true, // 移除前後的空白字元
    },
    description: {
        type: String, // 給其他玩家看的簡短介紹
        required: true,
    },
    
    // 3. AI 核心設定 (System Prompt 的主要內容)
    // 這是讓 AI 保持個性的「劇本」
    systemPrompt: {
        type: String, 
        required: true,
        // 這個欄位儲存我們之前討論的「核心個性」+「對話風格」
    },
    
    // 4. 遊戲性/計數器
    playCount: {
        type: Number,
        default: 0, // 預設遊玩次數為 0
    },
}, {
    // 自動管理創建時間和更新時間
    timestamps: true 
});

// 匯出模型，讓其他檔案可以使用它來操作資料庫
const Character = mongoose.model('Character', CharacterSchema);

export default Character;