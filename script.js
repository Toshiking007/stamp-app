console.log('🔧 script.js 読み込み開始');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDvg3SAKhqcnEiQRlgdCjzT1gLg2GgioN4",
  authDomain: "stamp-app-65e27.firebaseapp.com",
  projectId: "stamp-app-65e27",
  storageBucket: "stamp-app-65e27.firebasestorage.app",
  messagingSenderId: "178934669247",
  appId: "1:178934669247:web:52742f44b4715898d90b0a"
};

console.log('🔧 Firebase設定完了');

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('🔧 Firebase初期化完了');

// 音源管理クラス
class SoundManager {
    constructor() {
        this.sounds = {
            levelup: new Audio('sounds/levelup.mp3'),
            button: new Audio('sounds/button.mp3'),
            decision: new Audio('sounds/decision.mp3'),
            error: new Audio('sounds/error.mp3'),
            bgm: new Audio('sounds/bgm.mp3')
        };

        // BGMはループ再生
        this.sounds.bgm.loop = true;
        this.sounds.bgm.volume = 0.3; // 音量30%

        // その他のSE音量を調整
        this.sounds.levelup.volume = 0.5;
        this.sounds.button.volume = 0.4;
        this.sounds.decision.volume = 0.4;
        this.sounds.error.volume = 0.4;

        this.isMuted = localStorage.getItem('soundMuted') === 'true' || false;

        console.log('🔊 SoundManager 初期化完了', {
            ミュート状態: this.isMuted
        });
    }

    play(soundName) {
        if (this.isMuted) {
            console.log(`🔇 ミュート中: ${soundName}`);
            return;
        }

        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0; // 最初から再生
            sound.play().catch(e => console.log('🔊 音声再生エラー:', soundName, e.message));
            console.log(`🔊 再生: ${soundName}`);
        } else {
            console.warn(`⚠️ 音源が見つかりません: ${soundName}`);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('soundMuted', this.isMuted.toString());

        if (this.isMuted) {
            this.sounds.bgm.pause();
            console.log('🔇 ミュートON');
        } else {
            this.playBGM();
            console.log('🔊 ミュートOFF');
        }

        return this.isMuted;
    }

    playBGM() {
        if (!this.isMuted) {
            this.sounds.bgm.play().catch(e => console.log('🔊 BGM再生エラー:', e.message));
            console.log('🔊 BGM再生開始');
        }
    }

    stopBGM() {
        this.sounds.bgm.pause();
        this.sounds.bgm.currentTime = 0;
        console.log('🔊 BGM停止');
    }
}

// グローバルSoundManagerインスタンス
const soundManager = new SoundManager();

// 称号システム
const TITLES = {
    1: 'みならいセラピスト',
    10: 'たよれるセラピスト',
    20: 'みきわめセラピスト',
    30: 'アドバイザー',
    40: 'ボスのみぎうで',
    50: 'めんきょかいでん',
    60: 'すごうで',
    70: 'たつじん',
    80: 'エキスパート',
    90: 'ゴッドハンド',
    100: 'マスターセラピスト'
};

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

// レベルに応じた称号を取得
function getTitleForLevel(level) {
    console.log("レベル:", level);

    // レベルが数値でない場合は変換
    const numLevel = parseInt(level) || 1;

    let result;
    if (numLevel >= 100) {
        result = "マスターセラピスト";
    } else if (numLevel >= 90) {
        result = "ゴッドハンド";
    } else if (numLevel >= 80) {
        result = "エキスパート";
    } else if (numLevel >= 70) {
        result = "たつじん";
    } else if (numLevel >= 60) {
        result = "すごうで";
    } else if (numLevel >= 50) {
        result = "めんきょかいでん";
    } else if (numLevel >= 40) {
        result = "ボスのみぎうで";
    } else if (numLevel >= 30) {
        result = "アドバイザー";
    } else if (numLevel >= 20) {
        result = "みきわめセラピスト";
    } else if (numLevel >= 10) {
        result = "たよれるセラピスト";
    } else {
        result = "みならいセラピスト";
    }

    console.log("getTitleForLevel(level):", result);
    return result;
}

class StampApp {
    constructor() {
        this.userId = localStorage.getItem('userId') || null;
        this.exp = parseInt(localStorage.getItem('exp')) || 0; // 経験値に変更
        this.level = parseInt(localStorage.getItem('level')) || 1;
        // this.title は削除 - 称号は常にレベルから動的に計算
        this.stampCount = parseInt(localStorage.getItem('stampCount')) || 0;
        this.usedCoupons = JSON.parse(localStorage.getItem('usedCoupons')) || [];
        this.scannedCodes = JSON.parse(localStorage.getItem('scannedCodes')) || [];
        this.participationCount = parseInt(localStorage.getItem('participationCount')) || 0;

        // クラスシステム関連
        this.selectedClass = localStorage.getItem('selectedClass') || null;
        this.classChangedAt = localStorage.getItem('classChangedAt') || null;

        // 固定パスワード（フォールバック用）
        this.FALLBACK_PASSWORD = '1580';

        // 処理中フラグ（重複実行防止）
        this.isProcessing = false;

        // QRスキャン機能は削除（パスワード入力のみ）

        this.updateStatus('アプリ初期化中...');
        this.checkUserRegistration();
    }

    // レベル計算用のメソッド
    // 必要経験値 = 50 + (レベル × 50)
    getExpForLevel(level) {
        return 50 + (level * 50);
    }

    // 現在のレベルの開始経験値を計算
    getExpAtLevel(level) {
        if (level === 1) return 0;
        let totalExp = 0;
        for (let i = 1; i < level; i++) {
            totalExp += this.getExpForLevel(i);
        }
        return totalExp;
    }

    // 経験値から現在のレベルを計算
    calculateLevel(exp) {
        let level = 1;
        let requiredExp = this.getExpForLevel(level);
        let totalExp = 0;

        while (exp >= totalExp + requiredExp) {
            totalExp += requiredExp;
            level++;
            requiredExp = this.getExpForLevel(level);
        }

        return level;
    }

    // 次のレベルまでの経験値を取得
    getExpToNextLevel() {
        const currentLevelStartExp = this.getExpAtLevel(this.level);
        const nextLevelExp = this.getExpForLevel(this.level);
        const currentLevelExp = this.exp - currentLevelStartExp;

        return {
            current: currentLevelExp,
            required: nextLevelExp,
            percentage: (currentLevelExp / nextLevelExp) * 100
        };
    }

    updateStatus(message) {
        const statusEl = document.getElementById('status-display');
        if (statusEl) {
            statusEl.textContent = `ステータス: ${message}`;
        }
        console.log(`📱 ${message}`);
    }

    // ユーザー登録チェック
    checkUserRegistration() {
        if (!this.userId) {
            console.log('👤 ユーザー未登録 - 登録フォーム表示');
            // ユーザー未登録でもイベントリスナーは設定する（登録フォーム用）
            this.bindEvents();
            this.showRegistrationModal();
        } else {
            console.log('✅ ユーザー登録済み:', this.userId);
            // イベントリスナーを最優先で設定
            this.bindEvents();
            // その後、初期化処理を実行
            this.initializeApp();
            this.updateStatus('アプリ準備完了');
        }
    }

    // 登録モーダルを表示
    showRegistrationModal() {
        try {
            const modal = document.getElementById('user-registration-modal');
            if (modal) {
                modal.style.display = 'flex';
            } else {
                console.warn('⚠️ user-registration-modal 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ 登録モーダル表示エラー:', error);
        }
    }

    // 登録モーダルを非表示
    hideRegistrationModal() {
        try {
            const modal = document.getElementById('user-registration-modal');
            if (modal) {
                modal.style.display = 'none';
            } else {
                console.warn('⚠️ user-registration-modal 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ 登録モーダル非表示エラー:', error);
        }
    }

    // クラス選択モーダルを表示
    showClassSelectionModal() {
        try {
            console.log('🔍 [バグ1デバッグ] showClassSelectionModal 実行開始');
            const modal = document.getElementById('class-selection-modal');
            console.log('🔍 [バグ1デバッグ] modal要素:', modal);

            if (modal) {
                modal.style.display = 'flex';
                console.log('🎓 [バグ1デバッグ] クラス選択モーダルを表示しました (display = flex)');
                console.log('🔍 [バグ1デバッグ] modal.style.display:', modal.style.display);
            } else {
                console.warn('⚠️ [バグ1デバッグ] class-selection-modal 要素が見つかりません');
            }
        } catch (error) {
            console.error('❌ [バグ1デバッグ] クラス選択モーダル表示エラー:', error);
            console.error('❌ [バグ1デバッグ] エラースタック:', error.stack);
        }
    }

    // クラス選択モーダルを非表示
    hideClassSelectionModal() {
        try {
            const modal = document.getElementById('class-selection-modal');
            if (modal) {
                modal.style.display = 'none';
                console.log('🎓 クラス選択モーダルを非表示');
            } else {
                console.warn('⚠️ class-selection-modal 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ クラス選択モーダル非表示エラー:', error);
        }
    }

    // クラスを選択して保存
    async selectClass(className) {
        try {
            console.log('🎓 クラス選択:', className);

            this.selectedClass = className;
            this.classChangedAt = new Date().toISOString();

            // LocalStorageに保存
            localStorage.setItem('selectedClass', className);
            localStorage.setItem('classChangedAt', this.classChangedAt);

            // Firestoreに保存
            if (this.userId) {
                await db.collection('users').doc(this.userId).update({
                    selectedClass: className,
                    classChangedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            this.hideClassSelectionModal();
            this.showMessage(`🎓 ${className}を選択しました！\n\n研修会でのボーナス経験値が有効になります。`, 'success');
            console.log('✅ クラス選択完了:', className);

            // ステータス画面を更新
            this.updateStatusScreen();

        } catch (error) {
            console.error('❌ クラス選択エラー:', error);
            this.showMessage('クラス選択に失敗しました: ' + error.message, 'error');
        }
    }

    // ユーザー登録処理
    async registerUser(userData) {
        try {
            console.log('👤 ユーザー登録開始:', userData);

            // ユーザーIDを生成（UUIDライク）
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Firestoreにユーザー情報を保存（称号は保存しない - レベルから動的に計算）
            await db.collection('users').doc(userId).set({
                name: userData.name,
                profession: userData.profession,
                affiliation: userData.affiliation || '',
                prefecture: userData.prefecture || '',
                experience: userData.experience || 0,
                level: 1,
                exp: 0,
                lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                participationCount: 0
            });

            // LocalStorageに保存（称号は保存しない - レベルから動的に計算）
            localStorage.setItem('userId', userId);
            localStorage.setItem('level', '1');
            localStorage.setItem('exp', '0');
            localStorage.setItem('participationCount', '0');
            localStorage.removeItem('title'); // 称号のキャッシュを削除

            this.userId = userId;
            this.level = 1;
            this.exp = 0;
            this.participationCount = 0;

            console.log(`✅ [称号デバッグ] 登録時の称号: レベル${this.level} → "${getTitleForLevel(this.level)}"`);

            console.log('✅ ユーザー登録完了:', userId);

            // モーダルを閉じてアプリを初期化
            this.hideRegistrationModal();
            this.initializeApp();
            // bindEvents()は既にcheckUserRegistration()で呼び出し済みなので不要
            this.updateStatus('アプリ準備完了');
            this.showMessage('登録完了！研修参加をお楽しみください', 'success');

        } catch (error) {
            console.error('❌ ユーザー登録エラー:', error);
            throw error;
        }
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
            console.log('🔍 isValidPassword: 開始');
            console.log('🔍 検証するパスワード:', JSON.stringify(password));

            // Firestoreからパスワード情報を取得
            console.log('🔍 Firestore からパスワード情報を取得中...');
            const doc = await db.collection('passwords').doc(password).get();
            console.log('🔍 Firestore ドキュメント取得完了');
            console.log('🔍 ドキュメント存在:', doc.exists);

            if (!doc.exists) {
                console.log('🔍 パスワード認証: パスワードが存在しません');
                return false;
            }

            const passwordData = doc.data();
            console.log('🔍 パスワードデータ:', passwordData);

            // 期限切れチェック
            if (passwordData.expiryTimestamp && Date.now() > passwordData.expiryTimestamp) {
                console.log('🔍 パスワード認証: 期限切れ');
                console.log('🔍 現在時刻:', Date.now());
                console.log('🔍 有効期限:', passwordData.expiryTimestamp);
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
            console.error('❌ エラー詳細:', error.message);
            console.error('❌ エラースタック:', error.stack);
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

    async initializeApp() {
        console.log('🔧 initializeApp 開始');

        try {
            // Firestoreからユーザー情報を取得して同期
            if (this.userId) {
                try {
                    await this.syncUserDataFromFirestore();
                } catch (error) {
                    console.warn('⚠️ Firestore同期エラー（続行します）:', error);
                }
            }

            // 各更新処理を個別にtry-catchで保護
            try {
                this.updateExpDisplay();
            } catch (error) {
                console.warn('⚠️ 経験値表示更新エラー:', error);
            }

            try {
                this.updateLevelDisplay();
            } catch (error) {
                console.warn('⚠️ レベル表示更新エラー:', error);
            }

            try {
                this.updateStampDisplay();
            } catch (error) {
                console.warn('⚠️ スタンプ表示更新エラー:', error);
            }

            try {
                this.checkCouponAvailability();
            } catch (error) {
                console.warn('⚠️ クーポン確認エラー:', error);
            }

            try {
                this.updatePasswordExpiryDisplay();
            } catch (error) {
                console.warn('⚠️ パスワード有効期限表示エラー:', error);
            }

            try {
                this.updateStatusScreen();
            } catch (error) {
                console.warn('⚠️ ステータス画面更新エラー:', error);
            }

            try {
                this.updateHomeScreen();
            } catch (error) {
                console.warn('⚠️ ホーム画面更新エラー:', error);
            }

            try {
                this.debugDOMElements();
            } catch (error) {
                console.warn('⚠️ DOM要素確認エラー:', error);
            }

            console.log('🔧 initializeApp 完了');
        } catch (error) {
            console.error('❌ initializeApp でエラーが発生しましたが、処理を続行します:', error);
            console.error('❌ エラースタック:', error.stack);
        }
    }

    // Firestoreからユーザーデータを同期
    async syncUserDataFromFirestore() {
        try {
            const userDoc = await db.collection('users').doc(this.userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();

                // LocalStorageとFirestoreのデータを比較して、より大きい値を使用
                const localExp = this.exp || 0;
                const firestoreExp = userData.exp || 0;
                const localLevel = this.level || 1;
                const firestoreLevel = userData.level || 1;

                console.log(`🔍 データ同期: LocalStorage(Exp=${localExp}, Lvl=${localLevel}) vs Firestore(Exp=${firestoreExp}, Lvl=${firestoreLevel})`);

                // 経験値が大きい方を採用（レベルも再計算）
                if (localExp > firestoreExp) {
                    console.log('⚠️ LocalStorageの方が経験値が大きい。LocalStorageを優先します。');
                    this.exp = localExp;
                    this.level = this.calculateLevel(this.exp);

                    // Firestoreを更新
                    try {
                        await db.collection('users').doc(this.userId).update({
                            exp: this.exp,
                            level: this.level
                        });
                        console.log('✅ Firestoreを更新しました');
                    } catch (updateError) {
                        console.warn('⚠️ Firestore更新エラー:', updateError);
                    }
                } else {
                    console.log('✅ Firestoreのデータを使用します');
                    this.exp = firestoreExp;
                    this.level = this.calculateLevel(this.exp);
                }

                this.participationCount = Math.max(
                    parseInt(localStorage.getItem('participationCount')) || 0,
                    userData.participationCount || 0
                );

                // 称号はレベルから動的に計算（Firestoreには保存しない）
                const correctTitle = getTitleForLevel(this.level);
                console.log(`🔍 [称号デバッグ] 同期時の称号チェック: レベル=${this.level}, DB称号="${userData.title}", 正しい称号="${correctTitle}"`);

                // LocalStorageにも保存（称号は保存しない）
                localStorage.setItem('level', this.level.toString());
                localStorage.setItem('exp', this.exp.toString());
                localStorage.removeItem('title'); // 称号のキャッシュを削除
                localStorage.setItem('participationCount', this.participationCount.toString());

                console.log('✅ Firestoreからユーザーデータを同期:', {
                    level: this.level,
                    exp: this.exp,
                    title: correctTitle, // 動的に計算した称号を表示
                    participationCount: this.participationCount
                });
            }
        } catch (error) {
            console.error('❌ Firestoreからのデータ同期エラー:', error);
        }
    }

    debugDOMElements() {
        console.log('🔍 DOM要素の確認開始');
        const requiredElements = [
            'submit-password', 'manual-qr', 'use-coupon', 'status-display'
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

                // ボタンクリック音を再生
                soundManager.play('button');

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
        safeBindClick('submit-password', this.manualPasswordInput, 'パスワード入力');

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

        // ユーザー登録フォーム
        const registrationForm = document.getElementById('user-registration-form');
        if (registrationForm) {
            registrationForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const userData = {
                    name: document.getElementById('user-name').value.trim(),
                    profession: document.getElementById('user-profession').value,
                    affiliation: document.getElementById('user-affiliation').value.trim(),
                    prefecture: document.getElementById('user-prefecture').value,
                    experience: parseInt(document.getElementById('user-experience').value) || 0
                };

                if (!userData.name || !userData.profession) {
                    soundManager.play('error');
                    this.showMessage('名前と職種は必須です', 'error');
                    return;
                }

                try {
                    await this.registerUser(userData);
                } catch (error) {
                    soundManager.play('error');
                    this.showMessage('登録に失敗しました: ' + error.message, 'error');
                }
            });
            console.log('✅ ユーザー登録フォームイベント設定完了');
        }

        // クラス選択イベント
        const classOptions = document.querySelectorAll('.class-option');
        classOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const className = option.getAttribute('data-class');
                if (className) {
                    await this.selectClass(className);
                }
            });
        });
        console.log('✅ クラス選択イベント設定完了');

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

            if (!expiryDisplay) {
                console.warn('⚠️ password-expiry-display 要素が見つかりません');
                return;
            }

            if (!expiryTime) {
                console.warn('⚠️ password-expiry-time 要素が見つかりません');
                return;
            }

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
            console.error('❌ エラースタック:', error.stack);
        }
    }

    // 経験値表示を更新
    updateExpDisplay() {
        try {
            const expInfo = this.getExpToNextLevel();

            const currentExpEl = document.getElementById('currentExpDisplay');
            const nextLevelExpEl = document.getElementById('nextLevelExpDisplay');
            const expBarEl = document.getElementById('expBar');

            if (currentExpEl) {
                currentExpEl.textContent = expInfo.current;
            } else {
                console.warn('⚠️ currentExpDisplay 要素が見つかりません');
            }

            if (nextLevelExpEl) {
                nextLevelExpEl.textContent = expInfo.required;
            } else {
                console.warn('⚠️ nextLevelExpDisplay 要素が見つかりません');
            }

            if (expBarEl) {
                expBarEl.style.width = `${expInfo.percentage}%`;
            } else {
                console.warn('⚠️ expBar 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ 経験値表示更新エラー:', error);
        }
    }

    // レベル表示を更新
    updateLevelDisplay() {
        try {
            const levelEl = document.getElementById('levelDisplay');
            if (levelEl) {
                levelEl.textContent = this.level;
            } else {
                console.warn('⚠️ levelDisplay 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ レベル表示更新エラー:', error);
        }
    }

    // 称号表示を更新（常にレベルから動的計算）
    updateTitleDisplay() {
        try {
            // 称号は常にレベルから動的に計算（キャッシュしない）
            const title = getTitleForLevel(this.level);
            const titleEl = document.getElementById('status-title');
            if (titleEl) {
                titleEl.textContent = title;
                console.log(`✅ [称号デバッグ] 称号表示更新: レベル${this.level} → "${title}"`);
            } else {
                console.warn('⚠️ status-title 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ 称号表示更新エラー:', error);
        }
    }

    // ホーム画面の★表示を更新
    updateHomeScreen() {
        try {
            const stars = getStarsByLevel(this.level);
            const homeStarsElement = document.getElementById('home-stars');
            if (homeStarsElement) {
                homeStarsElement.textContent = stars;
                console.log(`✅ ホーム画面の★表示更新: レベル${this.level} → "${stars}"`);
            } else {
                console.warn('⚠️ home-stars 要素が見つかりません');
            }
        } catch (error) {
            console.warn('⚠️ ホーム画面更新エラー:', error);
        }
    }

    updateStampDisplay() {
        try {
            const stampCountEl = document.getElementById('stampCount');
            if (stampCountEl) {
                stampCountEl.textContent = this.stampCount;
            } else {
                console.warn('⚠️ stampCount 要素が見つかりません');
            }

            for (let i = 1; i <= 3; i++) {
                const stamp = document.getElementById(`stamp${i}`);
                if (stamp) {
                    if (i <= this.stampCount) {
                        stamp.classList.add('filled');
                        stamp.textContent = '✓';
                    } else {
                        stamp.classList.remove('filled');
                        stamp.textContent = '';
                    }
                } else {
                    console.warn(`⚠️ stamp${i} 要素が見つかりません`);
                }
            }
        } catch (error) {
            console.warn('⚠️ スタンプ表示更新エラー:', error);
        }
    }

    checkCouponAvailability() {
        try {
            const couponSection = document.getElementById('couponSection');
            const couponStatus = document.getElementById('couponStatus');

            if (this.stampCount >= 3) {
                if (couponSection) {
                    couponSection.style.display = 'block';
                } else {
                    console.warn('⚠️ couponSection 要素が見つかりません');
                }

                if (couponStatus) {
                    couponStatus.textContent = 'クーポンが利用可能です！';
                } else {
                    console.warn('⚠️ couponStatus 要素が見つかりません');
                }
            } else {
                if (couponSection) {
                    couponSection.style.display = 'none';
                }

                if (couponStatus) {
                    couponStatus.textContent = '3つ集めると1000円割引クーポンGET!';
                }
            }
        } catch (error) {
            console.warn('⚠️ クーポン可用性チェックエラー:', error);
        }
    }

    // QRスキャン機能は削除（パスワード入力のみ使用）

    async handleQRCodeScan(rawInput) {
        try {
            console.log('🔍 ===== パスワード認証開始 =====');
            console.log('📥 受信した入力:', JSON.stringify(rawInput));
            console.log('📥 入力のタイプ:', typeof rawInput);

            // ステップ1: 入力の正規化
            const normalizedInput = this.normalizeInput(rawInput);
            console.log('🔧 正規化された入力:', JSON.stringify(normalizedInput));
            console.log('🔧 正規化後の長さ:', normalizedInput.length);

            // ステップ2: 空入力チェック
            if (!normalizedInput) {
                console.log('❌ 空の入力');
                this.showMessage('❌ パスワードを入力してください', 'error');
                return;
            }

            // ステップ3: 通常パスワード認証（Firestore版）
            console.log('🔍 ステップ3: Firestore パスワード認証開始');
            const validationResult = await this.isValidPassword(normalizedInput);
            console.log('🔍 ステップ3: 認証結果:', validationResult);

            if (validationResult === 'expired') {
                console.log('⏰ パスワードが期限切れ:', normalizedInput);
                // エラー音を再生
                soundManager.play('error');
                this.showMessage(
                    `⏰ このパスワードは期限切れです\n\n有効期限が過ぎています\n※ 管理者に新しいパスワードの生成をお尋ねください`,
                    'error'
                );
                return;
            } else if (validationResult === 'used') {
                console.log('⚠️ 既にパスワードが使用済み');
                // エラー音を再生
                soundManager.play('error');
                this.showMessage(
                    `⚠️ このパスワードは既に使用済みです\n\n※ お一人様1回限りです`,
                    'error'
                );
                return;
            } else if (validationResult === true) {
                // ステップ4: 通常パスワード認証成功 - 経験値・スタンプ付与
                console.log('✅ 通常パスワード認証成功:', normalizedInput);
                console.log('🔍 ステップ4: 認証成功処理開始');
                // 決定音を再生
                soundManager.play('decision');
                await this.processValidPassword(normalizedInput);
                console.log('🔍 ===== パスワード認証完了 =====');
                return;
            }

            // ステップ5: 救済パスワードかチェック（Firestoreに存在しない場合）
            console.log('🔍 ステップ5: 救済パスワードチェック開始');
            const rescueData = this.isRescuePassword(normalizedInput);
            if (rescueData) {
                console.log('🆘 救済パスワード認証:', rescueData);
                // 決定音を再生
                soundManager.play('decision');
                await this.processRescuePassword(rescueData);
                console.log('🔍 ===== 救済パスワード認証完了 =====');
                return;
            }

            // ステップ6: 無効なパスワード
            console.log('❌ 無効なパスワード:', normalizedInput);
            // エラー音を再生
            soundManager.play('error');
            this.showMessage(
                `❌ 無効なパスワードです\n\n入力値: ${normalizedInput}\n※ 管理者にお尋ねください`,
                'error'
            );

        } catch (error) {
            console.error('❌ パスワード認証エラー:', error);
            console.error('❌ エラースタック:', error.stack);
            // エラー音を再生
            soundManager.play('error');
            this.showMessage(`❌ システムエラーが発生しました: ${error.message}`, 'error');
        }
    }

    // 有効なパスワードの処理（Firestore版 - 並列化で高速化）
    async processValidPassword(password) {
        try {
            console.log('========== [バグ3デバッグ] パスワード使用開始 ==========');
            console.log('🔍 [バグ3デバッグ] 使用するパスワード:', password);

            // パスワード情報から研修会タイプと基本経験値を取得
            console.log('🔍 [バグ3デバッグ] Firestoreからパスワードデータ取得中...');
            const passwordDoc = await db.collection('passwords').doc(password).get();
            console.log('🔍 [バグ3デバッグ] passwordDoc.exists:', passwordDoc.exists);

            if (!passwordDoc.exists) {
                console.error('❌ [バグ3デバッグ] エラー: パスワードドキュメントが存在しません');
                throw new Error('パスワードが見つかりません');
            }

            const passwordData = passwordDoc.data();
            console.log('🔍 [バグ3デバッグ] passwordData取得完了:');
            console.log('  - password:', passwordData.password);
            console.log('  - trainingType:', passwordData.trainingType);
            console.log('  - expAmount:', passwordData.expAmount, '(型:', typeof passwordData.expAmount, ')');
            console.log('  - used:', passwordData.used);

            const trainingType = passwordData?.trainingType || 'なし';
            const rawExpAmount = passwordData?.expAmount;

            console.log('🔍 [バグ3デバッグ] expAmount変換:');
            console.log('  - 元の値:', rawExpAmount, '(型:', typeof rawExpAmount, ')');

            // expAmountが未定義またはnullの場合はデフォルト値を使用
            let baseExp = 100; // デフォルト値
            if (rawExpAmount !== undefined && rawExpAmount !== null) {
                // 数値に変換（文字列の場合に備えて）
                baseExp = typeof rawExpAmount === 'number' ? rawExpAmount : parseInt(rawExpAmount, 10);
                console.log('  - 変換後:', baseExp, '(型:', typeof baseExp, ')');

                // NaNチェック
                if (isNaN(baseExp)) {
                    console.error('❌ [バグ3デバッグ] expAmountの変換に失敗、デフォルト100を使用');
                    baseExp = 100;
                }
            } else {
                console.warn('⚠️ [バグ3デバッグ] expAmountが未設定、デフォルト100を使用');
            }

            console.log('🔍 [バグ3デバッグ] 最終baseExp:', baseExp);

            // ボーナス経験値を計算
            const bonus = this.calculateExpBonus(trainingType);
            const gainedExp = baseExp + bonus;

            console.log('📊 [バグ3デバッグ] 経験値計算結果:');
            console.log('  - 基本経験値:', baseExp, 'P');
            console.log('  - ボーナス:', bonus, 'P');
            console.log('  - 合計:', gainedExp, 'P');
            console.log('  - 研修会タイプ:', trainingType);
            console.log('  - クラス:', this.selectedClass || '未選択');

            const oldLevel = this.level;
            const oldTitle = getTitleForLevel(oldLevel); // 称号は動的に計算

            // ローカル処理を先に実行（高速）
            const expResult = await this.addExp(gainedExp);
            this.addStamp();

            // LocalStorageに記録（高速）
            this.scannedCodes.push(password);
            localStorage.setItem('scannedCodes', JSON.stringify(this.scannedCodes));
            this.participationCount++;
            localStorage.setItem('participationCount', this.participationCount.toString());
            this.notifyPasswordUsage();

            // レベルアップ判定と音再生（即座に実行）
            const leveledUp = expResult.leveledUp;
            const titleChanged = expResult.titleChanged;

            console.log("=== レベルアップ判定 ===");
            console.log("旧レベル:", oldLevel);
            console.log("新レベル:", this.level);
            console.log("レベルアップ:", leveledUp);
            console.log("称号変更:", titleChanged);
            console.log("新称号:", expResult.newTitle);

            if (leveledUp) {
                soundManager.play('levelup');
            }

            // 成功メッセージを即座に表示（ユーザーへの即座のフィードバック）
            let message = `🎉 認証成功！\n\n+${gainedExp}経験値獲得\nスタンプ+1\n\n研修参加ありがとうございます！`;
            if (leveledUp) {
                message += `\n\n🎊 レベルアップ！\nレベル${this.level}になりました！`;
            }
            if (titleChanged) {
                message += `\n\n✨ 称号獲得！\n「${expResult.newTitle}」`;
            }

            console.log("=== 表示するメッセージ ===");
            console.log(message);
            console.log("メッセージに「レベルアップ」含む:", message.includes('レベルアップ'));
            console.log("OKボタン表示:", message.includes('レベルアップ') || message.includes('称号獲得') || message.includes('経験値獲得'));

            this.showMessage(message, 'success');

            // Firebase処理を並列化（バックグラウンドで実行）
            const firestorePromises = [];

            // パスワードを使用済みにマーク
            firestorePromises.push(
                db.collection('passwords').doc(password).update({
                    used: true,
                    usedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
            );

            // 使用履歴を保存
            firestorePromises.push(
                db.collection('usage_history').add({
                    userId: this.userId,
                    password: password,
                    exp: gainedExp,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userAgent: navigator.userAgent
                })
            );

            // ユーザー情報を更新（称号は保存しない - レベルから動的に計算）
            if (this.userId) {
                firestorePromises.push(
                    db.collection('users').doc(this.userId).update({
                        exp: this.exp,
                        level: this.level,
                        participationCount: firebase.firestore.FieldValue.increment(1),
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                    })
                );
            }

            // すべてのFirebase処理を並列実行（await せずに処理を続ける）
            Promise.all(firestorePromises).catch(err => {
                console.warn('⚠️ Firestore 更新エラー（ローカルデータは保存済み）:', err);
            });

            // ステータス画面を非同期で更新（待たない）
            this.updateStatusScreen().catch(err => {
                console.warn('⚠️ ステータス画面更新エラー:', err);
            });

            console.log('✅ [バグ3デバッグ] パスワード認証処理完了:', {
                付与経験値: gainedExp,
                基本経験値: baseExp,
                ボーナス経験値: bonus,
                累計経験値: this.exp,
                現在レベル: this.level,
                スタンプ数: this.stampCount,
                レベルアップ: leveledUp
            });
            console.log('========== [バグ3デバッグ] パスワード使用完了 ==========');

        } catch (error) {
            console.error('❌ パスワード認証処理エラー:', error);
            throw error;
        }
    }

    // 救済パスワードの処理
    async processRescuePassword(rescueData) {
        try {
            console.log('🆘 救済パスワード処理開始:', rescueData);

            const baseExp = rescueData.points; // 救済パスワードのポイントを経験値として扱う
            const trainingType = rescueData.trainingType || 'なし';

            // ボーナス経験値を計算
            const bonus = this.calculateExpBonus(trainingType);
            const gainedExp = baseExp + bonus;

            console.log(`📊 救済パスワード経験値計算: 基本${baseExp}P + ボーナス${bonus}P = 合計${gainedExp}P`);

            const oldLevel = this.level;
            const oldTitle = getTitleForLevel(oldLevel); // 称号は動的に計算

            // 指定された経験値のみ追加（スタンプなし）
            const expResult = await this.addExp(gainedExp);

            // 救済パスワードを削除（1回限り）
            localStorage.removeItem('rescuePassword');

            // レベルアップ判定
            const leveledUp = expResult.leveledUp;
            const titleChanged = expResult.titleChanged;
            if (leveledUp) {
                soundManager.play('levelup');
            }

            // 成功メッセージ
            let message = `🆘 救済パスワード認証成功！\n\n+${gainedExp}経験値獲得`;
            if (bonus > 0) {
                message += `\n(基本${baseExp}P + ボーナス${bonus}P)`;
            }
            message += `\n\n※ スタンプは付与されません`;
            if (leveledUp) {
                message += `\n\n🎊 レベルアップ！\nレベル${this.level}になりました！`;
            }
            if (titleChanged) {
                message += `\n\n✨ 称号獲得！\n「${expResult.newTitle}」`;
            }
            this.showMessage(message, 'success');

            // Firestoreにユーザー情報を更新（称号は保存しない - レベルから動的に計算）
            if (this.userId) {
                try {
                    await db.collection('users').doc(this.userId).update({
                        exp: this.exp,
                        level: this.level,
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (error) {
                    console.warn('⚠️ Firestore更新エラー:', error);
                }
            }

            // ステータス画面を更新
            this.updateStatusScreen();

            console.log('✅ 救済パスワード処理完了:', {
                totalExp: this.exp,
                addedExp: gainedExp,
                level: this.level,
                title: getTitleForLevel(this.level), // 称号は動的に計算
                noStamp: true
            });

        } catch (error) {
            console.error('❌ 救済パスワード処理エラー:', error);
            throw error;
        }
    }

    // ボーナス経験値を計算
    calculateExpBonus(trainingType) {
        // レベル20未満またはクラス未選択の場合はボーナスなし
        if (this.level < 20 || !this.selectedClass) {
            return 0;
        }

        // クラスと研修会タイプの組み合わせでボーナスを決定
        if (this.selectedClass === 'フットコアマスター' && trainingType === '歩行') {
            return 100;
        } else if (this.selectedClass === 'ハンドマスター' && trainingType === '手') {
            return 100;
        } else if (this.selectedClass === 'オールラウンダー' && (trainingType === '歩行' || trainingType === '手')) {
            return 90;
        }

        return 0;
    }

    // 経験値を追加してレベルアップ判定
    async addExp(amount) {
        const oldLevel = this.level;
        const oldTitle = getTitleForLevel(oldLevel); // 称号は動的に計算

        console.log(`🔍 [称号デバッグ] 経験値追加前: レベル=${oldLevel}, 称号="${oldTitle}"`);

        this.exp += amount;
        this.level = this.calculateLevel(this.exp);

        // 称号を動的に計算（キャッシュしない）
        const newTitle = getTitleForLevel(this.level);
        const titleChanged = oldTitle !== newTitle;

        console.log(`🔍 [称号デバッグ] 経験値追加後: レベル=${this.level}, 称号="${newTitle}", 称号変更=${titleChanged}`);

        // LocalStorageに保存（称号は保存しない）
        localStorage.setItem('exp', this.exp.toString());
        localStorage.setItem('level', this.level.toString());
        localStorage.removeItem('title'); // 称号のキャッシュを削除

        // 表示を更新
        this.updateExpDisplay();
        this.updateLevelDisplay();
        this.updateTitleDisplay(); // ★称号表示を更新
        this.updateHomeScreen(); // ★ホーム画面の★表示を更新

        console.log(`✅ [称号デバッグ] 経験値追加: +${amount} (合計: ${this.exp}, レベル: ${this.level}, 称号: ${newTitle})`);

        // レベル20到達でクラス未選択の場合、クラス選択モーダルを表示
        console.log(`🔍 [バグ1デバッグ] クラス選択判定: oldLevel=${oldLevel}, newLevel=${this.level}, selectedClass=${this.selectedClass}`);
        if (oldLevel < 20 && this.level >= 20 && !this.selectedClass) {
            console.log('🎓 [バグ1デバッグ] レベル20到達！クラス選択モーダルを表示します');
            setTimeout(() => {
                console.log('🎓 [バグ1デバッグ] クラス選択モーダル表示処理実行');
                this.showClassSelectionModal();
            }, 2000); // レベルアップメッセージの後に表示
        } else {
            console.log(`🔍 [バグ1デバッグ] クラス選択モーダル非表示: 条件不一致 (oldLevel < 20: ${oldLevel < 20}, level >= 20: ${this.level >= 20}, !selectedClass: ${!this.selectedClass})`);
        }

        // ★重要: Firestoreには称号を保存しない（レベルから動的に計算するため）

        return {
            leveledUp: this.level > oldLevel,
            titleChanged: titleChanged,
            newTitle: newTitle
        };
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

    showMessage(text, type = 'success', duration = null, showOkButton = null) {
        try {
            console.log(`メッセージ表示: ${text} (${type})`);
            const message = document.getElementById('message');

            if (!message) {
                console.error('message要素が見つかりません');
                // フォールバック: alertを使用
                alert(text);
                return;
            }

            // OKボタンを表示するかどうかを判定
            // showOkButtonがnullの場合は、レベルアップ・称号獲得・経験値獲得メッセージの場合に自動表示
            let needsOkButton = showOkButton;
            if (needsOkButton === null) {
                needsOkButton = text.includes('レベルアップ') ||
                               text.includes('称号獲得') ||
                               text.includes('経験値獲得');
            }

            // メッセージの内容をクリア
            message.innerHTML = '';
            message.className = `message show ${type}`;

            if (needsOkButton) {
                // OKボタン付きメッセージ（ユーザーが閉じるまで表示）
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                textDiv.style.whiteSpace = 'pre-line';
                textDiv.textContent = text;

                const buttonDiv = document.createElement('div');
                buttonDiv.className = 'message-button-container';
                buttonDiv.style.marginTop = '15px';
                buttonDiv.style.textAlign = 'center';

                const okButton = document.createElement('button');
                okButton.textContent = 'OK';
                okButton.className = 'message-ok-button';
                okButton.style.padding = '10px 40px';
                okButton.style.fontSize = '16px';
                okButton.style.fontWeight = 'bold';
                okButton.style.backgroundColor = '#4CAF50';
                okButton.style.color = 'white';
                okButton.style.border = 'none';
                okButton.style.borderRadius = '8px';
                okButton.style.cursor = 'pointer';
                okButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                okButton.style.transition = 'all 0.2s';

                // ホバー効果
                okButton.addEventListener('mouseenter', () => {
                    okButton.style.backgroundColor = '#45a049';
                    okButton.style.transform = 'scale(1.05)';
                });
                okButton.addEventListener('mouseleave', () => {
                    okButton.style.backgroundColor = '#4CAF50';
                    okButton.style.transform = 'scale(1)';
                });

                // クリックでメッセージを閉じる
                okButton.addEventListener('click', () => {
                    soundManager.play('button');
                    message.classList.remove('show');
                    setTimeout(() => {
                        message.style.display = 'none';
                        setTimeout(() => {
                            message.style.display = '';
                            message.innerHTML = '';
                        }, 100);
                    }, 300);
                });

                buttonDiv.appendChild(okButton);
                message.appendChild(textDiv);
                message.appendChild(buttonDiv);

                console.log('✅ OKボタン付きメッセージ表示');

            } else {
                // 通常のタイムアウト付きメッセージ
                message.textContent = text;

                // メッセージタイプに応じて表示時間を変更
                let displayDuration = duration;
                if (displayDuration === null) {
                    if (type === 'success') {
                        displayDuration = 1500; // 成功: 1.5秒
                    } else if (text.includes('認証中')) {
                        displayDuration = 500; // 認証中: 0.5秒
                    } else {
                        displayDuration = 1000; // その他: 1秒
                    }
                }

                setTimeout(() => {
                    if (message) {
                        message.classList.remove('show');
                        // 【修正】メッセージを完全にリセット
                        message.style.display = 'none';
                        // 少し遅延してから display を元に戻す（次回表示のため）
                        setTimeout(() => {
                            message.style.display = '';
                        }, 100);
                    }
                }, displayDuration);
            }

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
    async manualPasswordInput() {
        // 重複実行を防止
        if (this.isProcessing) {
            console.log('⚠️ 処理中のため、パスワード入力を無視します');
            return;
        }

        try {
            this.isProcessing = true;
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
            console.log('🔍 入力されたパスワード:', JSON.stringify(password));
            console.log('🔍 パスワード長:', password.length);

            if (!password) {
                console.log('⚠️ パスワードが空です');
                this.showMessage('パスワードを入力してください', 'error');
                this.updateStatus('パスワードを入力してください');
                return;
            }

            // パスワード認証処理（非同期）
            console.log('🔍 パスワード認証処理を開始...');
            this.updateStatus('認証中...');
            await this.handleQRCodeScan(password);

            input.value = ''; // 入力欄をクリア
            console.log('✅ パスワード入力完了');

        } catch (error) {
            console.error('❌ パスワード入力でエラーが発生:', error);
            this.showMessage(`パスワード入力でエラーが発生しました: ${error.message}`, 'error');
            this.updateStatus(`エラー: ${error.message}`);
        } finally {
            // 処理完了フラグをリセット
            this.isProcessing = false;
        }
    }

    // ステータス画面を更新
    async updateStatusScreen() {
        try {
            // Firestoreからユーザー情報を取得
            if (!this.userId) {
                console.warn('⚠️ ユーザーIDが未設定です');
                return;
            }

            const userDoc = await db.collection('users').doc(this.userId).get();
            if (!userDoc.exists) {
                console.warn('⚠️ ユーザードキュメントが存在しません');
                return;
            }

            const userData = userDoc.data();

            // Firestoreのデータからレベルと経験値を取得
            const firestoreLevel = userData.level || 1;
            const firestoreExp = userData.exp || 0;

            console.log(`🔍 ステータス画面更新: Firestoreレベル=${firestoreLevel}, 経験値=${firestoreExp}`);

            // LocalStorageとFirestoreのどちらが新しいかを比較
            const localExp = this.exp || 0;
            const useFirestoreData = firestoreExp >= localExp;

            if (useFirestoreData) {
                // Firestoreのデータを優先（最新）
                this.exp = firestoreExp;
                this.level = this.calculateLevel(this.exp);
                console.log(`✅ Firestoreのデータを使用: レベル=${this.level}, 経験値=${this.exp}`);
            } else {
                // LocalStorageのデータを優先
                console.log(`✅ LocalStorageのデータを使用: レベル=${this.level}, 経験値=${this.exp}`);
            }

            // 経験値情報を再計算
            const expInfo = this.getExpToNextLevel();

            // 称号はレベルから動的に計算（Firestoreには保存しない）
            const correctTitle = getTitleForLevel(this.level);
            console.log("=== ステータス表示 ===");
            console.log("Firestoreのlevel:", userData.level);
            console.log("Firestoreのtitle:", userData.title);
            console.log("計算された称号:", getTitleForLevel(this.level));
            console.log(`🔍 [称号デバッグ] ステータス画面更新: レベル=${this.level}, DB称号="${userData.title}", 正しい称号="${correctTitle}"`);

            // LocalStorageも最新の状態に更新（称号は保存しない）
            localStorage.setItem('level', this.level.toString());
            localStorage.setItem('exp', this.exp.toString());
            localStorage.removeItem('title'); // 称号のキャッシュを削除

            // ステータス画面の各要素を更新（安全版）
            const updateElement = (id, value) => {
                try {
                    const el = document.getElementById(id);
                    if (el) {
                        el.textContent = value;
                    } else {
                        console.warn(`⚠️ 要素が見つかりません: ${id}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ 要素更新エラー: ${id}`, error);
                }
            };

            // 名前に★を追加
            const stars = getStarsByLevel(this.level);
            const nameWithStars = stars ? `${userData.name || '-'} ${stars}` : (userData.name || '-');
            updateElement('status-name', nameWithStars);
            updateElement('status-title', correctTitle); // 動的に計算した称号を表示
            updateElement('status-level', this.level);
            updateElement('status-exp-to-next', `${expInfo.current} / ${expInfo.required}`);
            updateElement('status-total-exp', this.exp.toLocaleString());

            // クラス表示を更新
            if (this.selectedClass) {
                updateElement('status-class', this.selectedClass);
                const classRow = document.getElementById('status-class-row');
                if (classRow) classRow.style.display = 'flex';
            }

            // アビリティ表示を更新
            const abilities = userData.abilities || [];
            console.log('🏅 [アビリティデバッグ] 取得したアビリティ:', abilities);
            if (abilities.length > 0) {
                const abilitiesText = abilities.map(ability => `• ${ability.name}`).join('\n');
                updateElement('status-abilities', abilitiesText);
                const abilitiesRow = document.getElementById('status-abilities-row');
                if (abilitiesRow) {
                    abilitiesRow.style.display = 'flex';
                    // 複数行表示のためのスタイル調整
                    const statusAbilitiesEl = document.getElementById('status-abilities');
                    if (statusAbilitiesEl) {
                        statusAbilitiesEl.style.whiteSpace = 'pre-line';
                    }
                }
                console.log('✅ [アビリティデバッグ] アビリティを表示:', abilitiesText);
            } else {
                const abilitiesRow = document.getElementById('status-abilities-row');
                if (abilitiesRow) abilitiesRow.style.display = 'none';
                console.log('ℹ️ [アビリティデバッグ] アビリティなし');
            }

            updateElement('status-profession', userData.profession || '-');
            updateElement('status-affiliation', userData.affiliation || '-');
            updateElement('status-prefecture', userData.prefecture || '-');
            updateElement('status-experience', userData.experience ? `${userData.experience}年` : '-');
            updateElement('status-participation', `${this.participationCount}回`);

            if (userData.lastVisit) {
                try {
                    const lastVisit = userData.lastVisit.toDate();
                    updateElement('status-last-visit', lastVisit.toLocaleString('ja-JP'));
                } catch (error) {
                    console.warn('⚠️ 最終参加日の変換エラー:', error);
                    updateElement('status-last-visit', '未参加');
                }
            } else {
                updateElement('status-last-visit', '未参加');
            }

            // 称号表示を明示的に更新
            this.updateTitleDisplay();

            console.log(`✅ [称号デバッグ] ステータス画面更新完了: Lv.${this.level} "${correctTitle}" (経験値: ${this.exp})`);

        } catch (error) {
            console.error('❌ ステータス画面更新エラー:', error);
            console.error('❌ エラースタック:', error.stack);
        }
    }

    // デバッグ用：データリセット機能
    resetAppData() {
        localStorage.clear();
        this.exp = 0;
        this.level = 1;
        // this.title は削除 - 称号は常にレベルから動的に計算
        this.stampCount = 0;
        this.usedCoupons = [];
        this.scannedCodes = [];
        this.participationCount = 0;
        this.initializeApp();
        console.log(`✅ [称号デバッグ] リセット後の称号: レベル${this.level} → "${getTitleForLevel(this.level)}"`);
        this.showMessage('アプリデータをリセットしました', 'success');
    }
}

// タブ切り替え関数
function switchTab(tabName) {
    // すべてのタブボタンとコンテンツを非アクティブに
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 選択されたタブをアクティブに
    const selectedButton = document.querySelector(`.tab-button:nth-child(${tabName === 'home' ? 1 : 2})`);
    const selectedContent = document.getElementById(`${tabName}-tab`);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');

    // ステータス画面に切り替えた場合は更新
    if (tabName === 'status' && window.stampApp) {
        window.stampApp.updateStatusScreen();
    }
}

// 音声ON/OFF切り替え関数
function toggleSound() {
    const isMuted = soundManager.toggleMute();
    const muteButton = document.getElementById('mute-button');

    if (muteButton) {
        muteButton.textContent = isMuted ? '🔇' : '🔊';
        muteButton.title = isMuted ? '音声をONにする' : '音声をOFFにする';
    }

    console.log(`🔊 音声切り替え: ${isMuted ? 'ミュート' : '再生中'}`);
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

// パスワード送信ハンドラー（グローバル関数）
window.handlePasswordSubmit = async function() {
    try {
        console.log('🔧 handlePasswordSubmit: パスワード送信処理開始');

        const input = document.getElementById('manual-qr');
        const statusEl = document.getElementById('status-display');

        if (!input) {
            console.error('❌ パスワード入力欄が見つかりません');
            alert('入力欄が見つかりません');
            return;
        }

        const password = String(input.value || '').trim();
        console.log('🔍 入力されたパスワード:', JSON.stringify(password));

        if (!password) {
            console.log('⚠️ パスワードが空です');
            alert('パスワードを入力してください');
            if (statusEl) statusEl.textContent = 'ステータス: パスワードを入力してください';
            return;
        }

        if (statusEl) statusEl.textContent = 'ステータス: 認証中...';

        // StampAppインスタンスが存在する場合は使用
        if (window.stampApp) {
            console.log('🔍 stampApp インスタンスを使用');
            await window.stampApp.handleQRCodeScan(password);
        } else {
            console.error('❌ stampApp インスタンスが見つかりません');
            alert('アプリが初期化されていません。ページをリロードしてください。');
        }

        input.value = ''; // 入力欄をクリア
        console.log('✅ handlePasswordSubmit: 処理完了');

    } catch (error) {
        console.error('❌ handlePasswordSubmit エラー:', error);
        alert(`エラーが発生しました: ${error.message}`);
    }
};

console.log('🔧 handlePasswordSubmit 関数定義完了:', typeof window.handlePasswordSubmit);

console.log('🔧 DOMContentLoaded リスナー登録準備中...');

// アプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: 実行開始');
    console.log('🚀 DOMContentLoaded: アプリ初期化開始');

    // StampAppインスタンス初期化
    // イベントリスナーはbindEvents()で設定されるため、ここでは設定しない
    try {
        console.log('🔧 StampApp インスタンス初期化開始');
        const app = new StampApp();
        console.log('✅ StampApp インスタンス作成完了');

        // グローバル関数として簡単アクセス
        window.stampApp = app;
        window.testScan = () => app.simulateQRScan();

        // HTMLのonclick属性用のグローバル関数
        window.handleTestScan = () => {
            console.log('🔧 handleTestScan (onclick) が呼び出されました');
            app.simulateQRScan();
        };

        // ミュートボタンの初期状態を設定
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            muteButton.textContent = soundManager.isMuted ? '🔇' : '🔊';
            muteButton.title = soundManager.isMuted ? '音声をONにする' : '音声をOFFにする';
        }

        // 最初のクリックでBGMを自動開始
        document.addEventListener('click', function startBGM() {
            soundManager.playBGM();
            document.removeEventListener('click', startBGM);
        }, { once: true });

        console.log('✅ スタンプアプリが正常に起動しました！');
        console.log('🧪 テスト用コマンド:');
        console.log('  testScan() - QRスキャンテスト');
        console.log('  stampApp.resetAppData() - データリセット');

    } catch (error) {
        console.error('❌ 初期化エラー:', error);
        console.error('❌ エラースタック:', error.stack);
        // エラーが発生してもページはロードされる
        alert(`初期化エラー: ${error.message}\n\nページをリロードしてください`);
    }

    console.log('🚀 DOMContentLoaded: 完了');
});

console.log('🔧 DOMContentLoaded リスナー登録完了');

// PWA対応のための基本的なサービスワーカー登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('✅ ServiceWorker登録成功:', registration.scope);

                // 更新チェック
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 ServiceWorker更新を検出');
                });
            })
            .catch((error) => {
                console.warn('⚠️ ServiceWorker登録失敗（アプリは通常通り動作します）:', error);
                // エラーが発生してもアプリは動作し続ける
            });
    });
} else {
    console.log('ℹ️ このブラウザはService Workerに対応していません');
}