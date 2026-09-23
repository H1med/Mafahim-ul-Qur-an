/* ============================================================
   APP.JS — Application logic (no lesson data)
   Lesson data is loaded from js/lessons/lesson*.js files
   ============================================================ */

var LESSONS = {};
(function collectLessons() {
    var idx = 1;
    while (window['lesson' + idx]) {
        var l = window['lesson' + idx];
        LESSONS[l.id] = l;
        idx++;
    }
})();

var EXERCISES = [
    { id: 'mc',     label: 'Multiple Choice',        icon: 'fa-solid fa-circle-check' },
    { id: 'match',  label: 'Zuordnung',              icon: 'fa-solid fa-link' },
    { id: 'phr1',   label: 'Übersetzung Phrasen',    icon: 'fa-solid fa-language' },
    { id: 'phr2',   label: 'Übersetzung Phrasen 2',  icon: 'fa-solid fa-bars-staggered' },
    { id: 'phr3',   label: 'Übersetzung Phrasen 3',  icon: 'fa-solid fa-pen' },
    { id: 'exam',   label: 'Prüfungsmodus',          icon: 'fa-solid fa-graduation-cap' }
];

var MAX_ERROR_PCT = 0.2; // 20% Fehler erlaubt

// ============================================================
// APP STATE
// ============================================================
var app = {
    screen: 'main',
    currentLesson: null,
    mode: null,
    fc: { cards: [], idx: 0, flipped: false, learned: 0, done: false, shuffle: false, timer: false, timerId: null },
    ex: { active: null, done: {} }
};

// per-exercise runtime states
var exState = {};

function clearExTimers() {
    if (exState._timers && exState._timers.length) {
        exState._timers.forEach(function(t){ clearTimeout(t); clearInterval(t); });
    }
}

// ============================================================
// SCREEN NAVIGATION
// ============================================================
function showScreen(name) {
    document.getElementById('screenMain').classList.toggle('active', name === 'main');
    document.getElementById('screenLesson').classList.toggle('active', name === 'lesson');
    document.getElementById('backBtn').classList.toggle('hidden', name === 'main');
    app.screen = name;
}

function goBack() {
    if (app.screen === 'lesson') {
        stopFcTimer();
        clearExTimers();
        showScreen('main');
        renderMain();
    }
}

function updateHeader() {
    var el = document.getElementById('headerTitle');
    if (app.screen === 'main') {
        el.innerHTML = "Mafaheem-e-Qur'an";
    } else {
        var lesson = LESSONS[app.currentLesson];
        el.innerHTML = lesson.title + '<span class="header-badge">Mafaheem-e-Qur\'an</span>';
    }
}

// ============================================================
// MAIN SCREEN
// ============================================================
function renderMain() {
    showScreen('main');
    updateHeader();
    var el = document.getElementById('screenMain');
    var html = '<div class="main-hero">';
    html += '<h2>Mafaheem-e-Qur\'an</h2>';
    html += '<p>Buch 1 &ndash; Grundstufe</p>';
    html += '</div>';
    html += '<div class="lesson-list">';
    Object.keys(LESSONS).forEach(function(id) {
        var l = LESSONS[id];
        html += '<div class="lesson-card" onclick="openLesson(' + id + ')">';
        html += '<div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>';
        html += '<div class="lesson-card-body">';
        html += '<h3>' + l.title + '</h3>';
        html += '<p>' + l.description + '</p>';
        html += '</div>';
        html += '<i class="fa-solid fa-chevron-right"></i>';
        html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

function openLesson(id) {
    app.currentLesson = id;
    app.mode = null;
    app.ex.active = null;
    app.ex.done = {};
    resetFcState();
    showScreen('lesson');
    updateHeader();
    renderLesson();
}

// ============================================================
// LESSON DETAIL SCREEN
// ============================================================
function renderLesson() {
    var el = document.getElementById('screenLesson');
    var html = '<div class="mode-tabs">';
    html += '<button class="mode-tab ' + (app.mode === 'vocab' ? 'active' : '') + '" onclick="setMode(\'vocab\')">';
    html += '<i class="fa-solid fa-clone"></i> Vokabeln lernen</button>';
    html += '<button class="mode-tab ' + (app.mode === 'exercises' ? 'active' : '') + '" onclick="setMode(\'exercises\')">';
    html += '<i class="fa-solid fa-list-check"></i> Aufgaben lösen</button>';
    html += '</div>';

    if (app.mode === 'vocab') {
        html += renderFlashcards();
    } else if (app.mode === 'exercises') {
        html += renderExerciseHub();
    } else {
        var lesson = LESSONS[app.currentLesson];
        html += '<div class="grammar-note">';
        html += '<div class="grammar-note-title"><i class="fa-solid fa-lightbulb"></i> ' + lesson.grammarNote.title + '</div>';
        html += '<p>' + lesson.grammarNote.text + '</p></div>';
        html += '<div style="text-align:center; margin-top:2rem; color:var(--text-secondary); font-size:0.88rem;">';
        html += '<i class="fa-solid fa-arrow-up" style="margin-right:0.3rem;"></i> Wählen Sie einen Modus oben aus.</div>';
    }
    el.innerHTML = html;
    if (app.mode === 'vocab') attachFcEvents();
}

function setMode(m) {
    app.mode = m;
    if (m === 'exercises') { app.ex.active = null; clearExTimers(); }
    if (m === 'vocab' && app.fc.cards.length === 0) resetFcState();
    if (m !== 'vocab') stopFcTimer();
    renderLesson();
}

// ============================================================
// FLASHCARDS (Vokabelabfrage)
// ============================================================
function resetFcState() {
    var lesson = app.currentLesson ? LESSONS[app.currentLesson] : null;
    app.fc = {
        cards: lesson ? lesson.vocabulary.slice() : [],
        idx: 0, flipped: false, learned: 0, done: false,
        shuffle: app.fc.shuffle || false,
        timer: app.fc.timer || false,
        timerId: null
    };
    if (app.fc.shuffle) shuffleArr(app.fc.cards);
    stopFcTimer();
}

function renderFlashcards() {
    var fc = app.fc;
    var total = fc.cards.length;

    // Settings bar
    var html = '<div class="fc-settings">';
    html += '<label class="toggle"><input type="checkbox" id="fcShuffle" ' + (fc.shuffle ? 'checked' : '') + ' onchange="toggleFcShuffle()"><span class="toggle-track"></span><span class="toggle-label">Shuffle</span></label>';
    html += '<label class="toggle"><input type="checkbox" id="fcTimer" ' + (fc.timer ? 'checked' : '') + ' onchange="toggleFcTimer()"><span class="toggle-track"></span><span class="toggle-label">Zeitmodus (3s / Wort)</span></label>';
    html += '</div>';

    if (fc.done) {
        stopFcTimer();
        html += '<div class="fc-complete">';
        html += '<i class="fa-solid fa-circle-check"></i>';
        html += '<h3>Alle Vokabeln gelernt!</h3>';
        html += '<p>' + total + ' von ' + total + ' Vokabeln durchgearbeitet.</p>';
        html += '<button class="fc-reset-btn" onclick="resetFcAndRender()"><i class="fa-solid fa-rotate-right"></i> Nochmal üben</button>';
        html += '</div>';
        return html;
    }
    var card = fc.cards[fc.idx];
    html += '<div class="flashcard-progress">';
    html += '<span>' + (fc.idx + 1) + ' von ' + total + ' Vokabeln</span>';
    html += '<span>' + fc.learned + ' gelernt</span></div>';
    html += '<div class="flashcard-progress-bar"><div class="flashcard-progress-fill" style="width:' + ((fc.idx + 1) / total * 100) + '%"></div></div>';
    if (fc.timer && !fc.flipped) {
        html += '<div class="fc-timer-bar"><div class="fc-timer-fill" id="fcTimerFill"></div></div>';
    }
    html += '<div class="flashcard-area"><div class="flashcard ' + (fc.flipped ? 'flipped' : '') + '" id="fcCard">';
    html += '<div class="flashcard-face flashcard-front">' +
        '<div class="fc-arabic">' + card.arabic + '</div>' +
        '<div class="fc-hint"><i class="fa-solid fa-hand-pointer"></i> Tippen zum Umdrehen</div>' +
        '</div>';
    html += '<div class="flashcard-face flashcard-back">' +
        '<div class="fc-german">' + card.german + '</div>' +
        '<div class="fc-arabic-small">' + card.arabic + '</div>' +
        '</div>';
    html += '</div></div>';
    html += '<div class="flashcard-actions">';
    html += '<button class="fc-btn btn-wrong" id="fcWrong" ' + (!fc.flipped ? 'disabled' : '') + ' onclick="fcAnswer(false)"><i class="fa-solid fa-xmark"></i> Falsch</button>';
    html += '<button class="fc-btn btn-right" id="fcRight" ' + (!fc.flipped ? 'disabled' : '') + ' onclick="fcAnswer(true)"><i class="fa-solid fa-check"></i> Richtig</button>';
    html += '</div>';
    return html;
}

function toggleFcShuffle() {
    app.fc.shuffle = document.getElementById('fcShuffle').checked;
    resetFcState();
    renderLesson();
}

function toggleFcTimer() {
    app.fc.timer = document.getElementById('fcTimer').checked;
    if (!app.fc.timer) stopFcTimer();
    renderLesson();
}

function stopFcTimer() {
    if (app.fc.timerId) { clearTimeout(app.fc.timerId); app.fc.timerId = null; }
}

function startFcTimer() {
    stopFcTimer();
    if (!app.fc.timer || app.fc.flipped) return;
    app.fc.timerId = setTimeout(function() { autoFlip(); }, 3000);
    // animate fill
    var fill = document.getElementById('fcTimerFill');
    if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '100%';
        // force reflow
        void fill.offsetWidth;
        fill.style.transition = 'width 3s linear';
        fill.style.width = '0%';
    }
}

function attachFcEvents() {
    var card = document.getElementById('fcCard');
    if (card) card.addEventListener('click', flipCard);
    startFcTimer();
}

function autoFlip() {
    if (app.fc.flipped || app.fc.done) return;
    app.fc.flipped = true;
    renderLesson();
}

function flipCard() {
    if (app.fc.flipped) return;
    stopFcTimer();
    app.fc.flipped = true;
    renderLesson();
}

function fcAnswer(correct) {
    var fc = app.fc;
    if (!fc.flipped) return;
    stopFcTimer();
    if (correct) fc.learned++;
    fc.idx++;
    fc.flipped = false;
    if (fc.idx >= fc.cards.length) fc.done = true;
    renderLesson();
}

function resetFcAndRender() {
    resetFcState();
    renderLesson();
}

// ============================================================
// EXERCISE HUB (freie Wahl der Aufgaben)
// ============================================================
function renderExerciseHub() {
    if (app.ex.active) {
        return renderActiveExercise();
    }
    var html = '<p class="exercise-intro">Wählen Sie eine Übung. Es sind ' + Math.round(MAX_ERROR_PCT * 100) + '% Fehler erlaubt.</p>';
    html += '<div class="exercise-grid">';
    EXERCISES.forEach(function(ex, i) {
        var done = app.ex.done[ex.id];
        var num = i + 1;
        html += '<div class="exercise-card ' + (done ? 'done' : '') + '" onclick="startExercise(\'' + ex.id + '\')">';
        html += '<div class="exercise-card-num">' + num + '</div>';
        html += '<div class="exercise-card-icon"><i class="' + ex.icon + '"></i></div>';
        html += '<div class="exercise-card-body"><h3>Übung ' + num + '</h3><p>' + ex.label + '</p></div>';
        if (done) html += '<i class="fa-solid fa-circle-check exercise-card-check"></i>';
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function startExercise(id) {
    app.ex.active = id;
    clearExTimers();
    if (id === 'exam') exState = { _timers: [], showAll: false };
    initExState(id);
    renderLesson();
}

function startExamAll() {
    app.ex.active = 'exam';
    clearExTimers();
    exState = { _timers: [], showAll: true };
    initExState('exam');
    renderLesson();
}

function backToHub() {
    clearExTimers();
    app.ex.active = null;
    exState = {};
    renderLesson();
}

function restartExercise() {
    clearExTimers();
    if (app.ex.active === 'exam') {
        var keepAll = exState.showAll;
        exState = { _timers: [], showAll: keepAll };
    } else {
        exState = { _timers: [] };
    }
    initExState(app.ex.active);
    renderLesson();
}

// ============================================================
// GENERIC EXERCISE STATE INIT
// ============================================================
function initExState(id) {
    exState = { _timers: [] };
    if (id === 'mc') initMC();
    else if (id === 'match') initMatching(false);
    else if (id === 'phr1') initPhr1();
    else if (id === 'phr2') initPhr2();
    else if (id === 'phr3') initPhr3();
    else if (id === 'exam') initExam();
}

function renderActiveExercise() {
    var id = app.ex.active;
    var idx = EXERCISES.findIndex(function(e){ return e.id === id; });
    var num = idx + 1;
    var ex = EXERCISES[idx];
    var html = '<div class="ex-header">';
    html += '<button class="nav-btn" onclick="backToHub()"><i class="fa-solid fa-arrow-left"></i> Zurück</button>';
    html += '<div class="ex-title"><span class="ex-num">Übung ' + num + '</span> <i class="' + ex.icon + '"></i> ' + ex.label + '</div>';
    html += '<button class="nav-btn" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neu</button>';
    html += '</div>';
    if (id === 'mc') html += renderMC();
    else if (id === 'match') html += renderMatching();
    else if (id === 'phr1') html += renderPhr1();
    else if (id === 'phr2') html += renderPhr2();
    else if (id === 'phr3') html += renderPhr3();
    else if (id === 'exam') html += renderExam();
    return html;
}

function markExDone(id, correct, total) {
    var allowed = Math.ceil(total * MAX_ERROR_PCT);
    var errors = total - correct;
    if (errors <= allowed) {
        app.ex.done[id] = true;
    }
}

// ============================================================
// EXERCISE 1: MULTIPLE CHOICE
//   - 15 zufällige Vokabeln
//   - Shuffle on/off (welches Wort abgefragt wird)
//   - Richtung: nur Arabisch, nur Deutsch, beides
// ============================================================
function buildMCQuestions(lesson, count) {
    var vocab = lesson.vocabulary.slice();
    shuffleArr(vocab);
    var selected = vocab.slice(0, Math.min(count, vocab.length));
    return selected.map(function(v) {
        // German options (for "nur Arabisch" - asked in Arabic, answer in German)
        var distractorsDe = (v.distractors || []).slice();
        while (distractorsDe.length < 3) {
            var rand = vocab[Math.floor(Math.random() * vocab.length)];
            if (rand.german !== v.german && distractorsDe.indexOf(rand.german) === -1) distractorsDe.push(rand.german);
        }
        var optsDe = [v.german].concat(distractorsDe.slice(0, 3));
        shuffleArr(optsDe);

        // Arabic options (for "nur Deutsch" - asked in German, answer in Arabic)
        var distractorsAr = [];
        var pool = vocab.filter(function(x){ return x.arabic !== v.arabic; });
        shuffleArr(pool);
        for (var i = 0; i < pool.length && distractorsAr.length < 3; i++) {
            distractorsAr.push(pool[i].arabic);
        }
        var optsAr = [v.arabic].concat(distractorsAr.slice(0, 3));
        shuffleArr(optsAr);

        return {
            arabic: v.arabic, german: v.german,
            optionsDe: optsDe, correctDe: optsDe.indexOf(v.german),
            optionsAr: optsAr, correctAr: optsAr.indexOf(v.arabic)
        };
    });
}

function initMC() {
    var lesson = LESSONS[app.currentLesson];
    exState.questions = buildMCQuestions(lesson, 15);
    exState.sel = {};
    exState.checked = false;
    exState.shuffle = false;
    exState.direction = 'both'; // 'ar', 'de', 'both'
    exState.evalIdx = 0;      // sequential evaluation index
    exState.evalOrder = rangeArr(exState.questions.length);
    if (exState.shuffle) shuffleArr(exState.evalOrder);
}

function renderMC() {
    var st = exState;
    // direction selector
    var html = '<div class="ex-controls">';
    html += '<label class="toggle"><input type="checkbox" id="mcShuffle" ' + (st.shuffle ? 'checked' : '') + ' onchange="toggleMCShuffle()"><span class="toggle-track"></span><span class="toggle-label">Shuffle</span></label>';
    html += '<div class="seg-control">';
    html += '<button class="seg-btn ' + (st.direction === 'ar' ? 'active' : '') + '" onclick="setMCDir(\'ar\')">nur Arabisch</button>';
    html += '<button class="seg-btn ' + (st.direction === 'de' ? 'active' : '') + '" onclick="setMCDir(\'de\')">nur Deutsch</button>';
    html += '<button class="seg-btn ' + (st.direction === 'both' ? 'active' : '') + '" onclick="setMCDir(\'both\')">beides</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="exercise-content">';
    var currentIdx = st.evalOrder[st.evalIdx];
    var q = st.questions[currentIdx];
    var total = st.questions.length;
    var askArabic = (st.direction === 'ar') || (st.direction === 'both' && st.evalIdx % 2 === 0);
    var askText = askArabic ? q.arabic : q.german;
    var askIsArabic = askArabic;

    if (!st.checked) {
        // askArabic = Frage wird auf Arabisch gezeigt (Antwort = Deutsch)
        // !askArabic = Frage wird auf Deutsch gezeigt (Antwort = Arabisch)
        var opts = askArabic ? q.optionsDe : q.optionsAr;
        var correctIdx = askArabic ? q.correctDe : q.correctAr;
        html += '<div class="mc-progress">' + (st.evalIdx + 1) + ' / ' + total + '</div>';
        html += '<div class="mc-question">';
        html += '<div class="mc-question-text">' + (askIsArabic ? '<span class="arabic">' + askText + '</span>' : askText) + '</div>';
        html += '<div class="mc-options">';
        var labels = ['A','B','C','D'];
        opts.forEach(function(opt, oi) {
            var sel = st.sel[st.evalIdx];
            var cls = 'mc-opt';
            if (sel === oi) cls += ' selected';
            // Option anzeigen: wenn Frage arabisch -> Option deutsch; wenn Frage deutsch -> Option arabisch
            var optHtml = askIsArabic ? opt : '<span class="arabic-inline">' + opt + '</span>';
            html += '<button class="' + cls + '" onclick="mcSelect(' + oi + ')">' + labels[oi] + ') ' + optHtml + '</button>';
        });
        html += '</div>';
        html += '</div>';
        html += '<button class="check-btn" onclick="mcNext()" ' + (st.sel[st.evalIdx] === undefined ? 'disabled' : '') + '>Weiter <i class="fa-solid fa-arrow-right"></i></button>';
    } else {
        // results
        var correct = 0;
        st.questions.forEach(function(qq, i) {
            var askAr = (st.direction === 'ar') || (st.direction === 'both' && i % 2 === 0);
            var cIdx = askAr ? qq.correctDe : qq.correctAr;
            if (st.sel[i] === cIdx) correct++;
        });
        html += '<div class="mc-score show">Ergebnis: ' + correct + ' von ' + total + ' richtig</div>';
        // detailed review
        st.questions.forEach(function(qq, i) {
            var askAr = (st.direction === 'ar') || (st.direction === 'both' && i % 2 === 0);
            var cIdx = askAr ? qq.correctDe : qq.correctAr;
            var opts = askAr ? qq.optionsDe : qq.optionsAr;
            var isCorrect = st.sel[i] === cIdx;
            var askText = askAr ? qq.arabic : qq.german;
            html += '<div class="review-block ' + (isCorrect ? 'review-correct' : 'review-wrong') + '">';
            html += '<div class="review-num">Frage ' + (i + 1) + ' <i class="fa-solid ' + (isCorrect ? 'fa-check' : 'fa-xmark') + '"></i></div>';
            html += '<div class="mc-question-text">' + (askAr ? '<span class="arabic">' + askText + '</span>' : askText) + '</div>';
            html += '<div class="mc-options">';
            var labels = ['A','B','C','D'];
            opts.forEach(function(opt, oi) {
                var cls = 'mc-opt';
                if (oi === cIdx) cls += ' correct';
                else if (st.sel[i] === oi) cls += ' incorrect';
                var optHtml = askAr ? opt : '<span class="arabic-inline">' + opt + '</span>';
                html += '<button class="' + cls + '" disabled>' + labels[oi] + ') ' + optHtml + '</button>';
            });
            html += '</div>';
            html += '</div>';
        });
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neue Runde</button>';
    }
    html += '</div>';
    return html;
}

function mcSelect(oi) {
    if (exState.checked) return;
    exState.sel[exState.evalIdx] = oi;
    renderLesson();
}

function mcNext() {
    var st = exState;
    if (st.sel[st.evalIdx] === undefined) return;
    st.evalIdx++;
    if (st.evalIdx >= st.questions.length) {
        st.evalIdx = st.questions.length - 1;
        // finish
        st.checked = true;
        var correct = 0;
        st.questions.forEach(function(qq, i) {
            var askAr = (st.direction === 'ar') || (st.direction === 'both' && i % 2 === 0);
            var cIdx = askAr ? qq.correctDe : qq.correctAr;
            if (st.sel[i] === cIdx) correct++;
        });
        markExDone('mc', correct, st.questions.length);
    }
    renderLesson();
}

function toggleMCShuffle() {
    exState.shuffle = document.getElementById('mcShuffle').checked;
    // reshuffle evaluation order (only for unanswered portion)
    exState.evalOrder = rangeArr(exState.questions.length);
    if (exState.shuffle) shuffleArr(exState.evalOrder);
    exState.evalIdx = 0;
    exState.sel = {};
    renderLesson();
}

function setMCDir(dir) {
    exState.direction = dir;
    exState.sel = {};
    exState.evalIdx = 0;
    exState.checked = false;
    renderLesson();
}

// ============================================================
// EXERCISE 2: ZUORDNUNG
//   - neue Paare bei jedem Restart
//   - Powermodus: Stufe 1 (10 Paare, 12s), Stufe 2 (alle Paare, 1s/Paar)
// ============================================================
function initMatching(powerStart) {
    var lesson = LESSONS[app.currentLesson];
    var allPairs = lesson.exercises.matching.pairs.slice();
    shuffleArr(allPairs);
    exState.allPairs = allPairs;
    exState.power = !!powerStart;
    exState.powerLevel = 0; // 0 = normal, 1 = stufe1, 2 = stufe2
    exState.matched = [];
    exState.selA = null;
    exState.selG = null;
    exState.timeLeft = 0;
    exState.finished = false;
    setupMatchRound();
}

function setupMatchRound() {
    var st = exState;
    var pairs;
    if (st.power) {
        if (st.powerLevel === 0) st.powerLevel = 1;
        if (st.powerLevel === 1) {
            pairs = st.allPairs.slice(0, Math.min(10, st.allPairs.length));
            st.timeLeft = 12;
        } else {
            pairs = st.allPairs.slice(0, Math.min(10, st.allPairs.length));
            st.timeLeft = pairs.length * 1;
        }
    } else {
        pairs = st.allPairs.slice(0, Math.min(10, st.allPairs.length));
    }
    st.pairs = pairs;
    st.arabic = pairs.map(function(p){ return p.arabic; });
    st.germanShuffled = pairs.map(function(p){ return p.german; });
    shuffleArr(st.germanShuffled);
    st.matched = [];
    st.selA = null;
    st.selG = null;
    st.finished = false;
    if (st.power) startMatchTimer();
}

function startMatchTimer() {
    clearExTimers();
    exState._timers = exState._timers || [];
    var tick = setInterval(function() {
        exState.timeLeft--;
        if (exState.timeLeft <= 0) {
            clearInterval(tick);
            exState.finished = true;
            // count matched as correct
            var correct = exState.matched.length;
            markExDone('match', correct, exState.pairs.length);
            renderLesson();
            return;
        }
        // update timer display only
        var el = document.getElementById('matchTimer');
        if (el) el.textContent = exState.timeLeft + 's';
    }, 1000);
    exState._timers.push(tick);
}

function renderMatching() {
    var st = exState;
    var html = '<div class="ex-controls">';
    html += '<label class="toggle"><input type="checkbox" id="matchPower" ' + (st.power ? 'checked' : '') + ' onchange="toggleMatchPower()"><span class="toggle-track"></span><span class="toggle-label">Powermodus</span></label>';
    if (st.power) {
        html += '<span class="badge">Stufe ' + st.powerLevel + '</span>';
        html += '<span class="timer-badge" id="matchTimer">' + st.timeLeft + 's</span>';
    }
    html += '<button class="nav-btn" onclick="newMatchArrangement()"><i class="fa-solid fa-shuffle"></i> Neue Zuordnung</button>';
    html += '</div>';

    html += '<div class="exercise-content">';
    if (st.finished) {
        html += '<div class="mc-score show">Zeit abgelaufen! ' + st.matched.length + ' von ' + st.pairs.length + ' korrekt</div>';
        if (st.power && st.powerLevel === 1) {
            html += '<button class="check-btn" style="margin-top:0.5rem" onclick="matchNextLevel()"><i class="fa-solid fa-forward"></i> Stufe 2 starten</button>';
        }
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neu</button>';
        html += '</div>';
        return html;
    }
    html += '<p class="exercise-intro">Klicken Sie auf ein arabisches Wort und dann auf die passende Übersetzung.</p>';
    html += '<div class="match-cols">';
    html += '<div class="match-col"><h4>Arabisch</h4><div class="match-items">';
    st.arabic.forEach(function(w, i) {
        var matchedA = st.matched.find(function(x){ return x.a === i; });
        var cls = 'match-item';
        if (matchedA) cls += ' matched';
        else if (st.selA === i) cls += ' active';
        html += '<div class="' + cls + '" ' + (matchedA ? '' : 'onclick="matchSelect(\'a\',' + i + ')"') + '><span class="arabic-inline">' + w + '</span></div>';
    });
    html += '</div></div>';
    html += '<div class="match-col"><h4>Deutsch</h4><div class="match-items">';
    st.germanShuffled.forEach(function(w, i) {
        var matchedG = st.matched.find(function(x){ return x.g === i; });
        var cls = 'match-item';
        if (matchedG) cls += ' matched';
        else if (st.selG === i) cls += ' active';
        html += '<div class="' + cls + '" ' + (matchedG ? '' : 'onclick="matchSelect(\'g\',' + i + ')"') + '>' + w + '</div>';
    });
    html += '</div></div></div>';
    var matchedCount = st.matched.length;
    var totalPairs = st.pairs.length;
    html += '<div class="match-status">';
    if (matchedCount === totalPairs) {
        html += '<span style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Alle Paare korrekt zugeordnet!</span>';
        if (!st.power) markExDone('match', matchedCount, totalPairs);
    } else if (matchedCount > 0) {
        html += '<span style="color:var(--success)">' + matchedCount + '/' + totalPairs + ' korrekt</span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

function matchSelect(side, idx) {
    var st = exState;
    if (st.finished) return;
    var totalPairs = st.pairs.length;
    if (side === 'a') {
        if (st.matched.find(function(x){ return x.a === idx; })) return;
        st.selA = idx;
    } else {
        if (st.matched.find(function(x){ return x.g === idx; })) return;
        st.selG = idx;
    }
    if (st.selA !== null && st.selG !== null) {
        var correctG = st.pairs[st.selA].german;
        var pickedG = st.germanShuffled[st.selG];
        if (correctG === pickedG) {
            st.matched.push({ a: st.selA, g: st.selG });
            if (st.matched.length >= totalPairs) {
                if (!st.power) markExDone('match', st.matched.length, totalPairs);
                if (st.power && st.powerLevel === 1) {
                    // finished level 1 early
                }
            }
        } else {
            renderLesson();
            var selA = st.selA, selG = st.selG;
            setTimeout(function() {
                var aItems = document.querySelectorAll('.match-col:first-child .match-item');
                var gItems = document.querySelectorAll('.match-col:last-child .match-item');
                if (aItems[selA]) aItems[selA].classList.add('wrong');
                if (gItems[selG]) gItems[selG].classList.add('wrong');
                setTimeout(function() {
                    st.selA = null; st.selG = null;
                    renderLesson();
                }, 600);
            }, 10);
            return;
        }
        st.selA = null; st.selG = null;
    }
    renderLesson();
}

function toggleMatchPower() {
    exState.power = document.getElementById('matchPower').checked;
    initMatching(exState.power);
    renderLesson();
}

function newMatchArrangement() {
    clearExTimers();
    initMatching(exState.power);
    renderLesson();
}

function matchNextLevel() {
    clearExTimers();
    exState.powerLevel = 2;
    setupMatchRound();
    renderLesson();
}

// ============================================================
// EXERCISE 3: ÜBERSETZUNG PHRASEN (MC)
// ============================================================
function initPhr1() {
    exState.questions = LESSONS[app.currentLesson].exercises.translatePhrases.slice();
    shuffleArr(exState.questions);
    exState.sel = {};
    exState.checked = false;
}

function renderPhr1() {
    var st = exState;
    var qs = st.questions;
    var html = '<div class="exercise-content">';
    if (!st.checked) {
        qs.forEach(function(q, qi) {
            html += '<div class="trans-verse-block">';
            html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
            html += '<div class="trans-options">';
            q.options.forEach(function(opt, oi) {
                var cls = 'trans-opt';
                if (st.sel[qi] === oi) cls += ' selected';
                html += '<button class="' + cls + '" onclick="phr1Select(' + qi + ',' + oi + ')">' + opt + '</button>';
            });
            html += '</div></div>';
        });
        html += '<button class="check-btn" onclick="phr1Check()"><i class="fa-solid fa-check"></i> Prüfen</button>';
    } else {
        var correct = qs.filter(function(q, i){ return st.sel[i] === q.correct; }).length;
        qs.forEach(function(q, qi) {
            html += '<div class="trans-verse-block">';
            html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
            html += '<div class="trans-options">';
            q.options.forEach(function(opt, oi) {
                var cls = 'trans-opt';
                if (oi === q.correct) cls += ' correct';
                else if (st.sel[qi] === oi) cls += ' incorrect';
                html += '<button class="' + cls + '" disabled>' + opt + '</button>';
            });
            html += '</div></div>';
        });
        html += '<div class="mc-score show">' + correct + ' von ' + qs.length + ' richtig</div>';
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neue Runde</button>';
    }
    html += '</div>';
    return html;
}

function phr1Select(qi, oi) {
    if (exState.checked) return;
    exState.sel[qi] = oi;
    renderLesson();
}

function phr1Check() {
    var st = exState;
    var correct = st.questions.filter(function(q, i){ return st.sel[i] === q.correct; }).length;
    st.checked = true;
    markExDone('phr1', correct, st.questions.length);
    renderLesson();
}

// ============================================================
// EXERCISE 4: ÜBERSETZUNG PHRASEN 2 (Wortreihenfolge)
//   Phrase wird angezeigt, Wörter in richtiger Reihenfolge anklicken
// ============================================================
function initPhr2() {
    var all = LESSONS[app.currentLesson].exercises.phraseOrder.slice();
    shuffleArr(all);
    exState.questions = all.slice(0, Math.min(10, all.length));
    exState.qi = 0;
    exState.picked = [];
    exState.bank = [];
    exState.checked = false;
    setupPhr2Question();
}

function setupPhr2Question() {
    var q = exState.questions[exState.qi];
    exState.picked = [];
    exState.bank = q.words.slice();
    shuffleArr(exState.bank);
}

function renderPhr2() {
    var st = exState;
    var total = st.questions.length;
    var html = '<div class="exercise-content">';
    if (st.checked) {
        var correct = st.results.filter(function(r){ return r; }).length;
        html += '<div class="mc-score show">' + correct + ' von ' + total + ' richtig</div>';
        // detailed review
        st.questions.forEach(function(q, qi) {
            var isCorrect = st.results[qi];
            var userPicked = st.answers[qi] || [];
            html += '<div class="review-block ' + (isCorrect ? 'review-correct' : 'review-wrong') + '">';
            html += '<div class="review-num">Frage ' + (qi + 1) + ' <i class="fa-solid ' + (isCorrect ? 'fa-check' : 'fa-xmark') + '"></i></div>';
            html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
            html += '<div class="phr2-picked static">';
            userPicked.forEach(function(w) {
                html += '<span class="phr2-word">' + w + '</span>';
            });
            html += '</div>';
            if (!isCorrect) {
                html += '<div class="review-correct-answer"><i class="fa-solid fa-circle-check"></i> Richtig: ';
                q.words.forEach(function(w, wi) {
                    html += '<span class="phr2-word correct-word">' + w + '</span>';
                });
                html += '</div>';
            }
            html += '</div>';
        });
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neue Runde</button>';
        html += '</div>';
        return html;
    }
    var q = st.questions[st.qi];
    html += '<div class="mc-progress">Frage ' + (st.qi + 1) + ' / ' + total + '</div>';
    html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
    // picked area
    html += '<div class="phr2-picked" id="phr2Picked">';
    st.picked.forEach(function(w, i) {
        html += '<span class="phr2-word picked" onclick="phr2Unpick(' + i + ')">' + w + '</span>';
    });
    if (st.picked.length === 0) html += '<span class="phr2-placeholder">Wörter in richtiger Reihenfolge anklicken</span>';
    html += '</div>';
    // bank
    html += '<div class="tile-bank">';
    st.bank.forEach(function(w, i) {
        html += '<button class="drag-tile" onclick="phr2Pick(' + i + ')">' + w + '</button>';
    });
    html += '</div>';
    html += '<div class="phr2-actions">';
    html += '<button class="nav-btn" onclick="phr2Reset()" ' + (st.picked.length === 0 ? 'disabled' : '') + '>Zurücksetzen</button>';
    html += '<button class="check-btn" onclick="phr2Next()" ' + (st.picked.length !== q.words.length ? 'disabled' : '') + '>Bestätigen <i class="fa-solid fa-arrow-right"></i></button>';
    html += '</div>';
    html += '</div>';
    return html;
}

function phr2Pick(i) {
    var st = exState;
    st.picked.push(st.bank[i]);
    st.bank.splice(i, 1);
    renderLesson();
}

function phr2Unpick(i) {
    var st = exState;
    var w = st.picked.splice(i, 1)[0];
    st.bank.push(w);
    renderLesson();
}

function phr2Reset() {
    setupPhr2Question();
    renderLesson();
}

function phr2Next() {
    var st = exState;
    var q = st.questions[st.qi];
    var correct = st.picked.length === q.words.length && st.picked.every(function(w, i){ return w === q.words[i]; });
    st.results = st.results || [];
    st.results.push(correct);
    st.answers = st.answers || [];
    st.answers.push(st.picked.slice());
    st.qi++;
    if (st.qi >= st.questions.length) {
        st.checked = true;
        var correctCount = st.results.filter(function(r){ return r; }).length;
        markExDone('phr2', correctCount, st.questions.length);
    } else {
        setupPhr2Question();
    }
    renderLesson();
}

// ============================================================
// EXERCISE 5: ÜBERSETZUNG PHRASEN 3 (Lücken füllen)
// ============================================================
function initPhr3() {
    var all = LESSONS[app.currentLesson].exercises.fillBlank.slice();
    shuffleArr(all);
    exState.questions = all.slice(0, Math.min(10, all.length));
    exState.qi = 0;
    exState.sel = null;
    exState.checked = false;
    exState.results = [];
}

function renderPhr3() {
    var st = exState;
    var total = st.questions.length;
    var html = '<div class="exercise-content">';
    if (st.checked) {
        var correct = st.results.filter(function(r){ return r; }).length;
        html += '<div class="mc-score show">' + correct + ' von ' + total + ' richtig</div>';
        // detailed review
        st.questions.forEach(function(q, qi) {
            var isCorrect = st.results[qi];
            var arabicParts = q.arabic.split('\u00a6');
            html += '<div class="review-block ' + (isCorrect ? 'review-correct' : 'review-wrong') + '">';
            html += '<div class="review-num">Frage ' + (qi + 1) + ' <i class="fa-solid ' + (isCorrect ? 'fa-check' : 'fa-xmark') + '"></i></div>';
            html += '<div class="trans-verse-arabic phr3-verse">';
            if (arabicParts.length > 1) {
                html += arabicParts[0];
                var chosen = st.answers[qi];
                var correctWord = q.options[q.correct];
                if (isCorrect) {
                    html += '<span class="phr3-blank correct-blank"><span class="arabic-inline">' + chosen + '</span></span>';
                } else {
                    html += '<span class="phr3-blank wrong-blank"><span class="arabic-inline">' + (chosen || '—') + '</span></span>';
                }
                html += arabicParts[1];
            } else {
                html += q.arabic;
            }
            html += '</div>';
            html += '<div class="phr3-hint">' + q.hint + '</div>';
            if (!isCorrect) {
                html += '<div class="review-correct-answer"><i class="fa-solid fa-circle-check"></i> Richtig: <span class="arabic-inline">' + q.options[q.correct] + '</span></div>';
            }
            html += '</div>';
        });
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neue Runde</button>';
        html += '</div>';
        return html;
    }
    var q = st.questions[st.qi];
    html += '<div class="mc-progress">Frage ' + (st.qi + 1) + ' / ' + total + '</div>';
    // render arabic with blank shown as gap
    var arabicParts = q.arabic.split('\u00a6');
    html += '<div class="trans-verse-arabic phr3-verse">';
    if (arabicParts.length > 1) {
        html += arabicParts[0];
            html += '<span class="phr3-blank">' + (st.sel !== null ? '<span class="arabic-inline">' + st.sel + '</span>' : '') + '</span>';
        html += arabicParts[1];
    } else {
        html += q.arabic;
    }
    html += '</div>';
    html += '<div class="phr3-hint">' + q.hint + '</div>';
    html += '<div class="mc-options phr3-options">';
    q.options.forEach(function(opt, oi) {
        var cls = 'mc-opt';
        if (st.sel !== null && st.sel === opt) cls += ' selected';
        html += '<button class="' + cls + '" onclick="phr3Select(\'' + escapeQuote(opt) + '\')"><span class="arabic-inline">' + opt + '</span></button>';
    });
    html += '</div>';
    html += '<button class="check-btn" onclick="phr3Next()" ' + (st.sel === null ? 'disabled' : '') + '>Bestätigen <i class="fa-solid fa-arrow-right"></i></button>';
    html += '</div>';
    return html;
}

function phr3Select(opt) {
    exState.sel = opt;
    renderLesson();
}

function phr3Next() {
    var st = exState;
    var q = st.questions[st.qi];
    var correct = st.sel === q.options[q.correct];
    st.results.push(correct);
    st.answers = st.answers || [];
    st.answers.push(st.sel);
    st.qi++;
    st.sel = null;
    if (st.qi >= st.questions.length) {
        st.checked = true;
        var correctCount = st.results.filter(function(r){ return r; }).length;
        markExDone('phr3', correctCount, st.questions.length);
    }
    renderLesson();
}

// ============================================================
// EXERCISE 6: PRÜFUNGSMODUS (Mix aus 5 Übungen)
// ============================================================
function initExam() {
    var lesson = LESSONS[app.currentLesson];
    exState.showAll = exState.showAll || false;
    // Build a mixed quiz: 20 questions total, mixed across all exercise types
    var targetCount = exState.showAll ? 999 : 20;
    var parts = [];
    // distribute evenly across types
    var mcQs = buildMCQuestions(lesson, 99);
    var phr1 = lesson.exercises.translatePhrases.slice(); shuffleArr(phr1);
    var fb = lesson.exercises.fillBlank.slice(); shuffleArr(fb);
    var po = lesson.exercises.phraseOrder.slice(); shuffleArr(po);
    var mcIdx = 0, phr1Idx = 0, fbIdx = 0, poIdx = 0;
    // round-robin fill until targetCount reached or all pools exhausted
    while (parts.length < targetCount) {
        var added = false;
        if (mcIdx < mcQs.length) { parts.push({ type: 'mc', q: mcQs[mcIdx++] }); added = true; }
        if (parts.length >= targetCount) break;
        if (phr1Idx < phr1.length) { parts.push({ type: 'phr1', q: phr1[phr1Idx++] }); added = true; }
        if (parts.length >= targetCount) break;
        if (poIdx < po.length) { parts.push({ type: 'phr2', q: po[poIdx++] }); added = true; }
        if (parts.length >= targetCount) break;
        if (fbIdx < fb.length) { parts.push({ type: 'phr3', q: fb[fbIdx++] }); added = true; }
        if (!added) break; // all pools exhausted
    }
    shuffleArr(parts);
    exState.parts = parts;
    exState.pi = 0;
    exState.results = [];
    exState.sel = null;
    exState.picked = [];
    exState.bank = [];
    setupExamPart();
}

function setupExamPart() {
    var part = exState.parts[exState.pi];
    if (part.type === 'phr2') {
        exState.picked = [];
        exState.bank = part.q.words.slice();
        shuffleArr(exState.bank);
    }
    exState.sel = null;
}

function renderExam() {
    var st = exState;
    var total = st.parts.length;
    var html = '<div class="exercise-content">';
    if (st.pi >= total) {
        var correct = st.results.filter(function(r){ return r; }).length;
        html += '<div class="exam-result">';
        html += '<i class="fa-solid fa-graduation-cap"></i>';
        html += '<h3>Prüfung abgeschlossen!</h3>';
        html += '<div class="mc-score show">' + correct + ' von ' + total + ' richtig (' + Math.round(correct/total*100) + '%)</div>';
        var passed = correct >= total * (1 - MAX_ERROR_PCT);
        html += '<p class="' + (passed ? 'pass' : 'fail') + '">' + (passed ? 'Bestanden!' : 'Nicht bestanden.') + '</p>';
        if (passed) app.ex.done['exam'] = true;
        html += '</div>';
        // detailed review
        st.answers.forEach(function(a, i) {
            var isCorrect = st.results[i];
            html += '<div class="review-block ' + (isCorrect ? 'review-correct' : 'review-wrong') + '">';
            html += '<div class="review-num">Frage ' + (i + 1) + ' <span class="exam-type-badge">' + typeLabel(a.type) + '</span> <i class="fa-solid ' + (isCorrect ? 'fa-check' : 'fa-xmark') + '"></i></div>';
            if (a.type === 'mc') {
                html += '<div class="mc-question-text"><span class="arabic">' + a.q.arabic + '</span></div>';
                html += '<div class="mc-options">';
                var labels = ['A','B','C','D'];
                a.q.optionsDe.forEach(function(opt, oi) {
                    var cls = 'mc-opt';
                    if (oi === a.q.correctDe) cls += ' correct';
                    else if (a.sel === oi) cls += ' incorrect';
                    html += '<button class="' + cls + '" disabled>' + labels[oi] + ') ' + opt + '</button>';
                });
                html += '</div>';
            } else if (a.type === 'phr1') {
                html += '<div class="trans-verse-arabic">' + a.q.arabic + '</div>';
                html += '<div class="trans-options">';
                a.q.options.forEach(function(opt, oi) {
                    var cls = 'trans-opt';
                    if (oi === a.q.correct) cls += ' correct';
                    else if (a.sel === oi) cls += ' incorrect';
                    html += '<button class="' + cls + '" disabled>' + opt + '</button>';
                });
                html += '</div>';
            } else if (a.type === 'phr2') {
                html += '<div class="trans-verse-arabic">' + a.q.arabic + '</div>';
                html += '<div class="phr2-picked static">';
                (a.picked || []).forEach(function(w) {
                    html += '<span class="phr2-word">' + w + '</span>';
                });
                html += '</div>';
                if (!isCorrect) {
                    html += '<div class="review-correct-answer"><i class="fa-solid fa-circle-check"></i> Richtig: ';
                    a.q.words.forEach(function(w) {
                        html += '<span class="phr2-word correct-word">' + w + '</span>';
                    });
                    html += '</div>';
                }
            } else if (a.type === 'phr3') {
                var arabicParts = a.q.arabic.split('\u00a6');
                html += '<div class="trans-verse-arabic phr3-verse">';
                if (arabicParts.length > 1) {
                    html += arabicParts[0];
                    if (isCorrect) {
                        html += '<span class="phr3-blank correct-blank"><span class="arabic-inline">' + a.sel + '</span></span>';
                    } else {
                        html += '<span class="phr3-blank wrong-blank"><span class="arabic-inline">' + (a.sel || '—') + '</span></span>';
                    }
                    html += arabicParts[1];
                } else {
                    html += a.q.arabic;
                }
                html += '</div>';
                html += '<div class="phr3-hint">' + a.q.hint + '</div>';
                if (!isCorrect) {
                    html += '<div class="review-correct-answer"><i class="fa-solid fa-circle-check"></i> Richtig: <span class="arabic-inline">' + a.q.options[a.q.correct] + '</span></div>';
                }
            }
            html += '</div>';
        });
        html += '<div class="exam-actions">';
        html += '<button class="check-btn" style="margin-top:0.5rem" onclick="restartExercise()"><i class="fa-solid fa-rotate-right"></i> Neue Prüfung</button>';
        if (!st.showAll) {
            html += '<button class="nav-btn" style="margin-top:0.5rem" onclick="startExamAll()"><i class="fa-solid fa-list"></i> Alle Fragen anzeigen</button>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }
    var part = st.parts[st.pi];
    html += '<div class="mc-progress">Frage ' + (st.pi + 1) + ' / ' + total + ' <span class="exam-type-badge">' + typeLabel(part.type) + '</span></div>';
    if (part.type === 'mc') {
        var q = part.q;
        html += '<div class="mc-question-text"><span class="arabic">' + q.arabic + '</span></div>';
        html += '<div class="mc-options">';
        var labels = ['A','B','C','D'];
        q.optionsDe.forEach(function(opt, oi) {
            var cls = 'mc-opt';
            if (st.sel === oi) cls += ' selected';
            html += '<button class="' + cls + '" onclick="examSelect(' + oi + ')">' + labels[oi] + ') ' + opt + '</button>';
        });
        html += '</div>';
    } else if (part.type === 'phr1') {
        var q = part.q;
        html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
        html += '<div class="trans-options">';
        q.options.forEach(function(opt, oi) {
            var cls = 'trans-opt';
            if (st.sel === oi) cls += ' selected';
            html += '<button class="' + cls + '" onclick="examSelect(' + oi + ')">' + opt + '</button>';
        });
        html += '</div>';
    } else if (part.type === 'phr2') {
        var q = part.q;
        html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
        html += '<div class="phr2-picked">';
        st.picked.forEach(function(w, i) {
            html += '<span class="phr2-word picked" onclick="examUnpick(' + i + ')">' + w + '</span>';
        });
        if (st.picked.length === 0) html += '<span class="phr2-placeholder">Wörter in richtiger Reihenfolge anklicken</span>';
        html += '</div>';
        html += '<div class="tile-bank">';
        st.bank.forEach(function(w, i) {
            html += '<button class="drag-tile" onclick="examPick(' + i + ')">' + w + '</button>';
        });
        html += '</div>';
    } else if (part.type === 'phr3') {
        var q = part.q;
        var arabicParts = q.arabic.split('\u00a6');
        html += '<div class="trans-verse-arabic phr3-verse">';
        if (arabicParts.length > 1) {
            html += arabicParts[0];
        html += '<span class="phr3-blank">' + (st.sel !== null ? '<span class="arabic-inline">' + st.sel + '</span>' : '') + '</span>';
            html += arabicParts[1];
        } else {
            html += q.arabic;
        }
        html += '</div>';
        html += '<div class="phr3-hint">' + q.hint + '</div>';
        html += '<div class="mc-options phr3-options">';
        q.options.forEach(function(opt, oi) {
            var cls = 'mc-opt';
            if (st.sel !== null && st.sel === opt) cls += ' selected';
            html += '<button class="' + cls + '" onclick="examSelectStr(\'' + escapeQuote(opt) + '\')"><span class="arabic-inline">' + opt + '</span></button>';
        });
        html += '</div>';
    }
    var canNext = false;
    if (part.type === 'phr2') canNext = st.picked.length === part.q.words.length;
    else canNext = st.sel !== null;
    html += '<button class="check-btn" onclick="examNext()" ' + (canNext ? '' : 'disabled') + '>Bestätigen <i class="fa-solid fa-arrow-right"></i></button>';
    html += '</div>';
    return html;
}

function examSelect(oi) { exState.sel = oi; renderLesson(); }
function examSelectStr(s) { exState.sel = s; renderLesson(); }
function examPick(i) {
    var st = exState;
    st.picked.push(st.bank[i]);
    st.bank.splice(i, 1);
    renderLesson();
}
function examUnpick(i) {
    var st = exState;
    var w = st.picked.splice(i, 1)[0];
    st.bank.push(w);
    renderLesson();
}

function examNext() {
    var st = exState;
    var part = st.parts[st.pi];
    var correct = false;
    st.answers = st.answers || [];
    if (part.type === 'mc') {
        correct = st.sel === part.q.correctDe;
        st.answers.push({ type: 'mc', sel: st.sel, q: part.q });
    } else if (part.type === 'phr1') {
        correct = st.sel === part.q.correct;
        st.answers.push({ type: 'phr1', sel: st.sel, q: part.q });
    } else if (part.type === 'phr2') {
        correct = st.picked.length === part.q.words.length && st.picked.every(function(w, i){ return w === part.q.words[i]; });
        st.answers.push({ type: 'phr2', picked: st.picked.slice(), q: part.q });
    } else if (part.type === 'phr3') {
        correct = st.sel === part.q.options[part.q.correct];
        st.answers.push({ type: 'phr3', sel: st.sel, q: part.q });
    }
    st.results.push(correct);
    st.pi++;
    if (st.pi < st.parts.length) {
        setupExamPart();
    }
    renderLesson();
}

function typeLabel(t) {
    if (t === 'mc') return 'Multiple Choice';
    if (t === 'phr1') return 'Übersetzung';
    if (t === 'phr2') return 'Wortreihenfolge';
    if (t === 'phr3') return 'Lücken füllen';
    return t;
}

// ============================================================
// UTILITIES
// ============================================================
function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function rangeArr(n) {
    var r = [];
    for (var i = 0; i < n; i++) r.push(i);
    return r;
}

function escapeQuote(s) {
    return String(s).replace(/'/g, "\\'");
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', renderMain);