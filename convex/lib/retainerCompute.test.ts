import { describe, expect, it } from "vitest";
import {
  CYCLE_LENGTH,
  getCycleInfo,
  computeRetainerMonths,
  groupTasksByCategory,
  getMonthRange,
  getAllMonthsBetween,
  minutesToHours,
  formatPeriodLabel,
  getStatusTag,
  getStartedWithSubtitle,
  getEndingBalanceSubtitle,
  type RetainerConfig,
  type TaskRecord,
  type ComputedMonth,
} from "./retainerCompute";

// ── Helpers ────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<RetainerConfig>): RetainerConfig {
  return {
    includedMinutesPerMonth: 600, // 10 hours
    overageRate: 150,
    rolloverEnabled: true,
    startDate: "2025-01-01",
    currency: "USD",
    ...overrides,
  };
}

function makeTask(
  date: string,
  minutes: number,
  overrides?: Partial<TaskRecord>,
): TaskRecord {
  return {
    taskId: `task_${date}_${minutes}`,
    title: `Task on ${date}`,
    date,
    durationMinutes: minutes,
    ...overrides,
  };
}

function buildTaskMap(
  tasks: TaskRecord[],
): Map<string, TaskRecord[]> {
  const map = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    const ym = task.date.substring(0, 7);
    const list = map.get(ym) ?? [];
    list.push(task);
    map.set(ym, list);
  }
  return map;
}

// ── Date helpers ───────────────────────────────────────────────────

describe("getMonthRange", () => {
  it("returns first and last day of January", () => {
    const { start, end } = getMonthRange("2025-01");
    expect(start).toBe("2025-01-01");
    expect(end).toBe("2025-01-31");
  });

  it("handles February (non-leap year)", () => {
    const { end } = getMonthRange("2025-02");
    expect(end).toBe("2025-02-28");
  });

  it("handles February (leap year)", () => {
    const { end } = getMonthRange("2024-02");
    expect(end).toBe("2024-02-29");
  });

  it("handles December", () => {
    const { start, end } = getMonthRange("2025-12");
    expect(start).toBe("2025-12-01");
    expect(end).toBe("2025-12-31");
  });
});

describe("getAllMonthsBetween", () => {
  it("returns single month when first equals last", () => {
    expect(getAllMonthsBetween("2025-03", "2025-03")).toEqual(["2025-03"]);
  });

  it("returns months within a year", () => {
    const result = getAllMonthsBetween("2025-01", "2025-03");
    expect(result).toEqual(["2025-01", "2025-02", "2025-03"]);
  });

  it("spans year boundary", () => {
    const result = getAllMonthsBetween("2024-11", "2025-02");
    expect(result).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
  });
});

describe("minutesToHours", () => {
  it("converts 0 minutes to 0", () => {
    expect(minutesToHours(0)).toBe(0);
  });

  it("converts 60 minutes to 1", () => {
    expect(minutesToHours(60)).toBe(1);
  });

  it("converts 90 minutes to 1.5", () => {
    expect(minutesToHours(90)).toBe(1.5);
  });

  it("converts 600 minutes to 10", () => {
    expect(minutesToHours(600)).toBe(10);
  });

  it("rounds to 1 decimal", () => {
    expect(minutesToHours(100)).toBe(1.7); // 100/60 = 1.666... → 1.7
  });
});

describe("formatPeriodLabel", () => {
  it("formats January 2025", () => {
    expect(formatPeriodLabel("2025-01")).toBe("Jan 1 – 31, 2025");
  });

  it("formats February 2024 (leap year)", () => {
    expect(formatPeriodLabel("2024-02")).toBe("Feb 1 – 29, 2024");
  });
});

// ── Cycle assignment ───────────────────────────────────────────────

describe("getCycleInfo", () => {
  const startDate = "2025-01-01";

  it("identifies month 1 of cycle 0", () => {
    const info = getCycleInfo("2025-01", startDate);
    expect(info.monthInCycle).toBe(1);
    expect(info.isCycleStart).toBe(true);
    expect(info.isCycleEnd).toBe(false);
    expect(info.cycleIndex).toBe(0);
  });

  it("identifies month 2 of cycle 0", () => {
    const info = getCycleInfo("2025-02", startDate);
    expect(info.monthInCycle).toBe(2);
    expect(info.isCycleStart).toBe(false);
    expect(info.isCycleEnd).toBe(false);
    expect(info.cycleIndex).toBe(0);
  });

  it("identifies month 3 (cycle end) of cycle 0", () => {
    const info = getCycleInfo("2025-03", startDate);
    expect(info.monthInCycle).toBe(3);
    expect(info.isCycleStart).toBe(false);
    expect(info.isCycleEnd).toBe(true);
    expect(info.cycleIndex).toBe(0);
  });

  it("identifies month 1 of cycle 1", () => {
    const info = getCycleInfo("2025-04", startDate);
    expect(info.monthInCycle).toBe(1);
    expect(info.isCycleStart).toBe(true);
    expect(info.isCycleEnd).toBe(false);
    expect(info.cycleIndex).toBe(1);
  });

  it("works across year boundary", () => {
    // Start in Oct 2024: Oct=1, Nov=2, Dec=3, Jan=1, Feb=2, Mar=3
    const info = getCycleInfo("2025-01", "2024-10-01");
    expect(info.monthInCycle).toBe(1);
    expect(info.isCycleStart).toBe(true);
    expect(info.cycleIndex).toBe(1);
  });

  it("returns neutral values for pre-start month", () => {
    const info = getCycleInfo("2024-12", "2025-01-01");
    expect(info.monthInCycle).toBe(0);
    expect(info.isCycleStart).toBe(false);
    expect(info.isCycleEnd).toBe(false);
    expect(info.cycleIndex).toBe(-1);
  });

  it("cycle length is 3", () => {
    expect(CYCLE_LENGTH).toBe(3);
  });
});

// ── Balance computation: rollover ON ───────────────────────────────

describe("computeRetainerMonths (rollover ON)", () => {
  it("computes a single month with zero tasks", () => {
    const config = makeConfig({ startDate: "2025-03-01" });
    const result = computeRetainerMonths(config, new Map(), "2025-03");

    expect(result).toHaveLength(1);
    const march = result[0];
    expect(march.yearMonth).toBe("2025-03");
    expect(march.workedMinutes).toBe(0);
    expect(march.availableMinutes).toBe(600);
    expect(march.endBalance).toBe(600);
  });

  it("carries balance forward within a cycle", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-15", 300), // 5h in Jan
      makeTask("2025-02-15", 480), // 8h in Feb
    ]);
    const result = computeRetainerMonths(config, tasks);

    const jan = result.find((m) => m.yearMonth === "2025-01")!;
    const feb = result.find((m) => m.yearMonth === "2025-02")!;

    // Jan: start=0, available=600, worked=300, end=300
    expect(jan.startBalance).toBe(0);
    expect(jan.availableMinutes).toBe(600);
    expect(jan.workedMinutes).toBe(300);
    expect(jan.endBalance).toBe(300);

    // Feb: start=300, available=300+600=900, worked=480, end=420
    expect(feb.startBalance).toBe(300);
    expect(feb.availableMinutes).toBe(900);
    expect(feb.workedMinutes).toBe(480);
    expect(feb.endBalance).toBe(420);
  });

  it("settles at cycle end with extra hours", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 600), // 10h
      makeTask("2025-02-10", 600), // 10h
      makeTask("2025-03-10", 900), // 15h — over budget
    ]);
    const result = computeRetainerMonths(config, tasks);

    const march = result.find((m) => m.yearMonth === "2025-03")!;
    expect(march.settles).toBe(true);
    expect(march.isCycleEnd).toBe(true);
    // Total available in cycle: 3 * 600 = 1800, total used: 2100
    // March: start=0, available=600, worked=900, end=-300
    expect(march.endBalance).toBe(-300);
    expect(march.extraMinutes).toBe(300);
    expect(march.unusedMinutes).toBe(0);
  });

  it("settles at cycle end with unused hours", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 180), // 3h
      makeTask("2025-02-10", 120), // 2h
      makeTask("2025-03-10", 60),  // 1h
    ]);
    const result = computeRetainerMonths(config, tasks);

    const march = result.find((m) => m.yearMonth === "2025-03")!;
    expect(march.settles).toBe(true);
    // Jan: 0+600-180=420, Feb: 420+600-120=900, Mar: 900+600-60=1440
    expect(march.endBalance).toBe(1440);
    expect(march.unusedMinutes).toBe(1440);
    expect(march.extraMinutes).toBe(0);
  });

  it("resets balance at new cycle start", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 180),
      makeTask("2025-04-10", 300), // new cycle
    ]);
    const result = computeRetainerMonths(config, tasks);

    const april = result.find((m) => m.yearMonth === "2025-04")!;
    expect(april.isCycleStart).toBe(true);
    expect(april.startBalance).toBe(0); // reset!
    expect(april.availableMinutes).toBe(600);
    expect(april.endBalance).toBe(300);
  });

  it("mid-cycle months do not settle", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([makeTask("2025-01-10", 300)]);
    const result = computeRetainerMonths(config, tasks);

    const jan = result.find((m) => m.yearMonth === "2025-01")!;
    const feb = result.find((m) => m.yearMonth === "2025-02")!;

    expect(jan.settles).toBe(false);
    expect(feb.settles).toBe(false);
    expect(jan.extraMinutes).toBe(0);
    expect(jan.unusedMinutes).toBe(0);
  });

  it("handles negative carry within cycle (borrowing)", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 900), // 15h — over budget
    ]);
    const result = computeRetainerMonths(config, tasks);

    const jan = result.find((m) => m.yearMonth === "2025-01")!;
    const feb = result.find((m) => m.yearMonth === "2025-02")!;

    // Jan: 0+600-900 = -300
    expect(jan.endBalance).toBe(-300);
    // Feb: -300+600 = 300 available, 0 worked
    expect(feb.startBalance).toBe(-300);
    expect(feb.availableMinutes).toBe(300);
    expect(feb.endBalance).toBe(300);
  });

  it("cycle end on-budget (endBalance=0)", () => {
    const config = makeConfig();
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 600),
      makeTask("2025-02-10", 600),
      makeTask("2025-03-10", 600),
    ]);
    const result = computeRetainerMonths(config, tasks);

    const march = result.find((m) => m.yearMonth === "2025-03")!;
    expect(march.endBalance).toBe(0);
    expect(march.extraMinutes).toBe(0);
    expect(march.unusedMinutes).toBe(0);
    expect(march.settles).toBe(true);
  });
});

// ── Balance computation: rollover OFF ──────────────────────────────

describe("computeRetainerMonths (rollover OFF)", () => {
  it("every month settles independently", () => {
    const config = makeConfig({ rolloverEnabled: false });
    const tasks = buildTaskMap([
      makeTask("2025-01-10", 300), // 5h
      makeTask("2025-02-10", 780), // 13h — over budget
    ]);
    const result = computeRetainerMonths(config, tasks);

    const jan = result.find((m) => m.yearMonth === "2025-01")!;
    const feb = result.find((m) => m.yearMonth === "2025-02")!;

    // Jan: 600 available, 300 worked, 300 unused
    expect(jan.settles).toBe(true);
    expect(jan.startBalance).toBe(0);
    expect(jan.availableMinutes).toBe(600);
    expect(jan.endBalance).toBe(300);
    expect(jan.unusedMinutes).toBe(300);
    expect(jan.extraMinutes).toBe(0);

    // Feb: 600 available (no carry), 780 worked, -180 balance
    expect(feb.settles).toBe(true);
    expect(feb.startBalance).toBe(0);
    expect(feb.availableMinutes).toBe(600);
    expect(feb.endBalance).toBe(-180);
    expect(feb.extraMinutes).toBe(180);
    expect(feb.unusedMinutes).toBe(0);
  });

  it("on-budget month (endBalance=0)", () => {
    const config = makeConfig({ rolloverEnabled: false });
    const tasks = buildTaskMap([makeTask("2025-01-10", 600)]);
    const result = computeRetainerMonths(config, tasks);

    const jan = result.find((m) => m.yearMonth === "2025-01")!;
    expect(jan.endBalance).toBe(0);
    expect(jan.extraMinutes).toBe(0);
    expect(jan.unusedMinutes).toBe(0);
  });

  it("zero hours month", () => {
    const config = makeConfig({ rolloverEnabled: false, startDate: "2025-03-01" });
    const result = computeRetainerMonths(config, new Map(), "2025-03");

    expect(result).toHaveLength(1);
    const march = result[0];
    expect(march.yearMonth).toBe("2025-03");
    expect(march.workedMinutes).toBe(0);
    expect(march.endBalance).toBe(600);
    expect(march.unusedMinutes).toBe(600);
  });
});

// ── Category grouping ──────────────────────────────────────────────

describe("groupTasksByCategory", () => {
  it("groups tasks by category", () => {
    const tasks: TaskRecord[] = [
      makeTask("2025-01-10", 120, {
        workCategoryId: "cat_design",
        workCategoryName: "Design",
      }),
      makeTask("2025-01-11", 60, {
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
      makeTask("2025-01-12", 180, {
        workCategoryId: "cat_design",
        workCategoryName: "Design",
      }),
    ];

    const groups = groupTasksByCategory(tasks);
    expect(groups).toHaveLength(2);

    const design = groups.find((g) => g.categoryName === "Design")!;
    expect(design.tasks).toHaveLength(2);
    expect(design.totalMinutes).toBe(300);

    const dev = groups.find((g) => g.categoryName === "Development")!;
    expect(dev.tasks).toHaveLength(1);
    expect(dev.totalMinutes).toBe(60);
  });

  it("puts uncategorized tasks last", () => {
    const tasks: TaskRecord[] = [
      makeTask("2025-01-10", 60),
      makeTask("2025-01-11", 60, {
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
    ];

    const groups = groupTasksByCategory(tasks);
    expect(groups[0].categoryName).toBe("Development");
    expect(groups[1].categoryName).toBe("Uncategorized");
  });

  it("sorts aggregated tasks within group by earliest date", () => {
    const tasks: TaskRecord[] = [
      makeTask("2025-01-15", 60, {
        taskId: "task_b",
        title: "Zeta task",
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
      makeTask("2025-01-10", 60, {
        taskId: "task_a",
        title: "Alpha task",
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
    ];

    const groups = groupTasksByCategory(tasks);
    expect(groups[0].tasks[0].title).toBe("Alpha task");
    expect(groups[0].tasks[0].earliestDate).toBe("2025-01-10");
    expect(groups[0].tasks[1].title).toBe("Zeta task");
    expect(groups[0].tasks[1].earliestDate).toBe("2025-01-15");
  });

  it("aggregates multiple time entries for the same task", () => {
    const tasks: TaskRecord[] = [
      makeTask("2025-01-10", 60, {
        taskId: "task_same",
        title: "Repeated task",
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
      makeTask("2025-01-11", 120, {
        taskId: "task_same",
        title: "Repeated task",
        workCategoryId: "cat_dev",
        workCategoryName: "Development",
      }),
    ];

    const groups = groupTasksByCategory(tasks);
    expect(groups[0].tasks).toHaveLength(1);
    expect(groups[0].tasks[0].totalMinutes).toBe(180);
    expect(groups[0].tasks[0].earliestDate).toBe("2025-01-10");
    expect(groups[0].totalMinutes).toBe(180);
  });
});

// ── Status tag ─────────────────────────────────────────────────────

describe("getStatusTag", () => {
  it("mid-cycle positive balance (rollover)", () => {
    const month = {
      endBalance: 300,
      isCycleEnd: false,
      extraMinutes: 0,
      unusedMinutes: 0,
    } as ComputedMonth;
    const tag = getStatusTag(month, true);
    expect(tag.label).toBe("+5h carries");
    expect(tag.variant).toBe("success");
  });

  it("mid-cycle negative balance (rollover)", () => {
    const month = {
      endBalance: -180,
      isCycleEnd: false,
      extraMinutes: 0,
      unusedMinutes: 0,
    } as ComputedMonth;
    const tag = getStatusTag(month, true);
    expect(tag.label).toBe("–3h carries");
    expect(tag.variant).toBe("destructive");
  });

  it("cycle end with extra (rollover)", () => {
    const month = {
      endBalance: -300,
      isCycleEnd: true,
      extraMinutes: 300,
      unusedMinutes: 0,
    } as ComputedMonth;
    const tag = getStatusTag(month, true);
    expect(tag.label).toBe("+5h · payment due");
    expect(tag.variant).toBe("destructive");
  });

  it("cycle end with unused (rollover)", () => {
    const month = {
      endBalance: 120,
      isCycleEnd: true,
      extraMinutes: 0,
      unusedMinutes: 120,
    } as ComputedMonth;
    const tag = getStatusTag(month, true);
    expect(tag.label).toBe("2h unused");
    expect(tag.variant).toBe("warning");
  });

  it("cycle end on budget (rollover)", () => {
    const month = {
      endBalance: 0,
      isCycleEnd: true,
      extraMinutes: 0,
      unusedMinutes: 0,
    } as ComputedMonth;
    const tag = getStatusTag(month, true);
    expect(tag.label).toBe("on budget");
    expect(tag.variant).toBe("success");
  });

  it("no rollover: over budget", () => {
    const month = {
      endBalance: -180,
      extraMinutes: 180,
      unusedMinutes: 0,
    } as ComputedMonth;
    const tag = getStatusTag(month, false);
    expect(tag.label).toBe("3h over");
    expect(tag.variant).toBe("destructive");
  });

  it("no rollover: unused", () => {
    const month = {
      endBalance: 240,
      extraMinutes: 0,
      unusedMinutes: 240,
    } as ComputedMonth;
    const tag = getStatusTag(month, false);
    expect(tag.label).toBe("4h unused");
    expect(tag.variant).toBe("warning");
  });
});

// ── Subtitle helpers ───────────────────────────────────────────────

describe("getStartedWithSubtitle", () => {
  it("no rollover", () => {
    const month = { startBalance: 0 } as ComputedMonth;
    expect(getStartedWithSubtitle(month, 10, false)).toBe("10h monthly budget");
  });

  it("cycle start", () => {
    const month = { isCycleStart: true, startBalance: 0 } as ComputedMonth;
    expect(getStartedWithSubtitle(month, 10, true)).toBe(
      "10h budget · cycle start",
    );
  });

  it("positive carry", () => {
    const month = {
      isCycleStart: false,
      startBalance: 180,
    } as ComputedMonth;
    expect(getStartedWithSubtitle(month, 10, true)).toBe(
      "10h budget + 3h from last month",
    );
  });

  it("negative carry", () => {
    const month = {
      isCycleStart: false,
      startBalance: -120,
    } as ComputedMonth;
    expect(getStartedWithSubtitle(month, 10, true)).toBe(
      "10h budget – 2h from last month",
    );
  });
});

describe("getEndingBalanceSubtitle", () => {
  it("mid-cycle positive (rollover)", () => {
    const month = { endBalance: 300, isCycleEnd: false } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, true)).toBe("Carries over");
  });

  it("mid-cycle negative (rollover)", () => {
    const month = { endBalance: -120, isCycleEnd: false } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, true)).toBe("Deducted next month");
  });

  it("cycle end positive (rollover)", () => {
    const month = { endBalance: 300, isCycleEnd: true } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, true)).toBe("Not carried over");
  });

  it("cycle end negative (rollover)", () => {
    const month = { endBalance: -120, isCycleEnd: true } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, true)).toBe("Payment due");
  });

  it("no rollover positive", () => {
    const month = { endBalance: 200 } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, false)).toBe("Not used");
  });

  it("no rollover negative", () => {
    const month = { endBalance: -120 } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, false)).toBe("Payment due");
  });

  it("zero balance at cycle end", () => {
    const month = { endBalance: 0, isCycleEnd: true } as ComputedMonth;
    expect(getEndingBalanceSubtitle(month, true)).toBe("No extra charges");
  });
});
