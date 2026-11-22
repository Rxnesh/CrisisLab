
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
  memberIds?: string[];
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

    
const isOwner = incident.ownerId === userId;

const isMember =
  Array.isArray(incident.memberIds) &&
  incident.memberIds.includes(userId);

if (!isOwner && !isMember) {
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
        isHost: incident.ownerId === userId,
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


const expectedTick = params.expectedTick;

if (
  typeof expectedTick !== "number" ||
  !Number.isInteger(expectedTick) ||
  expectedTick < 0
) {
  return {
    success: false,
    error: "Valid expected tick required",
  };
}

if (incident.state.tick !== expectedTick) {
  return {
    success: false,
    error: "Incident changed. Refresh and try again.",
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


const expectedTick = params.expectedTick;

if (
  typeof expectedTick !== "number" ||
  !Number.isInteger(expectedTick) ||
  expectedTick < 0
) {
  return {
    success: false,
    error: "Valid expected tick required",
  };
}

if (incident.state.tick !== expectedTick) {
  return {
    success: false,
    error: "Incident changed. Refresh and try again.",
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



  // Create a private multiplayer War Room
  createWarRoom: async ({ userId, params, tools }) => {
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
      roomCode?: string;
      memberIds?: string[];
    }>("incidents", incidentId);

    if (!result.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = result.data.record.data;

    // Only the incident owner can create the room.
    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Access denied",
      };
    }

    // Reuse an existing invitation if one was created.
    const roomCode =
      incident.roomCode ||
      crypto.randomUUID().replace(/-/g, "");

    const memberIds = Array.from(
      new Set([...(incident.memberIds ?? []), userId])
    );

    const updated = await tools.update(
      "incidents",
      incidentId,
      {
        roomCode,
        memberIds,
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
        roomCode,
        memberCount: memberIds.length,
      },
    };
  },



  // Join an existing multiplayer War Room
  joinWarRoom: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const roomCode = params.roomCode;

    if (
      typeof roomCode !== "string" ||
      !/^[a-f0-9]{32}$/.test(roomCode)
    ) {
      return {
        success: false,
        error: "Invalid invitation code",
      };
    }

    // Find the incident with this invitation code.
    const found = await tools.query<{
      ownerId: string;
      roomCode?: string;
      memberIds?: string[];
      title: string;
    }>("incidents", {
      where: { roomCode },
      limit: 2,
    });

    if (!found.success) {
      return {
        success: false,
        error: "Unable to find War Room",
      };
    }

    if (found.data.records.length !== 1) {
      return {
        success: false,
        error: "Invalid or unavailable War Room",
      };
    }

    const record = found.data.records[0];
    const incident = record.data;
    const incidentId = record.recordId;

    // Add the verified user without duplicating members.
    const memberIds = Array.from(
      new Set([
        incident.ownerId,
        ...(Array.isArray(incident.memberIds)
          ? incident.memberIds
          : []),
        userId,
      ])
    );

    const updated = await tools.update(
      "incidents",
      incidentId,
      { memberIds }
    );

    if (!updated.success) {
      return {
        success: false,
        error: "Failed to join War Room",
      };
    }

    return {
      success: true,
      data: {
        incidentId,
        title: incident.title,
        memberCount: memberIds.length,
        joined: true,
      },
    };
  },


  // Submit a mitigation request from a War Room member
  requestMitigation: async ({ userId, params, tools }) => {
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
      !incidentId.trim()
    ) {
      return {
        success: false,
        error: "Valid incident ID required",
      };
    }

    const allowedActions = [
      "restart",
      "raise_pool_size",
      "rollback_deploy",
    ];

    if (
      typeof actionType !== "string" ||
      !allowedActions.includes(actionType)
    ) {
      return {
        success: false,
        error: "Invalid mitigation action",
      };
    }

    const result = await tools.get<{
      ownerId: string;
      memberIds?: string[];
      roomCode?: string;
      status: string;
    }>("incidents", incidentId);

    if (!result.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = result.data.record.data;

    const isMember =
      incident.ownerId === userId ||
      (Array.isArray(incident.memberIds) &&
        incident.memberIds.includes(userId));

    if (!incident.roomCode || !isMember) {
      return {
        success: false,
        error: "You are not a member of this War Room",
      };
    }

    if (incident.status !== "active") {
      return {
        success: false,
        error: "Incident is no longer active",
      };
    }

    const created = await tools.create(
      "mitigationRequests",
      {
        incidentId,
        requestedBy: userId,
        actionType,
        status: "pending",
        createdAt: new Date().toISOString(),
      }
    );

    if (!created.success) {
      return {
        success: false,
        error: created.error,
      };
    }

    return {
      success: true,
      data: {
        requestId: created.data.recordId,
        actionType,
        status: "pending",
      },
    };
  },

  
  // Retrieve pending mitigation requests for the incident host
  getMitigationRequests: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const incidentId = params.incidentId;

    if (
      typeof incidentId !== "string" ||
      !incidentId.trim()
    ) {
      return {
        success: false,
        error: "Valid incident ID required",
      };
    }

    const found = await tools.get<{
      ownerId: string;
    }>("incidents", incidentId);

    if (!found.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    if (found.data.record.data.ownerId !== userId) {
      return {
        success: false,
        error: "Only the incident host can view requests",
      };
    }

    
const requests = await tools.query<{
  incidentId: string;
  requestedBy: string;
  actionType: string;
  status: string;
  createdAt: string;
}>("mitigationRequests", {
  where: {
    incidentId,
  },
  limit: 100,
});


    if (!requests.success) {
      return {
        success: false,
        error: "Unable to load mitigation requests",
      };
    }

    return {
      success: true,
      data: {
        requests: requests.data.records.map((record) => ({
          requestId: record.recordId,
          requestedBy: record.data.requestedBy,
          actionType: record.data.actionType,
          status: record.data.status,
          createdAt: record.data.createdAt,
        })),
      },
    };
  },


  // Allow the incident host to reject a mitigation request
  rejectMitigationRequest: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const requestId = params.requestId;

    if (
      typeof requestId !== "string" ||
      !requestId.trim()
    ) {
      return {
        success: false,
        error: "Valid request ID required",
      };
    }

    const requestResult = await tools.get<{
      incidentId: string;
      requestedBy: string;
      actionType: string;
      status: string;
    }>("mitigationRequests", requestId);

    if (!requestResult.success) {
      return {
        success: false,
        error: "Mitigation request not found",
      };
    }

    const request = requestResult.data.record.data;

    const incidentResult = await tools.get<{
      ownerId: string;
    }>("incidents", request.incidentId);

    if (!incidentResult.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    if (incidentResult.data.record.data.ownerId !== userId) {
      return {
        success: false,
        error: "Only the host can reject requests",
      };
    }

    if (request.status !== "pending") {
      return {
        success: false,
        error: "Request has already been processed",
      };
    }

    const updated = await tools.update(
      "mitigationRequests",
      requestId,
      {
        status: "rejected",
      }
    );

    if (!updated.success) {
      return {
        success: false,
        error: "Failed to reject mitigation request",
      };
    }

    return {
      success: true,
      data: {
        requestId,
        status: "rejected",
      },
    };
  },


  // Host approves a request without executing the mitigation yet
  approveMitigationRequest: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const requestId = params.requestId;

    if (
      typeof requestId !== "string" ||
      !requestId.trim()
    ) {
      return {
        success: false,
        error: "Valid request ID required",
      };
    }

    const requestResult = await tools.get<{
      incidentId: string;
      actionType: string;
      status: string;
    }>("mitigationRequests", requestId);

    if (!requestResult.success) {
      return {
        success: false,
        error: "Mitigation request not found",
      };
    }

    const request = requestResult.data.record.data;

    const incidentResult = await tools.get<{
      ownerId: string;
      status: string;
    }>("incidents", request.incidentId);

    if (!incidentResult.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = incidentResult.data.record.data;

    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Only the Host can approve requests",
      };
    }

    if (incident.status !== "active") {
      return {
        success: false,
        error: "Incident is no longer active",
      };
    }

    if (request.status !== "pending") {
      return {
        success: false,
        error: "Request has already been processed",
      };
    }

    const updated = await tools.update(
      "mitigationRequests",
      requestId,
      {
        status: "approved",
      }
    );

    if (!updated.success) {
      return {
        success: false,
        error: "Failed to approve mitigation request",
      };
    }

    return {
      success: true,
      data: {
        requestId,
        actionType: request.actionType,
        status: "approved",
      },
    };
  },



  // Execute an approved mitigation request
  executeApprovedMitigation: async ({ userId, params, tools }) => {
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const requestId = params.requestId;
    const expectedTick = params.expectedTick;

    if (typeof requestId !== "string" || !requestId.trim()) {
      return {
        success: false,
        error: "Valid request ID required",
      };
    }

    if (
      typeof expectedTick !== "number" ||
      !Number.isInteger(expectedTick) ||
      expectedTick < 0
    ) {
      return {
        success: false,
        error: "Valid expected tick required",
      };
    }

    const requestResult = await tools.get<{
      incidentId: string;
      actionType: string;
      status: string;
    }>("mitigationRequests", requestId);

    if (!requestResult.success) {
      return {
        success: false,
        error: "Mitigation request not found",
      };
    }

    const request = requestResult.data.record.data;

    if (
      request.status !== "approved" ||
      (request.actionType !== "restart" &&
        request.actionType !== "raise_pool_size" &&
        request.actionType !== "rollback_deploy")
    ) {
      return {
        success: false,
        error: "Request is not approved or action is invalid",
      };
    }

    const incidentResult = await tools.get<{
      ownerId: string;
      status: string;
      scenario: Scenario;
      state: ReturnType<typeof initialState>;
    }>("incidents", request.incidentId);

    if (!incidentResult.success) {
      return {
        success: false,
        error: "Incident not found",
      };
    }

    const incident = incidentResult.data.record.data;

    if (incident.ownerId !== userId) {
      return {
        success: false,
        error: "Only the Host can execute mitigations",
      };
    }

    if (incident.status !== "active") {
      return {
        success: false,
        error: "Incident is no longer active",
      };
    }

    if (incident.state.tick !== expectedTick) {
      return {
        success: false,
        error: "Incident changed. Refresh and try again.",
      };
    }

    // Record that execution has begun.
    const claimed = await tools.update(
      "mitigationRequests",
      requestId,
      { status: "executing" }
    );

    if (!claimed.success) {
      return {
        success: false,
        error: "Failed to begin mitigation execution",
      };
    }

    const target =
      request.actionType === "rollback_deploy" ? "api" : "db";

    const nextState = step(
      incident.state,
      incident.scenario,
      [
        {
          tick: incident.state.tick + 1,
          actorId: userId,
          type: request.actionType,
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

    const updated = await tools.update(
      "incidents",
      request.incidentId,
      {
        state: nextState,
        lastTick: nextState.tick,
        status,
      }
    );

    if (!updated.success) {
      return {
        success: false,
        error: "Incident update failed. Request needs review.",
      };
    }

    const completed = await tools.update(
      "mitigationRequests",
      requestId,
      { status: "executed" }
    );

    if (!completed.success) {
      return {
        success: false,
        error: "Incident updated, but request status needs review.",
      };
    }

    return {
      success: true,
      data: {
        requestId,
        incidentId: request.incidentId,
        status: "executed",
        tick: nextState.tick,
      },
    };
  },



};



