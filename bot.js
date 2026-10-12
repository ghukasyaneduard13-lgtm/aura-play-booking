require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// ==================== НАСТРОЙКИ ====================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Ошибка: проверь BOT_TOKEN, ADMIN_ID, SUPABASE_URL и SUPABASE_KEY в Render.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUPPORT_PHONE = '041780737';
const SUPPORT_TELEGRAM = '@Aura_Pllay';

const OPEN_HOUR = 10;
const CLOSE_HOUR = 5;

const ASSETS = [
  { id: 'PC1', ru: '💻 Компьютер 1', hy: '💻 Համակարգիչ 1', type: 'pc' },
  { id: 'PC2', ru: '💻 Компьютер 2', hy: '💻 Համակարգիչ 2', type: 'pc' },
  { id: 'PC3', ru: '💻 Компьютер 3', hy: '💻 Համակարգիչ 3', type: 'pc' },
  { id: 'PC4', ru: '💻 Компьютер 4', hy: '💻 Համակարգիչ 4', type: 'pc' },
  { id: 'PC5', ru: '💻 Компьютер 5', hy: '💻 Համակարգիչ 5', type: 'pc' },
  { id: 'PS5_1', ru: '🎮 PlayStation 5', hy: '🎮 PlayStation 5', type: 'ps5' },
  { id: 'PS5_2', ru: '🎮 PlayStation 5 №2', hy: '🎮 PlayStation 5 №2', type: 'ps5' },
  { id: 'VIP1', ru: '👑 VIP-комната 1', hy: '👑 VIP սենյակ 1', type: 'vip' },
  { id: 'VIP2', ru: '👑 VIP-комната 2', hy: '👑 VIP սենյակ 2', type: 'vip' }
];

const TEXT = {
  ru: {
    welcome: '🎮 Добро пожаловать в Aura Play!\n\nЗдесь ты можешь забронировать компьютер, PlayStation 5 или VIP-комнату.',
    chooseLanguage: '🌐 Выбери язык / Ընտրեք լեզուն',
    languageSaved: '✅ Язык выбран: русский.',
    menu: 'Выбери нужный раздел:',
    book: '🎮 Забронировать',
    prices: '💰 Посмотреть цены',
    vip: '👑 VIP-комнаты',
    schedule: '📅 Расписание',
    myBookings: '📋 Мои заявки',
    info: 'ℹ️ Информация',
    support: '🛠 Техподдержка',
    back: '⬅️ Назад',
    chooseAsset: '🎮 Что хочешь забронировать?',
    chooseDate: '📅 Введи дату бронирования в формате ГГГГ-ММ-ДД.\nНапример: 2026-10-20',
    chooseTime: '🕒 Введи время начала в формате ЧЧ:ММ.\nНапример: 18:30',
    chooseDuration: '⏳ Выбери продолжительность:',
    enterName: '👤 Введи своё имя:',
    enterPhone: '📱 Введи номер телефона для связи:',
    enterComment: '📝 Напиши комментарий или отправь 0, если комментарий не нужен.',
    bookingCreated: '✅ Заявка отправлена администратору!\n\nНомер заявки: #',
    bookingFailed: '❌ Не удалось сохранить заявку. Попробуй ещё раз позже.',
    invalidDate: '❌ Неверная дата. Введи дату в формате ГГГГ-ММ-ДД. Дата должна быть сегодня или позже.',
    invalidTime: '❌ Неверное время. Введи время в формате ЧЧ:ММ, например 19:30.',
    invalidDuration: '❌ Выбери продолжительность кнопкой ниже.',
    invalidPhone: '❌ Введи корректный номер телефона.',
    invalidName: '❌ Введи имя, содержащее хотя бы 2 символа.',
    invalidComment: '❌ Напиши комментарий или отправь 0.',
    noBookings: '📋 У тебя пока нет заявок.',
    myBookings: '📋 Твои заявки:',
    pending: '⏳ Ожидает подтверждения',
    approved: '✅ Подтверждена',
    rejected: '❌ Отклонена',
    adminNew: '🔔 НОВАЯ ЗАЯВКА',
    customer: 'Клиент',
    phone: 'Телефон',
    asset: 'Объект',
    date: 'Дата',
    time: 'Начало',
    duration: 'Продолжительность',
    price: 'Стоимость',
    comment: 'Комментарий',
    approve: '✅ Подтвердить',
    reject: '❌ Отклонить',
    bookingApproved: '✅ Твоя бронь подтверждена!',
    bookingRejected: '❌ К сожалению, заявка отклонена. Свяжись с нами, чтобы выбрать другое время.',
    adminApproved: 'Заявка подтверждена.',
    adminRejected: 'Заявка отклонена.',
    notFound: 'Заявка не найдена.',
    alreadyProcessed: 'Эта заявка уже обработана.',
    conflict: '⚠️ На это время объект уже забронирован. Заявка отклонена.',
    pricesText: '💰 ЦЕНЫ AURA PLAY\n\n💻 Компьютеры и обычная PS5:\n• 10:00–20:00 — 1000 ֏/час\n• 20:00–10:00 — 1200 ֏/час\n\n👑 VIP-комнаты:\n• 10:00–20:00 — 1200 ֏/час\n• 20:00–10:00 — 1400 ֏/час\n\nИтоговая стоимость зависит от времени бронирования.',
    vipText: '👑 VIP-комнаты Aura Play\n\nУ нас доступны две VIP-комнаты.\n\n💰 10:00–20:00 — 1200 ֏/час\n🌙 20:00–10:00 — 1400 ֏/час\n\nНажми «Забронировать», чтобы выбрать комнату.',
    scheduleText: '📅 Бронирование доступно ежедневно с 10:00 до 05:00 следующего дня.\n\nЧтобы проверить доступность конкретного времени, создай заявку — администратор подтвердит её.',
    infoText: 'ℹ️ AURA PLAY\n\n🎮 Компьютеры, PlayStation 5 и VIP-комнаты.\n🕙 Работаем ежедневно: 10:00–05:00.\n\n📱 Телефон: ' + SUPPORT_PHONE + '\n💬 Telegram: ' + SUPPORT_TELEGRAM,
    supportText: '🛠 Поддержка Aura Play\n\n📱 Телефон: ' + SUPPORT_PHONE + '\n💬 Telegram: ' + SUPPORT_TELEGRAM,
    cancelled: 'Действие отменено.',
    durationButton: n => `${n} ч.`,
    hours: n => `${n} ч.`,
    status: 'Статус',
    help: 'Команды:\n/start — главное меню\n/book — забронировать\n/prices — цены\n/vip — VIP-комнаты\n/schedule — расписание\n/mybookings — мои заявки\n/language — сменить язык',
    adminOnly: 'Эта команда доступна только администратору.',
    databaseError: 'Ошибка базы данных. Проверь настройки Supabase.'
  },

  hy: {
    welcome: '🎮 Բարի գալուստ Aura Play։\n\nԱյստեղ կարող ես ամրագրել համակարգիչ, PlayStation 5 կամ VIP սենյակ։',
    chooseLanguage: '🌐 Ընտրիր լեզուն / Выбери язык',
    languageSaved: '✅ Լեզուն ընտրված է՝ հայերեն։',
    menu: 'Ընտրիր անհրաժեշտ բաժինը։',
    book: '🎮 Ամրագրել',
    prices: '💰 Տեսնել գները',
    vip: '👑 VIP սենյակներ',
    schedule: '📅 Ժամանակացույց',
    myBookings: '📋 Իմ հայտերը',
    info: 'ℹ️ Տեղեկություն',
    support: '🛠 Աջակցություն',
    back: '⬅️ Հետ',
    chooseAsset: '🎮 Ի՞նչ ես ուզում ամրագրել։',
    chooseDate: '📅 Մուտքագրիր ամրագրման ամսաթիվը ՏՏՏՏ-ԱԱ-ՕՕ ձևաչափով։\nՕրինակ՝ 2026-10-20',
    chooseTime: '🕒 Մուտքագրիր մեկնարկի ժամը ԺԺ:ՐՐ ձևաչափով։\nՕրինակ՝ 18:30',
    chooseDuration: '⏳ Ընտրիր տևողությունը։',
    enterName: '👤 Մուտքագրիր անունդ։',
    enterPhone: '📱 Մուտքագրիր հեռախոսահամարդ։',
    enterComment: '📝 Գրիր մեկնաբանություն կամ ուղարկիր 0, եթե մեկնաբանություն պետք չէ։',
    bookingCreated: '✅ Հայտն ուղարկվել է ադմինիստրատորին։\n\nՀայտի համարը՝ #',
    bookingFailed: '❌ Չհաջողվեց պահպանել հայտը։ Փորձիր ավելի ուշ։',
    invalidDate: '❌ Ամսաթիվը սխալ է։ Մուտքագրիր ՏՏՏՏ-ԱԱ-ՕՕ ձևաչափով։ Ամսաթիվը պետք է լինի այսօր կամ ավելի ուշ։',
    invalidTime: '❌ Ժամը սխալ է։ Մուտքագրիր ԺԺ:ՐՐ ձևաչափով, օրինակ՝ 19:30։',
    invalidDuration: '❌ Ընտրիր տևողությունը ստորև գտնվող կոճակով։',
    invalidPhone: '❌ Մուտքագրիր ճիշտ հեռախոսահամար։',
    invalidName: '❌ Մուտքագրիր առնվազն 2 նիշ պարունակող անուն։',
    invalidComment: '❌ Գրիր մեկնաբանություն կամ ուղարկիր 0։',
    noBookings: '📋 Դու դեռ հայտեր չունես։',
    myBookings: '📋 Քո հայտերը՝',
    pending: '⏳ Սպասում է հաստատման',
    approved: '✅ Հաստատված է',
    rejected: '❌ Մերժված է',
    adminNew: '🔔 ՆՈՐ ՀԱՅՏ',
    customer: 'Հաճախորդ',
    phone: 'Հեռախոս',
    asset: 'Օբյեկտ',
    date: 'Ամսաթիվ',
    time: 'Մեկնարկ',
    duration: 'Տևողություն',
    price: 'Արժեք',
    comment: 'Մեկնաբանություն',
    approve: '✅ Հաստատել',
    reject: '❌ Մերժել',
    bookingApproved: '✅ Քո ամրագրումը հաստատվել է։',
    bookingRejected: '❌ Ցավոք, հայտը մերժվել է։ Այլ ժամ ընտրելու համար կապվիր մեզ հետ։',
    adminApproved: 'Հայտը հաստատված է։',
    adminRejected: 'Հայտը մերժված է։',
    notFound: 'Հայտը չի գտնվել։',
    alreadyProcessed: 'Այս հայտը արդեն մշակվել է։',
    conflict: '⚠️ Այդ ժամին օբյեկտն արդեն ամրագրված է։ Հայտը մերժվել է։',
    pricesText: '💰 AURA PLAY ԳՆԵՐ\n\n💻 Համակարգիչներ և սովորական PS5՝\n• 10:00–20:00 — 1000 ֏/ժամ\n• 20:00–10:00 — 1200 ֏/ժամ\n\n👑 VIP սենյակներ՝\n• 10:00–20:00 — 1200 ֏/ժամ\n• 20:00–10:00 — 1400 ֏/ժամ\n\nՎերջնական արժեքը կախված է ամրագրման ժամից։',
    vipText: '👑 Aura Play VIP սենյակներ\n\nՄեզ մոտ հասանելի են երկու VIP սենյակ։\n\n💰 10:00–20:00 — 1200 ֏/ժամ\n🌙 20:00–10:00 — 1400 ֏/ժամ\n\nՍեղմիր «Ամրագրել»՝ սենյակ ընտրելու համար։',
    scheduleText: '📅 Ամրագրումները հասանելի են ամեն օր՝ 10:00-ից մինչև հաջորդ օրվա 05:00։\n\nԿոնկրետ ժամի հասանելիությունը ստուգելու համար ուղարկիր հայտ։ Ադմինիստրատորը կհաստատի այն։',
    infoText: 'ℹ️ AURA PLAY\n\n🎮 Համակարգիչներ, PlayStation 5 և VIP սենյակներ։\n🕙 Աշխատում ենք ամեն օր՝ 10:00–05:00։\n\n📱 Հեռախոս՝ ' + SUPPORT_PHONE + '\n💬 Telegram՝ ' + SUPPORT_TELEGRAM,
    supportText: '🛠 Aura Play աջակցություն\n\n📱 Հեռախոս՝ ' + SUPPORT_PHONE + '\n💬 Telegram՝ ' + SUPPORT_TELEGRAM,
    cancelled: 'Գործողությունը չեղարկված է։',
    durationButton: n => `${n} ժամ`,
    hours: n => `${n} ժամ`,
    status: 'Կարգավիճակ',
    help: 'Հրամաններ՝\n/start — գլխավոր մենյու\n/book — ամրագրել\n/prices — գներ\n/vip — VIP սենյակներ\n/schedule — ժամանակացույց\n/mybookings — իմ հայտերը\n/language — փոխել լեզուն',
    adminOnly: 'Այս հրամանը հասանելի է միայն ադմինիստրատորին։',
    databaseError: 'Տվյալների բազայի սխալ։ Ստուգիր Supabase-ի կարգավորումները։'
  }
};

// ==================== ՀԻՄՆԱԿԱՆ ՏՎՅԱԼՆԵՐ ====================

const states = new Map();
const languages = new Map();
let bookings = [];

function getLang(chatId) {
  return languages.get(String(chatId)) || 'ru';
}

function t(chatId, key, ...args) {
  const lang = getLang(chatId);
  const value = TEXT[lang][key] ?? TEXT.ru[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}

function setState(chatId, state) {
  states.set(String(chatId), state);
}

function getState(chatId) {
  return states.get(String(chatId)) || null;
}

function clearState(chatId) {
  states.delete(String(chatId));
}

function isAdmin(chatId) {
  return String(chatId) === ADMIN_ID;
}

function mainKeyboard(chatId) {
  return {
    keyboard: [
      [{ text: t(chatId, 'book') }, { text: t(chatId, 'prices') }],
      [{ text: t(chatId, 'vip') }, { text: t(chatId, 'schedule') }],
      [{ text: t(chatId, 'myBookings') }, { text: t(chatId, 'info') }],
      [{ text: t(chatId, 'support') }]
    ],
    resize_keyboard: true
  };
}

function assetLabel(assetId, lang = 'ru') {
  const asset = ASSETS.find(a => a.id === assetId);
  if (!asset) return assetId || '—';
  return lang === 'hy' ? asset.hy : asset.ru;
}

function statusLabel(status, lang = 'ru') {
  const map = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected'
  };

  const labels = {
    ru: {
      pending: TEXT.ru.pending,
      approved: TEXT.ru.approved,
      rejected: TEXT.ru.rejected
    },
    hy: {
      pending: TEXT.hy.pending,
      approved: TEXT.hy.approved,
      rejected: TEXT.hy.rejected
    }
  };

  return labels[lang][map[status] || 'pending'];
}

function formatDate(dateString) {
  return dateString || '—';
}

function formatTime(timeString) {
  return String(timeString || '').slice(0, 5);
}

function localDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function localTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yerevan',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function armeniaDateTime(dateString, timeString) {
  return new Date(`${dateString}T${timeString}:00+04:00`);
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00+04:00`);
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value;
}

function isValidTimeString(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  return hour >= OPEN_HOUR || hour < CLOSE_HOUR;
}

function isWithinOpeningHours(start, end) {
  const startHour = Number(start.slice(0, 2));
  if (!(startHour >= OPEN_HOUR || startHour < CLOSE_HOUR)) return false;

  const startDate = armeniaDateTime('2026-01-01', start);
  const endDate = armeniaDateTime('2026-01-01', end);
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime());
}

function getHourlyPrice(assetId, dateString, timeString) {
  const asset = ASSETS.find(a => a.id === assetId);
  const hour = Number(timeString.slice(0, 2));
  const night = hour >= 20 || hour < 10;

  if (asset && asset.type === 'vip') {
    return night ? 1400 : 1200;
  }

  return night ? 1200 : 1000;
}

function getTotalPrice(assetId, dateString, timeString, duration) {
  const start = armeniaDateTime(dateString, timeString);
  let total = 0;

  for (let i = 0; i < duration; i++) {
    const current = new Date(start.getTime() + i * 60 * 60 * 1000);
    const hour = Number(localTimeString(current).slice(0, 2));
    const asset = ASSETS.find(a => a.id === assetId);
    const night = hour >= 20 || hour < 10;
    total += asset && asset.type === 'vip'
      ? (night ? 1400 : 1200)
      : (night ? 1200 : 1000);
  }

  return total;
}

function getBookingStart(booking) {
  if (booking.start) return new Date(booking.start);

  return armeniaDateTime(
    booking.bookingDate,
    booking.startTime
  );
}

function getBookingEnd(booking) {
  if (booking.end) return new Date(booking.end);

  return new Date(
    getBookingStart(booking).getTime() +
    Number(booking.duration || 1) * 60 * 60 * 1000
  );
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function hasConflict(candidate, ignoreId = null) {
  const start = getBookingStart(candidate);
  const end = getBookingEnd(candidate);

  return bookings.some(existing => {
    if (String(existing.id) === String(ignoreId)) return false;
    if (existing.assetId !== candidate.assetId) return false;
    if (!['pending', 'approved'].includes(existing.status)) return false;

    return overlaps(
      start,
      end,
      getBookingStart(existing),
      getBookingEnd(existing)
    );
  });
}

function getBookingDetails(booking, lang = 'ru') {
  const words = TEXT[lang];

  return [
    `🎮 ${assetLabel(booking.assetId, lang)}`,
    `📅 ${words.date}: ${formatDate(booking.bookingDate)}`,
    `🕒 ${words.time}: ${formatTime(booking.startTime)}`,
    `⏳ ${words.duration}: ${words.hours(Number(booking.duration))}`,
    `💰 ${words.price}: ${Number(booking.price || 0).toLocaleString('en-US')} ֏`,
    `${words.status}: ${statusLabel(booking.status, lang)}`
  ].join('\n');
}

// ==================== SUPABASE ====================

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки бронирований:', error.message);
    return;
  }

  bookings = (data || []).map(row => {
    let extra = {};

    try {
      extra = row.comment ? JSON.parse(row.comment) : {};
    } catch {
      extra = { comment: row.comment || '' };
    }

    return {
      ...extra,
      id: row.id,
      telegramId: String(row.telegram_id),
      assetId: row.asset_name,
      bookingDate: row.booking_date,
      startTime: formatTime(row.start_time),
      duration: Number(row.duration || extra.duration || 1),
      status: row.status || 'pending',
      customerName: row.customer_name || extra.customerName || '',
      phone: row.phone || extra.phone || '',
      price: Number(extra.price || 0),
      commentText: extra.commentText || ''
    };
  });

  console.log(`Загружено бронирований: ${bookings.length}`);
}

async function updateBookingStatus(booking, status) {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', booking.id);

  if (error) {
    console.error('Ошибка обновления статуса:', error.message);
    return false;
  }

  booking.status = status;
  return true;
}

async function saveBooking(booking) {
  const savedData = {
    telegram_id: Number(booking.telegramId),
    asset_name: booking.assetId,
    booking_date: booking.bookingDate,
    start_time: booking.startTime,
    duration: Number(booking.duration),
    status: 'pending',
    phone: booking.phone,
    customer_name: booking.customerName,
    comment: JSON.stringify({
      start: booking.start,
      end: booking.end,
      price: booking.price,
      customerName: booking.customerName,
      phone: booking.phone,
      commentText: booking.commentText,
      lang: booking.lang
    })
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert([savedData])
    .select()
    .single();

  if (error) {
    console.error('Ошибка сохранения заявки:', error.message);
    return null;
  }

  booking.id = data.id;
  booking.status = data.status || 'pending';
  bookings.push(booking);

  return booking;
}

// ==================== ЯЗЫК ====================

async function askLanguage(chatId) {
  clearState(chatId);

  await bot.sendMessage(
    chatId,
    '🌐 Выбери язык / Ընտրեք լեզուն',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
            { text: '🇦🇲 Հայերեն', callback_data: 'lang_hy' }
          ]
        ]
      }
    }
  );
}

// ==================== МЕНЮ ====================

async function showMenu(chatId) {
  clearState(chatId);

  await bot.sendMessage(
    chatId,
    t(chatId, 'menu'),
    { reply_markup: mainKeyboard(chatId) }
  );
}

async function showPrices(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'pricesText'));
}

async function showVip(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'vipText'));
}

async function showSchedule(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'scheduleText'));
}

async function showInfo(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'infoText'));
}

async function showSupport(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'supportText'));
}

// ==================== БРОНИРОВАНИЕ ====================

async function startBooking(chatId) {
  setState(chatId, { step: 'asset' });

  const lang = getLang(chatId);
  const buttons = ASSETS.map(asset => [{
    text: lang === 'hy' ? asset.hy : asset.ru,
    callback_data: `asset_${asset.id}`
  }]);

  buttons.push([{
    text: t(chatId, 'back'),
    callback_data: 'cancel_booking'
  }]);

  await bot.sendMessage(chatId, t(chatId, 'chooseAsset'), {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function askBookingDate(chatId) {
  setState(chatId, { ...getState(chatId), step: 'date' });
  await bot.sendMessage(chatId, t(chatId, 'chooseDate'));
}

async function askBookingTime(chatId) {
  setState(chatId, { ...getState(chatId), step: 'time' });
  await bot.sendMessage(chatId, t(chatId, 'chooseTime'));
}

async function askDuration(chatId) {
  const buttons = [1, 2, 3, 4, 5, 6].map(n => ({
    text: t(chatId, 'durationButton', n),
    callback_data: `duration_${n}`
  }));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }

  rows.push([{
    text: t(chatId, 'back'),
    callback_data: 'cancel_booking'
  }]);

  setState(chatId, { ...getState(chatId), step: 'duration' });

  await bot.sendMessage(chatId, t(chatId, 'chooseDuration'), {
    reply_markup: { inline_keyboard: rows }
  });
}

async function askCustomerName(chatId) {
  setState(chatId, { ...getState(chatId), step: 'name' });
  await bot.sendMessage(chatId, t(chatId, 'enterName'));
}

async function askCustomerPhone(chatId) {
  setState(chatId, { ...getState(chatId), step: 'phone' });
  await bot.sendMessage(chatId, t(chatId, 'enterPhone'));
}

async function askComment(chatId) {
  setState(chatId, { ...getState(chatId), step: 'comment' });
  await bot.sendMessage(chatId, t(chatId, 'enterComment'));
}

async function finishBooking(chatId, commentText) {
  const state = getState(chatId);
  if (!state) return;

  const start = armeniaDateTime(state.bookingDate, state.startTime);
  const end = new Date(
    start.getTime() + Number(state.duration) * 60 * 60 * 1000
  );

  const booking = {
    telegramId: String(chatId),
    assetId: state.assetId,
    bookingDate: state.bookingDate,
    startTime: state.startTime,
    duration: Number(state.duration),
    start: start.toISOString(),
    end: end.toISOString(),
    customerName: state.customerName,
    phone: state.phone,
    commentText: commentText === '0' ? '' : commentText,
    price: getTotalPrice(
      state.assetId,
      state.bookingDate,
      state.startTime,
      Number(state.duration)
    ),
    status: 'pending',
    lang: getLang(chatId)
  };

  if (hasConflict(booking)) {
    await bot.sendMessage(chatId, t(chatId, 'conflict'), {
      reply_markup: mainKeyboard(chatId)
    });
    clearState(chatId);
    return;
  }

  const saved = await saveBooking(booking);

  if (!saved) {
    await bot.sendMessage(chatId, t(chatId, 'bookingFailed'), {
      reply_markup: mainKeyboard(chatId)
    });
    clearState(chatId);
    return;
  }

  await bot.sendMessage(
    chatId,
    t(chatId, 'bookingCreated') + saved.id + '\n\n' +
    getBookingDetails(saved, getLang(chatId)),
    { reply_markup: mainKeyboard(chatId) }
  );

  await notifyAdmin(saved);

  clearState(chatId);
}

async function notifyAdmin(booking) {
  const lang = 'ru';

  const message = [
    `🔔 ${TEXT[lang].adminNew} #${booking.id}`,
    '',
    `👤 ${TEXT[lang].customer}: ${booking.customerName}`,
    `📱 ${TEXT[lang].phone}: ${booking.phone}`,
    `🎮 ${TEXT[lang].asset}: ${assetLabel(booking.assetId, lang)}`,
    `📅 ${TEXT[lang].date}: ${booking.bookingDate}`,
    `🕒 ${TEXT[lang].time}: ${booking.startTime}`,
    `⏳ ${TEXT[lang].duration}: ${booking.duration} ч.`,
    `💰 ${TEXT[lang].price}: ${booking.price} ֏`,
    `📝 ${TEXT[lang].comment}: ${booking.commentText || '—'}`,
    '',
    `Telegram ID: ${booking.telegramId}`
  ].join('\n');

  try {
    await bot.sendMessage(ADMIN_ID, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: TEXT.ru.approve,
              callback_data: `admin_approve_${booking.id}`
            },
            {
              text: TEXT.ru.reject,
              callback_data: `admin_reject_${booking.id}`
            }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Не удалось отправить заявку администратору:', error.message);
  }
}

// ==================== МОИ ЗАЯВКИ ====================

async function showMyBookings(chatId) {
  const mine = bookings
    .filter(b => String(b.telegramId) === String(chatId))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 10);

  if (!mine.length) {
    await bot.sendMessage(chatId, t(chatId, 'noBookings'));
    return;
  }

  await bot.sendMessage(chatId, t(chatId, 'myBookings'));

  for (const booking of mine) {
    await bot.sendMessage(
      chatId,
      `#${booking.id}\n${getBookingDetails(booking, getLang(chatId))}`
    );
  }
}

// ==================== ОБРАБОТКА ЗАЯВОК АДМИНИСТРАТОРОМ ====================

async function processAdminAction(query, action, id) {
  const adminChatId = query.message.chat.id;
  const booking = bookings.find(b => String(b.id) === String(id));

  if (!booking) {
    await bot.answerCallbackQuery(query.id, {
      text: TEXT.ru.notFound,
      show_alert: true
    });
    return;
  }

  if (booking.status !== 'pending') {
    await bot.answerCallbackQuery(query.id, {
      text: TEXT.ru.alreadyProcessed,
      show_alert: true
    });
    return;
  }

  if (action === 'approve' && hasConflict(booking, booking.id)) {
    const updated = await updateBookingStatus(booking, 'rejected');

    if (updated) {
      try {
        await bot.sendMessage(
          booking.telegramId,
          TEXT[booking.lang || 'ru'].conflict,
          { reply_markup: mainKeyboard(booking.telegramId) }
        );
      } catch (error) {
        console.error('Не удалось уведомить клиента:', error.message);
      }
    }

    await bot.answerCallbackQuery(query.id, {
      text: TEXT.ru.conflict,
      show_alert: true
    });

    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: adminChatId,
          message_id: query.message.message_id
        }
      );
    } catch {}

    return;
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updated = await updateBookingStatus(booking, newStatus);

  if (!updated) {
    await bot.answerCallbackQuery(query.id, {
      text: TEXT.ru.databaseError,
      show_alert: true
    });
    return;
  }

  const clientLang = booking.lang || 'ru';

  try {
    await bot.sendMessage(
      booking.telegramId,
      action === 'approve'
        ? TEXT[clientLang].bookingApproved + '\n\n' +
          getBookingDetails(booking, clientLang)
        : TEXT[clientLang].bookingRejected,
      { reply_markup: mainKeyboard(booking.telegramId) }
    );
  } catch (error) {
    console.error('Не удалось уведомить клиента:', error.message);
  }

  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: adminChatId,
        message_id: query.message.message_id
      }
    );

    await bot.sendMessage(
      adminChatId,
      action === 'approve'
        ? `✅ Заявка #${booking.id} подтверждена.`
        : `❌ Заявка #${booking.id} отклонена.`
    );
  } catch (error) {
    console.error('Ошибка сообщения администратору:', error.message);
  }

  await bot.answerCallbackQuery(query.id, {
    text: action === 'approve'
      ? TEXT.ru.adminApproved
      : TEXT.ru.adminRejected
  });
}

// ==================== КНОПКИ ====================

bot.on('callback_query', async query => {
  const chatId = query.message?.chat?.id;
  const data = query.data || '';

  try {
    if (data.startsWith('lang_')) {
      const lang = data === 'lang_hy' ? 'hy' : 'ru';
      languages.set(String(chatId), lang);

      await bot.answerCallbackQuery(query.id, {
        text: TEXT[lang].languageSaved
      });

      await bot.sendMessage(chatId, TEXT[lang].welcome, {
        reply_markup: mainKeyboard(chatId)
      });
      return;
    }

    if (data === 'cancel_booking') {
      clearState(chatId);

      await bot.answerCallbackQuery(query.id, {
        text: t(chatId, 'cancelled')
      });

      await bot.sendMessage(chatId, t(chatId, 'menu'), {
        reply_markup: mainKeyboard(chatId)
      });
      return;
    }

    if (data.startsWith('admin_')) {
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(query.id, {
          text: TEXT.ru.adminOnly,
          show_alert: true
        });
        return;
      }

      const match = data.match(/^admin_(approve|reject)_(\d+)$/);
      if (!match) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await processAdminAction(query, match[1], match[2]);
      return;
    }

    if (data.startsWith('asset_')) {
      const assetId = data.substring('asset_'.length);
      const asset = ASSETS.find(a => a.id === assetId);

      if (!asset) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      setState(chatId, {
        ...getState(chatId),
        step: 'date',
        assetId
      });

      await bot.answerCallbackQuery(query.id);
      await askBookingDate(chatId);
      return;
    }

    if (data.startsWith('duration_')) {
      const duration = Number(data.split('_')[1]);

      if (![1, 2, 3, 4, 5, 6].includes(duration)) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      setState(chatId, {
        ...getState(chatId),
        step: 'name',
        duration
      });

      await bot.answerCallbackQuery(query.id);
      await askCustomerName(chatId);
      return;
    }

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Ошибка callback:', error.message);

    try {
      await bot.answerCallbackQuery(query.id, {
        text: 'Произошла ошибка. Попробуй ещё раз.',
        show_alert: true
      });
    } catch {}
  }
});

// ==================== КОМАНДЫ ====================

bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  clearState(chatId);

  await bot.sendMessage(chatId, TEXT.ru.chooseLanguage, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
          { text: '🇦🇲 Հայերեն', callback_data: 'lang_hy' }
        ]
      ]
    }
  });
});

bot.onText(/\/language/, async msg => {
  await askLanguage(msg.chat.id);
});

bot.onText(/\/book/, async msg => {
  await startBooking(msg.chat.id);
});

bot.onText(/\/prices/, async msg => {
  await showPrices(msg.chat.id);
});

bot.onText(/\/vip/, async msg => {
  await showVip(msg.chat.id);
});

bot.onText(/\/schedule/, async msg => {
  await showSchedule(msg.chat.id);
});

bot.onText(/\/mybookings/, async msg => {
  await showMyBookings(msg.chat.id);
});

bot.onText(/\/help/, async msg => {
  await bot.sendMessage(msg.chat.id, t(msg.chat.id, 'help'));
});

// ==================== ТЕКСТОВЫЕ СООБЩЕНИЯ ====================

bot.on('message', async msg => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const state = getState(chatId);

  const armenianButtons = {
    '🎮 Ամրագրել': '🎮 Забронировать',
    '💰 Տեսնել գները': '💰 Посмотреть цены',
    '👑 VIP սենյակներ': '👑 VIP-комнаты',
    '📅 Ժամանակացույց': '📅 Расписание',
    '📋 Իմ հայտերը': '📋 Мои заявки',
    'ℹ️ Տեղեկություն': 'ℹ️ Информация',
    '🛠 Աջակցություն': '🛠 Техподдержка',
    '⬅️ Հետ': '⬅️ Назад'
  };

  const commandText = armenianButtons[text] || text;

  if (commandText === '🎮 Забронировать') {
    await startBooking(chatId);
    return;
  }

  if (commandText === '💰 Посмотреть цены') {
    await showPrices(chatId);
    return;
  }

  if (commandText === '👑 VIP-комнаты') {
    await showVip(chatId);
    return;
  }

  if (commandText === '📅 Расписание') {
    await showSchedule(chatId);
    return;
  }

  if (commandText === '📋 Мои заявки') {
    await showMyBookings(chatId);
    return;
  }

  if (commandText === 'ℹ️ Информация') {
    await showInfo(chatId);
    return;
  }

  if (commandText === '🛠 Техподдержка') {
    await showSupport(chatId);
    return;
  }

  if (commandText === '⬅️ Назад') {
    clearState(chatId);
    await showMenu(chatId);
    return;
  }

  if (!state) return;

  if (state.step === 'date') {
    if (!isValidDateString(text) || text < localDateString()) {
      await bot.sendMessage(chatId, t(chatId, 'invalidDate'));
      return;
    }

    setState(chatId, { ...state, bookingDate: text, step: 'time' });
    await askBookingTime(chatId);
    return;
  }

  if (state.step === 'time') {
    if (!isValidTimeString(text)) {
      await bot.sendMessage(chatId, t(chatId, 'invalidTime'));
      return;
    }

    if (state.bookingDate === localDateString() &&
        text <= localTimeString()) {
      await bot.sendMessage(chatId, t(chatId, 'invalidTime'));
      return;
    }

    setState(chatId, { ...state, startTime: text, step: 'duration' });
    await askDuration(chatId);
    return;
  }

  if (state.step === 'name') {
    if (text.length < 2 || text.length > 100) {
      await bot.sendMessage(chatId, t(chatId, 'invalidName'));
      return;
    }

    setState(chatId, { ...state, customerName: text, step: 'phone' });
    await askCustomerPhone(chatId);
    return;
  }

  if (state.step === 'phone') {
    const normalizedPhone = text.replace(/[^\d+]/g, '');

    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
      await bot.sendMessage(chatId, t(chatId, 'invalidPhone'));
      return;
    }

    setState(chatId, {
      ...state,
      phone: normalizedPhone,
      step: 'comment'
    });

    await askComment(chatId);
    return;
  }

  if (state.step === 'comment') {
    if (text.length > 500) {
      await bot.sendMessage(chatId, t(chatId, 'invalidComment'));
      return;
    }

    await finishBooking(chatId, text);
  }
});

// ==================== ЗАПУСК ====================

bot.on('polling_error', error => {
  console.error('Telegram polling error:', error.message);
});

bot.on('webhook_error', error => {
  console.error('Telegram webhook error:', error.message);
});

(async () => {
  await loadBookings();
  console.log('Aura Play Booking запущен.');
})().catch(error => {
  console.error('Ошибка запуска:', error.message);
});
