# Phase 1 — Execution Overview

Five prompts, executed in sequence. Each builds on the prior commit.

| Prompt | File | What It Produces |
|--------|------|------------------|
| **1A** | `phase-1a-types-prompt.md` | GameState, Command, Protocol types + condition constants |
| **1B** | *(after 1A completes)* | Element decay, turn order engine, utility functions |
| **1C** | *(after 1B completes)* | applyCommand + validateCommand engine, GHS import/export |
| **1D** | *(after 1C completes)* | Express server, WebSocket hub, sessions, SQLite store |
| **1E** | *(after 1D completes)* | Command handler wiring, import endpoint, integration test |

## Workflow

1. Paste **1A** prompt into Claude Code → execute → report commit hash here
2. Update this project with new files
3. I generate **1B** prompt referencing the completed types
4. Repeat until 1E is committed

## What Phase 1 Delivers

A running Node.js server on port 3000 that:
- Accepts WebSocket connections with game code
- Issues session tokens for reconnection
- Receives typed commands, validates, applies via shared engine
- Persists game state to SQLite
- Broadcasts diffs to all connected clients
- Handles reconnection with missed-diff replay
- Heartbeat ping/pong with 15s interval
- Serves static files from `clients/` and `assets/`
- Imports GHS JSON saves via POST /api/import

No client UI yet — that's Phase 2-4. But the server is fully testable via
`wscat` or a quick script that connects and sends commands.
