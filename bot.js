
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
  '🔴 ЗАНЯТО': '🔴 ԶԲԱՂՎԱԾ Է',
  '🟢 СВОБОДНО': '🟢 ԱԶԱՏ Է',
  'Пока нет заявок на эту дату.': 'Այս ամսաթվի համար հայտեր դեռ չկան։',
  'Нет свободных промежутков.': 'Ազատ ժամեր չկան։',
  'Начало:': 'Սկիզբը՝',
  'Окончание:': 'Ավարտը՝',
  'Место:': 'Տեղը՝',
  'Телефон:': 'Հեռախոս՝',
  'Цена:': 'Գինը՝',
  'Длительность:': 'Տևողությունը՝',
  'Статус:': 'Կարգավիճակ՝',
  'Клиент:': 'Հաճախորդ՝',
  'драм': 'դրամ',
  'часа': 'ժամ',
  'Компьютер № 1': 'Համակարգիչ № 1',
  'Компьютер № 2': 'Համակարգիչ № 2',
  'Компьютер № 3': 'Համակարգիչ № 3',
  'Компьютер № 4': 'Համակարգիչ № 4',
  'Компьютер № 5': 'Համակարգիչ № 5',
  'PS5 Pro — обычная зона № 1': 'PS5 Pro՝ սովորական գոտի № 1',
  'PS5 Pro — обычная зона № 2': 'PS5 Pro՝ սովորական գոտի № 2',
  'PS5 Pro — VIP-комната № 1': 'PS5 Pro՝ VIP սենյակ № 1',
  'PS5 Pro — VIP-комната № 2': 'PS5 Pro՝ VIP սենյակ № 2',
  'Январь': 'Հունվար',
  'Февраль': 'Փետրվար',
  'Март': 'Մարտ',
  'Апрель': 'Ապրիլ',
  'Май': 'Մայիս',
  'Июнь': 'Հունիս',
  'Июль': 'Հուլիս',
  'Август': 'Օգոստոս',
  'Сентябрь': 'Սեպտեմբեր',
  'Октябрь': 'Հոկտեմբեր',
  'Ноябрь': 'Նոյեմբեր',
  'Декабрь': 'Դեկտեմբեր'
};

function state(id) {
  if (!users.has(id)) {
    users.set(id, {
      lang: 'ru',
      step: 'menu',
      category: null,
      assetId: null,
      date: null,
      day: null,
      month: null,
      time: null,
      duration: null,
      phone: null
    });
  }

  return users.get(id);
}

function tr(id, text) {
  if (state(id).lang !== 'hy') return text;

  let out = String(text);

  for (const [ru, hy] of Object.entries(HY)) {
    out = out.split(ru).join(hy);
  }

  out = out.replace(
    /Ежедневно: 10:00–00:00/g,
    'Ամեն օր՝ 10:00–00:00'
  );

  out = out.replace(/(\d+) ч\./g, '$1 ժ.');

  return out;
}

function normalize(id, text) {
  if (state(id).lang !== 'hy') return text;

  let out = text;

  for (const [ru, hy] of Object.entries(HY)) {
    out = out.split(hy).join(ru);
  }

  return out;
}

function send(id, text, options = {}) {
  const opts = { ...options };

  if (opts.reply_markup) {
    opts.reply_markup = JSON.parse(
      JSON.stringify(opts.reply_markup)
    );

    const walk = node => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        return node.forEach(walk);
      }

      for (const key of Object.keys(node)) {
        if (key === 'text' && typeof node[key] === 'string') {
          node[key] = tr(id, node[key]);
        } else {
          walk(node[key]);
        }
      }
    };

    walk(opts.reply_markup);
  }

  return bot.sendMessage(id, tr(id, text), opts);
}

// ================= ДАТА И ВРЕМЯ =================

// Все даты и часы бронирования рассчитываются по времени Армении (UTC+4).

function timestamp(date, time) {
  const [d, m, y] = date.split('.').map(Number);
  const [h, min] = time.split(':').map(Number);

  return Date.UTC(y, m - 1, d, h, min) - TIMEZONE_OFFSET_MS;
}

function dateTime(ts) {
  const d = new Date(ts + TIMEZONE_OFFSET_MS);

  return (
    `${String(d.getUTCDate()).padStart(2, '0')}.` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}.` +
    `${d.getUTCFullYear()} ` +
    `${String(d.getUTCHours()).padStart(2, '0')}:` +
    `${String(d.getUTCMinutes()).padStart(2, '0')}`
  );
}

function timeText(ts) {
  const d = new Date(ts + TIMEZONE_OFFSET_MS);

  return (
    `${String(d.getUTCHours()).padStart(2, '0')}:` +
    `${String(d.getUTCMinutes()).padStart(2, '0')}`
  );
}

function validTime(text) {
  if (!/^\d{2}:\d{2}$/.test(text)) return false;

  const [h, m] = text.split(':').map(Number);

  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function validDate(text) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) return false;

  const [d, m, y] = text.split('.').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function nextCalendarDate(date) {
  const [d, m, y] = date.split('.').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d) + 86400000);

  return (
    `${String(next.getUTCDate()).padStart(2, '0')}.` +
    `${String(next.getUTCMonth() + 1).padStart(2, '0')}.` +
    `${next.getUTCFullYear()}`
  );
}

function businessHours(date) {
  return {
    start: timestamp(date, '10:00'),
    end: timestamp(date, '24:00')
  };
}

// Начало — не раньше 10:00.
// Окончание — не позже 00:00 следующего календарного дня.
// Бронирование через полночь запрещено.
function validBookingWindow(date, start, end) {
  if (!validDate(date)) return false;

  const hours = businessHours(date);

  return (
    start >= hours.start &&
    start < hours.end &&
    end > start &&
    end <= hours.end
  );
}

function nextDate(day, month) {
  const now = new Date(Date.now() + TIMEZONE_OFFSET_MS);

  for (
    let year = now.getUTCFullYear();
    year <= now.getUTCFullYear() + 2;
    year++
  ) {
    const date =
      `${String(day).padStart(2, '0')}.` +
      `${String(month).padStart(2, '0')}.` +
      `${year}`;

    if (!validDate(date)) continue;

    if (timestamp(date, '23:59') >= Date.now()) {
      return date;
    }
  }

  return null;
}

// ================= ЦЕНЫ =================

// 10:00–20:00 — дневной тариф.
// 20:00–00:00 — вечерний тариф.

function priceRate(category, hour) {
  const daytime = hour >= OPEN_HOUR && hour < DAY_RATE_END;

  if (category === 'computer' || category === 'ps_normal') {
    return daytime ? 1000 : 1200;
  }

  if (category === 'ps_vip') {
    return daytime ? 1200 : 1400;
  }

  return 0;
}

function calculatePrice(category, start, duration) {
  let total = 0;

  for (let i = 0; i < duration; i++) {
    const hour = new Date(
      start + i * HOUR_MS + TIMEZONE_OFFSET_MS
    ).getUTCHours();

    total += priceRate(category, hour);
  }

  return total;
}

// ================= БРОНИРОВАНИЯ =================

function findAsset(assetId) {
  return Object.values(assets)
    .flat()
    .find(a => a.id === assetId);
}

function conflict(assetId, start, end, excludeId = null) {
  return bookings.find(b =>
    b.assetId === assetId &&
    b.id !== excludeId &&
    ['pending', 'approved'].includes(b.status) &&
    start < b.end &&
    end > b.start
  ) || null;
}

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) {
    console.error(
      'Ошибка загрузки бронирований:',
      error.message
    );
    return;
  }

  bookings = (data || []).map(row => {
    let extra = {};

    try {
      extra = row.comment ? JSON.parse(row.comment) : {};
    } catch (_) {}

    const date = row.booking_date
      ? row.booking_date.split('-').reverse().join('.')
      : extra.date;

    const time = row.start_time || extra.time;
    const start = Number(extra.start) || timestamp(date, time);
    const duration = Number(row.duration || extra.duration || 1);

    return {
      ...extra,
      id: Number(row.id),
      chatId: Number(row.telegram_id),
      assetId: row.asset_name,
      date,
      time,
      start,
      end: start + duration * HOUR_MS,
      duration,
      phone: row.phone || extra.phone || '',
      username: row.customer_name || extra.username || 'Клиент',
      status: row.status || 'pending',
      price: Number(extra.price || 0)
    };
  });

  console.log(`Загружено бронирований: ${bookings.length}`);
}

async function saveStatus(id, statusValue) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: statusValue })
    .eq('id', id);

  if (error) throw error;
}

// ================= ГЛАВНОЕ МЕНЮ =================

function mainMenu(id) {
  state(id).step = 'menu';

  return send(
    id,
    '<b>🎮 Добро пожаловать в Aura Play!</b>\n\n' +
    'Здесь ты можешь забронировать компьютер или PS5 Pro, ' +
    'посмотреть цены и выбрать VIP-комнату.\n\n' +
    `🕒 ${OPEN_TEXT}\n\nВыбери нужный раздел в меню.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [
            { text: '🎮 Забронировать' },
            { text: '💰 Посмотреть цены' }
          ],
          [
            { text: '👑 VIP-комнаты' },
            { text: '📅 Расписание' }
          ],
          [
            { text: '📋 Мои заявки' },
            { text: 'ℹ️ Информация' }
          ],
          [{ text: '🛠 Техподдержка' }],
          [{ text: '⬅️ Назад' }]
        ],
        resize_keyboard: true
      }
    }
  );
}

function inlineBack(callback = 'back') {
  return {
    inline_keyboard: [
      [{ text: '⬅️ Назад', callback_data: callback }]
    ]
  };
}

function rowsWithBack(rows, callback = 'back') {
  return {
    inline_keyboard: [
      ...rows,
      [{ text: '⬅️ Назад', callback_data: callback }]
    ]
  };
}

// ================= ИНФОРМАЦИЯ И ЦЕНЫ =================

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
      reply_markup: inlineBack()
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
        await send(
          id,
          '❌ Клуб работает с 10:00 до 00:00. Бронирование должно закончиться до полуночи.'
        );

        return askDuration(id);
      }

      if (start < Date.now() + MIN_BOOKING_LEAD_MS) {
        return send(
          id,
          '❌ Бронирование нужно оформлять минимум за 2 часа. Выбери другое время.'
        );
      }

      const existing = conflict(s.assetId, start, end);

      if (existing) {
        return send(
          id,
          `❌ Это место уже занято до ${dateTime(existing.end)}. Выбери другое время.`
        );
      }

      const asset = findAsset(s.assetId);

      const booking = {
        chatId: id,
        username: msg.from.username
          ? `@${msg.from.username}`
          : (msg.from.first_name || 'Клиент'),
        assetId: s.assetId,
        category: s.category,
        date: s.date,
        time: s.time,
        duration: s.duration,
        start,
        end,
        phone,
        price: calculatePrice(s.category, start, s.duration),
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          telegram_id: id,
          asset_name: s.assetId,
          booking_date: s.date.split('.').reverse().join('-'),
          start_time: s.time,
          duration: s.duration,
          status: 'pending',
          phone,
          customer_name: booking.username,
          comment: JSON.stringify(booking)
        })
        .select('id')
        .single();

      if (error) {
        console.error('Ошибка Supabase:', error.message);

        return send(
          id,
          'Не удалось сохранить заявку. Попробуй позже.'
        );
      }

      booking.id = Number(data.id);
      bookings.push(booking);
      s.step = 'menu';

      await send(
        id,
        `<b>✅ Заявка №${booking.id} создана!</b>\n\n` +
        `Место: ${asset.name}\n` +
        `Начало: ${dateTime(start)}\n` +
        `Окончание: ${dateTime(end)}\n` +
        `Длительность: ${booking.duration} ч.\n` +
        `Цена: ${booking.price.toLocaleString('ru-RU')} драм\n` +
        'Статус: ⏳ ожидает подтверждения администратора.',
        { parse_mode: 'HTML' }
      );

      const adminMessage =
        `<b>🔔 НОВАЯ ЗАЯВКА №${booking.id}</b>\n\n` +
        `Клиент: ${booking.username}\n` +
        `Телефон: ${booking.phone}\n` +
        `Место: ${asset.name}\n` +
        `Начало: ${dateTime(start)}\n` +
        `Окончание: ${dateTime(end)}\n` +
        `Цена: ${booking.price.toLocaleString('ru-RU')} драм`;

      await Promise.all(
        ADMIN_IDS.map(adminId =>
          bot.sendMessage(adminId, adminMessage, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '✅ Подтвердить',
                  callback_data: `approve:${booking.id}`
                },
                {
                  text: '❌ Отклонить',
                  callback_data: `reject:${booking.id}`
                }
              ]]
            }
          }).catch(e => console.error(
            `Ошибка отправки администратору ${adminId}:`,
            e.message
          ))
        )
      );
    }
  } catch (e) {
    console.error('Ошибка обработки сообщения:', e);

    await send(
      id,
      'Произошла ошибка. Нажми /start.'
    ).catch(() => {});
  }
});

// ================= INLINE-КНОПКИ =================

bot.on('callback_query', async query => {
  const id = query.message.chat.id;
  const data = query.data || '';
  const s = state(id);

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === 'lang:hy' || data === 'lang:ru') {
      s.lang = data === 'lang:hy' ? 'hy' : 'ru';
      return mainMenu(id);
    }

    if (data === 'back') return goBack(id);
    if (data === 'back_category') {
      return goBack(id, 'back_category');
    }
    if (data === 'back_day') return goBack(id, 'back_day');
    if (data === 'back_time') return goBack(id, 'back_time');

    if (data.startsWith('cat:')) {
      return showAssets(id, data.slice(4));
    }

    if (data.startsWith('asset:')) {
      const assetId = data.slice(6);

      if (!assets[s.category]?.some(a => a.id === assetId)) {
        return;
      }

      s.assetId = assetId;

      return askDay(id);
    }

    if (data.startsWith('day:')) {
      if (s.step !== 'day') return;

      const day = Number(data.slice(4));

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return;
      }

      s.day = day;

      return askMonth(id);
    }

    if (data.startsWith('month:')) {
      if (s.step !== 'month' || !s.day) return;

      const month = Number(data.slice(6));

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return;
      }

      const date = nextDate(s.day, month);

      if (!date || !validDate(date)) {
        await send(
          id,
          '❌ Такой даты нет. Выбери другой день.'
        );

        return askDay(id);
      }

      s.month = month;
      s.date = date;

      return showScheduleForAsset(id);
    }

    // ----- ПРОВЕРКА ДЛИТЕЛЬНОСТИ -----

    if (data.startsWith('duration:')) {
      if (s.step !== 'duration') return;

      const duration = Number(data.slice(9));

      if (
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 12
      ) {
        return;
      }

      const start = timestamp(s.date, s.time);
      const end = start + duration * HOUR_MS;

      if (!validBookingWindow(s.date, start, end)) {
        await send(
          id,
          '❌ Эта длительность выходит за часы работы. ' +
          'Клуб закрывается в 00:00. Выбери меньше часов.'
        );

        return askDuration(id);
      }

      if (start < Date.now() + MIN_BOOKING_LEAD_MS) {
        await send(
          id,
          '❌ Бронирование нужно оформлять минимум за 2 часа. Выбери другое время.'
        );

        return askTime(id);
      }

      const existing = conflict(s.assetId, start, end);

      if (existing) {
        await send(
          id,
          '❌ Это время пересекается с другой заявкой. Выбери другое.'
        );

        return showScheduleForAsset(id);
      }

      s.duration = duration;

      return askPhone(id);
    }

    // ----- ПОДТВЕРЖДЕНИЕ И ОТКЛОНЕНИЕ ЗАЯВОК -----

    if (
      data.startsWith('approve:') ||
      data.startsWith('reject:')
    ) {
      if (!ADMIN_IDS.includes(String(query.from.id))) {
        return bot.answerCallbackQuery(query.id, {
          text: 'Только администратор может это сделать.'
        });
      }

      const [action, idText] = data.split(':');

      const booking = bookings.find(
        b => b.id === Number(idText)
      );

      if (!booking || booking.status !== 'pending') {
        return send(
          id,
          'Заявка уже обработана или не найдена.'
        );
      }

      if (action === 'approve') {
        // Дополнительная защита перед подтверждением.
        if (
          !validBookingWindow(
            booking.date,
            booking.start,
            booking.end
          )
        ) {
          booking.status = 'rejected';

          await saveStatus(booking.id, 'rejected');

          await bot.sendMessage(
            booking.chatId,
            '❌ Заявка отклонена: время бронирования выходит за часы работы клуба.'
          );

          return bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
              chat_id: id,
              message_id: query.message.message_id
            }
          );
        }

        const existing = conflict(
          booking.assetId,
          booking.start,
          booking.end,
          booking.id
        );

        if (existing) {
          booking.status = 'rejected';

          await saveStatus(booking.id, 'rejected');

          await bot.sendMessage(
            booking.chatId,
            '❌ Заявка не подтверждена: время уже занято. Свяжись с клубом.'
          );

          return bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
              chat_id: id,
              message_id: query.message.message_id
            }
          );
        }
      }

      booking.status =
        action === 'approve' ? 'approved' : 'rejected';

      await saveStatus(booking.id, booking.status);

      await bot.sendMessage(
        booking.chatId,
        action === 'approve'
          ? `✅ Бронирование №${booking.id} подтверждено! Ждём тебя в Aura Play.`
          : `❌ Бронирование №${booking.id} отклонено. Свяжись с техподдержкой.`
      );

      return bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: id,
          message_id: query.message.message_id
        }
      );
    }
  } catch (e) {
    console.error('Ошибка обработки кнопки:', e);

    if (
      data.startsWith('approve:') ||
      data.startsWith('reject:')
    ) {
      await Promise.all(
        ADMIN_IDS.map(adminId =>
          bot.sendMessage(
            adminId,
            'Не удалось обработать заявку. Проверь подключение к Supabase.'
          ).catch(() => {})
        )
      );
    }
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
