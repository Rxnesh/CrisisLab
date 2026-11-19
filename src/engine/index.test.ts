
import { describe, expect, it } from "vitest";
import { initialState, step } from "./index";
import type { Scenario, SimState } from "./types";

const scenario: Scenario = {
  seed: 42,
  fault: "db_pool_exhaustion",
  params: {},
  redHerrings: [],
};

function advance(state: SimState, ticks: number): SimState {
  let current = state;

  for (let i = 0; i < ticks; i++) {
    current = step(current, scenario, []);
  }

  return current;
}

describe("CrisisLab Simulation Engine", () => {
  it("initializes all eight services", () => {
    const state = initialState(scenario);

    expect(Object.keys(state.services)).toHaveLength(8);
    expect(state.tick).toBe(0);
    expect(state.services.db.health).toBe("healthy");
  });

  it("propagates database failures to the API and web", () => {
    const state = advance(initialState(scenario), 6);

    expect(state.services.db.errorRate).toBeGreaterThan(0.5);
    expect(state.services.api.errorRate).toBeGreaterThan(0.2);
    expect(state.services.web.errorRate).toBeGreaterThan(0.2);
    expect(state.services.web.latencyMs).toBeGreaterThan(100);
  });

  it("does not permanently fix the problem by restarting DB", () => {
    let state = advance(initialState(scenario), 3);

    state = step(state, scenario, [
      {
        tick: 4,
        actorId: "tester",
        type: "restart",
        target: "db",
      },
    ]);

    expect(state.services.db.health).toBe("down");

    state = advance(state, 3);

    expect(state.services.db.errorRate).toBeGreaterThan(0.2);
    expect(state.resolvedAtTick).toBeUndefined();
  });

  it("resolves after raising the connection pool size", () => {
    let state = advance(initialState(scenario), 6);

    state = step(state, scenario, [
      {
        tick: 7,
        actorId: "tester",
        type: "raise_pool_size",
        target: "db",
      },
    ]);

    state = advance(state, 2);

    expect(state.mitigation.poolRaised).toBe(true);
    expect(state.services.web.errorRate).toBeLessThan(0.05);
    expect(state.resolvedAtTick).toBe(9);
  });

  it("produces deterministic results", () => {
    const first = advance(initialState(scenario), 10);
    const second = advance(initialState(scenario), 10);

    expect(first).toEqual(second);
  });
});
