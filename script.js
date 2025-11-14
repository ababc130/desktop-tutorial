// script.js

const RENDER_BACKEND_URL = 'https://ai-chat-backend-service.onrender.com';
const BACKEND_URL = window.location.hostname.includes('github.io')
    ? RENDER_BACKEND_URL     // 如果在 GitHub Pages 上運行，連線到 Render
    : 'http://localhost:3000'; // 如果在本地運行，連線到 Port 3000
const CHAT_ENDPOINT = '/api/chat';

// 核心邏輯：從 URL 的查詢字串中獲取 characterId
function getCharacterIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id'); // 尋找網址中 ?id= 的值
}

// (請在 server.js 檔案中找到你設定的 TARGET_CHARACTER_ID)
const CHARACTER_ID = getCharacterIdFromUrl() || '69176fedb94e17cb9b508965';

// 假設這是顯示 ID/名稱的元素
const characterIdDisplay = document.getElementById('character-id-display'); 


// 獲取 DOM 元素
const authStatus = document.getElementById('auth-status');
const chatWindow = document.getElementById('chat-window');
const chatInputForm = document.getElementById('chat-input-form');
const messageInput = document.getElementById('message-input');
const characterIdDisplay = document.getElementById('character-id-display');

// 函數：從後端獲取角色名稱並更新介面
async function loadCharacterDetails() {
    if (!CHARACTER_ID || CHARACTER_ID.includes('請手動替換')) {
        characterIdDisplay.textContent = '❌ 請在網址中提供角色 ID (例如: ?id=xxx)';
        return null;
    }

    try {
        const url = `${BACKEND_URL}/api/character/${CHARACTER_ID}`;
        
        // 必須帶上 Session Cookie 才能通過 ensureAuthenticated 檢查
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            // 如果是 404，表示 ID 不存在，或 401 表示未登入
            characterIdDisplay.textContent = `❌ 無法載入角色。錯誤碼: ${response.status}。請確認 ID 或是否已登入。`;
            return null;
        }

        const characterData = await response.json();
        
        // ❗ 核心修正：將標題改為顯示角色名稱
        characterIdDisplay.innerHTML = `角色：<strong>${characterData.name}</strong>`; 
        
        // 返回角色的 System Prompt (這是聊天功能所需要的)
        return characterData.systemPrompt;
        
    } catch (error) {
        console.error('載入角色詳情失敗:', error);
        characterIdDisplay.textContent = '❌ 載入角色失敗，請檢查網路連線。';
        return null;
    }
}

// ❗ 步驟二：更新 chatSubmit 函數的 systemPrompt 獲取方式
async function chatSubmit(e) {
    e.preventDefault();
    
    // 1. 確保已登入且有角色 ID
    if (!req.isAuthenticated() || !CHARACTER_ID) {
        alert("請先登入並確保網址中帶有角色 ID (?id=...)");
        return;
    }

    // ... (其他邏輯不變) ...

    // 2. 移除舊的硬編碼獲取 System Prompt 的邏輯
    // 由於我們在 chatSubmit 函數中並沒有直接使用 systemPrompt，
    // 我們可以依賴後端在 /api/chat 中再次查詢（更安全，但較慢）
    // 或是將這個 systemPrompt 儲存在前端變數中 (更複雜)。
    // 
    // 由於你的 /api/chat 後端已經會根據 CHARACTER_ID 查詢 systemPrompt，
    // 我們暫時不對 chatSubmit 進行大改，只確保前端能顯示名稱。

    // ...
}

// ❗ 步驟三：在網頁載入時呼叫新函數
document.addEventListener('DOMContentLoaded', async () => {
    // 載入角色名稱和基本資訊
    const systemPrompt = await loadCharacterDetails(); 

    // 如果 loadCharacterDetails 成功，則 systemPrompt 不為空
    if (systemPrompt) {
        // 現在可以安全地執行其他初始化，例如：載入歷史紀錄
        loadChatHistory();
    }
    
    // ❗ 確保這裡只執行一次 loadCharacterDetails
    // 你的 chatSubmit 邏輯需要確保能取到這個 ID
});

// 輔助函數：顯示訊息到聊天視窗
function displayMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    messageDiv.textContent = content;
    chatWindow.appendChild(messageDiv);
    // 讓聊天視窗自動捲到底部
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 輔助函數：檢查登入狀態
async function checkAuthStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/success`, {
            credentials: 'include'
        }); 
        
        if (response.ok) {
            // ❗ 關鍵修正：將響應解析為 JSON 
            const userData = await response.json(); 
            
            // 從 JSON 中讀取 displayName
            const userName = userData.displayName || '用戶';
            
            authStatus.innerHTML = `
                ✅ 已登入為 <strong>${userName}</strong>。<br>
                <a href="${BACKEND_URL}/auth/logout">登出</a>
            `;
            chatInputForm.style.display = 'flex'; // 顯示聊天輸入框
        } else {
            // 未登入，導向登入連結
            authStatus.innerHTML = `
                ❌ 尚未登入。<br>
                <a href="${BACKEND_URL}/auth/google">使用 Google 帳號登入</a>
            `;
            chatInputForm.style.display = 'none'; // 隱藏聊天輸入框
            displayMessage('ai', '請先登入才能開始聊天。');
        }
    } catch (error) {
        // 如果連線失敗，可能是後端還沒啟動
        authStatus.innerHTML = '⚠️ 後端伺服器連線錯誤！請確認 server.js 正在運行。';
        console.error('檢查登入狀態失敗:', error);
        chatInputForm.style.display = 'none';
    }
}

// 核心函數：發送訊息到後端
async function sendMessage(e) {
    e.preventDefault(); // 阻止表單預設的重新載入行為

    const message = messageInput.value.trim();
    if (!message) return;

    displayMessage('user', message);
    messageInput.value = ''; // 清空輸入框
    
    // 暫時顯示 AI 正在思考中
    displayMessage('ai', '...'); 

    try {
        const response = await fetch(BACKEND_URL + CHAT_ENDPOINT, {
            method: 'POST',
            headers: {
                // 必須發送 Cookie (包含 Session ID) 才能讓後端知道是哪個用戶
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                characterId: CHARACTER_ID // 傳送角色 ID 
            }),
            // ❗ 這裡新增：告訴瀏覽器在跨網域請求時帶上 Cookie
            credentials: 'include'
        });

        // 移除思考中的訊息
        chatWindow.lastChild.remove(); 

        if (response.ok) {
            const data = await response.json();
            displayMessage('ai', data.response);
        } else if (response.status === 401) {
            displayMessage('ai', '您的登入已失效，請重新登入。');
            checkAuthStatus(); // 重新檢查登入狀態
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

// 事件監聽
chatInputForm.addEventListener('submit', sendMessage);

// 網頁載入時檢查一次登入狀態
checkAuthStatus();