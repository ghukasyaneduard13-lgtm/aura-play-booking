
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  throw new Error('Укажи BOT_TOKEN и ADMIN_ID в настройках Secrets');
}

const bot = new TelegramBot(TOKEN, { polling: true });
const bookings = new Map();
let nextId = 1;

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🎮 Забронировать'],
      ['📋 Мои заявки', 'ℹ️ Информация']
    ],
    resize_keyboard: true
  }
};

const types = {
  '💻 Компьютер': 'Компьютер',
  '🎮 PS5': 'PS5',
  '👑 VIP-комната': 'VIP-комната'
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🔥 Добро пожаловать в Aura Play!\n\n' +
    'Бронируй игровое место минимум на 5 часов.\n' +
    'Заявка вступает в силу только после подтверждения администратора.',
    mainMenu
  );
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text;

  if (text === '🎮 Забронировать') {
    bookings.set(userId, { step: 'type' });

    return bot.sendMessage(chatId, 'Выбери место:', {
      reply_markup: {
        keyboard: [
          ['💻 Компьютер', '🎮 PS5'],
          ['👑 VIP-комната'],
          ['❌ Отмена']
        ],
        resize_keyboard: true
      }
    });
  }

  if (text === '❌ Отмена') {
    bookings.delete(userId);
    return bot.sendMessage(chatId, 'Заявка отменена.', mainMenu);
  }

  if (text === '📋 Мои заявки') {
    const mine = [...bookings.values()]
      .filter(b => b.userId === userId && b.status);

    return bot.sendMessage(
      chatId,
      mine.length
        ? mine.map(b =>
            `#${b.id} ${b.type}\n${b.date} ${b.time}\n` +
            `${b.hours} ч. — ${b.status}`
          ).join('\n\n')
        : 'Активных заявок нет.',
      mainMenu
    );
  }

  if (text === 'ℹ️ Информация') {
    return bot.sendMessage(
      chatId,
      'Aura Play 🎮\nМинимальная бронь — 5 часов.\n' +
      'Отправка заявки бесплатна. Бронь подтверждает администратор.',
      mainMenu
    );
  }

  const state = bookings.get(userId);
  if (!state) return;

  if (types[text] && state.step === 'type') {
    state.type = types[text];
    state.step = 'date';
    return bot.sendMessage(
      chatId,
      'Введи дату бронирования в формате ГГГГ-ММ-ДД.\nНапример: 2026-10-20'
    );
  }

  if (state.step === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return bot.sendMessage(chatId, 'Неверный формат. Пример: 2026-10-20');
    }

    const d = new Date(`${text}T00:00:00`);
    if (Number.isNaN(d.getTime()) ||
        d.toISOString().slice(0, 10) !== text ||
        text < new Date().toLocaleDateString('en-CA')) {
      return bot.sendMessage(chatId, 'Выбери корректную дату не в прошлом.');
    }

    state.date = text;
    state.step = 'time';
    return bot.sendMessage(chatId, 'Введи время начала, например 14:00.');
  }

  if (state.step === 'time') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
      return bot.sendMessage(chatId, 'Введи время в формате 14:00.');
    }

    state.time = text;
    state.step = 'hours';
    return bot.sendMessage(chatId, 'На сколько часов? Введи число от 5 до 12.');
  }

  if (state.step === 'hours') {
    const hours = Number(text);
    if (!Number.isInteger(hours) || hours < 5 || hours > 12) {
      return bot.sendMessage(chatId, 'Минимум 5, максимум 12 часов.');
    }

    const bookingDate = new Date(`${state.date}T${state.time}:00`);
    if (bookingDate <= new Date()) {
      return bot.sendMessage(chatId, 'Это время уже прошло. Начни заново.', mainMenu);
    }

    state.hours = hours;
    state.userId = userId;
    state.chatId = chatId;
    state.name = msg.from.username
      ? '@' + msg.from.username
      : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

    state.id = nextId++;
    state.status = 'Ожидает подтверждения';
    bookings.set(userId, state);

    const requestText =
      `🎮 Заявка Aura Play #${state.id}\n\n` +
      `Клиент: ${state.name}\nID: ${userId}\n` +
      `Место: ${state.type}\nДата: ${state.date}\n` +
      `Начало: ${state.time}\nДлительность: ${hours} ч.\n\n` +
      'Подтверди или отклони заявку:';

    try {
      await bot.sendMessage(ADMIN_ID, requestText, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `ok_${state.id}` },
            { text: '❌ Отклонить', callback_data: `no_${state.id}` }
          ]]
        }
      });

      await bot.sendMessage(
        chatId,
        `Заявка #${state.id} отправлена администратору!\n` +
        'Бронирование пока не подтверждено.',
        mainMenu
      );
    } catch (e) {
      await bot.sendMessage(
        chatId,
        'Не удалось отправить заявку. Попробуй позже.',
        mainMenu
      );
      console.error(e.message);
    }

    bookings.set(userId, state);
  }
});

bot.on('callback_query', async (query) => {
  if (String(query.from.id) !== String(ADMIN_ID)) {
    return bot.answerCallbackQuery(query.id, {
      text: 'Только администратор может это сделать.'
    });
  }

  const match = query.data.match(/^(ok|no)_(\d+)$/);
  if (!match) return;

  const [, action, id] = match;
  const booking = [...bookings.values()].find(b => String(b.id) === id);

  if (!booking || booking.status !== 'Ожидает подтверждения') {
    return bot.answerCallbackQuery(query.id, {
      text: 'Заявка не найдена или уже обработана.'
    });
  }

  booking.status = action === 'ok' ? 'Подтверждена' : 'Отклонена';

  await bot.sendMessage(
    booking.chatId,
    action === 'ok'
      ? `✅ Твоя заявка #${id} подтверждена администратором!`
      : `❌ Заявка #${id} отклонена администратором.`,
    mainMenu
  );

  await bot.answerCallbackQuery(query.id, { text: 'Готово!' });
  await bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    }
  );
});

bot.on('polling_error', (err) => console.error(err.message));

console.log('Aura Play Booking запущен');

