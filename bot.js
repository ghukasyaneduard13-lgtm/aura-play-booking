```javascript
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// ==================== НАСТРОЙКИ ====================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!BOT_TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Ошибка: проверь переменные окружения в Render.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';

const assets = [
  { id: 'PC1', name: 'Компьютер №1', type: 'pc' },
  { id: 'PC2', name: 'Компьютер №2', type: 'pc' },
  { id: 'PC3', name: 'Компьютер №3', type: 'pc' },
  { id: 'PC4', name: 'Компьютер №4', type: 'pc' },
  { id: 'PC5', name: 'Компьютер №5', type: 'pc' },
  { id: 'PS5_1', name: 'PlayStation 5 №1', type: 'ps5' },
  { id: 'PS5_2', name: 'PlayStation 5 №2', type: 'ps5' },
  { id: 'VIP1', name: 'VIP-комната №1', type: 'vip' },
  { id: 'VIP2', name: 'VIP-комната №2', type: 'vip' }
];

const sessions = new Map();

// ==================== КЛАВИАТУРЫ ====================

function mainKeyboard() {
  return {
    keyboard: [
      ['🎮 Забронировать'],
      ['💰 Цены', '👑 VIP-комнаты'],
      ['📅 Мои бронирования', '🕒 Расписание'],
      ['📞 Контакты', 'ℹ️ Помощь']
    ],
    resize_keyboard: true
  };
}

function inlineAssets() {
  return {
    inline_keyboard: assets.map(asset => [{
      text: asset.name,
      callback_data: `asset:${asset.id}`
    }])
  };
}

function cancelKeyboard() {
  return {
    inline_keyboard: [[{
      text: '❌ Отменить',
      callback_data: 'cancel_booking'
    }]]
  };
}

// ==================== ОБЩИЕ ФУНКЦИИ ====================

function sendMenu(chatId, text = 'Выбери нужный раздел:') {
  return bot.sendMessage(chatId, text, {
    reply_markup: mainKeyboard()
  });
}

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {});
  }
  return sessions.get(userId);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T12:00:00Z`);

  if (formatDate(date) !== value) return null;

  return date;
}

function parseTime(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function dateTimeMinutes(date, time) {
  const parsedDate = parseDate(date);
  const parsedTime = parseTime(time);

  if (!parsedDate || parsedTime === null) return null;

  return Math.floor(parsedDate.getTime() / 60000) + parsedTime;
}

function isWithinOpeningHours(date, startTime, duration) {
  const start = dateTimeMinutes(date, startTime);

  if (start === null) return false;

  const startDate = parseDate(date);
  if (!startDate) return false;

  const opening = dateTimeMinutes(date, '10:00');
  const closing = opening + 19 * 60;

  const finish = start + duration * 60;

  return start >= opening && finish <= closing;
}

function getPrice(asset, startTime, duration) {
  const start = parseTime(startTime);

  if (start === null) return 0;

  let hourlyRate;

  if (asset.type === 'vip') {
    hourlyRate = start >= 20 * 60 || start < 5 * 60
      ? 1400
      : 1200;
  } else {
    hourlyRate = start >= 20 * 60 || start < 5 * 60
      ? 1200
      : 1000;
  }

  return hourlyRate * duration;
}

function getAsset(id) {
  return assets.find(asset => asset.id === id);
}

function readBookingDetails(row) {
  let details = {};

  try {
    details = JSON.parse(row.comment || '{}');
  } catch {
    details = {};
  }

  return {
    start: details.start || row.start_time,
    end: details.end || '',
    price: details.price || 0,
    customerName: details.customerName || row.customer_name || 'Не указано',
    phone: details.phone || row.phone || 'Не указан',
    commentText: details.commentText || '',
    assetName: row.asset_name
  };
}

function bookingEnd(date, startTime, duration) {
  const start = dateTimeMinutes(date, startTime);

  if (start === null) return '';

  const finish = start + duration * 60;
  const endDate = new Date(finish * 60000);

  return `${formatDate(endDate)} ${formatTime(finish)}`;
}

function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

// ==================== SUPABASE ====================

async function getBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'approved']);

  if (error) {
    console.error('Ошибка загрузки бронирований:', error.message);
    throw error;
  }

  return data || [];
}

async function findConflict(assetId, date, startTime, duration) {
  const bookings = await getBookings();

  const newStart = dateTimeMinutes(date, startTime);
  const newEnd = newStart + duration * 60;

  for (const booking of bookings) {
    if (booking.asset_name !== assetId) continue;

    const details = readBookingDetails(booking);

    const existingStart = dateTimeMinutes(
      booking.booking_date,
      details.start || booking.start_time
    );

    if (existingStart === null) continue;

    const existingEnd = existingStart + Number(booking.duration) * 60;

    if (overlaps(newStart, newEnd, existingStart, existingEnd)) {
      return booking;
    }
  }

  return null;
}

// ==================== СТАРТ И КОМАНДЫ ====================

bot.onText(/^\/start(?:@\w+)?$/, async msg => {
  const chatId = msg.chat.id;

  await sendMenu(
    chatId,
    '🎮 Добро пожаловать в Aura Play!\n\n' +
    'Бронируй компьютеры, PlayStation 5 и VIP-комнаты прямо здесь.\n\n' +
    'Выбери действие в меню.'
  );
});

bot.onText(/^\/help(?:@\w+)?$/, async msg => {
  await sendMenu(
    msg.chat.id,
    'ℹ️ Помощь Aura Play\n\n' +
    '/start — главное меню\n' +
    '/book — забронировать место\n' +
    '/prices — цены\n' +
    '/vip — VIP-комнаты\n' +
    '/schedule — расписание\n' +
    '/mybookings — мои бронирования\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `✈️ Telegram: ${SUPPORT_TELEGRAM}`
  );
});

bot.onText(/^\/book(?:@\w+)?$/, msg => {
  startBooking(msg.chat.id, msg.from.id);
});

bot.onText(/^\/prices(?:@\w+)?$/, msg => {
  showPrices(msg.chat.id);
});

bot.onText(/^\/vip(?:@\w+)?$/, msg => {
  showVip(msg.chat.id);
});

bot.onText(/^\/schedule(?:@\w+)?$/, async msg => {
  await showSchedule(msg.chat.id);
});

bot.onText(/^\/mybookings(?:@\w+)?$/, async msg => {
  await showMyBookings(msg.chat.id, msg.from.id);
});

// ==================== ЦЕНЫ ====================

function showPrices(chatId) {
  return bot.sendMessage(
    chatId,
    '💰 ЦЕНЫ AURA PLAY\n\n' +
    '🎮 Компьютеры:\n' +
    '• 10:00–20:00 — 1000 драм/час\n' +
    '• 20:00–05:00 — 1200 драм/час\n\n' +
    '🎮 PlayStation 5:\n' +
    '• 10:00–20:00 — 1000 драм/час\n' +
    '• 20:00–05:00 — 1200 драм/час\n\n' +
    '👑 VIP-комнаты:\n' +
    '• 10:00–20:00 — 1200 драм/час\n' +
    '• 20:00–05:00 — 1400 драм/час\n\n' +
    'Для бронирования нажми «🎮 Забронировать».',
    { reply_markup: mainKeyboard() }
  );
}

function showVip(chatId) {
  return bot.sendMessage(
    chatId,
    '👑 VIP-комнаты Aura Play\n\n' +
    'У нас доступны две VIP-комнаты:\n' +
    '• VIP-комната №1\n' +
    '• VIP-комната №2\n\n' +
    '💰 Стоимость:\n' +
    '• Днём — 1200 драм/час\n' +
    '• Вечером и ночью — 1400 драм/час\n\n' +
    'Нажми «🎮 Забронировать», чтобы выбрать комнату.',
    { reply_markup: mainKeyboard() }
  );
}

// ==================== НАЧАЛО БРОНИРОВАНИЯ ====================

async function startBooking(chatId, userId) {
  sessions.set(userId, { step: 'asset' });

  await bot.sendMessage(
    chatId,
    '🎮 Выбери, что хочешь забронировать:',
    { reply_markup: inlineAssets() }
  );
}

// ==================== ОБРАБОТКА КНОПОК ====================

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const session = getSession(userId);

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === 'cancel_booking') {
      sessions.delete(userId);

      await sendMenu(chatId, '❌ Бронирование отменено.');
      return;
    }

    if (data.startsWith('asset:')) {
      const assetId = data.split(':')[1];
      const asset = getAsset(assetId);

      if (!asset) {
        await bot.sendMessage(chatId, 'Не удалось найти выбранное место.');
        return;
      }

      sessions.set(userId, {
        step: 'date',
        assetId
      });

      await bot.sendMessage(
        chatId,
        `✅ Выбрано: ${asset.name}\n\n` +
        '📅 Введи дату бронирования в формате ГГГГ-ММ-ДД.\n' +
        'Например: 2026-10-15',
        { reply_markup: cancelKeyboard() }
      );

      return;
    }

    if (data.startsWith('admin_approve:') ||
        data.startsWith('admin_reject:')) {
      if (String(userId) !== String(ADMIN_ID)) {
        await bot.sendMessage(chatId, 'У тебя нет доступа к этой функции.');
        return;
      }

      const [action, bookingId] = data.split(':');
      const newStatus = action === 'admin_approve' ? 'approved' : 'rejected';

      const { data: booking, error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (!booking) {
        await bot.sendMessage(
          chatId,
          '⚠️ Заявка уже обработана или не найдена.'
        );
        return;
      }

      const details = readBookingDetails(booking);

      const userMessage = newStatus === 'approved'
        ? '✅ Твоё бронирование подтверждено!\n\n'
        : '❌ К сожалению, бронирование отклонено.\n\n';

      await bot.sendMessage(
        booking.telegram_id,
        userMessage +
        `🎮 Место: ${details.assetName}\n` +
        `📅 Дата: ${booking.booking_date}\n` +
        `🕒 Время: ${details.start}\n` +
        `⏳ Длительность: ${booking.duration} ч.\n` +
        `💰 Стоимость: ${details.price} драм`
      ).catch(err => {
        console.error('Не удалось уведомить пользователя:', err.message);
      });

      await bot.sendMessage(
        chatId,
        `✅ Заявка №${bookingId} обработана: ${newStatus}`
      );

      return;
    }
  } catch (error) {
    console.error('Ошибка callback:', error.message);

    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуй ещё раз.'
    ).catch(() => {});
  }
});

// ==================== ТЕКСТОВЫЙ ВВОД ====================

bot.on('message', async msg => {
  if (!msg.text) return;

  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (text.startsWith('/')) return;

  if (text === '🎮 Забронировать') {
    await startBooking(chatId, userId);
    return;
  }

  if (text === '💰 Цены') {
    await showPrices(chatId);
    return;
  }

  if (text === '👑 VIP-комнаты') {
    await showVip(chatId);
    return;
  }

  if (text === '📅 Мои бронирования') {
    await showMyBookings(chatId, userId);
    return;
  }

  if (text === '🕒 Расписание') {
    await showSchedule(chatId);
    return;
  }

  if (text === '📞 Контакты') {
    await sendMenu(
      chatId,
      `📞 Контакты Aura Play\n\n` +
      `Телефон: ${SUPPORT_PHONE}\n` +
      `Telegram: ${SUPPORT_TELEGRAM}`
    );
    return;
  }

  if (text === 'ℹ️ Помощь') {
    await sendMenu(
      chatId,
      'ℹ️ Используй кнопки меню для бронирования, просмотра цен и своих заявок.'
    );
    return;
  }

  const session = sessions.get(userId);
  if (!session || !session.step) return;

  try {
    if (session.step === 'date') {
      const date = parseDate(text);

      if (!date) {
        await bot.sendMessage(
          chatId,
          '❌ Неверная дата. Используй формат ГГГГ-ММ-ДД.'
        );
        return;
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (date < today) {
        await bot.sendMessage(chatId, '❌ Нельзя выбрать прошедшую дату.');
        return;
      }

      session.date = text;
      session.step = 'time';

      await bot.sendMessage(
        chatId,
        '🕒 Введи время начала бронирования в формате ЧЧ:ММ.\n' +
        'Например: 18:00'
      );

      return;
    }

    if (session.step === 'time') {
      if (parseTime(text) === null) {
        await bot.sendMessage(
          chatId,
          '❌ Неверное время. Введи его в формате ЧЧ:ММ, например 18:00.'
        );
        return;
      }

      session.startTime = text;
      session.step = 'duration';

      await bot.sendMessage(
        chatId,
        '⏳ На сколько часов бронировать?\n\n' +
        'Введи число от 1 до 6.'
      );

      return;
    }

    if (session.step === 'duration') {
      const duration = Number(text);

      if (!Number.isInteger(duration) || duration < 1 || duration > 6) {
        await bot.sendMessage(chatId, '❌ Введи число от 1 до 6.');
        return;
      }

      const asset = getAsset(session.assetId);

      if (!isWithinOpeningHours(session.date, session.startTime, duration)) {
        await bot.sendMessage(
          chatId,
          '❌ Это время выходит за часы работы.\n\n' +
          'Aura Play работает с 10:00 до 05:00 следующего дня.\n' +
          'Выбери другое время или дату.'
        );
        return;
      }

      const conflict = await findConflict(
        session.assetId,
        session.date,
        session.startTime,
        duration
      );

      if (conflict) {
        await bot.sendMessage(
          chatId,
          '❌ Это место уже занято на выбранное время.\n\n' +
          'Введи новую дату в формате ГГГГ-ММ-ДД.',
          { reply_markup: cancelKeyboard() }
        );

        session.step = 'date';
        return;
      }

      session.duration = duration;
      session.price = getPrice(asset, session.startTime, duration);
      session.step = 'name';

      await bot.sendMessage(
        chatId,
        '👤 Введи своё имя:'
      );

      return;
    }

    if (session.step === 'name') {
      if (text.length < 2 || text.length > 80) {
        await bot.sendMessage(chatId, '❌ Введи имя длиной от 2 до 80 символов.');
        return;
      }

      session.customerName = text;
      session.step = 'phone';

      await bot.sendMessage(
        chatId,
        '📞 Введи номер телефона для связи:'
      );

      return;
    }

    if (session.step === 'phone') {
      if (!/^[+\d()\-\s]{6,25}$/.test(text)) {
        await bot.sendMessage(
          chatId,
          '❌ Введи корректный номер телефона.'
        );
        return;
      }

      session.phone = text;
      session.step = 'comment';

      await bot.sendMessage(
        chatId,
        '💬 Добавь комментарий к бронированию или отправь «-», если комментарий не нужен.'
      );

      return;
    }

    if (session.step === 'comment') {
      session.commentText = text === '-' ? '' : text;

      const asset = getAsset(session.assetId);

      if (!asset) {
        sessions.delete(userId);
        await sendMenu(chatId, '❌ Место не найдено. Начни бронирование заново.');
        return;
      }

      const conflict = await findConflict(
        session.assetId,
        session.date,
        session.startTime,
        session.duration
      );

      if (conflict) {
        session.step = 'date';

        await bot.sendMessage(
          chatId,
          '❌ Это время только что заняли.\n' +
          'Введи другую дату в формате ГГГГ-ММ-ДД.'
        );
        return;
      }

      const end = bookingEnd(
        session.date,
        session.startTime,
        session.duration
      );

      const metadata = {
        start: session.startTime,
        end,
        price: session.price,
        customerName: session.customerName,
        phone: session.phone,
        commentText: session.commentText
      };

      const { data: booking, error } = await supabase
        .from('bookings')
        .insert([{
          telegram_id: userId,
          asset_name: session.assetId,
          booking_date: session.date,
          start_time: session.startTime,
          duration: session.duration,
          status: 'pending',
          phone: session.phone,
          customer_name: session.customerName,
          comment: JSON.stringify(metadata)
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Ошибка сохранения:', error.message);

        await bot.sendMessage(
          chatId,
          '❌ Не удалось сохранить заявку. Попробуй позже или свяжись с администратором.'
        );
        return;
      }

      const bookingInfo =
        `🆕 НОВАЯ ЗАЯВКА AURA PLAY\n\n` +
        `🆔 Заявка: №${booking.id}\n` +
        `👤 Имя: ${session.customerName}\n` +
        `📞 Телефон: ${session.phone}\n` +
        `🆔 Telegram ID: ${userId}\n` +
        `🎮 Место: ${asset.name}\n` +
        `📅 Дата: ${session.date}\n` +
        `🕒 Время: ${session.startTime}\n` +
        `⏳ Длительность: ${session.duration} ч.\n` +
        `💰 Стоимость: ${session.price} драм\n` +
        `💬 Комментарий: ${session.commentText || 'Нет'}`;

      await bot.sendMessage(ADMIN_ID, bookingInfo, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Подтвердить',
                callback_data: `admin_approve:${booking.id}`
              },
              {
                text: '❌ Отклонить',
                callback_data: `admin_reject:${booking.id}`
              }
            ]
          ]
        }
      });

      sessions.delete(userId);

      await sendMenu(
        chatId,
        '✅ Заявка успешно отправлена!\n\n' +
        `🎮 Место: ${asset.name}\n` +
        `📅 Дата: ${session.date}\n` +
        `🕒 Время: ${session.startTime}\n` +
        `⏳ Длительность: ${session.duration} ч.\n` +
        `💰 Стоимость: ${session.price} драм\n\n` +
        '⏳ Ожидай подтверждения администратора.\n' +
        `Номер заявки: №${booking.id}`
      );
    }
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error.message);

    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуй ещё раз.'
    ).catch(() => {});
  }
});

// ==================== МОИ БРОНИРОВАНИЯ ====================

async function showMyBookings(chatId, userId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('telegram_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      await sendMenu(chatId, '📅 У тебя пока нет бронирований.');
      return;
    }

    let message = '📅 ТВОИ БРОНИРОВАНИЯ\n\n';

    for (const booking of data) {
      const details = readBookingDetails(booking);

      const status = {
        pending: '⏳ Ожидает подтверждения',
        approved: '✅ Подтверждено',
        rejected: '❌ Отклонено'
      }[booking.status] || booking.status;

      message +=
        `🆔 №${booking.id}\n` +
        `🎮 Место: ${details.assetName}\n` +
        `📅 Дата: ${booking.booking_date}\n` +
        `🕒 Время: ${details.start}\n` +
        `⏳ Длительность: ${booking.duration} ч.\n` +
        `💰 Цена: ${details.price} драм\n` +
        `Статус: ${status}\n\n`;
    }

    await sendMenu(chatId, message);
  } catch (error) {
    console.error('Ошибка загрузки бронирований:', error.message);

    await bot.sendMessage(
      chatId,
      '❌ Не удалось загрузить бронирования.'
    );
  }
}

// ==================== РАСПИСАНИЕ ====================

async function showSchedule(chatId) {
  try {
    const bookings = await getBookings();

    if (bookings.length === 0) {
      await sendMenu(chatId, '🕒 Пока нет активных бронирований. Места свободны!');
      return;
    }

    let message = '🕒 АКТИВНЫЕ БРОНИРОВАНИЯ\n\n';

    for (const booking of bookings.slice(0, 30)) {
      const details = readBookingDetails(booking);

      message +=
        `🎮 ${details.assetName}\n` +
        `📅 ${booking.booking_date}\n` +
        `🕒 ${details.start} — ${details.end || 'время окончания не указано'}\n` +
        `Статус: ${booking.status === 'approved' ? '✅ Подтверждено' : '⏳ Ожидает'}\n\n`;
    }

    await sendMenu(chatId, message);
  } catch (error) {
    console.error('Ошибка расписания:', error.message);

    await bot.sendMessage(
      chatId,
      '❌ Не удалось загрузить расписание.'
    );
  }
}

// ==================== ОБРАБОТКА ОШИБОК ====================

bot.on('polling_error', error => {
  console.error('Ошибка Telegram polling:', error.message);
});

bot.on('error', error => {
  console.error('Ошибка бота:', error.message);
});

// Render: HTTP-сервер для проверки доступности сервиса.
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aura Play Booking Bot is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Aura Play запущен. Порт: ${PORT}`);
});
```
