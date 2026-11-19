
import type {
  PlayerAction,
  Scenario,
  ServiceHealth,
  ServiceId,
  ServiceState,
  SimState,
} from "./types";

const SERVICE_IDS: ServiceId[] = [
  "web",
  "api",
  "db",
  "db-replica",
  "cache",
  "payments",
  "queue",
  "worker",
];

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function makeService(
  latencyMs: number,
  errorRate = 0,
  saturation = 0.2
): ServiceState {
  return {
    health: "healthy",
    latencyMs,
    errorRate,
    saturation,
  };
}

function updateHealth(service: ServiceState): void {
  const health: ServiceHealth =
    service.errorRate >= 0.8
      ? "down"
      : service.errorRate >= 0.1 ||
          service.saturation >= 0.85
        ? "degraded"
        : "healthy";

  service.health = health;
}

export function initialState(scenario: Scenario): SimState {
  if (scenario.fault !== "db_pool_exhaustion") {
    throw new Error(`Fault not implemented: ${scenario.fault}`);
  }

  const services = {} as Record<ServiceId, ServiceState>;

  for (const id of SERVICE_IDS) {
    services[id] = makeService(
      id === "db" ? 15 : id === "api" ? 40 : 20
    );
  }

  return {
    tick: 0,
    services,
    stableTicks: 0,
    mitigation: {
      poolRaised: false,
      rolledBack: false,
    },
    impact: {
      errorMinutes: 0,
      costUnits: 0,
    },
  };
}

export function step(
  state: SimState,
  scenario: Scenario,
  actionsThisTick: PlayerAction[]
): SimState {
  if (scenario.fault !== "db_pool_exhaustion") {
    throw new Error(`Fault not implemented: ${scenario.fault}`);
  }

  if (state.resolvedAtTick !== undefined || state.failed) {
    return state;
  }

  const tick = state.tick + 1;
  const services = structuredClone(state.services);
  const mitigation = { ...state.mitigation };

  let restartDb = false;
  let actionCost = 0;

  for (const action of actionsThisTick) {
    if (action.tick !== tick) continue;

    switch (action.type) {
      case "raise_pool_size":
        mitigation.poolRaised = true;
        actionCost += 5;
        break;

      case "rollback_deploy":
        mitigation.rolledBack = true;
        actionCost += 3;
        break;

      case "restart":
        if (action.target === "db") {
          restartDb = true;
          actionCost += 2;
        }
        break;
    }
  }

  const fixed = mitigation.poolRaised || mitigation.rolledBack;

  // Incident severity increases over six ticks.
  const severity = fixed ? 0 : Math.min(1, tick / 6);

  // Database connection pool exhaustion.
  const db = services.db;
  db.saturation = fixed ? 0.3 : 0.2 + severity * 0.78;
  db.latencyMs = 15 + severity * 800;
  db.errorRate = clamp(severity * 0.55);

  if (restartDb) {
    db.errorRate = 1;
    db.latencyMs = 2000;
    db.saturation = 1;
  }

  // Database problems spread to the API.
  const api = services.api;
  api.latencyMs = 40 + db.latencyMs * 0.8;
  api.errorRate = clamp(db.errorRate * 0.85);
  api.saturation = clamp(0.2 + severity * 0.65);

  // API failures affect the website.
  const web = services.web;
  web.latencyMs = 20 + api.latencyMs * 0.8;
  web.errorRate = clamp(api.errorRate * 0.9);
  web.saturation = clamp(0.2 + severity * 0.4);

  // Failed processing increases worker pressure.
  const worker = services.worker;
  worker.errorRate = clamp(db.errorRate * 0.7);
  worker.latencyMs = 30 + db.latencyMs * 0.5;
  worker.saturation = clamp(0.2 + severity * 0.5);

  const queue = services.queue;
  queue.latencyMs = 15 + worker.latencyMs * 0.5;
  queue.errorRate = clamp(worker.errorRate * 0.3);
  queue.saturation = clamp(0.2 + severity * 0.7);

  // Other services remain healthy.
  services["db-replica"] = makeService(20);
  services.cache = makeService(10);
  services.payments = makeService(50);

  for (const service of Object.values(services)) {
    updateHealth(service);
  }

  const stableTicks =
    fixed && web.errorRate < 0.05
      ? state.stableTicks + 1
      : 0;

  const resolved = stableTicks >= 3;

  return {
    tick,
    services,
    mitigation,
    stableTicks,
    resolvedAtTick: resolved ? tick : undefined,
    impact: {
      errorMinutes:
        state.impact.errorMinutes + web.errorRate * (3 / 60),
      costUnits: state.impact.costUnits + actionCost,
    },
  };
}
