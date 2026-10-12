
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');

if (!TOKEN || !ADMIN_ID) {
  throw new Error('Не заданы BOT_TOKEN или ADMIN_ID в настройках Render');
}

const bot = new TelegramBot(TOKEN, { polling: true });

const users = new Map();
const bookings = [];
let nextBookingId = 1;

const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';
const OPEN_TEXT = 'Ежедневно: 10:00–05:00';

const assets = {
  computer: Array.from({ length: 5 }, (_, i) => ({
    id: `PC${i + 1}`,
    name: `Компьютер № ${i + 1}`
  })),
  ps_normal: [
    { id: 'PSN1', name: 'PS5 Pro — обычная зона № 1' },
    { id: 'PSN2', name: 'PS5 Pro — обычная зона № 2' }
  ],
  ps_vip: [
    { id: 'PSV1', name: 'PS5 Pro — VIP-комната № 1' },
    { id: 'PSV2', name: 'PS5 Pro — VIP-комната № 2' }
  ]
};

// Фото можно добавить позже через Telegram file_id.
const photos = {
  home: process.env.PHOTO_HOME || '',
  booking: process.env.PHOTO_BOOKING || '',
  prices: process.env.PHOTO_PRICES || '',
  vip: process.env.PHOTO_VIP || '',
  schedule: process.env.PHOTO_SCHEDULE || '',
  help: process.env.PHOTO_HELP || ''
};

function menu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '🎮 Забронировать' }, { text: '💰 Посмотреть цены' }],
        [{ text: '👑 VIP-комнаты' }, { text: '📅 Расписание' }],
        [{ text: '📋 Мои заявки' }, { text: 'ℹ️ Информация' }],
        [{ text: '🛠 Техподдержка' }]
      ],
      resize_keyboard: true
    }
  };
}

async function sendSection(chatId, key, text, options = {}) {
  const photo = photos[key];
  if (photo) {
    try {
      return await bot.sendPhoto(chatId, photo, {
        caption: text,
        parse_mode: 'HTML',
        ...options
      });
    } catch (e) {
      console.error('Не удалось отправить фото:', e.message);
    }
  }
  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    ...options
  });
}

function getRate(category, hour) {
  const daytime = hour >= 10 && hour < 20;
  if (category === 'computer') return daytime ? 1000 : 1200;
  if (category === 'ps_normal') return daytime ? 1000 : 1200;
  if (category === 'ps_vip') return daytime ? 1200 : 1400;
  return 0;
}

function calculatePrice(category, start, duration) {
  let total = 0;
  const end = start + duration * 60 * 60 * 1000;
  for (let t = start; t < end; t += 60 * 60 * 1000) {
    const date = new Date(t + 4 * 60 * 60 * 1000);
    total += getRate(category, date.getUTCHours());
  }
  return total;
}

function formatDate(timestamp) {
  const d = new Date(timestamp + 4 * 60 * 60 * 1000);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hour}:${min}`;
}

function toArmeniaTimestamp(date, time) {
  const [day, month, year] = date.split('.').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) - 4 * 60 * 60 * 1000;
}

function validDate(date) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return false;
  const [d, m, y] = date.split('.').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d;
}

function validTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function bookingLeadHours(startTimestamp) {
  const d = new Date(startTimestamp + 4 * 60 * 60 * 1000);
  const hour = d.getUTCHours();
  return hour >= 5 && hour < 10 ? 5 : 2;
}

function isAvailable(assetId, start, end) {
  return !bookings.some(b =>
    b.assetId === assetId &&
    ['pending', 'approved'].includes(b.status) &&
    start < b.end && end > b.start
  );
}

function findAsset(id) {
  return Object.values(assets).flat().find(a => a.id === id);
}

function priceText() {
  return [
    '<b>💰 ЦЕНЫ AURA PLAY</b>',
    '',
    '<b>Компьютеры:</b>',
    '10:00–20:00 — 1 000 драм/час',
    '20:00–10:00 — 1 200 драм/час',
    '',
    '<b>PS5 Pro — обычная зона:</b>',
    '10:00–20:00 — 1 000 драм/час',
    '20:00–10:00 — 1 200 драм/час',
    '',
    '<b>PS5 Pro — VIP-комната:</b>',
    '10:00–20:00 — 1 200 драм/час',
    '20:00–10:00 — 1 400 драм/час',
    '',
    'Итоговая цена рассчитывается по часам бронирования.'
  ].join('\n');
}

async function showPrices(chatId) {
  await sendSection(chatId, 'prices', priceText());
}

async function showVip(chatId) {
  const text = [
    '<b>👑 VIP-КОМНАТЫ AURA PLAY</b>',
    '',
    '1. VIP-комната № 1 — PS5 Pro',
    '2. VIP-комната № 2 — PS5 Pro',
    '',
    'Дневной тариф: 1 200 драм/час.',
    'Ночной тариф: 1 400 драм/час.',
    '',
    'Нажми «🎮 Забронировать», чтобы выбрать комнату.'
  ].join('\n');
  await sendSection(chatId, 'vip', text);
}

async function showSchedule(chatId) {
  const text = [
    '<b>📅 РАСПИСАНИЕ AURA PLAY</b>',
    '',
    'Основное время работы: 10:00–05:00.',
    'Время начала бронирования с 05:00 до 10:00 требует оформления минимум за 5 часов.',
    'В остальное время бронирование нужно оформить минимум за 2 часа.',
    '',
    'Для бронирования на особое время отправь заявку заранее.'
  ].join('\n');
  await sendSection(chatId, 'schedule', text);
}

async function showHelp(chatId) {
  const text = [
    '<b>🛠 ТЕХНИЧЕСКАЯ ПОДДЕРЖКА AURA PLAY</b>',
    '',
    `📞 Телефон: ${SUPPORT_PHONE}`,
    `💬 Telegram: ${SUPPORT_TELEGRAM}`,
    '',
    'По вопросам бронирования, оплаты и работы клуба обращайся к нам.'
  ].join('\n');
  await sendSection(chatId, 'help', text);
}

function startBooking(chatId) {
  users.set(chatId, { step: 'category' });
  return bot.sendMessage(chatId, '🎮 Что хочешь забронировать?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💻 Компьютер', callback_data: 'cat:computer' }],
        [{ text: '🎮 PS5 Pro — обычная зона', callback_data: 'cat:ps_normal' }],
        [{ text: '👑 PS5 Pro — VIP-комната', callback_data: 'cat:ps_vip' }]
      ]
    }
  });
}

function askDate(chatId) {
  users.set(chatId, { ...users.get(chatId), step: 'date' });
  return bot.sendMessage(chatId,
    '📅 Напиши дату бронирования в формате ДД.ММ.ГГГГ.\nНапример: 25.10.2026');
}

function askTime(chatId) {
  users.set(chatId, { ...users.get(chatId), step: 'time' });
  return bot.sendMessage(chatId,
    '⏰ Напиши время начала в формате ЧЧ:ММ.\nНапример: 18:00');
}

function showDurations(chatId) {
  const rows = [];
  for (let i = 1; i <= 12; i += 3) {
    rows.push([
      ...[i, i + 1, i + 2].filter(n => n <= 12).map(n => ({
        text: `${n} ч.`,
        callback_data: `duration:${n}`
      }))
    ]);
  }
  users.set(chatId, { ...users.get(chatId), step: 'duration' });
  return bot.sendMessage(chatId, '⌛ Выбери длительность бронирования:', {
    reply_markup: { inline_keyboard: rows }
  });
}

function askPhone(chatId) {
  users.set(chatId, { ...users.get(chatId), step: 'phone' });
  return bot.sendMessage(chatId,
    '📱 Напиши свой номер телефона для подтверждения брони.');
}

async function showMyBookings(chatId) {
  const list = bookings.filter(b => b.chatId === chatId);
  if (!list.length) {
    return bot.sendMessage(chatId, 'У тебя пока нет заявок на бронирование.');
  }
  const lines = ['<b>📋 ТВОИ ЗАЯВКИ</b>', ''];
  for (const b of list) {
    const asset = findAsset(b.assetId);
    lines.push(
      `Заявка №${b.id}`,
      `Место: ${asset ? asset.name : b.assetId}`,
      `Начало: ${formatDate(b.start)}`,
      `Окончание: ${formatDate(b.end)}`,
      `Цена: ${b.price.toLocaleString('ru-RU')} драм`,
      `Статус: ${b.status === 'pending' ? '⏳ Ожидает подтверждения' :
        b.status === 'approved' ? '✅ Подтверждена' : '❌ Отклонена'}`,
      ''
    );
  }
  return bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
}

bot.onText(/\/start/, async msg => {
  users.delete(msg.chat.id);
  await sendSection(
    msg.chat.id,
    'home',
    '<b>🎮 Добро пожаловать в Aura Play!</b>\n\nЗдесь ты можешь забронировать компьютер или PS5 Pro, посмотреть цены и выбрать VIP-комнату.',
    menu()
  );
});

bot.onText(/\/book/, msg => startBooking(msg.chat.id));
bot.onText(/\/prices/, msg => showPrices(msg.chat.id));
bot.onText(/\/vip/, msg => showVip(msg.chat.id));
bot.onText(/\/schedule/, msg => showSchedule(msg.chat.id));
bot.onText(/\/help/, msg => showHelp(msg.chat.id));
bot.onText(/\/mybookings/, msg => showMyBookings(msg.chat.id));

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === '🎮 Забронировать') return startBooking(chatId);
  if (text === '💰 Посмотреть цены') return showPrices(chatId);
  if (text === '👑 VIP-комнаты') return showVip(chatId);
  if (text === '📅 Расписание') return showSchedule(chatId);
  if (text === '📋 Мои заявки') return showMyBookings(chatId);
  if (text === '🛠 Техподдержка') return showHelp(chatId);
  if (text === 'ℹ️ Информация') {
    return sendSection(chatId, 'home',
      '<b>ℹ️ Информация Aura Play</b>\n\n' +
      `${OPEN_TEXT}\n` +
      'Компьютеры, PS5 Pro и две VIP-комнаты.\n\n' +
      'Нажми «💰 Посмотреть цены», чтобы увидеть тарифы.',
      menu()
    );
  }

  const state = users.get(chatId);
  if (!state) return;

  if (state.step === 'date') {
    if (!validDate(text)) {
      return bot.sendMessage(chatId, 'Неверный формат даты. Напиши ДД.ММ.ГГГГ.');
    }
    state.date = text;
    return askTime(chatId);
  }

  if (state.step === 'time') {
    if (!validTime(text)) {
      return bot.sendMessage(chatId, 'Неверное время. Напиши в формате ЧЧ:ММ.');
    }
    state.time = text;
    const start = toArmeniaTimestamp(state.date, state.time);
    const leadHours = bookingLeadHours(start);
    const now = Date.now();

    if (start <= now) {
      return bot.sendMessage(chatId, 'Это время уже прошло. Укажи будущую дату и время.');
    }
    if (start - now < leadHours * 60 * 60 * 1000) {
      return bot.sendMessage(chatId,
        `Для выбранного времени нужно оформить бронь минимум за ${leadHours} часа. Попробуй выбрать более позднее время.`);
    }
    return showDurations(chatId);
  }

  if (state.step === 'phone') {
    const phone = text.replace(/[^\d+]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return bot.sendMessage(chatId, 'Проверь номер телефона и отправь его ещё раз.');
    }
    state.phone = phone;
    const start = toArmeniaTimestamp(state.date, state.time);
    const end = start + state.duration * 60 * 60 * 1000;
    const leadHours = bookingLeadHours(start);

    if (start - Date.now() < leadHours * 60 * 60 * 1000) {
      users.delete(chatId);
      return bot.sendMessage(chatId,
        `Не удалось оформить бронь: нужно минимум ${leadHours} часа до начала. Начни заново и выбери другое время.`);
    }

    if (!isAvailable(state.assetId, start, end)) {
      users.delete(chatId);
      return bot.sendMessage(chatId,
        'К сожалению, это место уже занято на выбранное время. Попробуй оформить новую заявку.');
    }

    const booking = {
      id: nextBookingId++,
      chatId,
      username: msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'Клиент'),
      category: state.category,
      assetId: state.assetId,
      date: state.date,
      time: state.time,
      duration: state.duration,
      start,
      end,
      phone,
      price: calculatePrice(state.category, start, state.duration),
      status: 'pending'
    };
    bookings.push(booking);
    users.delete(chatId);

    await bot.sendMessage(chatId,
      `✅ <b>Заявка №${booking.id} создана!</b>\n\n` +
      `Место: ${findAsset(booking.assetId).name}\n` +
      `Начало: ${formatDate(start)}\n` +
      `Окончание: ${formatDate(end)}\n` +
      `Длительность: ${booking.duration} ч.\n` +
      `Цена: ${booking.price.toLocaleString('ru-RU')} драм\n` +
      'Статус: ⏳ ожидает подтверждения администратора.',
      { parse_mode: 'HTML', ...menu() }
    );

    const adminText =
      `<b>🔔 НОВАЯ ЗАЯВКА №${booking.id}</b>\n\n` +
      `Клиент: ${booking.username}\n` +
      `Телефон: ${booking.phone}\n` +
      `Место: ${findAsset(booking.assetId).name}\n` +
      `Начало: ${formatDate(start)}\n` +
      `Окончание: ${formatDate(end)}\n` +
      `Цена: ${booking.price.toLocaleString('ru-RU')} драм`;

    try {
      await bot.sendMessage(ADMIN_ID, adminText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `approve:${booking.id}` },
            { text: '❌ Отклонить', callback_data: `reject:${booking.id}` }
          ]]
        }
      });
    } catch (e) {
      console.error('Не удалось уведомить администратора:', e.message);
    }
  }
});

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const state = users.get(chatId);

  try {
    if (data.startsWith('cat:')) {
      if (!state) return;
      const category = data.slice(4);
      if (!assets[category]) return;
      state.category = category;
      const keyboard = assets[category].map(asset => [{
        text: asset.name,
        callback_data: `asset:${asset.id}`
      }]);
      await bot.editMessageText('Выбери конкретное место:', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: { inline_keyboard: keyboard }
      });
    } else if (data.startsWith('asset:')) {
      if (!state) return;
      const assetId = data.slice(6);
      const asset = findAsset(assetId);
      if (!asset || !assets[state.category].some(a => a.id === assetId)) return;
      state.assetId = assetId;
      await bot.answerCallbackQuery(query.id);
      await askDate(chatId);
    } else if (data.startsWith('duration:')) {
      if (!state) return;
      const duration = Number(data.slice(9));
      if (!Number.isInteger(duration) || duration < 1 || duration > 12) return;
      state.duration = duration;
      await bot.answerCallbackQuery(query.id);
      await askPhone(chatId);
    } else if (data.startsWith('approve:') || data.startsWith('reject:')) {
      if (String(query.from.id) !== ADMIN_ID) {
        await bot.answerCallbackQuery(query.id, { text: 'Только администратор может это сделать.' });
        return;
      }
      const [action, idText] = data.split(':');
      const booking = bookings.find(b => b.id === Number(idText));
      if (!booking || booking.status !== 'pending') {
        await bot.answerCallbackQuery(query.id, { text: 'Заявка уже обработана или не найдена.' });
        return;
      }

      booking.status = action === 'approve' ? 'approved' : 'rejected';
      await bot.answerCallbackQuery(query.id, { text: 'Готово!' });

      const statusText = action === 'approve'
        ? '✅ Твоя бронь подтверждена! Ждём тебя в Aura Play.'
        : '❌ К сожалению, администратор отклонил бронь. Свяжись с техподдержкой для уточнения.';

      await bot.sendMessage(booking.chatId, statusText);
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    }
  } catch (e) {
    console.error('Ошибка обработки кнопки:', e.message);
    try {
      await bot.answerCallbackQuery(query.id);
    } catch (_) {}
  }
});

bot.on('polling_error', error => {
  console.error('Ошибка Telegram:', error.message);
});

console.log('Aura Play Booking запущен.');
