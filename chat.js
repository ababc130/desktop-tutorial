// script.js - 最終版本：結構修正、動態 URL、載入歷史紀錄

// ===================================================
// 1. 變數和常量定義
// ===================================================

let currentCharacterName = 'AI 助理'; // 預設值，以防萬一
const RENDER_BACKEND_URL = 'https://ai-chat-backend-service.onrender.com';
const CHAT_ENDPOINT = '/api/chat';

// 核心邏輯：動態判斷目前網頁運行的環境
const BACKEND_URL = window.location.hostname.includes('github.io')
    ? RENDER_BACKEND_URL     // 如果在 GitHub Pages 上運行，連線到 Render
    : 'http://localhost:3000'; // 如果在本地運行，連線到 Port 3000

// 獲取角色 ID
function getCharacterIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}
const CHARACTER_ID = getCharacterIdFromUrl();


// 獲取 DOM 元素
const authStatus = document.getElementById('auth-status');
const chatWindow = document.getElementById('chat-window');
const chatInputForm = document.getElementById('chat-input-form');
const messageInput = document.getElementById('message-input');
const characterIdDisplay = document.getElementById('character-id-display'); // 顯示角色名稱/ID


// ===================================================
// 2. 輔助函數 (Helpers)
// ===================================================

// 輔助函數：渲染訊息到聊天視窗
function appendMessage(sender, text) {
    const messageElement = document.createElement('div');
    // 注意：你可能需要調整 class 名稱
    messageElement.classList.add('message', sender === 'user' ? 'user' : 'ai'); 
    
    // ❗ 核心修正：根據 sender 顯示名稱
    const senderName = sender === 'user' ? '你' : currentCharacterName; // 使用全域變數
    
    messageElement.innerHTML = `<strong>${senderName}:</strong> ${text}`;
    
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; 
}

// 輔助函數：顯示訊息到聊天視窗 (用於系統訊息，例如錯誤)
function displayMessage(role, content) {
    appendMessage(role, content);
}


// ===================================================
// 3. 核心功能函數 (Core Functions)
// ===================================================

async function loadCharacterDetails() {
    if (!CHARACTER_ID || CHARACTER_ID.includes('請手動替換')) {
        characterIdDisplay.textContent = '❌ 請在網址中提供角色 ID (例如: ?id=xxx)';
        // 失敗時，確保名稱使用預設值
        currentCharacterName = 'AI 助理'; 
        return null;
    }

    try {
        const url = `${BACKEND_URL}/api/character/${CHARACTER_ID}`;
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            // 如果是 404/401，則顯示錯誤
            characterIdDisplay.textContent = `❌ 無法載入角色。錯誤碼: ${response.status}。請確認 ID 或是否已登入。`;
            // 失敗時，確保名稱使用預設值
            currentCharacterName = 'AI 助理'; 
            return null;
        }

        const characterData = await response.json();
        
        // ❗ 核心修正：儲存載入的角色名稱到全域變數
        currentCharacterName = characterData.name; 
        
        // 修正：將標題改為顯示角色名稱
        characterIdDisplay.innerHTML = `角色：<strong>${currentCharacterName}</strong>`; 
        
        // 返回 System Prompt
        return characterData.systemPrompt;
        
    } catch (error) {
        console.error('載入角色詳情失敗:', error);
        characterIdDisplay.textContent = '❌ 載入角色失敗，請檢查網路連線。';
        currentCharacterName = 'AI 助理'; // 失敗時確保名稱為預設值
        return null;
    }
}


// 函數 B：載入歷史訊息 (解決你的持久化顯示問題)
async function loadChatHistory() {
    if (!CHARACTER_ID) return; 

    try {
        const url = `${BACKEND_URL}/api/chat/history/${CHARACTER_ID}`;
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            // 如果連線失敗，可能是後端 API 沒跑
            throw new Error(`獲取歷史紀錄失敗: ${response.status}`);
        }

        const history = await response.json();
        
        if (history.length > 0) {
            chatWindow.innerHTML = ''; // 清空視窗
            
            // 逐一渲染歷史訊息
            history.forEach(msg => {
                if (msg.role !== 'system') {
                    appendMessage(msg.role, msg.content);
                }
            });
        }

    } catch (error) {
        console.error('❌ 載入歷史紀錄失敗:', error);
        appendMessage('system', '⚠️ 無法載入過去的聊天紀錄。');
    }
}


// 函數 C：檢查登入狀態
async function checkAuthStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/success`, { credentials: 'include' }); 
        
        if (response.ok) {
            const userData = await response.json(); 
            const userName = userData.displayName || '用戶';
            
            authStatus.innerHTML = `
                ✅ 已登入為 <strong>${userName}</strong>。<br>
                <a href="${BACKEND_URL}/auth/logout">登出</a>
            `;
            chatInputForm.style.display = 'flex';
        } else {
            authStatus.innerHTML = `
                ❌ 尚未登入。<br>
                <a href="${BACKEND_URL}/auth/google">使用 Google 帳號登入</a>
            `;
            chatInputForm.style.display = 'none';
            displayMessage('ai', '請先登入才能開始聊天。');
        }
    } catch (error) {
        authStatus.innerHTML = '⚠️ 後端伺服器連線錯誤！請確認 server.js 正在運行。';
        console.error('檢查登入狀態失敗:', error);
        chatInputForm.style.display = 'none';
    }
}


// 核心函數 D：發送訊息到後端
async function sendMessage(e) {
    e.preventDefault(); 
    
    if (!CHARACTER_ID || CHARACTER_ID.includes('請手動替換')) {
        alert("請先在網址中提供有效的角色 ID (?id=...)");
        return;
    }

    const message = messageInput.value.trim();
    if (!message) return;

    displayMessage('user', message);
    messageInput.value = '';
    
    displayMessage('ai', '...'); 

    try {
        const response = await fetch(BACKEND_URL + CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                characterId: CHARACTER_ID 
            }),
            credentials: 'include'
        });

        chatWindow.lastChild.remove(); 

        if (response.ok) {
            const data = await response.json();
            displayMessage('ai', data.response);
        } else if (response.status === 401) {
            displayMessage('ai', '您的登入已失效，請重新登入。');
            checkAuthStatus();
        } 
        else {
            const errorData = await response.json();
            displayMessage('ai', `錯誤：${errorData.error || '無法連線到 AI 服務'}`);
        }
    } catch (error) {
        chatWindow.lastChild.remove();
        displayMessage('ai', '❌ 網路連線錯誤，請檢查後端伺服器是否運行。');
        console.error('聊天發送失敗:', error);
    }
}


// ===================================================
// 4. 網頁載入啟動點 (Execution Start)
// ===================================================

// 事件監聽
chatInputForm.addEventListener('submit', sendMessage);


// 啟動點：網頁載入時執行
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 檢查並更新登入狀態
    await checkAuthStatus(); 

    // 2. 載入角色名稱和基本資訊 (依賴登入狀態)
    const systemPrompt = await loadCharacterDetails(); 

    // 3. 如果成功載入角色，則載入歷史紀錄 (這會解決你的歷史顯示問題)
    if (systemPrompt) {
        await loadChatHistory();
    }
});