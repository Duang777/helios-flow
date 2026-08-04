# Test Scenario: helios CLI Passthrough

## Test ID
TC-DOCKER-006

## Category
Docker Command Parity

## Priority
Medium

## Description
Verify that `yarn docker:helios <subcommand>` correctly forwards any subcommand and its arguments into the running container, providing full CLI parity for Windows users.

## Prerequisites
- Dev stack is running (`yarn docker:dev:up` completed successfully)

## Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `yarn docker:helios --help` | CLI help output printed from inside the container |
| 2 | Run `yarn docker:helios eject --list` | List of ejectable modules printed from container |
| 3 | Run `yarn docker:helios test:integration:coverage` | Integration coverage check runs inside container |
| 4 | Verify each command exits with code 0 | All commands complete without error |

## Expected Results
- All subcommands are forwarded verbatim into the container
- Output is streamed directly to the host terminal (no buffering)
- Exit code from container command is propagated to the host shell

## Edge Cases / Error Scenarios
- `yarn docker:helios unknown-command` should exit with a non-zero code and print the CLI's own "unknown command" error (not a wrapper error)
- Subcommands with multiple arguments (e.g. `yarn docker:helios eject currencies`) should forward all args correctly
