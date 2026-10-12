const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
// ========== RENDER ==========
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aura Play Booking is running!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP-сервер запущен на порту ${PORT}`);
});

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');

if (!TOKEN || !ADMIN_ID) {
  throw new Error('Не заданы BOT_TOKEN или ADMIN_ID в настройках Render');
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ========== ДАННЫЕ ==========
const users = new Map();
let bookings = [];
async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) {
    console.error('Ошибка загрузки бронирований:', error.message);
    return;
  }

  bookings = (data || []).map(row => {
    const extra = row.comment ? JSON.parse(row.comment) : {};

    return {
      ...extra,
      id: Number(row.id),
      chatId: Number(row.telegram_id),
      assetId: row.asset_name,
      start: new Date(`${row.booking_date}T${row.start_time}+04:00`).getTime(),
      duration: Number(row.duration),
      status: row.status
    };
  });

  nextBookingId = Math.max(0, ...bookings.map(b => b.id)) + 1;
  console.log(`Загружено бронирований: ${bookings.length}`);
}
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

const photos = {
  home: process.env.PHOTO_HOME || '',
  booking: process.env.PHOTO_BOOKING || '',
  prices: process.env.PHOTO_PRICES || '',
  vip: process.env.PHOTO_VIP || '',
  schedule: process.env.PHOTO_SCHEDULE || '',
  help: process.env.PHOTO_HELP || ''
};

function getState(chatId) {
  if (!users.has(chatId)) {
    users.set(chatId, { step: 'menu', history: [] });
  }
  return users.get(chatId);
}

// ========== ЯЗЫКИ: АРМЯНСКИЙ / РУССКИЙ ==========
const HY_TRANSLATIONS = [
  ['🎮 Добро пожаловать в Aura Play!', '🎮 Բարի գալուստ Aura Play։'],
  ['Здесь ты можешь забронировать компьютер или PS5 Pro, посмотреть цены и выбрать VIP-комнату.', 'Այստեղ կարող եք ամրագրել համակարգիչ կամ PS5 Pro, տեսնել գները և ընտրել VIP սենյակ։'],
  ['🎮 <b>Что хочешь забронировать?</b>', '🎮 <b>Ի՞նչ եք ցանկանում ամրագրել։</b>'],
  ['💰 ЦЕНЫ AURA PLAY', '💰 AURA PLAY-Ի ԳՆԵՐԸ'],
  ['👑 VIP-КОМНАТЫ AURA PLAY', '👑 AURA PLAY-Ի VIP ՍԵՆՅԱԿՆԵՐԸ'],
  ['📅 РАСПИСАНИЕ AURA PLAY', '📅 AURA PLAY-Ի ԺԱՄԱՆԱԿԱՑՈՒՅՑԸ'],
  ['ℹ️ ИНФОРМАЦИЯ AURA PLAY', 'ℹ️ ՏԵՂԵԿՈՒԹՅՈՒՆ AURA PLAY-Ի ՄԱՍԻՆ'],
  ['🛠 ТЕХПОДДЕРЖКА AURA PLAY', '🛠 AURA PLAY-Ի ԱՋԱԿՑՈՒԹՅՈՒՆԸ'],
  ['📋 ТВОИ ЗАЯВКИ', '📋 ՔՈ ՀԱՅՏԵՐԸ'],
  ['Выбери конкретное место:', 'Ընտրեք կոնկրետ տեղը։'],
  ['📅 Выбери день бронирования:', '📅 Ընտրեք ամրագրման օրը։'],
  ['🗓️ Теперь выбери месяц:', '🗓️ Այժմ ընտրեք ամիսը։'],
  ['⌛ Выбери длительность бронирования:', '⌛ Ընտրեք ամրագրման տևողությունը։'],
  ['📱 Напиши свой номер телефона для подтверждения брони.', '📱 Ամրագրումը հաստատելու համար գրեք ձեր հեռախոսահամարը։'],
  ['Чтобы вернуться, нажми «⬅️ Назад» в меню.', 'Վերադառնալու համար սեղմեք «⬅️ Հետ» կոճակը։'],
  ['⏰ Напиши время начала, например 18:00.\\nНажми «⬅️ Назад», чтобы выбрать другую дату.', '⏰ Գրեք մեկնարկի ժամը, օրինակ՝ 18:00։\\nԱյլ ամսաթիվ ընտրելու համար սեղմեք «⬅️ Հետ»։'],
  ['Пока нет заявок на эту дату.', 'Այս ամսաթվի համար հայտեր դեռ չկան։'],
  ['Нет свободных промежутков.', 'Ազատ ժամեր չկան։'],
  ['⚠️ Показан календарный день целиком.', '⚠️ Ցուցադրված է ամբողջ օրացուցային օրը։'],
  ['Часы работы: 10:00–05:00.', 'Աշխատանքային ժամերը՝ 10:00–05:00։'],
  ['Выбери бронирование, чтобы посмотреть занятость конкретного места на выбранную дату.', 'Ընտրեք ամրագրումը՝ ընտրված ամսաթվին տեղերի զբաղվածությունը տեսնելու համար։'],
  ['🎮 Проверить свободные места', '🎮 Ստուգել ազատ տեղերը'],
  ['Заявка уже обработана или не найдена.', 'Հայտն արդեն մշակվել է կամ չի գտնվել։'],
  ['❌ Такой даты нет. Выбери другой день.', '❌ Այդ ամսաթիվը գոյություն չունի։ Ընտրեք այլ օր։'],
  ['❌ Это время уже прошло. Выбери другое.', '❌ Այս ժամը արդեն անցել է։ Ընտրեք մեկ այլ ժամ։'],
  ['❌ Проверь номер телефона и введи ещё раз.', '❌ Ստուգեք հեռախոսահամարը և կրկին մուտքագրեք։'],
  ['❌ Это время пересекается с другой заявкой. Нажми «Назад», чтобы выбрать другое время.', '❌ Այս ժամը համընկնում է մեկ այլ հայտի հետ։ Այլ ժամ ընտրելու համար սեղմեք «Հետ»։'],
  ['⚠️ Это место уже занято до', '⚠️ Այս տեղը զբաղված է մինչև'],
  ['❌ Заявка не подтверждена: время уже занято. Свяжись с клубом.', '❌ Հայտը չի հաստատվել․ այդ ժամը զբաղված է։ Կապվեք ակումբի հետ։'],
  ['⏳ Ожидает подтверждения', '⏳ Սպասում է հաստատման'],
  ['✅ Подтверждена', '✅ Հաստատված է'],
  ['❌ Отклонена', '❌ Մերժված է'],
  ['Статус: ⏳ ожидает подтверждения администратора.', 'Կարգավիճակ՝ ⏳ սպասում է ադմինիստրատորի հաստատմանը։'],
  ['Компьютеры:', 'Համակարգիչներ՝'],
  ['PS5 Pro — обычная зона:', 'PS5 Pro՝ սովորական գոտի՝'],
  ['PS5 Pro — VIP-комната:', 'PS5 Pro՝ VIP սենյակ՝'],
  ['Итоговая цена рассчитывается по часам бронирования.', 'Վերջնական գինը հաշվարկվում է ըստ ամրագրման ժամերի։'],
  ['• VIP-комната № 1 — PS5 Pro', '• VIP սենյակ № 1 — PS5 Pro'],
  ['• VIP-комната № 2 — PS5 Pro', '• VIP սենյակ № 2 — PS5 Pro'],
  ['По вопросам бронирования и работы клуба обращайся к нам.', 'Ամրագրման կամ ակումբի աշխատանքի վերաբերյալ հարցերով կապվեք մեզ հետ։'],
  ['По вопросам бронирования и работы клуба обращайся к нам.', 'Ամրագրման կամ ակումբի աշխատանքի վերաբերյալ հարցերով կապվեք մեզ հետ։'],
  ['📋 У тебя пока нет заявок.', '📋 Դուք դեռ հայտեր չունեք։'],
  ['Заявка №', 'Հայտ №'],
  ['Место:', 'Տեղը՝'],
  ['Начало:', 'Սկիզբը՝'],
  ['Окончание:', 'Ավարտը՝'],
  ['Цена:', 'Գինը՝'],
  ['Длительность:', 'Տևողությունը՝'],
  ['драм', 'դրամ'],
  ['Компьютер № ', 'Համակարգիչ № '],
  ['PS5 Pro — обычная зона № ', 'PS5 Pro՝ սովորական գոտի № '],
  ['PS5 Pro — VIP-комната № ', 'PS5 Pro՝ VIP սենյակ № '],
  ['🎮 Забронировать', '🎮 Ամրագրել'],
  ['💰 Посмотреть цены', '💰 Տեսնել գները'],
  ['👑 VIP-комнаты', '👑 VIP սենյակներ'],
  ['📅 Расписание', '📅 Ժամանակացույց'],
  ['📋 Мои заявки', '📋 Իմ հայտերը'],
  ['ℹ️ Информация', 'ℹ️ Տեղեկություն'],
  ['🛠 Техподдержка', '🛠 Աջակցություն'],
  ['⬅️ Назад', '⬅️ Հետ'],
  ['💻 Компьютер', '💻 Համակարգիչ'],
  ['🎮 PS5 Pro — обычная зона', '🎮 PS5 Pro՝ սովորական գոտի'],
  ['👑 PS5 Pro — VIP-комната', '👑 PS5 Pro՝ VIP սենյակ'],
  ['🎮 Забронировать VIP', '🎮 Ամրագրել VIP'],
  ['📅 Выбрать другую дату', '📅 Ընտրել այլ ամսաթիվ'],
  ['Январь', 'Հունվար'], ['Февраль', 'Փետրվար'], ['Март', 'Մարտ'],
  ['Апрель', 'Ապրիլ'], ['Май', 'Մայիս'], ['Июнь', 'Հունիս'],
  ['Июль', 'Հուլիս'], ['Август', 'Օգոստոս'], ['Сентябрь', 'Սեպտեմբեր'],
  ['Октябрь', 'Հոկտեմբեր'], ['Ноябрь', 'Նոյեմբեր'], ['Декабрь', 'Դեկտեմբեր'],
  ['🔔 НОВАЯ ЗАЯВКА №', '🔔 ՆՈՐ ՀԱՅՏ №'],
  ['Клиент:', 'Հաճախորդ՝'],
  ['Телефон:', 'Հեռախոս՝'],
  ['❌ Введи время в формате ЧЧ:ММ, например 18:00.', '❌ Մուտքագրեք ժամը ԺԺ:ՐՐ ձևաչափով, օրինակ՝ 18:00։'],
  ['❌ Произошла ошибка. Нажми /start.', '❌ Սխալ է տեղի ունեցել։ Սեղմեք /start։'],
  ['Здесь ты можешь забронировать компьютер или PS5 Pro, посмотреть цены и выбрать VIP-комнату.', 'Այստեղ կարող եք ամրագրել համակարգիչ կամ PS5 Pro, տեսնել գները և ընտրել VIP սենյակ։'],
  ['📅 <b>РАСПИСАНИЕ НА ', '📅 <b>ԺԱՄԱՆԱԿԱՑՈՒՅՑԸ՝ '],
  ['🔴 <b>ЗАНЯТО:</b>', '🔴 <b>ԶԲԱՂՎԱԾ Է՝</b>'],
  ['🟢 <b>СВОБОДНО:</b>', '🟢 <b>ԱԶԱՏ Է՝</b>'],
  ['⏰ Напиши время начала, например 18:00.', '⏰ Գրեք մեկնարկի ժամը, օրինակ՝ 18:00։'],
  ['Нажми «⬅️ Назад», чтобы выбрать другую дату.', 'Այլ ամսաթիվ ընտրելու համար սեղմեք «⬅️ Հետ»։'],
  ['❌ До начала должно оставаться минимум ', '❌ Մինչև մեկնարկը պետք է մնա առնվազն '],
  ['Нажми «Назад» и выбери другое время.', 'Սեղմեք «Հետ» և ընտրեք այլ ժամ։'],
  ['❌ До начала должно оставаться минимум ', '❌ Մինչև մեկնարկը պետք է մնա առնվազն '],
  ['❌ Бронирование №', '❌ Ամրագրում №'],
  ['создана!', 'ստեղծված է։'],
  ['Заявка №', 'Հայտ №'],
  ['ожидает подтверждения администратора.', 'սպասում է ադմինիստրատորի հաստատմանը։'],
  ['✅ Бронирование №', '✅ Ամրագրում №'],
  ['подтверждено! Ждём тебя в Aura Play.', 'հաստատված է։ Սպասում ենք քեզ Aura Play-ում։'],
  ['отклонено. Свяжись с техподдержкой.', 'մերժվել է։ Կապվեք աջակցության հետ։'],
  ['🔔 НОВАЯ ЗАЯВКА №', '🔔 ՆՈՐ ՀԱՅՏ №'],
  ['⏳ ожидает подтверждения администратора.', '⏳ սպասում է ադմինիստրատորի հաստատմանը։'],
  ['Нужно оформить заявку минимум за ', 'Հայտը պետք է ներկայացնել առնվազն '],
  ['часа до начала.', ' ժամ առաջ։'],
  ['❌ Это место уже занято до ', '❌ Այս տեղը զբաղված է մինչև '],
  ['Нажми «⬅️ Назад», чтобы выбрать другое время.', 'Այլ ժամ ընտրելու համար սեղմեք «⬅️ Հետ»։'],
  ['⚠️ Обнаружено пересечение с другой заявкой.', '⚠️ Հայտնաբերվել է համընկնում մեկ այլ հայտի հետ։'],
  ['Только администратор может это сделать.', 'Միայն ադմինիստրատորը կարող է դա անել։'],
  ['🎮 <b>Что хочешь забронировать?</b>', '🎮 <b>Ի՞նչ եք ցանկանում ամրագրել։</b>'],
  ['Выбери другое время.', 'Ընտրեք այլ ժամ։'],
  ['Свяжись с клубом.', 'Կապվեք ակումբի հետ։'],
  ['Выбери день бронирования:', 'Ընտրեք ամրագրման օրը։'],
  ['Выбери месяц:', 'Ընտրեք ամիսը։']
];

function translateText(chatId, value) {
  if (String(chatId) === ADMIN_ID || getState(chatId).lang !== 'hy' || typeof value !== 'string') {
    return value;
  }

  let result = value;

  for (const [ru, hy] of HY_TRANSLATIONS) {
    result = result.split(ru).join(hy);
  }

  result = result
    .replace(/Ежедневно: 10:00–05:00/g, 'Ամեն օր՝ 10:00–05:00')
    .replace(/10:00–20:00 — ([0-9, ]+) դրամ[/]час/g, '10:00–20:00 — $1 դրամ/ժամ')
    .replace(/20:00–10:00 — ([0-9, ]+) դրամ[/]час/g, '20:00–10:00 — $1 դրամ/ժամ')
    .replace(/([0-9]+) ч[.]/g, '$1 ժ.')
    .replace(/Ожидает подтверждения/g, 'Սպասում է հաստատման')
    .replace(/Подтверждена/g, 'Հաստատված է')
    .replace(/Отклонена/g, 'Մերժված է')
    .replace(/Заявка №([0-9]+)/g, 'Հայտ №$1');

  return result;
}

function translateMarkup(chatId, markup) {
  if (!markup || String(chatId) === ADMIN_ID || getState(chatId).lang !== 'hy') return markup;

  const copy = JSON.parse(JSON.stringify(markup));

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);

    for (const key of Object.keys(node)) {
      if (key === 'text' && typeof node[key] === 'string') {
        node[key] = translateText(chatId, node[key]);
      } else if (node[key] && typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(copy);
  return copy;
}

const originalSendMessage = bot.sendMessage.bind(bot);

bot.sendMessage = (chatId, text, options = {}) => originalSendMessage(
  chatId,
  translateText(chatId, text),
  {
    ...options,
    ...(options.reply_markup
      ? { reply_markup: translateMarkup(chatId, options.reply_markup) }
      : {})
  }
);

const originalSendPhoto = bot.sendPhoto.bind(bot);

bot.sendPhoto = (chatId, photo, options = {}) => originalSendPhoto(
  chatId,
  photo,
  {
    ...options,
    ...(typeof options.caption === 'string'
      ? { caption: translateText(chatId, options.caption) }
      : {}),
    ...(options.reply_markup
      ? { reply_markup: translateMarkup(chatId, options.reply_markup) }
      : {})
  }
);

async function chooseLanguage(chatId) {
  const state = getState(chatId);
  state.step = 'language';

  return originalSendMessage(
    chatId,
    'Բարի գալուստ Aura Play!\nԽնդրում ենք ընտրել լեզուն / Пожалуйста, выберите язык:',
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

function findAsset(id) {
  return Object.values(assets).flat().find(a => a.id === id);
}

function setStep(chatId, step) {
  const state = getState(chatId);
  state.step = step;
  return state;
}

// ========== КЛАВИАТУРЫ ==========
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

// ========== ЦЕНЫ ==========
function getRate(category, hour) {
  const daytime = hour >= 10 && hour < 20;

  if (category === 'computer') return daytime ? 1000 : 1200;
  if (category === 'ps_normal') return daytime ? 1000 : 1200;
  if (category === 'ps_vip') return daytime ? 1200 : 1400;

  return 0;
}

function calculatePrice(category, start, duration) {
  let total = 0;
  const end = start + duration * 3600000;

  for (let t = start; t < end; t += 3600000) {
    const d = new Date(t + 4 * 3600000);
    total += getRate(category, d.getUTCHours());
  }

  return total;
}

// ========== ДАТА И ВРЕМЯ ==========
function formatDate(timestamp) {
  const d = new Date(timestamp + 4 * 3600000);

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hour}:${min}`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp + 4 * 3600000);

  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes()
  ).padStart(2, '0')}`;
}

function toArmeniaTimestamp(date, time) {
  const [day, month, year] = date.split('.').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  return Date.UTC(year, month - 1, day, hour, minute) - 4 * 3600000;
}

function validDate(date) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return false;

  const [day, month, year] = date.split('.').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
}

function validTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;

  const [h, m] = time.split(':').map(Number);

  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function bookingLeadMs(startTimestamp) {
  const d = new Date(startTimestamp + 4 * 3600000);
  const hour = d.getUTCHours();

  return hour >= 10 && hour < 20
    ? 30 * 60 * 1000
    : 3 * 60 * 60 * 1000;
}

function bookingLeadLabel(startTimestamp, chatId) {
  const daytime = bookingLeadMs(startTimestamp) === 30 * 60 * 1000;

  if (getState(chatId).lang === 'hy') {
    return daytime ? '30 րոպե' : '3 ժամ';
  }

  return daytime ? '30 минут' : '3 часа';
}

function getNextBookingDate(day, month) {
  const now = new Date(Date.now() + 4 * 3600000);

  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  for (
    let year = now.getUTCFullYear();
    year <= now.getUTCFullYear() + 8;
    year++
  ) {
    const candidate = new Date(Date.UTC(year, month - 1, day));

    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) continue;

    if (candidate.getTime() >= today) {
      return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    }
  }

  return null;
}

function getDateRange(date) {
  const [day, month, year] = date.split('.').map(Number);
  const start = Date.UTC(year, month - 1, day) - 4 * 3600000;

  return { start, end: start + 24 * 3600000 };
}

// ========== ЗАНЯТОСТЬ ==========
function getBookingConflict(assetId, start, end, excludeId = null) {
  const active = bookings.filter(b =>
    b.id !== excludeId &&
    b.assetId === assetId &&
    ['pending', 'approved'].includes(b.status)
  );

  const conflicts = active.filter(b => start < b.end && end > b.start);

  if (!conflicts.length) return null;

  let occupiedUntil = Math.max(...conflicts.map(b => b.end));
  let changed = true;

  while (changed) {
    changed = false;

    for (const b of active) {
      if (b.start < occupiedUntil && b.end > start && b.end > occupiedUntil) {
        occupiedUntil = b.end;
        changed = true;
      }
    }
  }

  return { occupiedUntil };
}

function isAvailable(assetId, start, end) {
  return !getBookingConflict(assetId, start, end);
}

function getDaySchedule(assetId, date) {
  const { start: dayStart, end: dayEnd } = getDateRange(date);

  const occupied = bookings
    .filter(b =>
      b.assetId === assetId &&
      ['pending', 'approved'].includes(b.status) &&
      b.start < dayEnd &&
      b.end > dayStart
    )
    .map(b => ({
      start: Math.max(b.start, dayStart),
      end: Math.min(b.end, dayEnd)
    }))
    .sort((a, b) => a.start - b.start);

  const merged = [];

  for (const interval of occupied) {
    const last = merged[merged.length - 1];

    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  const free = [];
  let cursor = dayStart;

  for (const interval of merged) {
    if (cursor < interval.start) {
      free.push({ start: cursor, end: interval.start });
    }

    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });

  return { occupied: merged, free };
}

// ========== РАЗДЕЛЫ ==========
async function showHome(chatId) {
  setStep(chatId, 'menu');

  await sendSection(
    chatId,
    'home',
    '<b>🎮 Добро пожаловать в Aura Play!</b>\n\n' +
    'Здесь ты можешь забронировать компьютер или PS5 Pro, посмотреть цены и выбрать VIP-комнату.',
    menu()
  );
}

async function showPrices(chatId) {
  setStep(chatId, 'prices');

  const text = [
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

  await sendSection(chatId, 'prices', text, {
    reply_markup: inlineBack()
  });
}

async function showVip(chatId) {
  setStep(chatId, 'vip');

  await sendSection(
    chatId,
    'vip',
    '<b>👑 VIP-КОМНАТЫ AURA PLAY</b>\n\n' +
    '• VIP-комната № 1 — PS5 Pro\n' +
    '• VIP-комната № 2 — PS5 Pro\n\n' +
    '10:00–20:00 — 1 200 драм/час\n' +
    '20:00–10:00 — 1 400 драм/час',
    {
      reply_markup: withBack([
        [{ text: '🎮 Забронировать VIP', callback_data: 'cat:ps_vip' }]
      ])
    }
  );
}

async function showSchedule(chatId) {
  setStep(chatId, 'schedule');

  await sendSection(
    chatId,
    'schedule',
    '<b>📅 РАСПИСАНИЕ AURA PLAY</b>\n\n' +
    `${OPEN_TEXT}\n\n` +
    'Выбери бронирование, чтобы посмотреть занятость конкретного места на выбранную дату.',
    {
      reply_markup: withBack([
        [{ text: '🎮 Проверить свободные места', callback_data: 'booking' }]
      ])
    }
  );
}

async function showInfo(chatId) {
  setStep(chatId, 'info');

  await sendSection(
    chatId,
    'home',
    '<b>ℹ️ ИНФОРМАЦИЯ AURA PLAY</b>\n\n' +
    `${OPEN_TEXT}\n` +
    'Компьютеры, PS5 Pro и две VIP-комнаты.\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `💬 Telegram: ${SUPPORT_TELEGRAM}`,
    { reply_markup: inlineBack() }
  );
}

async function showHelp(chatId) {
  setStep(chatId, 'support');

  await sendSection(
    chatId,
    'help',
    '<b>🛠 ТЕХПОДДЕРЖКА AURA PLAY</b>\n\n' +
    `📞 Телефон: ${SUPPORT_PHONE}\n` +
    `💬 Telegram: ${SUPPORT_TELEGRAM}\n\n` +
    'По вопросам бронирования и работы клуба обращайся к нам.',
    { reply_markup: inlineBack() }
  );
}

async function showMyBookings(chatId) {
  setStep(chatId, 'mybookings');

  const list = bookings.filter(b => b.chatId === chatId);

  if (!list.length) {
    return bot.sendMessage(chatId, '📋 У тебя пока нет заявок.', {
      ...menu()
    });
  }

  const lines = ['<b>📋 ТВОИ ЗАЯВКИ</b>', ''];

  for (const b of list.slice(-10).reverse()) {
    const asset = findAsset(b.assetId);

    lines.push(
      `Заявка №${b.id}`,
      `Место: ${asset ? asset.name : b.assetId}`,
      `Начало: ${formatDate(b.start)}`,
      `Окончание: ${formatDate(b.end)}`,
      `Цена: ${b.price.toLocaleString('ru-RU')} драм`,
      `Статус: ${
        b.status === 'pending' ? '⏳ Ожидает подтверждения' :
        b.status === 'approved' ? '✅ Подтверждена' : '❌ Отклонена'
      }`,
      ''
    );
  }

  return bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineBack()
  });
}

// ========== БРОНИРОВАНИЕ ==========
function startBooking(chatId, category = null) {
  const state = getState(chatId);

  state.step = category ? 'asset' : 'category';
  state.category = category || null;
  state.assetId = null;
  state.date = null;
  state.day = null;
  state.month = null;
  state.time = null;
  state.duration = null;
  state.phone = null;

  const rows = [
    [{ text: '💻 Компьютер', callback_data: 'cat:computer' }],
    [{ text: '🎮 PS5 Pro — обычная зона', callback_data: 'cat:ps_normal' }],
    [{ text: '👑 PS5 Pro — VIP-комната', callback_data: 'cat:ps_vip' }]
  ];

  if (category) return showAssets(chatId, category);

  return bot.sendMessage(chatId, '🎮 <b>Что хочешь забронировать?</b>', {
    parse_mode: 'HTML',
    reply_markup: withBack(rows)
  });
}

function showAssets(chatId, category) {
  const state = getState(chatId);

  state.step = 'asset';
  state.category = category;

  const rows = assets[category].map(a => [{
    text: a.name,
    callback_data: `asset:${a.id}`
  }]);

  return bot.sendMessage(chatId, 'Выбери конкретное место:', {
    reply_markup: withBack(rows, 'back_category')
  });
}

function askDate(chatId) {
  const state = getState(chatId);

  state.step = 'date_day';
  state.day = null;
  state.month = null;

  const rows = [];

  for (let i = 1; i <= 31; i += 7) {
    rows.push(
      Array.from({ length: Math.min(7, 32 - i) }, (_, index) => i + index)
        .map(day => ({
          text: String(day),
          callback_data: `date_day:${day}`
        }))
    );
  }

  return bot.sendMessage(chatId, '📅 Выбери день бронирования:', {
    reply_markup: withBack(rows)
  });
}

function askMonth(chatId) {
  const state = getState(chatId);

  state.step = 'date_month';

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель',
    'Май', 'Июнь', 'Июль', 'Август',
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const rows = [];

  for (let i = 0; i < 12; i += 3) {
    rows.push(months.slice(i, i + 3).map((name, index) => ({
      text: name,
      callback_data: `date_month:${i + index + 1}`
    })));
  }

  return bot.sendMessage(chatId, '🗓️ Теперь выбери месяц:', {
    reply_markup: withBack(rows, 'back_day')
  });
}

function showDurations(chatId) {
  const state = getState(chatId);

  state.step = 'duration';

  const rows = [];

  for (let i = 1; i <= 12; i += 3) {
    rows.push(
      [i, i + 1, i + 2].filter(n => n <= 12).map(n => ({
        text: `${n} ч.`,
        callback_data: `duration:${n}`
      }))
    );
  }

  return bot.sendMessage(chatId, '⌛ Выбери длительность бронирования:', {
    reply_markup: withBack(rows, 'back_time')
  });
}

function askPhone(chatId) {
  setStep(chatId, 'phone');

  return bot.sendMessage(
    chatId,
    '📱 Напиши свой номер телефона для подтверждения брони.\n\n' +
    'Чтобы вернуться, нажми «⬅️ Назад» в меню.',
    menu()
  );
}

async function showAssetSchedule(chatId) {
  const state = getState(chatId);

  if (!state.assetId || !state.date) return askDate(chatId);

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
    for (const interval of schedule.occupied) {
      lines.push(`• ${formatTime(interval.start)}–${formatTime(interval.end)}`);
    }
  }

  lines.push('', '🟢 <b>СВОБОДНО:</b>');

  if (!schedule.free.length) {
    lines.push('Нет свободных промежутков.');
  } else {
    for (const interval of schedule.free) {
      lines.push(`• ${formatTime(interval.start)}–${formatTime(interval.end)}`);
    }
  }

  lines.push(
    '',
    '⚠️ Показан календарный день целиком.',
    'Часы работы: 10:00–05:00.'
  );

  state.step = 'time';

  return bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: withBack([
      [{ text: '📅 Выбрать другую дату', callback_data: 'back_day' }]
    ])
  }).then(() => bot.sendMessage(
    chatId,
    '⏰ Напиши время начала, например 18:00.\nНажми «⬅️ Назад», чтобы выбрать другую дату.',
    menu()
  ));
}

// ========== НАЗАД ==========
async function goBack(chatId, destination = null) {
  const state = getState(chatId);

  if (destination === 'menu') return showHome(chatId);

  if (destination === 'back_category') {
    state.step = 'category';

    return bot.sendMessage(chatId, '🎮 Выбери категорию:', {
      reply_markup: withBack([
        [{ text: '💻 Компьютер', callback_data: 'cat:computer' }],
        [{ text: '🎮 PS5 Pro — обычная зона', callback_data: 'cat:ps_normal' }],
        [{ text: '👑 PS5 Pro — VIP-комната', callback_data: 'cat:ps_vip' }]
      ])
    });
  }

  if (destination === 'back_day') return askDate(chatId);
  if (destination === 'back_time') return showAssetSchedule(chatId);

  switch (state.step) {
    case 'menu':
      return showHome(chatId);

    case 'category':
      return showHome(chatId);

    case 'asset':
      return goBack(chatId, 'back_category');

    case 'date_day':
      return showAssets(chatId, state.category);

    case 'date_month':
      return askDate(chatId);

    case 'time':
      return askDate(chatId);

    case 'duration':
      return showAssetSchedule(chatId);

    case 'phone':
      return showDurations(chatId);

    case 'prices':
    case 'vip':
    case 'schedule':
    case 'info':
    case 'support':
    case 'mybookings':
      return showHome(chatId);

    default:
      return showHome(chatId);
  }
}

// ========== КОМАНДЫ ==========
bot.onText(/\/start/, msg => chooseLanguage(msg.chat.id));
bot.onText(/\/book/, msg => startBooking(msg.chat.id));
bot.onText(/\/prices/, msg => showPrices(msg.chat.id));
bot.onText(/\/vip/, msg => showVip(msg.chat.id));
bot.onText(/\/schedule/, msg => showSchedule(msg.chat.id));
bot.onText(/\/help/, msg => showHelp(msg.chat.id));
bot.onText(/\/mybookings/, msg => showMyBookings(msg.chat.id));
bot.onText(/\/language/, msg => chooseLanguage(msg.chat.id));

// ========== ТЕКСТОВЫЕ СООБЩЕНИЯ ==========
bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const state = getState(chatId);

  try {
    if (text === '🎮 Забронировать') return startBooking(chatId);
    if (text === '💰 Посмотреть цены') return showPrices(chatId);
    if (text === '👑 VIP-комнаты') return showVip(chatId);
    if (text === '📅 Расписание') return showSchedule(chatId);
    if (text === '📋 Мои заявки') return showMyBookings(chatId);
    if (text === 'ℹ️ Информация') return showInfo(chatId);
    if (text === '🛠 Техподдержка') return showHelp(chatId);
    if (text === '⬅️ Назад') return goBack(chatId);

    if (state.step === 'time') {
      if (!validTime(text)) {
        return bot.sendMessage(
          chatId,
          '❌ Введи время в формате ЧЧ:ММ, например 18:00.',
          menu()
        );
      }

      const start = toArmeniaTimestamp(state.date, text);
      const leadMs = bookingLeadMs(start);

      if (start <= Date.now()) {
        return bot.sendMessage(
          chatId,
          '❌ Это время уже прошло. Выбери другое.',
          menu()
        );
      }

      if (start - Date.now() < leadMs) {
        return bot.sendMessage(
          chatId,
          `❌ До начала должно оставаться минимум ${bookingLeadLabel(start, chatId)}.`,
          menu()
        );
      }

      state.time = text;
      return showDurations(chatId);
    }

    if (state.step === 'phone') {
      const phone = text.replace(/[^\d+]/g, '');

      if (!/^\+?\d{7,15}$/.test(phone)) {
        return bot.sendMessage(
          chatId,
          '❌ Проверь номер телефона и введи ещё раз.',
          menu()
        );
      }

      state.phone = phone;

      const start = toArmeniaTimestamp(state.date, state.time);
      const end = start + state.duration * 3600000;
      const leadMs = bookingLeadMs(start);

      if (start - Date.now() < leadMs) {
        return bot.sendMessage(
          chatId,
          `❌ До начала должно оставаться минимум ${bookingLeadLabel(start, chatId)}. Нажми «Назад» и выбери другое время.`,
          menu()
        );
      }

      const conflict = getBookingConflict(state.assetId, start, end);

      if (conflict) {
        return bot.sendMessage(
          chatId,
          `⚠️ Это место уже занято до ${formatDate(conflict.occupiedUntil)}.\nНажми «⬅️ Назад», чтобы выбрать другое время.`,
          menu()
        );
      }

      const asset = findAsset(state.assetId);

      const booking = {
        id: nextBookingId++,
        chatId,
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

      bookings.push(booking);
      state.step = 'menu';

      await bot.sendMessage(
        chatId,
        `✅ <b>Заявка №${booking.id} создана!</b>\n\n` +
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
    console.error('Ошибка сообщения:', e.message);

    await bot.sendMessage(
      chatId,
      'Произошла ошибка. Нажми /start.',
      menu()
    );
  }
});

// ========== INLINE-КНОПКИ ==========
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const state = getState(chatId);

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === 'language:hy' || data === 'language:ru') {
      state.lang = data === 'language:hy' ? 'hy' : 'ru';
      state.step = 'menu';
      return showHome(chatId);
    }

    if (data === 'back') return goBack(chatId);
    if (data === 'back_category') return goBack(chatId, 'back_category');
    if (data === 'back_day') return goBack(chatId, 'back_day');
    if (data === 'back_time') return goBack(chatId, 'back_time');

    if (data === 'booking') return startBooking(chatId);
    if (data === 'prices') return showPrices(chatId);
    if (data === 'vip') return showVip(chatId);
    if (data === 'schedule') return showSchedule(chatId);
    if (data === 'info') return showInfo(chatId);
    if (data === 'support') return showHelp(chatId);
    if (data === 'mybookings') return showMyBookings(chatId);

    if (data.startsWith('cat:')) {
      const category = data.slice(4);

      if (!assets[category]) return;

      state.category = category;
      state.step = 'asset';

      return showAssets(chatId, category);
    }

    if (data.startsWith('asset:')) {
      const assetId = data.slice(6);
      const asset = findAsset(assetId);

      if (!asset || !assets[state.category]?.some(a => a.id === assetId)) return;

      state.assetId = assetId;
      state.step = 'date_day';

      return askDate(chatId);
    }

    if (data.startsWith('date_day:')) {
      if (state.step !== 'date_day') return;

      const day = Number(data.slice(9));

      if (!Number.isInteger(day) || day < 1 || day > 31) return;

      state.day = day;

      return askMonth(chatId);
    }

    if (data.startsWith('date_month:')) {
      if (state.step !== 'date_month' || !state.day) return;

      const month = Number(data.slice(11));

      if (!Number.isInteger(month) || month < 1 || month > 12) return;

      const date = getNextBookingDate(state.day, month);

      if (!date || !validDate(date)) {
        await bot.sendMessage(chatId, '❌ Такой даты нет. Выбери другой день.');
        return askDate(chatId);
      }

      state.month = month;
      state.date = date;

      return showAssetSchedule(chatId);
    }

    if (data.startsWith('duration:')) {
      if (state.step !== 'duration') return;

      const duration = Number(data.slice(9));

      if (!Number.isInteger(duration) || duration < 1 || duration > 12) return;

      const start = toArmeniaTimestamp(state.date, state.time);
      const end = start + duration * 3600000;

      if (!isAvailable(state.assetId, start, end)) {
        await bot.sendMessage(
          chatId,
          '❌ Это время пересекается с другой заявкой. Нажми «Назад», чтобы выбрать другое время.',
          menu()
        );

        return;
      }

      state.duration = duration;

      return askPhone(chatId);
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

          await bot.sendMessage(
            booking.chatId,
            '❌ Заявка не подтверждена: время уже занято. Свяжись с клубом.'
          );

          return bot.sendMessage(
            ADMIN_ID,
            '⚠️ Обнаружено пересечение с другой заявкой.'
          );
        }
      }

      booking.status = action === 'approve' ? 'approved' : 'rejected';

      await bot.sendMessage(
        booking.chatId,
        action === 'approve'
          ? `✅ Бронирование №${booking.id} подтверждено! Ждём тебя в Aura Play.`
          : `❌ Бронирование №${booking.id} отклонено. Свяжись с техподдержкой.`
      );

      return bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    }
  } catch (e) {
    console.error('Ошибка кнопки:', e.message);

    try {
      await bot.answerCallbackQuery(query.id);
    } catch (_) {}
  }
});

bot.on('polling_error', error => {
  console.error('Ошибка Telegram:', error.message);
});

console.log('Aura Play Booking запущен.');
