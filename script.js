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

class StampApp {
    constructor() {
        this.points = parseInt(localStorage.getItem('points')) || 0;
        this.stampCount = parseInt(localStorage.getItem('stampCount')) || 0;
        this.usedCoupons = JSON.parse(localStorage.getItem('usedCoupons')) || [];
        this.scannedCodes = JSON.parse(localStorage.getItem('scannedCodes')) || [];

        // 固定パスワード（フォールバック用）
        this.FALLBACK_PASSWORD = '1580';

        // QRスキャン機能は削除（パスワード入力のみ）

        this.updateStatus('アプリ初期化中...');
        this.initializeApp();
        this.bindEvents();
        this.updateStatus('アプリ準備完了');
    }

    updateStatus(message) {
        const statusEl = document.getElementById('status-display');
        if (statusEl) {
            statusEl.textContent = `ステータス: ${message}`;
        }
        console.log(`📱 ${message}`);
    }

    // パスワードが期限切れかチェック
    isPasswordExpired(passwordData) {
        if (!passwordData || !passwordData.expiryTimestamp) {
            return false; // 期限情報がない場合は期限切れではないとみなす（フォールバック用）
        }
        return Date.now() > passwordData.expiryTimestamp;
    }

    // 現在有効なパスワードを取得
    getCurrentValidPassword() {
        try {
            // 管理者システムから生成されたパスワードを確認
            const adminPasswordData = localStorage.getItem('currentPassword');
            if (adminPasswordData) {
                const data = JSON.parse(adminPasswordData);
                if (data && data.password) {
                    // 有効期限をチェック
                    if (this.isPasswordExpired(data)) {
                        console.log('⚠️ 管理者生成パスワードが期限切れです');
                        return null; // 期限切れの場合はnullを返す
                    }
                    console.log('✅ 管理者生成パスワードを取得:', data.password);
                    return data.password;
                }
            }

            // フォールバック: 固定パスワード
            console.log('⚠️ 管理者パスワードが見つからないため、フォールバックパスワードを使用');
            return this.FALLBACK_PASSWORD;

        } catch (error) {
            console.error('❌ パスワード取得エラー:', error);
            return this.FALLBACK_PASSWORD;
        }
    }

    // パスワードが正しいかチェック（Firestore版）
    async isValidPassword(password) {
        try {
            // Firestoreからパスワード情報を取得
            const doc = await db.collection('passwords').doc(password).get();

            if (!doc.exists) {
                console.log('🔍 パスワード認証: パスワードが存在しません');
                return false;
            }

            const passwordData = doc.data();

            // 期限切れチェック
            if (passwordData.expiryTimestamp && Date.now() > passwordData.expiryTimestamp) {
                console.log('🔍 パスワード認証: 期限切れ');
                return 'expired';
            }

            // 使用済みチェック
            if (passwordData.used) {
                console.log('🔍 パスワード認証: 既に使用済み');
                return 'used';
            }

            console.log('🔍 パスワード認証: 有効');
            return true;

        } catch (error) {
            console.error('❌ パスワード検証エラー:', error);
            // エラー時はlocalStorageにフォールバック
            const validPassword = this.getCurrentValidPassword();
            if (validPassword === null) {
                return 'expired';
            }
            return password === validPassword;
        }
    }

    // 救済パスワードかチェック
    isRescuePassword(password) {
        try {
            const rescueData = this.getRescuePasswordData();
            if (!rescueData) return null;

            if (password === rescueData.password) {
                console.log('🆘 救済パスワード認証成功:', rescueData);
                return rescueData;
            }

            return null;
        } catch (error) {
            console.error('❌ 救済パスワード確認エラー:', error);
            return null;
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

    // パスワードが既に使用済みかチェック
    isPasswordAlreadyUsed() {
        const currentPassword = this.getCurrentValidPassword();
        return this.scannedCodes.includes(currentPassword);
    }

    // 入力を安全に正規化
    normalizeInput(rawInput) {
        return String(rawInput || '').trim();
    }

    initializeApp() {
        console.log('🔧 initializeApp 開始');
        this.updatePointsDisplay();
        this.updateStampDisplay();
        this.checkCouponAvailability();
        this.updatePasswordExpiryDisplay();
        this.debugDOMElements();
        console.log('🔧 initializeApp 完了');
    }

    debugDOMElements() {
        console.log('🔍 DOM要素の確認開始');
        const requiredElements = [
            'manual-scan', 'manual-qr', 'use-coupon', 'status-display'
        ];

        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`✅ ${id}: 存在します (${element.tagName})`);
                if (element.tagName === 'BUTTON') {
                    console.log(`   - テキスト: "${element.textContent}"`);
                    console.log(`   - 無効化: ${element.disabled}`);
                    console.log(`   - 表示: ${element.style.display || 'default'}`);
                }
            } else {
                console.error(`❌ ${id}: 見つかりません`);
            }
        });
        console.log('🔍 DOM要素の確認完了');
    }

    bindEvents() {
        console.log('🔧 bindEvents 開始');
        this.updateStatus('イベント設定中...');

        // 安全なイベント設定関数
        const safeBindClick = (elementId, handler, description) => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`❌ 要素が見つかりません: ${elementId}`);
                return false;
            }

            console.log(`🔧 ${elementId} にイベント設定中...`);

            // 単一のクリックイベントのみ（重複回避）
            const clickHandler = (event) => {
                event.preventDefault();
                event.stopPropagation();

                console.log(`🖱️ ${elementId} がクリックされました`);
                this.updateStatus(`${description} 実行中...`);

                try {
                    handler.call(this);
                    console.log(`✅ ${elementId} 処理完了`);
                } catch (error) {
                    console.error(`❌ ${elementId} エラー:`, error);
                    this.showMessage(`エラーが発生しました: ${error.message}`, 'error');
                }
            };

            element.addEventListener('click', clickHandler);
            console.log(`✅ ${elementId} イベント設定完了`);
            return true;
        };

        // 基本ボタン
        safeBindClick('use-coupon', this.useCoupon, 'クーポン使用');
        safeBindClick('manual-scan', this.manualPasswordInput, 'パスワード入力');

        // パスワード入力
        const passwordInput = document.getElementById('manual-qr');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.manualPasswordInput();
                }
            });
            console.log('✅ パスワード入力イベント設定完了');
        }

        this.updateStatus('イベント設定完了');
        console.log('🔧 bindEvents 完了');
    }

    // 管理者システムにパスワード使用を通知
    notifyPasswordUsage() {
        try {
            console.log('📊 パスワード使用通知送信開始');

            const currentCount = parseInt(localStorage.getItem('passwordUsageCount')) || 0;
            const newCount = currentCount + 1;
            const timestamp = new Date().toLocaleString('ja-JP');

            localStorage.setItem('passwordUsageCount', newCount.toString());
            localStorage.setItem('lastPasswordUsage', timestamp);

            console.log('✅ 使用統計更新完了:', {
                使用回数: newCount,
                最終使用時刻: timestamp
            });

        } catch (error) {
            console.error('❌ パスワード使用通知エラー:', error);
        }
    }

    // 受講生側でパスワード有効期限を表示
    updatePasswordExpiryDisplay() {
        try {
            const expiryDisplay = document.getElementById('password-expiry-display');
            const expiryTime = document.getElementById('password-expiry-time');

            if (!expiryDisplay || !expiryTime) return;

            // 管理者システムからパスワード情報を取得
            const adminPasswordData = localStorage.getItem('currentPassword');
            if (!adminPasswordData) {
                expiryDisplay.style.display = 'none';
                return;
            }

            const data = JSON.parse(adminPasswordData);
            if (!data || !data.expiryTimestamp) {
                expiryDisplay.style.display = 'none';
                return;
            }

            // 有効期限を表示
            const expiryDate = new Date(data.expiryTimestamp);
            const now = Date.now();
            const remainingMs = data.expiryTimestamp - now;
            const remainingMinutes = Math.floor(remainingMs / (1000 * 60));

            if (remainingMs <= 0) {
                expiryTime.textContent = '期限切れ';
                expiryDisplay.className = 'password-expiry-display expired';
            } else {
                expiryTime.textContent = expiryDate.toLocaleString('ja-JP');

                if (remainingMinutes < 30) {
                    expiryDisplay.className = 'password-expiry-display expired';
                } else if (remainingMinutes < 60) {
                    expiryDisplay.className = 'password-expiry-display warning';
                } else {
                    expiryDisplay.className = 'password-expiry-display';
                }
            }

            expiryDisplay.style.display = 'block';

        } catch (error) {
            console.error('❌ 有効期限表示更新エラー:', error);
        }
    }

    // simpleTest関数は削除（不要）

    updatePointsDisplay() {
        document.getElementById('pointsDisplay').textContent = this.points;
    }

    updateStampDisplay() {
        document.getElementById('stampCount').textContent = this.stampCount;

        for (let i = 1; i <= 3; i++) {
            const stamp = document.getElementById(`stamp${i}`);
            if (i <= this.stampCount) {
                stamp.classList.add('filled');
                stamp.textContent = '✓';
            } else {
                stamp.classList.remove('filled');
                stamp.textContent = '';
            }
        }
    }

    checkCouponAvailability() {
        if (this.stampCount >= 3) {
            document.getElementById('couponSection').style.display = 'block';
            document.getElementById('couponStatus').textContent = 'クーポンが利用可能です！';
        } else {
            document.getElementById('couponSection').style.display = 'none';
            document.getElementById('couponStatus').textContent = '3つ集めると1000円割引クーポンGET!';
        }
    }

    // QRスキャン機能は削除（パスワード入力のみ使用）

    async handleQRCodeScan(rawInput) {
        try {
            console.log('🔍 パスワード認証開始');
            console.log('📥 受信した入力:', JSON.stringify(rawInput));

            // ステップ1: 入力の正規化
            const normalizedInput = this.normalizeInput(rawInput);
            console.log('🔧 正規化された入力:', normalizedInput);

            // ステップ2: 空入力チェック
            if (!normalizedInput) {
                console.log('❌ 空の入力');
                this.showMessage('❌ パスワードを入力してください', 'error');
                return;
            }

            // ステップ3: 救済パスワードかチェック
            const rescueData = this.isRescuePassword(normalizedInput);
            if (rescueData) {
                console.log('🆘 救済パスワード認証:', rescueData);
                this.processRescuePassword(rescueData);
                return;
            }

            // ステップ4: 通常パスワード認証（Firestore版）
            const validationResult = await this.isValidPassword(normalizedInput);
            if (validationResult === 'expired') {
                console.log('⏰ パスワードが期限切れ:', normalizedInput);
                this.showMessage(
                    `⏰ このパスワードは期限切れです\n\n有効期限が過ぎています\n※ 管理者に新しいパスワードの生成をお尋ねください`,
                    'error'
                );
                return;
            } else if (validationResult === 'used') {
                console.log('⚠️ 既にパスワードが使用済み');
                this.showMessage(
                    `⚠️ このパスワードは既に使用済みです\n\n※ お一人様1回限りです`,
                    'error'
                );
                return;
            } else if (!validationResult) {
                console.log('❌ 無効なパスワード:', normalizedInput);
                this.showMessage(
                    `❌ 無効なパスワードです\n\n入力値: ${normalizedInput}\n※ 管理者にお尋ねください`,
                    'error'
                );
                return;
            }

            // ステップ5: 認証成功 - ポイント・スタンプ付与
            console.log('✅ パスワード認証成功:', normalizedInput);
            await this.processValidPassword(normalizedInput);

        } catch (error) {
            console.error('❌ パスワード認証エラー:', error);
            this.showMessage(`❌ システムエラーが発生しました: ${error.message}`, 'error');
        }
    }

    // 有効なパスワードの処理（Firestore版）
    async processValidPassword(password) {
        try {
            console.log('🎉 パスワード認証処理開始');

            // ポイントとスタンプを追加
            this.addPoints(10);
            this.addStamp();

            // Firestoreでパスワードを使用済みにマーク
            await db.collection('passwords').doc(password).update({
                used: true,
                usedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 使用履歴をFirestoreに保存
            await db.collection('usage_history').add({
                password: password,
                points: 10,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });

            // LocalStorageにも記録（フォールバック用）
            this.scannedCodes.push(password);
            localStorage.setItem('scannedCodes', JSON.stringify(this.scannedCodes));

            // 管理者システムに使用通知を送信
            this.notifyPasswordUsage();

            // 成功メッセージ
            this.showMessage(
                `🎉 認証成功！\n\n+10ポイント獲得\nスタンプ+1\n\n研修参加ありがとうございます！`,
                'success'
            );

            console.log('✅ パスワード認証処理完了:', {
                totalPoints: this.points,
                totalStamps: this.stampCount,
                usedPassword: true
            });

        } catch (error) {
            console.error('❌ パスワード認証処理エラー:', error);
            throw error;
        }
    }

    // 救済パスワードの処理
    processRescuePassword(rescueData) {
        try {
            console.log('🆘 救済パスワード処理開始:', rescueData);

            const points = rescueData.points;

            // 指定されたポイントのみ追加（スタンプなし）
            this.addPoints(points);

            // 救済パスワードを削除（1回限り）
            localStorage.removeItem('rescuePassword');

            // 成功メッセージ
            this.showMessage(
                `🆘 救済パスワード認証成功！\n\n+${points}ポイント獲得\n\n※ スタンプは付与されません`,
                'success'
            );

            console.log('✅ 救済パスワード処理完了:', {
                totalPoints: this.points,
                addedPoints: points,
                noStamp: true
            });

        } catch (error) {
            console.error('❌ 救済パスワード処理エラー:', error);
            throw error;
        }
    }

    addPoints(amount) {
        this.points += amount;
        localStorage.setItem('points', this.points.toString());
        this.updatePointsDisplay();
    }

    addStamp() {
        if (this.stampCount < 3) {
            this.stampCount++;
            localStorage.setItem('stampCount', this.stampCount.toString());
            this.updateStampDisplay();
            this.checkCouponAvailability();
        }
    }

    useCoupon() {
        if (this.stampCount >= 3) {
            const couponCode = 'STAMP50_' + Date.now();
            this.usedCoupons.push(couponCode);
            localStorage.setItem('usedCoupons', JSON.stringify(this.usedCoupons));

            // スタンプをリセット
            this.stampCount = 0;
            localStorage.setItem('stampCount', '0');

            this.updateStampDisplay();
            this.checkCouponAvailability();

            this.showMessage('クーポンを使用しました！スタンプカードがリセットされました。', 'success');
        }
    }

    showMessage(text, type = 'success') {
        try {
            console.log(`メッセージ表示: ${text} (${type})`);
            const message = document.getElementById('message');

            if (!message) {
                console.error('message要素が見つかりません');
                // フォールバック: alertを使用
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
            // 最後の手段としてalertを使用
            alert(text);
        }
    }

    // デモ用：テスト用QRコードスキャンをシミュレート
    simulateQRScan() {
        try {
            console.log('simulateQRScan が実行されました');
            const testQRCode = 'STAMP_TEST_' + Math.random().toString(36).substr(2, 9);
            console.log('生成されたテストQRコード:', testQRCode);

            // 少し遅延を入れて、リアルなスキャン体験を演出
            setTimeout(() => {
                this.handleQRCodeScan(testQRCode);
            }, 100);

        } catch (error) {
            console.error('simulateQRScan エラー:', error);
            this.showMessage('テストスキャンでエラーが発生しました', 'error');
        }
    }

    // パスワード入力機能
    manualPasswordInput() {
        try {
            console.log('🔧 パスワード入力が実行されました');
            this.updateStatus('パスワード確認中...');

            const input = document.getElementById('manual-qr');
            if (!input) {
                console.error('❌ パスワード入力欄が見つかりません');
                this.showMessage('入力欄が見つかりません', 'error');
                return;
            }

            // 入力値を安全に取得
            const password = String(input.value || '').trim();
            console.log('入力されたパスワード:', JSON.stringify(password));

            if (!password) {
                console.log('⚠️ パスワードが空です');
                this.showMessage('パスワードを入力してください', 'error');
                this.updateStatus('パスワードを入力してください');
                return;
            }

            // パスワード認証処理
            this.updateStatus('認証中...');
            this.handleQRCodeScan(password);

            input.value = ''; // 入力欄をクリア
            console.log('✅ パスワード入力完了');

        } catch (error) {
            console.error('❌ パスワード入力でエラーが発生:', error);
            this.showMessage(`パスワード入力でエラーが発生しました: ${error.message}`, 'error');
            this.updateStatus(`エラー: ${error.message}`);
        }
    }

    // デバッグ用：データリセット機能
    resetAppData() {
        localStorage.clear();
        this.points = 0;
        this.stampCount = 0;
        this.usedCoupons = [];
        this.scannedCodes = [];
        this.initializeApp();
        this.showMessage('アプリデータをリセットしました', 'success');
    }
}

// 管理者認証関数
function authenticateAdmin() {
    const password = prompt('管理者パスワードを入力してください:');

    if (password === null) {
        // キャンセルされた場合は何もしない
        return;
    }

    if (password === 'mizukami1985') {
        // 正しいパスワードの場合、admin.htmlに遷移
        window.location.href = 'admin.html';
    } else {
        // 間違ったパスワードの場合、アラート表示
        alert('パスワードが違います');
    }
}

// アプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: アプリ初期化開始');

    try {
        const app = new StampApp();

        // グローバル関数として簡単アクセス
        window.stampApp = app;
        window.testScan = () => app.simulateQRScan();

        // HTMLのonclick属性用のグローバル関数
        window.handleTestScan = () => {
            console.log('🔧 handleTestScan (onclick) が呼び出されました');
            app.simulateQRScan();
        };



        console.log('✅ スタンプアプリが正常に起動しました！');
        console.log('🧪 テスト用コマンド:');
        console.log('  testScan() - QRスキャンテスト');
        console.log('  stampApp.resetAppData() - データリセット');

    } catch (error) {
        console.error('❌ 初期化エラー:', error);
        alert(`初期化失敗: ${error.message}`);
    }
});

// PWA対応のための基本的なサービスワーカー登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker登録成功: ', registration.scope);
            })
            .catch((error) => {
                console.log('ServiceWorker登録失敗: ', error);
            });
    });
}
