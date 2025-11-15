// home.js (新的首頁邏輯)

const BACKEND_URL = window.location.hostname.includes('github.io')
    ? 'https://ai-chat-backend-service.onrender.com' 
    : 'http://localhost:3000'; 

const authStatusDiv = document.getElementById('auth-status');


// 函數：檢查登入狀態並顯示用戶 ID
async function checkHomeAuthStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/success`, { credentials: 'include' }); 

        if (response.ok) {
            const userData = await response.json(); 
            const userName = userData.displayName || '用戶';
            
            authStatusDiv.innerHTML = `
                ✅ **已登入**為 <strong>${userName}</strong>。<br>
                您的 Google ID: <code>${userData.id}</code><br>
                <a href="${BACKEND_URL}/auth/logout">登出</a>
            `;
        } else {
            // 未登入，顯示登入連結
            authStatusDiv.innerHTML = `
                ❌ 尚未登入。<br>
                請點擊 <a href="${BACKEND_URL}/auth/google">Google 登入</a>
            `;
        }
    } catch (error) {
        authStatusDiv.innerHTML = '⚠️ 後端伺服器連線錯誤！';
    }
}

// 網頁載入時檢查一次登入狀態
checkHomeAuthStatus();