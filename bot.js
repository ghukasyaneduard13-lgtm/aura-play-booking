const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');

if (!TOKEN || !ADMIN_ID) {
  throw new Error('Не заданы BOT_TOKEN или ADMIN_ID');
}

const bot = new TelegramBot(TOKEN, { polling: true });

const users = new Map();
const bookings = [];
let nextBookingId = 1;

const assets = {
  computer: [
    { id: 'PC1', name: 'Компьютер № 1' },
    { id: 'PC2', name: 'Компьютер № 2' },
    { id: 'PC3', name: 'Компьютер № 3' },
    { id: 'PC4', name: 'Компьютер № 4' },
    { id: 'PC5', name: 'Компьютер № 5' }
  ],
  ps_normal: [
    { id: 'PSN1', name: 'PS5 Pro — обычная зона № 1' },
    { id: 'PSN2', name: 'PS5 Pro — обычная зона № 2' }
  ],
  ps_vip: [
    { id: 'PSV1', name: 'PS5 Pro — VIP-зона № 1' },
    { id: 'PSV2', name: 'PS5 Pro — VIP-зона № 2' }
  ]
};

function menu() {
  return {
    reply_markup: {
      keyboard: [
        ['🎮 Забронировать'],
        ['📋 Мои заявки', 'ℹ️ Информация']
      ],
      resize_keyboard: true
    }
  };
}

function getAsset(id) {
  return Object.values(assets).flat().find(a => a.id === id);
}

function getRate(category, hour) {
  const daytime = hour >= 10 && hour < 20;

  if (category === 'computer') return daytime ? 1000 : 1200;
  if (category === 'ps_normal') return daytime ? 1000 : 1200;
  if (category === 'ps_vip') return daytime ? 1200 : 1400;

  return 0;
}

// Время клуба: Армения, UTC+4.
const OFFSET = 4 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function toArmeniaTimestamp(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  return Date.UTC(year, month - 1, day, hour, minute) - OFFSET;
}

function calculatePrice(category, start, duration) {
  const end = start + duration * HOUR;
  let cursor = start;
  let total = 0;

  while (cursor < end) {
    const localTime = cursor + OFFSET;
    const hour = new Date(localTime).getUTCHours();
    const nextHour =
      (Math.floor(localTime / HOUR) + 1) * HOUR - OFFSET;
    const segmentEnd = Math.min(end, nextHour);
    const minutes = (segmentEnd - cursor) / 60000;

    total += getRate(category, hour) * minutes / 60;
    cursor = segmentEnd;
  }

  return Math.round(total);
}

function formatDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

function dateIsValid(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));

  return parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d;
}

function timeIsValid(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;

  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function isAvailable(assetId, start, end) {
  return !bookings.some(b =>
    b.assetId === assetId &&
    ['pending', 'approved'].includes(b.status) &&
    start < b.end &&
    end > b.start
  );
}

function startBooking(chatId) {
  users.set(chatId, { step: 'category' });

  bot.sendMessage(chatId, 'Что хочешь забронировать?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🖥 Компьютер', callback_data: 'cat:computer' }],
        [{ text: '🎮 PS5 Pro — обычная зона', callback_data: 'cat:ps_normal' }],
        [{ text: '👑 PS5 Pro — VIP-зона', callback_data: 'cat:ps_vip' }]
      ]
    }
  });
}

function askDate(chatId) {
  users.get(chatId).step = 'date';

  bot.sendMessage(
    chatId,
    'Укажи дату начала бронирования в формате ГГГГ-ММ-ДД.\nНапример: 2026-10-20'
  );
}

function askTime(chatId) {
  users.get(chatId).step = 'time';

  bot.sendMessage(
    chatId,
    'Укажи время начала в формате ЧЧ:ММ по времени Армении.\nНапример: 18:30'
  );
}

function showDurations(chatId) {
  users.get(chatId).step = 'duration';

  const keyboard = [];
  for (let i = 1; i <= 12; i += 1) {
    keyboard.push({
      text: `${i} ч.`,
      callback_data: `duration:${i}`
    });
  }

  bot.sendMessage(chatId, 'На сколько часов бронируем?', {
    reply_markup: {
      inline_keyboard: [
        keyboard.slice(0, 4),
        keyboard.slice(4, 8),
        keyboard.slice(8, 12)
      ]
    }
  });
}

function askPhone(chatId) {
  users.get(chatId).step = 'phone';

  bot.sendMessage(
    chatId,
    'Напиши свой номер телефона, чтобы администратор мог связаться с тобой.\nНапример: +374XXXXXXXX'
  );
}

bot.onText(/^\/start$/, msg => {
  users.delete(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать в Aura Play! 🎮\n\nЗдесь можно забронировать компьютер или PS5 Pro.',
    menu()
  );
});

bot.on('message', msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const state = users.get(chatId);

  if (text === '🎮 Забронировать') {
    startBooking(chatId);
    return;
  }

  if (text === '📋 Мои заявки') {
    const mine = bookings.filter(b => b.userId === chatId);

    if (!mine.length) {
      bot.sendMessage(chatId, 'У тебя пока нет заявок.', menu());
      return;
    }

    const details = mine.map(b =>
      `Заявка №${b.id}\n` +
      `${b.assetName}\n` +
      `${formatDate(b.date)} в ${b.time}\n` +
      `${b.duration} ч. — ${b.price.toLocaleString('ru-RU')} ֏\n` +
      `Статус: ${
        b.status === 'pending' ? 'Ожидает подтверждения' :
        b.status === 'approved' ? 'Подтверждена' : 'Отклонена'
      }`
    );

    bot.sendMessage(chatId, details.join('\n\n'), menu());
    return;
  }

  if (text === 'ℹ️ Информация') {
    bot.sendMessage(
      chatId,
      'Aura Play 🎮\n' +
      'Компьютеры: 1–5\n' +
      'PS5 Pro — обычная зона: 1–2\n' +
      'PS5 Pro — VIP-зона: 1–2\n\n' +
      'День: 10:00–20:00\n' +
      'Ночь: 20:00–10:00\n' +
      'Бронирование — минимум за 2 часа.\n' +
      'Заявка подтверждается администратором.',
      menu()
    );
    return;
  }

  if (!state) return;

  if (state.step === 'date') {
    if (!dateIsValid(text)) {
      bot.sendMessage(chatId, 'Неверная дата. Введи её так: 2026-10-20');
      return;
    }

    state.date = text;
    askTime(chatId);
    return;
  }

  if (state.step === 'time') {
    if (!timeIsValid(text)) {
      bot.sendMessage(chatId, 'Неверное время. Пример: 18:30');
      return;
    }

    const start = toArmeniaTimestamp(state.date, text);

    if (start - Date.now() < 2 * HOUR) {
      bot.sendMessage(
        chatId,
        'Бронирование нужно оформить минимум за 2 часа до начала. Выбери другое время.'
      );
      return;
    }

    state.time = text;
    showDurations(chatId);
    return;
  }

  if (state.step === 'phone') {
    const digits = text.replace(/\D/g, '');

    if (digits.length < 7 || digits.length > 15) {
      bot.sendMessage(
        chatId,
        'Проверь номер телефона и отправь его ещё раз.'
      );
      return;
    }

    const asset = getAsset(state.assetId);
    const start = toArmeniaTimestamp(state.date, state.time);
    const end = start + state.duration * HOUR;

    if (start - Date.now() < 2 * HOUR) {
      bot.sendMessage(
        chatId,
        'До начала осталось меньше 2 часов. Начни бронирование заново.',
        menu()
      );
      users.delete(chatId);
      return;
    }

    if (!isAvailable(state.assetId, start, end)) {
      bot.sendMessage(
        chatId,
        'Это место уже занято на выбранное время. Начни заново и выбери другое место.',
        menu()
      );
      users.delete(chatId);
      return;
    }

    const price = calculatePrice(state.category, start, state.duration);

    const booking = {
      id: nextBookingId++,
      userId: chatId,
      username: msg.from.username ? `@${msg.from.username}` : 'не указан',
      assetId: state.assetId,
      assetName: asset.name,
      category: state.category,
      date: state.date,
      time: state.time,
      start,
      end,
      duration: state.duration,
      phone: text,
      price,
      status: 'pending'
    };

    bookings.push(booking);
    users.delete(chatId);

    bot.sendMessage(
      chatId,
      `Заявка №${booking.id} отправлена администратору! ✅\n\n` +
      `${booking.assetName}\n` +
      `Дата: ${formatDate(booking.date)}\n` +
      `Начало: ${booking.time}\n` +
      `Длительность: ${booking.duration} ч.\n` +
      `Телефон: ${booking.phone}\n` +
      `Итого: ${booking.price.toLocaleString('ru-RU')} ֏\n\n` +
      'Ожидай подтверждения.',
      menu()
    );

    bot.sendMessage(
      ADMIN_ID,
      `🎮 Новая заявка №${booking.id}\n\n` +
      `Место: ${booking.assetName}\n` +
      `Клиент: ${booking.username}\n` +
      `Telegram ID: ${booking.userId}\n` +
      `Телефон: ${booking.phone}\n` +
      `Дата: ${formatDate(booking.date)}\n` +
      `Начало: ${booking.time}\n` +
      `Длительность: ${booking.duration} ч.\n` +
      `Стоимость: ${booking.price.toLocaleString('ru-RU')} ֏`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `approve:${booking.id}` },
            { text: '❌ Отклонить', callback_data: `reject:${booking.id}` }
          ]]
        }
      }
    ).catch(err => console.error('Ошибка отправки администратору:', err));

    return;
  }
});

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const state = users.get(chatId);

  if (data.startsWith('cat:')) {
    if (!state || state.step !== 'category') {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const category = data.slice(4);
    if (!assets[category]) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    state.category = category;
    state.step = 'asset';

    await bot.editMessageText('Выбери конкретное место:', {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: assets[category].map(a => [{
          text: a.name,
          callback_data: `asset:${a.id}`
        }])
      }
    });

    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith('asset:')) {
    if (!state || state.step !== 'asset') {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const assetId = data.slice(6);
    const asset = getAsset(assetId);

    if (!asset || !assets[state.category].some(a => a.id === assetId)) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    state.assetId = assetId;
    await bot.answerCallbackQuery(query.id);
    await askDate(chatId);
    return;
  }

  if (data.startsWith('duration:')) {
    if (!state || state.step !== 'duration') {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const duration = Number(data.slice(9));
    if (!Number.isInteger(duration) || duration < 1 || duration > 12) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    state.duration = duration;
    await bot.answerCallbackQuery(query.id);
    await askPhone(chatId);
    return;
  }

  if (data.startsWith('approve:') || data.startsWith('reject:')) {
    if (String(query.from.id) !== ADMIN_ID) {
      await bot.answerCallbackQuery(query.id, {
        text: 'Эта кнопка доступна только администратору.',
        show_alert: true
      });
      return;
    }

    const [action, idText] = data.split(':');
    const booking = bookings.find(b => b.id === Number(idText));

    if (!booking || booking.status !== 'pending') {
      await bot.answerCallbackQuery(query.id, {
        text: 'Заявка уже обработана или не найдена.'
      });
      return;
    }

    if (action === 'approve') {
      booking.status = 'approved';

      await bot.sendMessage(
        booking.userId,
        `✅ Заявка №${booking.id} подтверждена!\n` +
        `${booking.assetName}\n` +
        `${formatDate(booking.date)} в ${booking.time}`
      );
    } else {
      booking.status = 'rejected';

      await bot.sendMessage(
        booking.userId,
        `❌ Заявка №${booking.id} отклонена. Свяжись с Aura Play для уточнения.`
      );
    }

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    await bot.answerCallbackQuery(query.id, { text: 'Готово!' });
  }
});

bot.on('polling_error', error => {
  console.error('Ошибка Telegram:', error.message);
});

console
