(function (global) {
  'use strict';

  const CATEGORY_RULES = [
    { name:'Здоровье', icon:'🦷', words:['зуб','зубы','зубов','брекет','стомат','врач','анализ','операц','здоров','клиник','лечение','удалить','удаление','ортодонт','окулист','линз'] },
    { name:'Студия', icon:'🎙️', words:['студ','микрофон','монитор','наушник','аудио','интерфейс','гитар','синт','клавиш','музык'] },
    { name:'Одежда', icon:'🧥', words:['куртк','пальто','футбол','кроссов','ботин','джинс','брюк','одежд','кофт','худи','свитер','сумк'] },
    { name:'Путешествия', icon:'✈️', words:['поездк','путеше','отпуск','билет','отель','грузи','исланд','страна','море','перелет'] },
    { name:'Дом', icon:'🏠', words:['дом','квартир','мебел','диван','стол','кресл','ламп','проектор','телевизор','пылесос','посудом'] },
    { name:'Техника', icon:'📱', words:['телефон','айфон','iphone','ноут','компьют','macbook','планшет','ipad','камера','объектив','техника','консоль','playstation','xbox'] },
    { name:'Транспорт', icon:'🚗', words:['машин','авто','велосипед','самокат','мото','шина','колес'] },
    { name:'Учёба', icon:'📚', words:['курс','учеб','институт','универ','книг','обучен','экзамен'] },
    { name:'Красота', icon:'✨', words:['тату','маникюр','волос','стриж','космет','уход','парфюм'] },
    { name:'Хобби', icon:'🎸', words:['хобби','игр','гитар','рисова','спорт','скейт','коллекц'] },
    { name:'Личное', icon:'👓', words:['очки','оправ','час','аксессуар','рюкзак','кошелек','кошелёк'] },
    { name:'Питомцы', icon:'🐾', words:['кот','кошк','собак','питом','ветерин'] }
  ];

  const NEED_WORDS = ['надо','нужно','нужен','нужна','нужны','необходимо','обязательно','сломал','сломалась','заменить','починить','сделать','лечить'];
  const WANT_WORDS = ['хочу','хотел','хотелось','мечтаю','прикольно бы','купить бы'];
  const LATER_WORDS = ['когда-нибудь','когда нибудь','потом','не сейчас','в будущем','как-нибудь','идея','на потом'];

  function norm(text) { return String(text || '').trim().toLowerCase().replace(/ё/g,'е'); }
  function hasAny(text, arr) { return arr.some(x => text.includes(x)); }

  function inferCategory(text) {
    const t = norm(text);
    let best = { name:'Личное', icon:'◌', score:0 };
    for (const rule of CATEGORY_RULES) {
      const score = rule.words.reduce((n,w) => n + (t.includes(w) ? 1 : 0), 0);
      if (score > best.score) best = { name:rule.name, icon:rule.icon, score };
    }
    return best;
  }

  function inferType(text, category) {
    const t = norm(text);
    if (category === 'Здоровье') return 'need';
    if (hasAny(t, LATER_WORDS)) return 'later';
    if (hasAny(t, NEED_WORDS)) return 'need';
    if (hasAny(t, WANT_WORDS)) return 'want';
    if (category === 'Учёба' || category === 'Транспорт') return 'need';
    return 'want';
  }

  function unitMultiplier(unit) {
    unit = norm(unit);
    if (unit.startsWith('к') || unit === 'k') return 1000;
    if (unit.startsWith('м')) return 1000000;
    return 1;
  }

  function parseNumber(raw) {
    return Number(String(raw).replace(/\s/g,'').replace(',','.'));
  }

  function parsePrice(text) {
    const t = norm(text).replace(/тыс\.?/g,'к').replace(/руб(?:лей|ля|ль|\.)?/g,'₽');
    let m = t.match(/(?:≈|~|около|примерно|где-то|где то|от\s*)?([\d\s]+(?:[.,]\d+)?)\s*(?:-|–|—|до)\s*([\d\s]+(?:[.,]\d+)?)\s*(к|k|млн|м)?\s*(?:₽|р\b|руб)?/i);
    if (m) {
      const mult = unitMultiplier(m[3]);
      const min = Math.round(parseNumber(m[1]) * mult);
      const max = Math.round(parseNumber(m[2]) * mult);
      if (min > 0 && max >= min) return { kind:'range', min, max, raw:formatRange(min,max) };
    }
    m = t.match(/(?:≈|~|около|примерно|где-то|где то|за\s*)?([\d][\d\s]*(?:[.,]\d+)?)\s*(к|k|млн|м|₽|р\b|руб(?:лей|ля|ль)?\.?)/i);
    if (m) {
      const unit = m[2];
      const mult = /^(к|k)$/i.test(unit) ? 1000 : /^(млн|м)$/i.test(unit) ? 1000000 : 1;
      const n = Math.round(parseNumber(m[1]) * mult);
      if (n >= 300) return { kind:'exact', min:n, max:n, raw:formatMoney(n) };
    }
    return { kind:'unknown', min:null, max:null, raw:'цена неизвестна' };
  }

  function formatMoney(n) {
    if (n >= 1000000 && n % 1000000 === 0) return `≈${n/1000000} млн ₽`;
    if (n >= 10000 && n % 1000 === 0) return `≈${n/1000}K ₽`;
    return `≈${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
  }

  function formatRange(min,max) {
    if (min >= 1000 && max >= 1000 && min % 1000 === 0 && max % 1000 === 0) return `≈${min/1000}–${max/1000}K ₽`;
    return `≈${new Intl.NumberFormat('ru-RU').format(min)}–${new Intl.NumberFormat('ru-RU').format(max)} ₽`;
  }

  function cleanTitle(text) {
    let t = String(text || '').trim();
    t = t.replace(/^(я\s+)?(мне\s+)?(очень\s+)?(хочу|хотелось бы|хотел бы|надо|нужно|нужен|нужна|нужны|необходимо)\s+/i,'');
    t = t.replace(/^(купить|сделать|заказать|найти)\s+/i,'');
    t = t.replace(/\s+(примерно|около|где-то|где то|за)\s*[~≈]?\s*[\d\s.,]+\s*(?:-|–|—|до)?\s*[\d\s.,]*\s*(?:к|k|тыс\.?|млн|м)?\s*(?:₽|р\.?|руб(?:лей|ля|ль)?\.?)?\s*$/i,'');
    t = t.replace(/[.!?]+$/,'').trim();
    if (!t) return 'Новая хотелка';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function nextStep(title, category, type) {
    const t = norm(title);
    if (category === 'Здоровье') {
      if (t.includes('зуб') || t.includes('брек')) return 'Записаться на консультацию';
      return 'Узнать варианты у специалиста';
    }
    if (t.includes('очки') || t.includes('оправ')) return 'Посмотреть варианты и узнать цену';
    if (category === 'Одежда') return 'Найти подходящий вариант';
    if (category === 'Студия' || category === 'Техника') return 'Сравнить модели и цены';
    if (category === 'Путешествия') return 'Прикинуть маршрут и бюджет';
    if (category === 'Красота') return 'Найти референсы и стоимость';
    if (type === 'later') return 'Сохранить идею';
    return 'Посмотреть варианты';
  }

  function palette(type, category) {
    const map = {
      need: [['#7b42d8','#2f1c68'],['#2654c9','#16346c'],['#0d8b82','#0a4b52'],['#9e3f82','#4b1e5d']],
      want: [['#e66c0a','#6f2b0a'],['#d68a13','#6f430d'],['#b93658','#681b37'],['#8550d8','#3e286d']],
      later:[['#2d8c66','#174636'],['#0a8d93','#124857'],['#2c8340','#17492a'],['#367b6b','#1d4b4e']]
    };
    const arr = map[type] || map.want;
    const seed = [...String(category)].reduce((a,c)=>a+c.charCodeAt(0),0);
    return arr[seed % arr.length];
  }

  function classify(text) {
    const cat = inferCategory(text);
    const type = inferType(text, cat.name);
    const price = parsePrice(text);
    const title = cleanTitle(text);
    const [c1,c2] = palette(type, cat.name);
    return {
      title,
      type,
      category:cat.name,
      icon:cat.icon,
      priceText:price.raw,
      priceMin:price.min,
      priceMax:price.max,
      next:nextStep(title,cat.name,type),
      note:'',
      c1,c2
    };
  }

  function parsePriceInput(raw) {
    const result = parsePrice(raw);
    return result;
  }

  const api = { classify, inferCategory, inferType, parsePrice, parsePriceInput, formatMoney, formatRange, nextStep, palette };
  global.NWLClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
