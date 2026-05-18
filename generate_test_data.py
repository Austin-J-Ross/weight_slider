"""
generate_test_data.py
Generates test_data.json with 14 days of realistic history + today's partial log.
Run: python generate_test_data.py
"""

import json
import random
from datetime import datetime, timedelta

random.seed(42)  # reproducible

# ── App food/workout definitions (must match app.js) ──────────────────────────

FOODS = {
    "Meat":        {"calPerG": 2.0},
    "Fish":        {"calPerG": 1.5},
    "Bread":       {"calPerG": 2.65},
    "Rice/Pasta":  {"calPerG": 1.3},
    "Dairy":       {"calPerG": 1.5},
    "Vegetables":  {"calPerG": 0.4},
    "Fruit":       {"calPerG": 0.6},
    "Fats/Oils":   {"calPerG": 8.0},
    "Chips":       {"calPerG": 5.3},
    "Sweets":      {"calPerG": 4.0},
    "Sandwiches":  {"calPerG": 2.5},
}

WORKOUTS = {
    "Running":  {"calPerMin": 10},
    "Cycling":  {"calPerMin":  8},
    "HIIT":     {"calPerMin": 12},
    "Swimming": {"calPerMin":  7},
    "Weights":  {"calPerMin":  5},
    "Walking":  {"calPerMin":  4},
}

# ── Meal templates  [list of (food_name, grams)] ──────────────────────────────

BREAKFASTS = [
    [("Dairy", 220), ("Fruit", 130), ("Bread", 80)],
    [("Bread", 150), ("Dairy", 180)],
    [("Fruit", 220), ("Dairy", 160)],
    [("Rice/Pasta", 230), ("Dairy", 100)],
    [("Bread", 120), ("Meat", 90)],
    [("Dairy", 200), ("Bread", 100)],
]

LUNCHES = [
    [("Sandwiches", 320)],
    [("Rice/Pasta", 380), ("Vegetables", 200)],
    [("Meat", 220), ("Vegetables", 250), ("Bread", 80)],
    [("Fish", 280), ("Rice/Pasta", 200), ("Vegetables", 150)],
    [("Sandwiches", 280), ("Vegetables", 180)],
    [("Chips", 90), ("Sandwiches", 240)],
    [("Meat", 260), ("Bread", 100), ("Vegetables", 200)],
]

DINNERS = [
    [("Meat", 240), ("Vegetables", 300)],
    [("Fish", 260), ("Rice/Pasta", 230), ("Vegetables", 150)],
    [("Sandwiches", 310), ("Vegetables", 170)],
    [("Meat", 200), ("Rice/Pasta", 320), ("Vegetables", 200)],
    [("Fish", 230), ("Vegetables", 320), ("Bread", 80)],
    [("Rice/Pasta", 400), ("Vegetables", 200)],
]

SNACKS = [
    [("Fruit", 150)],
    [("Dairy", 130)],
    [("Chips", 55)],
    [("Sweets", 75)],
    [("Fruit", 100), ("Dairy", 80)],
]

WORKOUT_POOL = [
    ("Running",  30), ("Running",  40), ("Running",  45),
    ("Cycling",  35), ("Cycling",  45),
    ("HIIT",     25), ("HIIT",     30),
    ("Swimming", 40), ("Swimming", 50),
    ("Weights",  50), ("Weights",  55),
    ("Walking",  60),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def to_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)

def fmt_time(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")  # "7:30 AM" (no leading zero)

def snap5(g: float) -> int:
    return max(5, round(g / 5) * 5)

def food_item(name: str, grams: int, day: datetime, hour: int, minute: int = 0) -> dict:
    t = day.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)
    cal = round(grams * FOODS[name]["calPerG"])
    return {"id": to_ms(t), "type": "food", "name": name,
            "grams": grams, "calories": cal, "time": fmt_time(t)}

def workout_item(name: str, mins: int, day: datetime, hour: int, minute: int = 0) -> dict:
    t = day.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)
    cal = round(mins * WORKOUTS[name]["calPerMin"])
    return {"id": to_ms(t), "type": "workout", "name": name,
            "duration": mins, "calories": cal, "time": fmt_time(t)}

def weight_item(value: float, day: datetime, hour: int = 7, minute: int = None) -> dict:
    m = minute if minute is not None else random.randint(5, 25)
    t = day.replace(hour=hour, minute=m, second=random.randint(0, 30), microsecond=0)
    return {"id": to_ms(t), "type": "weight",
            "value": round(value, 1), "time": fmt_time(t)}

# ── Day generator ─────────────────────────────────────────────────────────────

def gen_day(day: datetime, weight: float, log_weight: bool,
            log_workout: bool, cal_scale: float) -> tuple:
    """
    Returns (entries, total_calories, total_workout_cal, weight_or_None).
    entries includes both food and workout and weight items sorted by time.
    """
    items = []

    # Morning weight
    if log_weight:
        items.append(weight_item(weight, day))

    # Breakfast  7–8 AM
    bfast_h = random.randint(7, 8)
    for name, g in random.choice(BREAKFASTS):
        g = snap5(g * cal_scale * random.uniform(0.88, 1.12))
        items.append(food_item(name, g, day, bfast_h, random.randint(0, 30)))

    # Morning snack  10–11 AM  (55% chance)
    if random.random() < 0.55:
        for name, g in random.choice(SNACKS):
            g = snap5(g * cal_scale * random.uniform(0.9, 1.1))
            items.append(food_item(name, g, day, random.randint(10, 11), random.randint(0, 50)))

    # Lunch  12–1 PM
    for name, g in random.choice(LUNCHES):
        g = snap5(g * cal_scale * random.uniform(0.88, 1.12))
        items.append(food_item(name, g, day, random.randint(12, 13), random.randint(0, 30)))

    # Afternoon snack  3–4 PM  (40% chance)
    if random.random() < 0.40:
        for name, g in random.choice(SNACKS):
            g = snap5(g * cal_scale * random.uniform(0.9, 1.1))
            items.append(food_item(name, g, day, random.randint(15, 16), random.randint(0, 50)))

    # Workout  5–6 PM
    workout_cal = 0
    if log_workout:
        wname, wmins = random.choice(WORKOUT_POOL)
        wmins = round(wmins * random.uniform(0.85, 1.15) / 5) * 5
        w = workout_item(wname, wmins, day, random.randint(17, 18), random.randint(0, 45))
        items.append(w)
        workout_cal = w["calories"]

    # Dinner  6–7 PM (later on workout days)
    dinner_h = random.randint(19, 20) if log_workout else random.randint(18, 19)
    for name, g in random.choice(DINNERS):
        g = snap5(g * cal_scale * random.uniform(0.88, 1.12))
        items.append(food_item(name, g, day, dinner_h, random.randint(0, 30)))

    # Evening snack  8–9 PM  (35% chance)
    if random.random() < 0.35:
        for name, g in random.choice(SNACKS):
            g = snap5(g * cal_scale * random.uniform(0.9, 1.1))
            items.append(food_item(name, g, day, random.randint(20, 21), random.randint(0, 50)))

    items.sort(key=lambda e: e["id"])

    food_cal = sum(e["calories"] for e in items if e["type"] == "food")
    final_weight = weight if log_weight else None
    return items, food_cal, workout_cal, final_weight

# ── Main ──────────────────────────────────────────────────────────────────────

def generate(out_path: str = "test_data.json",
             goal: int = 1800,
             end_weight: float = 186.8,
             n_days: int = 14):

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Weight trend over n_days (linear decline, ~0.15 lb/day)
    weight_per_day = 0.15
    start_weight   = end_weight + weight_per_day * n_days   # ~188.9

    # Randomly decide which of the history days have workout / weight logged
    indices      = list(range(n_days))
    workout_days = set(random.sample(indices, k=round(n_days * 0.45)))   # ~6–7/14
    no_weight    = set(random.sample(indices, k=round(n_days * 0.28)))   # ~4/14 days missing

    # Per-day calorie scale:  some days over/under goal
    cal_scales = [random.uniform(0.80, 1.25) for _ in indices]

    history = []
    for i in indices:
        offset  = -(n_days - i)          # -14 … -1
        day_dt  = today + timedelta(days=offset)
        date_str = day_dt.strftime("%Y-%m-%d")

        base_w  = start_weight - weight_per_day * i
        noise   = random.uniform(-0.25, 0.25)
        w_val   = round(base_w + noise, 1)

        items, food_cal, workout_cal, w_final = gen_day(
            day_dt,
            w_val,
            log_weight  = (i not in no_weight),
            log_workout = (i in workout_days),
            cal_scale   = cal_scales[i],
        )

        # History entries: add _type alongside type (mirrors saveHistory())
        hist_entries = [{**e, "_type": e["type"]} for e in items]

        history.append({
            "date":     date_str,
            "calories": food_cal,
            "workout":  workout_cal,
            "weight":   w_final,
            "entries":  hist_entries,
        })

    # Today: just a morning weight entry (partial day)
    today_wt = weight_item(end_weight, today, hour=7, minute=15)

    data = {
        "version":     1,
        "savedAt":     datetime.now().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "goal":        goal,
        "startWeight": round(start_weight, 1),
        "lastWeight":  end_weight,
        "log": {
            "date":    today.strftime("%Y-%m-%d"),
            "food":    [],
            "workout": [],
            "weight":  [today_wt],
        },
        "history": history,
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)

    # ── Summary ───────────────────────────────────────────────────────────────
    total_entries   = sum(len(h["entries"]) for h in history)
    days_with_wt    = sum(1 for h in history if h["weight"] is not None)
    days_with_wo    = sum(1 for h in history if h["workout"] > 0)
    avg_cal         = sum(h["calories"] for h in history) / len(history)
    avg_net         = sum(h["calories"] - h["workout"] for h in history) / len(history)

    print(f"Wrote {out_path}")
    print(f"  Period  : {history[0]['date']} → {history[-1]['date']}  ({n_days} days)")
    print(f"  Entries : {total_entries} total across all days")
    print(f"  Weight  : {days_with_wt}/{n_days} days measured  "
          f"({start_weight:.1f} → {end_weight:.1f} lb trend)")
    print(f"  Workout : {days_with_wo}/{n_days} days active")
    print(f"  Avg cal : {avg_cal:.0f} food  |  {avg_net:.0f} net  (goal {goal})")


if __name__ == "__main__":
    generate()
