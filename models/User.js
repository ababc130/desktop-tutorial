// models/User.js (新檔案)

import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    // 儲存 Google 提供的唯一 ID
    googleId: {
        type: String,
        required: true,
        unique: true, // 確保每個 Google 帳號只有一個 User 紀錄
    },
    displayName: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // 收藏的角色 ID 列表 (儲存 Character model 的 _id)
    favoriteCharacters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Character'
    }]
});

const User = mongoose.model('User', UserSchema);

export default User;