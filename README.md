
# CrisisLab

**A full-stack, multiplayer incident-response simulator built with DeepSpace.**

CrisisLab simulates production infrastructure failures and lets authenticated users investigate incidents, monitor service health, and collaborate on recovery decisions through shared War Rooms.

🌐 **Live Application:** https://crisislab.app.space

## Overview

CrisisLab models a database connection pool exhaustion incident affecting eight interconnected services. Users can monitor latency, error rates, and infrastructure health as the simulation progresses.

The application includes a collaborative incident-response workflow where a Host manages the simulation and Participants submit mitigation requests for review.

## Key Features

### Incident Simulation
- Deterministic simulation engine
- Database connection pool exhaustion scenario
- Eight interconnected infrastructure services
- Dynamic service latency, error rates, and saturation
- Simulation ticks, mitigation costs, and recovery tracking
- Incident resolution after sustained recovery

### Multiplayer War Rooms
- Google authentication
- Private War Rooms with invitation codes
- Host and Participant roles
- Shared incident state persisted in DeepSpace
- Automatic dashboard synchronization every two seconds

### Collaborative Mitigation Workflow
1. A Host creates an incident and War Room.
2. A Participant joins using an invitation code.
3. The Participant submits a mitigation request.
4. The Host reviews and approves or rejects the request.
5. The Host executes an approved mitigation.
6. Both accounts receive the updated incident state.

### Available Mitigations
- Restart Database
- Raise Database Connection Pool Size
- Roll Back Deployment

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React | Interactive dashboard |
| TypeScript | Frontend and backend logic |
| DeepSpace | Application platform and deployment |
| Hono | Backend HTTP routing |
| Durable Objects | Persistent application records |
| Tailwind CSS | User interface styling |
| Vitest | Automated simulation tests |
| Git & GitHub | Version control |

## Architecture

CrisisLab separates simulation logic, backend operations, and the user interface.

**Simulation Engine**

The deterministic engine models infrastructure health and calculates the effects of simulation ticks and mitigation actions.

**Backend**

Authenticated DeepSpace server actions handle incident creation, War Room membership, authorization, mitigation requests, and simulation updates.

**Persistence**

DeepSpace collections store incidents, simulation states, War Room membership, and mitigation requests.

**Frontend**

The React dashboard displays infrastructure metrics, incident controls, collaboration roles, and mitigation approval workflows.

**Synchronization**

Authenticated clients poll the backend every two seconds to retrieve shared incident updates.

## Project Structure

```text
CrisisLab/
├── src/
│   ├── actions/       # Backend server actions
│   ├── components/    # React dashboard
│   ├── engine/        # Incident simulation logic
│   ├── schemas/       # Database collection schemas
│   └── server/        # HTTP and realtime infrastructure
├── tests/             # Automated tests
├── public/            # Static assets
├── worker.ts          # DeepSpace worker configuration
└── package.json
```

## Running Locally

Clone the repository:

```bash
git clone https://github.com/Rxnesh/CrisisLab.git
cd CrisisLab
```

Install dependencies:

```bash
npm install
```

Configure the required DeepSpace development credentials and environment variables according to the platform's setup instructions.

Start the development server:

```bash
npx deepspace dev start
```

Open http://localhost:5173.

Check TypeScript:

```bash
npx tsc --noEmit
```

Run automated tests:

```bash
npx vitest run
```

## Testing

CrisisLab includes automated simulation-engine tests and has been manually tested using two authenticated Google accounts.

The multiplayer workflow was verified both locally and on the deployed application, including:

- War Room creation and joining
- Host and Participant permissions
- Mitigation request submission
- Host approval and execution
- Shared simulation updates across both accounts
- Persistent incident state

## Engineering Tradeoffs

CrisisLab uses a Host-controlled incident model to limit conflicting modifications. The backend validates ownership, request status, and expected simulation ticks.

Synchronization currently uses periodic polling rather than WebSocket-based state updates.

The implementation includes basic safeguards against stale or repeated actions, but atomic exactly-once execution and transaction recovery are future improvements.

## Future Improvements

- Atomic concurrency control for incident updates
- WebSocket-based real-time synchronization
- Shared incident activity history
- Additional infrastructure failure scenarios
- Automated end-to-end multiplayer tests
- Expanded incident analytics

## AI-Assisted Development

AI coding assistance was used during development to help scaffold components, troubleshoot TypeScript errors, refine backend integrations, and iterate on the multiplayer workflow.

Implementation changes were validated through TypeScript checks, automated simulation tests, and manual two-account testing.

## Live Demo

**https://crisislab.app.space**

Built with DeepSpace.
