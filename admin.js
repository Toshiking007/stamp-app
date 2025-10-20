// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDvg3SAKhqcnEiQRlgdCjzT1gLg2GgioN4",
  authDomain: "stamp-app-65e27.firebaseapp.com",
  projectId: "stamp-app-65e27",
  storageBucket: "stamp-app-65e27.firebasestorage.app",
  messagingSenderId: "178934669247",
  appId: "1:178934669247:web:52742f44b4715898d90b0a"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ユーザー管理用のグローバル変数
let allUsers = [];
let filteredUsers = [];

// アビリティ管理用のグローバル変数
let currentAbilityUserId = null;
let currentAbilityUserName = '';

class AdminPasswordManager {
    constructor() {
        // 管理者パスワード（固定）
        this.ADMIN_PASSWORD = 'mizukami1985';

        // パスワード有効期限（2時間 = 2 * 60 * 60 * 1000 ミリ秒）
        this.PASSWORD_VALIDITY_HOURS = 2;
        this.PASSWORD_VALIDITY_MS = this.PASSWORD_VALIDITY_HOURS * 60 * 60 * 1000;

        this.isAuthenticated = false;
        this.timeUpdateInterval = null;
        this.initializeApp();
        this.bindEvents();
    }

    initializeApp() {
        console.log('🔧 管理者システム初期化開始');
        this.isAuthenticated = true; // 認証済みとして扱う
        this.updatePasswordStatus();
        this.updateUsageStats();

        // 現在のパスワードがあれば時間更新を開始
        const passwordData = this.getCurrentPasswordData();
        if (passwordData && !this.isPasswordExpired(passwordData)) {
            this.startTimeUpdate();
        }

        console.log('🔧 管理者システム初期化完了');
    }

    bindEvents() {
        console.log('🔧 イベント設定開始');

        // パスワード生成
        const generateBtn = document.getElementById('generate-password');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateNewPassword());
        }

        // 状況更新
        const refreshBtn = document.getElementById('refresh-status');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshStatus());
        }

        // 使用履歴リセット
        const resetBtn = document.getElementById('reset-usage');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetUsageHistory());
        }

        // 時間延長
        const extendBtn = document.getElementById('extend-time');
        if (extendBtn) {
            extendBtn.addEventListener('click', () => this.extendPasswordTime());
        }

        // 救済パスワード生成
        const rescueBtn = document.getElementById('generate-rescue-password');
        if (rescueBtn) {
            rescueBtn.addEventListener('click', () => this.generateRescuePassword());
        }

        console.log('🔧 イベント設定完了');
    }

    // 4桁のランダムパスワードを生成
    generateRandomPassword() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    // 新しいパスワードを生成
    async generateNewPassword() {
        try {
            console.log('🎲 新しいパスワード生成開始');

            const newPassword = this.generateRandomPassword();
            const timestamp = new Date().toLocaleString('ja-JP');

            // 研修会タイプと経験値を取得
            const trainingTypeInput = document.querySelector('input[name="training-type"]:checked');
            const expAmountInput = document.querySelector('input[name="exp-amount"]:checked');
            const validitySelect = document.getElementById('password-validity');

            console.log('========== [バグ3デバッグ] パスワード生成開始 ==========');
            console.log('🔍 [バグ3デバッグ] trainingTypeInput:', trainingTypeInput);
            console.log('🔍 [バグ3デバッグ] expAmountInput:', expAmountInput);
            console.log('🔍 [バグ3デバッグ] expAmountInput.value (文字列):', expAmountInput?.value);

            if (!expAmountInput) {
                console.error('❌ [バグ3デバッグ] 経験値ラジオボタンが選択されていません！');
                this.showMessage('経験値を選択してください', 'error');
                return;
            }

            const trainingType = trainingTypeInput ? trainingTypeInput.value : 'なし';
            const expAmountStr = expAmountInput.value; // まず文字列として取得
            const expAmount = parseInt(expAmountStr, 10); // 明示的に10進数で変換
            const validityDays = validitySelect ? parseInt(validitySelect.value) : 1;

            console.log('🔍 [バグ3デバッグ] trainingType (最終値):', trainingType);
            console.log('🔍 [バグ3デバッグ] expAmountStr (変換前):', expAmountStr);
            console.log('🔍 [バグ3デバッグ] expAmount (変換後):', expAmount);
            console.log('🔍 [バグ3デバッグ] typeof expAmount:', typeof expAmount);
            console.log('🔍 [バグ3デバッグ] expAmount === 100:', expAmount === 100);
            console.log('🔍 [バグ3デバッグ] expAmount === 300:', expAmount === 300);

            // 経験値が正しく変換されたか確認
            if (isNaN(expAmount) || (expAmount !== 100 && expAmount !== 300)) {
                console.error('❌ [バグ3デバッグ] 経験値の変換に失敗:', expAmount);
                this.showMessage('経験値の設定に問題があります', 'error');
                return;
            }

            // パスワードデータ作成
            const now = Date.now();
            const expiryTime = now + (validityDays * 24 * 60 * 60 * 1000);
            const passwordData = {
                password: newPassword,
                generatedAt: timestamp,
                generatedTimestamp: now,
                expiryTimestamp: expiryTime,
                expiryAt: new Date(expiryTime).toLocaleString('ja-JP'),
                trainingType: trainingType,
                expAmount: expAmount, // ★重要: これが100 or 300の数値であることを確認
                usedBy: [], // 使用したユーザーのIDリスト
                maxUses: null // null = 無制限、数値 = 制限あり
            };

            console.log('🔍 [バグ3デバッグ] passwordData作成完了:');
            console.log('  - password:', passwordData.password);
            console.log('  - trainingType:', passwordData.trainingType);
            console.log('  - expAmount:', passwordData.expAmount, '(型:', typeof passwordData.expAmount, ')');
            console.log('  - used:', passwordData.used);
            console.log('🔍 [バグ3デバッグ] passwordData (JSON):', JSON.stringify(passwordData));

            // Firestoreに保存
            console.log('🔍 [バグ3デバッグ] Firestoreに保存開始...');
            await db.collection('passwords').doc(newPassword).set(passwordData);
            console.log('✅ [バグ3デバッグ] Firestoreに保存完了！');

            // 保存されたデータを再取得して確認
            console.log('🔍 [バグ3デバッグ] 保存データを再取得して確認...');
            const verifyDoc = await db.collection('passwords').doc(newPassword).get();
            if (verifyDoc.exists) {
                const verifyData = verifyDoc.data();
                console.log('✅ [バグ3デバッグ] Firestoreから再取得成功:');
                console.log('  - expAmount:', verifyData.expAmount, '(型:', typeof verifyData.expAmount, ')');
                console.log('  - trainingType:', verifyData.trainingType);

                if (verifyData.expAmount !== expAmount) {
                    console.error('❌ [バグ3デバッグ] 警告: 保存された値が異なります！');
                    console.error('  - 設定値:', expAmount);
                    console.error('  - 保存値:', verifyData.expAmount);
                }
            } else {
                console.error('❌ [バグ3デバッグ] エラー: 保存したパスワードが見つかりません');
            }
            console.log('========== [バグ3デバッグ] パスワード生成完了 ==========');

            // LocalStorageにも保存（互換性のため）
            localStorage.setItem('currentPassword', JSON.stringify(passwordData));

            // 既存の使用履歴をリセット（新しいパスワードなので）
            localStorage.removeItem('passwordUsageHistory');
            localStorage.setItem('passwordUsageCount', '0');

            this.showMessage(`✅ 新しいパスワードを生成しました: ${newPassword}\n研修会タイプ: ${trainingType}, 経験値: ${expAmount}P`, 'success');

            // 表示を更新
            this.updatePasswordStatus();
            this.updateUsageStats();
            this.startTimeUpdate();

            console.log('✅ パスワード生成完了:', {password: newPassword, trainingType, expAmount});

        } catch (error) {
            console.error('❌ パスワード生成エラー:', error);
            this.showMessage(`パスワード生成エラー: ${error.message}`, 'error');
        }
    }

    // パスワード状況を更新
    updatePasswordStatus() {
        try {
            const passwordData = this.getCurrentPasswordData();
            const statusText = document.getElementById('password-status-text');
            const passwordBox = document.getElementById('current-password-box');
            const passwordValue = document.getElementById('current-password-value');
            const generationTime = document.getElementById('generation-time');
            const expiryTime = document.getElementById('expiry-time');
            const extendBtn = document.getElementById('extend-time');
            const trainingTypeEl = document.getElementById('current-training-type');
            const expAmountEl = document.getElementById('current-exp-amount');

            if (passwordData) {
                const isExpired = this.isPasswordExpired(passwordData);

                if (isExpired) {
                    statusText.textContent = 'パスワードの有効期限が切れています';
                    statusText.style.color = '#dc3545';
                    if (extendBtn) extendBtn.style.display = 'none';
                } else {
                    statusText.textContent = '本日のパスワードが生成済みです';
                    statusText.style.color = '#28a745';
                    if (extendBtn) extendBtn.style.display = 'inline-block';
                }

                passwordBox.style.display = 'block';
                passwordValue.textContent = passwordData.password;
                generationTime.textContent = passwordData.generatedAt;
                if (expiryTime) expiryTime.textContent = passwordData.expiryAt || '不明';
                if (trainingTypeEl) trainingTypeEl.textContent = passwordData.trainingType || 'なし';
                if (expAmountEl) expAmountEl.textContent = passwordData.expAmount || '100';

                this.updateTimeRemaining(passwordData);
            } else {
                statusText.textContent = 'パスワードが生成されていません';
                statusText.style.color = '#6c757d';
                passwordBox.style.display = 'none';
                if (extendBtn) extendBtn.style.display = 'none';
            }

        } catch (error) {
            console.error('❌ パスワード状況更新エラー:', error);
        }
    }

    // 現在のパスワードデータを取得
    getCurrentPasswordData() {
        try {
            const data = localStorage.getItem('currentPassword');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ パスワードデータ取得エラー:', error);
            return null;
        }
    }

    // 使用統計を更新（Firestore版）
    async updateUsageStats() {
        try {
            // Firestoreから使用履歴を取得
            const snapshot = await db.collection('usage_history')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const usageCount = snapshot.size;
            let lastUsage = '未使用';

            if (!snapshot.empty) {
                const lastDoc = snapshot.docs[0];
                const lastData = lastDoc.data();
                if (lastData.timestamp) {
                    lastUsage = lastData.timestamp.toDate().toLocaleString('ja-JP');
                }
            }

            const usageCountEl = document.getElementById('usage-count');
            const lastUsageEl = document.getElementById('last-usage');

            if (usageCountEl) usageCountEl.textContent = usageCount;
            if (lastUsageEl) lastUsageEl.textContent = lastUsage;

            // LocalStorageにも保存（互換性のため）
            localStorage.setItem('passwordUsageCount', usageCount.toString());
            if (lastUsage !== '未使用') {
                localStorage.setItem('lastPasswordUsage', lastUsage);
            }

        } catch (error) {
            console.error('❌ 使用統計更新エラー:', error);
            // エラー時はlocalStorageから読み込み
            const usageCount = parseInt(localStorage.getItem('passwordUsageCount')) || 0;
            const lastUsage = localStorage.getItem('lastPasswordUsage') || '未使用';

            const usageCountEl = document.getElementById('usage-count');
            const lastUsageEl = document.getElementById('last-usage');

            if (usageCountEl) usageCountEl.textContent = usageCount;
            if (lastUsageEl) lastUsageEl.textContent = lastUsage;
        }
    }

    // 使用履歴をリセット
    resetUsageHistory() {
        try {
            if (confirm('使用履歴をリセットしますか？\n\n※ この操作により、すべての受講生が再度パスワードを使用できるようになります。')) {
                localStorage.removeItem('passwordUsageHistory');
                localStorage.setItem('passwordUsageCount', '0');
                localStorage.removeItem('lastPasswordUsage');

                // script.jsの使用履歴もリセット
                localStorage.removeItem('scannedCodes');

                this.showMessage('✅ 使用履歴をリセットしました', 'success');
                this.updateUsageStats();

                console.log('✅ 使用履歴リセット完了');
            }

        } catch (error) {
            console.error('❌ 使用履歴リセットエラー:', error);
            this.showMessage(`リセットエラー: ${error.message}`, 'error');
        }
    }

    // 状況を更新
    refreshStatus() {
        try {
            console.log('🔄 状況更新開始');
            this.updatePasswordStatus();
            this.updateUsageStats();

            // 現在のパスワードがあれば時間更新を開始
            const passwordData = this.getCurrentPasswordData();
            if (passwordData) {
                this.startTimeUpdate();
            }

            this.showMessage('状況を更新しました', 'info');
            console.log('✅ 状況更新完了');

        } catch (error) {
            console.error('❌ 状況更新エラー:', error);
            this.showMessage(`更新エラー: ${error.message}`, 'error');
        }
    }

    // メッセージ表示
    showMessage(text, type = 'success') {
        try {
            console.log(`メッセージ表示: ${text} (${type})`);
            const message = document.getElementById('message');

            if (!message) {
                console.error('message要素が見つかりません');
                alert(text);
                return;
            }

            message.textContent = text;
            message.className = `message show ${type}`;

            setTimeout(() => {
                if (message) {
                    message.classList.remove('show');
                }
            }, 3000);

        } catch (error) {
            console.error('showMessage エラー:', error);
            alert(text);
        }
    }

    // 外部からのパスワード使用通知を受信
    notifyPasswordUsage() {
        try {
            console.log('📊 パスワード使用通知受信');

            const currentCount = parseInt(localStorage.getItem('passwordUsageCount')) || 0;
            const newCount = currentCount + 1;
            const timestamp = new Date().toLocaleString('ja-JP');

            localStorage.setItem('passwordUsageCount', newCount.toString());
            localStorage.setItem('lastPasswordUsage', timestamp);

            this.updateUsageStats();
            console.log('✅ 使用統計更新完了:', newCount);

        } catch (error) {
            console.error('❌ パスワード使用通知エラー:', error);
        }
    }

    // パスワードが期限切れかチェック
    isPasswordExpired(passwordData) {
        if (!passwordData || !passwordData.expiryTimestamp) {
            return true; // 期限情報がない場合は期限切れとみなす
        }
        return Date.now() > passwordData.expiryTimestamp;
    }

    // 残り時間を更新
    updateTimeRemaining(passwordData) {
        try {
            const timeRemainingEl = document.getElementById('time-remaining');
            const timeRemainingDisplay = document.getElementById('time-remaining-display');

            if (!timeRemainingEl || !timeRemainingDisplay) return;

            if (this.isPasswordExpired(passwordData)) {
                timeRemainingEl.textContent = '期限切れ';
                timeRemainingDisplay.className = 'time-remaining expired';
                return;
            }

            const now = Date.now();
            const remainingMs = passwordData.expiryTimestamp - now;
            const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
            const remainingHours = Math.floor(remainingMinutes / 60);
            const mins = remainingMinutes % 60;

            let timeText;
            if (remainingHours > 0) {
                timeText = `${remainingHours}時間${mins}分`;
            } else {
                timeText = `${mins}分`;
            }

            timeRemainingEl.textContent = timeText;

            // 残り時間に応じてスタイルを変更
            if (remainingMinutes < 30) {
                timeRemainingDisplay.className = 'time-remaining expired';
            } else if (remainingMinutes < 60) {
                timeRemainingDisplay.className = 'time-remaining warning';
            } else {
                timeRemainingDisplay.className = 'time-remaining normal';
            }

        } catch (error) {
            console.error('❌ 残り時間更新エラー:', error);
        }
    }

    // 時間更新を開始
    startTimeUpdate() {
        // 既存のインターバルがあればクリア
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }

        // 1分ごとに時間を更新
        this.timeUpdateInterval = setInterval(() => {
            const passwordData = this.getCurrentPasswordData();
            if (passwordData) {
                this.updateTimeRemaining(passwordData);

                // 期限切れの場合は状況も更新
                if (this.isPasswordExpired(passwordData)) {
                    this.updatePasswordStatus();
                }
            }
        }, 60000); // 60秒ごと
    }

    // 時間延長機能
    extendPasswordTime() {
        try {
            const passwordData = this.getCurrentPasswordData();
            if (!passwordData) {
                this.showMessage('延長するパスワードがありません', 'error');
                return;
            }

            if (confirm('パスワードの有効期限を2時間延長しますか？')) {
                // 現在時刻から2時間延長
                const now = Date.now();
                const newExpiryTime = now + this.PASSWORD_VALIDITY_MS;

                passwordData.expiryTimestamp = newExpiryTime;
                passwordData.expiryAt = new Date(newExpiryTime).toLocaleString('ja-JP');

                localStorage.setItem('currentPassword', JSON.stringify(passwordData));

                this.showMessage('✅ パスワードの有効期限を2時間延長しました', 'success');
                this.updatePasswordStatus();

                console.log('✅ パスワード延長完了:', passwordData.expiryAt);
            }

        } catch (error) {
            console.error('❌ パスワード延長エラー:', error);
            this.showMessage(`延長エラー: ${error.message}`, 'error');
        }
    }

    // 現在有効なパスワードを取得（script.js用API）
    getCurrentValidPassword() {
        const passwordData = this.getCurrentPasswordData();
        if (!passwordData) return null;

        // 期限切れチェック
        if (this.isPasswordExpired(passwordData)) {
            console.log('⚠️ パスワードが期限切れです');
            return null;
        }

        return passwordData.password;
    }

    // 救済措置用パスワード生成
    async generateRescuePassword() {
        try {
            console.log('🆘 救済パスワード生成開始');

            const expInput = document.getElementById('rescue-points');
            const exp = parseInt(expInput.value) || 50;

            if (exp < 1 || exp > 999999) {
                this.showMessage('経験値は1〜999999の範囲で入力してください', 'error');
                return;
            }

            // 研修会タイプを取得
            const trainingTypeInput = document.querySelector('input[name="rescue-training-type"]:checked');
            const trainingType = trainingTypeInput ? trainingTypeInput.value : 'なし';

            // ランダムパスワード生成
            const rescuePassword = this.generateRandomPassword();
            const timestamp = new Date().toLocaleString('ja-JP');
            const now = Date.now();
            const expiryTime = now + (7 * 24 * 60 * 60 * 1000); // 7日間有効

            console.log('========== [救済パスワード] 生成開始 ==========');
            console.log('🔍 [救済パスワード] パスワード:', rescuePassword);
            console.log('🔍 [救済パスワード] 経験値:', exp);
            console.log('🔍 [救済パスワード] 研修会タイプ:', trainingType);

            // 本日のパスワード生成と同じ構造でFirestoreに保存
            const passwordData = {
                password: rescuePassword,
                generatedAt: timestamp,
                generatedTimestamp: now,
                expiryTimestamp: expiryTime,
                expiryAt: new Date(expiryTime).toLocaleString('ja-JP'),
                trainingType: trainingType,
                expAmount: exp, // ★重要: expAmountキーを使用（本日のパスワードと同じ）
                usedBy: [], // 使用したユーザーのIDリスト
                maxUses: 1, // 救済措置は1人専用
                isRescue: true // 救済パスワードであることを示すフラグ
            };

            console.log('🔍 [救済パスワード] passwordData作成完了:');
            console.log('  - password:', passwordData.password);
            console.log('  - trainingType:', passwordData.trainingType);
            console.log('  - expAmount:', passwordData.expAmount, '(型:', typeof passwordData.expAmount, ')');
            console.log('  - used:', passwordData.used);
            console.log('  - isRescue:', passwordData.isRescue);

            // Firestoreに保存
            console.log('🔍 [救済パスワード] Firestoreに保存開始...');
            await db.collection('passwords').doc(rescuePassword).set(passwordData);
            console.log('✅ [救済パスワード] Firestoreに保存完了！');

            // 保存されたデータを再取得して確認
            console.log('🔍 [救済パスワード] 保存データを再取得して確認...');
            const verifyDoc = await db.collection('passwords').doc(rescuePassword).get();
            if (verifyDoc.exists) {
                const verifyData = verifyDoc.data();
                console.log('✅ [救済パスワード] Firestoreから再取得成功:');
                console.log('  - expAmount:', verifyData.expAmount, '(型:', typeof verifyData.expAmount, ')');
                console.log('  - trainingType:', verifyData.trainingType);
                console.log('  - isRescue:', verifyData.isRescue);

                if (verifyData.expAmount !== exp) {
                    console.error('❌ [救済パスワード] 警告: 保存された値が異なります！');
                    console.error('  - 設定値:', exp);
                    console.error('  - 保存値:', verifyData.expAmount);
                }
            } else {
                console.error('❌ [救済パスワード] エラー: 保存したパスワードが見つかりません');
            }
            console.log('========== [救済パスワード] 生成完了 ==========');

            // LocalStorageにも保存（後方互換性のため）
            const rescueData = {
                password: rescuePassword,
                points: exp,
                trainingType: trainingType,
                generatedAt: timestamp,
                generatedTimestamp: now
            };
            localStorage.setItem('rescuePassword', JSON.stringify(rescueData));

            // 表示を更新
            this.showRescuePassword(rescuePassword, exp, timestamp);
            this.showMessage(`✅ ${exp}経験値用救済パスワードを生成しました: ${rescuePassword}\n研修会タイプ: ${trainingType}\n有効期限: 7日間`, 'success');

            console.log('✅ 救済パスワード生成完了:', passwordData);

        } catch (error) {
            console.error('❌ 救済パスワード生成エラー:', error);
            this.showMessage(`生成エラー: ${error.message}`, 'error');
        }
    }

    // 救済パスワードを表示
    showRescuePassword(password, exp, timestamp) {
        try {
            const rescueDisplay = document.getElementById('rescue-display');
            const rescuePasswordValue = document.getElementById('rescue-password-value');
            const rescuePointsDisplay = document.getElementById('rescue-points-display');
            const rescuePointsDisplay2 = document.getElementById('rescue-points-display-2');
            const rescueGenerationTime = document.getElementById('rescue-generation-time');

            if (rescueDisplay && rescuePasswordValue) {
                rescuePasswordValue.textContent = password;
                rescueDisplay.style.display = 'block';
            }

            if (rescuePointsDisplay) rescuePointsDisplay.textContent = exp;
            if (rescuePointsDisplay2) rescuePointsDisplay2.textContent = exp;
            if (rescueGenerationTime) rescueGenerationTime.textContent = timestamp;

        } catch (error) {
            console.error('❌ 救済パスワード表示エラー:', error);
        }
    }

    // 救済パスワードデータを取得
    getRescuePasswordData() {
        try {
            const data = localStorage.getItem('rescuePassword');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ 救済パスワードデータ取得エラー:', error);
            return null;
        }
    }
}

// アプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: 管理者システム初期化開始');

    try {
        const adminManager = new AdminPasswordManager();

        // グローバル関数として簡単アクセス
        window.adminManager = adminManager;

        console.log('✅ 管理者システムが正常に起動しました！');

    } catch (error) {
        console.error('❌ 管理者システム初期化エラー:', error);
        alert(`初期化失敗: ${error.message}`);
    }
});

// ============================================
// ユーザー管理機能
// ============================================

// ページ切り替え
function showUsersPage() {
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('users-panel').style.display = 'block';
    loadUsers();
}

function showAdminPanel() {
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('users-panel').style.display = 'none';
}

// ユーザーデータを読み込み
async function loadUsers() {
    try {
        console.log('👥 ユーザーデータ読み込み開始');

        const usersSnapshot = await db.collection('users').get();
        allUsers = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            allUsers.push({
                id: doc.id,
                name: data.name || '',
                level: data.level || 1,
                exp: data.exp || 0,
                title: data.title || '初心者',
                profession: data.profession || '',
                affiliation: data.affiliation || '',
                prefecture: data.prefecture || '',
                experience: data.experience || 0,
                participationCount: data.participationCount || 0,
                lastVisit: data.lastVisit ? data.lastVisit.toDate() : null,
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
                abilities: data.abilities || [], // アビリティデータを追加
                freeTickets: data.freeTickets || [] // 無料券データを追加
            });
        });

        console.log('✅ ユーザーデータ読み込み完了:', allUsers.length, '件');
        console.log('📊 アビリティ付きユーザー数:', allUsers.filter(u => u.abilities.length > 0).length, '件');

        // ユーザー選択セレクトボックスを更新
        populateAbilityUserSelect();

        // 都道府県フィルターのオプションを生成
        populatePrefectureFilter();

        // フィルターとソートを適用
        applyFilters();

    } catch (error) {
        console.error('❌ ユーザーデータ読み込みエラー:', error);
        showUserMessage('ユーザーデータの読み込みに失敗しました: ' + error.message, 'error');
    }
}

// 都道府県フィルターのオプションを生成
function populatePrefectureFilter() {
    const prefectures = [...new Set(allUsers.map(u => u.prefecture).filter(p => p))];
    prefectures.sort();

    const filterSelect = document.getElementById('filter-prefecture');
    // 既存のオプション（「全て」）以外を削除
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }

    prefectures.forEach(pref => {
        const option = document.createElement('option');
        option.value = pref;
        option.textContent = pref;
        filterSelect.appendChild(option);
    });
}

// フィルターを適用
function applyFilters() {
    const professionFilter = document.getElementById('filter-profession').value;
    const prefectureFilter = document.getElementById('filter-prefecture').value;

    filteredUsers = allUsers.filter(user => {
        const matchProfession = !professionFilter || user.profession === professionFilter;
        const matchPrefecture = !prefectureFilter || user.prefecture === prefectureFilter;
        return matchProfession && matchPrefecture;
    });

    applySorting();
}

// ソートを適用
function applySorting() {
    const sortBy = document.getElementById('sort-by').value;
    const [field, order] = sortBy.split('-');

    filteredUsers.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];

        // 日付型の処理
        if (field === 'lastVisit') {
            aVal = aVal ? aVal.getTime() : 0;
            bVal = bVal ? bVal.getTime() : 0;
        }

        // 文字列の処理
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (order === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    renderUsersTable();
}

// レベルに応じた★を取得
function getStarsByLevel(level) {
    const numLevel = parseInt(level) || 1;

    if (numLevel >= 100) return "★★★★★";
    if (numLevel >= 90) return "★★★★";
    if (numLevel >= 80) return "★★★";
    if (numLevel >= 70) return "★★";
    if (numLevel >= 60) return "★";
    return "";  // Lv60未満は★なし
}

// ユーザーテーブルを描画
function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">ユーザーが見つかりません</td></tr>';
    } else {
        filteredUsers.forEach(user => {
            const row = document.createElement('tr');

            // アビリティの表示
            let abilitiesHtml = '';
            if (user.abilities && user.abilities.length > 0) {
                abilitiesHtml = user.abilities.map(ability => `<span class="ability-badge">${escapeHtml(ability.name)}</span>`).join(' ');
            } else {
                abilitiesHtml = '<span style="color: #999;">-</span>';
            }

            // 無料券の表示
            let freeTicketsHtml = '';
            if (user.freeTickets && user.freeTickets.length > 0) {
                const unused = user.freeTickets.filter(t => !t.used).length;
                const used = user.freeTickets.filter(t => t.used).length;

                freeTicketsHtml = `<div style="font-size: 12px;">`;
                freeTicketsHtml += `<div>未使用: ${unused}枚</div>`;
                freeTicketsHtml += `<div>使用済: ${used}枚</div>`;

                // パスワード一覧を表示
                if (user.freeTickets.some(t => t.password)) {
                    freeTicketsHtml += `<div style="margin-top: 5px; font-size: 11px; color: #666;">`;
                    user.freeTickets.forEach(ticket => {
                        if (ticket.password) {
                            freeTicketsHtml += `<div>Lv${ticket.level}: ${ticket.password} ${ticket.used ? '(使用済)' : ''}</div>`;
                        }
                    });
                    freeTicketsHtml += `</div>`;
                }
                freeTicketsHtml += `</div>`;
            } else {
                freeTicketsHtml = '<span style="color: #999;">-</span>';
            }

            // ★を取得
            const stars = getStarsByLevel(user.level);
            const nameWithStars = stars ? `${escapeHtml(user.name)} <span class="star-display">${stars}</span>` : escapeHtml(user.name);

            row.innerHTML = `
                <td>${nameWithStars}</td>
                <td><span class="level-badge-small">Lv.${user.level}</span></td>
                <td>${escapeHtml(user.profession)}</td>
                <td>${escapeHtml(user.affiliation)}</td>
                <td>${escapeHtml(user.prefecture)}</td>
                <td>${user.experience}年</td>
                <td><strong>${user.exp.toLocaleString()}</strong></td>
                <td>${user.participationCount}回</td>
                <td>${user.lastVisit ? formatDate(user.lastVisit) : '未参加'}</td>
                <td>${abilitiesHtml}</td>
                <td>${freeTicketsHtml}</td>
                <td><button class="btn btn-small btn-info ability-manage-btn" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}">アビリティ管理</button></td>
                <td><button class="btn btn-small btn-danger delete-user-btn" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}">削除</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    // 統計を更新
    document.getElementById('total-users').textContent = allUsers.length;
    document.getElementById('filtered-users').textContent = filteredUsers.length;

    console.log('✅ ユーザーテーブル描画完了:', filteredUsers.length, '件');
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット
function formatDate(date) {
    if (!date) return '';
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// CSVエクスポート
function exportCSV() {
    try {
        console.log('📥 CSVエクスポート開始');

        // CSVヘッダー
        const headers = ['名前', 'レベル', '称号', '職種', '所属', '都道府県', '経験年数', '累積経験値', '参加回数', '最終参加日', '登録日'];

        // CSVデータ
        const rows = filteredUsers.map(user => [
            user.name,
            user.level,
            user.title,
            user.profession,
            user.affiliation,
            user.prefecture,
            user.experience,
            user.exp,
            user.participationCount,
            user.lastVisit ? formatDate(user.lastVisit) : '',
            user.createdAt ? formatDate(user.createdAt) : ''
        ]);

        // CSV文字列を生成
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // BOM付きUTF-8でエンコード（Excel対応）
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

        // ダウンロードリンクを生成
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ CSVエクスポート完了');
        showUserMessage('CSVファイルをダウンロードしました', 'success');

    } catch (error) {
        console.error('❌ CSVエクスポートエラー:', error);
        showUserMessage('CSVエクスポートに失敗しました: ' + error.message, 'error');
    }
}

// ユーザー管理用のメッセージ表示
function showUserMessage(text, type = 'success') {
    const message = document.getElementById('message');
    if (!message) {
        alert(text);
        return;
    }

    message.textContent = text;
    message.className = `message show ${type}`;

    setTimeout(() => {
        message.classList.remove('show');
    }, 3000);
}

// ============================================
// アビリティ管理機能
// ============================================

// ユーザー選択セレクトボックスを更新
function populateAbilityUserSelect() {
    const selectEl = document.getElementById('ability-user-select');
    if (!selectEl) {
        console.warn('⚠️ ability-user-select 要素が見つかりません');
        return;
    }

    // 既存のオプションをクリア
    selectEl.innerHTML = '<option value="">ユーザーを選択</option>';

    // レベル順にソート
    const sortedUsers = [...allUsers].sort((a, b) => b.level - a.level);

    sortedUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (Lv.${user.level})`;
        selectEl.appendChild(option);
    });

    console.log('✅ ユーザー選択セレクトボックスを更新:', allUsers.length, '件');
}

// アビリティを付与
async function grantAbility() {
    try {
        console.log('📜 アビリティ付与開始');

        const userSelectEl = document.getElementById('ability-user-select');
        const abilityNameEl = document.getElementById('ability-name');
        const abilityDescEl = document.getElementById('ability-description');

        const userId = userSelectEl.value;
        const abilityName = abilityNameEl.value.trim();
        const abilityDesc = abilityDescEl.value.trim();

        // バリデーション
        if (!userId) {
            showUserMessage('ユーザーを選択してください', 'error');
            return;
        }

        if (!abilityName) {
            showUserMessage('アビリティ名を入力してください', 'error');
            return;
        }

        console.log('📜 付与情報:', { userId, abilityName, abilityDesc });

        // ユーザーデータを取得
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showUserMessage('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userDoc.data();
        const abilities = userData.abilities || [];

        // 同じ名前のアビリティが既に存在するかチェック
        const exists = abilities.some(ability => ability.name === abilityName);
        if (exists) {
            showUserMessage('同じ名前のアビリティが既に存在します', 'error');
            return;
        }

        // 新しいアビリティを追加
        // ★重要: serverTimestamp()は配列内では使用できないため、Date.now()を使用
        const currentTimestamp = Date.now();
        const newAbility = {
            name: abilityName,
            description: abilityDesc || '',
            grantedAt: currentTimestamp, // Unix タイムスタンプ（ミリ秒）
            grantedBy: 'admin' // 実際の管理者IDがあれば使用
        };

        console.log('📝 [アビリティ付与] 追加するアビリティ:', newAbility);
        console.log('📝 [アビリティ付与] grantedAt (Unix):', currentTimestamp);
        console.log('📝 [アビリティ付与] grantedAt (日付):', new Date(currentTimestamp).toLocaleString('ja-JP'));

        abilities.push(newAbility);

        // Firestoreに保存
        await db.collection('users').doc(userId).update({
            abilities: abilities
        });

        console.log('✅ アビリティ付与完了:', newAbility);
        showUserMessage(`${userData.name} に「${abilityName}」を付与しました`, 'success');

        // フォームをクリア
        abilityNameEl.value = '';
        abilityDescEl.value = '';
        userSelectEl.value = '';

        // ユーザーリストを再読み込み
        await loadUsers();

    } catch (error) {
        console.error('❌ アビリティ付与エラー:', error);
        showUserMessage('アビリティの付与に失敗しました: ' + error.message, 'error');
    }
}

// アビリティ管理モーダルを開く
async function openAbilityManagementModal(userId, userName) {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏅 [モーダル表示] アビリティ管理モーダルを開く開始');
        console.log('📋 [モーダル表示] ユーザー情報:', { userId, userName });

        currentAbilityUserId = userId;
        currentAbilityUserName = userName;

        // ステップ1: モーダル要素を取得
        console.log('🔍 [モーダル表示] ステップ1: モーダル要素を取得中...');
        const modal = document.getElementById('ability-management-modal');
        console.log('🔍 [モーダル表示] モーダル要素:', modal);

        if (!modal) {
            console.error('❌ [モーダル表示] エラー: モーダル要素が見つかりません！');
            showUserMessage('モーダル要素が見つかりません', 'error');
            return;
        }
        console.log('✅ [モーダル表示] モーダル要素取得成功');
        console.log('🔍 [モーダル表示] 現在のdisplayスタイル:', modal.style.display);

        // ステップ2: モーダルのタイトルを設定
        console.log('🔍 [モーダル表示] ステップ2: タイトルを設定中...');
        const usernameEl = document.getElementById('ability-modal-username');
        console.log('🔍 [モーダル表示] タイトル要素:', usernameEl);

        if (usernameEl) {
            usernameEl.textContent = userName;
            console.log('✅ [モーダル表示] タイトル設定完了:', userName);
        } else {
            console.warn('⚠️ [モーダル表示] 警告: タイトル要素が見つかりません');
        }

        // ステップ3: ユーザーのアビリティを取得
        console.log('🔍 [モーダル表示] ステップ3: Firestoreからアビリティを取得中...');
        const userDoc = await db.collection('users').doc(userId).get();
        console.log('🔍 [モーダル表示] ドキュメント存在:', userDoc.exists);

        if (!userDoc.exists) {
            console.error('❌ [モーダル表示] エラー: ユーザーが見つかりません');
            showUserMessage('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userDoc.data();
        const abilities = userData.abilities || [];
        console.log('✅ [モーダル表示] アビリティ取得完了:', abilities.length, '件');
        console.log('📊 [モーダル表示] アビリティ詳細:', abilities);

        // ステップ4: アビリティリストを表示
        console.log('🔍 [モーダル表示] ステップ4: アビリティリストを描画中...');
        renderAbilitiesList(abilities);
        console.log('✅ [モーダル表示] アビリティリスト描画完了');

        // ステップ5: モーダルを表示
        console.log('🔍 [モーダル表示] ステップ5: モーダルを表示中...');
        console.log('🔍 [モーダル表示] 表示前のdisplayスタイル:', modal.style.display);

        // displayスタイルを'flex'に設定
        modal.style.display = 'flex';

        console.log('🔍 [モーダル表示] 表示後のdisplayスタイル:', modal.style.display);
        console.log('🔍 [モーダル表示] モーダルのクラス名:', modal.className);
        console.log('🔍 [モーダル表示] モーダルの計算スタイル:', window.getComputedStyle(modal).display);

        console.log('✅ [モーダル表示] モーダル表示設定完了');
        console.log('✅ [モーダル表示] アビリティ管理モーダル表示処理完了');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [モーダル表示] エラー発生！');
        console.error('❌ [モーダル表示] エラーメッセージ:', error.message);
        console.error('❌ [モーダル表示] エラースタック:', error.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        showUserMessage('モーダルの表示に失敗しました: ' + error.message, 'error');
    }
}

// アビリティリストを描画
function renderAbilitiesList(abilities) {
    const listEl = document.getElementById('current-abilities-list');
    if (!listEl) {
        console.warn('⚠️ current-abilities-list 要素が見つかりません');
        return;
    }

    if (!abilities || abilities.length === 0) {
        listEl.innerHTML = '<p style="color: #999;">アビリティがありません</p>';
        return;
    }

    listEl.innerHTML = '';

    abilities.forEach((ability, index) => {
        const abilityDiv = document.createElement('div');
        abilityDiv.className = 'ability-item';
        abilityDiv.style.cssText = 'padding: 10px; margin: 5px 0; background: #f0f0f0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;';

        // 付与日時の表示を修正（Unix タイムスタンプまたはFirestore Timestampに対応）
        let grantedAtText = '不明';
        if (ability.grantedAt) {
            try {
                // ability.grantedAt が数値（Unix タイムスタンプ）の場合
                if (typeof ability.grantedAt === 'number') {
                    grantedAtText = new Date(ability.grantedAt).toLocaleString('ja-JP');
                    console.log('📅 [日付表示] Unix タイムスタンプ:', ability.grantedAt, '→', grantedAtText);
                }
                // ability.grantedAt が Firestore Timestamp オブジェクトの場合
                else if (ability.grantedAt.seconds) {
                    grantedAtText = new Date(ability.grantedAt.seconds * 1000).toLocaleString('ja-JP');
                    console.log('📅 [日付表示] Firestore Timestamp:', ability.grantedAt.seconds, '→', grantedAtText);
                }
                // ability.grantedAt がISO文字列の場合
                else if (typeof ability.grantedAt === 'string') {
                    grantedAtText = new Date(ability.grantedAt).toLocaleString('ja-JP');
                    console.log('📅 [日付表示] ISO文字列:', ability.grantedAt, '→', grantedAtText);
                }
            } catch (error) {
                console.warn('⚠️ [日付表示] 日付変換エラー:', error);
                grantedAtText = '不明';
            }
        }

        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            <strong>${escapeHtml(ability.name)}</strong><br>
            ${ability.description ? `<small>${escapeHtml(ability.description)}</small><br>` : ''}
            <small style="color: #666;">付与日時: ${grantedAtText}</small>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'btn btn-small btn-danger';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.onclick = () => deleteAbility(index, ability.name);

        abilityDiv.appendChild(infoDiv);
        abilityDiv.appendChild(deleteBtn);
        listEl.appendChild(abilityDiv);
    });
}

// アビリティを削除
async function deleteAbility(index, abilityName) {
    try {
        if (!confirm(`「${abilityName}」を削除しますか？`)) {
            return;
        }

        console.log('🗑️ アビリティ削除開始:', { userId: currentAbilityUserId, index, abilityName });

        // ユーザーデータを取得
        const userDoc = await db.collection('users').doc(currentAbilityUserId).get();
        if (!userDoc.exists) {
            showUserMessage('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userDoc.data();
        const abilities = userData.abilities || [];

        // 指定されたインデックスのアビリティを削除
        abilities.splice(index, 1);

        // Firestoreに保存
        await db.collection('users').doc(currentAbilityUserId).update({
            abilities: abilities
        });

        console.log('✅ アビリティ削除完了');
        showUserMessage(`「${abilityName}」を削除しました`, 'success');

        // アビリティリストを再描画
        renderAbilitiesList(abilities);

        // ユーザーリストを再読み込み
        await loadUsers();

    } catch (error) {
        console.error('❌ アビリティ削除エラー:', error);
        showUserMessage('アビリティの削除に失敗しました: ' + error.message, 'error');
    }
}

// モーダルからアビリティを追加
async function addAbilityFromModal() {
    try {
        console.log('📜 モーダルからアビリティ追加開始');

        const abilityNameEl = document.getElementById('modal-ability-name');
        const abilityDescEl = document.getElementById('modal-ability-description');

        const abilityName = abilityNameEl.value.trim();
        const abilityDesc = abilityDescEl.value.trim();

        if (!abilityName) {
            showUserMessage('アビリティ名を入力してください', 'error');
            return;
        }

        console.log('📜 追加情報:', { userId: currentAbilityUserId, abilityName, abilityDesc });

        // ユーザーデータを取得
        const userDoc = await db.collection('users').doc(currentAbilityUserId).get();
        if (!userDoc.exists) {
            showUserMessage('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userDoc.data();
        const abilities = userData.abilities || [];

        // 同じ名前のアビリティが既に存在するかチェック
        const exists = abilities.some(ability => ability.name === abilityName);
        if (exists) {
            showUserMessage('同じ名前のアビリティが既に存在します', 'error');
            return;
        }

        // 新しいアビリティを追加
        // ★重要: serverTimestamp()は配列内では使用できないため、Date.now()を使用
        const currentTimestamp = Date.now();
        const newAbility = {
            name: abilityName,
            description: abilityDesc || '',
            grantedAt: currentTimestamp, // Unix タイムスタンプ（ミリ秒）
            grantedBy: 'admin'
        };

        console.log('📝 [モーダル追加] 追加するアビリティ:', newAbility);
        console.log('📝 [モーダル追加] grantedAt (Unix):', currentTimestamp);
        console.log('📝 [モーダル追加] grantedAt (日付):', new Date(currentTimestamp).toLocaleString('ja-JP'));

        abilities.push(newAbility);

        // Firestoreに保存
        await db.collection('users').doc(currentAbilityUserId).update({
            abilities: abilities
        });

        console.log('✅ アビリティ追加完了:', newAbility);
        showUserMessage(`「${abilityName}」を追加しました`, 'success');

        // フォームをクリア
        abilityNameEl.value = '';
        abilityDescEl.value = '';

        // アビリティリストを即座に再描画（Date.now()を使用しているため待つ必要なし）
        renderAbilitiesList(abilities);

        // ユーザーリストを再読み込み
        await loadUsers();

    } catch (error) {
        console.error('❌ アビリティ追加エラー:', error);
        showUserMessage('アビリティの追加に失敗しました: ' + error.message, 'error');
    }
}

// アビリティ管理モーダルを閉じる
function closeAbilityManagementModal() {
    const modal = document.getElementById('ability-management-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // フォームをクリア
    const abilityNameEl = document.getElementById('modal-ability-name');
    const abilityDescEl = document.getElementById('modal-ability-description');
    if (abilityNameEl) abilityNameEl.value = '';
    if (abilityDescEl) abilityDescEl.value = '';

    currentAbilityUserId = null;
    currentAbilityUserName = '';
}

// ユーザーを削除
async function deleteUser(userId, userName) {
    try {
        console.log('🗑️ ユーザー削除開始:', { userId, userName });

        // 確認ダイアログを表示
        const confirmMessage = `本当に ${userName} を削除しますか？\n\nこの操作は取り消せません。`;
        if (!confirm(confirmMessage)) {
            console.log('⚠️ ユーザー削除がキャンセルされました');
            return;
        }

        console.log('🔄 Firestoreからユーザーを削除中...');

        // Firestoreからユーザーを削除
        await db.collection('users').doc(userId).delete();

        console.log('✅ ユーザー削除完了');
        showUserMessage(`${userName} を削除しました`, 'success');

        // ユーザーリストを再読み込み
        await loadUsers();

    } catch (error) {
        console.error('❌ ユーザー削除エラー:', error);
        showUserMessage('ユーザーの削除に失敗しました: ' + error.message, 'error');
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 [アビリティ管理] DOMContentLoaded: イベントリスナー設定開始');

    // アビリティ付与ボタン
    const grantAbilityBtn = document.getElementById('grant-ability-btn');
    if (grantAbilityBtn) {
        grantAbilityBtn.addEventListener('click', grantAbility);
        console.log('✅ [アビリティ管理] アビリティ付与ボタンのイベント設定完了');
    } else {
        console.warn('⚠️ [アビリティ管理] grant-ability-btn が見つかりません');
    }

    // モーダルからのアビリティ追加ボタン
    const modalAddBtn = document.getElementById('modal-add-ability-btn');
    if (modalAddBtn) {
        modalAddBtn.addEventListener('click', addAbilityFromModal);
        console.log('✅ [アビリティ管理] モーダル追加ボタンのイベント設定完了');
    } else {
        console.warn('⚠️ [アビリティ管理] modal-add-ability-btn が見つかりません');
    }

    // モーダルを閉じるボタン
    const closeModalBtn = document.getElementById('close-ability-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAbilityManagementModal);
        console.log('✅ [アビリティ管理] モーダルを閉じるボタンのイベント設定完了');
    } else {
        console.warn('⚠️ [アビリティ管理] close-ability-modal-btn が見つかりません');
    }

    // ★重要: ユーザーテーブルのアビリティ管理ボタン用イベント委譲
    // テーブルは動的に生成されるため、イベント委譲を使用
    document.addEventListener('click', (e) => {
        // アビリティ管理ボタンがクリックされたかチェック
        if (e.target.classList.contains('ability-manage-btn')) {
            console.log('🖱️ [アビリティ管理] アビリティ管理ボタンがクリックされました');

            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;

            console.log('📋 [アビリティ管理] ユーザー情報:', { userId, userName });

            if (!userId) {
                console.error('❌ [アビリティ管理] ユーザーIDが取得できません');
                showUserMessage('ユーザーIDが取得できません', 'error');
                return;
            }

            // アビリティ管理モーダルを開く
            openAbilityManagementModal(userId, userName);
        }

        // ユーザー削除ボタンがクリックされたかチェック
        if (e.target.classList.contains('delete-user-btn')) {
            console.log('🖱️ [ユーザー削除] 削除ボタンがクリックされました');

            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;

            console.log('📋 [ユーザー削除] ユーザー情報:', { userId, userName });

            if (!userId) {
                console.error('❌ [ユーザー削除] ユーザーIDが取得できません');
                showUserMessage('ユーザーIDが取得できません', 'error');
                return;
            }

            // ユーザーを削除
            deleteUser(userId, userName);
        }
    });

    console.log('✅ [アビリティ管理] イベント委譲設定完了（ability-manage-btn）');
    console.log('✅ [ユーザー削除] イベント委譲設定完了（delete-user-btn）');
    console.log('✅ [アビリティ管理] すべてのイベントリスナー設定完了');
});

// ============================================
// 無料券パスワード検証機能
// ============================================

// 無料券パスワードを検証
async function verifyFreeTicket() {
    try {
        console.log('🎫 [無料券検証] 検証開始');

        const passwordInput = document.getElementById('ticket-password-input');
        const password = passwordInput.value.trim();

        if (!password) {
            alert('パスワードを入力してください');
            return;
        }

        console.log('🔍 [無料券検証] 検証パスワード:', password);

        // 全ユーザーの無料券を検索
        const usersSnapshot = await db.collection('users').get();

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const freeTickets = userData.freeTickets || [];

            const ticket = freeTickets.find(t => t.password === password);

            if (ticket) {
                // 見つかった
                console.log('✅ [無料券検証] 有効なパスワードが見つかりました');
                displayTicketInfo({
                    userName: userData.name,
                    level: ticket.level,
                    used: ticket.used,
                    userId: userDoc.id,
                    password: password
                });
                return;
            }
        }

        // 見つからない
        console.log('❌ [無料券検証] パスワードが見つかりませんでした');
        alert('無効なパスワードです');

        // 結果エリアをクリア
        const resultDiv = document.getElementById('ticket-verification-result');
        if (resultDiv) {
            resultDiv.innerHTML = '';
        }

    } catch (error) {
        console.error('❌ [無料券検証] エラー:', error);
        alert('検証エラー: ' + error.message);
    }
}

// 無料券情報を表示
function displayTicketInfo(info) {
    try {
        console.log('📋 [無料券検証] 情報表示:', info);

        const resultDiv = document.getElementById('ticket-verification-result');
        if (!resultDiv) {
            console.error('❌ [無料券検証] 結果表示エリアが見つかりません');
            return;
        }

        const backgroundColor = info.used ? '#fee' : '#efe';
        const statusText = info.used ? '使用済み' : '未使用';
        const usedButton = !info.used ?
            `<button onclick="markTicketAsUsed('${info.userId}', '${info.password}')" class="btn btn-warning" style="margin-top: 10px;">使用済みにする</button>` :
            '';

        resultDiv.innerHTML = `
            <div style="padding: 15px; background: ${backgroundColor}; border-radius: 8px; border: 2px solid #999; margin-top: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #000;">✅ 有効なパスワードです</h4>
                <p style="margin: 5px 0; color: #000;"><strong>ユーザー:</strong> ${escapeHtml(info.userName)}</p>
                <p style="margin: 5px 0; color: #000;"><strong>発行レベル:</strong> Lv${info.level}</p>
                <p style="margin: 5px 0; color: #000;"><strong>使用状況:</strong> ${statusText}</p>
                ${usedButton}
            </div>
        `;

        console.log('✅ [無料券検証] 情報表示完了');

    } catch (error) {
        console.error('❌ [無料券検証] 情報表示エラー:', error);
    }
}

// 無料券を使用済みにする
async function markTicketAsUsed(userId, password) {
    try {
        console.log('🎫 [無料券使用済み] 処理開始:', { userId, password });

        if (!confirm('この無料券を使用済みにしますか？')) {
            return;
        }

        // ユーザーデータを取得
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            alert('ユーザーが見つかりません');
            return;
        }

        const userData = userDoc.data();
        const freeTickets = userData.freeTickets || [];

        // パスワードに一致する無料券を使用済みに更新
        const updatedTickets = freeTickets.map(ticket => {
            if (ticket.password === password) {
                return {
                    ...ticket,
                    used: true,
                    usedAt: new Date().toISOString()
                };
            }
            return ticket;
        });

        // Firestoreに保存
        await db.collection('users').doc(userId).update({
            freeTickets: updatedTickets
        });

        console.log('✅ [無料券使用済み] 更新完了');
        alert('無料券を使用済みにしました');

        // 再検証して表示を更新
        verifyFreeTicket();

    } catch (error) {
        console.error('❌ [無料券使用済み] エラー:', error);
        alert('更新エラー: ' + error.message);
    }
}