
import { useEffect, useState } from "react";
import { getAuthToken } from "deepspace";
import type {
  ActionType,
  ServiceId,
  SimState,
} from "../engine/types";

const STORAGE_KEY = "crisislab-current-incident";

const serviceNames: Record<ServiceId, string> = {
  web: "Website",
  api: "API Server",
  db: "Database",
  "db-replica": "DB Replica",
  cache: "Cache",
  payments: "Payments",
  queue: "Queue",
  worker: "Worker",
};

const serviceIds = Object.keys(serviceNames) as ServiceId[];

interface IncidentData {
  incidentId: string;
  title: string;
  status: string;
  state: SimState;
  lastTick: number;
}

async function callBackend<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Please sign in first.");
  }

  const response = await fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const result = (await response.json()) as {
    success: boolean;
    data?: T;
    error?: string;
  };

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.error || `Request failed: ${response.status}`
    );
  }

  return result.data;
}

export default function IncidentDashboard() {
  const [incidentId, setIncidentId] = useState<string | null>(
    null
  );
  const [incident, setIncident] = useState<IncidentData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  async function loadIncident(id: string) {
    const data = await callBackend<IncidentData>(
      "getIncident",
      { incidentId: id }
    );

    setIncidentId(id);
    setIncident(data);
  }

  // Resume the previously saved incident after a refresh.
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);

    if (!savedId) return;

    let cancelled = false;

    async function restore() {
      setLoading(true);

      try {
        const data = await callBackend<IncidentData>(
          "getIncident",
          { incidentId: savedId }
        );

        if (!cancelled) {
          setIncidentId(savedId);
          setIncident(data);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY);
          setMessage(
            "Previous incident could not be loaded. Start a new one."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createIncident() {
    setLoading(true);
    setMessage("");

    try {
      const created = await callBackend<{
        incidentId: string;
      }>("createIncident");

      localStorage.setItem(
        STORAGE_KEY,
        created.incidentId
      );

      await loadIncident(created.incidentId);
      setHistory([]);
      setMessage("Incident created successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to create incident."
      );
    } finally {
      setLoading(false);
    }
  }

  async function advanceIncident() {
    if (!incidentId || loading) return;

    setLoading(true);
    setMessage("");

    try {
      await callBackend("advanceIncident", {
        incidentId,
      });

      await loadIncident(incidentId);

      setHistory(previous => [
        "Simulation advanced on the server.",
        ...previous,
      ]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to advance incident."
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyMitigation(actionType: ActionType) {
    if (!incidentId || loading) return;

    setLoading(true);
    setMessage("");

    try {
      await callBackend("applyMitigation", {
        incidentId,
        actionType,
      });

      await loadIncident(incidentId);

      setHistory(previous => [
        `Mitigation applied: ${actionType}`,
        ...previous,
      ]);

      setMessage("Mitigation saved to DeepSpace.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Mitigation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  const state = incident?.state;
  const resolved = incident?.status === "resolved";

  return (
    <main className="min-h-screen bg-[#080d18] p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-400">
              CRISISLAB
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Incident Command Center
            </h1>

            <p className="mt-2 text-slate-400">
              {incident?.title ??
                "Production Incident Response Simulator"}
            </p>
          </div>

          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${
            resolved
              ? "bg-emerald-900 text-emerald-300"
              : incident
                ? "bg-red-950 text-red-300"
                : "bg-slate-700 text-slate-200"
          }`}>
            {resolved
              ? "RESOLVED"
              : incident
                ? "INCIDENT ACTIVE"
                : "READY"}
          </span>
        </header>

        {message && (
          <div
            role="status"
            className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm"
          >
            {message}
          </div>
        )}

        {!incident ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <h2 className="text-2xl font-bold">
              Start Your Incident Simulation
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Investigate a simulated production outage,
              monitor infrastructure health, and apply
              mitigation strategies to restore service.
            </p>

            <button
              onClick={createIncident}
              disabled={loading}
              className="mt-6 rounded-lg bg-cyan-600 px-6 py-3 font-semibold disabled:opacity-40"
            >
              {loading ? "Loading..." : "Start Incident"}
            </button>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              {[
                ["Simulation Tick", String(state!.tick)],
                [
                  "Website Error Rate",
                  `${(state!.services.web.errorRate * 100).toFixed(1)}%`,
                ],
                [
                  "Website Latency",
                  `${Math.round(state!.services.web.latencyMs)} ms`,
                ],
                [
                  "Mitigation Cost",
                  String(state!.impact.costUnits),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <p className="text-sm text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold">
                Infrastructure Health
              </h2>

              <div className="grid gap-3 md:grid-cols-4">
                {serviceIds.map(id => {
                  const service = state!.services[id];

                  const color =
                    service.health === "healthy"
                      ? "text-emerald-400"
                      : service.health === "degraded"
                        ? "text-amber-400"
                        : "text-red-400";

                  return (
                    <div
                      key={id}
                      className="rounded-lg border border-slate-700 bg-slate-950 p-4"
                    >
                      <h3 className="font-semibold">
                        {serviceNames[id]}
                      </h3>

                      <p className={`mt-2 text-sm uppercase ${color}`}>
                        {service.health}
                      </p>

                      <p className="mt-3 text-sm text-slate-400">
                        Latency: {Math.round(service.latencyMs)} ms
                      </p>

                      <p className="text-sm text-slate-400">
                        Errors: {(service.errorRate * 100).toFixed(1)}%
                      </p>

                      <p className="text-sm text-slate-400">
                        Saturation: {(service.saturation * 100).toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-4 text-xl font-semibold">
                  Incident Controls
                </h2>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={advanceIncident}
                    disabled={loading || resolved}
                    className="rounded-lg bg-cyan-600 px-4 py-3 font-medium disabled:opacity-40"
                  >
                    Advance Tick
                  </button>

                  <button
                    onClick={() => applyMitigation("restart")}
                    disabled={loading || resolved}
                    className="rounded-lg bg-red-700 px-4 py-3 font-medium disabled:opacity-40"
                  >
                    Restart Database
                  </button>

                  <button
                    onClick={() => applyMitigation("raise_pool_size")}
                    disabled={loading || resolved}
                    className="rounded-lg bg-emerald-700 px-4 py-3 font-medium disabled:opacity-40"
                  >
                    Raise Pool Size
                  </button>

                  <button
                    onClick={() => applyMitigation("rollback_deploy")}
                    disabled={loading || resolved}
                    className="rounded-lg bg-violet-700 px-4 py-3 font-medium disabled:opacity-40"
                  >
                    Roll Back Deploy
                  </button>

                  <button
                    onClick={createIncident}
                    disabled={loading}
                    className="rounded-lg bg-slate-700 px-4 py-3 font-medium disabled:opacity-40"
                  >
                    New Incident
                  </button>
                </div>

                <p className="mt-4 text-sm text-slate-400">
                  All actions are validated and processed
                  by the DeepSpace backend.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-4 text-xl font-semibold">
                  Session Activity
                </h2>

                {history.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No actions recorded in this browser session.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((event, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-slate-950 p-3 text-sm"
                      >
                        {event}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {resolved && (
              <section className="rounded-xl border border-emerald-600 bg-emerald-950 p-5">
                <h2 className="text-xl font-bold text-emerald-300">
                  Incident Resolved
                </h2>
                <p className="mt-2 text-emerald-100">
                  The infrastructure recovered and remained
                  stable for three consecutive ticks.
                  Resolution tick: {state!.resolvedAtTick}.
                </p>
              </section>
            )}

            <p className="text-xs text-slate-500">
              Incident ID: {incidentId}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
