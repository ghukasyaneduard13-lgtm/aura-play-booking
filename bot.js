const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// ================= НАСТРОЙКИ =================

const TOKEN = (process.env.BOT_TOKEN || '').trim();
const ADMIN_ID = String(process.env.ADMIN_ID || '').trim();
const ADMIN_ID_2 = String(process.env.ADMIN_ID_2 || '').trim();
const ADMIN_IDS = [...new Set([ADMIN_ID, ADMIN_ID_2].filter(Boolean))];
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '').trim();
const PORT = process.env.PORT || 3000;

const MIN_BOOKING_LEAD_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TIMEZONE_OFFSET_MS = 4 * HOUR_MS;

const OPEN_HOUR = 10;
const DAY_RATE_END = 20;
const CLOSE_HOUR = 24;

const OPEN_TEXT = 'Ежедневно: 10:00–00:00';
const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';

const missingVariables = [];

if (!TOKEN) missingVariables.push('BOT_TOKEN');
if (!ADMIN_ID) missingVariables.push('ADMIN_ID');
if (!SUPABASE_URL) missingVariables.push('SUPABASE_URL');
if (!SUPABASE_KEY) missingVariables.push('SUPABASE_KEY');

if (missingVariables.length) {
  throw new Error(
    'В Railway не найдены или пустые переменные: ' +
    missingVariables.join(', ') +
    '. Проверь Variables этого сервиса и сделай Redeploy.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TOKEN, { polling: true });

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('Aura Play Booking is running!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Aura Play запущен на порту ${PORT}`);
});

const users = new Map();
let bookings = [];

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

// ================= ПЕРЕВОД =================

const HY = {
  '🎮 Забронировать': '🎮 Ամրագրել',
  '💰 Посмотреть цены': '💰 Տեսնել գները',
  '👑 VIP-комнаты': '👑 VIP սենյակներ',
  '📅 Расписание': '📅 Ժամանակացույց',
  '📋 Мои заявки': '📋 Իմ հայտերը',
  'ℹ️ Информация': 'ℹ️ Տեղեկություն',
  '🛠 Техподдержка': '🛠 Աջակցություն',
  '⬅️ Назад': '⬅️ Հետ',
  '💻 Компьютер': '💻 Համակարգիչ',
  '🎮 PS5 Pro — обычная зона': '🎮 PS5 Pro՝ սովորական գոտի',
  '👑 PS5 Pro — VIP-комната': '👑 PS5 Pro՝ VIP սենյակ',
  '👑 Забронировать VIP': '👑 Ամրագրել VIP-ը',
  '📅 Проверить расписание': '📅 Ստուգել ժամանակացույցը',
  '📅 Выбрать другую дату': '📅 Ընտրել այլ ամսաթիվ',
  'Выбери конкретное место:': 'Ընտրեք կոնկրետ տեղը։',
  '📅 Выбери день бронирования:': '📅 Ընտրեք ամրագրման օրը։',
  '🗓️ Теперь выбери месяц:': '🗓️ Այժմ ընտրեք ամիսը։',
  '⌛ Выбери длительность бронирования:': '⌛ Ընտրեք ամրագրման տևողությունը։',
  '📱 Напиши свой номер телефона для подтверждения брони.': '📱 Ամրագրումը հաստատելու համար գրեք ձեր հեռախոսահամարը։',
  '❌ Это время уже прошло. Выбери другое.': '❌ Այս ժամը անցել է։ Ընտրեք այլ ժամ։',
  '❌ Введи время в формате ЧЧ:ММ, например 18:00.': '❌ Մուտքագրեք ժամը, օրինակ՝ 18:00։',
  '❌ Проверь номер телефона и введи ещё раз.': '❌ Ստուգեք հեռախոսահամարը և կրկին մուտքագրեք։',
  '📋 У тебя пока нет заявок.': '📋 Դուք դեռ հայտեր չունեք։',
  '🎮 Что хочешь забронировать?': '🎮 Ի՞նչ եք ցանկանում ամրագրել։',
  '⏰ Напиши время начала, например 18:00.': '⏰ Գրեք մեկնարկի ժամը, օրինակ՝ 18:00։',
  '❌ Начало бронирования возможно только с 10:00 до 23:59. Выбери другое время.': '❌ Ամրագրումը հնարավոր է միայն 10:00-ից մինչև 23:59։ Ընտրեք այլ ժամ։'
};

function state(id) {
  if (!users.has(id)) {
    users.set(id, {
      step: 'menu',
      language: 'ru'
    });
  }

  return users.get(id);
}

function normalize(id, text) {
  const s = state(id);

  if (s.language === 'hy') {
    for (const [ru, hy] of Object.entries(HY)) {
      if (text === hy) return ru;
    }
  }

  return text;
}

function translate(id, text) {
  const s = state(id);

  if (s.language === 'hy') {
    return HY[text] || text;
  }

  return text;
}

function send(id, text, options = {}) {
  const s = state(id);

  if (s.language === 'hy') {
    for (const [ru, hy] of Object.entries(HY)) {
      text = text.replaceAll(ru, hy);
    }
  }

  return bot.sendMessage(id, text, options);
}

function inlineBack(destination = 'back') {
  return {
    inline_keyboard: [[
      {
        text: '⬅️ Назад',
        callback_data: destination
      }
    ]]
  };
}

function rowsWithBack(rows, destination = 'back') {
  return {
    inline_keyboard: [
      ...rows,
      [{
        text: '⬅️ Назад',
        callback_data: destination
      }]
    ]
  };
}

function mainMenu(id) {
  const s = state(id);

  s.step = 'menu';

  const keyboard = [
    [{ text: '🎮 Забронировать' }],
    [{ text: '💰 Посмотреть цены' }],
    [{ text: '👑 VIP-комнаты' }],
    [{ text: '📅 Расписание' }],
    [{ text: '📋 Мои заявки' }],
    [{ text: 'ℹ️ Информация' }],
    [{ text: '🛠 Техподдержка' }]
  ];

  if (s.language === 'hy') {
    for (const row of keyboard) {
      for (const button of row) {
        button.text = translate(id, button.text);
      }
    }
  }

  return bot.sendMessage(id, '🎮 <b>AURA PLAY</b>\n\nВыбери нужный раздел:', {
    parse_mode: 'HTML',
    reply_markup: {
      keyboard,
      resize_keyboard: true
    }
  });
}

// ================= ДАТА И ВРЕМЯ =================

function nowLocal() {
  return new Date(Date.now() + TIMEZONE_OFFSET_MS);
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function timestamp(date, time) {
  return new Date(`${date}T${time}:00+04:00`).getTime();
}

function timeText(value) {
  return new Date(value + TIMEZONE_OFFSET_MS)
    .toISOString()
    .slice(11, 16);
}

function dateTime(value) {
  const d = new Date(value + TIMEZONE_OFFSET_MS);

  return (
    d.toISOString().slice(8, 10) + '.' +
    d.toISOString().slice(5, 7) + '.' +
    d.toISOString().slice(0, 4) + ' ' +
    d.toISOString().slice(11, 16)
  );
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function businessHours(date) {
  const start = timestamp(date, '10:00');
  const end = timestamp(date, '24:00');

  return { start, end };
}

function validBookingWindow(date, start, end) {
  const hours = businessHours(date);

  return (
    start >= hours.start &&
    end <= hours.end &&
    start < end
  );
}

function priceFor(assetId, start, end) {
  const vip = assetId.startsWith('PSV');
  const dayPrice = vip ? 1200 : 1000;
  const nightPrice = vip ? 1400 : 1200;

  let total = 0;
  let cursor = start;

  while (cursor < end) {
    const current = new Date(cursor + TIMEZONE_OFFSET_MS);
    const hour = current.getUTCHours();

    const nextHour = Math.min(
      end,
      cursor + (60 - current.getUTCMinutes()) * 60 * 1000
    );

    total += (
      hour >= 10 && hour < 20
        ? dayPrice
        : nightPrice
    ) * ((nextHour - cursor) / HOUR_MS);

    cursor = nextHour;
  }

  return Math.round(total);
}

function findAsset(id) {
  for (const group of Object.values(assets)) {
    const found = group.find(a => a.id === id);

    if (found) return found;
  }

  return null;
}

// ================= SUPABASE =================

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;

  bookings = (data || []).map(row => ({
    id: row.id,
    chatId: String(row.telegram_id),
    assetId: row.asset_id,
    date: row.booking_date,
    start: new Date(row.start_at).getTime(),
    end: new Date(row.end_at).getTime(),
    duration: row.duration,
    phone: row.phone,
    price: row.price,
    status: row.status
  }));

  console.log(`Загружено бронирований: ${bookings.length}`);
}

async function saveBooking(booking) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      telegram_id: booking.chatId,
      asset_id: booking.assetId,
      booking_date: booking.date,
      start_at: new Date(booking.start).toISOString(),
      end_at: new Date(booking.end).toISOString(),
      duration: booking.duration,
      phone: booking.phone,
      price: booking.price,
      status: booking.status
    })
    .select()
    .single();

  if (error) throw error;

  booking.id = data.id;
  bookings.push(booking);

  return booking;
}

async function updateBookingStatus(id, status) {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);

  if (error) throw error;

  const booking = bookings.find(b => String(b.id) === String(id));

  if (booking) booking.status = status;
}

// ================= ЦЕНЫ И ИНФОРМАЦИЯ =================

function showPrices(id) {
  state(id).step = 'prices';

  return send(
    id,
    '<b>💰 ЦЕНЫ AURA PLAY</b>\n\n' +
    '<b>💻 Компьютеры</b>\n' +
    '10:00–20:00 — 1 000 драм/час\n' +
    '20:00–00:00 — 1 200 драм/час\n\n' +
    '<b>🎮 PS5 Pro — обычная зона</b>\n' +
    '10:00–20:00 — 1 000 драм/час\n' +
    '20:00–00:00 — 1 200 драм/час\n\n' +
    '<b>👑 PS5 Pro — VIP-комната</b>\n' +
    '10:00–20:00 — 1 200 драм/час\n' +
    '20:00–00:00 — 1 400 драм/час\n\n' +
    `🕒 ${OPEN_TEXT}`,
    {
      parse_mode: 'HTML',
      reply_markup: inlineBack()
    }
  );
}

function showVip(id) {
  state(id).step = 'vip';

  return send(
    id,
    '<b>👑 VIP-КОМНАТЫ AURA PLAY</b>\n\n' +
    '• VIP-комната № 1 — PS5 Pro\n' +
    '• VIP-комната № 2 — PS5 Pro\n\n' +
    '10:00–20:00 — 1 200 драм/час\n' +
    '20:00–00:00 — 1 400 драм/час\n\n' +
    `🕒 ${OPEN_TEXT}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{
            text: '👑 Забронировать VIP',
            callback_data: 'cat:ps_vip'
          }],
          [{
            text: '⬅️ Назад',
            callback_data: 'back'
          }]
        ]
      }
    }
  );
}

function showInfo(id) {
  state(id).step = 'info';

  return send(
    id,
    '<b>ℹ️ ИНФОРМАЦИЯ AURA PLAY</b>\n\n' +
    `🕒 ${OPEN_TEXT}\n` +
    '💻 Компьютеры и PS5 Pro\n' +
    '👑 VIP-комнаты\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `✈️ Telegram: ${SUPPORT_TELEGRAM}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{
            text: '📸 Instagram AURA PLAY',
            url: 'https://www.instagram.com/aura.play.kapan?rpxt=N3dxM3NodTM2aTc%3D&utm_source=qr'
          }],
          [{
            text: '⬅️ Назад',
            callback_data: 'back'
          }]
        ]
      }
    }
  );
}

function showHelp(id) {
  state(id).step = 'support';

  return send(
    id,
    '<b>🛠 ТЕХПОДДЕРЖКА AURA PLAY</b>\n\n' +
    `🕒 ${OPEN_TEXT}\n\n` +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `✈️ Telegram: ${SUPPORT_TELEGRAM}`,
    {
      parse_mode: 'HTML',
      reply_markup: inlineBack()
    }
  );
}

// ================= СОЗДАНИЕ БРОНИ =================

function startBooking(id, category = null) {
  const s = state(id);

  s.step = 'category';
  s.category = null;
  s.assetId = null;
  s.date = null;
  s.day = null;
  s.month = null;
  s.time = null;
  s.duration = null;
  s.phone = null;

  if (category) return showAssets(id, category);

  return send(id, '🎮 <b>Что хочешь забронировать?</b>', {
    parse_mode: 'HTML',
    reply_markup: rowsWithBack([
      [{
        text: '💻 Компьютер',
        callback_data: 'cat:computer'
      }],
      [{
        text: '🎮 PS5 Pro — обычная зона',
        callback_data: 'cat:ps_normal'
      }],
      [{
        text: '👑 PS5 Pro — VIP-комната',
        callback_data: 'cat:ps_vip'
      }]
    ])
  });
}

function showAssets(id, category) {
  if (!assets[category]) return startBooking(id);

  const s = state(id);

  s.step = 'asset';
  s.category = category;

  return send(id, 'Выбери конкретное место:', {
    reply_markup: rowsWithBack(
      assets[category].map(a => [{
        text: a.name,
        callback_data: `asset:${a.id}`
      }]),
      'back_category'
    )
  });
}

function askDay(id) {
  const s = state(id);

  s.step = 'day';
  s.day = null;
  s.month = null;

  const rows = [];

  for (let n = 1; n <= 31; n += 7) {
    rows.push(
      Array.from(
        { length: Math.min(7, 32 - n) },
        (_, i) => n + i
      ).map(day => ({
        text: String(day),
        callback_data: `day:${day}`
      }))
    );
  }

  return send(id, '📅 Выбери день бронирования:', {
    reply_markup: rowsWithBack(rows)
  });
}

function askMonth(id) {
  state(id).step = 'month';

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель',
    'Май', 'Июнь', 'Июль', 'Август',
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const rows = [];

  for (let i = 0; i < 12; i += 3) {
    rows.push(
      months.slice(i, i + 3).map((name, j) => ({
        text: name,
        callback_data: `month:${i + j + 1}`
      }))
    );
  }

  return send(id, '🗓️ Теперь выбери месяц:', {
    reply_markup: rowsWithBack(rows, 'back_day')
  });
}

function askTime(id) {
  state(id).step = 'time';

  return send(
    id,
    '⏰ Напиши время начала, например 18:00.\n' +
    '🕒 Часы работы: 10:00–00:00.\n\n' +
    'Бронирование должно закончиться до полуночи. ' +
    'Оформляй заявку минимум за 2 часа.',
    {
      reply_markup: {
        keyboard: [[{ text: '⬅️ Назад' }]],
        resize_keyboard: true
      }
    }
  );
}

function askDuration(id) {
  state(id).step = 'duration';

  const rows = [];

  for (let i = 1; i <= 12; i += 3) {
    rows.push(
      [i, i + 1, i + 2]
        .filter(n => n <= 12)
        .map(n => ({
          text: `${n} ч.`,
          callback_data: `duration:${n}`
        }))
    );
  }

  return send(
    id,
    '⌛ Выбери длительность бронирования.\n' +
    'Окончание — не позже 00:00.',
    {
      reply_markup: rowsWithBack(rows, 'back_time')
    }
  );
}

function askPhone(id) {
  state(id).step = 'phone';

  return send(
    id,
    '📱 Напиши свой номер телефона для подтверждения брони.',
    {
      reply_markup: {
        keyboard: [[{ text: '⬅️ Назад' }]],
        resize_keyboard: true
      }
    }
  );
}

// ================= РАСПИСАНИЕ =================

async function showScheduleForAsset(id) {
  const s = state(id);
  const asset = findAsset(s.assetId);

  const hours = businessHours(s.date);
  const dayStart = hours.start;
  const dayEnd = hours.end;

  const occupied = bookings
    .filter(b =>
      b.assetId === s.assetId &&
      ['pending', 'approved'].includes(b.status) &&
      b.start < dayEnd &&
      b.end > dayStart
    )
    .sort((a, b) => a.start - b.start);

  const lines = [
    `📅 <b>РАСПИСАНИЕ НА ${s.date}</b>`,
    `🕒 <b>Часы работы: 10:00–00:00</b>`,
    `🎮 <b>${asset ? asset.name : s.assetId}</b>`,
    '',
    '🔴 <b>ЗАНЯТО</b>'
  ];

  if (!occupied.length) {
    lines.push('Пока нет заявок на эту дату.');
  } else {
    for (const b of occupied) {
      const start = Math.max(b.start, dayStart);
      const end = Math.min(b.end, dayEnd);

      if (start < end) {
        lines.push(`• ${timeText(start)}–${timeText(end)}`);
      }
    }
  }

  lines.push('', '🟢 <b>СВОБОДНО</b>');

  let cursor = dayStart;

  for (const b of occupied) {
    const start = Math.max(b.start, dayStart);
    const end = Math.min(b.end, dayEnd);

    if (start > cursor) {
      lines.push(`• ${timeText(cursor)}–${timeText(start)}`);
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < dayEnd) {
    lines.push(`• ${timeText(cursor)}–00:00`);
  }

  await send(id, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineBack('back_day')
  });

  return askTime(id);
}

// ================= МОИ ЗАЯВКИ =================

async function showMyBookings(id) {
  state(id).step = 'mybookings';

  const list = bookings
    .filter(b => b.chatId === id)
    .sort((a, b) => b.start - a.start);

  if (!list.length) {
    return send(id, '📋 У тебя пока нет заявок.', {
      reply_markup: inlineBack()
    });
  }

  const lines = ['<b>📋 ТВОИ ЗАЯВКИ</b>', ''];

  for (const b of list.slice(0, 10)) {
    const asset = findAsset(b.assetId);

    lines.push(
      `<b>Заявка №${b.id}</b>`,
      `Место: ${asset ? asset.name : b.assetId}`,
      `Начало: ${dateTime(b.start)}`,
      `Окончание: ${dateTime(b.end)}`,
      `Длительность: ${b.duration} ч.`,
      `Цена: ${b.price.toLocaleString('ru-RU')} драм`,
      `Статус: ${
        b.status === 'pending'
          ? '⏳ Ожидает подтверждения'
          : b.status === 'approved'
            ? '✅ Подтверждена'
            : '❌ Отклонена'
      }`,
      ''
    );
  }

  return send(id, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineBack()
  });
}

// ================= КНОПКА НАЗАД =================

async function goBack(id, destination = '') {
  const s = state(id);

  if (destination === 'back_category') return startBooking(id);
  if (destination === 'back_day') return askDay(id);
  if (destination === 'back_time') return askTime(id);

  if (s.step === 'asset') return startBooking(id);
  if (s.step === 'day') return showAssets(id, s.category);
  if (s.step === 'month') return askDay(id);
  if (s.step === 'time') return showScheduleForAsset(id);
  if (s.step === 'duration') return askTime(id);
  if (s.step === 'phone') return askDuration(id);

  return mainMenu(id);
}

// ================= КОМАНДЫ =================

bot.onText(/\/start/, async msg => {
  const id = msg.chat.id;

  state(id).step = 'language';

  return bot.sendMessage(
    id,
    'Բարի գալուստ Aura Play!\nВыберите язык / Ընտրեք լեզուն:',
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🇦🇲 Հայերեն',
            callback_data: 'lang:hy'
          },
          {
            text: '🇷🇺 Русский',
            callback_data: 'lang:ru'
          }
        ]]
      }
    }
  );
});

bot.onText(/\/language/, msg => {
  const id = msg.chat.id;

  state(id).step = 'language';

  return bot.sendMessage(
    id,
    'Выбери язык / Ընտրեք լեզուն:',
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🇦🇲 Հայերեն',
            callback_data: 'lang:hy'
          },
          {
            text: '🇷🇺 Русский',
            callback_data: 'lang:ru'
          }
        ]]
      }
    }
  );
});

bot.onText(/\/book/, msg => startBooking(msg.chat.id));
bot.onText(/\/prices/, msg => showPrices(msg.chat.id));
bot.onText(/\/vip/, msg => showVip(msg.chat.id));
bot.onText(/\/schedule/, msg => startBooking(msg.chat.id));
bot.onText(/\/mybookings/, msg => showMyBookings(msg.chat.id));
bot.onText(/\/help/, msg => showHelp(msg.chat.id));

// ================= ТЕКСТОВЫЕ СООБЩЕНИЯ =================

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const id = msg.chat.id;
  const s = state(id);
  const text = normalize(id, msg.text.trim());

  try {
    if (text === '🎮 Забронировать') return startBooking(id);
    if (text === '💰 Посмотреть цены') return showPrices(id);
    if (text === '👑 VIP-комнаты') return showVip(id);
    if (text === '📅 Расписание') return startBooking(id);
    if (text === '📋 Мои заявки') return showMyBookings(id);
    if (text === 'ℹ️ Информация') return showInfo(id);
    if (text === '🛠 Техподдержка') return showHelp(id);
    if (text === '⬅️ Назад') return goBack(id);

    // ----- ВВОД ВРЕМЕНИ -----

    if (s.step === 'time') {
      if (!validTime(text)) {
        return send(
          id,
          '❌ Введи время в формате ЧЧ:ММ, например 18:00.'
        );
      }

      s.time = text;

      const start = timestamp(s.date, s.time);
      const hours = businessHours(s.date);

      if (start < hours.start || start >= hours.end) {
        return send(
          id,
          '❌ Начало бронирования возможно только с 10:00 до 23:59. Выбери другое время.'
        );
      }

      if (start < Date.now() + MIN_BOOKING_LEAD_MS) {
        return send(
          id,
          '❌ Бронирование нужно оформлять минимум за 2 часа. Выбери другое время.'
        );
      }

      return askDuration(id);
    }

    // ----- ВВОД ТЕЛЕФОНА И СОЗДАНИЕ ЗАЯВКИ -----

    if (s.step === 'phone') {
      const phone = text.replace(/[^\d+]/g, '');

      if (!/^\+?\d{7,15}$/.test(phone)) {
        return send(
          id,
          '❌ Проверь номер телефона и введи ещё раз.'
        );
      }

      s.phone = phone;

      const start = timestamp(s.date, s.time);
      const end = start + s.duration * HOUR_MS;

      if (!validBookingWindow(s.date, start, end)) {
        await send(id, '❌ Выбранное время выходит за пределы рабочего графика.');
        return askTime(id);
      }

      const conflict = bookings.some(b =>
        b.assetId === s.assetId &&
        ['pending', 'approved'].includes(b.status) &&
        start < b.end &&
        end > b.start
      );

      if (conflict) {
        await send(id, '❌ Это место уже занято на выбранное время. Выбери другое.');
        return showScheduleForAsset(id);
      }

      const price = priceFor(s.assetId, start, end);

      const booking = {
        chatId: String(id),
        assetId: s.assetId,
        date: s.date,
        start,
        end,
        duration: s.duration,
        phone,
        price,
        status: 'pending'
      };

      await saveBooking(booking);

      await send(
        id,
        '<b>✅ ЗАЯВКА СОЗДАНА!</b>\n\n' +
        `Номер заявки: №${booking.id}\n` +
        `Место: ${findAsset(s.assetId).name}\n` +
        `Дата: ${s.date}\n` +
        `Время: ${timeText(start)}–${timeText(end)}\n` +
        `Длительность: ${s.duration} ч.\n` +
        `Телефон: ${phone}\n` +
        `Стоимость: ${price.toLocaleString('ru-RU')} драм\n\n` +
        '⏳ Ожидай подтверждения администратора.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            remove_keyboard: true
          }
        }
      );

      for (const adminId of ADMIN_IDS) {
        await bot.sendMessage(
          adminId,
          '<b>🔔 НОВАЯ ЗАЯВКА AURA PLAY</b>\n\n' +
          `Номер: №${booking.id}\n` +
          `Клиент: <code>${id}</code>\n` +
          `Место: ${findAsset(s.assetId).name}\n` +
          `Дата: ${s.date}\n` +
          `Время: ${timeText(start)}–${timeText(end)}\n` +
          `Длительность: ${s.duration} ч.\n` +
          `Телефон: ${phone}\n` +
          `Стоимость: ${price.toLocaleString('ru-RU')} драм`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{
                  text: '✅ Подтвердить',
                  callback_data: `approve:${booking.id}`
                }],
                [{
                  text: '❌ Отклонить',
                  callback_data: `reject:${booking.id}`
                }]
              ]
            }
          }
        );
      }

      s.step = 'menu';

      return;
    }
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error);

    await send(
      id,
      '❌ Произошла ошибка. Попробуй ещё раз или обратись в техподдержку.'
    );
  }
});

// ================= НАЖАТИЯ НА КНОПКИ =================

bot.on('callback_query', async query => {
  const id = String(query.message.chat.id);
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('lang:')) {
      const language = data.split(':')[1];

      state(id).language = language;
      state(id).step = 'menu';

      await bot.deleteMessage(id, query.message.message_id).catch(() => {});

      return mainMenu(id);
    }

    if (data.startsWith('cat:')) {
      const category = data.split(':')[1];

      return showAssets(id, category);
    }

    if (data.startsWith('asset:')) {
      const assetId = data.split(':')[1];
      const s = state(id);

      s.assetId = assetId;
      s.step = 'day';

      return askDay(id);
    }

    if (data.startsWith('day:')) {
      const day = Number(data.split(':')[1]);
      const s = state(id);

      s.day = day;

      return askMonth(id);
    }

    if (data.startsWith('month:')) {
      const month = Number(data.split(':')[1]);
      const s = state(id);

      s.month = month;

      const now = nowLocal();
      const year = now.getUTCFullYear();

      const date = new Date(Date.UTC(year, month - 1, s.day));
      const selectedDate = dateText(date);

      if (
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== s.day
      ) {
        return send(id, '❌ Такой даты не существует. Выбери другую.');
      }

      if (timestamp(selectedDate, '23:59') < Date.now()) {
        return send(id, '❌ Эта дата уже прошла. Выбери другую.');
      }

      s.date = selectedDate;

      return showScheduleForAsset(id);
    }

    if (data.startsWith('duration:')) {
      const duration = Number(data.split(':')[1]);

      if (!Number.isInteger(duration) || duration < 1 || duration > 12) {
        return send(id, '❌ Неверная длительность.');
      }

      state(id).duration = duration;

      return askPhone(id);
    }

    if (data.startsWith('approve:')) {
      if (!ADMIN_IDS.includes(id)) {
        return bot.answerCallbackQuery(query.id, {
          text: 'Только администратор может подтвердить заявку.',
          show_alert: true
        });
      }

      const bookingId = data.split(':')[1];

      await updateBookingStatus(bookingId, 'approved');

      const booking = bookings.find(
        b => String(b.id) === String(bookingId)
      );

      if (booking) {
        await bot.sendMessage(
          booking.chatId,
          `✅ Твоя заявка №${booking.id} подтверждена!\n\n` +
          `Место: ${findAsset(booking.assetId).name}\n` +
          `Дата: ${booking.date}\n` +
          `Время: ${timeText(booking.start)}–${timeText(booking.end)}\n` +
          `Стоимость: ${booking.price.toLocaleString('ru-RU')} драм`
        );
      }

      return bot.editMessageReplyMarkup(
        {
          inline_keyboard: [[{
            text: '✅ Заявка подтверждена',
            callback_data: 'done'
          }]]
        },
        {
          chat_id: id,
          message_id: query.message.message_id
        }
      );
    }

    if (data.startsWith('reject:')) {
      if (!ADMIN_IDS.includes(id)) {
        return bot.answerCallbackQuery(query.id, {
          text: 'Только администратор может отклонить заявку.',
          show_alert: true
        });
      }

      const bookingId = data.split(':')[1];

      await updateBookingStatus(bookingId, 'rejected');

      const booking = bookings.find(
        b => String(b.id) === String(bookingId)
      );

      if (booking) {
        await bot.sendMessage(
          booking.chatId,
          `❌ Твоя заявка №${booking.id} отклонена администратором.`
        );
      }

      return bot.editMessageReplyMarkup(
        {
          inline_keyboard: [[{
            text: '❌ Заявка отклонена',
            callback_data: 'done'
          }]]
        },
        {
          chat_id: id,
          message_id: query.message.message_id
        }
      );
    }

    if (data === 'back' || data.startsWith('back_')) {
      return goBack(id, data);
    }

  } catch (error) {
    console.error('Ошибка кнопки:', error);

    await bot.answerCallbackQuery(query.id, {
      text: 'Произошла ошибка. Попробуй ещё раз.',
      show_alert: true
    }).catch(() => {});
  }
});

// ================= ЗАПУСК =================

bot.on('polling_error', error => {
  console.error('Ошибка Telegram:', error.message);
});

process.on('unhandledRejection', error => {
  console.error('Ошибка приложения:', error);
});

loadBookings()
  .then(() => {
    console.log('Aura Play Booking готов к работе.');
    console.log('График клуба: ежедневно с 10:00 до 00:00.');
  })
  .catch(error => {
    console.error('Ошибка запуска:', error);
  });
