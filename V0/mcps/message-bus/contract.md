# MCP Contract: Message Bus

## Identity
- **Name**: message-bus
- **Type**: Infrastructure
- **Domain**: Inter-MCP Communication
- **Version**: 2.1.0

## Authority
- **Governance**: POLICY 008 (MCP Message Bus)
- **Execution Class**: Declarative (routing only, no state mutation)

## Responsibility

### Allowed
- Route typed messages between registered MCPs
- Validate messages against approved patterns
- Log all messages (delivered, rejected, errors)
- Detect and prevent circular communication
- Provide message history queries

### Forbidden
- Modify message payloads
- Generate messages autonomously (only routes)
- Write to /policy or /baseline
- Override MCP authority boundaries
- Deliver unapproved message patterns

### Never Do
- Execute code based on message content
- Store sensitive data in message logs
- Bypass validation for any reason

## Inputs/Outputs
- **Input**: MCPMessage { from, to, type, payload, gate, directive }
- **Output**: MessageResult { status, reason, response }

## Tools
- `send_message` — Route a message between MCPs
- `get_message_history` — Query message log
- `get_registered_mcps` — List MCPs and patterns

## Dependencies
- intent-logger (for audit trail)
- All registered MCPs (routing targets)

## Message Types
- SENDS: None (router only)
- RECEIVES: All message types (for routing)
- REFUSES: None (validates and routes or rejects)
