// admin.js

const BACKEND_URL = 'https://ai-chat-backend-service.onrender.com'; 
const API_URL = `${BACKEND_URL}/api/admin/characters`;
const tableContainer = document.getElementById('character-table-container');

// 函數：從後端 API 獲取資料並渲染表格
async function loadCharacterData() {
    try {
        // 必須帶上 Session Cookie 才能通過 ensureAdmin 檢查
        const response = await fetch(API_URL, {
            credentials: 'include' 
        });

        if (response.status === 403) {
            tableContainer.innerHTML = '<h2>❌ 權限不足</h2><p>您不是管理員，無法存取此頁面。</p>';
            return;
        }
        if (!response.ok) {
            throw new Error('API 存取失敗');
        }

        const characters = await response.json();
        
        let html = '<table><thead><tr><th>名稱</th><th>作者 ID</th><th>角色 ID</th><th>性格設定 (Prompt)</th></tr></thead><tbody>';

        characters.forEach(char => {
            html += `
                <tr>
                    <td><strong>${char.name}</strong></td>
                    <td>${char.creatorId}</td>
                    <td>${char._id}</td>
                    <td>${char.systemPrompt.substring(0, 50)}...</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

    } catch (error) {
        console.error('載入角色資料失敗:', error);
        tableContainer.innerHTML = `<h2>連線錯誤</h2><p>請確認伺服器已啟動並登入。</p>`;
    }
}

// 載入時執行
loadCharacterData();