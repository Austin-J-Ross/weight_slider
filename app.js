'use strict';

// ── Food data ─────────────────────────────────────────────────────────────────
// gPerCup: grams per US cup (≈240 ml) for each category
const FOODS = [
  // Rough defaults for "quick add" calorie tracking.
  // calPerG = kcal per gram
  // gPerCup = approximate grams per 1 cup / slider volume unit

  { name: 'Meat',        calPerG: 2.2,  gPerCup: 140 }, // cooked mixed meat; chicken lower, beef higher
  { name: 'Fish',        calPerG: 1.5,  gPerCup: 140 }, // cooked fish, flaked/chunked
  { name: 'Bread',       calPerG: 2.65, gPerCup: 40  }, // 1 cup cubed bread, not compressed
  { name: 'Rice/Pasta',  calPerG: 1.45, gPerCup: 170 }, // cooked rice/pasta average
  { name: 'Dairy',       calPerG: 0.9,  gPerCup: 245 }, // milk/yogurt-ish; cheese is much higher
  { name: 'Vegetables',  calPerG: 0.35, gPerCup: 130 }, // non-starchy cooked/raw average
  { name: 'Fruit',       calPerG: 0.6,  gPerCup: 150 },
  { name: 'Fats/Oils',   calPerG: 8.85, gPerCup: 218 }, // pure oils are ~8.8–9 kcal/g
  { name: 'Chips',       calPerG: 5.3,  gPerCup: 28  }, // potato chips ~150 kcal/28g
  { name: 'Sweets',      calPerG: 4.3,  gPerCup: 100 }, // cookies/cake/candy vary wildly
  { name: 'Sandwiches',  calPerG: 2.5,  gPerCup: 140 }, // okay as rough composite
];

const WORKOUTS = [
  { name: 'Running',  met: 9.8 },
  { name: 'Cycling',  met: 7.5 },
  { name: 'HIIT',     met: 8.0 },
  { name: 'Swimming', met: 5.8 },
  { name: 'Weights',  met: 3.5 },
  { name: 'Walking',  met: 4.3 },
  { name: 'Yoga',     met: 2.5 },
];

function caloriesBurnedPerMinute(met, weightLb) {
  const weightKg = weightLb * 0.45359237;
  return (met * 3.5 * weightKg) / 200;
}


const ROW_H   = 52;
const PICKER_H = 260;
const PAD     = 2;

// ── State ─────────────────────────────────────────────────────────────────────
let foodIndex    = 0;
let workoutIndex = 0;
let foodLog      = [];   // [{ id, type:'food',    name, grams, calories }]
let workoutLog   = [];   // [{ id, type:'workout', name, duration, calories }]
let weightLog    = [];   // [{ id, type:'weight',  value }]
let goal         = null;
let startWeight  = null; // lb — set in drawer, used as slider centre before first log
let pendingDeleteId   = null;
let pendingDeleteType = null; // 'food' | 'workout' | 'weight'
let viewDate          = null; // set after TODAY is defined

// ── Storage ───────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
viewDate = TODAY;

function loadStorage() {
  try {
    goal        = JSON.parse(localStorage.getItem('calTracker_goal')        || 'null');
    startWeight = JSON.parse(localStorage.getItem('calTracker_startWeight') || 'null');
  } catch (_) {}
  loadDayData(TODAY);
}

function loadDayData(date) {
  if (date === TODAY) {
    try {
      const saved = JSON.parse(localStorage.getItem('calTracker_log') || 'null');
      if (saved && saved.date === TODAY) {
        foodLog    = saved.food    || [];
        workoutLog = saved.workout || [];
        weightLog  = saved.weight  || [];
      } else {
        foodLog = []; workoutLog = []; weightLog = [];
      }
    } catch (_) { foodLog = workoutLog = weightLog = []; }
  } else {
    const hist  = loadHistory();
    const entry = hist.find(h => h.date === date);
    if (entry && entry.entries) {
      foodLog    = entry.entries.filter(e => (e._type || e.type) === 'food');
      workoutLog = entry.entries.filter(e => (e._type || e.type) === 'workout');
      weightLog  = entry.entries.filter(e => (e._type || e.type) === 'weight');
    } else {
      foodLog = []; workoutLog = []; weightLog = [];
    }
  }
}

function saveLog() {
  if (viewDate === TODAY) {
    localStorage.setItem('calTracker_log', JSON.stringify({
      date: TODAY, food: foodLog, workout: workoutLog, weight: weightLog,
    }));
    saveHistory();
    writeToFile();
  } else {
    let hist = loadHistory();
    const entry = {
      date:     viewDate,
      calories: foodLog.reduce((s, i) => s + i.calories, 0),
      workout:  workoutLog.reduce((s, i) => s + i.calories, 0),
      weight:   weightLog.length ? weightLog[weightLog.length - 1].value : null,
      entries: [
        ...foodLog.map(i    => ({ ...i, _type: 'food'    })),
        ...workoutLog.map(i => ({ ...i, _type: 'workout' })),
        ...weightLog.map(i  => ({ ...i, _type: 'weight'  })),
      ],
    };
    const idx = hist.findIndex(h => h.date === viewDate);
    if (idx >= 0) hist[idx] = entry; else hist.push(entry);
    hist.sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 365) hist = hist.slice(-365);
    localStorage.setItem('calTracker_history', JSON.stringify(hist));
  }
}

// ── History (daily rolling record, 90 days) ───────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('calTracker_history') || '[]'); }
  catch (_) { return []; }
}

function saveHistory() {
  let hist = loadHistory();
  const entry = {
    date:     TODAY,
    calories: foodLog.reduce((s, i) => s + i.calories, 0),
    workout:  workoutLog.reduce((s, i) => s + i.calories, 0),
    weight:   weightLog.length ? weightLog[weightLog.length - 1].value : null,
    entries: [
      ...foodLog.map(i    => ({ ...i, _type: 'food'    })),
      ...workoutLog.map(i => ({ ...i, _type: 'workout' })),
      ...weightLog.map(i  => ({ ...i, _type: 'weight'  })),
    ],
  };
  const idx = hist.findIndex(h => h.date === TODAY);
  if (idx >= 0) hist[idx] = entry; else hist.push(entry);
  hist.sort((a, b) => a.date.localeCompare(b.date));
  if (hist.length > 365) hist = hist.slice(-365);
  localStorage.setItem('calTracker_history', JSON.stringify(hist));
}

function saveGoal() {
  localStorage.setItem('calTracker_goal', JSON.stringify(goal));
  writeToFile();
}

function saveStartWeight() {
  localStorage.setItem('calTracker_startWeight', JSON.stringify(startWeight));
  writeToFile();
}

// Last logged weight persists across days (separate key)
function getLastWeight() {
  try { return JSON.parse(localStorage.getItem('calTracker_lastWeight') || 'null'); }
  catch (_) { return null; }
}
function saveLastWeight(val) {
  localStorage.setItem('calTracker_lastWeight', JSON.stringify(val));
}

// Centre of the weight slider: last log → startWeight setting → 150 lb default
function weightBase() {
  return getLastWeight() ?? startWeight ?? 150.0;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Header / progress
const headerDate      = $('headerDate');
const totalCalEl      = $('totalCal');
const progressFill    = $('progressFill');
const progressSub     = $('progressSub');
const progressGoalLbl = $('progressGoalLabel');

// Log
const logList    = $('logList');
const emptyState = $('emptyState');

// Drawer
const menuBtn        = $('menuBtn');
const drawer         = $('drawer');
const drawerBackdrop = $('drawerBackdrop');
const drawerClose    = $('drawerClose');
const goalInput           = $('goalInput');
const goalSaveBtn         = $('goalSaveBtn');
const goalHint            = $('goalHint');
const startWeightInput    = $('startWeightInput');
const startWeightSaveBtn  = $('startWeightSaveBtn');
const startWeightHint     = $('startWeightHint');

// FAB radial
const fab        = $('fab');
const fabGroup   = $('fabGroup');
const fabOverlay = $('fabOverlay');

// Food sheet
const sheetBackdrop = $('sheetBackdrop');
const sheet         = $('sheet');
const pickerList    = $('pickerList');
const weightSlider  = $('weightSlider');
const sliderPreview = $('sliderPreview');
const sliderLbs     = $('sliderLbs');
const sliderCalPrev = $('sliderCalPreview');
const sheetAddBtn   = $('sheetAddBtn');

// Workout sheet
const workoutBackdrop    = $('workoutBackdrop');
const workoutSheet       = $('workoutSheet');
const workoutPickerList  = $('workoutPickerList');
const durationSlider     = $('durationSlider');
const durationPreview    = $('durationPreview');
const workoutCalPreview  = $('workoutCalPreview');
const workoutAddBtn      = $('workoutAddBtn');

// Body weight sheet
const weightBackdrop    = $('weightBackdrop');
const weightSheet       = $('weightSheet');
const weightRangeSlider = $('weightRangeSlider');
const wtValue           = $('wtValue');
const wtDelta           = $('wtDelta');
const wtMinLabel        = $('wtMinLabel');
const wtMaxLabel        = $('wtMaxLabel');
const weightSaveBtn     = $('weightSaveBtn');

// Delete sheet
const deleteBackdrop  = $('deleteBackdrop');
const deleteSheet     = $('deleteSheet');
const deleteItemPrev  = $('deleteItemPreview');
const slideTrack      = $('slideDeleteTrack');
const slideFill       = $('slideDeleteFill');
const slideLabel      = $('slideDeleteLabel');
const slideThumb      = $('slideDeleteThumb');
const deleteCancelBtn = $('deleteCancelBtn');

// ── Header date & date navigation ────────────────────────────────────────────
function updateHeaderDate() {
  const d = new Date(viewDate + 'T12:00:00');
  headerDate.textContent = d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const banner = $('pastDateBanner');
  if (viewDate === TODAY) {
    banner.hidden = true;
  } else {
    banner.hidden = false;
    $('pastDateLabel').textContent = d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }
}

function setViewDate(date) {
  viewDate = date;
  loadDayData(date);
  updateHeaderDate();
  renderLog();
  updateTotals();
}

updateHeaderDate();

// ── Drawer ────────────────────────────────────────────────────────────────────
function openDrawer() {
  drawer.classList.add('open');
  drawerBackdrop.classList.add('visible');
  goalInput.value = goal || '';
  goalHint.textContent = goal ? `Current: ${goal.toLocaleString()} kcal` : '';
  startWeightInput.value = startWeight || '';
  const lw = getLastWeight();
  startWeightHint.textContent = lw
    ? `Last logged: ${lw.toFixed(1)} lb — slider centres on this`
    : (startWeight ? `Slider centres on ${startWeight.toFixed(1)} lb` : 'Used as slider centre until first weight log');
}
function closeDrawer() {
  drawer.classList.remove('open');
  drawerBackdrop.classList.remove('visible');
}

menuBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);

goalSaveBtn.addEventListener('click', () => {
  const val = parseInt(goalInput.value);
  if (val > 0) {
    goal = val;
    saveGoal();
    goalHint.textContent = `Saved! ${goal.toLocaleString()} kcal`;
    updateTotals();
  } else {
    goalHint.textContent = 'Enter a number greater than 0.';
  }
});
goalInput.addEventListener('keydown', e => { if (e.key === 'Enter') goalSaveBtn.click(); });

startWeightSaveBtn.addEventListener('click', () => {
  const val = parseFloat(startWeightInput.value);
  if (val >= 50 && val <= 700) {
    startWeight = Math.round(val * 10) / 10;
    saveStartWeight();
    startWeightHint.textContent = `Saved! Slider will centre on ${startWeight.toFixed(1)} lb`;
  } else {
    startWeightHint.textContent = 'Enter a weight between 50 and 700 lb.';
  }
});
startWeightInput.addEventListener('keydown', e => { if (e.key === 'Enter') startWeightSaveBtn.click(); });

// ── FAB free-drag to select ───────────────────────────────────────────────────
/*
  Press + and drag freely in any direction.
  Stop offsets from FAB center (screen dx, dy where −y = up):
    calories → (−100,    0)   left
    workout  → ( −71,  −71)   upper-left
    weight   → (   0, −100)   up
  FAB follows the finger (clamped to MAX_RADIUS).
  A stop activates when the FAB is within ACTIVATE px of its center.
*/
const FAB_STOPS_POS = [
  { action: 'calories', dx: -100, dy:   0 },
  { action: 'workout',  dx:  -71, dy: -71 },
  { action: 'weight',   dx:    0, dy: -100 },
];
const MAX_RADIUS = 115;
const ACTIVATE   = 38;

let fabOpen         = false;
let fabDragging     = false;
let fabDragStartX   = 0;
let fabDragStartY   = 0;
let fabActiveAction = null;

const fabStops = Array.from(document.querySelectorAll('.fab-stop'));

function openFabMenu() {
  if (fabOpen) return;
  fabOpen = true;
  fabGroup.classList.add('open');
  fabOverlay.classList.add('visible');
  fab.setAttribute('aria-expanded', 'true');
}

function closeFabMenu() {
  if (!fabOpen) return;
  fabOpen         = false;
  fabDragging     = false;
  fabActiveAction = null;
  fabGroup.classList.remove('open');
  fabOverlay.classList.remove('visible');
  fab.setAttribute('aria-expanded', 'false');
  fabStops.forEach(s => s.classList.remove('active'));
  fab.classList.remove('dragging');
  fab.style.transform = '';
}

function updateFreeDrag(fingerDx, fingerDy) {
  // Clamp FAB movement to MAX_RADIUS
  const dist  = Math.hypot(fingerDx, fingerDy);
  const scale = dist > MAX_RADIUS ? MAX_RADIUS / dist : 1;
  const fabDx = fingerDx * scale;
  const fabDy = fingerDy * scale;

  fab.style.transform = `translate(${fabDx}px,${fabDy}px)`;

  // Highlight nearest stop within ACTIVATE radius
  let active = null, best = ACTIVATE;
  FAB_STOPS_POS.forEach(s => {
    const d = Math.hypot(fabDx - s.dx, fabDy - s.dy);
    if (d < best) { best = d; active = s.action; }
  });

  fabActiveAction = active;
  fabStops.forEach(s => s.classList.toggle('active', s.dataset.action === active));
}

// ── Pointer events ────────────────────────────────────────────────────────────
fab.addEventListener('pointerdown', e => {
  e.preventDefault();
  fab.setPointerCapture(e.pointerId);
  fabDragStartX   = e.clientX;
  fabDragStartY   = e.clientY;
  fabDragging     = false;
  fabActiveAction = null;
  openFabMenu();
});

fab.addEventListener('pointermove', e => {
  if (!fabOpen) return;
  const dx = e.clientX - fabDragStartX;
  const dy = e.clientY - fabDragStartY;
  if (!fabDragging && Math.hypot(dx, dy) > 6) {
    fabDragging = true;
    fab.classList.add('dragging');
  }
  if (fabDragging) updateFreeDrag(dx, dy);
});

fab.addEventListener('pointerup', () => {
  if (!fabOpen) return;
  if (fabDragging) {
    const action = fabActiveAction;
    closeFabMenu();
    if (action) setTimeout(() => triggerFabAction(action), 80);
  }
  fab.classList.remove('dragging');
});

// Tap-on-stop (non-drag)
fabStops.forEach(stop => {
  stop.addEventListener('click', () => {
    const action = stop.dataset.action;
    closeFabMenu();
    setTimeout(() => triggerFabAction(action), 80);
  });
});

fabOverlay.addEventListener('click', closeFabMenu);

function triggerFabAction(action) {
  if (action === 'calories') openFoodSheet();
  if (action === 'workout')  openWorkoutSheet();
  if (action === 'weight')   openWeightSheet();
}

// ── Food sheet ────────────────────────────────────────────────────────────────
function openFoodSheet() {
  sheet.classList.add('open');
  sheetBackdrop.classList.add('visible');
  updateFoodSlider();
}
function closeFoodSheet() {
  sheet.classList.remove('open');
  sheetBackdrop.classList.remove('visible');
}

sheetBackdrop.addEventListener('click', closeFoodSheet);

function updateFoodSlider() {
  const g   = parseInt(weightSlider.value);
  const cal = Math.round(g * FOODS[foodIndex].calPerG);
  const lb  = (g * 0.00220462).toFixed(2);
  sliderPreview.textContent = `${g} g`;
  sliderLbs.textContent     = `${lb} lb`;
  sliderCalPrev.textContent = `${cal} kcal`;
  const pct = (g / 1000) * 100;
  weightSlider.style.background =
    `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`;
  renderPlate(g);
}

weightSlider.addEventListener('input', updateFoodSlider);

sheetAddBtn.addEventListener('click', () => {
  const g = parseInt(weightSlider.value);
  if (g === 0) { sliderPreview.textContent = 'Move slider!'; setTimeout(updateFoodSlider, 900); return; }
  const food = FOODS[foodIndex];
  const _ft = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  foodLog.push({ id: Date.now(), type: 'food', name: food.name, grams: g, calories: Math.round(g * food.calPerG), time: _ft });
  saveLog();
  renderLog();
  updateTotals();
  closeFoodSheet();
});

// ── Workout sheet ─────────────────────────────────────────────────────────────
function openWorkoutSheet() {
  workoutSheet.classList.add('open');
  workoutBackdrop.classList.add('visible');
  updateWorkoutSlider();
}
function closeWorkoutSheet() {
  workoutSheet.classList.remove('open');
  workoutBackdrop.classList.remove('visible');
}

workoutBackdrop.addEventListener('click', closeWorkoutSheet);

function updateWorkoutSlider() {
  const mins = parseInt(durationSlider.value);
  const cal  = Math.round(mins * caloriesBurnedPerMinute(WORKOUTS[workoutIndex].met, weightBase()));
  durationPreview.textContent  = `${mins} min`;
  workoutCalPreview.textContent = `≈ ${cal} kcal burned`;
  const pct = (mins / 120) * 100;
  durationSlider.style.background =
    `linear-gradient(to right, var(--green) ${pct}%, var(--border) ${pct}%)`;
}

durationSlider.addEventListener('input', updateWorkoutSlider);

workoutAddBtn.addEventListener('click', () => {
  const mins = parseInt(durationSlider.value);
  if (mins === 0) { durationPreview.textContent = 'Set duration!'; setTimeout(updateWorkoutSlider, 900); return; }
  const w = WORKOUTS[workoutIndex];
  const _wt = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  workoutLog.push({ id: Date.now(), type: 'workout', name: w.name, duration: mins, calories: Math.round(mins * caloriesBurnedPerMinute(w.met, weightBase())), time: _wt });
  saveLog();
  renderLog();
  updateTotals();
  closeWorkoutSheet();
});

// ── Body weight sheet ─────────────────────────────────────────────────────────
let _wtBase = 150.0; // reference for the current sheet session

function updateWtSlider() {
  const val   = Math.round(parseFloat(weightRangeSlider.value) * 10) / 10;
  const delta = Math.round((val - _wtBase) * 10) / 10;
  wtValue.textContent = val.toFixed(1);

  if (delta === 0) {
    wtDelta.textContent   = 'no change';
    wtDelta.className     = 'wt-delta neutral';
  } else if (delta > 0) {
    wtDelta.textContent   = `+${delta.toFixed(1)} lb`;
    wtDelta.className     = 'wt-delta gain';
  } else {
    wtDelta.textContent   = `${delta.toFixed(1)} lb`;
    wtDelta.className     = 'wt-delta loss';
  }

  // Blue fill left-to-thumb
  const min = parseFloat(weightRangeSlider.min);
  const max = parseFloat(weightRangeSlider.max);
  const pct = ((val - min) / (max - min)) * 100;
  weightRangeSlider.style.background =
    `linear-gradient(to right, var(--blue) ${pct}%, var(--border) ${pct}%)`;
}

function openWeightSheet() {
  _wtBase = weightBase();
  const min = Math.round((_wtBase - 5) * 10) / 10;
  const max = Math.round((_wtBase + 5) * 10) / 10;

  weightRangeSlider.min   = min;
  weightRangeSlider.max   = max;
  weightRangeSlider.step  = '0.2';
  weightRangeSlider.value = _wtBase;

  wtMinLabel.textContent = `${min.toFixed(1)} lb`;
  wtMaxLabel.textContent = `${max.toFixed(1)} lb`;

  updateWtSlider();
  weightSheet.classList.add('open');
  weightBackdrop.classList.add('visible');
}

function closeWeightSheet() {
  weightSheet.classList.remove('open');
  weightBackdrop.classList.remove('visible');
}

weightBackdrop.addEventListener('click', closeWeightSheet);
weightRangeSlider.addEventListener('input', updateWtSlider);

weightSaveBtn.addEventListener('click', () => {
  const val  = Math.round(parseFloat(weightRangeSlider.value) * 10) / 10;
  const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  weightLog.push({ id: Date.now(), type: 'weight', value: val, time });
  if (viewDate === TODAY) saveLastWeight(val);
  saveLog();
  renderLog();
  closeWeightSheet();
});

// ── Picker builder (generic) ──────────────────────────────────────────────────
function buildPicker(listEl, items, getIndex, setIndex, onChange) {
  for (let i = 0; i < PAD; i++) listEl.insertAdjacentHTML('beforeend', `<li aria-hidden="true"></li>`);
  items.forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = f.name;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    li.dataset.index = i;
    listEl.appendChild(li);
  });
  for (let i = 0; i < PAD; i++) listEl.insertAdjacentHTML('beforeend', `<li aria-hidden="true"></li>`);

  function getOffset() {
    return new DOMMatrix(getComputedStyle(listEl).transform).m42;
  }
  function indexToOffset(idx) {
    return (PICKER_H / 2 - ROW_H / 2) - (idx + PAD) * ROW_H;
  }
  function offsetToIndex(off) {
    return Math.round(((PICKER_H / 2 - ROW_H / 2) - off) / ROW_H) - PAD;
  }
  function snapTo(idx, animate = true) {
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    setIndex(clamped);
    listEl.style.transition = animate ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
    listEl.style.transform  = `translateY(${indexToOffset(clamped)}px)`;
    listEl.querySelectorAll('li[data-index]').forEach(li => {
      const on = parseInt(li.dataset.index) === clamped;
      li.classList.toggle('selected', on);
      li.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    onChange();
  }

  // Drag
  let startY = 0, startOff = 0;
  const onStart = e => {
    startY   = e.touches ? e.touches[0].clientY : e.clientY;
    startOff = getOffset();
    listEl.style.transition = 'none';
    const onMove = ev => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      listEl.style.transform = `translateY(${startOff + y - startY}px)`;
    };
    const onEnd = () => {
      snapTo(offsetToIndex(getOffset()), true);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
  };

  listEl.addEventListener('touchstart', onStart, { passive: true });
  listEl.addEventListener('mousedown', onStart);
  listEl.addEventListener('click', e => {
    const li = e.target.closest('li[data-index]');
    if (li) snapTo(parseInt(li.dataset.index), true);
  });

  snapTo(0, false);
}

// ── Log rendering ─────────────────────────────────────────────────────────────
function renderLog() {
  logList.innerHTML = '';
  const all = [
    ...foodLog.map(i => ({ ...i, _type: 'food' })),
    ...workoutLog.map(i => ({ ...i, _type: 'workout' })),
    ...weightLog.map(i => ({ ...i, _type: 'weight' })),
  ].sort((a, b) => b.id - a.id);

  emptyState.style.display = all.length === 0 ? '' : 'none';

  all.forEach(item => {
    const li = document.createElement('li');
    li.className = 'log-item';

    let dotClass = '', calStr = '', detail = '';
    if (item._type === 'food') {
      dotClass = ''; calStr = `${item.calories} kcal`; detail = `${item.grams} g${item.time ? ' · ' + item.time : ''}`;
    } else if (item._type === 'workout') {
      dotClass = 'workout'; calStr = `−${item.calories} kcal`; detail = `${item.duration} min${item.time ? ' · ' + item.time : ''}`;
    } else {
      dotClass = 'weight'; calStr = `${item.value.toFixed(1)} lb`; detail = `Body weight${item.time ? ' · ' + item.time : ''}`;
    }

    li.innerHTML = `
      <div class="log-item-dot ${dotClass}"></div>
      <div class="log-item-info">
        <span class="log-item-name">${esc(item.name || 'Weight')}</span>
        <span class="log-item-detail">${esc(detail)}</span>
      </div>
      <span class="log-item-cal${item._type === 'workout' ? ' burned' : item._type === 'weight' ? ' neutral' : ''}">${esc(calStr)}</span>
      <button class="log-item-delete" aria-label="Delete item">&#x2715;</button>
    `;
    li.querySelector('.log-item-delete').addEventListener('click', () =>
      openDeleteSheet(item.id, item._type)
    );
    logList.appendChild(li);
  });
}

// ── Totals & progress bar ─────────────────────────────────────────────────────
function updateTotals() {
  const eaten  = foodLog.reduce((s, i) => s + i.calories, 0);
  const burned = workoutLog.reduce((s, i) => s + i.calories, 0);
  const net    = eaten - burned;

  totalCalEl.textContent = net.toLocaleString();

  if (goal) {
    const pct     = (net / goal) * 100;
    const clamped = Math.min(pct, 100);
    const over    = pct > 100;

    progressFill.style.width = `${Math.max(0, clamped)}%`;
    progressFill.classList.toggle('over', over);
    progressGoalLbl.textContent = `/ ${goal.toLocaleString()} kcal`;

    if (over) {
      progressSub.textContent = `${(net - goal).toLocaleString()} kcal over goal`;
    } else if (net <= 0) {
      progressSub.textContent = burned > 0 ? `${burned.toLocaleString()} kcal burned` : 'Open menu to set a goal';
    } else {
      const remaining = goal - net;
      progressSub.textContent = `${remaining.toLocaleString()} kcal remaining`;
      if (burned > 0) progressSub.textContent += ` (${burned} burned)`;
    }
  } else {
    progressFill.style.width = '0%';
    progressGoalLbl.textContent = '';
    progressSub.textContent = 'Open menu to set a calorie goal';
  }
}

// ── Delete confirmation ───────────────────────────────────────────────────────
const THUMB_SIZE   = 48;
const THUMB_MARGIN = 6;

function openDeleteSheet(id, type) {
  pendingDeleteId   = id;
  pendingDeleteType = type;

  let item, preview;
  if (type === 'food')    { item = foodLog.find(i => i.id === id);    preview = `${item.name} · ${item.grams} g · ${item.calories} kcal`; }
  if (type === 'workout') { item = workoutLog.find(i => i.id === id); preview = `${item.name} · ${item.duration} min · ${item.calories} kcal burned`; }
  if (type === 'weight')  { item = weightLog.find(i => i.id === id);  preview = `Body weight · ${item.value} kg`; }

  deleteItemPrev.textContent = preview || '';
  resetSlideThumb(false);
  deleteSheet.classList.add('open');
  deleteBackdrop.classList.add('visible');
}

function closeDeleteSheet() {
  deleteSheet.classList.remove('open');
  deleteBackdrop.classList.remove('visible');
  pendingDeleteId = null;
  pendingDeleteType = null;
}

function resetSlideThumb(animate) {
  slideThumb.classList.toggle('snapping', animate);
  slideFill.classList.toggle('snapping', animate);
  slideThumb.style.left  = `${THUMB_MARGIN}px`;
  slideFill.style.width  = '0%';
  slideLabel.style.opacity = '1';
  slideThumb.setAttribute('aria-valuenow', '0');
}

function setSlideProgress(progress) {
  const maxLeft  = slideTrack.offsetWidth - THUMB_SIZE - THUMB_MARGIN * 2;
  slideThumb.classList.remove('snapping');
  slideFill.classList.remove('snapping');
  slideThumb.style.left   = `${THUMB_MARGIN + progress * maxLeft}px`;
  slideFill.style.width   = `${progress * 100}%`;
  slideLabel.style.opacity = String(Math.max(0, 1 - progress * 2.5));
  slideThumb.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}

function getSlideProgress() {
  const maxLeft = slideTrack.offsetWidth - THUMB_SIZE - THUMB_MARGIN * 2;
  return (parseFloat(slideThumb.style.left) - THUMB_MARGIN) / maxLeft;
}

let slideDragging = false, slideDragStartX = 0, slideDragStartLeft = 0;

slideThumb.addEventListener('touchstart', onSlideStart, { passive: true });
slideThumb.addEventListener('mousedown', onSlideStart);

function onSlideStart(e) {
  slideDragging      = true;
  slideDragStartX    = e.touches ? e.touches[0].clientX : e.clientX;
  slideDragStartLeft = parseFloat(slideThumb.style.left) || THUMB_MARGIN;
  slideThumb.classList.remove('snapping');
  slideFill.classList.remove('snapping');
  document.addEventListener('touchmove', onSlideMove, { passive: true });
  document.addEventListener('touchend', onSlideEnd);
  document.addEventListener('mousemove', onSlideMove);
  document.addEventListener('mouseup', onSlideEnd);
}

function onSlideMove(e) {
  if (!slideDragging) return;
  const x       = e.touches ? e.touches[0].clientX : e.clientX;
  const maxLeft = slideTrack.offsetWidth - THUMB_SIZE - THUMB_MARGIN * 2;
  const newLeft = Math.max(THUMB_MARGIN, Math.min(THUMB_MARGIN + maxLeft, slideDragStartLeft + x - slideDragStartX));
  const progress = (newLeft - THUMB_MARGIN) / maxLeft;
  setSlideProgress(progress);
  if (progress >= 1) { onSlideEnd(); commitDelete(); }
}

function onSlideEnd() {
  if (!slideDragging) return;
  slideDragging = false;
  document.removeEventListener('touchmove', onSlideMove);
  document.removeEventListener('touchend', onSlideEnd);
  document.removeEventListener('mousemove', onSlideMove);
  document.removeEventListener('mouseup', onSlideEnd);
  if (getSlideProgress() < 1) resetSlideThumb(true);
}

function commitDelete() {
  if (!pendingDeleteId) return;
  if (pendingDeleteType === 'food')    foodLog    = foodLog.filter(i => i.id !== pendingDeleteId);
  if (pendingDeleteType === 'workout') workoutLog = workoutLog.filter(i => i.id !== pendingDeleteId);
  if (pendingDeleteType === 'weight')  weightLog  = weightLog.filter(i => i.id !== pendingDeleteId);
  saveLog();
  closeDeleteSheet();
  renderLog();
  updateTotals();
}

deleteCancelBtn.addEventListener('click', () => { resetSlideThumb(true); closeDeleteSheet(); });
deleteBackdrop.addEventListener('click', () => { resetSlideThumb(true); closeDeleteSheet(); });

// ── Plate visualization ───────────────────────────────────────────────────────
const PLATE_W      = 160; // usable width of the slider column the pyramid lives in (px)
const CUP_GAP      = 2;   // gap between cups (px)
const CUP_MAX      = 34;  // max cup width (px)
const CUP_MIN      = 11;  // min cup width (px)
const CUP_ASPECT   = 0.72;// height = width * aspect  (< 1 = shorter than wide)
let   _cupUID      = 0;

/*
  Build pyramid row array for totalCups (float).
  Pyramid grows base-up: row 1 (bottom) has 1 cup, row 2 has 2, etc.
  We need the WIDEST row at the bottom, so fill order is bottom→top.

  Returns rows[] ordered TOP→BOTTOM (top row first in array) so that
  appending them to a flex-column container gives correct visual order.
*/
function buildPyramidRows(totalCups) {
  if (totalCups < 0.005) return [];

  // Smallest base width W where triangular(W) ≥ totalCups
  let W = 1;
  while (W * (W + 1) / 2 < totalCups - 0.005) W++;

  // Fill positions bottom row → top row, left → right within each row
  const rows = []; // rows[0] will be bottom row (width W)
  let remaining = totalCups;

  for (let rowW = W; rowW >= 1 && remaining > 0.005; rowW--) {
    const use       = Math.min(rowW, remaining);
    const fullCount = Math.floor(use + 0.005);
    const frac      = Math.round((use - fullCount) * 100) / 100;

    const cups = [];
    for (let i = 0; i < rowW; i++) {
      if      (i < fullCount)                  cups.push(1.0);
      else if (i === fullCount && frac > 0.01) cups.push(frac);
      else                                     cups.push(0);   // ghost position
    }
    rows.push(cups);
    remaining = Math.max(0, remaining - use);
  }

  // rows[0] = bottom row → reverse so rows[0] = top row for column-flex rendering
  return rows.reverse();
}

/*
  Inline SVG of a side-view cup, partially filled from the bottom.
  fill: 0..1  (0 = ghost placeholder, 1 = full)
*/
function cupSVG(fill, size) {
  const w     = size;
  const h     = Math.round(size * CUP_ASPECT);
  const rimH  = Math.max(2, Math.round(size * 0.17));
  // Trapezoid body: wider at top, narrower at bottom
  const tl    = size * 0.06;
  const topW  = size * 0.88;
  const botW  = size * 0.62;
  const bl    = (size - botW) / 2;
  const bTop  = rimH;
  const bBot  = h;
  const body  = `M${tl.toFixed(1)},${bTop} L${(tl+topW).toFixed(1)},${bTop} L${(bl+botW).toFixed(1)},${bBot} L${bl.toFixed(1)},${bBot} Z`;

  const fillH = Math.round((bBot - bTop) * Math.min(1, fill));
  const fillY = bBot - fillH;
  const uid   = `cup${_cupUID++}`;
  const ghost = fill < 0.01;

  const emptyCol  = ghost ? '#ede8de' : '#e2ddd4';
  const fillCol   = '#ff6b35';
  const rimFill   = ghost ? '#c8c2b6' : (fill > 0.01 ? '#e55a27' : '#c8c2b6');
  const outline   = 'black';
  const sw        = Math.max(0.4, size * 0.035); // stroke-width scales with cup size

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block">
    <defs><clipPath id="${uid}"><path d="${body}"/></clipPath></defs>
    <path d="${body}" fill="${emptyCol}" stroke="${outline}" stroke-width="${sw}" stroke-linejoin="round"/>
    ${fill > 0.01 ? `<rect x="0" y="${fillY}" width="${w}" height="${h}" clip-path="url(#${uid})" fill="${fillCol}"/>` : ''}
    <rect x="${tl.toFixed(1)}" y="0" width="${topW.toFixed(1)}" height="${rimH + 1}" rx="${(rimH / 2).toFixed(1)}"
          fill="${rimFill}" stroke="${outline}" stroke-width="${sw}"/>
  </svg>`;
}

const platePyramid = $('platePyramid');
const plateLabel   = $('plateLabel');

function renderPlate(grams) {
  const totalCups = grams > 0 ? grams / FOODS[foodIndex].gPerCup : 0;
  const rows      = buildPyramidRows(totalCups);

  platePyramid.innerHTML = '';

  if (rows.length === 0) {
    plateLabel.textContent = '';
    return;
  }

  // Base width = last row (widest, bottom row after reverse = rows[rows.length-1])
  const baseW   = rows[rows.length - 1].length;
  const rawSize = (PLATE_W - CUP_GAP * (baseW - 1)) / baseW;
  const cupSize = Math.max(CUP_MIN, Math.min(CUP_MAX, rawSize));

  rows.forEach(cups => {
    const rowEl = document.createElement('div');
    rowEl.className = 'pyramid-row';
    rowEl.style.gap = `${CUP_GAP}px`;

    cups.forEach(fill => {
      const wrap = document.createElement('div');
      wrap.className = 'cup-wrap';
      wrap.style.opacity = fill === 0 ? '0.13' : '1';
      wrap.innerHTML = cupSVG(fill, cupSize);
      rowEl.appendChild(wrap);
    });

    platePyramid.appendChild(rowEl);
  });

  const display = Math.round(totalCups * 10) / 10;
  plateLabel.textContent = `${display} cup${display !== 1 ? 's' : ''}`;
}

// ── History panel ─────────────────────────────────────────────────────────────
const historyPanel   = $('historyPanel');
const historyBackBtn = $('historyBackBtn');
const openHistoryBtn = $('openHistoryBtn');
const historySvg     = $('historySvg');
const hmsTrack       = $('hmsTrack');
const hmsPill        = $('hmsPill');
const hmsLabels      = $('hmsLabels');
const hvtDays        = $('hvtDays');
const hvtHours       = $('hvtHours');

let histMetric = 0;           // 0=Weight 1=Calories 2=Workout 3=All
let histView   = 'days';      // 'days' | 'hours'

function openHistoryView() {
  closeDrawer();
  historyPanel.classList.add('open');
  renderHistory();
  positionPill(histMetric, false);
}

function closeHistoryView() {
  historyPanel.classList.remove('open');
}

function setHistView(view) {
  histView = view;
  hvtDays.classList.toggle('hvt-active',  view === 'days');
  hvtHours.classList.toggle('hvt-active', view === 'hours');
  renderHistory();
}

openHistoryBtn.addEventListener('click', openHistoryView);
historyBackBtn.addEventListener('click', closeHistoryView);
hvtDays.addEventListener('click',  () => setHistView('days'));
hvtHours.addEventListener('click', () => setHistView('hours'));

// ── Chart data helpers ────────────────────────────────────────────────────────
const HC = { weight: '#007aff', calories: '#ff6b35', workout: '#34c759' };

// ── Weight projection (linear regression on last 5 days with data) ────────────
function weightTrend(hist) {
  const pts = hist.filter(h => h.weight !== null).slice(-5);
  if (pts.length < 2) return null;
  const n = pts.length;
  const xs = pts.map((_, i) => i);
  const ys = pts.map(p => p.weight);
  const sx = xs.reduce((a,b)=>a+b,0), sy = ys.reduce((a,b)=>a+b,0);
  const sxy = xs.reduce((s,x,i)=>s+x*ys[i],0), sx2 = xs.reduce((s,x)=>s+x*x,0);
  const den = n*sx2 - sx*sx;
  if (!den) return null;
  const slope = (n*sxy - sx*sy) / den;
  const intercept = (sy - slope*sx) / n;
  return { slope, intercept, n };
}

function projectedWeight(trend, stepsAhead) {
  if (!trend) return null;
  return Math.round((trend.intercept + trend.slope*(trend.n - 1 + stepsAhead)) * 10) / 10;
}

// Days view: -10 days (historical) … today … +5 days (projected weight only)
function getDaysData() {
  const hist = loadHistory();
  const byDate = {};
  hist.forEach(h => { byDate[h.date] = h; });
  const trend = weightTrend(hist);
  const rows = [];
  for (let i = -10; i <= 5; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const h = byDate[date];
    const projected = i > 0;
    rows.push({
      date,
      label: d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      projected,
      isToday: i === 0,
      calories: projected ? null : (h ? h.calories : null),
      workout:  projected ? null : (h ? h.workout  : null),
      weight:   projected ? projectedWeight(trend, i) : (h ? h.weight : null),
    });
  }
  return rows; // 16 points, index 10 = today, 11-15 projected
}

// Hours view: last 48 hours in 1-hour buckets
function getHoursData() {
  const now   = Date.now();
  const start = now - 48 * 3600000;
  const buckets = Array.from({ length: 48 }, (_, i) => {
    const t = start + i * 3600000;
    const d = new Date(t);
    const h = d.getHours();
    const label = (h % 6 === 0)
      ? (h === 0
          ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : d.toLocaleTimeString(undefined, { hour: 'numeric' }))
      : '';
    return { label, calories: 0, workout: 0, weight: null, _t: t };
  });

  // Gather all entries from history (yesterday + today) plus live log
  const allEntries = [
    ...foodLog.map(e    => ({ ...e, _type: 'food'    })),
    ...workoutLog.map(e => ({ ...e, _type: 'workout' })),
    ...weightLog.map(e  => ({ ...e, _type: 'weight'  })),
  ];
  loadHistory().forEach(day => {
    if (day.entries) allEntries.push(...day.entries);
  });

  allEntries.forEach(e => {
    const bi = Math.floor((e.id - start) / 3600000);
    if (bi < 0 || bi >= 48) return;
    const t  = e._type || e.type;
    if (t === 'food')    buckets[bi].calories += (e.calories || 0);
    if (t === 'workout') buckets[bi].workout  += (e.calories || 0);
    if (t === 'weight')  buckets[bi].weight    = e.value;
  });
  return buckets;
}

// ── SVG chart builders ────────────────────────────────────────────────────────
// projectedFrom: index into data where future projection begins (null = no projection)
function singleChart(data, metric, vw, vh, projectedFrom = null) {
  const PL = 46, PR = 12, PT = 18, PB = 34;
  const pw = vw - PL - PR, ph = vh - PT - PB;
  const n  = data.length;
  const vals = data.map(d => d[metric]);
  const valid = vals.filter(v => v !== null);

  if (!valid.length) {
    return `<text x="${vw/2}" y="${vh/2}" text-anchor="middle"
      font-size="13" fill="#bbb" font-family="system-ui">No data yet</text>`;
  }

  let lo = Math.min(...valid), hi = Math.max(...valid);
  if (lo === hi) { lo -= 1; hi += 1; }
  const rng = hi - lo;

  const xf = i  => PL + (n > 1 ? i / (n - 1) : 0.5) * pw;
  const yf = v  => PT + ph - ((v - lo) / rng) * ph;
  const color = HC[metric];
  let out = '';

  // Grid lines + Y labels (4 lines)
  for (let g = 0; g <= 4; g++) {
    const gy = PT + ph * g / 4;
    const gv = hi - rng * g / 4;
    out += `<line x1="${PL}" y1="${gy.toFixed(1)}" x2="${PL+pw}" y2="${gy.toFixed(1)}"
      stroke="#ebebeb" stroke-width="1"/>`;
    out += `<text x="${PL-5}" y="${(gy+3.5).toFixed(1)}" text-anchor="end"
      font-size="9" fill="#bbb" font-family="system-ui">${Math.round(gv)}</text>`;
  }

  // "Today" vertical divider and x-labels
  const todayIdx = data.findIndex(d => d.isToday);
  if (todayIdx >= 0) {
    const tx = xf(todayIdx);
    out += `<line x1="${tx.toFixed(1)}" y1="${PT}" x2="${tx.toFixed(1)}" y2="${PT+ph}"
      stroke="#ddd" stroke-width="1" stroke-dasharray="3,2"/>`;
    out += `<text x="${tx.toFixed(1)}" y="${(PT-4).toFixed(1)}" text-anchor="middle"
      font-size="8" fill="#bbb" font-family="system-ui">Today</text>`;
  }
  if (projectedFrom !== null) {
    out += `<text x="${(PL+pw).toFixed(1)}" y="${(PT-4).toFixed(1)}" text-anchor="end"
      font-size="8" fill="${color}" opacity="0.6" font-family="system-ui">Projected</text>`;
  }

  data.forEach((d, i) => {
    if (!d.label) return;
    out += `<text x="${xf(i).toFixed(1)}" y="${(PT+ph+20).toFixed(1)}"
      text-anchor="middle" font-size="9" fill="#bbb" font-family="system-ui">${d.label}</text>`;
  });

  // Helper: flush a segment as line + area
  const baseY = PT + ph;
  function flushSeg(seg, dashed) {
    if (!seg.length) return;
    if (seg.length === 1) {
      out += `<circle cx="${seg[0][0].toFixed(1)}" cy="${seg[0][1].toFixed(1)}"
        r="3.5" fill="${color}" opacity="${dashed ? 0.5 : 1}"/>`;
    } else {
      const pts = seg.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const area = [`${seg[0][0].toFixed(1)},${baseY}`,
        ...seg.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
        `${seg[seg.length-1][0].toFixed(1)},${baseY}`].join(' ');
      out += `<polygon points="${area}" fill="${color}" opacity="${dashed ? 0.04 : 0.10}"/>`;
      out += `<polyline points="${pts}" fill="none" stroke="${color}"
        stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"
        ${dashed ? 'stroke-dasharray="5,4"' : ''}/>`;
    }
    seg.forEach(([x,y]) => {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"
        r="3" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="${dashed ? 0.6 : 1}"/>`;
    });
  }

  // Split into historical and projected segments
  let histSeg = [], projSeg = [];
  vals.forEach((v, i) => {
    const isProjPoint = projectedFrom !== null && i >= projectedFrom;
    if (v !== null) {
      if (isProjPoint) projSeg.push([xf(i), yf(v)]);
      else {
        // Bridge: include last historical point in proj start
        if (projectedFrom !== null && i === projectedFrom - 1) projSeg.push([xf(i), yf(v)]);
        histSeg.push([xf(i), yf(v)]);
      }
    } else {
      if (!isProjPoint && histSeg.length) { flushSeg(histSeg, false); histSeg = []; }
    }
  });
  flushSeg(histSeg, false);
  flushSeg(projSeg, true);

  return out;
}

function renderMiniRow(data, m, mi, rowH, vw, PL, PR, PT, PB, showXLabels) {
  const oy  = mi * rowH, ph = rowH - PT - PB, pw = vw - PL - PR, n = data.length;
  const color = HC[m];
  const vals  = data.map(d => d[m]);
  const valid = vals.filter(v => v !== null);
  let out = '';

  const mLabels = ['Calories (kcal)', 'Workout (kcal)', 'Weight (lb)'];
  out += `<text x="${PL}" y="${(oy+12).toFixed(1)}" font-size="10"
    font-weight="bold" fill="${color}" font-family="system-ui">${mLabels[mi]}</text>`;

  const baseY = oy + PT + ph;
  out += `<line x1="${PL}" y1="${baseY.toFixed(1)}" x2="${PL+pw}" y2="${baseY.toFixed(1)}"
    stroke="#ebebeb" stroke-width="1"/>`;

  if (!valid.length) {
    out += `<text x="${vw/2}" y="${(oy+rowH/2+6).toFixed(1)}" text-anchor="middle"
      font-size="10" fill="#ccc" font-family="system-ui">No data</text>`;
    return out;
  }

  let lo = Math.min(...valid), hi = Math.max(...valid);
  if (lo === hi) { lo -= 1; hi += 1; }
  const rng = hi - lo;
  const xf  = i => PL + (n > 1 ? i / (n - 1) : 0.5) * pw;
  const yf  = v => oy + PT + ph - ((v - lo) / rng) * ph;

  out += `<text x="${PL-4}" y="${(oy+PT+4).toFixed(1)}" text-anchor="end"
    font-size="8" fill="#ccc" font-family="system-ui">${Math.round(hi)}</text>`;
  out += `<text x="${PL-4}" y="${(baseY+1).toFixed(1)}" text-anchor="end"
    font-size="8" fill="#ccc" font-family="system-ui">${Math.round(lo)}</text>`;

  // Today divider
  const todayIdx = data.findIndex(d => d.isToday);
  if (todayIdx >= 0) {
    const tx = xf(todayIdx);
    out += `<line x1="${tx.toFixed(1)}" y1="${oy+PT}" x2="${tx.toFixed(1)}" y2="${baseY}"
      stroke="#ddd" stroke-width="1" stroke-dasharray="2,2"/>`;
  }

  let histSeg = [], projSeg = [];
  const projFrom = data.findIndex(d => d.projected);

  function flushMini(seg, dashed) {
    if (!seg.length) return;
    if (seg.length > 1) {
      const pts  = seg.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const area = [`${seg[0][0].toFixed(1)},${baseY}`,
        ...seg.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
        `${seg[seg.length-1][0].toFixed(1)},${baseY}`].join(' ');
      out += `<polygon points="${area}" fill="${color}" opacity="${dashed ? 0.04 : 0.12}"/>`;
      out += `<polyline points="${pts}" fill="none" stroke="${color}"
        stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
        ${dashed ? 'stroke-dasharray="5,4"' : ''}/>`;
    }
    seg.forEach(([x,y]) => {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"
        r="2.5" fill="${color}" stroke="#fff" stroke-width="1" opacity="${dashed ? 0.5 : 1}"/>`;
    });
  }

  vals.forEach((v, i) => {
    const isProj = projFrom >= 0 && i >= projFrom;
    if (v !== null) {
      if (isProj) projSeg.push([xf(i), yf(v)]);
      else {
        if (projFrom >= 0 && i === projFrom - 1) projSeg.push([xf(i), yf(v)]);
        histSeg.push([xf(i), yf(v)]);
      }
    } else if (!isProj && histSeg.length) { flushMini(histSeg, false); histSeg = []; }
  });
  flushMini(histSeg, false);
  flushMini(projSeg, true);

  if (showXLabels) {
    data.forEach((d, i) => {
      if (!d.label) return;
      out += `<text x="${xf(i).toFixed(1)}" y="${(baseY+14).toFixed(1)}"
        text-anchor="middle" font-size="9" fill="#bbb" font-family="system-ui">${d.label}</text>`;
    });
  }
  return out;
}

function allChart(data, vw, vh) {
  const metrics = ['calories', 'workout', 'weight'];
  const rowH    = Math.floor((vh - 10) / 3);
  const PL = 46, PR = 12, PT = 16, PB = 10;
  const projFrom = data.findIndex(d => d.projected);
  return metrics.map((m, mi) =>
    renderMiniRow(data, m, mi, rowH, vw, PL, PR, PT, PB, mi === metrics.length - 1)
  ).join('');
}

function renderHistory() {
  const mKeys    = ['weight', 'calories', 'workout'];
  const isDays   = histView === 'days';
  const data     = isDays ? getDaysData() : getHoursData();
  const projFrom = isDays ? data.findIndex(d => d.projected) : null;

  if (histMetric === 3) {
    historySvg.setAttribute('viewBox', '0 0 360 260');
    historySvg.innerHTML = allChart(data, 360, 260);
  } else {
    historySvg.setAttribute('viewBox', '0 0 360 220');
    const pf = (isDays && mKeys[histMetric] === 'weight') ? projFrom : null;
    historySvg.innerHTML = singleChart(data, mKeys[histMetric], 360, 220, pf);
  }
}

// ── Pill-slider ───────────────────────────────────────────────────────────────
function positionPill(idx, animate = true) {
  const w    = hmsTrack.offsetWidth || 320;
  const segW = w / 4;
  hmsPill.style.transition = animate
    ? 'left 0.25s cubic-bezier(0.34,1.56,0.64,1), width 0.25s cubic-bezier(0.34,1.56,0.64,1)'
    : 'none';
  hmsPill.style.left  = `${idx * segW + 4}px`;
  hmsPill.style.width = `${segW - 8}px`;
  hmsLabels.querySelectorAll('span').forEach((s, i) => {
    s.classList.toggle('active', i === idx);
  });
}

function setMetric(idx) {
  histMetric = Math.max(0, Math.min(3, idx));
  positionPill(histMetric);
  renderHistory();
}

let hmsDragging = false, hmsDragStartX = 0, hmsDragStartMetric = 0;

hmsTrack.addEventListener('pointerdown', e => {
  hmsDragging = true;
  hmsDragStartX = e.clientX;
  hmsDragStartMetric = histMetric;
  hmsTrack.setPointerCapture(e.pointerId);
  // Tap: jump to tapped segment immediately
  const rect = hmsTrack.getBoundingClientRect();
  const segW = rect.width / 4;
  setMetric(Math.floor((e.clientX - rect.left) / segW));
});

hmsTrack.addEventListener('pointermove', e => {
  if (!hmsDragging) return;
  const dx   = e.clientX - hmsDragStartX;
  const segW = (hmsTrack.offsetWidth || 320) / 4;
  setMetric(Math.round(hmsDragStartMetric + dx / segW));
});

hmsTrack.addEventListener('pointerup',     () => { hmsDragging = false; });
hmsTrack.addEventListener('pointercancel', () => { hmsDragging = false; });

// ── File System persistence ───────────────────────────────────────────────────
let dataFileHandle = null;

// IndexedDB — the only browser storage that can hold a FileSystemFileHandle
function _idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('calTrackerDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbGet(key) {
  const db  = await _idbOpen();
  return new Promise((res, rej) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = e => res(e.target.result ?? null);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbSet(key, val) {
  const db = await _idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}
async function idbDel(key) {
  const db = await _idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}

async function _verifyPermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts))   === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

function _snapshot() {
  return {
    version:     1,
    savedAt:     new Date().toISOString(),
    goal,
    startWeight,
    lastWeight:  getLastWeight(),
    log:         { date: TODAY, food: foodLog, workout: workoutLog, weight: weightLog },
    history:     loadHistory(),
  };
}

async function writeToFile() {
  if (!dataFileHandle) return;
  try {
    if (!(await _verifyPermission(dataFileHandle))) return;
    const writable = await dataFileHandle.createWritable();
    await writable.write(JSON.stringify(_snapshot(), null, 2));
    await writable.close();
  } catch (e) { console.warn('File write:', e); }
}

async function _readFromFile(handle) {
  try {
    if (!(await _verifyPermission(handle))) return false;
    const text = await (await handle.getFile()).text();
    const d    = JSON.parse(text);
    // Push file data into localStorage so loadStorage() picks it up
    if (d.goal        != null) localStorage.setItem('calTracker_goal',        JSON.stringify(d.goal));
    if (d.startWeight != null) localStorage.setItem('calTracker_startWeight', JSON.stringify(d.startWeight));
    if (d.lastWeight  != null) localStorage.setItem('calTracker_lastWeight',  JSON.stringify(d.lastWeight));
    if (d.history)             localStorage.setItem('calTracker_history',     JSON.stringify(d.history));
    if (d.log)                 localStorage.setItem('calTracker_log',         JSON.stringify(d.log));
    return true;
  } catch (e) { console.warn('File read:', e); return false; }
}

function _updateFileUI() {
  const statusEl  = $('fileStatus');
  const unlinkBtn = $('unlinkFileBtn');
  const linkBtn   = $('linkFileBtn');
  if (!statusEl) return;
  if (dataFileHandle) {
    statusEl.textContent = dataFileHandle.name;
    unlinkBtn.hidden     = false;
    linkBtn.querySelector('svg + text, svg ~ *') // text node after svg
    linkBtn.childNodes[linkBtn.childNodes.length - 1].textContent = ' Change file…';
  } else {
    statusEl.textContent = 'No file linked';
    unlinkBtn.hidden     = true;
  }
}

async function initFileHandle() {
  try {
    const handle = await idbGet('dataFileHandle');
    if (!handle) return;
    dataFileHandle = handle;
    const ok = await _readFromFile(handle);
    if (ok) { loadStorage(); renderLog(); updateTotals(); }
    _updateFileUI();
  } catch (e) { console.warn('File init:', e); }
}

async function linkFile() {
  if (!('showSaveFilePicker' in window)) {
    alert('File System Access API not supported in this browser.\nUse Chrome or Edge.');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'data.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    dataFileHandle = handle;
    await idbSet('dataFileHandle', handle);
    await writeToFile();
    _updateFileUI();
  } catch (e) { if (e.name !== 'AbortError') console.warn('Link file:', e); }
}

async function unlinkFile() {
  dataFileHandle = null;
  await idbDel('dataFileHandle');
  _updateFileUI();
}

$('linkFileBtn').addEventListener('click',   linkFile);
$('unlinkFileBtn').addEventListener('click', unlinkFile);

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadStorage();

if (!('showSaveFilePicker' in window)) {
  $('linkFileBtn').closest('.drawer-section').style.display = 'none';
}

buildPicker(pickerList,       FOODS,    () => foodIndex,    v => { foodIndex = v; },    updateFoodSlider);
buildPicker(workoutPickerList, WORKOUTS, () => workoutIndex, v => { workoutIndex = v; }, updateWorkoutSlider);

updateFoodSlider();
updateWorkoutSlider();
renderLog();
updateTotals();
initFileHandle(); // async — re-renders if file data differs from localStorage

const datePicker = $('datePicker');
headerDate.addEventListener('click', () => {
  datePicker.value = viewDate;
  if (datePicker.showPicker) datePicker.showPicker();
  else datePicker.click();
});
datePicker.addEventListener('change', () => {
  if (datePicker.value) setViewDate(datePicker.value);
});
$('todayBtn').addEventListener('click', () => setViewDate(TODAY));
