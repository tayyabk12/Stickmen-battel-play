# Security Specification — LastOneStanding

## 1. Data Invariants

1. **User Profile Ownership**: A `UserProfile` at `/users/{userId}` can only be read, created, or updated by `request.auth.uid == userId`. No PII is stored, and no `list` query is permitted.
2. **Private Rooms Only**: `/rooms/{roomId}` has NO `list` permission (preventing room scraping or public matchmaking). Only authenticated users who know the 4–8 char uppercase room code may `get` the room.
3. **Host Authority & Terminal State Locking**: Only `hostId` can mutate room zone state, start a match (`lobby` -> `playing`), or end a match (`playing` -> `ended`). Once `status == 'ended'`, no further updates are permitted on the room.
4. **Master Gate on Subcollections**: `/players`, `/pickups`, and `/hits` under `/rooms/{roomId}` validate parent room existence (`exists(/databases/$(database)/documents/rooms/$(roomId))`) on every single-document write. `allow list` validates `resource.data.roomId == roomId` directly without `get()`/`exists()` calls to prevent O(n) read amplification.
5. **Zero Cross-Player Overwrites**: A player can only create or update their own `/rooms/{roomId}/players/{playerId}` document (`playerId == request.auth.uid`). Combat hits are emitted as immutable events in `/rooms/{roomId}/hits/{hitId}` where `attackerId == request.auth.uid`.
6. **Strict Schema & Temporal Integrity**: Every string has explicit `.size()` limits, every ID is validated by `isValidId()`, every timestamp uses `request.time`, and every update uses `affectedKeys().hasOnly(...)` wrapped by `isValid[Entity](incoming())`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Room Read**: `get /rooms/A7K9M` with `auth == null`.
2. **Public Room List Scraping**: `list /rooms` as signed-in user.
3. **Shadow Ghost Field on UserProfile**: `create /users/uid1` with extra field `isAdmin: true`.
4. **Cross-User Profile Read**: `get /users/uid2` authenticated as `uid1`.
5. **Host Spoofing on Room Create**: `create /rooms/A7K9M` with `hostId: 'victim_uid'` as `uid1`.
6. **Client Timestamp Forgery**: `create /rooms/A7K9M` with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
7. **Terminal State Resurrection**: `update /rooms/A7K9M` changing `status` from `'ended'` back to `'playing'`.
8. **Non-Host Zone Manipulation**: `update /rooms/A7K9M` modifying `zoneRadius` as non-host `uid2`.
9. **Cross-Player Position/Health Overwrite**: `update /rooms/A7K9M/players/uid2` authenticated as `uid1`.
10. **Hit Attacker Spoofing**: `create /rooms/A7K9M/hits/h1` with `attackerId: 'uid2'` authenticated as `uid1`.
11. **Value Poisoning on Damage**: `create /rooms/A7K9M/hits/h2` with `damage: 99999` (exceeds max 45).
12. **ID Poisoning / 1.5KB Junk ID**: `create /rooms/AAAA...1500chars` or `displayName` exceeding 20 characters.
