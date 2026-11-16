/* ==========================================================================
   고졸 검정고시 파인만 어휘·한자 서재 — Main Editorial Book Application (app.js)
   순수 Vanilla JS (defer 로드, file:// 및 GitHub Pages 완벽 호환)
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_THEME_KEY = 'ged_feynman_theme';
  var STORAGE_STUDY_KEY = 'ged_feynman_study_v1';

  var CHOSEONG_LIST = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  var CANONICAL_ROOT_CATEGORIES = [
    '생각·관점',
    '방향·변화',
    '사회·권리',
    '수량·관계',
    '자연·과학'
  ];

  var OPTION_CIRCLES = ['①', '②', '③', '④', '⑤'];

  /* ------------------------------------------------------------------------
     Safe Storage Wrapper (graceful fallback if localStorage is restricted)
     ------------------------------------------------------------------------ */
  var memoryStore = {};
  var SafeStorage = {
    get: function (key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (e) {}
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    set: function (key, value) {
      memoryStore[key] = String(value);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, String(value));
        }
      } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------------
     String, HTML Escaping & Korean Choseong Helpers
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getChoseong(str) {
    if (!str) return '';
    var out = '';
    var text = String(str);
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code >= 0xac00 && code <= 0xd7a3) {
        var idx = Math.floor((code - 0xac00) / 588);
        out += CHOSEONG_LIST[idx] || text.charAt(i);
      } else {
        out += text.charAt(i);
      }
    }
    return out;
  }

  function normalizeKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .trim();
  }

  function extractCjkChars(str) {
    if (!str) return [];
    var matches = String(str).match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g);
    if (!matches) return [];
    var seen = {};
    var unique = [];
    for (var i = 0; i < matches.length; i++) {
      if (!seen[matches[i]]) {
        seen[matches[i]] = true;
        unique.push(matches[i]);
      }
    }
    return unique;
  }

  function highlightTermInText(text, term) {
    var safeText = escapeHtml(text);
    var cleanTerm = String(term || '').trim();
    if (!cleanTerm || cleanTerm.length < 2) return safeText;
    var escapedTerm = escapeHtml(cleanTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      var re = new RegExp('(' + escapedTerm + ')', 'g');
      return safeText.replace(re, '<mark class="exam-highlight">$1</mark>');
    } catch (e) {
      return safeText;
    }
  }

  function renderImportanceStars(level) {
    var n = Math.min(5, Math.max(1, Number(level) || 4));
    var filled = '';
    var empty = '';
    for (var i = 0; i < n; i++) filled += '★';
    for (var j = n; j < 5; j++) empty += '☆';
    return filled + empty;
  }

  function renderBookSpine() {
    return (
      '<div class="book-spine" aria-hidden="true">' +
        '<span class="book-spine__stitch"></span>' +
        '<span class="book-spine__stitch"></span>' +
        '<span class="book-spine__stitch"></span>' +
        '<span class="book-spine__stitch"></span>' +
        '<span class="book-spine__stitch"></span>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------------
     Defensive Book Data Normalization & Cross-Reference Indexing
     ------------------------------------------------------------------------ */
  function buildNormalizedBook(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var rawChapters = Array.isArray(source.chapters) ? source.chapters.slice() : [];

    rawChapters.sort(function (a, b) {
      return (Number(a && a.order) || 0) - (Number(b && b.order) || 0);
    });

    var entryById = {};
    var entriesByTerm = {};
    var entriesByHanjaChar = {};
    var allEntries = [];

    var chapters = rawChapters.map(function (ch, cIdx) {
      var chId = String((ch && ch.id) || 'ch' + (cIdx + 1));
      var chOrder = Number(ch && ch.order) || (cIdx + 1);
      var chNumber = String((ch && ch.number) || '제' + chOrder + '장');
      var themeColorVar =
        chId === 'ch1' ? 'var(--ch1-color)' :
        chId === 'ch2' ? 'var(--ch2-color)' :
        chId === 'ch3' ? 'var(--ch3-color)' :
        chId === 'ch4' ? 'var(--ch4-color)' :
        String((ch && ch.accentColor) || 'var(--cinnabar)');

      var rawEntries = Array.isArray(ch && ch.entries) ? ch.entries : [];
      var entries = rawEntries.map(function (item, eIdx) {
        var entryId = String((item && item.id) || (chId + '-' + String(eIdx + 1).padStart(2, '0')));
        if (entryById[entryId]) {
          entryId = entryId + '-' + (eIdx + 1);
        }
        var term = String((item && item.term) || '표제어');
        var hanja = String((item && item.hanja) || '');
        var reading = String((item && item.reading) || '');
        var subject = String((item && item.subject) || (ch && ch.subjectBadge) || '공통');
        var importance = Math.min(5, Math.max(1, Number(item && item.importance) || 4));
        var oneLiner = String((item && item.oneLiner) || '');

        var breakdown = Array.isArray(item && item.hanjaBreakdown)
          ? item.hanjaBreakdown.map(function (b) {
              return {
                char: String((b && b.char) || ''),
                hunEum: String((b && b.hunEum) || ''),
                rootStory: String((b && b.rootStory) || '')
              };
            })
          : [];

        var feynmanRaw = (item && item.feynman && typeof item.feynman === 'object') ? item.feynman : {};
        var feynman = {
          simple: String(feynmanRaw.simple || oneLiner || ''),
          analogy: String(feynmanRaw.analogy || ''),
          examTrap: String(feynmanRaw.examTrap || ''),
          selfCheckPrompt: String(feynmanRaw.selfCheckPrompt || ('"' + term + '"의 뜻을 동생에게 한 문장으로 설명해 볼까요?')),
          selfCheckAnswer: String(feynmanRaw.selfCheckAnswer || oneLiner || '')
        };

        var examExample = String((item && item.examExample) || '');
        var relatedTerms = Array.isArray(item && item.relatedTerms)
          ? item.relatedTerms.map(function (r) { return String(r || '').trim(); }).filter(Boolean)
          : [];

        var breakdownText = breakdown.map(function (b) {
          return b.char + ' ' + b.hunEum + ' ' + b.rootStory;
        }).join(' ');

        var plainSearch = [
          term,
          term.replace(/\s+/g, ''),
          hanja,
          reading,
          subject,
          oneLiner,
          breakdownText,
          feynman.simple,
          feynman.analogy,
          feynman.examTrap,
          examExample,
          relatedTerms.join(' ')
        ].join(' ').toLowerCase();

        var choseongSearch = getChoseong(term + ' ' + term.replace(/\s+/g, '') + ' ' + reading + ' ' + relatedTerms.join(' '));

        var normalizedEntry = {
          id: entryId,
          chapterId: chId,
          chapterNumber: chNumber,
          chapterTitle: String((ch && ch.title) || chNumber),
          chapterColor: themeColorVar,
          indexInChapter: eIdx,
          term: term,
          hanja: hanja,
          reading: reading,
          subject: subject,
          importance: importance,
          oneLiner: oneLiner,
          hanjaBreakdown: breakdown,
          feynman: feynman,
          examExample: examExample,
          relatedTerms: relatedTerms,
          _searchBlob: plainSearch,
          _choseongBlob: choseongSearch
        };

        entryById[entryId] = normalizedEntry;
        allEntries.push(normalizedEntry);

        var tKey = normalizeKey(term);
        if (tKey) {
          if (!entriesByTerm[tKey]) entriesByTerm[tKey] = [];
          entriesByTerm[tKey].push(normalizedEntry);
        }

        var chars = extractCjkChars(hanja + breakdown.map(function (b) { return b.char; }).join(''));
        chars.forEach(function (chChar) {
          if (!entriesByHanjaChar[chChar]) entriesByHanjaChar[chChar] = [];
          if (entriesByHanjaChar[chChar].indexOf(normalizedEntry) === -1) {
            entriesByHanjaChar[chChar].push(normalizedEntry);
          }
        });

        return normalizedEntry;
      });

      return {
        id: chId,
        number: chNumber,
        order: chOrder,
        subjectBadge: String((ch && ch.subjectBadge) || '검정고시 핵심'),
        title: String((ch && ch.title) || chNumber),
        subtitle: String((ch && ch.subtitle) || ''),
        accentColor: String((ch && ch.accentColor) || '#8B3A2B'),
        themeColor: themeColorVar,
        epigraph: String((ch && ch.epigraph) || ''),
        entries: entries
      };
    });

    /* Normalize hanjaRoots (supports both feynmanTip and feynnmanTip) */
    var rootByChar = {};
    var rawRoots = Array.isArray(source.hanjaRoots) ? source.hanjaRoots : [];
    var hanjaRoots = rawRoots.map(function (r, idx) {
      var charStr = String((r && r.char) || '');
      var derived = Array.isArray(r && r.derivedWords)
        ? r.derivedWords.map(function (dw) {
            return {
              word: String((dw && dw.word) || ''),
              hanja: String((dw && dw.hanja) || ''),
              literal: String((dw && dw.literal) || ''),
              meaning: String((dw && dw.meaning) || ''),
              subject: String((dw && dw.subject) || '')
            };
          })
        : [];
      var tip = String((r && (r.feynmanTip || r.feynnmanTip)) || '');
      var hunEum = String((r && r.hunEum) || '');
      var story = String((r && r.pictographStory) || '');
      var category = String((r && r.category) || '기타');

      var derivedText = derived.map(function (d) {
        return d.word + ' ' + d.hanja + ' ' + d.literal + ' ' + d.meaning;
      }).join(' ');

      var rootObj = {
        id: String((r && r.id) || ('root-' + String(idx + 1).padStart(2, '0'))),
        char: charStr,
        hunEum: hunEum,
        category: category,
        pictographStory: story,
        feynmanTip: tip,
        derivedWords: derived,
        _searchBlob: (charStr + ' ' + hunEum + ' ' + category + ' ' + story + ' ' + tip + ' ' + derivedText).toLowerCase(),
        _choseongBlob: getChoseong(hunEum + ' ' + derived.map(function (d) { return d.word; }).join(' '))
      };

      if (charStr) {
        rootByChar[charStr] = rootObj;
        extractCjkChars(charStr).forEach(function (c) {
          if (!rootByChar[c]) rootByChar[c] = rootObj;
        });
      }
      return rootObj;
    });

    /* Normalize confusables */
    var rawConfusables = Array.isArray(source.confusables) ? source.confusables : [];
    var confusables = rawConfusables.map(function (pair, idx) {
      var left = (pair && pair.left && typeof pair.left === 'object') ? pair.left : {};
      var right = (pair && pair.right && typeof pair.right === 'object') ? pair.right : {};
      var leftTerm = String(left.term || '');
      var rightTerm = String(right.term || '');
      return {
        id: String((pair && pair.id) || ('pair-' + String(idx + 1).padStart(2, '0'))),
        subject: String((pair && pair.subject) || '공통'),
        left: {
          term: leftTerm,
          hanja: String(left.hanja || ''),
          core: String(left.core || ''),
          example: String(left.example || '')
        },
        right: {
          term: rightTerm,
          hanja: String(right.hanja || ''),
          core: String(right.core || ''),
          example: String(right.example || '')
        },
        oneSecondRule: String((pair && pair.oneSecondRule) || ''),
        _searchBlob: [
          leftTerm, left.hanja, left.core, rightTerm, right.hanja, right.core, pair && pair.oneSecondRule
        ].join(' ').toLowerCase(),
        _choseongBlob: getChoseong(leftTerm + ' ' + rightTerm)
      };
    });

    /* Normalize drills */
    var rawDrills = Array.isArray(source.drills) ? source.drills : [];
    var drills = rawDrills.map(function (d, idx) {
      var opts = Array.isArray(d && d.options)
        ? d.options.map(function (o) { return String(o || ''); })
        : [];
      var ansIdx = Number(d && d.answerIndex);
      if (isNaN(ansIdx) || ansIdx < 0 || ansIdx >= Math.max(1, opts.length)) {
        ansIdx = 0;
      }
      return {
        id: String((d && d.id) || ('drill-' + String(idx + 1).padStart(2, '0'))),
        subject: String((d && d.subject) || '공통'),
        question: String((d && d.question) || ''),
        options: opts,
        answerIndex: ansIdx,
        feynmanExplain: String((d && d.feynmanExplain) || '')
      };
    });

    return {
      chapters: chapters,
      allEntries: allEntries,
      entryById: entryById,
      entriesByTerm: entriesByTerm,
      entriesByHanjaChar: entriesByHanjaChar,
      hanjaRoots: hanjaRoots,
      rootByChar: rootByChar,
      confusables: confusables,
      drills: drills
    };
  }

  /* ------------------------------------------------------------------------
     Study State Management
     ------------------------------------------------------------------------ */
  function createDefaultStudy() {
    return {
      mastery: {},
      bookmarks: [],
      notes: {},
      lastRead: null,
      readerViewMode: 'spread',
      globalSlipMode: false,
      drillHistory: {},
      wrongDrillIds: []
    };
  }

  function loadStudyState() {
    var base = createDefaultStudy();
    var raw = SafeStorage.get(STORAGE_STUDY_KEY);
    if (!raw) return base;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return base;
      return {
        mastery: (parsed.mastery && typeof parsed.mastery === 'object') ? parsed.mastery : {},
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks.filter(Boolean) : [],
        notes: (parsed.notes && typeof parsed.notes === 'object') ? parsed.notes : {},
        lastRead: (parsed.lastRead && typeof parsed.lastRead === 'object') ? parsed.lastRead : null,
        readerViewMode: parsed.readerViewMode === 'anthology' ? 'anthology' : 'spread',
        globalSlipMode: Boolean(parsed.globalSlipMode),
        drillHistory: (parsed.drillHistory && typeof parsed.drillHistory === 'object') ? parsed.drillHistory : {},
        wrongDrillIds: Array.isArray(parsed.wrongDrillIds) ? parsed.wrongDrillIds.filter(Boolean) : []
      };
    } catch (e) {
      return base;
    }
  }

  /* ------------------------------------------------------------------------
     Main Book Application Controller
     ------------------------------------------------------------------------ */
  function initApp() {
    var book = buildNormalizedBook(typeof window !== 'undefined' ? window.GED_BOOK : null);
    var study = loadStudyState();

    var ui = {
      activeTab: 'cover', // 'cover' | 'ch1'..'ch4' | 'all' | 'roots' | 'confusables' | 'drills' | 'library'
      currentEntryId: book.allEntries[0] ? book.allEntries[0].id : null,
      chapterFilterSubject: 'all',
      chapterFilterImportance: 'all',
      chapterFilterMastery: 'all',
      chapterSearchQuery: '',
      spreadSlipPeeled: false,
      manualSlipActive: false,
      revealedSelfChecks: {},
      justStampedId: null,
      jumpHistory: [],

      /* Roots state */
      rootCategory: '전체',
      rootSearchQuery: '',
      selectedRootId: book.hanjaRoots[0] ? book.hanjaRoots[0].id : null,

      /* Confusables state */
      confusableSubject: '전체',
      confusableBlindMode: false,
      revealedPairIds: {},

      /* Drills state */
      drillSubject: '전체',
      drillRetryWrongOnly: false,

      /* Library state */
      librarySubTab: 'bookmarks' // 'bookmarks' | 'unmastered' | 'mastered' | 'notes'
    };

    /* DOM References */
    var dom = {
      viewport: document.getElementById('bookViewport'),
      foreEdgeTabs: document.getElementById('foreEdgeTabs'),
      mobileIndexTabs: document.getElementById('mobileIndexTabs'),
      btnHomeBrand: document.getElementById('btnHomeBrand'),
      btnTopResume: document.getElementById('btnTopResume'),
      topResumeLabel: document.getElementById('topResumeLabel'),
      physicalRibbon: document.getElementById('physicalRibbon'),
      silkRibbonLabel: document.getElementById('silkRibbonLabel'),
      globalSearchInput: document.getElementById('globalSearchInput'),
      btnClearGlobalSearch: document.getElementById('btnClearGlobalSearch'),
      globalSearchPopover: document.getElementById('globalSearchPopover'),
      btnGlobalSlipToggle: document.getElementById('btnGlobalSlipToggle'),
      globalSlipStateText: document.getElementById('globalSlipStateText'),
      themeBtns: document.querySelectorAll('[data-theme-choice]'),
      btnShortcutHelp: document.getElementById('btnShortcutHelp'),
      shortcutModal: document.getElementById('shortcutModal'),
      shortcutModalBackdrop: document.getElementById('shortcutModalBackdrop'),
      btnCloseShortcutModal: document.getElementById('btnCloseShortcutModal'),
      hanjaDrawer: document.getElementById('hanjaDrawer'),
      hanjaDrawerBackdrop: document.getElementById('hanjaDrawerBackdrop'),
      hanjaDrawerEyebrow: document.getElementById('hanjaDrawerEyebrow'),
      hanjaDrawerTitle: document.getElementById('hanjaDrawerTitle'),
      hanjaDrawerBody: document.getElementById('hanjaDrawerBody'),
      btnCloseHanjaDrawer: document.getElementById('btnCloseHanjaDrawer'),
      backupFileInput: document.getElementById('backupFileInput'),
      inkToast: document.getElementById('inkToast')
    };

    if (!dom.viewport) return;

    var toastTimer = null;
    function showToast(msg) {
      if (!dom.inkToast) return;
      dom.inkToast.textContent = msg;
      dom.inkToast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        dom.inkToast.hidden = true;
      }, 2400);
    }

    function saveStudy() {
      SafeStorage.set(STORAGE_STUDY_KEY, JSON.stringify(study));
      syncTopChrome();
    }

    /* ----------------------------------------------------------------------
       Theme Handling
       ---------------------------------------------------------------------- */
    function applyTheme(themeName) {
      var valid = (themeName === 'sepia' || themeName === 'midnight') ? themeName : 'hanji';
      document.documentElement.setAttribute('data-theme', valid);
      SafeStorage.set(STORAGE_THEME_KEY, valid);
      for (var i = 0; i < dom.themeBtns.length; i++) {
        var btn = dom.themeBtns[i];
        var isMatch = btn.getAttribute('data-theme-choice') === valid;
        btn.classList.toggle('is-active', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      }
    }

    var initialTheme = SafeStorage.get(STORAGE_THEME_KEY) || 'hanji';
    applyTheme(initialTheme);

    /* ----------------------------------------------------------------------
       Navigation Tabs & Chrome Sync
       ---------------------------------------------------------------------- */
    function getNavItems() {
      var items = [
        { id: 'cover', code: '表', label: '표지 · 차례', accent: 'var(--cinnabar)' }
      ];
      book.chapters.forEach(function (ch, idx) {
        var shortLabels = ['독해·발문', '문학·성어', '사회·도덕', '한국사·과학'];
        items.push({
          id: ch.id,
          code: String(idx + 1) + '장',
          label: ch.number + ' · ' + (shortLabels[idx] || ch.title.slice(0, 5)),
          accent: ch.themeColor
        });
      });
      items.push(
        { id: 'roots', code: '根', label: '뿌리 한자', accent: 'var(--pine-green)' },
        { id: 'confusables', code: '對', label: '쌍둥이 대결', accent: 'var(--amber-gold)' },
        { id: 'drills', code: '試', label: '실전 해독', accent: 'var(--indigo-ink)' },
        { id: 'library', code: '藏', label: '내 서재', accent: 'var(--cinnabar)' }
      );
      return items;
    }

    function renderNavigationTabs() {
      var navItems = getNavItems();
      var activeCompare = ui.activeTab === 'all' ? 'ch1' : ui.activeTab;

      if (dom.foreEdgeTabs) {
        dom.foreEdgeTabs.innerHTML = navItems.map(function (item) {
          var isActive = item.id === activeCompare;
          return (
            '<button type="button" class="fore-tab' + (isActive ? ' is-active' : '') + '" ' +
              'data-nav-tab="' + escapeHtml(item.id) + '" ' +
              'style="--tab-accent:' + escapeHtml(item.accent) + '" ' +
              (isActive ? 'aria-current="page"' : '') + '>' +
              '<span class="fore-tab__code">' + escapeHtml(item.code) + '</span>' +
              '<span class="fore-tab__label">' + escapeHtml(item.label) + '</span>' +
            '</button>'
          );
        }).join('');
      }

      if (dom.mobileIndexTabs) {
        dom.mobileIndexTabs.innerHTML = navItems.map(function (item) {
          var isActive = item.id === activeCompare;
          return (
            '<button type="button" class="mobile-tab' + (isActive ? ' is-active' : '') + '" ' +
              'data-nav-tab="' + escapeHtml(item.id) + '" ' +
              (isActive ? 'aria-current="page"' : '') + '>' +
              '<span>' + escapeHtml(item.label) + '</span>' +
            '</button>'
          );
        }).join('');
      }
    }

    function isChapterTab(tabId) {
      if (tabId === 'all') return true;
      return book.chapters.some(function (c) { return c.id === tabId; });
    }

    function syncTopChrome() {
      /* Global Slip Toggle */
      if (dom.btnGlobalSlipToggle && dom.globalSlipStateText) {
        dom.btnGlobalSlipToggle.setAttribute('aria-pressed', study.globalSlipMode ? 'true' : 'false');
        dom.globalSlipStateText.textContent = study.globalSlipMode ? '켜짐' : '꺼짐';
      }

      /* Top Resume Button */
      var last = study.lastRead && study.lastRead.entryId ? book.entryById[study.lastRead.entryId] : null;
      if (dom.btnTopResume && dom.topResumeLabel) {
        if (last && (!isChapterTab(ui.activeTab) || ui.currentEntryId !== last.id)) {
          dom.btnTopResume.hidden = false;
          dom.topResumeLabel.textContent = '이어 읽기: ' + last.term;
        } else {
          dom.btnTopResume.hidden = true;
        }
      }

      /* Physical Red Silk Ribbon */
      if (dom.physicalRibbon && dom.silkRibbonLabel) {
        if (isChapterTab(ui.activeTab) && study.readerViewMode === 'spread' && ui.currentEntryId) {
          var isBookmarked = study.bookmarks.indexOf(ui.currentEntryId) !== -1;
          dom.physicalRibbon.classList.toggle('is-pinned', isBookmarked);
          dom.silkRibbonLabel.textContent = isBookmarked ? '책갈피 꽂힘 (클릭 시 해제)' : '이 페이지에 책갈피 꽂기 [B]';
        } else if (last) {
          dom.physicalRibbon.classList.add('is-pinned');
          dom.silkRibbonLabel.textContent = '이어 읽기 · ' + last.term;
        } else {
          dom.physicalRibbon.classList.remove('is-pinned');
          dom.silkRibbonLabel.textContent = '제1장 첫 책장 펼치기';
        }
      }
    }

    function recordLastRead(entry) {
      if (!entry) return;
      study.lastRead = {
        chapterId: entry.chapterId,
        entryId: entry.id,
        term: entry.term,
        hanja: entry.hanja,
        updatedAt: Date.now()
      };
      saveStudy();
    }

    /* ----------------------------------------------------------------------
       Filtering Logic for Chapter Reader
       ---------------------------------------------------------------------- */
    function matchesSearchQuery(searchBlob, choseongBlob, rawQuery) {
      var q = String(rawQuery || '').trim().toLowerCase();
      if (!q) return true;
      var compactQ = q.replace(/\s+/g, '');
      if (searchBlob.indexOf(q) !== -1 || searchBlob.indexOf(compactQ) !== -1) {
        return true;
      }
      if (choseongBlob && (choseongBlob.indexOf(q) !== -1 || choseongBlob.indexOf(compactQ) !== -1)) {
        return true;
      }
      return false;
    }

    function getActiveChapterEntries() {
      var pool = [];
      if (ui.activeTab === 'all') {
        pool = book.allEntries;
      } else {
        var foundChapter = book.chapters.filter(function (c) { return c.id === ui.activeTab; })[0];
        pool = foundChapter ? foundChapter.entries : book.allEntries;
      }

      return pool.filter(function (entry) {
        if (ui.chapterFilterSubject !== 'all') {
          if (entry.subject.indexOf(ui.chapterFilterSubject) === -1) return false;
        }
        if (ui.chapterFilterImportance === '5' && entry.importance < 5) return false;
        if (ui.chapterFilterImportance === '4+' && entry.importance < 4) return false;

        var mLevel = Number(study.mastery[entry.id] || 0);
        if (ui.chapterFilterMastery === 'unmastered' && mLevel === 3) return false;
        if (ui.chapterFilterMastery === '1' && mLevel !== 1) return false;
        if (ui.chapterFilterMastery === '2' && mLevel !== 2) return false;
        if (ui.chapterFilterMastery === '3' && mLevel !== 3) return false;
        if (ui.chapterFilterMastery === 'bookmarked' && study.bookmarks.indexOf(entry.id) === -1) return false;

        if (ui.chapterSearchQuery) {
          if (!matchesSearchQuery(entry._searchBlob, entry._choseongBlob, ui.chapterSearchQuery)) {
            return false;
          }
        }
        return true;
      });
    }

    function extractSubjectOptions(entries) {
      var map = {};
      var list = [];
      entries.forEach(function (e) {
        String(e.subject || '')
          .split(/[·,/|]/)
          .map(function (s) { return s.trim(); })
          .filter(Boolean)
          .forEach(function (token) {
            if (!map[token]) {
              map[token] = true;
              list.push(token);
            }
          });
      });
      return list;
    }

    /* ----------------------------------------------------------------------
       Navigation Actions
       ---------------------------------------------------------------------- */
    function openEntry(entryId, options) {
      var opts = options || {};
      var entry = book.entryById[entryId];
      if (!entry) return;

      if (opts.pushHistory && ui.currentEntryId && ui.currentEntryId !== entry.id && isChapterTab(ui.activeTab)) {
        ui.jumpHistory.push(ui.currentEntryId);
        if (ui.jumpHistory.length > 12) ui.jumpHistory.shift();
      }

      if (opts.keepAllScope && ui.activeTab === 'all') {
        ui.activeTab = 'all';
      } else {
        ui.activeTab = entry.chapterId;
      }

      if (opts.resetFilters) {
        ui.chapterFilterSubject = 'all';
        ui.chapterFilterImportance = 'all';
        ui.chapterFilterMastery = 'all';
        ui.chapterSearchQuery = '';
      }

      if (opts.forceSpread) {
        study.readerViewMode = 'spread';
      }

      ui.currentEntryId = entry.id;
      ui.spreadSlipPeeled = false;
      ui.manualSlipActive = false;
      recordLastRead(entry);
      renderNavigationTabs();
      renderActiveSection();
    }

    function switchTab(tabId) {
      if (isChapterTab(tabId)) {
        var changedChapter = ui.activeTab !== tabId;
        ui.activeTab = tabId;
        if (changedChapter) {
          ui.chapterFilterSubject = 'all';
          ui.chapterFilterImportance = 'all';
          ui.chapterFilterMastery = 'all';
          ui.chapterSearchQuery = '';
          var ch = book.chapters.filter(function (c) { return c.id === tabId; })[0];
          if (ch && ch.entries.length > 0) {
            /* If lastRead was inside this chapter, land on that entry, else first entry */
            var lastInCh = (study.lastRead && study.lastRead.chapterId === tabId && book.entryById[study.lastRead.entryId])
              ? study.lastRead.entryId
              : ch.entries[0].id;
            ui.currentEntryId = lastInCh;
            ui.spreadSlipPeeled = false;
            ui.manualSlipActive = false;
            recordLastRead(book.entryById[ui.currentEntryId]);
          }
        }
      } else {
        ui.activeTab = tabId;
      }
      renderNavigationTabs();
      syncTopChrome();
      renderActiveSection();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ----------------------------------------------------------------------
       Section 1: Cover, Preface & Table of Contents (표지 · 차례)
       ---------------------------------------------------------------------- */
    function renderCoverSection() {
      var totalEntries = book.allEntries.length;
      var masteredCount = 0;
      var familiarCount = 0;
      var seenCount = 0;

      book.allEntries.forEach(function (e) {
        var lv = Number(study.mastery[e.id] || 0);
        if (lv === 3) masteredCount++;
        else if (lv === 2) familiarCount++;
        else if (lv === 1) seenCount++;
      });

      var noteCount = Object.keys(study.notes).filter(function (k) {
        return String(study.notes[k] || '').trim().length > 0;
      }).length;

      var pctMastered = totalEntries ? Math.round((masteredCount / totalEntries) * 100) : 0;
      var wMastered = totalEntries ? ((masteredCount / totalEntries) * 100).toFixed(1) : '0';
      var wFamiliar = totalEntries ? ((familiarCount / totalEntries) * 100).toFixed(1) : '0';
      var wSeen = totalEntries ? ((seenCount / totalEntries) * 100).toFixed(1) : '0';

      var lastEntry = study.lastRead && study.lastRead.entryId ? book.entryById[study.lastRead.entryId] : null;
      var firstEntry = book.allEntries[0] || null;

      var continueHtml = '';
      if (lastEntry) {
        continueHtml =
          '<button type="button" class="continue-card" data-open-entry="' + escapeHtml(lastEntry.id) + '">' +
            '<span>' +
              '<span class="continue-card__eyebrow">빨간 책갈피가 꽂힌 마지막 독서 위치</span>' +
              '<span class="continue-card__title">' +
                escapeHtml(lastEntry.chapterNumber) + ' · ' + escapeHtml(lastEntry.term) +
                (lastEntry.hanja ? ' (' + escapeHtml(lastEntry.hanja) + ')' : '') +
              '</span>' +
            '</span>' +
            '<span class="continue-card__arrow">이어 펼치기 →</span>' +
          '</button>';
      } else if (firstEntry) {
        continueHtml =
          '<button type="button" class="continue-card" data-open-entry="' + escapeHtml(firstEntry.id) + '">' +
            '<span>' +
              '<span class="continue-card__eyebrow">처음을 여는 첫 책장</span>' +
              '<span class="continue-card__title">제1장 첫 단어 «' + escapeHtml(firstEntry.term) + '»부터 기분 좋게 펼쳐보기</span>' +
            '</span>' +
            '<span class="continue-card__arrow">책 펼치기 →</span>' +
          '</button>';
      }

      var chapterCardsHtml = book.chapters.map(function (ch) {
        var chMastered = ch.entries.filter(function (e) { return Number(study.mastery[e.id]) === 3; }).length;
        return (
          '<button type="button" class="toc-card" data-nav-tab="' + escapeHtml(ch.id) + '" style="--card-accent:' + escapeHtml(ch.themeColor) + '">' +
            '<div>' +
              '<div class="toc-card__meta">' +
                '<span class="toc-card__num">' + escapeHtml(ch.number) + '</span>' +
                '<span>·</span>' +
                '<span>' + escapeHtml(ch.subjectBadge) + '</span>' +
              '</div>' +
              '<span class="toc-card__title">' + escapeHtml(ch.title) + '</span>' +
              (ch.subtitle ? '<span class="toc-card__sub">' + escapeHtml(ch.subtitle) + '</span>' : '') +
            '</div>' +
            '<div class="toc-card__right">' +
              '<span class="toc-card__count">' + ch.entries.length + '어휘</span>' +
              '<div style="margin-top:4px;">💮 ' + chMastered + '/' + ch.entries.length + '</div>' +
            '</div>' +
          '</button>'
        );
      }).join('');

      dom.viewport.innerHTML =
        '<div class="book-spread">' +
          /* Left Page: Title Frame & Preface */
          '<section class="book-page book-page--left" aria-label="속표지 및 머리말">' +
            '<div class="cover-frame">' +
              '<div class="cover-frame__inner">' +
                '<div class="cover-edition-row">' +
                  '<span class="edition-tag">個人藏書 · 파인만 양장본 개념 노트</span>' +
                  '<div class="carved-seal" aria-hidden="true"><span>格</span><span>物</span><span>致</span><span>知</span></div>' +
                '</div>' +

                '<h1 class="cover-main-title">고졸 검정고시<br><span>파인만 어휘 · 한자</span> 서재</h1>' +
                '<p class="cover-subtitle">무작정 외우지 않고 한자 속뜻 블록을 쪼개어,<br>초등학생 동생에게 이야기하듯 내 말로 깨우치는 개인 과외책</p>' +

                continueHtml +

                '<div class="preface-box">' +
                  '<h2 class="preface-box__heading">머리말 — 왜 암기 대신 ‘한자 해부 + 파인만 말하기’일까요?</h2>' +
                  '<p>검정고시 시험지를 펼쳤을 때 문제를 틀리는 가장 흔한 이유는 지식이 부족해서가 아니라, 발문과 선지에 숨은 <strong>낯선 한자어 암호</strong>에서 발목이 잡히기 때문입니다. 예를 들어 ‘귀납(歸納)’을 통째로 외우려 하면 닷새 만에 잊히지만, ‘결론으로 돌아가(歸) 수납장에 차곡차곡 들인다(納)’고 쪼개 보면 평생 잊히지 않습니다.</p>' +
                  '<p>노벨 물리학상 수상자 리처드 파인만은 <em>“어려운 전문용어를 쓰지 않고 초등학생에게 쉽게 설명할 수 없다면, 아직 진짜 아는 것이 아니다”</em>라고 말했습니다. 전부 다 외우려 애쓰지 않아도 괜찮습니다. 오늘 마음이 가는 단어 두세 개만 골라 종이 가림막을 덮고 혼잣말로 중얼거려 보세요.</p>' +
                  '<ul class="preface-steps">' +
                    '<li><strong>1단계 · 한자 레고 분해</strong> — 왼쪽 면에서 글자마다 담긴 그림과 속뜻을 확인합니다.</li>' +
                    '<li><strong>2단계 · 파인만 비유 읽기</strong> — 오른쪽 면의 쉬운 풀이와 일상 비유로 고개를 끄덕입니다.</li>' +
                    '<li><strong>3단계 · 종이 가림막(<kbd>Space</kbd>)</strong> — 한지 가림막을 덮고 내 입으로 직접 설명해 봅니다.</li>' +
                    '<li><strong>4단계 · 붉은 통달 인장(💮)</strong> — 막힘없이 설명되면 전각 도장을 쾅 찍고 여백 메모를 남깁니다.</li>' +
                  '</ul>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>' +

          renderBookSpine() +

          /* Right Page: Mastery Progress Ledger & Table of Contents */
          '<section class="book-page book-page--right" aria-label="서재 통달 기록부 및 차례">' +
            '<div class="page-running-head">' +
              '<span class="page-running-head__title">차례 (目錄) 및 나의 독파 기록</span>' +
              '<span>수록 어휘 ' + totalEntries + ' · 뿌리 한자 ' + book.hanjaRoots.length + '</span>' +
            '</div>' +

            '<div class="mastery-ledger">' +
              '<div class="mastery-ledger__top">' +
                '<h2 class="mastery-ledger__title">나의 파인만 통달 기록부</h2>' +
                '<span class="mastery-ledger__summary">통달률 ' + pctMastered + '% (' + masteredCount + ' / ' + totalEntries + ')</span>' +
              '</div>' +
              '<div class="ledger-bar" role="progressbar" aria-valuenow="' + pctMastered + '" aria-valuemin="0" aria-valuemax="100">' +
                '<div class="ledger-bar__seg--mastered" style="width:' + wMastered + '%"></div>' +
                '<div class="ledger-bar__seg--familiar" style="width:' + wFamiliar + '%"></div>' +
                '<div class="ledger-bar__seg--seen" style="width:' + wSeen + '%"></div>' +
              '</div>' +
              '<div class="ledger-stats">' +
                '<span>💮 파인만 통달 <strong>' + masteredCount + '</strong></span>' +
                '<span>🌿 익숙해짐 <strong>' + familiarCount + '</strong></span>' +
                '<span>🌱 처음 봄 <strong>' + seenCount + '</strong></span>' +
                '<span>🔖 책갈피 <strong>' + study.bookmarks.length + '</strong></span>' +
                '<span>✎ 여백 메모 <strong>' + noteCount + '</strong></span>' +
              '</div>' +
            '</div>' +

            '<h3 class="toc-section-label">본문 서재 · 제1장 ~ 제4장</h3>' +
            '<div class="toc-list">' +
              chapterCardsHtml +
            '</div>' +

            '<h3 class="toc-section-label">특별 부록 & 개인 서랍</h3>' +
            '<div class="toc-appendix-grid">' +
              '<button type="button" class="toc-mini-card" data-nav-tab="roots">' +
                '<span class="toc-mini-card__badge">부록 A · 한자 도감</span>' +
                '<span class="toc-mini-card__title">뿌리 한자 레고 도감</span>' +
                '<span class="toc-mini-card__desc">' + book.hanjaRoots.length + '개 핵심 한자로 파생 어휘 확장</span>' +
              '</button>' +
              '<button type="button" class="toc-mini-card" data-nav-tab="confusables">' +
                '<span class="toc-mini-card__badge">부록 B · 비교 대조</span>' +
                '<span class="toc-mini-card__title">쌍둥이 개념 VS 대결</span>' +
                '<span class="toc-mini-card__desc">' + book.confusables.length + '쌍 단골 함정 1초 구별 치트키</span>' +
              '</button>' +
              '<button type="button" class="toc-mini-card" data-nav-tab="drills">' +
                '<span class="toc-mini-card__badge">부록 C · 실전 훈련</span>' +
                '<span class="toc-mini-card__title">발문 · 문장 해독장</span>' +
                '<span class="toc-mini-card__desc">' + book.drills.length + '문항 미니 모의고사 & 오답 노트</span>' +
              '</button>' +
              '<button type="button" class="toc-mini-card" data-nav-tab="library">' +
                '<span class="toc-mini-card__badge">별책 · 개인 노트</span>' +
                '<span class="toc-mini-card__title">내 서재 (책갈피 · 메모)</span>' +
                '<span class="toc-mini-card__desc">미통달 복습 · 필사 노트 · 백업</span>' +
              '</button>' +
            '</div>' +
          '</section>' +
        '</div>';
    }

    /* ----------------------------------------------------------------------
       Section 2: Chapters 1–4 Reader (2-Page Spread & Scroll Anthology)
       ---------------------------------------------------------------------- */
    function renderChapterSection() {
      var activeCh = book.chapters.filter(function (c) { return c.id === ui.activeTab; })[0] || null;
      var basePool = activeCh ? activeCh.entries : book.allEntries;
      var subjectOptions = extractSubjectOptions(basePool);
      var chColor = activeCh ? activeCh.themeColor : 'var(--cinnabar)';

      var chSelectOptions =
        '<option value="all"' + (ui.activeTab === 'all' ? ' selected' : '') + '>전체 장 모아보기 (' + book.allEntries.length + ')</option>' +
        book.chapters.map(function (c) {
          return '<option value="' + escapeHtml(c.id) + '"' + (ui.activeTab === c.id ? ' selected' : '') + '>' +
            escapeHtml(c.number + ' · ' + c.title) + ' (' + c.entries.length + ')' +
          '</option>';
        }).join('');

      var subjectSelectOptions =
        '<option value="all"' + (ui.chapterFilterSubject === 'all' ? ' selected' : '') + '>모든 세부 과목</option>' +
        subjectOptions.map(function (sub) {
          return '<option value="' + escapeHtml(sub) + '"' + (ui.chapterFilterSubject === sub ? ' selected' : '') + '>' +
            escapeHtml(sub) +
          '</option>';
        }).join('');

      dom.viewport.innerHTML =
        '<div class="reader-shell" style="--active-ch-color:' + escapeHtml(chColor) + '">' +
          '<div class="reader-top-strip">' +
            '<div class="reader-chapter-row">' +
              '<div class="reader-chapter-info">' +
                '<div class="chapter-eyebrow">' +
                  '<span>' + escapeHtml(activeCh ? activeCh.number : '전 권 통합 열람') + '</span>' +
                  '<span class="chapter-eyebrow__badge">' + escapeHtml(activeCh ? activeCh.subjectBadge : '제1장 ~ 제4장 전체') + '</span>' +
                  (ui.jumpHistory.length > 0
                    ? '<button type="button" class="jump-back-btn" id="btnJumpBack">↩ 방금 보던 단어로 돌아가기</button>'
                    : '') +
                '</div>' +
                '<h1 class="reader-chapter-title">' + escapeHtml(activeCh ? activeCh.title : '검정고시 전 과목 핵심 어휘 모아보기') + '</h1>' +
                (activeCh && activeCh.epigraph
                  ? '<p class="reader-epigraph">“' + escapeHtml(activeCh.epigraph) + '”</p>'
                  : '') +
              '</div>' +

              '<div class="view-mode-group" role="group" aria-label="독서 보기 방식 전환">' +
                '<button type="button" class="view-mode-btn' + (study.readerViewMode === 'spread' ? ' is-active' : '') + '" data-reader-view="spread">📖 양면 펼침북</button>' +
                '<button type="button" class="view-mode-btn' + (study.readerViewMode === 'anthology' ? ' is-active' : '') + '" data-reader-view="anthology">📜 연속 독서 목록</button>' +
              '</div>' +
            '</div>' +

            '<div class="reader-filters">' +
              '<select class="filter-select" id="readerChapterSelect" aria-label="장 선택">' + chSelectOptions + '</select>' +
              '<select class="filter-select" id="readerSubjectSelect" aria-label="과목 필터">' + subjectSelectOptions + '</select>' +
              '<select class="filter-select" id="readerImportanceSelect" aria-label="출제 중요도 필터">' +
                '<option value="all"' + (ui.chapterFilterImportance === 'all' ? ' selected' : '') + '>모든 중요도</option>' +
                '<option value="5"' + (ui.chapterFilterImportance === '5' ? ' selected' : '') + '>★★★★★ 최빈출만</option>' +
                '<option value="4+"' + (ui.chapterFilterImportance === '4+' ? ' selected' : '') + '>★★★★☆ 이상</option>' +
              '</select>' +
              '<select class="filter-select" id="readerMasterySelect" aria-label="통달 상태 필터">' +
                '<option value="all"' + (ui.chapterFilterMastery === 'all' ? ' selected' : '') + '>모든 학습 상태</option>' +
                '<option value="unmastered"' + (ui.chapterFilterMastery === 'unmastered' ? ' selected' : '') + '>미통달 단어만 (복습용)</option>' +
                '<option value="1"' + (ui.chapterFilterMastery === '1' ? ' selected' : '') + '>🌱 처음 봄</option>' +
                '<option value="2"' + (ui.chapterFilterMastery === '2' ? ' selected' : '') + '>🌿 익숙해짐</option>' +
                '<option value="3"' + (ui.chapterFilterMastery === '3' ? ' selected' : '') + '>💮 통달 완료</option>' +
                '<option value="bookmarked"' + (ui.chapterFilterMastery === 'bookmarked' ? ' selected' : '') + '>🔖 책갈피 꽂은 단어</option>' +
              '</select>' +
              '<input type="search" class="filter-input" id="readerSearchInput" placeholder="장 내 단어·한자·초성 필터…" value="' + escapeHtml(ui.chapterSearchQuery) + '" autocomplete="off">' +
              '<span class="filter-count-badge" id="readerFilterCount"></span>' +
            '</div>' +
          '</div>' +

          '<div id="readerBodyRegion"></div>' +
        '</div>';

      renderReaderBodyOnly();
      bindReaderToolbarInputs();
    }

    function bindReaderToolbarInputs() {
      var chSel = document.getElementById('readerChapterSelect');
      var subSel = document.getElementById('readerSubjectSelect');
      var impSel = document.getElementById('readerImportanceSelect');
      var masSel = document.getElementById('readerMasterySelect');
      var searchIn = document.getElementById('readerSearchInput');
      var backBtn = document.getElementById('btnJumpBack');

      if (chSel) {
        chSel.addEventListener('change', function () {
          switchTab(chSel.value);
        });
      }
      if (subSel) {
        subSel.addEventListener('change', function () {
          ui.chapterFilterSubject = subSel.value;
          renderReaderBodyOnly();
        });
      }
      if (impSel) {
        impSel.addEventListener('change', function () {
          ui.chapterFilterImportance = impSel.value;
          renderReaderBodyOnly();
        });
      }
      if (masSel) {
        masSel.addEventListener('change', function () {
          ui.chapterFilterMastery = masSel.value;
          renderReaderBodyOnly();
        });
      }
      if (searchIn) {
        searchIn.addEventListener('input', function () {
          ui.chapterSearchQuery = searchIn.value;
          renderReaderBodyOnly();
        });
      }
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          var prevId = ui.jumpHistory.pop();
          if (prevId) openEntry(prevId, { resetFilters: true });
        });
      }
    }

    function renderReaderBodyOnly() {
      var bodyRegion = document.getElementById('readerBodyRegion');
      var countEl = document.getElementById('readerFilterCount');
      if (!bodyRegion) return;

      var entries = getActiveChapterEntries();
      if (countEl) {
        countEl.textContent = '열람 어휘 ' + entries.length + '개';
      }

      if (entries.length === 0) {
        bodyRegion.innerHTML =
          '<div class="book-sheet">' +
            '<div class="empty-state-box">' +
              '<p style="font-size:1.05rem;font-weight:700;margin:0 0 8px;">조건에 맞는 어휘가 이 장에 없습니다.</p>' +
              '<p style="margin:0 0 14px;font-size:0.88rem;">필터나 검색어를 초기화하면 모든 어휘 책장을 다시 볼 수 있습니다.</p>' +
              '<button type="button" class="filter-reset-btn" id="btnResetReaderFilters">필터 및 검색어 초기화</button>' +
            '</div>' +
          '</div>';
        var resetBtn = document.getElementById('btnResetReaderFilters');
        if (resetBtn) {
          resetBtn.addEventListener('click', function () {
            ui.chapterFilterSubject = 'all';
            ui.chapterFilterImportance = 'all';
            ui.chapterFilterMastery = 'all';
            ui.chapterSearchQuery = '';
            renderChapterSection();
          });
        }
        return;
      }

      /* Ensure currentEntryId is inside filtered entries */
      var currentIndex = -1;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].id === ui.currentEntryId) {
          currentIndex = i;
          break;
        }
      }
      if (currentIndex === -1) {
        currentIndex = 0;
        ui.currentEntryId = entries[0].id;
        ui.spreadSlipPeeled = false;
        ui.manualSlipActive = false;
      }

      if (study.readerViewMode === 'anthology') {
        renderAnthologyView(bodyRegion, entries);
      } else {
        renderSpreadView(bodyRegion, entries, currentIndex);
      }
      syncTopChrome();
    }

    function isSpreadCurrentlyVeiled() {
      if (study.globalSlipMode) {
        return !ui.spreadSlipPeeled;
      }
      return ui.manualSlipActive;
    }

    function renderSpreadView(container, entries, currentIndex) {
      var entry = entries[currentIndex];
      var prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
      var nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

      var masteryLevel = Number(study.mastery[entry.id] || 0);
      var isBookmarked = study.bookmarks.indexOf(entry.id) !== -1;
      var isVeiled = isSpreadCurrentlyVeiled();
      var isSelfAnswerOpen = Boolean(ui.revealedSelfChecks[entry.id]) || (study.globalSlipMode && ui.spreadSlipPeeled);
      var noteValue = String(study.notes[entry.id] || '');
      var isFreshStamp = ui.justStampedId === entry.id;
      ui.justStampedId = null;

      var breakdownHtml = entry.hanjaBreakdown.length > 0
        ? entry.hanjaBreakdown.map(function (b) {
            return (
              '<button type="button" class="hanja-cell" data-hanja-inspect="' + escapeHtml(b.char) + '" title="클릭하여 \'' + escapeHtml(b.char) + '\' 글자가 들어간 다른 단어와 뿌리 한자 보기">' +
                '<div class="hanja-square"><span>' + escapeHtml(b.char || '字') + '</span></div>' +
                '<div class="hanja-cell__body">' +
                  '<div class="hanja-cell__top">' +
                    '<span class="hanja-cell__huneum">' + escapeHtml(b.hunEum) + '</span>' +
                    '<span class="hanja-cell__link-cue">연결 어휘 돋보기 ↗</span>' +
                  '</div>' +
                  '<p class="hanja-cell__story">' + escapeHtml(b.rootStory) + '</p>' +
                '</div>' +
              '</button>'
            );
          }).join('')
        : '<p style="font-size:0.86rem;color:var(--ink-muted);margin:4px 0;">한자·어원 해설이 본문 풀이에 통합되어 있습니다.</p>';

      var relatedHtml = entry.relatedTerms.length > 0
        ? '<div class="related-web">' +
            '<span class="related-web__label">함께 엮어 읽기:</span>' +
            entry.relatedTerms.map(function (rt) {
              return '<button type="button" class="related-chip" data-related-term="' + escapeHtml(rt) + '">' + escapeHtml(rt) + ' →</button>';
            }).join('') +
          '</div>'
        : '';

      var stampHtml = masteryLevel === 3
        ? '<div class="cinnabar-stamp' + (isFreshStamp ? ' is-fresh' : '') + '" aria-label="파인만 통달 완료 인장">' +
            '<span class="cinnabar-stamp__hanja">通達</span>' +
            '<span class="cinnabar-stamp__kor">참잘했어요</span>' +
          '</div>'
        : '';

      var veilOverlayHtml = isVeiled
        ? '<div class="paper-slip-veil" id="activePaperSlipVeil" role="button" tabindex="0" aria-label="종이 가림막 걷어내기">' +
            '<span class="paper-slip-veil__seal">파인만 백지 복습 가림막</span>' +
            '<h3 class="paper-slip-veil__term">' + escapeHtml(entry.term) + (entry.hanja ? ' · <span class="hanja-glyph">' + escapeHtml(entry.hanja) + '</span>' : '') + '</h3>' +
            '<p class="paper-slip-veil__prompt">Q. ' + escapeHtml(entry.feynman.selfCheckPrompt) + '</p>' +
            '<p class="paper-slip-veil__guide">왼쪽 페이지의 한자 속뜻만 힌트 삼아, 앞에 초등학생 동생이 앉아 있다고 상상하고 입 밖으로 가볍게 중얼거려 보세요.</p>' +
            '<span class="paper-slip-veil__cta">종이 가림막 스르륵 걷어내기 (Space / 클릭)</span>' +
          '</div>'
        : '';

      var reveilStripHtml = !isVeiled
        ? '<div class="slip-reveil-bar">' +
            '<span>' + (study.globalSlipMode ? '한지 가림막을 걷고 풀이를 확인 중입니다.' : '설명을 다 읽었다면 가림막을 덮고 내 말로 테스트해 보세요!') + '</span>' +
            '<button type="button" class="slip-reveil-btn" data-action="toggle-page-slip">종이 가림막 덮기 (Space)</button>' +
          '</div>'
        : '';

      var wordChipsHtml = entries.map(function (item, idx) {
        var m = Number(study.mastery[item.id] || 0);
        var mark = m === 3 ? '💮 ' : (m === 2 ? '🌿 ' : (study.bookmarks.indexOf(item.id) !== -1 ? '🔖 ' : ''));
        return (
          '<button type="button" class="word-chip' + (idx === currentIndex ? ' is-current' : '') + '" data-select-entry="' + escapeHtml(item.id) + '">' +
            '<span>' + mark + String(idx + 1).padStart(2, '0') + '. ' + escapeHtml(item.term) + '</span>' +
          '</button>'
        );
      }).join('');

      container.innerHTML =
        '<div class="book-spread" style="--active-ch-color:' + escapeHtml(entry.chapterColor) + '">' +
          /* Left Page (Verso): Headword, Hanja Breakdown, One-Liner, Exam Example */
          '<article class="book-page book-page--left" aria-label="표제어 및 한자 해부">' +
            '<div class="page-running-head">' +
              '<span class="page-running-head__title">' + escapeHtml(entry.chapterNumber + ' · ' + entry.chapterTitle) + '</span>' +
              '<span>' + String(currentIndex + 1).padStart(2, '0') + ' / ' + String(entries.length).padStart(2, '0') + '</span>' +
            '</div>' +

            '<div class="entry-meta-bar">' +
              '<div class="entry-badges">' +
                '<span class="subject-pill">' + escapeHtml(entry.subject) + '</span>' +
                '<span class="importance-stars" title="시험 출제 중요도 ' + entry.importance + '점">' + renderImportanceStars(entry.importance) + '</span>' +
              '</div>' +
              '<button type="button" class="bookmark-pin-btn' + (isBookmarked ? ' is-active' : '') + '" data-toggle-bookmark="' + escapeHtml(entry.id) + '">' +
                '<span>' + (isBookmarked ? '🔖 책갈피 꽂힘' : '🔖 책갈피 꽂기') + '</span>' +
              '</button>' +
            '</div>' +

            '<header class="headword-hero">' +
              '<div class="headword-hero__main">' +
                '<h2 class="headword-term">' + escapeHtml(entry.term) + '</h2>' +
                (entry.hanja ? '<span class="headword-hanja">' + escapeHtml(entry.hanja) + '</span>' : '') +
              '</div>' +
              (entry.reading ? '<p class="headword-reading">' + escapeHtml(entry.reading) + '</p>' : '') +
              stampHtml +
            '</header>' +

            '<div class="one-liner-box">' +
              '<span class="section-rubric">✦ 한 줄 핵심 갈무리</span>' +
              '<p class="one-liner-box__text">' + escapeHtml(entry.oneLiner) + '</p>' +
            '</div>' +

            '<div class="hanja-breakdown-section">' +
              '<span class="section-rubric">❖ 한자 레고 해부 <span class="hanja-breakdown-hint">(글자 칸을 누르면 같은 한자 어휘가 열립니다)</span></span>' +
              '<div class="hanja-grid">' + breakdownHtml + '</div>' +
            '</div>' +

            (entry.examExample
              ? '<div class="exam-example-box">' +
                  '<span class="section-rubric">✎ 검정고시 기출 스타일 문장</span>' +
                  '<p class="exam-example-box__quote">' + highlightTermInText(entry.examExample, entry.term) + '</p>' +
                '</div>'
              : '') +

            relatedHtml +

            '<div class="page-folio-bar">' +
              '<button type="button" class="page-turn-btn" data-turn-entry="' + (prevEntry ? escapeHtml(prevEntry.id) : '') + '"' + (!prevEntry ? ' disabled' : '') + '>' +
                '← 이전 단어' + (prevEntry ? ' (' + escapeHtml(prevEntry.term) + ')' : '') +
              '</button>' +
              '<span>왼쪽 면 · p.' + (currentIndex * 2 + 1) + '</span>' +
            '</div>' +
          '</article>' +

          renderBookSpine() +

          /* Right Page (Recto): Mastery Ink Stamp, Feynman 4-Step, Paper Slip, Marginalia */
          '<article class="book-page book-page--right" aria-label="파인만 4단계 해설 및 개인 메모">' +
            '<div class="page-running-head">' +
              '<span class="page-running-head__title">파인만 개념 과외 노트</span>' +
              '<span>단축키 <kbd>Space</kbd> 가림막 · <kbd>1~3</kbd> 도장</span>' +
            '</div>' +

            '<div class="mastery-selector" role="group" aria-label="이해도 인주 도장 선택">' +
              '<span class="mastery-selector__label">나의 이해도 도장</span>' +
              '<div class="mastery-btns">' +
                '<button type="button" class="mastery-btn' + (masteryLevel === 1 ? ' is-active' : '') + '" data-mastery-entry="' + escapeHtml(entry.id) + '" data-level="1">🌱 처음 봄</button>' +
                '<button type="button" class="mastery-btn' + (masteryLevel === 2 ? ' is-active' : '') + '" data-mastery-entry="' + escapeHtml(entry.id) + '" data-level="2">🌿 익숙해짐</button>' +
                '<button type="button" class="mastery-btn' + (masteryLevel === 3 ? ' is-active' : '') + '" data-mastery-entry="' + escapeHtml(entry.id) + '" data-level="3">💮 설명 가능(통달)</button>' +
              '</div>' +
            '</div>' +

            reveilStripHtml +

            '<div class="feynman-stage-wrap' + (isVeiled ? ' is-veiled' : '') + '">' +
              veilOverlayHtml +
              '<div class="feynman-steps">' +
                '<section class="feynman-card">' +
                  '<div class="feynman-card__step">01 · 초등학생 눈높이 쉬운 풀이</div>' +
                  '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.simple) + '</p>' +
                '</section>' +

                (entry.feynman.analogy
                  ? '<section class="feynman-card feynman-card--analogy">' +
                      '<div class="feynman-card__step">02 · 머릿속에 그림이 그려지는 일상 비유</div>' +
                      '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.analogy) + '</p>' +
                    '</section>'
                  : '') +

                (entry.feynman.examTrap
                  ? '<section class="feynman-card feynman-card--trap">' +
                      '<div class="feynman-card__step">03 · 시험장 선지 단골 함정 경보</div>' +
                      '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.examTrap) + '</p>' +
                    '</section>'
                  : '') +

                '<section class="self-check-card">' +
                  '<div class="self-check-card__step">04 · 책을 덮고 내 말로 설명해보기</div>' +
                  '<p class="self-check-card__prompt">Q. ' + escapeHtml(entry.feynman.selfCheckPrompt) + '</p>' +
                  '<button type="button" class="answer-slip-btn' + (!isSelfAnswerOpen ? ' is-masked' : '') + '" data-toggle-self-answer="' + escapeHtml(entry.id) + '">' +
                    (isSelfAnswerOpen
                      ? '<strong>핵심 답안 포인트:</strong> ' + escapeHtml(entry.feynman.selfCheckAnswer)
                      : '클릭하여 핵심 설명 포인트 가림막 걷기') +
                  '</button>' +
                '</section>' +
              '</div>' +
            '</div>' +

            /* Personal Marginalia Note (auto-saved without losing IME focus) */
            '<div class="marginalia-box">' +
              '<div class="marginalia-box__head">' +
                '<label for="marginaliaInput" class="marginalia-box__title">✎ 나만의 여백 손글씨 메모</label>' +
                '<span class="marginalia-box__status" id="marginaliaSaveStatus">' + (noteValue.trim() ? '✓ 서재에 기록됨' : '자동 저장') + '</span>' +
              '</div>' +
              '<textarea id="marginaliaInput" class="marginalia-textarea" data-note-entry="' + escapeHtml(entry.id) + '" placeholder="나만의 암기 연상법이나 헷갈렸던 기출 포인트를 여백에 적어두세요…">' + escapeHtml(noteValue) + '</textarea>' +
            '</div>' +

            '<div class="page-folio-bar">' +
              '<span>오른쪽 면 · p.' + (currentIndex * 2 + 2) + '</span>' +
              '<button type="button" class="page-turn-btn" data-turn-entry="' + (nextEntry ? escapeHtml(nextEntry.id) : '') + '"' + (!nextEntry ? ' disabled' : '') + '>' +
                (nextEntry ? '(' + escapeHtml(nextEntry.term) + ') ' : '') + '다음 단어 →' +
              '</button>' +
            '</div>' +
          '</article>' +
        '</div>' +

        /* Bottom Quick Word Jump Strip */
        '<nav class="word-index-strip" aria-label="장 내 수록 어휘 빠른 이동">' +
          wordChipsHtml +
        '</nav>';

      /* Scroll active word chip gently into horizontal view inside strip */
      var activeChip = container.querySelector('.word-chip.is-current');
      if (activeChip && typeof activeChip.scrollIntoView === 'function') {
        try {
          activeChip.scrollIntoView({ block: 'nearest', inline: 'center' });
        } catch (e) {}
      }

      /* Bind marginalia input directly for smooth Korean IME composition */
      var noteEl = document.getElementById('marginaliaInput');
      var noteStatus = document.getElementById('marginaliaSaveStatus');
      if (noteEl) {
        noteEl.addEventListener('input', function () {
          var id = noteEl.getAttribute('data-note-entry');
          var val = noteEl.value;
          if (val.trim()) {
            study.notes[id] = val;
          } else {
            delete study.notes[id];
          }
          SafeStorage.set(STORAGE_STUDY_KEY, JSON.stringify(study));
          if (noteStatus) {
            noteStatus.textContent = val.trim() ? '✓ 여백에 자동 저장됨' : '비워짐';
          }
        });
      }
    }

    function renderAnthologyView(container, entries) {
      var cardsHtml = entries.map(function (entry, idx) {
        var mLevel = Number(study.mastery[entry.id] || 0);
        var isBookmarked = study.bookmarks.indexOf(entry.id) !== -1;
        var isAnswerOpen = Boolean(ui.revealedSelfChecks[entry.id]);
        var isCardVeiled = study.globalSlipMode && !ui.revealedSelfChecks['slip_' + entry.id];

        var miniChars = entry.hanjaBreakdown.map(function (b) {
          return (
            '<button type="button" class="related-chip" data-hanja-inspect="' + escapeHtml(b.char) + '">' +
              '<span class="hanja-glyph">' + escapeHtml(b.char) + '</span> ' + escapeHtml(b.hunEum) +
            '</button>'
          );
        }).join('');

        return (
          '<article class="anthology-card" style="--active-ch-color:' + escapeHtml(entry.chapterColor) + '">' +
            '<div class="anthology-card__left">' +
              '<div class="entry-badges">' +
                '<span class="subject-pill">' + escapeHtml(entry.chapterNumber + ' · ' + entry.subject) + '</span>' +
                '<span class="importance-stars">' + renderImportanceStars(entry.importance) + '</span>' +
                (mLevel === 3 ? '<span class="subject-pill" style="color:var(--cinnabar);border-color:var(--cinnabar);">💮 통달</span>' : '') +
              '</div>' +
              '<h2 class="anthology-card__term">' +
                String(idx + 1).padStart(2, '0') + '. ' + escapeHtml(entry.term) +
                (entry.hanja ? '<span class="anthology-card__hanja">' + escapeHtml(entry.hanja) + '</span>' : '') +
              '</h2>' +
              (entry.reading ? '<div style="font-size:0.82rem;color:var(--ink-muted);">' + escapeHtml(entry.reading) + '</div>' : '') +
              '<p style="margin:4px 0;font-weight:600;color:var(--ink-primary);">' + escapeHtml(entry.oneLiner) + '</p>' +
              (miniChars ? '<div class="related-web">' + miniChars + '</div>' : '') +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:6px;">' +
                '<button type="button" class="anthology-open-btn" data-open-spread-entry="' + escapeHtml(entry.id) + '">📖 양면 펼침북으로 열기</button>' +
                '<button type="button" class="bookmark-pin-btn' + (isBookmarked ? ' is-active' : '') + '" data-toggle-bookmark="' + escapeHtml(entry.id) + '">' +
                  (isBookmarked ? '🔖 책갈피됨' : '🔖 책갈피') +
                '</button>' +
              '</div>' +
            '</div>' +

            '<div class="anthology-card__right">' +
              (isCardVeiled
                ? '<button type="button" class="answer-slip-btn is-masked" style="padding:26px 16px;" data-unveil-anthology="' + escapeHtml(entry.id) + '">' +
                    '종이 가림막이 덮여 있습니다 — Q. ' + escapeHtml(entry.feynman.selfCheckPrompt) + '<br><span style="text-decoration:underline;">클릭하여 파인만 풀이 걷어내기</span>' +
                  '</button>'
                : '<div class="feynman-card">' +
                    '<div class="feynman-card__step">쉬운 풀이</div>' +
                    '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.simple) + '</p>' +
                  '</div>' +
                  (entry.feynman.analogy
                    ? '<div class="feynman-card feynman-card--analogy">' +
                        '<div class="feynman-card__step">일상 비유</div>' +
                        '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.analogy) + '</p>' +
                      '</div>'
                    : '') +
                  (entry.feynman.examTrap
                    ? '<div class="feynman-card feynman-card--trap">' +
                        '<div class="feynman-card__step">선지 함정 경보</div>' +
                        '<p class="feynman-card__prose">' + escapeHtml(entry.feynman.examTrap) + '</p>' +
                      '</div>'
                    : '') +
                  '<button type="button" class="answer-slip-btn' + (!isAnswerOpen ? ' is-masked' : '') + '" data-toggle-self-answer="' + escapeHtml(entry.id) + '">' +
                    (isAnswerOpen
                      ? '<strong>셀프 점검 답:</strong> ' + escapeHtml(entry.feynman.selfCheckAnswer)
                      : '셀프 질문: ' + escapeHtml(entry.feynman.selfCheckPrompt) + ' (클릭해 확인)') +
                  '</button>'
              ) +
            '</div>' +
          '</article>'
        );
      }).join('');

      container.innerHTML = '<div class="anthology-container">' + cardsHtml + '</div>';
    }

    /* ----------------------------------------------------------------------
       Section 3: Appendix A — 뿌리 한자 레고 도감 (Hanja Roots)
       ---------------------------------------------------------------------- */
    function getRootCategories() {
      var list = ['전체'];
      var seen = { '전체': true };
      CANONICAL_ROOT_CATEGORIES.forEach(function (cat) {
        seen[cat] = true;
        list.push(cat);
      });
      book.hanjaRoots.forEach(function (r) {
        if (r.category && !seen[r.category]) {
          seen[r.category] = true;
          list.push(r.category);
        }
      });
      return list;
    }

    function getFilteredRoots() {
      return book.hanjaRoots.filter(function (r) {
        if (ui.rootCategory !== '전체' && r.category !== ui.rootCategory) return false;
        if (ui.rootSearchQuery) {
          if (!matchesSearchQuery(r._searchBlob, r._choseongBlob, ui.rootSearchQuery)) return false;
        }
        return true;
      });
    }

    function renderRootsSection() {
      var categories = getRootCategories();
      var catTabsHtml = categories.map(function (cat) {
        var count = cat === '전체'
          ? book.hanjaRoots.length
          : book.hanjaRoots.filter(function (r) { return r.category === cat; }).length;
        if (cat !== '전체' && count === 0) return '';
        return (
          '<button type="button" class="pill-tab' + (ui.rootCategory === cat ? ' is-active' : '') + '" data-root-cat="' + escapeHtml(cat) + '">' +
            escapeHtml(cat) + ' (' + count + ')' +
          '</button>'
        );
      }).join('');

      dom.viewport.innerHTML =
        '<div class="book-spread">' +
          '<section class="book-page book-page--left" aria-label="뿌리 한자 활자 도감 목록">' +
            '<div class="section-hero">' +
              '<div>' +
                '<span class="section-hero__eyebrow">부록 A · 한자 조어력 확장 도감</span>' +
                '<h1 class="section-hero__title">뿌리 한자 레고 도감</h1>' +
                '<p class="section-hero__desc">핵심 뿌리 한자 하나를 깨치면 수십 개의 검정고시 개념어가 도미노처럼 풀립니다.</p>' +
              '</div>' +
            '</div>' +

            '<div class="pill-tabs">' + catTabsHtml + '</div>' +

            '<div style="margin-bottom:14px;">' +
              '<input type="search" id="rootSearchInput" class="filter-input" style="max-width:100%;width:100%;" placeholder="한자(觀), 훈음(볼 관), 파생어(객관적), 초성 검색…" value="' + escapeHtml(ui.rootSearchQuery) + '" autocomplete="off">' +
            '</div>' +

            '<div id="rootGridContainer"></div>' +
          '</section>' +

          renderBookSpine() +

          '<section class="book-page book-page--right" id="rootSpotlightPage" aria-label="선택한 뿌리 한자 상세 해설"></section>' +
        '</div>';

      var rootSearchEl = document.getElementById('rootSearchInput');
      if (rootSearchEl) {
        rootSearchEl.addEventListener('input', function () {
          ui.rootSearchQuery = rootSearchEl.value;
          renderRootsDynamicParts();
        });
      }

      renderRootsDynamicParts();
    }

    function renderRootsDynamicParts() {
      var gridContainer = document.getElementById('rootGridContainer');
      var spotlightPage = document.getElementById('rootSpotlightPage');
      if (!gridContainer || !spotlightPage) return;

      var filtered = getFilteredRoots();
      if (filtered.length === 0) {
        gridContainer.innerHTML =
          '<div class="empty-state-box">' +
            '<p style="margin:0 0 8px;font-weight:700;">일치하는 뿌리 한자가 없습니다.</p>' +
            '<button type="button" class="filter-reset-btn" data-reset-roots="1">전체 도감 보기</button>' +
          '</div>';
        spotlightPage.innerHTML =
          '<div class="empty-state-box" style="margin:auto 0;">왼쪽에서 다른 분류를 선택해 보세요.</div>';
        return;
      }

      var selected = filtered.filter(function (r) { return r.id === ui.selectedRootId; })[0];
      if (!selected) {
        selected = filtered[0];
        ui.selectedRootId = selected.id;
      }

      gridContainer.innerHTML =
        '<div class="root-tile-grid">' +
          filtered.map(function (r) {
            var isSel = r.id === selected.id;
            return (
              '<button type="button" class="root-tile' + (isSel ? ' is-selected' : '') + '" data-select-root="' + escapeHtml(r.id) + '">' +
                '<span class="root-tile__char">' + escapeHtml(r.char) + '</span>' +
                '<span class="root-tile__huneum">' + escapeHtml(r.hunEum) + '</span>' +
                '<span class="root-tile__count">파생 ' + r.derivedWords.length + '어</span>' +
              '</button>'
            );
          }).join('') +
        '</div>';

      /* Find matching chapter entries containing any CJK char from selected.char */
      var linkedEntries = [];
      extractCjkChars(selected.char).forEach(function (c) {
        var hits = book.entriesByHanjaChar[c] || [];
        hits.forEach(function (entry) {
          if (linkedEntries.indexOf(entry) === -1) linkedEntries.push(entry);
        });
      });

      var derivedHtml = selected.derivedWords.map(function (dw) {
        var matchingEntry = book.entriesByTerm[normalizeKey(dw.word)];
        var jumpBtn = (matchingEntry && matchingEntry[0])
          ? '<button type="button" class="related-chip" data-open-entry="' + escapeHtml(matchingEntry[0].id) + '">본문 풀이 열기 →</button>'
          : '';
        return (
          '<div class="derived-node">' +
            '<div class="derived-node__top">' +
              '<div>' +
                '<span class="derived-node__word">' + escapeHtml(dw.word) + '</span>' +
                (dw.hanja ? '<span class="derived-node__hanja">(' + escapeHtml(dw.hanja) + ')</span>' : '') +
              '</div>' +
              (dw.subject ? '<span class="subject-pill">' + escapeHtml(dw.subject) + '</span>' : '') +
            '</div>' +
            (dw.literal ? '<div class="derived-node__literal">= 속뜻 직역: “' + escapeHtml(dw.literal) + '”</div>' : '') +
            '<p class="derived-node__meaning">' + escapeHtml(dw.meaning) + '</p>' +
            (jumpBtn ? '<div style="margin-top:6px;">' + jumpBtn + '</div>' : '') +
          '</div>'
        );
      }).join('');

      var chapterCrossLinksHtml = linkedEntries.length > 0
        ? '<div style="margin-top:6px;">' +
            '<span class="section-rubric">📖 이 한자가 등장하는 본문 서재 표제어 (' + linkedEntries.length + '개)</span>' +
            '<div class="related-web" style="margin-top:6px;">' +
              linkedEntries.map(function (e) {
                return '<button type="button" class="related-chip" data-open-entry="' + escapeHtml(e.id) + '">' +
                  escapeHtml(e.term) + (e.hanja ? ' (' + escapeHtml(e.hanja) + ')' : '') + ' →' +
                '</button>';
              }).join('') +
            '</div>' +
          '</div>'
        : '';

      spotlightPage.innerHTML =
        '<div class="page-running-head">' +
          '<span class="page-running-head__title">뿌리 한자 정밀 해부 · ' + escapeHtml(selected.category) + '</span>' +
          '<span>' + escapeHtml(selected.id.toUpperCase()) + '</span>' +
        '</div>' +
        '<div class="root-spotlight">' +
          '<div class="root-spotlight__hero">' +
            '<div class="root-monument-square"><span>' + escapeHtml(selected.char) + '</span></div>' +
            '<div>' +
              '<span class="subject-pill">' + escapeHtml(selected.category) + '</span>' +
              '<h2 class="root-spotlight__huneum">' + escapeHtml(selected.hunEum) + '</h2>' +
            '</div>' +
          '</div>' +

          '<div class="feynman-card">' +
            '<div class="feynman-card__step">❖ 부수 · 상형 그림 이야기</div>' +
            '<p class="feynman-card__prose">' + escapeHtml(selected.pictographStory) + '</p>' +
          '</div>' +

          (selected.feynmanTip
            ? '<div class="feynman-card feynman-card--analogy">' +
                '<div class="feynman-card__step">💡 파인만 1초 해독 공식</div>' +
                '<p class="feynman-card__prose">' + escapeHtml(selected.feynmanTip) + '</p>' +
              '</div>'
            : '') +

          '<div>' +
            '<span class="section-rubric">🌿 레고처럼 조립되는 검정고시 파생 어휘 트리</span>' +
            '<div class="derived-tree" style="margin-top:6px;">' + derivedHtml + '</div>' +
          '</div>' +

          chapterCrossLinksHtml +
        '</div>';
    }

    /* ----------------------------------------------------------------------
       Section 4: Appendix B — 헷갈리는 쌍둥이 개념 대결 (Confusables)
       ---------------------------------------------------------------------- */
    function renderConfusablesSection() {
      var subjectSet = { '전체': true };
      var subjects = ['전체'];
      book.confusables.forEach(function (pair) {
        String(pair.subject || '')
          .split(/[·,/|]/)
          .map(function (s) { return s.trim(); })
          .filter(Boolean)
          .forEach(function (tok) {
            if (!subjectSet[tok]) {
              subjectSet[tok] = true;
              subjects.push(tok);
            }
          });
      });

      var filtered = book.confusables.filter(function (pair) {
        if (ui.confusableSubject === '전체') return true;
        return pair.subject.indexOf(ui.confusableSubject) !== -1;
      });

      var subTabsHtml = subjects.map(function (s) {
        return '<button type="button" class="pill-tab' + (ui.confusableSubject === s ? ' is-active' : '') + '" data-conf-sub="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
      }).join('');

      var pairsHtml = filtered.map(function (pair, idx) {
        var isCardBlind = ui.confusableBlindMode && !ui.revealedPairIds[pair.id];
        var leftMatch = book.entriesByTerm[normalizeKey(pair.left.term)];
        var rightMatch = book.entriesByTerm[normalizeKey(pair.right.term)];

        return (
          '<article class="vs-card' + (isCardBlind ? ' is-blind' : '') + '">' +
            '<div class="vs-card__head">' +
              '<span>대결 #' + String(idx + 1).padStart(2, '0') + ' · ' + escapeHtml(pair.subject) + '</span>' +
              (ui.confusableBlindMode
                ? '<button type="button" class="slip-reveil-btn" data-toggle-pair-blind="' + escapeHtml(pair.id) + '">' +
                    (isCardBlind ? '🙈 해설 가림막 걷기' : '다시 가리기') +
                  '</button>'
                : '<span>핵심 대조 카드</span>') +
            '</div>' +

            '<div class="vs-arena">' +
              '<div class="vs-side">' +
                '<h2 class="vs-side__term">' +
                  escapeHtml(pair.left.term) +
                  (pair.left.hanja ? '<span class="vs-side__hanja">(' + escapeHtml(pair.left.hanja) + ')</span>' : '') +
                '</h2>' +
                '<p class="vs-side__core">' + escapeHtml(pair.left.core) + '</p>' +
                '<p class="vs-side__example"><strong>예시:</strong> ' + escapeHtml(pair.left.example) + '</p>' +
                (leftMatch && leftMatch[0]
                  ? '<div style="margin-top:8px;"><button type="button" class="related-chip" data-open-entry="' + escapeHtml(leftMatch[0].id) + '">본문 노트 열기 →</button></div>'
                  : '') +
              '</div>' +

              '<div class="vs-divider" aria-hidden="true"><span class="vs-badge">VS</span></div>' +

              '<div class="vs-side">' +
                '<h2 class="vs-side__term">' +
                  escapeHtml(pair.right.term) +
                  (pair.right.hanja ? '<span class="vs-side__hanja">(' + escapeHtml(pair.right.hanja) + ')</span>' : '') +
                '</h2>' +
                '<p class="vs-side__core">' + escapeHtml(pair.right.core) + '</p>' +
                '<p class="vs-side__example"><strong>예시:</strong> ' + escapeHtml(pair.right.example) + '</p>' +
                (rightMatch && rightMatch[0]
                  ? '<div style="margin-top:8px;"><button type="button" class="related-chip" data-open-entry="' + escapeHtml(rightMatch[0].id) + '">본문 노트 열기 →</button></div>'
                  : '') +
              '</div>' +
            '</div>' +

            '<div class="vs-rule-bar">' +
              '<span class="vs-rule-bar__tag">⚡ 1초 구별 치트키</span>' +
              '<span class="vs-rule-bar__text">' + escapeHtml(pair.oneSecondRule) + '</span>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      dom.viewport.innerHTML =
        '<section class="book-sheet" aria-label="헷갈리는 쌍둥이 개념 대결">' +
          '<div class="section-hero">' +
            '<div>' +
              '<span class="section-hero__eyebrow">부록 B · 출제위원이 가장 좋아하는 선지 바꿔치기 방어</span>' +
              '<h1 class="section-hero__title">헷갈리는 쌍둥이 개념 VS 대결</h1>' +
              '<p class="section-hero__desc">시험장에서 아차 하고 뒤바꿔 고르기 쉬운 단짝 개념들을 나란히 세워 1초 판별 기준을 짚어 줍니다.</p>' +
            '</div>' +
            '<button type="button" class="slip-mode-toggle" id="btnConfusableBlind" aria-pressed="' + (ui.confusableBlindMode ? 'true' : 'false') + '">' +
              '<span class="slip-mode-toggle__dot"></span>' +
              '<span>🙈 블라인드 구별 연습</span>' +
              '<span class="slip-mode-toggle__state">' + (ui.confusableBlindMode ? '켜짐' : '꺼짐') + '</span>' +
            '</button>' +
          '</div>' +

          '<div class="vs-toolbar">' +
            '<div class="pill-tabs" style="margin-bottom:0;">' + subTabsHtml + '</div>' +
            '<span class="filter-count-badge">총 ' + filtered.length + '쌍 대결</span>' +
          '</div>' +

          '<div class="vs-list">' + (pairsHtml || '<div class="empty-state-box">해당 과목의 비교 쌍이 없습니다.</div>') + '</div>' +
        '</section>';
    }

    /* ----------------------------------------------------------------------
       Section 5: Appendix C — 실전 발문·문장 해독장 (Drills)
       ---------------------------------------------------------------------- */
    function renderDrillsSection() {
      var subjectSet = { '전체': true };
      var subjects = ['전체'];
      book.drills.forEach(function (d) {
        if (d.subject && !subjectSet[d.subject]) {
          subjectSet[d.subject] = true;
          subjects.push(d.subject);
        }
      });

      var totalSolved = 0;
      var totalCorrect = 0;
      book.drills.forEach(function (d) {
        var h = study.drillHistory[d.id];
        if (h && typeof h.selectedIndex === 'number') {
          totalSolved++;
          if (h.isCorrect) totalCorrect++;
        }
      });
      var scorePct = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

      var filtered = book.drills.filter(function (d) {
        if (ui.drillRetryWrongOnly && study.wrongDrillIds.indexOf(d.id) === -1) return false;
        if (ui.drillSubject !== '전체' && d.subject !== ui.drillSubject) return false;
        return true;
      });

      var subTabsHtml = subjects.map(function (s) {
        return '<button type="button" class="pill-tab' + (ui.drillSubject === s ? ' is-active' : '') + '" data-drill-sub="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
      }).join('');

      var drillsHtml = filtered.map(function (drill, idx) {
        var attempt = study.drillHistory[drill.id] || null;
        var isAnswered = attempt && typeof attempt.selectedIndex === 'number';

        var optionsHtml = drill.options.map(function (optText, oIdx) {
          var cls = 'drill-opt-btn';
          if (isAnswered) {
            if (oIdx === drill.answerIndex) cls += ' is-correct';
            else if (oIdx === attempt.selectedIndex && !attempt.isCorrect) cls += ' is-wrong';
          }
          return (
            '<button type="button" class="' + cls + '" data-drill-id="' + escapeHtml(drill.id) + '" data-opt-idx="' + oIdx + '">' +
              '<strong>' + (OPTION_CIRCLES[oIdx] || (oIdx + 1) + '.') + '</strong>' +
              '<span>' + escapeHtml(optText) + '</span>' +
            '</button>'
          );
        }).join('');

        var explainHtml = isAnswered
          ? '<div class="drill-explain' + (!attempt.isCorrect ? ' is-wrong-feedback' : '') + '">' +
              '<strong>' + (attempt.isCorrect ? '⭕ 정답입니다! 파인만 해독 풀이:' : '❌ 아쉽네요! 정답은 ' + OPTION_CIRCLES[drill.answerIndex] + '번입니다:') + '</strong> ' +
              escapeHtml(drill.feynmanExplain) +
            '</div>'
          : '';

        return (
          '<article class="drill-card">' +
            '<div class="drill-card__top">' +
              '<span class="drill-q-num">문항 ' + String(idx + 1).padStart(2, '0') + '</span>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span class="subject-pill">' + escapeHtml(drill.subject) + '</span>' +
                (isAnswered
                  ? '<button type="button" class="related-chip" data-reset-single-drill="' + escapeHtml(drill.id) + '">다시 풀기</button>'
                  : '') +
              '</div>' +
            '</div>' +
            '<h2 class="drill-question">' + escapeHtml(drill.question) + '</h2>' +
            '<div class="drill-options">' + optionsHtml + '</div>' +
            explainHtml +
          '</article>'
        );
      }).join('');

      dom.viewport.innerHTML =
        '<section class="book-sheet" aria-label="실전 발문 문장 해독장">' +
          '<div class="section-hero">' +
            '<div>' +
              '<span class="section-hero__eyebrow">부록 C · 4지선다 인터랙티브 미니 모의고사</span>' +
              '<h1 class="section-hero__title">실전 발문 · 문장 해독장</h1>' +
              '<p class="section-hero__desc">시험지 문장이 묻는 진짜 속뜻을 초등학생 언어로 정확히 번역할 수 있는지 즉시 점검해 보세요.</p>' +
            '</div>' +
          '</div>' +

          '<div class="exam-scoreboard">' +
            '<div class="exam-scoreboard__stats">' +
              '<span>풀이 진행: <strong>' + totalSolved + ' / ' + book.drills.length + '</strong>문항</span>' +
              '<span>정답: <strong>' + totalCorrect + '</strong>개</span>' +
              '<span>해독 정답률: <strong class="exam-score-num">' + scorePct + '%</strong></span>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button type="button" class="bookmark-pin-btn' + (ui.drillRetryWrongOnly ? ' is-active' : '') + '" id="btnToggleWrongOnly">' +
                '오답 노트만 다시 풀기 (' + study.wrongDrillIds.length + ')' +
              '</button>' +
              '<button type="button" class="page-turn-btn" id="btnResetAllDrills">전체 답안지 새 종이로 초기화</button>' +
            '</div>' +
          '</div>' +

          '<div class="pill-tabs">' + subTabsHtml + '</div>' +

          '<div class="drill-list">' +
            (drillsHtml ||
              '<div class="empty-state-box">' +
                '<p style="margin:0 0 8px;font-weight:700;">' +
                  (ui.drillRetryWrongOnly ? '오답 노트에 남은 문항이 없습니다! 완벽합니다 💮' : '해당 과목의 문항이 없습니다.') +
                '</p>' +
                (ui.drillRetryWrongOnly ? '<button type="button" class="filter-reset-btn" id="btnExitWrongMode">전체 문항 보기로 돌아가기</button>' : '') +
              '</div>') +
          '</div>' +
        '</section>';
    }

    /* ----------------------------------------------------------------------
       Section 6: 별책 · 내 서재 (Bookmarks, Unmastered, Mastered, Notes & Backup)
       ---------------------------------------------------------------------- */
    function renderLibrarySection() {
      var bookmarkedEntries = study.bookmarks
        .map(function (id) { return book.entryById[id]; })
        .filter(Boolean);

      var unmasteredEntries = book.allEntries.filter(function (e) {
        return Number(study.mastery[e.id] || 0) !== 3;
      });

      var masteredEntries = book.allEntries.filter(function (e) {
        return Number(study.mastery[e.id] || 0) === 3;
      });

      var notedEntries = Object.keys(study.notes)
        .filter(function (id) { return String(study.notes[id] || '').trim().length > 0; })
        .map(function (id) { return book.entryById[id]; })
        .filter(Boolean);

      var activeList =
        ui.librarySubTab === 'bookmarks' ? bookmarkedEntries :
        ui.librarySubTab === 'unmastered' ? unmasteredEntries :
        ui.librarySubTab === 'mastered' ? masteredEntries :
        notedEntries;

      var cardsHtml = activeList.map(function (entry) {
        var mLevel = Number(study.mastery[entry.id] || 0);
        var mBadge = mLevel === 3 ? '💮 통달' : (mLevel === 2 ? '🌿 익숙해짐' : (mLevel === 1 ? '🌱 처음 봄' : '미학습'));
        var noteText = String(study.notes[entry.id] || '').trim();

        return (
          '<article class="library-card">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
              '<span class="subject-pill">' + escapeHtml(entry.chapterNumber + ' · ' + entry.subject) + '</span>' +
              '<span style="font-family:var(--font-sans);font-size:0.74rem;color:var(--ink-muted);">' + mBadge + '</span>' +
            '</div>' +
            '<h2 style="margin:2px 0;font-size:1.18rem;">' +
              escapeHtml(entry.term) +
              (entry.hanja ? ' <span class="hanja-glyph" style="color:var(--cinnabar);font-size:0.98rem;">(' + escapeHtml(entry.hanja) + ')</span>' : '') +
            '</h2>' +
            '<p style="margin:0;font-size:0.86rem;color:var(--ink-secondary);">' + escapeHtml(entry.oneLiner) + '</p>' +
            (noteText ? '<blockquote class="library-note-quote">✎ ' + escapeHtml(noteText) + '</blockquote>' : '') +
            '<div style="margin-top:auto;padding-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button type="button" class="anthology-open-btn" data-open-entry="' + escapeHtml(entry.id) + '">책장 펼치기 →</button>' +
              (ui.librarySubTab === 'bookmarks'
                ? '<button type="button" class="related-chip" data-toggle-bookmark="' + escapeHtml(entry.id) + '">책갈피 빼기</button>'
                : '') +
            '</div>' +
          '</article>'
        );
      }).join('');

      dom.viewport.innerHTML =
        '<section class="book-sheet" aria-label="내 서재 및 필사 기록 관리">' +
          '<div class="section-hero">' +
            '<div>' +
              '<span class="section-hero__eyebrow">별책 부록 · 나만의 개인 학습 서랍</span>' +
              '<h1 class="section-hero__title">내 서재 (책갈피 · 미통달 · 여백 필사 노트)</h1>' +
              '<p class="section-hero__desc">이 브라우저에 저장된 나만의 도장, 책갈피, 손글씨 메모를 모아 보고 JSON 파일로 안전하게 백업할 수 있습니다.</p>' +
            '</div>' +
          '</div>' +

          '<div class="backup-panel">' +
            '<div>' +
              '<strong>📦 학습 기록 JSON 백업 보관함</strong>' +
              '<div style="color:var(--ink-muted);font-size:0.77rem;margin-top:2px;">다른 기기에서 이어서 보거나 기록을 소장하려면 백업 파일을 내려받으세요.</div>' +
            '</div>' +
            '<div class="backup-actions">' +
              '<button type="button" class="page-turn-btn" id="btnExportBackup">⬇ 기록 백업 내려받기 (.json)</button>' +
              '<button type="button" class="page-turn-btn" id="btnImportBackup">⬆ 백업 파일 불러오기</button>' +
              (unmasteredEntries.length > 0
                ? '<button type="button" class="filter-reset-btn" id="btnPracticeUnmastered">🔥 미통달 단어 가림막 복습 시작</button>'
                : '') +
            '</div>' +
          '</div>' +

          '<div class="pill-tabs">' +
            '<button type="button" class="pill-tab' + (ui.librarySubTab === 'bookmarks' ? ' is-active' : '') + '" data-lib-tab="bookmarks">🔖 꽂아둔 책갈피 (' + bookmarkedEntries.length + ')</button>' +
            '<button type="button" class="pill-tab' + (ui.librarySubTab === 'notes' ? ' is-active' : '') + '" data-lib-tab="notes">✎ 내가 쓴 여백 메모 (' + notedEntries.length + ')</button>' +
            '<button type="button" class="pill-tab' + (ui.librarySubTab === 'unmastered' ? ' is-active' : '') + '" data-lib-tab="unmastered">🌱 미통달 복습 대상 (' + unmasteredEntries.length + ')</button>' +
            '<button type="button" class="pill-tab' + (ui.librarySubTab === 'mastered' ? ' is-active' : '') + '" data-lib-tab="mastered">💮 파인만 통달 전당 (' + masteredEntries.length + ')</button>' +
          '</div>' +

          (cardsHtml
            ? '<div class="library-grid">' + cardsHtml + '</div>'
            : '<div class="empty-state-box">' +
                '<p style="margin:0 0 6px;font-weight:700;">아직 이 서랍에 담긴 항목이 없습니다.</p>' +
                '<p style="margin:0;font-size:0.86rem;">본문 책장을 읽으며 책갈피(🔖)를 꽂거나 여백 메모장(✎)에 생각을 적어 보세요!</p>' +
              '</div>') +
        '</section>';
    }

    /* ----------------------------------------------------------------------
       Master Render Dispatcher
       ---------------------------------------------------------------------- */
    function renderActiveSection() {
      if (ui.activeTab === 'cover') {
        renderCoverSection();
      } else if (isChapterTab(ui.activeTab)) {
        renderChapterSection();
      } else if (ui.activeTab === 'roots') {
        renderRootsSection();
      } else if (ui.activeTab === 'confusables') {
        renderConfusablesSection();
      } else if (ui.activeTab === 'drills') {
        renderDrillsSection();
      } else if (ui.activeTab === 'library') {
        renderLibrarySection();
      } else {
        renderCoverSection();
      }
      syncTopChrome();
    }

    /* ----------------------------------------------------------------------
       Hanja & Concept Cross-Reference Drawer (한자 · 관련어 연결 돋보기)
       ---------------------------------------------------------------------- */
    function openHanjaDrawerForChar(charStr) {
      if (!dom.hanjaDrawer || !dom.hanjaDrawerBody) return;
      var cleanChar = String(charStr || '').trim();
      var singleChars = extractCjkChars(cleanChar);
      var targetChar = singleChars[0] || cleanChar;

      var matchedRoot = book.rootByChar[cleanChar] || book.rootByChar[targetChar] || null;
      var relatedEntries = book.entriesByHanjaChar[targetChar] || [];

      dom.hanjaDrawerEyebrow.textContent = '한자 조각 연결 돋보기';
      dom.hanjaDrawerTitle.innerHTML =
        '<span class="hanja-glyph" style="color:var(--cinnabar);font-size:1.45rem;margin-right:8px;">' + escapeHtml(targetChar) + '</span>' +
        (matchedRoot ? escapeHtml(matchedRoot.hunEum) : '포함 어휘 모음');

      var rootHtml = matchedRoot
        ? '<div class="feynman-card">' +
            '<div class="feynman-card__step">뿌리 한자 도감 해설 (' + escapeHtml(matchedRoot.category) + ')</div>' +
            '<p class="feynman-card__prose" style="margin-bottom:8px;">' + escapeHtml(matchedRoot.pictographStory) + '</p>' +
            (matchedRoot.feynmanTip ? '<p style="margin:0 0 10px;font-size:0.86rem;color:var(--cinnabar);font-weight:600;">💡 ' + escapeHtml(matchedRoot.feynmanTip) + '</p>' : '') +
            '<button type="button" class="anthology-open-btn" data-jump-root-atlas="' + escapeHtml(matchedRoot.id) + '">뿌리 한자 도감에서 파생어 전체 보기 →</button>' +
          '</div>'
        : '';

      var entriesHtml = relatedEntries.length > 0
        ? '<div>' +
            '<span class="section-rubric">‘' + escapeHtml(targetChar) + '’ 글자가 들어간 서재 수록 어휘 (' + relatedEntries.length + '개)</span>' +
            '<div class="derived-tree" style="margin-top:8px;">' +
              relatedEntries.map(function (e) {
                return (
                  '<button type="button" class="hanja-cell" data-drawer-open-entry="' + escapeHtml(e.id) + '">' +
                    '<div style="flex:1;">' +
                      '<div style="font-weight:700;font-size:0.96rem;">' + escapeHtml(e.term) + ' <span class="hanja-glyph" style="color:var(--cinnabar);">(' + escapeHtml(e.hanja) + ')</span></div>' +
                      '<div style="font-size:0.81rem;color:var(--ink-secondary);margin-top:2px;">' + escapeHtml(e.oneLiner) + '</div>' +
                    '</div>' +
                    '<span style="font-family:var(--font-sans);font-size:0.75rem;color:var(--cinnabar);font-weight:700;">펼치기 →</span>' +
                  '</button>'
                );
              }).join('') +
            '</div>' +
          '</div>'
        : '<p style="color:var(--ink-muted);font-size:0.88rem;">다른 장에 동일 한자를 공유하는 표제어가 없습니다.</p>';

      dom.hanjaDrawerBody.innerHTML = rootHtml + entriesHtml;
      dom.hanjaDrawerBackdrop.hidden = false;
      dom.hanjaDrawer.hidden = false;
    }

    function handleRelatedTermClick(termStr) {
      var key = normalizeKey(termStr);
      var directHits = book.entriesByTerm[key];
      if (directHits && directHits[0]) {
        openEntry(directHits[0].id, { pushHistory: true, resetFilters: true, forceSpread: true });
        showToast('🔗 연관 개념 «' + directHits[0].term + '» 책장으로 이동했습니다.');
        return;
      }

      /* Partial match across entries & confusables */
      var partialEntries = book.allEntries.filter(function (e) {
        return matchesSearchQuery(e._searchBlob, e._choseongBlob, termStr);
      });
      var partialPairs = book.confusables.filter(function (p) {
        return matchesSearchQuery(p._searchBlob, p._choseongBlob, termStr);
      });

      dom.hanjaDrawerEyebrow.textContent = '연관 개념 그물 돋보기';
      dom.hanjaDrawerTitle.textContent = '«' + termStr + '» 관련 학습 연결';

      var html = '';
      if (partialEntries.length > 0) {
        html += '<div><span class="section-rubric">관련 본문 어휘</span><div class="derived-tree" style="margin-top:8px;">' +
          partialEntries.slice(0, 8).map(function (e) {
            return (
              '<button type="button" class="hanja-cell" data-drawer-open-entry="' + escapeHtml(e.id) + '">' +
                '<div style="flex:1;">' +
                  '<strong>' + escapeHtml(e.term) + '</strong> <span class="hanja-glyph" style="color:var(--cinnabar);">' + escapeHtml(e.hanja) + '</span>' +
                  '<div style="font-size:0.8rem;color:var(--ink-secondary);">' + escapeHtml(e.oneLiner) + '</div>' +
                '</div>' +
                '<span style="font-size:0.75rem;color:var(--cinnabar);">열기 →</span>' +
              '</button>'
            );
          }).join('') + '</div></div>';
      }
      if (partialPairs.length > 0) {
        html += '<div><span class="section-rubric">쌍둥이 개념 VS 대결</span><div class="derived-tree" style="margin-top:8px;">' +
          partialPairs.map(function (p) {
            return (
              '<div class="derived-node">' +
                '<strong>' + escapeHtml(p.left.term) + ' VS ' + escapeHtml(p.right.term) + '</strong>' +
                '<p class="derived-node__meaning" style="margin-top:4px;">⚡ ' + escapeHtml(p.oneSecondRule) + '</p>' +
                '<button type="button" class="related-chip" style="margin-top:6px;" data-drawer-open-confusable="1">쌍둥이 대결장에서 보기 →</button>' +
              '</div>'
            );
          }).join('') + '</div></div>';
      }
      if (!html) {
        html = '<div class="empty-state-box">«' + escapeHtml(termStr) + '» 개념은 현재 펼친 본문 해설과 함께 익혀 두면 좋은 확장 어휘입니다.</div>';
      }

      dom.hanjaDrawerBody.innerHTML = html;
      dom.hanjaDrawerBackdrop.hidden = false;
      dom.hanjaDrawer.hidden = false;
    }

    function closeHanjaDrawer() {
      if (dom.hanjaDrawer) dom.hanjaDrawer.hidden = true;
      if (dom.hanjaDrawerBackdrop) dom.hanjaDrawerBackdrop.hidden = true;
    }

    function closeShortcutModal() {
      if (dom.shortcutModal) dom.shortcutModal.hidden = true;
      if (dom.shortcutModalBackdrop) dom.shortcutModalBackdrop.hidden = true;
    }

    /* ----------------------------------------------------------------------
       Global Instant Search Popover (단어 · 한자 · 뜻 · 초성 통합 검색)
       ---------------------------------------------------------------------- */
    function renderGlobalSearchPopover(rawQuery) {
      if (!dom.globalSearchPopover) return;
      var q = String(rawQuery || '').trim();
      if (dom.btnClearGlobalSearch) {
        dom.btnClearGlobalSearch.hidden = q.length === 0;
      }
      if (!q) {
        dom.globalSearchPopover.hidden = true;
        dom.globalSearchPopover.innerHTML = '';
        return;
      }

      var entryHits = book.allEntries.filter(function (e) {
        return matchesSearchQuery(e._searchBlob, e._choseongBlob, q);
      }).slice(0, 8);

      var rootHits = book.hanjaRoots.filter(function (r) {
        return matchesSearchQuery(r._searchBlob, r._choseongBlob, q);
      }).slice(0, 5);

      var pairHits = book.confusables.filter(function (p) {
        return matchesSearchQuery(p._searchBlob, p._choseongBlob, q);
      }).slice(0, 3);

      var parts = [];
      if (entryHits.length > 0) {
        parts.push('<div class="search-group-label">본문 서재 표제어</div>');
        entryHits.forEach(function (e) {
          parts.push(
            '<button type="button" class="search-hit-btn" data-search-pick-entry="' + escapeHtml(e.id) + '">' +
              '<span class="search-hit-btn__main">' +
                '<span class="search-hit-btn__term">' + escapeHtml(e.term) + (e.hanja ? ' (' + escapeHtml(e.hanja) + ')' : '') + '</span>' +
                '<span class="search-hit-btn__sub">' + escapeHtml(e.oneLiner) + '</span>' +
              '</span>' +
              '<span class="subject-pill">' + escapeHtml(e.chapterNumber) + '</span>' +
            '</button>'
          );
        });
      }

      if (rootHits.length > 0) {
        parts.push('<div class="search-group-label">뿌리 한자 레고 도감</div>');
        rootHits.forEach(function (r) {
          parts.push(
            '<button type="button" class="search-hit-btn" data-search-pick-root="' + escapeHtml(r.id) + '">' +
              '<span class="search-hit-btn__main">' +
                '<span class="search-hit-btn__term"><span class="hanja-glyph">' + escapeHtml(r.char) + '</span> · ' + escapeHtml(r.hunEum) + '</span>' +
                '<span class="search-hit-btn__sub">' + escapeHtml(r.pictographStory) + '</span>' +
              '</span>' +
              '<span class="subject-pill">뿌리 한자</span>' +
            '</button>'
          );
        });
      }

      if (pairHits.length > 0) {
        parts.push('<div class="search-group-label">쌍둥이 개념 VS 대결</div>');
        pairHits.forEach(function (p) {
          parts.push(
            '<button type="button" class="search-hit-btn" data-search-pick-pair="' + escapeHtml(p.id) + '">' +
              '<span class="search-hit-btn__main">' +
                '<span class="search-hit-btn__term">' + escapeHtml(p.left.term) + ' VS ' + escapeHtml(p.right.term) + '</span>' +
                '<span class="search-hit-btn__sub">' + escapeHtml(p.oneSecondRule) + '</span>' +
              '</span>' +
              '<span class="subject-pill">비교</span>' +
            '</button>'
          );
        });
      }

      if (parts.length === 0) {
        parts.push('<div style="padding:18px 12px;text-align:center;font-size:0.85rem;color:var(--ink-muted);">‘' + escapeHtml(q) + '’에 해당하는 단어나 한자를 찾지 못했습니다.</div>');
      }

      dom.globalSearchPopover.innerHTML = parts.join('');
      dom.globalSearchPopover.hidden = false;
    }

    /* ----------------------------------------------------------------------
       Study Actions (Mastery Stamp, Bookmark, Paper Slip, Backup)
       ---------------------------------------------------------------------- */
    function setEntryMastery(entryId, level) {
      var entry = book.entryById[entryId];
      if (!entry) return;
      var current = Number(study.mastery[entryId] || 0);
      var next = current === level ? 0 : level;
      if (next === 0) {
        delete study.mastery[entryId];
      } else {
        study.mastery[entryId] = next;
      }
      if (next === 3) {
        ui.justStampedId = entryId;
        showToast('💮 «' + entry.term + '» 파인만 통달 인장을 찍었습니다!');
      } else if (next === 2) {
        showToast('🌿 «' + entry.term + '» 익숙해짐 도장을 찍었습니다.');
      } else if (next === 1) {
        showToast('🌱 «' + entry.term + '» 처음 봄 표시를 남겼습니다.');
      }
      saveStudy();
      if (isChapterTab(ui.activeTab)) {
        renderReaderBodyOnly();
      } else {
        renderActiveSection();
      }
    }

    function toggleBookmark(entryId) {
      var entry = book.entryById[entryId];
      if (!entry) return;
      var idx = study.bookmarks.indexOf(entryId);
      if (idx === -1) {
        study.bookmarks.unshift(entryId);
        showToast('🔖 «' + entry.term + '» 페이지에 빨간 책갈피를 꽂았습니다.');
      } else {
        study.bookmarks.splice(idx, 1);
        showToast('책갈피를 뺐습니다.');
      }
      saveStudy();
      if (isChapterTab(ui.activeTab)) {
        renderReaderBodyOnly();
      } else {
        renderActiveSection();
      }
    }

    function toggleCurrentSpreadSlip() {
      if (!isChapterTab(ui.activeTab) || study.readerViewMode !== 'spread') return;
      if (study.globalSlipMode) {
        ui.spreadSlipPeeled = !ui.spreadSlipPeeled;
      } else {
        ui.manualSlipActive = !ui.manualSlipActive;
      }
      renderReaderBodyOnly();
    }

    function exportStudyBackup() {
      var payload = {
        exportedAt: new Date().toISOString(),
        bookTitle: '고졸 검정고시 파인만 어휘·한자 서재',
        theme: SafeStorage.get(STORAGE_THEME_KEY) || 'hanji',
        study: study
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'ged-feynman-study-backup-' + dateStr + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('📦 학습 기록 JSON 백업 파일을 내려받았습니다.');
    }

    function importStudyBackupFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result || '{}'));
          var incoming = (data && data.study && typeof data.study === 'object') ? data.study : data;
          if (!incoming || typeof incoming !== 'object') throw new Error('Invalid format');

          if (incoming.mastery && typeof incoming.mastery === 'object') study.mastery = incoming.mastery;
          if (Array.isArray(incoming.bookmarks)) study.bookmarks = incoming.bookmarks.filter(Boolean);
          if (incoming.notes && typeof incoming.notes === 'object') study.notes = incoming.notes;
          if (incoming.lastRead && typeof incoming.lastRead === 'object') study.lastRead = incoming.lastRead;
          if (incoming.drillHistory && typeof incoming.drillHistory === 'object') study.drillHistory = incoming.drillHistory;
          if (Array.isArray(incoming.wrongDrillIds)) study.wrongDrillIds = incoming.wrongDrillIds.filter(Boolean);

          if (data.theme) applyTheme(data.theme);
          saveStudy();
          renderActiveSection();
          showToast('✓ 백업 파일에서 나의 서재 기록을 복원했습니다!');
        } catch (err) {
          showToast('올바른 서재 백업 JSON 파일이 아닙니다.');
        }
      };
      reader.readAsText(file, 'utf-8');
    }

    /* ----------------------------------------------------------------------
       Delegated Click & Keyboard Event Listeners
       ---------------------------------------------------------------------- */
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;

      /* Close global search popover if clicked outside */
      if (dom.globalSearchPopover && !dom.globalSearchPopover.hidden && !target.closest('.desk-search')) {
        dom.globalSearchPopover.hidden = true;
      }

      /* Navigation Tabs */
      var navBtn = target.closest('[data-nav-tab]');
      if (navBtn) {
        switchTab(navBtn.getAttribute('data-nav-tab'));
        return;
      }

      /* Theme Switcher */
      var themeBtn = target.closest('[data-theme-choice]');
      if (themeBtn) {
        applyTheme(themeBtn.getAttribute('data-theme-choice'));
        return;
      }

      /* Open Specific Entry */
      var openEntryBtn = target.closest('[data-open-entry]');
      if (openEntryBtn) {
        openEntry(openEntryBtn.getAttribute('data-open-entry'), { pushHistory: true, resetFilters: true, forceSpread: true });
        return;
      }

      var openSpreadBtn = target.closest('[data-open-spread-entry]');
      if (openSpreadBtn) {
        openEntry(openSpreadBtn.getAttribute('data-open-spread-entry'), { forceSpread: true, keepAllScope: true });
        return;
      }

      /* Reader View Mode Switch */
      var viewBtn = target.closest('[data-reader-view]');
      if (viewBtn) {
        study.readerViewMode = viewBtn.getAttribute('data-reader-view') === 'anthology' ? 'anthology' : 'spread';
        saveStudy();
        renderChapterSection();
        return;
      }

      /* Turn Spread Page / Word Chip Selection */
      var turnBtn = target.closest('[data-turn-entry]');
      if (turnBtn && !turnBtn.disabled) {
        var nextId = turnBtn.getAttribute('data-turn-entry');
        if (nextId && book.entryById[nextId]) {
          ui.currentEntryId = nextId;
          ui.spreadSlipPeeled = false;
          ui.manualSlipActive = false;
          recordLastRead(book.entryById[nextId]);
          renderReaderBodyOnly();
        }
        return;
      }

      var chipBtn = target.closest('[data-select-entry]');
      if (chipBtn) {
        var chipId = chipBtn.getAttribute('data-select-entry');
        if (chipId && book.entryById[chipId]) {
          ui.currentEntryId = chipId;
          ui.spreadSlipPeeled = false;
          ui.manualSlipActive = false;
          recordLastRead(book.entryById[chipId]);
          renderReaderBodyOnly();
        }
        return;
      }

      /* Bookmark Pin */
      var bmBtn = target.closest('[data-toggle-bookmark]');
      if (bmBtn) {
        toggleBookmark(bmBtn.getAttribute('data-toggle-bookmark'));
        return;
      }

      /* Mastery Ink Stamp */
      var masBtn = target.closest('[data-mastery-entry]');
      if (masBtn) {
        setEntryMastery(masBtn.getAttribute('data-mastery-entry'), Number(masBtn.getAttribute('data-level')));
        return;
      }

      /* Paper Slip Veil Click / Toggle */
      if (target.closest('#activePaperSlipVeil') || target.closest('[data-action="toggle-page-slip"]')) {
        toggleCurrentSpreadSlip();
        return;
      }

      var unveilAnthBtn = target.closest('[data-unveil-anthology]');
      if (unveilAnthBtn) {
        ui.revealedSelfChecks['slip_' + unveilAnthBtn.getAttribute('data-unveil-anthology')] = true;
        renderReaderBodyOnly();
        return;
      }

      /* Step 4 Self Check Individual Answer Strip */
      var selfAnsBtn = target.closest('[data-toggle-self-answer]');
      if (selfAnsBtn) {
        var sId = selfAnsBtn.getAttribute('data-toggle-self-answer');
        ui.revealedSelfChecks[sId] = !ui.revealedSelfChecks[sId];
        renderReaderBodyOnly();
        return;
      }

      /* Hanja Character Click -> Connection Drawer */
      var hanjaBtn = target.closest('[data-hanja-inspect]');
      if (hanjaBtn) {
        openHanjaDrawerForChar(hanjaBtn.getAttribute('data-hanja-inspect'));
        return;
      }

      /* Related Term Click */
      var relBtn = target.closest('[data-related-term]');
      if (relBtn) {
        handleRelatedTermClick(relBtn.getAttribute('data-related-term'));
        return;
      }

      /* Drawer Internal Actions */
      var drawerEntryBtn = target.closest('[data-drawer-open-entry]');
      if (drawerEntryBtn) {
        closeHanjaDrawer();
        openEntry(drawerEntryBtn.getAttribute('data-drawer-open-entry'), { pushHistory: true, resetFilters: true, forceSpread: true });
        return;
      }

      var drawerRootBtn = target.closest('[data-jump-root-atlas]');
      if (drawerRootBtn) {
        ui.selectedRootId = drawerRootBtn.getAttribute('data-jump-root-atlas');
        ui.rootCategory = '전체';
        ui.rootSearchQuery = '';
        closeHanjaDrawer();
        switchTab('roots');
        return;
      }

      if (target.closest('[data-drawer-open-confusable]')) {
        closeHanjaDrawer();
        switchTab('confusables');
        return;
      }

      /* Global Search Popover Picks */
      var pickEntry = target.closest('[data-search-pick-entry]');
      if (pickEntry) {
        dom.globalSearchPopover.hidden = true;
        openEntry(pickEntry.getAttribute('data-search-pick-entry'), { pushHistory: true, resetFilters: true, forceSpread: true });
        return;
      }

      var pickRoot = target.closest('[data-search-pick-root]');
      if (pickRoot) {
        dom.globalSearchPopover.hidden = true;
        ui.selectedRootId = pickRoot.getAttribute('data-search-pick-root');
        ui.rootCategory = '전체';
        ui.rootSearchQuery = '';
        switchTab('roots');
        return;
      }

      var pickPair = target.closest('[data-search-pick-pair]');
      if (pickPair) {
        dom.globalSearchPopover.hidden = true;
        ui.confusableSubject = '전체';
        switchTab('confusables');
        return;
      }

      /* Roots Section Actions */
      var rootCatBtn = target.closest('[data-root-cat]');
      if (rootCatBtn) {
        ui.rootCategory = rootCatBtn.getAttribute('data-root-cat');
        renderRootsSection();
        return;
      }

      var rootTileBtn = target.closest('[data-select-root]');
      if (rootTileBtn) {
        ui.selectedRootId = rootTileBtn.getAttribute('data-select-root');
        renderRootsDynamicParts();
        if (window.innerWidth <= 960) {
          var spot = document.getElementById('rootSpotlightPage');
          if (spot) spot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (target.closest('[data-reset-roots]')) {
        ui.rootCategory = '전체';
        ui.rootSearchQuery = '';
        renderRootsSection();
        return;
      }

      /* Confusables Section Actions */
      var confSubBtn = target.closest('[data-conf-sub]');
      if (confSubBtn) {
        ui.confusableSubject = confSubBtn.getAttribute('data-conf-sub');
        renderConfusablesSection();
        return;
      }

      if (target.closest('#btnConfusableBlind')) {
        ui.confusableBlindMode = !ui.confusableBlindMode;
        ui.revealedPairIds = {};
        renderConfusablesSection();
        return;
      }

      var pairBlindBtn = target.closest('[data-toggle-pair-blind]');
      if (pairBlindBtn) {
        var pid = pairBlindBtn.getAttribute('data-toggle-pair-blind');
        ui.revealedPairIds[pid] = !ui.revealedPairIds[pid];
        renderConfusablesSection();
        return;
      }

      /* Drills Section Actions */
      var drillSubBtn = target.closest('[data-drill-sub]');
      if (drillSubBtn) {
        ui.drillSubject = drillSubBtn.getAttribute('data-drill-sub');
        renderDrillsSection();
        return;
      }

      var drillOptBtn = target.closest('[data-drill-id]');
      if (drillOptBtn) {
        var dId = drillOptBtn.getAttribute('data-drill-id');
        var oIdx = Number(drillOptBtn.getAttribute('data-opt-idx'));
        var drillObj = book.drills.filter(function (d) { return d.id === dId; })[0];
        if (drillObj) {
          var correct = oIdx === drillObj.answerIndex;
          study.drillHistory[dId] = { selectedIndex: oIdx, isCorrect: correct };
          var wIdx = study.wrongDrillIds.indexOf(dId);
          if (!correct && wIdx === -1) {
            study.wrongDrillIds.push(dId);
          } else if (correct && wIdx !== -1) {
            study.wrongDrillIds.splice(wIdx, 1);
          }
          saveStudy();
          renderDrillsSection();
        }
        return;
      }

      var resetOneDrill = target.closest('[data-reset-single-drill]');
      if (resetOneDrill) {
        delete study.drillHistory[resetOneDrill.getAttribute('data-reset-single-drill')];
        saveStudy();
        renderDrillsSection();
        return;
      }

      if (target.closest('#btnToggleWrongOnly')) {
        ui.drillRetryWrongOnly = !ui.drillRetryWrongOnly;
        if (ui.drillRetryWrongOnly) {
          /* Clear previous selections on wrong items so learner can actively re-answer them */
          study.wrongDrillIds.forEach(function (wid) {
            delete study.drillHistory[wid];
          });
          saveStudy();
        }
        renderDrillsSection();
        return;
      }

      if (target.closest('#btnExitWrongMode')) {
        ui.drillRetryWrongOnly = false;
        renderDrillsSection();
        return;
      }

      if (target.closest('#btnResetAllDrills')) {
        study.drillHistory = {};
        ui.drillRetryWrongOnly = false;
        saveStudy();
        renderDrillsSection();
        showToast('시험지를 새 종이로 깨끗이 초기화했습니다.');
        return;
      }

      /* Library Section Actions */
      var libTabBtn = target.closest('[data-lib-tab]');
      if (libTabBtn) {
        ui.librarySubTab = libTabBtn.getAttribute('data-lib-tab');
        renderLibrarySection();
        return;
      }

      if (target.closest('#btnExportBackup')) {
        exportStudyBackup();
        return;
      }

      if (target.closest('#btnImportBackup') && dom.backupFileInput) {
        dom.backupFileInput.value = '';
        dom.backupFileInput.click();
        return;
      }

      if (target.closest('#btnPracticeUnmastered')) {
        study.globalSlipMode = true;
        study.readerViewMode = 'spread';
        ui.activeTab = 'all';
        ui.chapterFilterMastery = 'unmastered';
        ui.chapterFilterSubject = 'all';
        ui.chapterFilterImportance = 'all';
        ui.chapterSearchQuery = '';
        ui.spreadSlipPeeled = false;
        saveStudy();
        renderNavigationTabs();
        renderActiveSection();
        showToast('🔥 미통달 단어 집중 가림막 복습을 시작합니다!');
      }
    });

    /* Direct Chrome Controls */
    if (dom.btnHomeBrand) {
      dom.btnHomeBrand.addEventListener('click', function () {
        switchTab('cover');
      });
    }

    if (dom.btnTopResume) {
      dom.btnTopResume.addEventListener('click', function () {
        if (study.lastRead && study.lastRead.entryId) {
          openEntry(study.lastRead.entryId, { resetFilters: true, forceSpread: true });
        }
      });
    }

    if (dom.physicalRibbon) {
      dom.physicalRibbon.addEventListener('click', function () {
        if (isChapterTab(ui.activeTab) && study.readerViewMode === 'spread' && ui.currentEntryId) {
          toggleBookmark(ui.currentEntryId);
        } else if (study.lastRead && study.lastRead.entryId && book.entryById[study.lastRead.entryId]) {
          openEntry(study.lastRead.entryId, { resetFilters: true, forceSpread: true });
        } else if (book.allEntries[0]) {
          openEntry(book.allEntries[0].id, { resetFilters: true, forceSpread: true });
        }
      });
    }

    if (dom.btnGlobalSlipToggle) {
      dom.btnGlobalSlipToggle.addEventListener('click', function () {
        study.globalSlipMode = !study.globalSlipMode;
        ui.spreadSlipPeeled = false;
        ui.manualSlipActive = false;
        saveStudy();
        if (isChapterTab(ui.activeTab)) {
          renderReaderBodyOnly();
        }
        showToast(study.globalSlipMode
          ? '종이 가림막 모드를 켰습니다. 먼저 내 말로 설명한 뒤 Space를 눌러보세요!'
          : '종이 가림막 모드를 껐습니다.');
      });
    }

    if (dom.globalSearchInput) {
      dom.globalSearchInput.addEventListener('input', function () {
        renderGlobalSearchPopover(dom.globalSearchInput.value);
      });
      dom.globalSearchInput.addEventListener('focus', function () {
        if (dom.globalSearchInput.value.trim()) {
          renderGlobalSearchPopover(dom.globalSearchInput.value);
        }
      });
    }

    if (dom.btnClearGlobalSearch && dom.globalSearchInput) {
      dom.btnClearGlobalSearch.addEventListener('click', function () {
        dom.globalSearchInput.value = '';
        renderGlobalSearchPopover('');
        dom.globalSearchInput.focus();
      });
    }

    if (dom.btnShortcutHelp) {
      dom.btnShortcutHelp.addEventListener('click', function () {
        dom.shortcutModalBackdrop.hidden = false;
        dom.shortcutModal.hidden = false;
      });
    }

    if (dom.btnCloseShortcutModal) dom.btnCloseShortcutModal.addEventListener('click', closeShortcutModal);
    if (dom.shortcutModalBackdrop) dom.shortcutModalBackdrop.addEventListener('click', closeShortcutModal);
    if (dom.btnCloseHanjaDrawer) dom.btnCloseHanjaDrawer.addEventListener('click', closeHanjaDrawer);
    if (dom.hanjaDrawerBackdrop) dom.hanjaDrawerBackdrop.addEventListener('click', closeHanjaDrawer);

    if (dom.backupFileInput) {
      dom.backupFileInput.addEventListener('change', function () {
        if (dom.backupFileInput.files && dom.backupFileInput.files[0]) {
          importStudyBackupFile(dom.backupFileInput.files[0]);
        }
      });
    }

    /* ----------------------------------------------------------------------
       Keyboard Shortcuts (← / →, Space, /, B, 1~3, Esc)
       ---------------------------------------------------------------------- */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeHanjaDrawer();
        closeShortcutModal();
        if (dom.globalSearchPopover) dom.globalSearchPopover.hidden = true;
        return;
      }

      var activeEl = document.activeElement;
      var tagName = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
      var isTyping = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || Boolean(activeEl && activeEl.isContentEditable);

      if (isTyping) return;

      if (e.key === '/') {
        e.preventDefault();
        if (dom.globalSearchInput) {
          dom.globalSearchInput.focus();
          dom.globalSearchInput.select();
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        dom.shortcutModalBackdrop.hidden = false;
        dom.shortcutModal.hidden = false;
        return;
      }

      /* Do not trigger book page shortcuts while a modal/drawer is open */
      if ((dom.hanjaDrawer && !dom.hanjaDrawer.hidden) || (dom.shortcutModal && !dom.shortcutModal.hidden)) {
        return;
      }

      /* Chapter Spread Reader Shortcuts */
      if (isChapterTab(ui.activeTab) && study.readerViewMode === 'spread') {
        var entries = getActiveChapterEntries();
        var idx = -1;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].id === ui.currentEntryId) {
            idx = i;
            break;
          }
        }

        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          var prev = entries[idx - 1];
          ui.currentEntryId = prev.id;
          ui.spreadSlipPeeled = false;
          ui.manualSlipActive = false;
          recordLastRead(prev);
          renderReaderBodyOnly();
          return;
        }

        if (e.key === 'ArrowRight' && idx >= 0 && idx < entries.length - 1) {
          e.preventDefault();
          var next = entries[idx + 1];
          ui.currentEntryId = next.id;
          ui.spreadSlipPeeled = false;
          ui.manualSlipActive = false;
          recordLastRead(next);
          renderReaderBodyOnly();
          return;
        }

        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          toggleCurrentSpreadSlip();
          return;
        }

        if ((e.key === 'b' || e.key === 'B') && ui.currentEntryId) {
          e.preventDefault();
          toggleBookmark(ui.currentEntryId);
          return;
        }

        if ((e.key === '1' || e.key === '2' || e.key === '3') && ui.currentEntryId) {
          e.preventDefault();
          setEntryMastery(ui.currentEntryId, Number(e.key));
        }
      }
    });

    /* Initial Boot Render */
    renderNavigationTabs();
    renderActiveSection();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }
})();
