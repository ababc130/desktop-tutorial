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

// 函數：載入並顯示用戶的收藏列表
async function loadFavorites() {
    const favoritesListDiv = document.getElementById('favorites-list');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/user/favorites`, { credentials: 'include' });
        
        if (!response.ok) {
            favoritesListDiv.innerHTML = '<p>⚠️ 無法載入收藏列表，請確認已登入。</p>';
            return;
        }

        const favorites = await response.json();
        
        if (favorites.length === 0) {
            favoritesListDiv.innerHTML = '<p>您尚未收藏任何角色。</p>';
            return;
        }

        // 動態生成列表 HTML
        let html = '<ul style="list-style: none; padding: 0;">';
        
        favorites.forEach(char => {
            // ❗ 導向 chat.html 頁面，並帶上角色的 ID
            const chatLink = `/chat.html?id=${char._id}`; 
            
            html += `
                <li style="padding: 10px 0; border-bottom: 1px dotted #ddd;">
                    <a href="${chatLink}" style="font-weight: bold; color: #007bff;">${char.name}</a>
                    <p style="margin: 5px 0 0; font-size: 0.9em; color: #555;">${char.description.substring(0, 80)}...</p>
                </li>
            `;
        });
        
        html += '</ul>';
        favoritesListDiv.innerHTML = html;

    } catch (error) {
        console.error('載入收藏列表失敗:', error);
        favoritesListDiv.innerHTML = '<p>連線錯誤，無法獲取收藏數據。</p>';
    }
}

// 修正 checkHomeAuthStatus 函數的結尾，在登入成功後呼叫 loadFavorites
async function checkHomeAuthStatus() {
    // ... (所有檢查邏輯) ...
    if (response.ok) {
        // ... (原有的顯示登入狀態邏輯) ...
        
        // ❗ 新增：登入成功後載入收藏
        loadFavorites(); 
    } 
    // ... (else 邏輯不變)
}

// 網頁載入時檢查一次登入狀態
checkHomeAuthStatus();