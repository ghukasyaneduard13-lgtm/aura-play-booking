
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// ================== НАСТРОЙКИ ==================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');
const PORT = process.env.PORT || 3000;

if (!TOKEN || !ADMIN_ID || !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_KEY) {
  throw new Error(
    'Заполни BOT_TOKEN, ADMIN_ID, SUPABASE_URL и SUPABASE_KEY в Render.'
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const bot = new TelegramBot(TOKEN, { polling: true });

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aura Play Booking is running!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Aura Play запущен на порту ${PORT}`);
});

const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';
const OPEN_TEXT = 'Ежедневно: 10:00–05:00';

const photos = {
  home: process.env.PHOTO_HOME || '',
  booking: process.env.PHOTO_BOOKING || '',
  prices: process.env.PHOTO_PRICES || '',
  vip: process.env.PHOTO_VIP || '',
  schedule: process.env.PHOTO_SCHEDULE || '',
  help: process.env.PHOTO_HELP || ''
};

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

const users = new Map();
let bookings = [];
let nextBookingId = 1;

// ================== ЯЗЫКИ ==================

const HY = [
  ['🎮 Забронировать', '🎮 Ամրագրել'],
  ['💰 Посмотреть цены', '💰 Տեսնել գները'],
  ['👑 VIP-комнаты', '👑 VIP սենյակներ'],
  ['📅 Расписание', '📅 Ժամանակացույց'],
  ['📋 Мои заявки', '📋 Իմ հայտերը'],
  ['ℹ️ Информация', 'ℹ️ Տեղեկություն'],
  ['🛠 Техподдержка', '🛠 Աջակցություն'],
  ['⬅️ Назад', '⬅️ Հետ'],
  ['🎮 <b>Что хочешь забронировать?</b>',
    '🎮 <b>Ի՞նչ եք ցանկանում ամրագրել։</b>'],
  ['Выбери конкретное место:', 'Ընտրեք կոնկրետ տեղը։'],
  ['📅 Выбери день бронирования:',
    '📅 Ընտրեք ամրագրման օրը։'],
  ['🗓️ Теперь выбери месяц:', '🗓️ Այժմ ընտրեք ամիսը։'],
  ['⌛ Выбери длительность бронирования:',
    '⌛ Ընտրեք ամրագրման տևողությունը։'],
  ['📱 Напиши свой номер телефона для подтверждения брони.',
    '📱 Ամրագրումը հաստատելու համար գրեք ձեր հեռախոսահամարը։'],
  ['Чтобы вернуться, нажми «⬅️ Назад» в меню.',
    'Վերադառնալու համար սեղմեք «⬅️ Հետ» կոճակը։'],
  ['❌ Это время уже прошло. Выбери другое.',
    '❌ Այս ժամը արդեն անցել է։ Ընտրեք մեկ այլ ժամ։'],
  ['❌ Проверь номер телефона и введи ещё раз.',
    '❌ Ստուգեք հեռախոսահամարը և կրկին մուտքագրեք։'],
  ['Пока нет заявок на эту дату.',
    'Այս ամսաթվի համար հայտեր դեռ չկան։'],
  ['Нет свободных промежутков.', 'Ազատ ժամեր չկան։'],
  ['Часы работы: 10:00–05:00.',
    'Աշխատանքային ժամերը՝ 10:00–05:00։'],
  ['❌ Заявка не подтверждена: время уже занято. Свяжись с клубом.',
    '❌ Հայտը չի հաստատվել․ այդ ժամը զբաղված է։ Կապվեք ակումբի հետ։'],
  ['❌ Такой даты нет. Выбери другой день.',
    '❌ Այդ ամսաթիվը գոյություն չունի։ Ընտրեք այլ օր։'],
  ['❌ Это время пересекается с другой заявкой. Нажми «Назад», чтобы выбрать другое время.',
    '❌ Այս ժամը համընկնում է մեկ այլ հայտի հետ։ Ընտրեք այլ ժամ։'],
  ['❌ До начала должно оставаться минимум ',
    '❌ Մինչև մեկնարկը պետք է մնա առնվազն '],
  ['часа.', ' ժամ։'],
  ['Нажми «Назад» и выбери другое время.',
    'Սեղմեք «Հետ» և ընտրեք այլ ժամ։'],
  ['Заявка уже обработана или не найдена.',
    'Հայտն արդեն մշակվել է կամ չի գտնվել։'],
  ['Только администратор может это сделать.',
    'Միայն ադմինիստրատորը կարող է դա անել։'],
  ['Выбери другое время.', 'Ընտրեք այլ ժամ։'],
  ['Свяжись с клубом.', 'Կապվեք ակումբի հետ։'],
  ['Компьютеры:', 'Համակարգիչներ՝'],
  ['PS5 Pro — обычная зона:', 'PS5 Pro՝ սովորական գոտի՝'],
  ['PS5 Pro — VIP-комната:', 'PS5 Pro՝ VIP սենյակ՝'],
  ['Итоговая цена рассчитывается по часам бронирования.',
    'Վերջնական գինը հաշվարկվում է ըստ ամրագրման ժամերի։'],
  ['По вопросам бронирования и работы клуба обращайся к нам.',
    'Ամրագրման կամ ակումբի աշխատանքի վերաբերյալ հարցերով կապվեք մեզ հետ։'],
  ['📋 У тебя пока нет заявок.', '📋 Դուք դեռ հայտեր չունեք։'],
  ['Заявка №', 'Հայտ №'],
  ['Место:', 'Տեղը՝'],
  ['Начало:', 'Սկիզբը՝'],
  ['Окончание:', 'Ավարտը՝'],
  ['Цена:', 'Գինը՝'],
  ['Длительность:', 'Տևողությունը՝'],
  ['драм', 'դրամ'],
  ['⏳ Ожидает подтверждения', '⏳ Սպասում է հաստատման'],
  ['✅ Подтверждена', '✅ Հաստատված է'],
  ['❌ Отклонена', '❌ Մերժված է'],
  ['создана!', 'ստեղծված է։'],
  ['ожидает подтверждения администратора.',
    'սպասում է ադմինիստրատորի հաստատմանը։'],
  ['подтверждено! Ждём тебя в Aura Play.',
    'հաստատված է։ Սպասում ենք քեզ Aura Play-ում։'],
  ['отклонено. Свяжись с техподдержкой.',
    'մերժվել է։ Կապվեք աջակցության հետ։'],
  ['🔔 НОВАЯ ЗАЯВКА №', '🔔 ՆՈՐ ՀԱՅՏ №'],
  ['🎮 Добро пожаловать в Aura Play!',
    '🎮 Բարի գալուստ Aura Play։'],
  ['Выбери месяц:', 'Ընտրեք ամիսը։'],
  ['💰 ЦЕНЫ AURA PLAY', '💰 AURA PLAY-Ի ԳՆԵՐԸ'],
  ['👑 VIP-КОМНАТЫ AURA PLAY', '👑 AURA PLAY-Ի VIP ՍԵՆՅԱԿՆԵՐԸ'],
  ['📅 РАСПИСАНИЕ AURA PLAY', '📅 AURA PLAY-Ի ԺԱՄԱՆԱԿԱՑՈՒՅՑԸ'],
  ['ℹ️ ИНФОРМАЦИЯ AURA PLAY', 'ℹ️ ՏԵՂԵԿՈՒԹՅՈՒՆ AURA PLAY-Ի ՄԱՍԻՆ'],
  ['🛠 ТЕХПОДДЕРЖКА AURA PLAY', '🛠 AURA PLAY-Ի ԱՋԱԿՑՈՒԹՅՈՒՆԸ']
];

function getState(id) {
  if (!users.has(id)) {
    users.set(id, { step: 'menu', lang: null });
  }
  return users.get(id);
}

function tr(id, value) {
  if (String(id) === ADMIN_ID || getState(id).lang !== 'hy') {
    return value;
  }

  let result = value;

  for (const [ru, hy] of HY) {
    result = result.split(ru).join(hy);
  }

  return result
    .replace(/Ежедневно: 10:00–05:00/g, 'Ամեն օր՝ 10:00–05:00')
    .replace(/([0-9]+) ч\./g, '$1 ժ.')
    .replace(/([0-9, ]+) драм/g, '$1 դրամ');
}

const originalSendMessage = bot.sendMessage.bind(bot);
const originalSendPhoto = bot.sendPhoto.bind(bot);

function translatedMarkup(id, markup) {
  if (!markup || String(id) === ADMIN_ID ||
      getState(id).lang !== 'hy') return markup;

  const copy = JSON.parse(JSON.stringify(markup));

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === 'text' && typeof node[key] === 'string') {
        node[key] = tr(id, node[key]);
      } else if (node[key] && typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(copy);
  return copy;
}

bot.sendMessage = (id, message, options = {}) =>
  originalSendMessage(id, tr(id, message), {
    ...options,
    ...(options.reply_markup
      ? { reply_markup: translatedMarkup(id, options.reply_markup) }
      : {})
  });

bot.sendPhoto = (id, photo, options = {}) =>
  originalSendPhoto(id, photo, {
    ...options,
    ...(typeof options.caption === 'string'
      ? { caption: tr(id, options.caption) }
      : {}),
    ...(options.reply_markup
      ? { reply_markup: translatedMarkup(id, options.reply_markup) }
      : {})
  });

async function chooseLanguage(id) {
  getState(id).step = 'language';

  return originalSendMessage(
    id,
    'Բարի գալուստ Aura Play!\nВыберите язык / Ընտրեք լեզուն:',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🇦🇲 Հայերեն', callback_data: 'language:hy' },
          { text: '🇷🇺 Русский', callback_data: 'language:ru' }
        ]]
      }
    }
  );
}

// ================== КЛАВИАТУРЫ ==================

function menu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '🎮 Забронировать' }, { text: '💰 Посмотреть цены' }],
        [{ text: '👑 VIP-комнаты' }, { text: '📅 Расписание' }],
        [{ text: '📋 Мои заявки' }, { text: 'ℹ️ Информация' }],
        [{ text: '🛠 Техподдержка' }],
        [{ text: '⬅️ Назад' }]
      ],
      resize_keyboard: true
    }
  };
}

function inlineBack(back = 'back') {
  return {
    inline_keyboard: [
      [{ text: '⬅️ Назад', callback_data: back }]
    ]
  };
}

function withBack(rows, back = 'back') {
  return {
    inline_keyboard: [
      ...rows,
      [{ text: '⬅️ Назад', callback_data: back }]
    ]
  };
}

async function sendSection(id, key, message, options = {}) {
  if (photos[key]) {
    try {
      return await bot.sendPhoto(id, photos[key], {
        caption: message,
        parse_mode: 'HTML',
        ...options
      });
    } catch (e) {
      console.error('Ошибка отправки фото:', e.message);
    }
  }

  return bot.sendMessage(id, message, {
    parse_mode: 'HTML',
    ...options
  });
}

function setStep(id, step) {
  const state = getState(id);
  state.step = step;
  return state;
}

// ================== ЦЕНЫ ==================

function getRate(category, hour) {
  const day = hour >= 10 && hour < 20;

  if (category === 'computer' || category === 'ps_normal') {
    return day ? 1000 : 1200;
  }

  if (category === 'ps_vip') {
    return day ? 1200 : 1400;
  }

  return 0;
}

function calculatePrice(category, start, duration) {
  let total = 0;

  for (let i = 0; i < duration; i++) {
    const localHour = new Date(start + i * 3600000 + 14400000)
      .getUTCHours();

    total += getRate(category, localHour);
  }

  return total;
}

// ================== ДАТА И ВРЕМЯ ==================

function formatDate(timestamp) {
  const d = new Date(timestamp + 14400000);

  return [
    String(d.getUTCDate()).padStart(2, '0'),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    d.getUTCFullYear()
  ].join('.') + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0');
}

function formatTime(timestamp) {
  const d = new Date(timestamp + 14400000);

  return String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0');
}

function toArmeniaTimestamp(date, time) {
  const [day, month, year] = date.split('.').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  return Date.UTC(year, month - 1, day, hour, minute) - 14400000;
}

function validDate(date) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return false;

  const [day, month, year] = date.split('.').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));

  return d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day;
}

function validTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;

  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function bookingLeadMs(start) {
  const hour = new Date(start + 14400000).getUTCHours();

  return hour >= 10 && hour < 20
    ? 30 * 60000
    : 3 * 3600000;
}

function leadLabel(start, id) {
  const label = bookingLeadMs(start) === 1800000
    ? '30 минут'
    : '3 часа';

  return getState(id).lang === 'hy'
    ? label === '30 минут' ? '30 րոպե' : '3 ժամ'
    : label;
}

function getNextBookingDate(day, month) {
  const now = new Date(Date.now() + 14400000);

  for (let year = now.getUTCFullYear();
       year <= now.getUTCFullYear() + 2; year++) {
    const d = new Date(Date.UTC(year, month - 1, day));

    if (d.getUTCDate() !== day ||
        d.getUTCMonth() !== month - 1) continue;

    const date = [
      String(day).padStart(2, '0'),
      String(month).padStart(2, '0'),
      year
    ].join('.');

    const endOfDay = toArmeniaTimestamp(date, '23:59');

    if (endOfDay >= Date.now()) return date;
  }

  return null;
}

function findAsset(id) {
  return Object.values(assets).flat().find(a => a.id === id);
}

// ================== БРОНИРОВАНИЯ И БАЗА ==================

function getBookingConflict(assetId, start, end, excludeId = null) {
  return bookings.find(b =>
    b.assetId === assetId &&
    b.id !== excludeId &&
    ['pending', 'approved'].includes(b.status) &&
    start < b.end &&
    end > b.start
  ) || null;
}

function isAvailable(assetId, start, end, excludeId = null) {
  return !getBookingConflict(assetId, start, end, excludeId);
}

function getDaySchedule(assetId, date) {
  const start = toArmeniaTimestamp(date, '10:00');

  const [day, month, year] = date.split('.').map(Number);
  const nextDate = [
    String(day + 1).padStart(2, '0'),
    String(month).padStart(2, '0'),
    year
  ].join('.');

  // Вычисляем начало следующих суток календарным способом.
  const localDate = new Date(Date.UTC(year, month - 1, day) + 86400000);
  const nextCalendarDate = [
    String(localDate.getUTCDate()).padStart(2, '0'),
    String(localDate.getUTCMonth() + 1).padStart(2, '0'),
    localDate.getUTCFullYear()
  ].join('.');

  const end = toArmeniaTimestamp(nextCalendarDate, '05:00');

  const occupied = bookings
    .filter(b =>
      b.assetId === assetId &&
      ['pending', 'approved'].includes(b.status) &&
      b.start < end &&
      b.end > start
    )
    .map(b => ({
      start: Math.max(start, b.start),
      end: Math.min(end, b.end)
    }))
    .sort((a, b) => a.start - b.start);

  const free = [];
  let cursor = start;

  for (const item of occupied) {
    if (item.start > cursor) {
      free.push({ start: cursor, end: item.start });
    }

    cursor = Math.max(cursor, item.end);
  }

  if (cursor < end) free.push({ start: cursor, end });

  return { occupied, free };
}

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) {
    console.error('Ошибка загрузки бронирований:', error.message);
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
    const start = extra.start || toArmeniaTimestamp(date, time);
    const duration = Number(row.duration || extra.duration || 1);

    return {
      ...extra,
      id: Number(row.id),
      chatId: Number(row.telegram_id),
      assetId: row.asset_name,
      date,
      time,
      start,
      end: start + duration * 3600000,
      duration,
      phone: row.phone || extra.phone || '',
      username: row.customer_name || extra.username || 'Клиент',
      status: row.status || 'pending',
      price: Number(extra.price || 0)
    };
  });

  nextBookingId = Math.max(0, ...bookings.map(b => b.id)) + 1;

  console.log(`Загружено бронирований: ${bookings.length}`);
}

async function saveStatus(id, status) {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

// ================== ГЛАВНОЕ МЕНЮ ==================

async function showHome(id) {
  setStep(id, 'menu');

  return sendSection(
    id,
    'home',
    '<b>🎮 Добро пожаловать в Aura Play!</b>\n\n' +
    'Здесь ты можешь забронировать компьютер или PS5 Pro, ' +
    'посмотреть цены и выбрать VIP-комнату.\n\n' +
    `🕒 ${OPEN_TEXT}\n\n` +
    'Выбери нужный раздел в меню.',
    menu()
  );
}

async function showPrices(id) {
  setStep(id, 'prices');

  return sendSection(
    id,
    'prices',
    '<b>💰 ЦЕНЫ AURA PLAY</b>\n\n' +
    '<b>💻 Компьютеры</b>\n' +
    '10:00–20:00 — 1 000 драм/час\n' +
    '20:00–10:00 — 1 200 драм/час\n\n' +
    '<b>🎮 PS5 Pro — обычная зона</b>\n' +
    '10:00–20:00 — 1 000 драм/час\n' +
    '20:00–10:00 — 1 200 драм/час\n\n' +
    '<b>👑 PS5 Pro — VIP-комната</b>\n' +
    '10:00–20:00 — 1 200 драм/час\n' +
    '20:00–10:00 — 1 400 драм/час\n\n' +
    'Итоговая цена рассчитывается по часам бронирования.',
    { reply_markup: inlineBack() }
  );
}

async function showVip(id) {
  setStep(id, 'vip');

  return sendSection(
    id,
    'vip',
    '<b>👑 VIP-КОМНАТЫ AURA PLAY</b>\n\n' +
    '• VIP-комната № 1 — PS5 Pro\n' +
    '• VIP-комната № 2 — PS5 Pro\n\n' +
    '10:00–20:00 — 1 200 драм/час\n' +
    '20:00–10:00 — 1 400 драм/час\n\n' +
    'Забронируй VIP-комнату через меню.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👑 Забронировать VIP', callback_data: 'cat:ps_vip' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }]
        ]
      }
    }
  );
}

async function showSchedule(id) {
  setStep(id, 'schedule');

  return sendSection(
    id,
    'schedule',
    '<b>📅 РАСПИСАНИЕ AURA PLAY</b>\n\n' +
    'Выбери бронирование, чтобы посмотреть занятость ' +
    'конкретного места на выбранную дату.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Проверить свободные места', callback_data: 'booking' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }]
        ]
      }
    }
  );
}

async function showInfo(id) {
  setStep(id, 'info');

  return sendSection(
    id,
    'home',
    '<b>ℹ️ ИНФОРМАЦИЯ AURA PLAY</b>\n\n' +
    `${OPEN_TEXT}\n` +
    'Компьютеры, PS5 Pro и две VIP-комнаты.\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `💬 Telegram: ${SUPPORT_TELEGRAM}`,
    { reply_markup: inlineBack() }
  );
}

async function showHelp(id) {
  setStep(id, 'support');

  return sendSection(
    id,
    'help',
    '<b>🛠 ТЕХПОДДЕРЖКА AURA PLAY</b>\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `💬 Telegram: ${SUPPORT_TELEGRAM}\n\n` +
    'По вопросам бронирования и работы клуба обращайся к нам.',
    { reply_markup: inlineBack() }
  );
}

async function showMyBookings(id) {
  setStep(id, 'mybookings');

  const list = bookings.filter(b => b.chatId === id);

  if (!list.length) {
    return bot.sendMessage(id, '📋 У тебя пока нет заявок.', menu());
  }

  const lines = ['<b>📋 ТВОИ ЗАЯВКИ</b>', ''];

  for (const b of list.slice(-10).reverse()) {
    const asset = findAsset(b.assetId);

    lines.push(
      `<b>Заявка №${b.id}</b>`,
      `Место: ${asset ? asset.name : b.assetId}`,
      `Начало: ${formatDate(b.start)}`,
      `Окончание: ${formatDate(b.end)}`,
      `Длительность: ${b.duration} ч.`,
      `Цена: ${b.price.toLocaleString('ru-RU')} драм`,
      `Статус: ${
        b.status === 'pending' ? '⏳ Ожидает подтверждения' :
        b.status === 'approved' ? '✅ Подтверждена' : '❌ Отклонена'
      }`,
      ''
    );
  }

  return bot.sendMessage(id, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineBack()
  });
}

// ================== БРОНИРОВАНИЕ ==================

function startBooking(id, category = null) {
  const state = getState(id);

  state.step = category ? 'asset' : 'category';
  state.category = category;
  state.assetId = null;
  state.date = null;
  state.day = null;
  state.month = null;
  state.time = null;
  state.duration = null;
  state.phone = null;

  if (category) return showAssets(id, category);

  return bot.sendMessage(id, '🎮 <b>Что хочешь забронировать?</b>', {
    parse_mode: 'HTML',
    reply_markup: withBack([
      [{ text: '💻 Компьютер', callback_data: 'cat:computer' }],
      [{ text: '🎮 PS5 Pro — обычная зона', callback_data: 'cat:ps_normal' }],
      [{ text: '👑 PS5 Pro — VIP-комната', callback_data: 'cat:ps_vip' }]
    ])
  });
}

function showAssets(id, category) {
  const state = getState(id);

  if (!assets[category]) return startBooking(id);

  state.step = 'asset';
  state.category = category;

  return bot.sendMessage(id, 'Выбери конкретное место:', {
    reply_markup: withBack(
      assets[category].map(a => [{
        text: a.name,
        callback_data: `asset:${a.id}`
      }]),
      'back_category'
    )
  });
}

function askDate(id) {
  const state = getState(id);

  state.step = 'date_day';
  state.day = null;
  state.month = null;

  const rows = [];

  for (let i = 1; i <= 31; i += 7) {
    rows.push(
      Array.from({ length: Math.min(7, 32 - i) }, (_, j) => i + j)
        .map(day => ({
          text: String(day),
          callback_data: `date_day:${day}`
        }))
    );
  }

  return bot.sendMessage(id, '📅 Выбери день бронирования:', {
    reply_markup: withBack(rows)
  });
}

function askMonth(id) {
  const state = getState(id);
  state.step = 'date_month';

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель',
    'Май', 'Июнь', 'Июль', 'Август',
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const rows = [];

  for (let i = 0; i < 12; i += 3) {
    rows.push(months.slice(i, i + 3).map((name, j) => ({
      text: name,
      callback_data: `date_month:${i + j + 1}`
    })));
  }

  return bot.sendMessage(id, '🗓️ Теперь выбери месяц:', {
    reply_markup: withBack(rows, 'back_day')
  });
}

function showDurations(id) {
  setStep(id, 'duration');

  const rows = [];

  for (let i = 1; i <= 12; i += 3) {
    rows.push([i, i + 1, i + 2].filter(n => n <= 12).map(n => ({
      text: `${n} ч.`,
      callback_data: `duration:${n}`
    })));
  }

  return bot.sendMessage(id, '⌛ Выбери длительность бронирования:', {
    reply_markup: withBack(rows, 'back_time')
  });
}

function askPhone(id) {
  setStep(id, 'phone');

  return bot.sendMessage(
    id,
    '📱 Напиши свой номер телефона для подтверждения брони.\n\n' +
    'Чтобы вернуться, нажми «⬅️ Назад» в меню.',
    menu()
  );
}

async function showAssetSchedule(id) {
  const state = getState(id);

  if (!state.assetId || !state.date) return askDate(id);

  const asset = findAsset(state.assetId);
  const schedule = getDaySchedule(state.assetId, state.date);

  const lines = [
    `📅 <b>РАСПИСАНИЕ НА ${state.date}</b>`,
    '',
    `🎮 <b>${asset ? asset.name : state.assetId}</b>`,
    '',
    '🔴 <b>ЗАНЯТО:</b>'
  ];

  if (!schedule.occupied.length) {
    lines.push('Пока нет заявок на эту дату.');
  } else {
    for (const item of schedule.occupied) {
      lines.push(`• ${formatTime(item.start)}–${formatTime(item.end)}`);
    }
  }

  lines.push('', '🟢 <b>СВОБОДНО:</b>');

  if (!schedule.free.length) {
    lines.push('Нет свободных промежутков.');
  } else {
    for (const item of schedule.free) {
      lines.push(`• ${formatTime(item.start)}–${formatTime(item.end)}`);
    }
  }

  lines.push('', 'Часы работы: 10:00–05:00.');

  state.step = 'time';

  await bot.sendMessage(id, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: withBack([
      [{ text: '📅 Выбрать другую дату', callback_data: 'back_day' }]
    ])
  });

  return bot.sendMessage(
    id,
    '⏰ Напиши время начала, например 18:00.\n' +
    'Нажми «⬅️ Назад», чтобы выбрать другую дату.',
    menu()
  );
}

// ================== КНОПКА НАЗАД ==================

async function goBack(id, destination = null) {
  const state = getState(id);

  if (destination === 'menu') return showHome(id);

  if (destination === 'back_category') {
    return startBooking(id);
  }

  if (destination === 'back_day') return askDate(id);
  if (destination === 'back_time') return showAssetSchedule(id);

  switch (state.step) {
    case 'menu':
    case 'category':
    case 'prices':
    case 'vip':
    case 'schedule':
    case 'info':
    case 'support':
    case 'mybookings':
      return showHome(id);

    case 'asset':
      return startBooking(id);

    case 'date_day':
      return showAssets(id, state.category);

    case 'date_month':
      return askDate(id);

    case 'time':
      return askDate(id);

    case 'duration':
      return showAssetSchedule(id);

    case 'phone':
      return showDurations(id);

    default:
      return showHome(id);
  }
}

// ================== КОМАНДЫ ==================

bot.onText(/\/start/, msg => chooseLanguage(msg.chat.id));
bot.onText(/\/book/, msg => startBooking(msg.chat.id));
bot.onText(/\/prices/, msg => showPrices(msg.chat.id));
bot.onText(/\/vip/, msg => showVip(msg.chat.id));
bot.onText(/\/schedule/, msg => showSchedule(msg.chat.id));
bot.onText(/\/help/, msg => showHelp(msg.chat.id));
bot.onText(/\/mybookings/, msg => showMyBookings(msg.chat.id));
bot.onText(/\/language/, msg => chooseLanguage(msg.chat.id));

// ================== ТЕКСТОВЫЕ СООБЩЕНИЯ ==================

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const id = msg.chat.id;
  const message = msg.text.trim();
  const state = getState(id);

  try {
    if (message === '🎮 Забронировать') return startBooking(id);
    if (message === '💰 Посмотреть цены') return showPrices(id);
    if (message === '👑 VIP-комнаты') return showVip(id);
    if (message === '📅 Расписание') return showSchedule(id);
    if (message === '📋 Мои заявки') return showMyBookings(id);
    if (message === 'ℹ️ Информация') return showInfo(id);
    if (message === '🛠 Техподдержка') return showHelp(id);
    if (message === '⬅️ Назад') return goBack(id);

    if (state.step === 'time') {
      if (!validTime(message)) {
        return bot.sendMessage(
          id,
          '❌ Введи время в формате ЧЧ:ММ, например 18:00.',
          menu()
        );
      }

      const start = toArmeniaTimestamp(state.date, message);
      const lead = bookingLeadMs(start);

      if (start <= Date.now()) {
        return bot.sendMessage(id, '❌ Это время уже прошло. Выбери другое.', menu());
      }

      if (start - Date.now() < lead) {
        return bot.sendMessage(
          id,
          `❌ До начала должно оставаться минимум ${leadLabel(start, id)}.`,
          menu()
        );
      }

      state.time = message;
      return showDurations(id);
    }

    if (state.step === 'phone') {
      const phone = message.replace(/[^\d+]/g, '');

      if (!/^\+?\d{7,15}$/.test(phone)) {
        return bot.sendMessage(
          id,
          '❌ Проверь номер телефона и введи ещё раз.',
          menu()
        );
      }

      state.phone = phone;

      const start = toArmeniaTimestamp(state.date, state.time);
      const end = start + state.duration * 3600000;

      if (start - Date.now() < bookingLeadMs(start)) {
        return bot.sendMessage(
          id,
          `❌ До начала должно оставаться минимум ${leadLabel(start, id)}. ` +
          'Нажми «Назад» и выбери другое время.',
          menu()
        );
      }

      const conflict = getBookingConflict(state.assetId, start, end);

      if (conflict) {
        return bot.sendMessage(
          id,
          `⚠️ Это место уже занято до ${formatDate(conflict.end)}.\n` +
          'Нажми «⬅️ Назад», чтобы выбрать другое время.',
          menu()
        );
      }

      const asset = findAsset(state.assetId);

      const booking = {
        chatId: id,
        username: msg.from.username
          ? `@${msg.from.username}`
          : (msg.from.first_name || 'Клиент'),
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

      const bookingDate = state.date.split('.').reverse().join('-');

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          telegram_id: id,
          asset_name: state.assetId,
          booking_date: bookingDate,
          start_time: state.time,
          duration: state.duration,
          status: 'pending',
          phone,
          customer_name: booking.username,
          comment: JSON.stringify(booking)
        })
        .select('id')
        .single();

      if (error) {
        console.error('Ошибка сохранения брони:', error.message);
        return bot.sendMessage(
          id,
          'Не удалось сохранить заявку. Попробуй позже.',
          menu()
        );
      }

      booking.id = Number(data.id);
      bookings.push(booking);
      nextBookingId = Math.max(nextBookingId, booking.id + 1);
      state.step = 'menu';

      await bot.sendMessage(
        id,
        `<b>✅ Заявка №${booking.id} создана!</b>\n\n` +
        `Место: ${asset.name}\n` +
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
        `Место: ${asset.name}\n` +
        `Начало: ${formatDate(start)}\n` +
        `Окончание: ${formatDate(end)}\n` +
        `Цена: ${booking.price.toLocaleString('ru-RU')} драм`;

      await bot.sendMessage(ADMIN_ID, adminText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `approve:${booking.id}` },
            { text: '❌ Отклонить', callback_data: `reject:${booking.id}` }
          ]]
        }
      }).catch(e => console.error('Ошибка отправки администратору:', e.message));
    }
  } catch (e) {
    console.error('Ошибка обработки сообщения:', e);

    await bot.sendMessage(
      id,
      'Произошла ошибка. Нажми /start.',
      menu()
    ).catch(() => {});
  }
});

// ================== INLINE-КНОПКИ ==================

bot.on('callback_query', async query => {
  const id = query.message.chat.id;
  const data = query.data || '';
  const state = getState(id);

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === 'language:hy' || data === 'language:ru') {
      state.lang = data === 'language:hy' ? 'hy' : 'ru';
      state.step = 'menu';
      return showHome(id);
    }

    if (data === 'back') return goBack(id);
    if (data === 'back_category') return goBack(id, 'back_category');
    if (data === 'back_day') return goBack(id, 'back_day');
    if (data === 'back_time') return goBack(id, 'back_time');

    if (data === 'booking') return startBooking(id);
    if (data === 'prices') return showPrices(id);
    if (data === 'vip') return showVip(id);
    if (data === 'schedule') return showSchedule(id);
    if (data === 'info') return showInfo(id);
    if (data === 'support') return showHelp(id);
    if (data === 'mybookings') return showMyBookings(id);

    if (data.startsWith('cat:')) {
      const category = data.slice(4);
      if (!assets[category]) return;
      return showAssets(id, category);
    }

    if (data.startsWith('asset:')) {
      const assetId = data.slice(6);

      if (!findAsset(assetId) ||
          !assets[state.category]?.some(a => a.id === assetId)) return;

      state.assetId = assetId;
      return askDate(id);
    }

    if (data.startsWith('date_day:')) {
      if (state.step !== 'date_day') return;

      const day = Number(data.slice(9));
      if (!Number.isInteger(day) || day < 1 || day > 31) return;

      state.day = day;
      return askMonth(id);
    }

    if (data.startsWith('date_month:')) {
      if (state.step !== 'date_month' || !state.day) return;

      const month = Number(data.slice(11));
      if (!Number.isInteger(month) || month < 1 || month > 12) return;

      const date = getNextBookingDate(state.day, month);

      if (!date || !validDate(date)) {
        await bot.sendMessage(id, '❌ Такой даты нет. Выбери другой день.');
        return askDate(id);
      }

      state.month = month;
      state.date = date;
      return showAssetSchedule(id);
    }

    if (data.startsWith('duration:')) {
      if (state.step !== 'duration') return;

      const duration = Number(data.slice(9));
      if (!Number.isInteger(duration) || duration < 1 || duration > 12) return;

      const start = toArmeniaTimestamp(state.date, state.time);
      const end = start + duration * 3600000;

      if (start <= Date.now() ||
          start - Date.now() < bookingLeadMs(start)) {
        await bot.sendMessage(
          id,
          `❌ До начала должно оставаться минимум ${leadLabel(start, id)}.`,
          menu()
        );
        return askDate(id);
      }

      if (!isAvailable(state.assetId, start, end)) {
        await bot.sendMessage(
          id,
          '❌ Это время пересекается с другой заявкой. Выбери другое время.',
          menu()
        );
        return showAssetSchedule(id);
      }

      state.duration = duration;
      return askPhone(id);
    }

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      if (String(query.from.id) !== ADMIN_ID) {
        return bot.answerCallbackQuery(query.id, {
          text: 'Только администратор может это сделать.'
        });
      }

      const [action, idText] = data.split(':');
      const booking = bookings.find(b => b.id === Number(idText));

      if (!booking || booking.status !== 'pending') {
        return bot.sendMessage(ADMIN_ID, 'Заявка уже обработана или не найдена.');
      }

      if (action === 'approve') {
        const conflict = getBookingConflict(
          booking.assetId,
          booking.start,
          booking.end,
          booking.id
        );

        if (conflict) {
          booking.status = 'rejected';
          await saveStatus(booking.id, 'rejected');

          await bot.sendMessage(
            booking.chatId,
            '❌ Заявка не подтверждена: время уже занято. Свяжись с клубом.'
          );

          await bot.sendMessage(
            ADMIN_ID,
            '⚠️ Обнаружено пересечение с другой заявкой.'
          );

          return bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: id, message_id: query.message.message_id }
          );
        }
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      await saveStatus(booking.id, newStatus);
      booking.status = newStatus;

      await bot.sendMessage(
        booking.chatId,
        action === 'approve'
          ? `✅ Бронирование №${booking.id} подтверждено! Ждём тебя в Aura Play.`
          : `❌ Бронирование №${booking.id} отклонено. Свяжись с техподдержкой.`
      );

      return bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: id, message_id: query.message.message_id }
      );
    }
  } catch (e) {
    console.error('Ошибка обработки кнопки:', e);

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      await bot.sendMessage(
        ADMIN_ID,
        'Не удалось обработать заявку. Проверь подключение к Supabase.'
      ).catch(() => {});
    }
  }
});

// ================== ОШИБКИ И ЗАПУСК ==================

bot.on('polling_error', error => {
  console.error('Ошибка Telegram polling:', error.message);
});

process.on('unhandledRejection', error => {
  console.error('Необработанная ошибка:', error);
});

loadBookings()
  .then(() => console.log('Aura Play Booking готов к работе.'))
  .catch(error => console.error('Ошибка запуска:', error));
