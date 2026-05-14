# Message Bus MCP

Central router for inter-MCP communication in Vibe Coding OS V2.1.

## Purpose
Enables MCPs to send typed, validated messages to each other for pipeline coordination. All messages are logged for traceability.

## Governed By
- POLICY 008 — MCP Message Bus

## Tools
- `send_message` — Route a message between MCPs
- `get_message_history` — Query message history
- `get_registered_mcps` — List registered MCPs and patterns

## Usage
```
Message Bus validates → routes → logs
Rejected messages return error with reason
All messages appear in /memory/logs/execution/
```
