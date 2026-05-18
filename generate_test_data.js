// generate_test_data.js
// Run: node generate_test_data.js
// Writes test_data.json with 14 days of realistic history + today's partial log.

const fs = require('fs');
const path = require('path');

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng   = seededRng(42);
const rand  = (lo, hi) => lo + rng() * (hi - lo);
const randI = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick  = arr => arr[Math.floor(rng() * arr.length)];

function sample(arr, k) {
  const a = [...arr]; const out = [];
  for (let i = 0; i < k; i++) {
    const j = randI(i, a.length - 1);
    [a[i], a[j]] = [a[j], a[i]];
    out.push(a[i]);
  }
  return out;
}

// ── App data (mirrors app.js) ─────────────────────────────────────────────────
const FOODS = {
  'Meat':        { calPerG: 2.0  },
  'Fish':        { calPerG: 1.5  },
  'Bread':       { calPerG: 2.65 },
  'Rice/Pasta':  { calPerG: 1.3  },
  'Dairy':       { calPerG: 1.5  },
  'Vegetables':  { calPerG: 0.4  },
  'Fruit':       { calPerG: 0.6  },
  'Fats/Oils':   { calPerG: 8.0  },
  'Chips':       { calPerG: 5.3  },
  'Sweets':      { calPerG: 4.0  },
  'Sandwiches':  { calPerG: 2.5  },
};

const WORKOUTS = {
  'Running':  { calPerMin: 10 },
  'Cycling':  { calPerMin:  8 },
  'HIIT':     { calPerMin: 12 },
  'Swimming': { calPerMin:  7 },
  'Weights':  { calPerMin:  5 },
  'Walking':  { calPerMin:  4 },
};

// ── Meal templates ────────────────────────────────────────────────────────────
const BREAKFASTS = [
  [['Dairy', 220], ['Fruit', 130], ['Bread', 80]],
  [['Bread', 150], ['Dairy', 180]],
  [['Fruit', 220], ['Dairy', 160]],
  [['Rice/Pasta', 230], ['Dairy', 100]],
  [['Bread', 120], ['Meat', 90]],
  [['Dairy', 200], ['Bread', 100]],
];

const LUNCHES = [
  [['Sandwiches', 320]],
  [['Rice/Pasta', 380], ['Vegetables', 200]],
  [['Meat', 220], ['Vegetables', 250], ['Bread', 80]],
  [['Fish', 280], ['Rice/Pasta', 200], ['Vegetables', 150]],
  [['Sandwiches', 280], ['Vegetables', 180]],
  [['Chips', 90], ['Sandwiches', 240]],
  [['Meat', 260], ['Bread', 100], ['Vegetables', 200]],
];

const DINNERS = [
  [['Meat', 240], ['Vegetables', 300]],
  [['Fish', 260], ['Rice/Pasta', 230], ['Vegetables', 150]],
  [['Sandwiches', 310], ['Vegetables', 170]],
  [['Meat', 200], ['Rice/Pasta', 320], ['Vegetables', 200]],
  [['Fish', 230], ['Vegetables', 320], ['Bread', 80]],
  [['Rice/Pasta', 400], ['Vegetables', 200]],
];

const SNACKS = [
  [['Fruit', 150]],
  [['Dairy', 130]],
  [['Chips', 55]],
  [['Sweets', 75]],
  [['Fruit', 100], ['Dairy', 80]],
];

const WORKOUT_POOL = [
  ['Running',  30], ['Running',  40], ['Running',  45],
  ['Cycling',  35], ['Cycling',  45],
  ['HIIT',     25], ['HIIT',     30],
  ['Swimming', 40], ['Swimming', 50],
  ['Weights',  50], ['Weights',  55],
  ['Walking',  60],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const snap5 = g => Math.max(5, Math.round(g / 5) * 5);

function fmtTime(date) {
  let h = date.getHours(), m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function dayAt(base, hour, minute) {
  const d = new Date(base);
  d.setHours(hour, minute, randI(0, 59), 0);
  return d;
}

function foodItem(name, grams, ts) {
  const cal = Math.round(grams * FOODS[name].calPerG);
  return { id: ts.getTime(), type: 'food', name, grams, calories: cal, time: fmtTime(ts) };
}

function workoutItem(name, mins, ts) {
  const cal = Math.round(mins * WORKOUTS[name].calPerMin);
  return { id: ts.getTime(), type: 'workout', name, duration: mins, calories: cal, time: fmtTime(ts) };
}

function weightItem(value, ts) {
  return { id: ts.getTime(), type: 'weight', value: Math.round(value * 10) / 10, time: fmtTime(ts) };
}

// ── Day generator ─────────────────────────────────────────────────────────────
function genDay(dayBase, weight, logWeight, logWorkout, calScale) {
  const items = [];

  // Morning weight  7:00–7:25
  if (logWeight) {
    items.push(weightItem(weight, dayAt(dayBase, 7, randI(5, 25))));
  }

  // Breakfast  7–8 AM
  const bHour = randI(7, 8);
  for (const [name, g] of pick(BREAKFASTS)) {
    const grams = snap5(g * calScale * rand(0.88, 1.12));
    items.push(foodItem(name, grams, dayAt(dayBase, bHour, randI(0, 30))));
  }

  // Morning snack  10–11 AM  (55%)
  if (rng() < 0.55) {
    for (const [name, g] of pick(SNACKS)) {
      const grams = snap5(g * calScale * rand(0.9, 1.1));
      items.push(foodItem(name, grams, dayAt(dayBase, randI(10, 11), randI(0, 50))));
    }
  }

  // Lunch  12–1 PM
  for (const [name, g] of pick(LUNCHES)) {
    const grams = snap5(g * calScale * rand(0.88, 1.12));
    items.push(foodItem(name, grams, dayAt(dayBase, randI(12, 13), randI(0, 30))));
  }

  // Afternoon snack  3–4 PM  (40%)
  if (rng() < 0.40) {
    for (const [name, g] of pick(SNACKS)) {
      const grams = snap5(g * calScale * rand(0.9, 1.1));
      items.push(foodItem(name, grams, dayAt(dayBase, randI(15, 16), randI(0, 50))));
    }
  }

  // Workout  5–6 PM
  let workoutCal = 0;
  if (logWorkout) {
    const [wname, wmins] = pick(WORKOUT_POOL);
    const mins = Math.round(wmins * rand(0.85, 1.15) / 5) * 5;
    const wi = workoutItem(wname, mins, dayAt(dayBase, randI(17, 18), randI(0, 45)));
    items.push(wi);
    workoutCal = wi.calories;
  }

  // Dinner  6–7 PM (later on workout days)
  const dHour = logWorkout ? randI(19, 20) : randI(18, 19);
  for (const [name, g] of pick(DINNERS)) {
    const grams = snap5(g * calScale * rand(0.88, 1.12));
    items.push(foodItem(name, grams, dayAt(dayBase, dHour, randI(0, 30))));
  }

  // Evening snack  8–9 PM  (35%)
  if (rng() < 0.35) {
    for (const [name, g] of pick(SNACKS)) {
      const grams = snap5(g * calScale * rand(0.9, 1.1));
      items.push(foodItem(name, grams, dayAt(dayBase, randI(20, 21), randI(0, 50))));
    }
  }

  items.sort((a, b) => a.id - b.id);

  const foodCal    = items.filter(e => e.type === 'food').reduce((s, e) => s + e.calories, 0);
  const finalWeight = logWeight ? weight : null;
  return { items, foodCal, workoutCal, finalWeight };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function generate({
  outPath    = 'test_data.json',
  goal       = 1800,
  endWeight  = 186.8,
  nDays      = 14,
} = {}) {

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight local

  const weightPerDay  = 0.15;
  const startWeight   = endWeight + weightPerDay * nDays;           // ~189.0

  const indices     = Array.from({ length: nDays }, (_, i) => i);
  const workoutDays = new Set(sample(indices, Math.round(nDays * 0.45)));
  const noWeightDays = new Set(sample(indices, Math.round(nDays * 0.28)));
  const calScales   = indices.map(() => rand(0.80, 1.25));

  const history = [];

  for (const i of indices) {
    const offset  = -(nDays - i);
    const dayBase = new Date(today.getTime() + offset * 86400000);
    const dateStr = dayBase.toISOString().slice(0, 10);

    const baseW = startWeight - weightPerDay * i;
    const noise = rand(-0.25, 0.25);
    const wVal  = Math.round((baseW + noise) * 10) / 10;

    const { items, foodCal, workoutCal, finalWeight } = genDay(
      dayBase, wVal,
      !noWeightDays.has(i),
      workoutDays.has(i),
      calScales[i],
    );

    // History entries: add _type alongside type (mirrors saveHistory())
    const entries = items.map(e => ({ ...e, _type: e.type }));

    history.push({ date: dateStr, calories: foodCal, workout: workoutCal,
                   weight: finalWeight, entries });
  }

  // Today: morning weight only
  const todayWtTs = new Date(today.getTime() + 7 * 3600000 + 15 * 60000);
  const todayWeight = weightItem(endWeight, todayWtTs);

  const data = {
    version:     1,
    savedAt:     now.toISOString(),
    goal,
    startWeight: Math.round(startWeight * 10) / 10,
    lastWeight:  endWeight,
    log: {
      date:    today.toISOString().slice(0, 10),
      food:    [],
      workout: [],
      weight:  [todayWeight],
    },
    history,
  };

  fs.writeFileSync(path.resolve(__dirname, outPath),
    JSON.stringify(data, null, 2), 'utf8');

  // Summary
  const totalEntries = history.reduce((s, h) => s + h.entries.length, 0);
  const daysWithWt   = history.filter(h => h.weight !== null).length;
  const daysWithWo   = history.filter(h => h.workout > 0).length;
  const avgCal       = Math.round(history.reduce((s, h) => s + h.calories, 0) / nDays);
  const avgNet       = Math.round(history.reduce((s, h) => s + h.calories - h.workout, 0) / nDays);

  console.log(`Wrote ${outPath}`);
  console.log(`  Period  : ${history[0].date} → ${history[history.length-1].date}  (${nDays} days)`);
  console.log(`  Entries : ${totalEntries} total`);
  console.log(`  Weight  : ${daysWithWt}/${nDays} days  (${startWeight.toFixed(1)} → ${endWeight} lb trend)`);
  console.log(`  Workout : ${daysWithWo}/${nDays} days active`);
  console.log(`  Avg cal : ${avgCal} food  |  ${avgNet} net  (goal ${goal})`);
}

generate();
