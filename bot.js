
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const { BOT_TOKEN, ADMIN_ID, SUPABASE_URL, SUPABASE_KEY } = process.env;

if (!BOT_TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Проверь переменные окружения Render.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель',
  'Май', 'Июнь', 'Июль', 'Август',
  'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const assets = [
  { id: 'PC1', name: 'Компьютер №1', type: 'pc' },
  { id: 'PC2', name: 'Компьютер №2', type: 'pc' },
  { id: 'PC3', name: 'Компьютер №3', type: 'pc' },
  { id: 'PC4', name: 'Компьютер №4', type: 'pc' },
  { id: 'PC5', name: 'Компьютер №5', type: 'pc' },
  { id: 'PS5_1', name: 'PS5 Pro — стандарт №1', type: 'standard' },
  { id: 'PS5_2', name: 'PS5 Pro — стандарт №2', type: 'standard' },
  { id: 'VIP1', name: 'PS5 Pro — VIP №1', type: 'vip' },
  { id: 'VIP2', name: 'PS5 Pro — VIP №2', type: 'vip' }
];

const sessions = new Map();

function mainKeyboard() {
  return {
    keyboard: [
      ['🎮 Забронировать'],
      ['💰 Цены', '👑 VIP-зона'],
      ['📅 Мои бронирования', '🕒 Расписание'],
      ['ℹ️ Помощь']
    ],
    resize_keyboard: true
  };
}

function cancelKeyboard() {
  return {
    inline_keyboard: [[
      { text: '❌ Отменить', callback_data: 'cancel_booking' }
    ]]
  };
}

function assetKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '💻 Компьютеры', callback_data: 'category:pc' }],
      [{ text: '🎮 PS5 Pro — стандартная зона', callback_data: 'category:standard' }],
      [{ text: '👑 PS5 Pro — VIP-зона', callback_data: 'category:vip' }],
      [{ text: '❌ Отменить', callback_data: 'cancel_booking' }]
    ]
  };
}

function numberKeyboard(type) {
  const list = assets.filter(a => a.type === type);
  return {
    inline_keyboard: [
      ...list.map(a => [{
        text: a.name,
        callback_data: 'asset:' + a.id
      }]),
      [{ text: '⬅️ Назад', callback_data: 'back_categories' }],
      [{ text: '❌ Отменить', callback_data: 'cancel_booking' }]
    ]
  };
}

function monthKeyboard() {
  const now = new Date();
  const rows = [];

  for (let i = 0; i < 12; i += 3) {
    rows.push(MONTHS.slice(i, i + 3).map((name, j) => ({
      text: name,
      callback_data: 'month:' + (i + j)
    })));
  }

  rows.push([{ text: '❌ Отменить', callback_data: 'cancel_booking' }]);
  return { inline_keyboard: rows };
}

function dayKeyboard(year, month) {
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rows = [];
  let row = [];

  for (let day = 1; day <= count; day++) {
    row.push({
      text: String(day),
      callback_data: 'day:' + day
    });

    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }

  if (row.length) rows.push(row);

  rows.push([{ text: '⬅️ Месяцы', callback_data: 'back_months' }]);
  rows.push([{ text: '❌ Отменить', callback_data: 'cancel_booking' }]);

  return { inline_keyboard: rows };
}

function durationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '1 час', callback_data: 'duration:1' },
        { text: '2 часа', callback_data: 'duration:2' },
        { text: '3 часа', callback_data: 'duration:3' }
      ],
      [
        { text: '4 часа', callback_data: 'duration:4' },
        { text: '5 часов', callback_data: 'duration:5' },
        { text: '6 часов', callback_data: 'duration:6' }
      ],
      [{ text: '❌ Отменить', callback_data: 'cancel_booking' }]
    ]
  };
}

function adminKeyboard(id) {
  return {
    inline_keyboard: [[
      { text: '✅ Подтвердить', callback_data: 'admin_approve:' + id },
      { text: '❌ Отклонить', callback_data: 'admin_reject:' + id }
    ]]
  };
}

function getAsset(id) {
  return assets.find(a => a.id === id);
}

function parseTime(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function dateMinutes(date, time) {
  const t = parseTime(time);
  if (t === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const d = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;

  return Math.floor(d.getTime() / 60000) + t;
}

function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
}

function formatTime(mins) {
  const n = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' +
    String(n % 60).padStart(2, '0');
}

function endMinutes(date, time, duration) {
  const start = dateMinutes(date, time);
  return start === null ? null : start + duration * 60;
}

function pricePerHour(asset, time) {
  const t = parseTime(time);
  if (t === null) return 0;

  const night = t >= 1200 || t < 300;

  if (asset.type === 'vip') return night ? 1400 : 1200;
  return night ? 1200 : 1000;
}

function calculatePrice(asset, time, duration) {
  // Считаем каждый час отдельно, включая переход день/ночь.
  const start = parseTime(time);
  if (start === null) return 0;

  let total = 0;
  for (let i = 0; i < duration; i++) {
    total += pricePerHour(asset, formatTime(start + i * 60));
  }
  return total;
}

function getStart(row) {
  return row.start_time;
}

async function getBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'approved']);

  if (error) throw error;
  return data || [];
}

function bookingInterval(row) {
  const start = dateMinutes(row.booking_date, getStart(row));
  if (start === null) return null;

  return {
    start,
    end: start + Number(row.duration) * 60
  };
}

function overlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

async function findConflict(assetId, date, time, duration) {
  const bookings = await getBookings();
  const start = dateMinutes(date, time);
  if (start === null) return true;

  const candidate = { start, end: start + duration * 60 };

  return bookings.find(row => {
    if (row.asset_name !== assetId) return false;
    const interval = bookingInterval(row);
    return interval && overlap(candidate, interval);
  }) || null;
}

function openingHoursValid(date, time, duration) {
  const start = dateMinutes(date, time);
  if (start === null) return false;

  const minutes = parseTime(time);
  if (minutes === null) return false;

  // Клуб работает 10:00–05:00 следующего дня.
  // Ранние часы относятся к ночной части работы клуба.
  if (minutes >= 300 && minutes < 600) return false;

  let openingStart = start;
  if (minutes < 300) openingStart -= 24 * 60;

  const opening = dateMinutes(
    new Date(openingStart * 60000).toISOString().slice(0, 10),
    '10:00'
  );

  return opening !== null && start >= opening &&
    start + duration * 60 <= opening + 19 * 60;
}

function armeniaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type).value;
  return {
    date: get('year') + '-' + get('month') + '-' + get('day'),
    time: get('hour') + ':' + get('minute')
  };
}

function advanceRuleValid(date, time) {
  const now = armeniaNow();
  const nowMins = dateMinutes(now.date, now.time);
  const startMins = dateMinutes(date, time);

  if (nowMins === null || startMins === null) return false;

  // Во время закрытия (05:00–10:00) требуется минимум 3 часа.
  const currentTime = parseTime(now.time);
  const requiredMinutes =
    currentTime >= 300 && currentTime < 600 ? 180 : 30;

  return startMins - nowMins >= requiredMinutes;
}

async function sendMenu(chatId, text) {
  return bot.sendMessage(chatId, text || 'Выбери раздел:', {
    reply_markup: mainKeyboard()
  });
}

async function startBooking(chatId, userId) {
  sessions.set(userId, { step: 'category' });
  await bot.sendMessage(chatId, '🎮 Выбери категорию:', {
    reply_markup: assetKeyboard()
  });
}

async function showPrices(chatId) {
  await sendMenu(chatId,
    '💰 ЦЕНЫ AURA PLAY\n\n' +
    '💻 Компьютеры №1–5:\n' +
    '10:00–20:00 — 1000 драм/час\n' +
    '20:00–05:00 — 1200 драм/час\n\n' +
    '🎮 PS5 Pro — стандартная зона:\n' +
    '10:00–20:00 — 1000 драм/час\n' +
    '20:00–05:00 — 1200 драм/час\n\n' +
    '👑 PS5 Pro — VIP-зона:\n' +
    '10:00–20:00 — 1200 драм/час\n' +
    '20:00–05:00 — 1400 драм/час'
  );
}

async function showVip(chatId) {
  await sendMenu(chatId,
    '👑 VIP-ЗОНА AURA PLAY\n\n' +
    'VIP №1 и VIP №2\n\n' +
    'Дневное время: 10:00–20:00\n' +
    'Ночное время: 20:00–05:00\n\n' +
    'Днём — 1200 драм/час\n' +
    'Ночью — 1400 драм/час'
  );
}

async function showHelp(chatId) {
  await sendMenu(chatId,
    'ℹ️ ПОМОЩЬ AURA PLAY\n\n' +
    'Чтобы забронировать место, нажми «🎮 Забронировать».\n' +
    'Выбери категорию, номер, дату, время и длительность.\n\n' +
    '📞 Контакты:\n' + SUPPORT_PHONE + '\n' + SUPPORT_TELEGRAM
  );
}

async function showSchedule(chatId) {
  await sendMenu(chatId,
    '🕒 РАСПИСАНИЕ AURA PLAY\n\n' +
    'Клуб работает ежедневно с 10:00 до 05:00.\n\n' +
    'Дневной тариф: 10:00–20:00.\n' +
    'Ночной тариф: 20:00–05:00.\n\n' +
    'При бронировании бот покажет занятые интервалы и позволит проверить свободное время.'
  );
}

async function showAvailability(chatId, session) {
  const bookings = await getBookings();
  const dayStart = dateMinutes(session.date, '00:00');

  const occupied = bookings
    .filter(row => row.asset_name === session.assetId)
    .map(row => ({ row, interval: bookingInterval(row) }))
    .filter(x => x.interval && x.interval.start < dayStart + 1440 &&
      x.interval.end > dayStart)
    .map(x => {
      const start = x.interval.start - dayStart;
      const end = x.interval.end - dayStart;
      return formatTime(start) + '–' + formatTime(end);
    });

  const text = occupied.length
    ? occupied.map(x => '🔴 Занято: ' + x).join('\n')
    : '🟢 На выбранную дату занятых интервалов пока нет.';

  await bot.sendMessage(chatId,
    '📅 ' + formatDate(session.date) + '\n' +
    '🎮 ' + getAsset(session.assetId).name + '\n\n' +
    text + '\n\n' +
    'Введи желаемое время начала в формате ЧЧ:ММ, например 14:30.',
    { reply_markup: cancelKeyboard() }
  );
}

bot.onText(/^\/start(?:@\w+)?$/, async msg => {
  await sendMenu(msg.chat.id,
    '🎮 Добро пожаловать в Aura Play!\n\n' +
    'Бронируй компьютер, PS5 Pro или VIP-зону через меню.'
  );
});

bot.onText(/^\/help(?:@\w+)?$/, msg => showHelp(msg.chat.id));
bot.onText(/^\/book(?:@\w+)?$/, msg => startBooking(msg.chat.id, msg.from.id));
bot.onText(/^\/prices(?:@\w+)?$/, msg => showPrices(msg.chat.id));
bot.onText(/^\/vip(?:@\w+)?$/, msg => showVip(msg.chat.id));
bot.onText(/^\/schedule(?:@\w+)?$/, msg => showSchedule(msg.chat.id));

bot.onText(/^\/mybookings(?:@\w+)?$/, msg =>
  showMyBookings(msg.chat.id, msg.from.id)
);

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

    if (data === 'back_categories') {
      sessions.set(userId, { step: 'category' });
      await bot.sendMessage(chatId, 'Выбери категорию:', {
        reply_markup: assetKeyboard()
      });
      return;
    }

    if (data === 'back_months') {
      const session = sessions.get(userId);
      if (!session) return;
      session.step = 'month';
      await bot.sendMessage(chatId, '📅 Выбери месяц:', {
        reply_markup: monthKeyboard()
      });
      return;
    }

    if (data.startsWith('category:')) {
      const session = sessions.get(userId) || {};
      const type = data.split(':')[1];
      if (!['pc', 'standard', 'vip'].includes(type)) return;

      session.category = type;
      session.step = 'asset';
      sessions.set(userId, session);

      const names = {
        pc: '💻 Выбери компьютер:',
        standard: '🎮 Выбери место в стандартной зоне:',
        vip: '👑 Выбери VIP-зону:'
      };

      await bot.sendMessage(chatId, names[type], {
        reply_markup: numberKeyboard(type)
      });
      return;
    }

    if (data.startsWith('asset:')) {
      const assetId = data.split(':')[1];
      const asset = getAsset(assetId);
      if (!asset) return;

      const now = armeniaNow();
      const [year, month] = now.date.split('-').map(Number);
      const session = sessions.get(userId) || {};

      session.assetId = assetId;
      session.step = 'month';
      session.currentYear = year;
      session.currentMonth = month - 1;
      sessions.set(userId, session);

      await bot.sendMessage(chatId,
        '✅ Выбрано: ' + asset.name + '\n\n📅 Выбери месяц:',
        { reply_markup: monthKeyboard() }
      );
      return;
    }

    if (data.startsWith('month:')) {
      const session = sessions.get(userId);
      if (!session || !session.assetId) return;

      const month = Number(data.split(':')[1]);
      const now = armeniaNow();
      const [year, currentMonth] = now.date.split('-').map(Number);
      const monthIndex = month;

      session.year = year;
      session.month = monthIndex;
      session.step = 'day';

      await bot.sendMessage(chatId,
        '📅 Выбран месяц: ' + MONTHS[monthIndex] +
        '\nВыбери день:',
        { reply_markup: dayKeyboard(year, monthIndex) }
      );
      return;
    }

    if (data.startsWith('day:')) {
      const session = sessions.get(userId);
      if (!session || session.month === undefined) return;

      const day = Number(data.split(':')[1]);
      const date = session.year + '-' +
        String(session.month + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');

      const selected = new Date(date + 'T00:00:00Z');
      if (Number.isNaN(selected.getTime()) ||
          selected.toISOString().slice(0, 10) !== date) return;

      const today = armeniaNow().date;
      if (date < today) {
        await bot.sendMessage(chatId, '❌ Нельзя выбрать прошедшую дату.');
        return;
      }

      session.date = date;
      session.step = 'time';
      await showAvailability(chatId, session);
      return;
    }

    if (data.startsWith('duration:')) {
      const session = sessions.get(userId);
      if (!session || session.step !== 'duration') return;

      const duration = Number(data.split(':')[1]);
      const asset = getAsset(session.assetId);
      if (!asset || duration < 1 || duration > 6) return;

      if (!openingHoursValid(session.date, session.startTime, duration)) {
        await bot.sendMessage(chatId,
          '❌ Это время выходит за часы работы Aura Play: 10:00–05:00.'
        );
        return;
      }

      if (!advanceRuleValid(session.date, session.startTime)) {
        await bot.sendMessage(chatId,
          '❌ Бронь нужно оформлять минимум за 30 минут.\n' +
          'С 05:00 до 10:00 действует правило минимум 3 часа.'
        );
        return;
      }

      const conflict = await findConflict(
        session.assetId, session.date, session.startTime, duration
      );

      if (conflict) {
        session.step = 'time';
        await bot.sendMessage(chatId,
          '❌ Это время уже занято. Введи другое время начала.',
          { reply_markup: cancelKeyboard() }
        );
        return;
      }

      session.duration = duration;
      session.price = calculatePrice(asset, session.startTime, duration);
      session.step = 'confirm';

      await bot.sendMessage(chatId,
        '📋 ПРОВЕРЬ БРОНИРОВАНИЕ\n\n' +
        '🎮 Место: ' + asset.name + '\n' +
        '📅 Дата: ' + formatDate(session.date) + '\n' +
        '🕒 Начало: ' + session.startTime + '\n' +
        '⏳ Длительность: ' + duration + ' ч.\n' +
        '💰 Стоимость: ' + session.price + ' драм\n\n' +
        'Подтверди отправку заявки.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Отправить заявку', callback_data: 'confirm_booking' }],
              [{ text: '❌ Отменить', callback_data: 'cancel_booking' }]
            ]
          }
        }
      );
      return;
    }

    if (data === 'confirm_booking') {
      const session = sessions.get(userId);
      if (!session || session.step !== 'confirm') return;

      const conflict = await findConflict(
        session.assetId, session.date, session.startTime, session.duration
      );

      if (conflict) {
        session.step = 'time';
        await bot.sendMessage(chatId,
          '❌ Это время только что заняли. Введи другое время начала.',
          { reply_markup: cancelKeyboard() }
        );
        return;
      }

      const asset = getAsset(session.assetId);
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert([{
          telegram_id: userId,
          asset_name: session.assetId,
          booking_date: session.date,
          start_time: session.startTime,
          duration: session.duration,
          status: 'pending',
          phone: '',
          customer_name: query.from.first_name || 'Пользователь',
          comment: JSON.stringify({
            price: session.price,
            start: session.startTime
          })
        }])
        .select('*')
        .single();

      if (error) throw error;

      const message =
        '🆕 НОВАЯ ЗАЯВКА AURA PLAY\n\n' +
        '№' + booking.id + '\n' +
        '👤 ' + (query.from.first_name || 'Пользователь') + '\n' +
        '🎮 ' + asset.name + '\n' +
        '📅 ' + formatDate(session.date) + '\n' +
        '🕒 ' + session.startTime + '\n' +
        '⏳ ' + session.duration + ' ч.\n' +
        '💰 ' + session.price + ' драм';

      await bot.sendMessage(ADMIN_ID, message, {
        reply_markup: adminKeyboard(booking.id)
      });

      sessions.delete(userId);
      await sendMenu(chatId,
        '✅ Заявка отправлена администратору!\n\n' +
        '🎮 ' + asset.name + '\n' +
        '📅 ' + formatDate(booking.booking_date) + '\n' +
        '🕒 ' + booking.start_time + '\n' +
        '💰 ' + JSON.parse(booking.comment).price + ' драм\n\n' +
        'Ожидай подтверждения.'
      );
      return;
    }

    if (data.startsWith('admin_approve:') ||
        data.startsWith('admin_reject:')) {
      if (String(userId) !== String(ADMIN_ID)) {
        await bot.sendMessage(chatId, '⛔ Нет доступа.');
        return;
      }

      const [action, id] = data.split(':');
      const status = action === 'admin_approve' ? 'approved' : 'rejected';

      const { data: booking, error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!booking) {
        await bot.sendMessage(chatId, 'Заявка уже обработана или не найдена.');
        return;
      }

      const asset = getAsset(booking.asset_name);
      let price = 0;
      try { price = JSON.parse(booking.comment || '{}').price || 0; } catch {}

      await bot.sendMessage(booking.telegram_id,
        (status === 'approved'
          ? '✅ Бронирование подтверждено!\n\n'
          : '❌ Бронирование отклонено.\n\n') +
        '🎮 ' + (asset ? asset.name : booking.asset_name) + '\n' +
        '📅 ' + formatDate(booking.booking_date) + '\n' +
        '🕒 ' + booking.start_time + '\n' +
        '⏳ ' + booking.duration + ' ч.\n' +
        '💰 ' + price + ' драм'
      );

      await bot.sendMessage(chatId, '✅ Заявка обработана.');
    }
  } catch (error) {
    console.error('Ошибка callback:', error.message);
    await bot.sendMessage(chatId,
      '⚠️ Не удалось выполнить действие. Проверь логи Render.'
    ).catch(() => {});
  }
});

bot.on('message', async msg => {
  if (!msg.text || !msg.from || msg.text.startsWith('/')) return;

  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (text === '🎮 Забронировать') return startBooking(chatId, userId);
  if (text === '💰 Цены') return showPrices(chatId);
  if (text === '👑 VIP-зона') return showVip(chatId);
  if (text === '🕒 Расписание') return showSchedule(chatId);
  if (text === 'ℹ️ Помощь') return showHelp(chatId);
  if (text === '📅 Мои бронирования') return showMyBookings(chatId, userId);

  const session = sessions.get(userId);
  if (!session) return;

  try {
    if (session.step === 'time') {
      if (parseTime(text) === null) {
        await bot.sendMessage(chatId,
          '❌ Введи время в формате ЧЧ:ММ, например 14:30.'
        );
        return;
      }

      session.startTime = text;
      session.step = 'duration';

      await bot.sendMessage(chatId, '⏳ Выбери продолжительность:', {
        reply_markup: durationKeyboard()
      });
    }
  } catch (error) {
    console.error('Ошибка сообщения:', error.message);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуй снова.');
  }
});

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

    let text = '📅 ТВОИ БРОНИРОВАНИЯ\n\n';

    for (const row of data) {
      let price = 0;
      try { price = JSON.parse(row.comment || '{}').price || 0; } catch {}

      const status = {
        pending: '⏳ Ожидает подтверждения',
        approved: '✅ Подтверждено',
        rejected: '❌ Отклонено'
      }[row.status] || row.status;

      const asset = getAsset(row.asset_name);
      text += '№' + row.id + '\n' +
        '🎮 ' + (asset ? asset.name : row.asset_name) + '\n' +
        '📅 ' + formatDate(row.booking_date) + '\n' +
        '🕒 ' + row.start_time + '\n' +
        '⏳ ' + row.duration + ' ч.\n' +
        '💰 ' + price + ' драм\n' +
        status + '\n\n';
    }

    await sendMenu(chatId, text);
  } catch (error) {
    console.error('Ошибка моих бронирований:', error.message);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить бронирования.');
  }
}

bot.on('polling_error', error => console.error('Telegram:', error.message));
bot.on('error', error => console.error('Bot:', error.message));

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aura Play Booking Bot is running');
}).listen(PORT, '0.0.0.0', () => {
  console.log('Aura Play запущен. Порт: ' + PORT);
});
