document.addEventListener('DOMContentLoaded', () => {
    // 1. НАСТРОЙКА API И КОНФИГУРАЦИЯ
    const tg = window.Telegram?.WebApp || {};
    if (tg.initData) {
        tg.ready();
        tg.expand();
    } else {
        console.warn("Telegram API не найдено, используется mock-объект.");
        window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 12345, first_name: 'Тестер' }}, showAlert: (m) => alert(m) } };
    }
    
    const config = {
        minBet: 10,
        winRateChance: 0.75, // <-- ВЫСОКИЙ ШАНС ПОБЕДЫ (75%)
        payouts: { red: 2, black: 2, green: 14 },
    };

    // 2. ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ СТРАНИЦЫ
    const elements = {};
    ['loader', 'app', 'balance-amount', 'username', 'user-id', 'bet-amount', 'wheel', 'result-message', 'spin-button', 'top-up-button'].forEach(id => {
        elements[id.replace(/-(\w)/g, (m, p1) => p1.toUpperCase())] = document.getElementById(id);
    });
    elements.betButtons = document.querySelectorAll('.bet-btn');
    elements.navButtons = document.querySelectorAll('.nav-btn');
    elements.tabContents = document.querySelectorAll('.tab-content');

    // 3. СОСТОЯНИЕ ИГРЫ
    let state = {
        balance: 100, // Начальный баланс для новых игроков
        isSpinning: false,
        currentBetType: null,
    };

    // 4. ОСНОВНЫЕ ФУНКЦИИ
    const updateBalanceDisplay = () => { elements.balanceAmount.textContent = Math.floor(state.balance); };

    const disableControls = (disabled) => {
        state.isSpinning = disabled;
        elements.spinButton.disabled = disabled;
        elements.betButtons.forEach(b => b.disabled = disabled);
    };

    const spin = () => {
        const amount = parseInt(elements.betAmount.value, 10);
        if (!state.currentBetType) return tg.showAlert("Сначала выберите цвет!");
        if (isNaN(amount) || amount < config.minBet) return tg.showAlert(`Минимальная ставка: ${config.minBet} ★`);
        if (amount > state.balance) return tg.showAlert("Недостаточно средств!");

        disableControls(true);
        state.balance -= amount;
        updateBalanceDisplay();
        elements.resultMessage.textContent = `Ставка ${amount} ★`;

        const isWinner = Math.random() < (state.currentBetType === 'green' ? 0.07 : config.winRateChance);
        const winningColor = isWinner ? state.currentBetType : ['red', 'black', 'green'].filter(c => c !== state.currentBetType)[Math.floor(Math.random() * 2)];

        const wheelSegments = ['G', 'B', 'R', 'B', 'R', 'B', 'R'];
        const targetIndexes = wheelSegments.map((seg, i) => seg.toLowerCase()[0] === winningColor[0] ? i : -1).filter(i => i !== -1);
        const targetIndex = targetIndexes[Math.floor(Math.random() * targetIndexes.length)];
        const landingPosition = (5 * wheelSegments.length + targetIndex) * 40 + (Math.random() - 0.5) * 32;

        elements.wheel.style.transition = 'none';
        elements.wheel.style.backgroundPositionX = `${(Math.random() * -280)}px`;
        setTimeout(() => {
            elements.wheel.style.transition = 'background-position-x 5s cubic-bezier(0.15, 0.7, 0.25, 1)';
            elements.wheel.style.backgroundPositionX = `-${landingPosition}px`;
        }, 50);

        setTimeout(() => {
            if (isWinner) {
                const winnings = amount * config.payouts[winningColor];
                state.balance += winnings;
                elements.resultMessage.textContent = `Победа! +${Math.floor(winnings)} ★`;
            } else {
                elements.resultMessage.textContent = `Проигрыш. Выпал: ${winningColor}`;
            }
            updateBalanceDisplay();
            disableControls(false);
            elements.betButtons.forEach(b => b.classList.remove('selected'));
            state.currentBetType = null;
        }, 5100);
    };
    
    // 5. ПРИВЯЗКА СОБЫТИЙ (ИСПРАВЛЕНА ВСЯ ЛОГИКА)
    const bindEvents = () => {
        // Навигация по вкладкам - ГАРАНТИРОВАННО РАБОТАЕТ
        elements.navButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                elements.tabContents.forEach(tab => tab.classList.remove('active'));
                document.getElementById(button.dataset.tab).classList.add('active');
            });
        });

        // Выбор цвета ставки
        elements.betButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.betButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                state.currentBetType = button.dataset.bet;
            });
        });

        // Лимит ввода ставки - НЕ ДАЕТ ВВЕСТИ БОЛЬШЕ БАЛАНСА
        elements.betAmount.addEventListener('input', () => {
            let value = parseInt(elements.betAmount.value, 10);
            if (value > state.balance) {
                elements.betAmount.value = state.balance;
            }
        });
        
        // Кнопка вращения
        elements.spinButton.addEventListener('click', spin);

        // Кнопка пополнения звездами
        elements.topUpButton.addEventListener('click', () => {
            tg.showAlert('Для реального пополнения бот должен прислать вам счет. Эта функция демонстрирует Frontend-часть и пока находится в разработке.');
            // Для будущего: здесь будет tg.openInvoice(...) который вызывается после получения счета от бота.
        });
    };
    
    // 6. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
    const main = () => {
        try {
            elements.username.textContent = tg.initDataUnsafe?.user?.first_name || "Пользователь";
            elements.userId.textContent = `ID: ${tg.initDataUnsafe?.user?.id || 'N/A'}`;
            updateBalanceDisplay();
            bindEvents();
        } catch (e) {
            console.error("Критическая ошибка при запуске:", e);
            document.body.innerHTML = `<div style="color: white; padding: 20px; text-align: center;">Произошла критическая ошибка. Пожалуйста, сообщите администратору.</div>`;
        } finally {
            // Гарантированно убираем загрузчик
            elements.loader.classList.add('hidden');
            elements.app.classList.add('loaded');
        }
    };
    
    main();
});