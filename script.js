// script.js

const BACKEND_URL = 'https://ai-chat-backend-service.onrender.com';
const CHAT_ENDPOINT = '/api/chat';

// ❗ 必須手動替換成你後端使用的真實角色 ID
// (請在 server.js 檔案中找到你設定的 TARGET_CHARACTER_ID)
const CHARACTER_ID = '6914b57be382ade03c24cfda'; 


// 獲取 DOM 元素
const authStatus = document.getElementById('auth-status');
const chatWindow = document.getElementById('chat-window');
const chatInputForm = document.getElementById('chat-input-form');
const messageInput = document.getElementById('message-input');
const characterIdDisplay = document.getElementById('character-id-display');

// 顯示角色 ID (方便測試)
characterIdDisplay.textContent = CHARACTER_ID;

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