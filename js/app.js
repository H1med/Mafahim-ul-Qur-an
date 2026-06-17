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

var EXERCISE_LABELS = [
    { short: "Multiple Choice", icon: "fa-solid fa-circle-check" },
    { short: "Zuordnung", icon: "fa-solid fa-link" },
    { short: "\u00dcbersetzung (Phrasen)", icon: "fa-solid fa-language" },
    { short: "\u00dcbersetzung (Verse)", icon: "fa-solid fa-book-open" }
];

// ============================================================
// APP STATE
// ============================================================
var app = {
    screen: "main",
    currentLesson: null,
    mode: null,
    fc: { cards: [], idx: 0, flipped: false, learned: 0, done: false },
    st: {
        step: 0,
        completed: [false, false, false, false],
        mcSel: {}, mcChecked: false,
        mSelA: null, mSelG: null, mMatched: [], mShuffled: [],
        phrasesSel: {}, phrasesChecked: false,
        versesSel: {}, versesChecked: false
    }
};

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
    resetFcState();
    resetStState();
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
    html += '<i class="fa-solid fa-list-check"></i> Aufgaben l\u00f6sen</button>';
    html += '</div>';

    if (app.mode === 'vocab') {
        html += renderFlashcards();
    } else if (app.mode === 'exercises') {
        html += renderStepper();
    } else {
        var lesson = LESSONS[app.currentLesson];
        html += '<div class="grammar-note">';
        html += '<div class="grammar-note-title"><i class="fa-solid fa-lightbulb"></i> ' + lesson.grammarNote.title + '</div>';
        html += '<p>' + lesson.grammarNote.text + '</p></div>';
        html += '<div style="text-align:center; margin-top:2rem; color:var(--text-secondary); font-size:0.88rem;">';
        html += '<i class="fa-solid fa-arrow-up" style="margin-right:0.3rem;"></i> W\u00e4hlen Sie einen Modus oben aus.</div>';
    }
    el.innerHTML = html;
    if (app.mode === 'vocab') attachFcEvents();
}

function setMode(m) {
    app.mode = m;
    if (m === 'exercises') resetStState();
    if (m === 'vocab' && app.fc.cards.length === 0) resetFcState();
    renderLesson();
}

// ============================================================
// FLASHCARDS
// ============================================================
function resetFcState() {
    var lesson = app.currentLesson ? LESSONS[app.currentLesson] : null;
    app.fc = {
        cards: lesson ? lesson.vocabulary.slice() : [],
        idx: 0,
        flipped: false,
        learned: 0,
        done: false
    };
}

function renderFlashcards() {
    var fc = app.fc;
    var total = fc.cards.length;
    if (fc.done) {
        return '<div class="fc-complete">' +
            '<i class="fa-solid fa-circle-check"></i>' +
            '<h3>Alle Vokabeln gelernt!</h3>' +
            '<p>' + total + ' von ' + total + ' Vokabeln durchgearbeitet.</p>' +
            '<button class="fc-reset-btn" onclick="resetFcAndRender()"><i class="fa-solid fa-rotate-right"></i> Nochmal \u00fcben</button>' +
            '</div>';
    }
    var card = fc.cards[fc.idx];
    var html = '';
    html += '<div class="flashcard-progress">';
    html += '<span>' + (fc.idx + 1) + ' von ' + total + ' Vokabeln</span>';
    html += '<span>' + fc.learned + ' gelernt</span></div>';
    html += '<div class="flashcard-progress-bar"><div class="flashcard-progress-fill" style="width:' + ((fc.idx + 1) / total * 100) + '%"></div></div>';
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
    html += '<button class="fc-btn btn-wrong" id="fcWrong" ' + (!fc.flipped ? 'disabled' : '') + ' onclick="fcAnswer(false)"><i class="fa-solid fa-xmark"></i> Nochmal</button>';
    html += '<button class="fc-btn btn-right" id="fcRight" ' + (!fc.flipped ? 'disabled' : '') + ' onclick="fcAnswer(true)"><i class="fa-solid fa-check"></i> Richtig</button>';
    html += '</div>';
    return html;
}

function attachFcEvents() {
    var card = document.getElementById('fcCard');
    if (card) card.addEventListener('click', flipCard);
}

function flipCard() {
    if (app.fc.flipped) return;
    app.fc.flipped = true;
    var card = document.getElementById('fcCard');
    if (card) card.classList.add('flipped');
    var wBtn = document.getElementById('fcWrong');
    var rBtn = document.getElementById('fcRight');
    if (wBtn) wBtn.disabled = false;
    if (rBtn) rBtn.disabled = false;
}

function fcAnswer(correct) {
    var fc = app.fc;
    if (!fc.flipped) return;
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
// STEPPER
// ============================================================
function resetStState() {
    app.st = {
        step: 0,
        completed: [false, false, false, false],
        mcSel: {}, mcChecked: false,
        mSelA: null, mSelG: null, mMatched: [], mShuffled: [],
        phrasesSel: {}, phrasesChecked: false,
        versesSel: {}, versesChecked: false
    };
}

function renderStepper() {
    var st = app.st;
    var lesson = LESSONS[app.currentLesson];
    var html = '';

    html += '<div class="stepper-bar">';
    for (var i = 0; i < 4; i++) {
        if (i > 0) {
            html += '<div class="stepper-line ' + (st.completed[i - 1] ? 'done' : '') + '"></div>';
        }
        var cls = st.completed[i] ? 'done' : (i === st.step ? 'active' : '');
        html += '<div class="stepper-step ' + cls + '">';
        html += '<div class="stepper-dot">' + (st.completed[i] ? '<i class="fa-solid fa-check"></i>' : (i + 1)) + '</div>';
        html += '<div class="stepper-label">' + EXERCISE_LABELS[i].short + '</div>';
        html += '</div>';
    }
    html += '</div>';

    var step = st.step;
    if (step === 0) html += renderExMC(lesson);
    else if (step === 1) html += renderExMatching(lesson);
    else if (step === 2) html += renderExTranslatePhrases(lesson);
    else if (step === 3) html += renderExTranslateVerses(lesson);

    html += '<div class="stepper-nav">';
    html += '<button class="nav-btn" ' + (step === 0 ? 'disabled' : '') + ' onclick="stNav(-1)"><i class="fa-solid fa-arrow-left"></i> Zur\u00fcck</button>';
    var canForward = st.completed[step];
    var isLast = step === 3;
    if (isLast && canForward) {
        html += '<button class="nav-btn primary" onclick="stFinish()"><i class="fa-solid fa-flag-checkered"></i> Abschlie\u00dfen</button>';
    } else {
        html += '<button class="nav-btn primary" ' + (!canForward ? 'disabled' : '') + ' onclick="stNav(1)"> Weiter <i class="fa-solid fa-arrow-right"></i></button>';
    }
    html += '</div>';
    return html;
}

function stNav(dir) {
    var newStep = app.st.step + dir;
    if (newStep < 0) return;
    if (newStep > 3) return;
    if (dir > 0 && !app.st.completed[app.st.step]) return;
    if (dir > 0) {
        if (newStep === 1) initMatching();
    }
    app.st.step = newStep;
    renderLesson();
}

function stFinish() {
    app.mode = null;
    renderLesson();
}

// ============================================================
// EXERCISE 1: MULTIPLE CHOICE
// ============================================================
function renderExMC(lesson) {
    var qs = lesson.exercises.multipleChoice;
    var st = app.st;
    var html = '<div class="exercise-title"><i class="' + EXERCISE_LABELS[0].icon + '"></i> \u00dcbung 1: Multiple Choice</div>';
    html += '<p class="exercise-intro">W\u00e4hlen Sie die richtige Antwort und klicken Sie auf "Pr\u00fcfen".</p>';
    html += '<div class="exercise-content">';
    qs.forEach(function(q, i) {
        var labels = ['A', 'B'];
        var sel = st.mcSel[i];
        var checked = st.mcChecked;
        html += '<div class="mc-question">';
        html += '<div class="mc-question-text"><span class="arabic">' + q.question + '</span></div>';
        html += '<div class="mc-options">';
        q.options.forEach(function(opt, oi) {
            var cls = 'mc-opt';
            if (checked) {
                if (oi === q.correct) cls += ' correct';
                else if (sel === oi) cls += ' incorrect';
            } else if (sel === oi) {
                cls += ' selected';
            }
            html += '<button class="' + cls + '" ' + (checked ? 'disabled' : '') + ' onclick="mcSelect(' + i + ',' + oi + ')">' + labels[oi] + ') ' + opt + '</button>';
        });
        html += '</div>';
        if (checked) {
            if (sel === q.correct) {
                html += '<div class="mc-fb" style="color:var(--success)">Richtig!</div>';
            } else if (sel === undefined) {
                html += '<div class="mc-fb" style="color:var(--error)">Nicht beantwortet.</div>';
            } else {
                html += '<div class="mc-fb" style="color:var(--error)">Falsch. Richtig: ' + q.options[q.correct] + '</div>';
            }
        }
        html += '</div>';
    });
    if (!st.mcChecked) {
        html += '<button class="check-btn" onclick="mcCheck()"><i class="fa-solid fa-check"></i> Pr\u00fcfen</button>';
    } else {
        var correct = qs.filter(function(q, i) { return st.mcSel[i] === q.correct; }).length;
        html += '<div class="mc-score show">Ergebnis: ' + correct + ' von ' + qs.length + ' richtig</div>';
        if (correct === qs.length) {
            html += '<button class="check-btn" style="margin-top:0.5rem" onclick="mcRetry()"><i class="fa-solid fa-rotate-right"></i> Nochmal</button>';
        } else {
            html += '<button class="check-btn" style="margin-top:0.5rem" onclick="mcRetry()"><i class="fa-solid fa-rotate-right"></i> Nochmal versuchen</button>';
        }
    }
    html += '</div>';
    return html;
}

function mcSelect(q, o) {
    if (app.st.mcChecked) return;
    app.st.mcSel[q] = o;
    renderLesson();
}

function mcCheck() {
    var st = app.st;
    var lesson = LESSONS[app.currentLesson];
    var qs = lesson.exercises.multipleChoice;
    var correct = qs.filter(function(q, i) { return st.mcSel[i] === q.correct; }).length;
    st.mcChecked = true;
    if (correct >= qs.length - 1) st.completed[0] = true;
    renderLesson();
}

function mcRetry() {
    app.st.mcSel = {};
    app.st.mcChecked = false;
    app.st.completed[0] = false;
    renderLesson();
}

// ============================================================
// EXERCISE 2: MATCHING
// ============================================================
function initMatching() {
    var m = LESSONS[app.currentLesson].exercises.matching;
    var shuffled = m.german.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    app.st.mShuffled = shuffled;
    app.st.mMatched = [];
    app.st.mSelA = null;
    app.st.mSelG = null;
}

function renderExMatching(lesson) {
    var m = lesson.exercises.matching;
    var st = app.st;
    if (st.mShuffled.length === 0) initMatching();

    var html = '<div class="exercise-title"><i class="' + EXERCISE_LABELS[1].icon + '"></i> \u00dcbung 2: Zuordnung</div>';
    html += '<p class="exercise-intro">Klicken Sie auf ein arabisches Wort und dann auf die passende \u00dcbersetzung.</p>';
    html += '<div class="exercise-content">';
    html += '<div class="match-cols">';
    html += '<div class="match-col"><h4>Arabisch</h4><div class="match-items">';
    m.arabic.forEach(function(w, i) {
        var matchedA = st.mMatched.find(function(x) { return x.a === i; });
        var cls = 'match-item';
        if (matchedA) cls += ' matched';
        else if (st.mSelA === i) cls += ' active';
        html += '<div class="' + cls + '" ' + (matchedA ? '' : 'onclick="matchSelect(\'a\',' + i + ')"') + '><span class="arabic-inline">' + w + '</span></div>';
    });
    html += '</div></div>';
    html += '<div class="match-col"><h4>Deutsch</h4><div class="match-items">';
    st.mShuffled.forEach(function(w, i) {
        var matchedG = st.mMatched.find(function(x) { return x.g === i; });
        var cls = 'match-item';
        if (matchedG) cls += ' matched';
        else if (st.mSelG === i) cls += ' active';
        html += '<div class="' + cls + '" ' + (matchedG ? '' : 'onclick="matchSelect(\'g\',' + i + ')"') + '>' + w + '</div>';
    });
    html += '</div></div></div>';
    var matchedCount = st.mMatched.length;
    var totalPairs = m.arabic.length;
    html += '<div class="match-status" id="matchStatus">';
    if (matchedCount === totalPairs) {
        html += '<span style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Alle Paare korrekt zugeordnet!</span>';
    } else if (matchedCount > 0) {
        html += '<span style="color:var(--success)">' + matchedCount + '/' + totalPairs + ' korrekt</span>';
    }
    html += '</div></div>';
    return html;
}

function matchSelect(side, idx) {
    var st = app.st;
    var lesson = LESSONS[app.currentLesson];
    var totalPairs = lesson.exercises.matching.arabic.length;
    if (st.mMatched.length >= totalPairs) return;
    if (side === 'a') {
        if (st.mMatched.find(function(x) { return x.a === idx; })) return;
        st.mSelA = idx;
    } else {
        if (st.mMatched.find(function(x) { return x.g === idx; })) return;
        st.mSelG = idx;
    }
    if (st.mSelA !== null && st.mSelG !== null) {
        var correctG = lesson.exercises.matching.german[st.mSelA];
        var pickedG = st.mShuffled[st.mSelG];
        if (correctG === pickedG) {
            st.mMatched.push({ a: st.mSelA, g: st.mSelG });
            if (st.mMatched.length >= totalPairs - 1) st.completed[1] = true;
        } else {
            renderLesson();
            var selA = st.mSelA, selG = st.mSelG;
            setTimeout(function() {
                var aItems = document.querySelectorAll('.match-col:first-child .match-item');
                var gItems = document.querySelectorAll('.match-col:last-child .match-item');
                var aEl = aItems[selA];
                var gEl = gItems[selG];
                if (aEl) aEl.classList.add('wrong');
                if (gEl) gEl.classList.add('wrong');
                setTimeout(function() {
                    st.mSelA = null;
                    st.mSelG = null;
                    renderLesson();
                }, 600);
            }, 10);
            return;
        }
        st.mSelA = null;
        st.mSelG = null;
    }
    renderLesson();
}

// ============================================================
// EXERCISE 3: TRANSLATE PHRASES (MC)
// ============================================================
function renderExTranslatePhrases(lesson) {
    var qs = lesson.exercises.translatePhrases;
    var st = app.st;
    var html = '<div class="exercise-title"><i class="' + EXERCISE_LABELS[2].icon + '"></i> \u00dcbung 3: \u00dcbersetzung (Phrasen)</div>';
    html += '<p class="exercise-intro">W\u00e4hlen Sie die korrekte deutsche \u00dcbersetzung f\u00fcr jede Phrase.</p>';
    html += '<div class="exercise-content">';
    qs.forEach(function(q, qi) {
        html += '<div class="trans-verse-block">';
        html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
        html += '<div class="trans-options">';
        q.options.forEach(function(opt, oi) {
            var cls = 'trans-opt';
            if (st.phrasesChecked) {
                if (oi === q.correct) cls += ' correct';
                else if (st.phrasesSel[qi] === oi) cls += ' incorrect';
            } else if (st.phrasesSel[qi] === oi) {
                cls += ' selected';
            }
            html += '<button class="' + cls + '" ' + (st.phrasesChecked ? 'disabled' : '') + ' onclick="phrasesSelect(' + qi + ',' + oi + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });
    if (!st.phrasesChecked) {
        html += '<button class="check-btn" onclick="phrasesCheck()"><i class="fa-solid fa-check"></i> Pr\u00fcfen</button>';
    } else {
        var correct = qs.filter(function(q, i) { return st.phrasesSel[i] === q.correct; }).length;
        if (correct === qs.length) {
            html += '<div class="mc-score show" style="margin-top:0.75rem">Alle \u00dcbersetzungen korrekt!</div>';
        } else {
            html += '<div class="mc-score show" style="margin-top:0.75rem">' + correct + ' von ' + qs.length + ' richtig</div>';
            html += '<button class="check-btn" style="margin-top:0.5rem" onclick="phrasesRetry()"><i class="fa-solid fa-rotate-right"></i> Nochmal versuchen</button>';
        }
    }
    html += '</div>';
    return html;
}

function phrasesSelect(qi, oi) {
    if (app.st.phrasesChecked) return;
    app.st.phrasesSel[qi] = oi;
    renderLesson();
}

function phrasesCheck() {
    var st = app.st;
    var qs = LESSONS[app.currentLesson].exercises.translatePhrases;
    var correct = qs.filter(function(q, i) { return st.phrasesSel[i] === q.correct; }).length;
    st.phrasesChecked = true;
    if (correct >= qs.length - 1) st.completed[2] = true;
    renderLesson();
}

function phrasesRetry() {
    app.st.phrasesSel = {};
    app.st.phrasesChecked = false;
    app.st.completed[2] = false;
    renderLesson();
}

// ============================================================
// EXERCISE 4: TRANSLATE VERSES (MC)
// ============================================================
function renderExTranslateVerses(lesson) {
    var qs = lesson.exercises.translateVerses;
    var st = app.st;
    var html = '<div class="exercise-title"><i class="' + EXERCISE_LABELS[3].icon + '"></i> \u00dcbung 4: \u00dcbersetzung (Verse)</div>';
    html += '<p class="exercise-intro">W\u00e4hlen Sie die korrekte deutsche \u00dcbersetzung f\u00fcr jeden Vers.</p>';
    html += '<div class="exercise-content">';
    qs.forEach(function(q, qi) {
        html += '<div class="trans-verse-block">';
        html += '<div class="trans-verse-arabic">' + q.arabic + '</div>';
        html += '<div class="trans-options">';
        q.options.forEach(function(opt, oi) {
            var cls = 'trans-opt';
            if (st.versesChecked) {
                if (oi === q.correct) cls += ' correct';
                else if (st.versesSel[qi] === oi) cls += ' incorrect';
            } else if (st.versesSel[qi] === oi) {
                cls += ' selected';
            }
            html += '<button class="' + cls + '" ' + (st.versesChecked ? 'disabled' : '') + ' onclick="versesSelect(' + qi + ',' + oi + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });
    if (!st.versesChecked) {
        html += '<button class="check-btn" onclick="versesCheck()"><i class="fa-solid fa-check"></i> Pr\u00fcfen</button>';
    } else {
        var correct = qs.filter(function(q, i) { return st.versesSel[i] === q.correct; }).length;
        if (correct === qs.length) {
            html += '<div class="mc-score show" style="margin-top:0.75rem">Alle \u00dcbersetzungen korrekt!</div>';
        } else {
            html += '<div class="mc-score show" style="margin-top:0.75rem">' + correct + ' von ' + qs.length + ' richtig</div>';
            html += '<button class="check-btn" style="margin-top:0.5rem" onclick="versesRetry()"><i class="fa-solid fa-rotate-right"></i> Nochmal versuchen</button>';
        }
    }
    html += '</div>';
    return html;
}

function versesSelect(qi, oi) {
    if (app.st.versesChecked) return;
    app.st.versesSel[qi] = oi;
    renderLesson();
}

function versesCheck() {
    var st = app.st;
    var qs = LESSONS[app.currentLesson].exercises.translateVerses;
    var correct = qs.filter(function(q, i) { return st.versesSel[i] === q.correct; }).length;
    st.versesChecked = true;
    if (correct >= qs.length - 1) st.completed[3] = true;
    renderLesson();
}

function versesRetry() {
    app.st.versesSel = {};
    app.st.versesChecked = false;
    app.st.completed[3] = false;
    renderLesson();
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', renderMain);
