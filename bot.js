require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// =============== НАСТРОЙКИ ===============

const {
  BOT_TOKEN,
  ADMIN_ID,
  SUPABASE_URL,
  SUPABASE_KEY
} = process.env;

if (!BOT_TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Ошибка: проверь переменные окружения Render.');
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

// =============== КЛАВИАТУРЫ ===============

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
    inline_keyboard: assets.map((asset) => [{
      text: asset.name,
      callback_data: 'asset:' + asset.id
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

function adminKeyboard(id) {
  return {
    inline_keyboard: [[
      {
        text: '✅ Подтвердить',
        callback_data: 'admin_approve:' + id
      },
      {
        text: '❌ Отклонить',
        callback_data: 'admin_reject:' + id
      }
    ]]
  };
}

// =============== ОБЩИЕ ФУНКЦИИ ===============

async function sendMenu(chatId, text = 'Выбери нужный раздел:') {
  return bot.sendMessage(chatId, text, {
    reply_markup: mainKeyboard()
  });
}

function getAsset(id) {
  return assets.find(asset => asset.id === id);
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(value + 'T12:00:00Z');

  if (date.toISOString().slice(0, 10) !== value) return null;

  return date;
}

function parseTime(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;

  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function dateTimeMinutes(date, time) {
  const d = parseDate(date);
  const t = parseTime(time);

  if (!d || t === null) return null;

  return Math.floor(d.getTime() / 60000) + t;
}

function formatTime(minutes) {
  const value = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  return String(hours).padStart(2, '0') + ':' +
    String(mins).padStart(2, '0');
}

function bookingEnd(date, startTime, duration) {
  const start = dateTimeMinutes(date, startTime);

  if (start === null) return '';

  const end = new Date((start + duration * 60) * 60000);

  return end.toISOString().slice(0, 10) + ' ' +
    formatTime(start + duration * 60);
}

function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

function getPrice(asset, startTime, duration) {
  const start = parseTime(startTime);

  if (start === null) return 0;

  const night = start >= 20 * 60 || start < 5 * 60;

  if (asset.type === 'vip') {
    return (night ? 1400 : 1200) * duration;
  }

  return (night ? 1200 : 1000) * duration;
}

function readBookingDetails(row) {
  let meta = {};

  try {
    meta = JSON.parse(row.comment || '{}');
  } catch {
    meta = {};
  }

  const asset = getAsset(row.asset_name);

  return {
    start: meta.start || row.start_time || '',
    end: meta.end || '',
    price: meta.price || 0,
    customerName: meta.customerName || row.customer_name || 'Не указано',
    phone: meta.phone || row.phone || 'Не указан',
    commentText: meta.commentText || '',
    assetName: asset ? asset.name : row.asset_name
  };
}

async function getBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'approved']);

  if (error) throw error;

  return data || [];
}

async function findConflict(assetId, date, startTime, duration) {
  const bookings = await getBookings();

  const newStart = dateTimeMinutes(date, startTime);

  if (newStart === null) return null;

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

function isWithinOpeningHours(date, startTime, duration) {
  const start = dateTimeMinutes(date, startTime);

  if (start === null) return false;

  const opening = dateTimeMinutes(date, '10:00');
  const closing = opening + 19 * 60;

  return start >= opening && start + duration * 60 <= closing;
}

// =============== ЦЕНЫ И VIP ===============

async function showPrices(chatId) {
  await sendMenu(
    chatId,
    '💰 ЦЕНЫ AURA PLAY\n\n' +
    '🎮 Компьютеры и PlayStation 5:\n' +
    '10:00–20:00 — 1000 драм/час\n' +
    '20:00–05:00 — 1200 драм/час\n\n' +
    '👑 VIP-комнаты:\n' +
    '10:00–20:00 — 1200 драм/час\n' +
    '20:00–05:00 — 1400 драм/час\n\n' +
    'Для бронирования нажми «🎮 Забронировать».'
  );
}

async function showVip(chatId) {
  await sendMenu(
    chatId,
    '👑 VIP-КОМНАТЫ AURA PLAY\n\n' +
    'Доступны две комнаты:\n' +
    '• VIP-комната №1\n' +
    '• VIP-комната №2\n\n' +
    'Днём — 1200 драм/час.\n' +
    'Вечером и ночью — 1400 драм/час.\n\n' +
    'Нажми «🎮 Забронировать», чтобы выбрать комнату.'
  );
}

// =============== БРОНИРОВАНИЕ ===============

async function startBooking(chatId, userId) {
  sessions.set(userId, { step: 'asset' });

  await bot.sendMessage(
    chatId,
    '🎮 Выбери место для бронирования:',
    { reply_markup: inlineAssets() }
  );
}

bot.onText(/^\/start(?:@\w+)?$/, async msg => {
  await sendMenu(
    msg.chat.id,
    '🎮 Добро пожаловать в Aura Play!\n\n' +
    'Здесь ты можешь забронировать компьютер, PlayStation 5 ' +
    'или VIP-комнату.\n\nВыбери действие в меню.'
  );
});

bot.onText(/^\/help(?:@\w+)?$/, async msg => {
  await sendMenu(
    msg.chat.id,
    'ℹ️ ПОМОЩЬ AURA PLAY\n\n' +
    '/start — главное меню\n' +
    '/book — бронирование\n' +
    '/prices — цены\n' +
    '/vip — VIP-комнаты\n' +
    '/schedule — расписание\n' +
    '/mybookings — мои бронирования\n\n' +
    'Телефон: ' + SUPPORT_PHONE + '\n' +
    'Telegram: ' + SUPPORT_TELEGRAM
  );
});

bot.onText(/^\/book(?:@\w+)?$/, msg =>
  startBooking(msg.chat.id, msg.from.id)
);

bot.onText(/^\/prices(?:@\w+)?$/, msg =>
  showPrices(msg.chat.id)
);

bot.onText(/^\/vip(?:@\w+)?$/, msg =>
  showVip(msg.chat.id)
);

bot.onText(/^\/schedule(?:@\w+)?$/, msg =>
  showSchedule(msg.chat.id)
);

bot.onText(/^\/mybookings(?:@\w+)?$/, msg =>
  showMyBookings(msg.chat.id, msg.from.id)
);

// =============== НАЖАТИЯ НА КНОПКИ ===============

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data || '';

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
        '✅ Выбрано: ' + asset.name + '\n\n' +
        '📅 Введи дату в формате ГГГГ-ММ-ДД.\n' +
        'Например: 2026-10-15',
        { reply_markup: cancelKeyboard() }
      );

      return;
    }

    if (
      data.startsWith('admin_approve:') ||
      data.startsWith('admin_reject:')
    ) {
      if (String(userId) !== String(ADMIN_ID)) {
        await bot.sendMessage(chatId, '⛔ У тебя нет доступа.');
        return;
      }

      const [action, bookingId] = data.split(':');
      const status = action === 'admin_approve' ? 'approved' : 'rejected';

      const { data: booking, error } = await supabase
        .from('bookings')
        .update({ status })
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

      const answer = status === 'approved'
        ? '✅ Твоё бронирование подтверждено!\n\n'
        : '❌ К сожалению, бронирование отклонено.\n\n';

      await bot.sendMessage(
        booking.telegram_id,
        answer +
        '🎮 Место: ' + details.assetName + '\n' +
        '📅 Дата: ' + booking.booking_date + '\n' +
        '🕒 Время: ' + details.start + '\n' +
        '⏳ Длительность: ' + booking.duration + ' ч.\n' +
        '💰 Стоимость: ' + details.price + ' драм'
      ).catch(err => console.error('Ошибка уведомления:', err.message));

      await bot.sendMessage(
        chatId,
        '✅ Заявка №' + bookingId + ' обработана.'
      );

      return;
    }
  } catch (error) {
    console.error('Ошибка кнопки:', error.message);

    await bot.sendMessage(
      chatId,
      '⚠️ Произошла ошибка. Попробуй ещё раз.'
    ).catch(() => {});
  }
});

// =============== ВВОД ТЕКСТА ===============

bot.on('message', async msg => {
  if (!msg.text || !msg.from) return;

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
      '📞 КОНТАКТЫ AURA PLAY\n\n' +
      'Телефон: ' + SUPPORT_PHONE + '\n' +
      'Telegram: ' + SUPPORT_TELEGRAM
    );
    return;
  }

  if (text === 'ℹ️ Помощь') {
    await sendMenu(
      chatId,
      'ℹ️ Используй меню для бронирования, просмотра цен ' +
      'и проверки своих заявок.'
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
          '❌ Неверная дата. Пример: 2026-10-15'
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
        '🕒 Введи время начала в формате ЧЧ:ММ.\nНапример: 18:00',
        { reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (session.step === 'time') {
      if (parseTime(text) === null) {
        await bot.sendMessage(
          chatId,
          '❌ Неверное время. Например: 18:00'
        );
        return;
      }

      session.startTime = text;
      session.step = 'duration';

      await bot.sendMessage(
        chatId,
        '⏳ На сколько часов бронировать?\nВведи число от 1 до 6.',
        { reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (session.step === 'duration') {
      const duration = Number(text);

      if (!Number.isInteger(duration) || duration < 1 || duration > 6) {
        await bot.sendMessage(chatId, '❌ Введи целое число от 1 до 6.');
        return;
      }

      const asset = getAsset(session.assetId);

      if (!asset) {
        sessions.delete(userId);
        await sendMenu(chatId, '❌ Место не найдено. Начни заново.');
        return;
      }

      if (!isWithinOpeningHours(session.date, session.startTime, duration)) {
        await bot.sendMessage(
          chatId,
          '❌ Это время выходит за часы работы.\n' +
          'Aura Play работает с 10:00 до 05:00 следующего дня.'
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
          '❌ Это место уже занято. Введи другую дату в формате ГГГГ-ММ-ДД.',
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
        '👤 Введи своё имя:',
        { reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (session.step === 'name') {
      if (text.length < 2 || text.length > 80) {
        await bot.sendMessage(chatId, '❌ Имя должно содержать от 2 до 80 символов.');
        return;
      }

      session.customerName = text;
      session.step = 'phone';

      await bot.sendMessage(
        chatId,
        '📞 Введи номер телефона:',
        { reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (session.step === 'phone') {
      if (!/^[+\d()\-\s]{6,25}$/.test(text)) {
        await bot.sendMessage(chatId, '❌ Проверь номер телефона и введи снова.');
        return;
      }

      session.phone = text;
      session.step = 'comment';

      await bot.sendMessage(
        chatId,
        '💬 Напиши комментарий или отправь дефис «-», если он не нужен.',
        { reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (session.step === 'comment') {
      session.commentText = text === '-' ? '' : text;

      const asset = getAsset(session.assetId);

      if (!asset) {
        sessions.delete(userId);
        await sendMenu(chatId, '❌ Место не найдено. Начни заново.');
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
          '❌ Это время только что заняли. Введи другую дату.',
          { reply_markup: cancelKeyboard() }
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

      if (error) throw error;

      const bookingInfo =
        '🆕 НОВАЯ ЗАЯВКА AURA PLAY\n\n' +
        '🆔 Заявка: №' + booking.id + '\n' +
        '👤 Имя: ' + session.customerName + '\n' +
        '📞 Телефон: ' + session.phone + '\n' +
        '🆔 Telegram ID: ' + userId + '\n' +
        '🎮 Место: ' + asset.name + '\n' +
        '📅 Дата: ' + session.date + '\n' +
        '🕒 Время: ' + session.startTime + '\n' +
        '⏳ Длительность: ' + session.duration + ' ч.\n' +
        '💰 Стоимость: ' + session.price + ' драм\n' +
        '💬 Комментарий: ' + (session.commentText || 'Нет');

      try {
        await bot.sendMessage(
          ADMIN_ID,
          bookingInfo,
          { reply_markup: adminKeyboard(booking.id) }
        );
      } catch (error) {
        console.error('Не удалось уведомить администратора:', error.message);
      }

      const completed = { ...session };
      sessions.delete(userId);

      await sendMenu(
        chatId,
        '✅ Заявка отправлена!\n\n' +
        '🎮 Место: ' + asset.name + '\n' +
        '📅 Дата: ' + completed.date + '\n' +
        '🕒 Время: ' + completed.startTime + '\n' +
        '⏳ Длительность: ' + completed.duration + ' ч.\n' +
        '💰 Стоимость: ' + completed.price + ' драм\n\n' +
        '⏳ Ожидай подтверждения администратора.\n' +
        'Номер заявки: №' + booking.id
      );
    }
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error.message);

    await bot.sendMessage(
      chatId,
      '❌ Не удалось обработать запрос. Попробуй позже.'
    ).catch(() => {});
  }
});

// =============== МОИ БРОНИРОВАНИЯ ===============

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
        '🆔 №' + booking.id + '\n' +
        '🎮 Место: ' + details.assetName + '\n' +
        '📅 Дата: ' + booking.booking_date + '\n' +
        '🕒 Время: ' + details.start + '\n' +
        '⏳ Длительность: ' + booking.duration + ' ч.\n' +
        '💰 Цена: ' + details.price + ' драм\n' +
        'Статус: ' + status + '\n\n';
    }

    await sendMenu(chatId, message);
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error.message);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить бронирования.');
  }
}

// =============== РАСПИСАНИЕ ===============

async function showSchedule(chatId) {
  try {
    const bookings = await getBookings();

    if (bookings.length === 0) {
      await sendMenu(chatId, '🕒 Активных бронирований пока нет.');
      return;
    }

    let message = '🕒 АКТИВНЫЕ БРОНИРОВАНИЯ\n\n';

    for (const booking of bookings.slice(0, 30)) {
      const details = readBookingDetails(booking);

      message +=
        '🎮 ' + details.assetName + '\n' +
        '📅 ' + booking.booking_date + '\n' +
        '🕒 ' + details.start + ' — ' +
        (details.end || 'время окончания не указано') + '\n' +
        'Статус: ' +
        (booking.status === 'approved'
          ? '✅ Подтверждено'
          : '⏳ Ожидает подтверждения') + '\n\n';
    }

    await sendMenu(chatId, message);
  } catch (error) {
    console.error('Ошибка расписания:', error.message);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить расписание.');
  }
}

// =============== ОБРАБОТКА ОШИБОК ===============

bot.on('polling_error', error => {
  console.error('Ошибка Telegram polling:', error.message);
});

bot.on('error', error => {
  console.error('Ошибка бота:', error.message);
});

// =============== СЕРВЕР RENDER ===============

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('Aura Play Booking Bot is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Aura Play запущен. Порт: ' + PORT);
});
