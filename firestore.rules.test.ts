/**
 * Security Rules Specification Verification Suite (Dirty Dozen)
 * Documents and verifies the 12 adversarial payloads against LastOneStanding Firestore rules.
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  authUid: string | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByPillar: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Room Read',
    operation: 'get',
    path: '/rooms/A7K9M',
    authUid: null,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 10: Request Authentication Gate (isSignedIn())',
  },
  {
    id: 2,
    name: 'Public Room List Scraping',
    operation: 'list',
    path: '/rooms',
    authUid: 'user_attacker',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 8: Secure List Queries (rooms list explicitly denied)',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field on UserProfile',
    operation: 'create',
    path: '/users/user_attacker',
    authUid: 'user_attacker',
    payload: {
      userId: 'user_attacker',
      displayName: 'Hacker',
      color: '#EF4444',
      accessory: 'crown',
      wins: 0,
      matchesPlayed: 0,
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2: Validation Blueprint hasOnly() key check',
  },
  {
    id: 4,
    name: 'Cross-User Profile Read',
    operation: 'get',
    path: '/users/user_victim',
    authUid: 'user_attacker',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 6: Owner-only isolation on /users/{userId}',
  },
  {
    id: 5,
    name: 'Host Spoofing on Room Create',
    operation: 'create',
    path: '/rooms/A7K9M',
    authUid: 'user_attacker',
    payload: {
      roomId: 'A7K9M',
      hostId: 'user_victim',
      status: 'lobby',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2: Identity Integrity (incoming().hostId == request.auth.uid)',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/rooms/A7K9M',
    authUid: 'user_attacker',
    payload: {
      roomId: 'A7K9M',
      hostId: 'user_attacker',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 13: Temporal Integrity (incoming().createdAt == request.time)',
  },
  {
    id: 7,
    name: 'Terminal State Resurrection',
    operation: 'update',
    path: '/rooms/A7K9M',
    authUid: 'user_host',
    payload: {
      status: 'playing',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 4/6: Terminal State Lock (existing().status != "ended")',
  },
  {
    id: 8,
    name: 'Non-Host Zone Manipulation',
    operation: 'update',
    path: '/rooms/A7K9M',
    authUid: 'user_guest',
    payload: {
      zoneRadius: 10,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 4: Tiered Identity Logic (existing().hostId == request.auth.uid)',
  },
  {
    id: 9,
    name: 'Cross-Player Position/Health Overwrite',
    operation: 'update',
    path: '/rooms/A7K9M/players/user_victim',
    authUid: 'user_attacker',
    payload: {
      health: 0,
      status: 'downed',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 4: Owner-only player sync (playerId == request.auth.uid)',
  },
  {
    id: 10,
    name: 'Hit Attacker Spoofing',
    operation: 'create',
    path: '/rooms/A7K9M/hits/hit_001',
    authUid: 'user_attacker',
    payload: {
      hitId: 'hit_001',
      roomId: 'A7K9M',
      attackerId: 'user_victim',
      targetId: 'user_other',
      damage: 20,
      knockbackX: 50,
      knockbackY: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2: Identity Integrity (incoming().attackerId == request.auth.uid)',
  },
  {
    id: 11,
    name: 'Value Poisoning on Hit Damage',
    operation: 'create',
    path: '/rooms/A7K9M/hits/hit_002',
    authUid: 'user_attacker',
    payload: {
      hitId: 'hit_002',
      roomId: 'A7K9M',
      attackerId: 'user_attacker',
      targetId: 'user_victim',
      damage: 99999,
      knockbackX: 0,
      knockbackY: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2: Validation Blueprint bounds (damage >= 1 && damage <= 45)',
  },
  {
    id: 12,
    name: 'ID Poisoning / Oversized Name',
    operation: 'create',
    path: `/users/${'A'.repeat(200)}`,
    authUid: 'user_attacker',
    payload: {
      userId: 'user_attacker',
      displayName: 'X'.repeat(500),
      color: '#EF4444',
      accessory: 'none',
      wins: 0,
      matchesPlayed: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 3: Path Variable Hardening (isValidId) & String Size Enforcement',
  },
];
