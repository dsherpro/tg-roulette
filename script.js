```javascript
document.addEventListener('DOMContentLoaded', () => {
    // Проверка на запуск не из Telegram и создание mock-объекта для тестов
    if (!window.Telegram?.WebApp?.initData) {
        console.warn("Телеграм API не найден. Создаю mock-объект для теста.");
        window.Telegram = { WebApp: {
            initDataUnsafe: { user: { id: 12345, first_name: 'Тестер', is_premium: true } },
            ready: () => {},
            expand: () => {},
            showAlert: (m) => alert(m),
            HapticFeedback: {
                notificationOccurred: (t) => console.log('Вибрация:', t),
                impactOccurred: (s) => console.log('Удар:', s)
            },
            sendData: (data) => console.log('Отправка данных боту:', data) // ИЗМЕНЕНО: Добавлен mock для sendData
        }};
    }

    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // ==========================================================
    // НАСТРОЙКИ ИГРЫ. ВСЕ МЕНЯТЬ ТОЛЬКО ЗДЕСЬ!
    // ==========================================================
    const config = {
        // ШАНС НА ПОБЕДУ (от 0.0 до 1.0). Примерно 48.6% для красного/черного.
        winRateChance: 0.486, // ИЗМЕНЕНО: Установлен более реалистичный шанс
        boxCost: 0, // Стоимость коробки. 0 = бесплатно.
        minWithdrawal: 500, // Минимальный лимит для вывода
        payouts: { red: 2, black: 2, green: 14 },
        boxMultipliers: [1.2, 1.5, 2.0],
        maxMultiplier: 10.0,
        // Описание сегментов на колесе рулетки (для логики и анимации)
        // G=Green, R=Red, B=Black (Соответствует CSS)
        wheelSegments: ['G', 'B', 'R', 'B', 'R', 'B', 'R'],
        segmentWidth: 40
    };
    // ==========================================================

    let player = { balance: 100, multiplier: 1.0 };
    let isSpinning = false, currentBetType = null;
    
    // --- Получаем все элементы со страницы один раз ---
    const elements = {
        balance: document.getElementById('balance-amount'),
        username: document.getElementById('username'),
        userId: document.getElementById('user-id'), // ИЗМЕНЕНО: Новый элемент для ID
        premiumStatus: document.getElementById('premium-status'),
        resultMessage: document.getElementById('result-message'),
        multiplier: document.getElementById('multiplier'),
        betAmountInput: document.getElementById('bet-amount'),
        withdrawAmountInput: document.getElementById('withdraw-amount'),
        spinButton: document.getElementById('spin-button'),
        openBoxButton: document.getElementById('open-box-button'),
        withdrawButton: document.getElementById('withdraw-button'),
        luckBox: document.getElementById('luck-box'),
        wheel: document.getElementById('wheel'),
        navButtons: document.querySelectorAll('.nav-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        betButtons: document.querySelectorAll('.bet-btn')
    };

    function updateBalanceDisplay() {
        elements.balance.textContent = Math.floor(player.balance);
        elements.balance.parentElement.classList.add('balance-changed');
        setTimeout(() => elements.balance.parentElement.classList.remove('balance-changed'), 500);
    }
    function updateMultiplierDisplay() { elements.multiplier.textContent = `x${player.multiplier.toFixed(1)}`; }
    function disableControls(state) {
        isSpinning = state;
        elements.spinButton.disabled = state;
        elements.openBoxButton.disabled = state;
        elements.withdrawButton.disabled = state;
        elements.betButtons.forEach(b => b.disabled = state);
    }

    // --- ЛОГИКА РУЛЕТКИ ---
    function spin() {
        const amount = parseInt(elements.betAmountInput.value, 10);
        if (!currentBetType) { tg.showAlert("Сначала выберите цвет!"); return; }
        if (isNaN(amount) || amount < 10) { tg.showAlert("Минимальная ставка: 10 ★"); return; }
        if (amount > player.balance) { tg.showAlert("Недостаточно средств!"); return; }

        disableControls(true);
        tg.HapticFeedback.impactOccurred('light'); // ИЗМЕНЕНО: Вибрация при старте
        player.balance -= amount;
        updateBalanceDisplay();
        elements.resultMessage.textContent = `Ставка ${amount} ★ на ${currentBetType}`;

        let winningColor;
        const isPlayerWinner = Math.random() < config.winRateChance;
        
        if (currentBetType !== 'green' && isPlayerWinner) {
            winningColor = currentBetType;
        } else {
            const otherColors = ['red', 'black', 'green'].filter(c => c !== currentBetType);
            const randomIndex = Math.floor(Math.random() * config.wheelSegments.length);
            let randomColor = config.wheelSegments[randomIndex].toLowerCase().replace('b', 'black').replace('r', 'red').replace('g', 'green');
            
            if(randomColor === currentBetType) {
                 winningColor = otherColors[Math.floor(Math.random() * otherColors.length)];
            } else {
                 winningColor = randomColor;
            }
        }
        
        const possibleIndexes = [];
        config.wheelSegments.forEach((segment, index) => {
            const segmentColor = segment.toLowerCase().replace('b', 'black').replace('r', 'red').replace('g', 'green');
            if (segmentColor === winningColor) {
                possibleIndexes.push(index);
            }
        });

        const targetIndex = possibleIndexes[Math.floor(Math.random() * possibleIndexes.length)];
        const totalSegments = config.wheelSegments.length;
        const fullRotations = 5;
        const landingPosition = (fullRotations * totalSegments + targetIndex) * config.segmentWidth;
        const offset = (Math.random() - 0.5) * config.segmentWidth * 0.8; 

        elements.wheel.style.transition = 'none';
        elements.wheel.style.backgroundPosition = '0px';

        setTimeout(() => {
             elements.wheel.style.transition = 'background-position 5s cubic-bezier(0.15, 0.7, 0.25, 1)';
             elements.wheel.style.backgroundPosition = `-${landingPosition + offset}px`;
        }, 20);
        
        setTimeout(() => {
            if (winningColor === currentBetType) {
                const winnings = amount * config.payouts[winningColor] * player.multiplier;
                player.balance += winnings;
                elements.resultMessage.textContent = `Победа! Выиграли ${Math.floor(winnings)} ★`;
                player.multiplier = 1.0;
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                elements.resultMessage.textContent = `Проигрыш. Выпал: ${winningColor}`;
                tg.HapticFeedback.notificationOccurred('error');
            }
            updateBalanceDisplay(); updateMultiplierDisplay(); disableControls(false);
            elements.betButtons.forEach(b => b.classList.remove('selected'));
            currentBetType = null;
        }, 5500);
    }
    
    function init() {
        if (tg.initDataUnsafe?.user) {
            elements.username.textContent = tg.initDataUnsafe.user.first_name;
            elements.userId.textContent = `ID: ${tg.initDataUnsafe.user.id}`; // ИЗМЕНЕНО: Показываем ID
            if (tg.initDataUnsafe.user.is_premium) elements.premiumStatus.textContent = 'Premium ★';
        }
        updateBalanceDisplay();
        updateMultiplierDisplay();
        
        elements.openBoxButton.textContent = `Открыть (${config.boxCost > 0 ? config.boxCost + ' ★' : 'Бесплатно'})`;

        elements.navButtons.forEach(button => {
            button.addEventListener('click', () => {
                if(isSpinning) return;
                const tabId = button.dataset.tab;
                
                elements.tabContents.forEach(tab => tab.classList.remove('active'));
                elements.navButtons.forEach(btn => btn.classList.remove('active'));
                
                document.getElementById(tabId).classList.add('active');
                button.classList.add('active');
            });
        });
        
        elements.betButtons.forEach(button => {
            button.addEventListener('click', () => {
                if(isSpinning) return;
                currentBetType = button.dataset.bet;
                
                elements.betButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                tg.HapticFeedback.impactOccurred('light');
            });
        });
        
        elements.spinButton.addEventListener('click', spin);
        
        elements.openBoxButton.addEventListener('click', () => {
            if (player.balance < config.boxCost) { tg.showAlert(`Нужно ${config.boxCost} ★`); return; }
            if (isSpinning) return;
            
            disableControls(true);
            if (config.boxCost > 0) player.balance -= config.boxCost;
            updateBalanceDisplay();
            elements.luckBox.classList.add('opening');
            tg.HapticFeedback.impactOccurred('heavy');
            
            setTimeout(() => {
                const newMultiplier = config.boxMultipliers[Math.floor(Math.random() * config.boxMultipliers.length)];
                player.multiplier *= newMultiplier;
                if (player.multiplier > config.maxMultiplier) player.multiplier = config.maxMultiplier;
                
                updateMultiplierDisplay();
                tg.showAlert(`Ваш новый множитель: x${player.multiplier.toFixed(1)}`);
                elements.luckBox.classList.remove('opening');
                disableControls(false);
            }, 700);
        });

        elements.withdrawButton.addEventListener('click', () => {
            const amount = parseInt(elements.withdrawAmountInput.value, 10);
            if (isNaN(amount) || amount < config.minWithdrawal) {
                tg.showAlert(`Минимальная сумма для вывода: ${config.minWithdrawal} ★`); return;
            }
            if (amount > player.balance) { tg.showAlert('Недостаточно средств!'); return; }
            
            const dataToSend = JSON.stringify({
                type: 'withdraw_request',
                amount: amount
            });
            // Эта функция отправит данные вашему боту
            tg.sendData(dataToSend);

            player.balance -= amount;
            updateBalanceDisplay();
            tg.showAlert('Запрос на вывод отправлен администратору на рассмотрение!');
        });
    }

    init();
});
```