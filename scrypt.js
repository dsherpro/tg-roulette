document.addEventListener('DOMContentLoaded', () => {
    // === 1. MOCK TELEGRAM API FOR DESKTOP TESTING ===
    if (!window.Telegram?.WebApp?.initData) {
        console.warn("Telegram API not found, using mock object for testing.");
        window.Telegram = { WebApp: {
            initDataUnsafe: { user: { id: 12345, first_name: 'Тестер' } },
            ready: () => {}, expand: () => {}, showAlert: (m) => alert(m),
            HapticFeedback: { notificationOccurred: (t) => console.log(`Haptic: ${t}`), impactOccurred: (s) => console.log(`Impact: ${s}`) },
            sendData: (data) => console.log(`Data sent to bot: ${data}`),
        }};
    }

    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // === 2. GAME CONFIGURATION ===
    const config = {
        minBet: 10, dailyBonus: 100, minWithdrawal: 500, winRateChance: 0.486,
        payouts: { red: 2, black: 2, green: 14 }, boxMultipliers: [1.2, 1.5, 2.0], maxMultiplier: 10.0,
        wheelSegments: ['G', 'B', 'R', 'B', 'R', 'B', 'R'], segmentWidth: 40,
    };

    // === 3. CACHE DOM ELEMENTS ===
    const elements = {};
    const elementIds = [
        'app', 'loader', 'balance-amount', 'username', 'user-id', 'result-message', 'multiplier', 
        'bet-amount', 'withdraw-amount', 'spin-button', 'open-box-button', 'withdraw-button', 
        'reset-progress-button', 'luck-box', 'wheel', 'bonus-modal', 'claim-bonus-button'
    ];
    elementIds.forEach(id => {
        const kebabCaseId = id.replace(/([A-Z])/g, '-$1').toLowerCase();
        elements[id] = document.getElementById(kebabCaseId);
    });
    elements.navButtons = document.querySelectorAll('.nav-btn');
    elements.tabContents = document.querySelectorAll('.tab-content');
    elements.betButtons = document.querySelectorAll('.bet-btn');

    // === 4. GAME STATE AND DATA ===
    let state = { isSpinning: false, currentBetType: null };
    let playerData = { balance: 200, multiplier: 1.0, lastBonusTime: 0 }; // Default values

    const saveData = () => { try { localStorage.setItem('casinoPlayerData', JSON.stringify(playerData)); } catch (e) { console.error("Failed to save data:", e); } };
    const loadData = () => {
        try {
            const saved = localStorage.getItem('casinoPlayerData');
            if (saved) { playerData = JSON.parse(saved); }
        } catch (e) { console.error("Failed to load data, using defaults.", e); }
    };

    // === 5. UI UPDATE FUNCTIONS ===
    const updateBalanceDisplay = () => { if (elements.balanceAmount) elements.balanceAmount.textContent = Math.floor(playerData.balance); };
    const updateMultiplierDisplay = () => { if (elements.multiplier) elements.multiplier.textContent = `x${playerData.multiplier.toFixed(1)}`; };
    const disableControls = (disabled) => {
        state.isSpinning = disabled;
        elements.spinButton.disabled = disabled;
        elements.openBoxButton.disabled = disabled;
        elements.betButtons.forEach(b => b.disabled = disabled);
    };

    // === 6. CORE GAME LOGIC FUNCTIONS ===
    function spin() {
        const amount = parseInt(elements.betAmount.value, 10);
        if (!state.currentBetType) return tg.showAlert("Сначала выберите цвет!");
        if (isNaN(amount) || amount < config.minBet) return tg.showAlert(`Минимальная ставка: ${config.minBet} ★`);
        if (amount > playerData.balance) return tg.showAlert("Недостаточно средств!");

        disableControls(true);
        tg.HapticFeedback.impactOccurred('light');
        playerData.balance -= amount;
        updateBalanceDisplay();
        elements.resultMessage.textContent = `Ставка ${amount} ★ на ${state.currentBetType}`;

        const isWinner = Math.random() < (state.currentBetType === 'green' ? 0.06 : config.winRateChance);
        const winningColor = isWinner ? state.currentBetType : ['red', 'black', 'green'].filter(c => c !== state.currentBetType)[Math.floor(Math.random() * 2)];

        const targetIndexes = config.wheelSegments.map((seg, i) => seg.toLowerCase()[0] === winningColor[0] ? i : -1).filter(i => i !== -1);
        const targetIndex = targetIndexes[Math.floor(Math.random() * targetIndexes.length)];
        const landingPosition = (5 * config.wheelSegments.length + targetIndex) * config.segmentWidth + (Math.random() - 0.5) * (config.segmentWidth * 0.8);

        elements.wheel.style.transition = 'none';
        elements.wheel.style.backgroundPositionX = `${(Math.random() * -280)}px`;
        setTimeout(() => {
            elements.wheel.style.transition = 'background-position-x 5s cubic-bezier(0.1, 0.7, 0.25, 1)';
            elements.wheel.style.backgroundPositionX = `-${landingPosition}px`;
        }, 50);

        setTimeout(() => {
            if (isWinner) {
                const winnings = amount * config.payouts[winningColor];
                playerData.balance += playerData.multiplier > 1 ? (amount + (winnings - amount) * playerData.multiplier) : winnings;
                elements.resultMessage.textContent = `Победа! +${Math.floor(winnings)} ★`;
                playerData.multiplier = 1.0;
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                elements.resultMessage.textContent = `Проигрыш. Выпал: ${winningColor}`;
                tg.HapticFeedback.notificationOccurred('error');
            }
            updateBalanceDisplay();
            updateMultiplierDisplay();
            saveData();
            disableControls(false);
            elements.betButtons.forEach(b => b.classList.remove('selected'));
            state.currentBetType = null;
        }, 5100);
    }
    
    function handleDailyBonus() {
        const now = new Date().setHours(0, 0, 0, 0);
        if (new Date(playerData.lastBonusTime).setHours(0, 0, 0, 0) < now) {
            elements.bonusModal.classList.add('active');
        }
    }

    // === 7. EVENT BINDING ===
    function bindEventListeners() {
        elements.navButtons.forEach(b => b.addEventListener('click', () => {
            elements.navButtons.forEach(btn => btn.classList.remove('active'));
            b.classList.add('active');
            elements.tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(b.dataset.tab).classList.add('active');
        }));
        elements.betButtons.forEach(b => b.addEventListener('click', () => {
            elements.betButtons.forEach(btn => btn.classList.remove('selected'));
            b.classList.add('selected');
            state.currentBetType = b.dataset.bet;
        }));
        elements.spinButton.addEventListener('click', spin);
        elements.openBoxButton.addEventListener('click', () => {
            playerData.multiplier = Math.min(config.maxMultiplier, playerData.multiplier * config.boxMultipliers[Math.floor(Math.random() * config.boxMultipliers.length)]);
            tg.showAlert(`Ваш новый множитель: x${playerData.multiplier.toFixed(1)}`);
            updateMultiplierDisplay(); saveData();
        });
        elements.withdrawButton.addEventListener('click', () => {
             const amount = parseInt(elements.withdrawAmount.value, 10);
             if (isNaN(amount) || amount < config.minWithdrawal) return tg.showAlert(`Минимальная сумма: ${config.minWithdrawal} ★`);
             if (amount > playerData.balance) return tg.showAlert('Недостаточно средств!');
             tg.sendData(JSON.stringify({ type: 'withdraw_request', amount: amount }));
             playerData.balance -= amount; updateBalanceDisplay(); saveData();
        });
        elements.claimBonusButton.addEventListener('click', () => {
            playerData.balance += config.dailyBonus; playerData.lastBonusTime = Date.now();
            updateBalanceDisplay(); saveData(); elements.bonusModal.classList.remove('active');
            tg.HapticFeedback.notificationOccurred('success');
        });
        elements.resetProgressButton.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие необратимо.')) {
                localStorage.removeItem('casinoPlayerData');
                window.location.reload();
            }
        });
    }

    // === 8. INITIALIZATION FUNCTION (APP START) ===
    function main() {
        try {
            loadData();
            if (elements.username) elements.username.textContent = tg.initDataUnsafe.user?.first_name || "Пользователь";
            if (elements.userId) elements.userId.textContent = `ID: ${tg.initDataUnsafe.user?.id || 'N/A'}`;
            
            updateBalanceDisplay();
            updateMultiplierDisplay();
            bindEventListeners();
            handleDailyBonus();
        } catch (error) {
            console.error("Critical error during initialization:", error);
            // Even if something fails, try to show the app to avoid infinite loader
            document.body.innerHTML = `<div style="color: white; text-align: center; padding: 20px;">Критическая ошибка. Пожалуйста, сообщите администратору. <br><br> ${error.message}</div>`;
        } finally {
            // Ensure the loader is always hidden
            elements.loader.classList.add('hidden');
            elements.app.classList.add('loaded');
        }
    }

    main();
});