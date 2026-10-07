/* АЛЬФА КОТЁЛ — мини-приложение MAX: логика каталога и заявок.
   Работает в двух режимах:
     1) внутри MAX (есть window.WebApp) — приветствие по имени, кнопка «Отправить мой номер»,
        системная кнопка «Назад», ссылки через openLink/openMaxLink;
     2) как обычная веб-страница (GitHub Pages, file://) — всё то же, но без моста MAX. */

(function () {
  'use strict';

  var АДРЕС_ЗАЯВКИ = 'https://claude.termoomsk.ru/api/max-zayavka';
  var САЙТ = 'https://termoomsk-gif.github.io/ogon-truba-diler/';
  var ТЕЛЕФОН = '+7 928 457-73-59';

  var ПРОДУКТЫ = window.PRODUCTS || [];
  var Мост = window.WebApp || null;
  var вМаксе = !!(Мост && Мост.initDataUnsafe && Мост.initDataUnsafe.user);
  var Пользователь = (Мост && Мост.initDataUnsafe && Мост.initDataUnsafe.user) || null;

  var состояние = {
    группа: 'все',
    поиск: '',
    товар: null,
    откуда: 'мини-приложение MAX',
    телефон_из_макса: null,
    стек: []
  };

  // ── утилиты ─────────────────────────────────────────────────────────
  function $(к) { return document.getElementById(к); }

  function деньги(цена) {
    if (цена === null || цена === undefined) return null;
    return String(цена).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  function скрыть(эл) { if (эл) эл.hidden = true; }
  function показать(эл) { if (эл) эл.hidden = false; }

  function щелчок() {
    try { if (Мост && Мост.HapticFeedback) Мост.HapticFeedback.selectionChanged(); } catch (e) {}
  }

  // ── шапка: приветствие ──────────────────────────────────────────────
  function приветствие() {
    var эл = $('привет');
    if (!эл) return;
    var имя = Пользователь && (Пользователь.first_name || Пользователь.username);
    if (!вМаксе) {
      эл.textContent = 'Каталог завода «Огонь Труба»: ' + ПРОДУКТЫ.length +
        ' позиций с ценами. Выберите позицию — передадим заявку менеджеру.';
      показать(эл);
      return;
    }
    эл.textContent = (имя ? 'Здравствуйте, ' + имя + '! ' : '') +
      'Каталог завода «Огонь Труба»: ' + ПРОДУКТЫ.length +
      ' позиций. Выберите позицию — передадим заявку менеджеру.';
    показать(эл);
  }

  // ── фильтры ─────────────────────────────────────────────────────────
  function группы() {
    var видели = {};
    var итог = [{ код: 'все', название: 'Все позиции' }];
    ПРОДУКТЫ.forEach(function (п) {
      if (!видели[п.groupCode]) {
        видели[п.groupCode] = 1;
        итог.push({ код: п.groupCode, название: п.group });
      }
    });
    return итог;
  }

  function нарисовать_группы() {
    var контейнер = $('группы');
    контейнер.innerHTML = '';
    группы().forEach(function (г) {
      var к = document.createElement('button');
      к.type = 'button';
      к.className = 'группа' + (состояние.группа === г.код ? ' выбрана' : '');
      var сколько = г.код === 'все'
        ? ПРОДУКТЫ.length
        : ПРОДУКТЫ.filter(function (п) { return п.groupCode === г.код; }).length;
      к.textContent = г.название + ' · ' + сколько;
      к.addEventListener('click', function () {
        состояние.группа = г.код;
        щелчок();
        нарисовать_группы();
        нарисовать_сетку();
      });
      контейнер.appendChild(к);
    });
  }

  function подходит(п) {
    if (состояние.группа !== 'все' && п.groupCode !== состояние.группа) return false;
    var q = состояние.поиск.trim().toLowerCase();
    if (!q) return true;
    var стог = (п.name + ' ' + п.group + ' ' + п.cat + ' ' + п.desc).toLowerCase();
    return q.split(/\s+/).every(function (слово) { return стог.indexOf(слово) >= 0; });
  }

  // ── сетка ───────────────────────────────────────────────────────────
  function нарисовать_сетку() {
    var найденные = ПРОДУКТЫ.filter(подходит);
    var сетка = $('сетка');
    сетка.innerHTML = '';
    $('счётчик').textContent = найденные.length
      ? 'Найдено ' + найденные.length + ' из ' + ПРОДУКТЫ.length + ' позиций'
      : '';
    $('пусто').hidden = найденные.length > 0;

    найденные.forEach(function (п) {
      var карточка = document.createElement('article');
      карточка.className = 'товар';
      карточка.tabIndex = 0;

      var фото = document.createElement('div');
      фото.className = 'товар__фото';
      var им = document.createElement('img');
      им.loading = 'lazy';
      им.decoding = 'async';
      им.alt = п.name;
      им.src = п.img || '';
      фото.appendChild(им);
      if (п.power) {
        var метка = document.createElement('span');
        метка.className = 'товар__метка';
        метка.textContent = п.power + ' ' + (п.unit || 'кВт');
        фото.appendChild(метка);
      }

      var тело = document.createElement('div');
      тело.className = 'товар__тело';
      var имя = document.createElement('h3');
      имя.className = 'товар__имя';
      имя.textContent = п.name;
      var цена = document.createElement('p');
      var ц = деньги(п.price);
      цена.className = 'товар__цена' + (ц ? '' : ' товар__цена--запрос');
      цена.textContent = ц || 'Цена по запросу';
      тело.appendChild(имя);
      тело.appendChild(цена);

      карточка.appendChild(фото);
      карточка.appendChild(тело);
      карточка.addEventListener('click', function () { открыть_товар(п); });
      карточка.addEventListener('keydown', function (е) {
        if (е.key === 'Enter' || е.key === ' ') { е.preventDefault(); открыть_товар(п); }
      });
      сетка.appendChild(карточка);
    });
  }

  // ── экраны ──────────────────────────────────────────────────────────
  function наверх() { window.scrollTo(0, 0); }

  function открыть_товар(п) {
    состояние.товар = п;
    щелчок();
    $('товар-группа').textContent = п.group + ' · ' + п.cat;
    $('товар-имя').textContent = п.name;
    var цена = $('товар-цена');
    var ц = деньги(п.price);
    цена.className = 'товар__цена' + (ц ? '' : ' товар__цена--запрос');
    цена.textContent = ц || 'Цена по запросу — считаем под объект';
    $('товар-фото').src = п.img || '';
    $('товар-фото').alt = п.name;
    $('товар-описание').textContent = п.desc || '';

    var таблица = $('товар-характеристики');
    таблица.innerHTML = '';
    var строки = (п.specs || []).slice();
    if (п.power) строки.unshift({ ключ: 'Мощность', значение: п.power + ' ' + (п.unit || 'кВт') });
    строки.push({ ключ: 'Гарантия', значение: '12 мес теплообменник · 8 мес горелка · 6 мес электрика' });
    строки.push({ ключ: 'Отгрузка', значение: 'склад в Омске, 3 рабочих дня' });
    строки.forEach(function (с) {
      var dt = document.createElement('dt');
      dt.textContent = с.ключ;
      var dd = document.createElement('dd');
      dd.textContent = с.значение;
      таблица.appendChild(dt);
      таблица.appendChild(dd);
    });

    состояние.стек.push('товар');
    показать($('экран-товар'));
    наверх();
    if (Мост && Мост.BackButton) {
      try { Мост.BackButton.show(); } catch (е) {}
    }
  }

  function открыть_заявку() {
    var п = состояние.товар;
    var итог = $('итог-товар');
    итог.innerHTML = '';
    if (п) {
      var б = document.createElement('b');
      б.textContent = п.name;
      var с = document.createElement('span');
      с.textContent = деньги(п.price) || 'цена по запросу';
      итог.appendChild(б);
      итог.appendChild(с);
      var к = document.createElement('div');
      к.className = 'мелко';
      к.textContent = п.group;
      итог.appendChild(к);
    }
    скрыть($('ошибка'));
    показать($('экран-заявка'));
    состояние.стек.push('заявка');
    if (Мост && Мост.enableClosingConfirmation) {
      try { Мост.enableClosingConfirmation(); } catch (е) {}
    }
  }

  function назад() {
    состояние.стек.pop();
    var верх = состояние.стек[состояние.стек.length - 1];
    скрыть($('экран-товар'));
    скрыть($('экран-заявка'));
    скрыть($('экран-готово'));
    if (верх === 'товар') {
      показать($('экран-товар'));
    } else {
      if (Мост && Мост.disableClosingConfirmation) {
        try { Мост.disableClosingConfirmation(); } catch (е) {}
      }
      if (Мост && Мост.BackButton) {
        try { Мост.BackButton.hide(); } catch (е) {}
      }
      window.scrollTo(0, 0);
    }
  }

  // ── заявка ──────────────────────────────────────────────────────────
  function данные_моста() {
    if (!Мост) return '';
    try { return Мост.initData || ''; } catch (е) { return ''; }
  }

  function собрать_заявку() {
    var п = состояние.товар || {};
    return {
      initData: данные_моста(),
      товар: п.name || '',
      цена: деньги(п.price) || 'по запросу',
      категория: п.cat || '',
      группа: п.group || '',
      имя: ($('поле-имя').value || '').trim(),
      телефон: ($('поле-телефон').value || '').trim(),
      телефон_подтверждён: !!состояние.телефон_из_макса,
      город: ($('поле-город').value || '').trim(),
      комментарий: ($('поле-комментарий').value || '').trim(),
      откуда: состояние.откуда,
      страница: location.href
    };
  }

  function отправить(заявка) {
    return fetch(АДРЕС_ЗАЯВКИ, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(заявка)
    }).then(function (ответ) {
      if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
      return ответ.json();
    });
  }

  function копия_в_память(заявка) {
    try {
      var ключ = 'заявки_альфа_котёл';
      var список = JSON.parse(localStorage.getItem(ключ) || '[]');
      список.push({ когда: new Date().toISOString(), заявка: заявка });
      localStorage.setItem(ключ, JSON.stringify(список.slice(-30)));
    } catch (е) {}
  }

  function телефон_ок(т) {
    var цифры = (т || '').replace(/\D/g, '');
    return цифры.length >= 10 && цифры.length <= 15;
  }

  function отправить_форму(е) {
    if (е) е.preventDefault();
    var заявка = собрать_заявку();
    var ошибка = $('ошибка');
    if (!телефон_ок(заявка.телефон) && !заявка.телефон_подтверждён) {
      ошибка.textContent = 'Оставьте телефон — без него менеджер не сможет перезвонить.';
      показать(ошибка);
      $('поле-телефон').focus();
      return;
    }
    ошибка.hidden = true;

    var кнопка = $('кнопка-отправить');
    кнопка.disabled = true;
    кнопка.textContent = 'Передаём…';

    отправить(заявка)
      .then(function () {
        готово(заявка, true);
      })
      .catch(function () {
        копия_в_память(заявка);
        готово(заявка, false);
      })
      .then(function () {
        кнопка.disabled = false;
        кнопка.textContent = 'Отправить менеджеру';
      });
  }

  function готово(заявка, дошло) {
    состояние.стек = [];
    скрыть($('экран-товар'));
    скрыть($('экран-заявка'));
    показать($('экран-готово'));
    if (Мост && Мост.disableClosingConfirmation) {
      try { Мост.disableClosingConfirmation(); } catch (е) {}
    }
    if (Мост && Мост.BackButton) {
      try { Мост.BackButton.hide(); } catch (е) {}
    }
    document.querySelector('.экран--центр h2').textContent = дошло
      ? 'Заявка передана'
      : 'Заявка сохранена';
    $('готово-текст').textContent = дошло
      ? 'Менеджер свяжется в рабочее время (Пн–Пт 10:00–20:00 МСК), подтвердит наличие и стоимость, уточнит дымоход и автоматику.'
      : 'Связь с сервером не прошла. Позвоните сами: ' + ТЕЛЕФОН + ' или напишите в канал — заявка сохранена в приложении и не потеряется.';
    var копия = $('готово-копия');
    копия.textContent = 'Товар: ' + заявка.товар;
    показать(копия);
  }

  // ── телефон через MAX Bridge ────────────────────────────────────────
  function запросить_телефон() {
    if (!Мост || !Мост.requestContact) return;
    Мост.requestContact().then(function (ответ) {
      if (ответ && ответ.phone) {
        $('поле-телефон').value = ответ.phone;
        состояние.телефон_из_макса = {
          phone: ответ.phone,
          authDate: ответ.authDate,
          hash: ответ.hash
        };
        скрыть($('ошибка'));
      }
    }).catch(function () {
      var ошибка = $('ошибка');
      ошибка.textContent = 'Не получилось взять номер автоматически — впишите вручную.';
      показать(ошибка);
    });
  }

  // ── ссылки ──────────────────────────────────────────────────────────
  function повесить_ссылки() {
    document.querySelectorAll('a[data-внешняя]').forEach(function (а) {
      а.addEventListener('click', function (е) {
        if (Мост && Мост.openLink) {
          е.preventDefault();
          Мост.openLink(а.href);
        }
      });
    });
    document.querySelectorAll('a[data-max]').forEach(function (а) {
      а.addEventListener('click', function (е) {
        if (Мост && Мост.openMaxLink) {
          е.preventDefault();
          Мост.openMaxLink(а.href);
        }
      });
    });
  }

  // ── стартовые параметры (?startapp= и ?товар=) ──────────────────────
  // Диплинк MAX: https://max.ru/se14597297_bot?startapp=<payload>
  //   payload = код группы (к-отр, к-газ, пг, гор, вн) ИЛИ id товара (p012)
  //             ИЛИ «форма» — сразу открыть форму заявки.
  // Обычный адрес: ?товар=p012 открывает карточку товара при загрузке.
  function разобрать_старт() {
    var п = '';
    try {
      if (Мост && Мост.initDataUnsafe) п = Мост.initDataUnsafe.start_param || '';
    } catch (е) {}
    if (!п) {
      // location.search приходит закодированным, поэтому читаем через URLSearchParams
      // (иначе ключ «товар» в адресе не находится — грабли, поймано 07.10.2026).
      var пар = new URLSearchParams(location.search);
      п = пар.get('товар') || пар.get('product') || пар.get('startapp') || '';
    }
    if (!п) return;
    состояние.откуда = 'мини-приложение MAX (диплинк ' + п + ')';

    var группа = ПРОДУКТЫ.filter(function (т) { return т.groupCode === п; })[0];
    if (группа) {
      состояние.группа = п;
      return;
    }
    var товар = ПРОДУКТЫ.filter(function (т) { return т.id === п; })[0];
    if (товар) {
      состояние.группа = товар.groupCode;
      состояние.стартовый_товар = товар;
      return;
    }
    if (п === 'форма' || п === 'заявка') состояние.стартовая_форма = true;
  }

  // ── запуск ──────────────────────────────────────────────────────────
  function запуск() {
    if (!ПРОДУКТЫ.length) {
      $('сетка').innerHTML = '<p class="пусто">Данные каталога не загрузились.</p>';
      return;
    }

    разобрать_старт();
    приветствие();
    нарисовать_группы();
    нарисовать_сетку();
    повесить_ссылки();

    $('поиск').addEventListener('input', function (е) {
      состояние.поиск = е.target.value;
      $('поиск-сброс').hidden = !состояние.поиск;
      нарисовать_сетку();
    });
    $('поиск-сброс').addEventListener('click', function () {
      $('поиск').value = '';
      состояние.поиск = '';
      $('поиск-сброс').hidden = true;
      нарисовать_сетку();
    });
    $('к-контактам').addEventListener('click', function () {
      document.querySelector('.подвал').scrollIntoView({ behavior: 'smooth' });
    });

    $('назад-товар').addEventListener('click', назад);
    $('назад-заявка').addEventListener('click', назад);
    $('товар-заявка').addEventListener('click', function () { открыть_заявку(); });
    $('товар-похожие').addEventListener('click', function () {
      состояние.группа = (состояние.товар || {}).groupCode || 'все';
      нарисовать_группы();
      нарисовать_сетку();
      состояние.стек = [];
      скрыть($('экран-товар'));
      if (Мост && Мост.BackButton) { try { Мост.BackButton.hide(); } catch (е) {} }
      window.scrollTo(0, 0);
    });
    $('готово-каталог').addEventListener('click', function () {
      состояние.стек = [];
      скрыть($('экран-готово'));
      window.scrollTo(0, 0);
    });

    $('форма').addEventListener('submit', отправить_форму);
    if (Мост && Мост.requestContact) {
      показать($('кнопка-номер'));
      $('кнопка-номер').addEventListener('click', запросить_телефон);
    }

    if (Мост && Мост.BackButton && Мост.BackButton.onClick) {
      try {
        Мост.BackButton.onClick(function () {
          if (состояние.стек.length) назад();
        });
      } catch (е) {}
    }
    if (Мост && Мост.getViewportSize) {
      try {
        Мост.getViewportSize().then(function (р) {
          if (р && р.height) {
            document.documentElement.style.setProperty('--вьюпорт', р.height + 'px');
          }
        });
      } catch (е) {}
    }
    if (Мост && Мост.expand) { try { Мост.expand(); } catch (е) {} }
    if (Мост && Мост.ready) { try { Мост.ready(); } catch (е) {} }

    // Диплинк: сразу открыть карточку товара или форму заявки.
    if (состояние.стартовый_товар) {
      открыть_товар(состояние.стартовый_товар);
      состояние.стартовый_товар = null;
      if (состояние.стартовая_форма) {
        состояние.стартовая_форма = false;
        открыть_заявку();
      }
    } else if (состояние.стартовая_форма) {
      состояние.стартовая_форма = false;
      открыть_заявку();
    }

    window.АЛЬФА = { состояние: состояние, вМаксе: вМаксе, отправить_форму: отправить_форму };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', запуск);
  } else {
    запуск();
  }
})();
