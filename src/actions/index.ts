
import type { ActionHandler } from "deepspace/worker";
import type { Env } from "../../worker";

import { initialState, step } from "../engine";
import type { Scenario } from "../engine/types";

export const actions: Record<string, ActionHandler<Env>> = {

  // Test the simulation engine on the DeepSpace backend
  testSimulation: async ({ userId }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const scenario: Scenario = {
      seed: 42,
      fault: "db_pool_exhaustion",
      params: {},
      redHerrings: [],
    };

    let state = initialState(scenario);

    // Simulate six ticks of database degradation.
    for (let i = 0; i < 6; i++) {
      state = step(state, scenario, []);
    }

    return {
      success: true,
      data: {
        tick: state.tick,
        database: state.services.db,
        api: state.services.api,
        website: state.services.web,
      },
    };
  },

  // Create and save a new incident in DeepSpace
  createIncident: async ({ userId, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const scenario: Scenario = {
      seed: 42,
      fault: "db_pool_exhaustion",
      params: {},
      redHerrings: [],
    };

    const state = initialState(scenario);

    const created = await tools.create("incidents", {
      ownerId: userId,
      title: "Database Connection Pool Exhaustion",
      status: "active",
      scenario,
      state,
      lastTick: 0,
    });

    if (!created.success) {
      return {
        success: false,
        error: created.error,
      };
    }

    return {
      success: true,
      data: {
        incidentId: created.data.recordId,
        status: "active",
        tick: state.tick,
      },
    };
  },





  getIncident: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const incidentId = params.incidentId;

    if (
      typeof incidentId !== "string" ||
      incidentId.length === 0
    ) {
      return {
        success: false,
        error: "Valid incident ID required",
      };
    }

    const result = await tools.get<{
      ownerId: string;
      title: string;
      status: string;
      state: Record<string, unknown>;
      lastTick: number;
    }>("incidents", incidentId);

    if (!result.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = result.data.record.data;

    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Access denied",
      };
    }

    return {
      success: true,
      data: {
        incidentId,
        title: incident.title,
        status: incident.status,
        state: incident.state,
        lastTick: incident.lastTick,
      },
    };
  },




  // Advance and save an incident on the backend
  advanceIncident: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const incidentId = params.incidentId;

    if (
      typeof incidentId !== "string" ||
      incidentId.length === 0
    ) {
      return {
        success: false,
        error: "Valid incident ID required",
      };
    }

    const result = await tools.get<{
      ownerId: string;
      status: string;
      scenario: Scenario;
      state: ReturnType<typeof initialState>;
      lastTick: number;
    }>("incidents", incidentId);

    if (!result.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = result.data.record.data;

    // Only the owner can advance this incident.
    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Access denied",
      };
    }

    if (incident.status !== "active") {
      return {
        success: false,
        error: "Incident is no longer active",
      };
    }

    // Run one simulation tick on the server.
    const nextState = step(
      incident.state,
      incident.scenario,
      []
    );

    const status =
      nextState.resolvedAtTick !== undefined
        ? "resolved"
        : nextState.failed
          ? "failed"
          : "active";

    // Save the new simulation state.
    const updated = await tools.update(
      "incidents",
      incidentId,
      {
        state: nextState,
        lastTick: nextState.tick,
        status,
      }
    );

    if (!updated.success) {
      return {
        success: false,
        error: updated.error,
      };
    }

    return {
      success: true,
      data: {
        incidentId,
        tick: nextState.tick,
        status,
        services: nextState.services,
        impact: nextState.impact,
      },
    };
  },





  // Apply a mitigation and save the incident state
  applyMitigation: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const incidentId = params.incidentId;
    const actionType = params.actionType;

    if (
      typeof incidentId !== "string" ||
      incidentId.length === 0
    ) {
      return {
        success: false,
        error: "Valid incident ID required",
      };
    }

    // Only allow the three supported repair actions.
    if (
      actionType !== "restart" &&
      actionType !== "raise_pool_size" &&
      actionType !== "rollback_deploy"
    ) {
      return {
        success: false,
        error: "Invalid mitigation action",
      };
    }

    const result = await tools.get<{
      ownerId: string;
      status: string;
      scenario: Scenario;
      state: ReturnType<typeof initialState>;
      lastTick: number;
    }>("incidents", incidentId);

    if (!result.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = result.data.record.data;

    // Verify the user owns this incident.
    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Access denied",
      };
    }

    if (incident.status !== "active") {
      return {
        success: false,
        error: "Incident is no longer active",
      };
    }

    const target =
      actionType === "rollback_deploy" ? "api" : "db";

    // Execute the repair on the next simulation tick.
    const nextState = step(
      incident.state,
      incident.scenario,
      [
        {
          tick: incident.state.tick + 1,
          actorId: userId,
          type: actionType,
          target,
        },
      ]
    );

    const status =
      nextState.resolvedAtTick !== undefined
        ? "resolved"
        : nextState.failed
          ? "failed"
          : "active";

    // Persist the updated simulation.
    const updated = await tools.update(
      "incidents",
      incidentId,
      {
        state: nextState,
        lastTick: nextState.tick,
        status,
      }
    );

    if (!updated.success) {
      return {
        success: false,
        error: updated.error,
      };
    }

    return {
      success: true,
      data: {
        incidentId,
        action: actionType,
        tick: nextState.tick,
        status,
        services: nextState.services,
        impact: nextState.impact,
        mitigation: nextState.mitigation,
        resolvedAtTick: nextState.resolvedAtTick,
      },
    };
  },
};



