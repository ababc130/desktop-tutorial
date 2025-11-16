// profile.js

const BACKEND_URL = window.location.hostname.includes('github.io')
    ? 'https://ai-chat-backend-service.onrender.com' 
    : 'http://localhost:3000';

const characterId = new URLSearchParams(window.location.search).get('id');

const nameElement = document.getElementById('character-name');
const descElement = document.getElementById('character-description');
const favoriteBtn = document.getElementById('favorite-button');
const chatBtn = document.getElementById('chat-button');
const authStatusDiv = document.getElementById('auth-status');


// 檢查登入狀態 (與 home.js 相似，確保用戶已登入)
async function checkAuthAndLoad() {
    // 這裡調用 /success 路由並顯示狀態... (省略詳細代碼，與 home.js 邏輯相同)
    // ❗ 確保用戶已登入，否則後續 API 會失敗
    // 簡化：如果 /success 失敗，直接跳轉到登入頁
    
    const statusResponse = await fetch(`${BACKEND_URL}/success`, { credentials: 'include' });
    if (!statusResponse.ok) {
        authStatusDiv.innerHTML = `<p>❌ 請先 <a href="${BACKEND_URL}/auth/google">登入</a> 才能查看角色詳情。</p>`;
        return false;
    }
    authStatusDiv.innerHTML = `✅ 已登入，正在載入...`;
    return true;
}


// 函數：載入角色資料和收藏狀態
async function loadProfile() {
    if (!characterId) {
        nameElement.textContent = '錯誤：URL 中缺少角色 ID。';
        return;
    }

    if (!await checkAuthAndLoad()) return;

    try {
        const url = `${BACKEND_URL}/api/character/${characterId}`;
        const response = await fetch(url, { credentials: 'include' });

        if (response.status === 404) {
            nameElement.textContent = '找不到該角色。';
            return;
        }

        const data = await response.json();

        // 渲染介面
        nameElement.textContent = data.name;
        document.getElementById('page-title').textContent = data.name;
        descElement.textContent = data.description;
        
        // 收藏按鈕狀態
        updateFavoriteButton(data.isFavorite);
        
        // 設定聊天按鈕導向
        chatBtn.onclick = () => {
            window.location.href = `${REPO_PATH}/chat.html?id=${characterId}`;
        };

    } catch (error) {
        console.error('Profile 載入失敗:', error);
        nameElement.textContent = '連線或資料庫錯誤。';
    }
}

// 函數：更新收藏按鈕的視覺狀態
function updateFavoriteButton(isFavorited) {
    favoriteBtn.dataset.favorited = isFavorited;
    favoriteBtn.textContent = isFavorited ? '已收藏 ❤️' : '收藏';
    favoriteBtn.classList.toggle('favorited', isFavorited);
}


// 函數：處理收藏按鈕點擊
async function handleFavoriteClick() {
    const isCurrentlyFavorited = favoriteBtn.dataset.favorited === 'true';
    const favoriteUrl = `${BACKEND_URL}/api/user/favorite/${characterId}`;
    
    // 禁用按鈕防止重複點擊
    favoriteBtn.disabled = true;

    try {
        const response = await fetch(favoriteUrl, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const result = await response.json();
            updateFavoriteButton(result.isFavorite);
        } else {
            alert('收藏操作失敗，請重新登入。');
        }
    } catch (error) {
        console.error('收藏 API 呼叫失敗:', error);
        alert('網路連線錯誤，無法執行收藏操作。');
    } finally {
        favoriteBtn.disabled = false;
    }
}


// 啟動點
favoriteBtn.addEventListener('click', handleFavoriteClick);
loadProfile();