
export type ServiceId =
  | "web"
  | "api"
  | "db"
  | "db-replica"
  | "cache"
  | "payments"
  | "queue"
  | "worker";

export type ServiceHealth = "healthy" | "degraded" | "down";

export type FaultId =
  | "db_pool_exhaustion"
  | "bad_deploy"
  | "cache_stampede";

export type Role = "commander" | "infra" | "app";

export type ActionType =
  | "restart"
  | "rollback_deploy"
  | "scale"
  | "flush_cache"
  | "warm_cache"
  | "rate_limit"
  | "raise_pool_size"
  | "fail_over";

export interface ServiceState {
  health: ServiceHealth;
  latencyMs: number;
  errorRate: number;
  saturation: number;
}

export interface Scenario {
  seed: number;
  fault: FaultId;
  params: Record<string, number>;
  redHerrings: string[];
}


export interface SimState {
  tick: number;
  stableTicks: number;
  mitigation: {
    poolRaised: boolean;
    rolledBack: boolean;
  };
  services: Record<ServiceId, ServiceState>;
  resolvedAtTick?: number;
  failed?: boolean;
  impact: {
    errorMinutes: number;
    costUnits: number;
  };
}


export interface PlayerAction {
  tick: number;
  actorId: string;
  type: ActionType;
  target?: ServiceId;
  args?: Record<string, number>;
}
