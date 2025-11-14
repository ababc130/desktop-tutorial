// create.js

const RENDER_BACKEND_URL = 'https://ai-chat-backend-service.onrender.com';
const BACKEND_URL = window.location.hostname.includes('github.io')
    ? RENDER_BACKEND_URL     // 如果在 GitHub Pages 上運行，連線到 Render
    : 'http://localhost:3000'; // 如果在本地運行，連線到 Port 3000
const CHAT_ENDPOINT = '/api/chat';
const CREATE_ENDPOINT = '/api/character/create';

const form = document.getElementById('create-character-form');
const messageDiv = document.getElementById('message');
const authStatusDiv = document.getElementById('auth-status');

// 輔助函數：檢查登入狀態 (確保用戶已登入才能操作)
async function checkAuthAndEnableForm() {
    try {
        // 嘗試訪問 /success 路由來確認 Session 狀態
        const response = await fetch(`${BACKEND_URL}/success`, {
            credentials: 'include'
        });

        if (response.ok) {
            const userData = await response.json();
            authStatusDiv.innerHTML = `✅ 已登入為 <strong>${userData.displayName}</strong>。`;
            form.style.display = 'block'; // 顯示表單
            return true;
        } else {
            authStatusDiv.innerHTML = `❌ 尚未登入。請先返回聊天頁面登入 Google。`;
            form.style.display = 'none'; // 隱藏表單
            return false;
        }
    } catch (error) {
        authStatusDiv.innerHTML = '⚠️ 後端連線錯誤或未登入。';
        form.style.display = 'none';
        return false;
    }
}

// 核心函數：提交表單資料到後端
async function handleSubmit(e) {
    e.preventDefault();
    messageDiv.className = '';
    messageDiv.textContent = '創建中，請稍候...';

    // 檢查是否已登入
    const isAuthenticated = await checkAuthAndEnableForm();
    if (!isAuthenticated) return;

    // 從表單中獲取資料
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(BACKEND_URL + CREATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 必須帶上 Session Cookie
            credentials: 'include', 
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.className = 'success';
            messageDiv.innerHTML = `🎉 **創建成功！** 角色ID: <code>${result.characterId}</code>。您現在可以使用這個ID來聊天。`;
            form.reset(); // 清空表單
        } else {
            messageDiv.className = 'error';
            messageDiv.textContent = `創建失敗: ${result.error || '未知錯誤'}`;
        }
    } catch (error) {
        messageDiv.className = 'error';
        messageDiv.textContent = '網路連線失敗，請檢查伺服器是否運行。';
        console.error('創建角色失敗:', error);
    }
}

// 事件監聽
form.addEventListener('submit', handleSubmit);

// 網頁載入時檢查登入狀態
checkAuthAndEnableForm();