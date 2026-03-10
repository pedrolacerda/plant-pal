import { describe, it, expect } from "vitest";
import { generateCareTasks } from "@/lib/plantCare";
import type { Plant } from "@/lib/plantCare";

describe("careAmounts in tasks", () => {
  const basePlant: Plant = {
    id: "1",
    name: "Samambaia",
    light: "medium",
    createdAt: new Date().toISOString(),
    careIntervals: { water: 4, fertilize: 21, spray: 7 },
  };

  it("tasks have no amount when careAmounts is not set", () => {
    const tasks = generateCareTasks(basePlant, 10);
    tasks.forEach((task) => {
      expect(task.amount).toBeUndefined();
    });
  });

  it("water tasks include water amount when careAmounts.water is set", () => {
    const plant: Plant = { ...basePlant, careAmounts: { water: 250 } };
    const tasks = generateCareTasks(plant, 10);
    const waterTasks = tasks.filter((t) => t.type === "water");
    expect(waterTasks.length).toBeGreaterThan(0);
    waterTasks.forEach((task) => {
      expect(task.amount).toBe(250);
    });
  });

  it("fertilize tasks include fertilizer amount when careAmounts.fertilizer is set", () => {
    const plant: Plant = { ...basePlant, careAmounts: { fertilizer: 100 } };
    const tasks = generateCareTasks(plant, 60);
    const fertilizeTasks = tasks.filter((t) => t.type === "fertilize");
    expect(fertilizeTasks.length).toBeGreaterThan(0);
    fertilizeTasks.forEach((task) => {
      expect(task.amount).toBe(100);
    });
  });

  it("spray tasks never carry an amount", () => {
    const plant: Plant = { ...basePlant, careAmounts: { water: 200, fertilizer: 80 } };
    const tasks = generateCareTasks(plant, 10);
    const sprayTasks = tasks.filter((t) => t.type === "spray");
    expect(sprayTasks.length).toBeGreaterThan(0);
    sprayTasks.forEach((task) => {
      expect(task.amount).toBeUndefined();
    });
  });

  it("both water and fertilizer amounts are set correctly together", () => {
    const plant: Plant = { ...basePlant, careAmounts: { water: 300, fertilizer: 150 } };
    const tasks = generateCareTasks(plant, 60);

    const waterTasks = tasks.filter((t) => t.type === "water");
    const fertilizeTasks = tasks.filter((t) => t.type === "fertilize");

    waterTasks.forEach((task) => expect(task.amount).toBe(300));
    fertilizeTasks.forEach((task) => expect(task.amount).toBe(150));
  });
});
