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
    generateNewPassword() {
        try {
            console.log('🎲 新しいパスワード生成開始');

            const newPassword = this.generateRandomPassword();
            const timestamp = new Date().toLocaleString('ja-JP');

            // ローカルストレージに保存（有効期限を追加）
            const now = Date.now();
            const expiryTime = now + this.PASSWORD_VALIDITY_MS;
            const passwordData = {
                password: newPassword,
                generatedAt: timestamp,
                generatedTimestamp: now,
                expiryTimestamp: expiryTime,
                expiryAt: new Date(expiryTime).toLocaleString('ja-JP')
            };

            localStorage.setItem('currentPassword', JSON.stringify(passwordData));

            // 既存の使用履歴をリセット（新しいパスワードなので）
            localStorage.removeItem('passwordUsageHistory');
            localStorage.setItem('passwordUsageCount', '0');

            this.showMessage(`✅ 新しいパスワードを生成しました: ${newPassword}`, 'success');

            // 表示を更新
            this.updatePasswordStatus();
            this.updateUsageStats();
            this.startTimeUpdate();

            console.log('✅ パスワード生成完了:', newPassword);

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

    // 使用統計を更新
    updateUsageStats() {
        try {
            const usageCount = parseInt(localStorage.getItem('passwordUsageCount')) || 0;
            const lastUsage = localStorage.getItem('lastPasswordUsage') || '未使用';

            const usageCountEl = document.getElementById('usage-count');
            const lastUsageEl = document.getElementById('last-usage');

            if (usageCountEl) usageCountEl.textContent = usageCount;
            if (lastUsageEl) lastUsageEl.textContent = lastUsage;

        } catch (error) {
            console.error('❌ 使用統計更新エラー:', error);
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
    generateRescuePassword() {
        try {
            console.log('🆘 救済パスワード生成開始');

            const pointsInput = document.getElementById('rescue-points');
            const points = parseInt(pointsInput.value) || 5;

            if (points < 1 || points > 100) {
                this.showMessage('ポイント数は1〜100の範囲で入力してください', 'error');
                return;
            }

            // ランダムパスワード生成
            const rescuePassword = this.generateRandomPassword();
            const timestamp = new Date().toLocaleString('ja-JP');

            // 救済パスワードデータを保存（LocalStorageに保存）
            const rescueData = {
                password: rescuePassword,
                points: points,
                generatedAt: timestamp,
                generatedTimestamp: Date.now()
            };

            localStorage.setItem('rescuePassword', JSON.stringify(rescueData));

            // 表示を更新
            this.showRescuePassword(rescuePassword, points, timestamp);
            this.showMessage(`✅ ${points}ポイント用救済パスワードを生成しました: ${rescuePassword}`, 'success');

            console.log('✅ 救済パスワード生成完了:', rescueData);

        } catch (error) {
            console.error('❌ 救済パスワード生成エラー:', error);
            this.showMessage(`生成エラー: ${error.message}`, 'error');
        }
    }

    // 救済パスワードを表示
    showRescuePassword(password, points, timestamp) {
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

            if (rescuePointsDisplay) rescuePointsDisplay.textContent = points;
            if (rescuePointsDisplay2) rescuePointsDisplay2.textContent = points;
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