# Testing Guide - TourFile Generator

## Overview

This project uses **Vitest** for unit testing with a mock Firestore implementation. Tests run automatically on every `git push` via GitHub Actions, and can also be run locally.

**Key principle:** Unit tests DO NOT consume Firestore reads. All tests use in-memory mocks.

---

## Running Tests Locally

### Prerequisites
Make sure dependencies are installed:
```bash
npm install
```

### Run all tests (headless mode)
```bash
npm run test:unit
```

Expected output:
```
✓ src/__tests__/unit/serviceOrder.mocked.test.ts (3)
✓ src/__tests__/unit/cache.test.ts (2)

Test Files  2 passed (2)
Tests  5 passed (5)
```

### Run tests with interactive UI
```bash
npm run test:ui
```

This opens a browser-based test runner where you can:
- See test results in real-time
- Filter tests by name
- Watch files for changes and re-run tests automatically

---

## How Tests Run on Git Push

Every time you push to `main` or `develop` branches (or open a PR), GitHub Actions automatically:

1. **Checks out** your code
2. **Installs** dependencies with `npm install`
3. **Runs** all unit tests with `npm run test:unit`
4. **Blocks merging** if any test fails

### Workflow file
Located at `.github/workflows/test.yml`

To see the runs:
1. Go to your GitHub repository
2. Click **Actions** tab
3. Look for the "CI - Tests" workflow

---

## Test Structure

```
src/__tests__/
├── unit/                           # Unit tests
│   ├── cache.test.ts               # sessionStorage && cache utilities
│   └── serviceOrder.mocked.test.ts # serviceOrderService with mocked Firebase
└── test-utils/
    └── firestore-mock.ts           # In-memory Firestore mock
```

### Example Unit Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import { getBusesFromFirestore } from '@/lib/serviceOrderService';

describe('serviceOrderService', () => {
  beforeEach(() => {
    resetMockFirestore(); // Clear in-memory store before each test
  });

  it('should uppercase bus names', async () => {
    // Setup mock data
    setCollectionDocs('buses', [{ id: 'b1', data: { name: 'Bus 8' } }]);

    // Call function
    const buses = await getBusesFromFirestore();

    // Assert
    expect(buses[0].name).toBe('BUS 8');
  });
});
```

---

## Firestore Mock API

The mock at `src/__tests__/test-utils/firestore-mock.ts` provides these functions:

### Setup
```typescript
resetMockFirestore()                    // Clear all mock data
setCollectionDocs(name, docs)           // Seed mock collection
```

### Query Operations (all async)
```typescript
getDocs(ref | query)                    // Fetch multiple docs
getDoc(docRef)                          // Fetch single doc
addDoc(collectionRef, data)             // Create doc with auto ID
setDoc(docRef, data, opts?)             // Create/set doc
updateDoc(docRef, updates)              // Update doc fields
deleteDoc(docRef)                       // Delete doc
writeBatch(db)                          // Batch writes
runTransaction(db, updateFn)            // Run transaction
```

### Utilities
```typescript
collection(db, name)                    // Get collection ref
doc(db, collectionName, id)             // Get doc ref
where(field, op, value)                 // Query constraint (== only)
query(collectionRef, ...constraints)    // Build query
increment(amount)                       // For batch updates
serverTimestamp()                       // Returns current time
```

---

## Cost Benefit: Zero Firebase Reads

**Without Testing Strategy:**
- Each E2E test run = ~500 Firestore reads
- 20 runs/month = 10,000 reads (~5% of your quota)

**With Unit Testing Mocks:**
- 80% unit tests = 0 reads
- 15% integration tests (Emulator) = 0 reads  
- 5% E2E tests (occasionally) = ~100 reads/month
- **Savings: 9,900 reads/month ✅**

---

## Adding New Tests

### 1. Create a test file
```bash
# In src/__tests__/unit/
touch my-feature.test.ts
```

### 2. Write a test
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMockFirestore, setCollectionDocs } from '../test-utils/firestore-mock';
import { myFunction } from '@/lib/my-service';

describe('myFunction', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### 3. Run tests
```bash
npm run test:unit
```

---

## Mocking Patterns

### Mock a function/service
```typescript
import { vi } from 'vitest';

vi.mock('@/lib/some-service', () => ({
  someFunction: vi.fn().mockResolvedValue({ data: 'mock' })
}));
```

### Mock Firebase directly
```typescript
vi.mock('firebase/firestore', async () => 
  await import('../test-utils/firestore-mock')
);
```

### Test with mock data
```typescript
beforeEach(() => {
  setCollectionDocs('guides', [
    { id: 'g1', data: { firstName: 'John', lastName: 'Doe' } }
  ]);
});
```

---

## CI/CD Flow

```
git push to main/develop
    ↓
GitHub Actions triggered
    ↓
npm install
    ↓
npm run test:unit
    ↓
✅ All tests pass → Ready to deploy
❌ Any test fails → Block merge, show error in PR
```

---

## Troubleshooting

### Tests fail locally but CI passes (or vice versa)
- Check Node version: `node --version` (should be 18+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check environment variables are loaded

### Import path errors (`@/lib/...`)
- Ensure `vitest.config.ts` has the `@` alias configured
- Restart test watcher if you just added new files

### Mock data not being used
- Call `resetMockFirestore()` in `beforeEach()` or `beforeAll()`
- Use `setCollectionDocs(name, docs)` AFTER reset

### Firestore warnings in test output
- Expected: "Firebase initialization failed: Missing config values..."
- This is OK because tests use mocks, not real Firebase

---

## Next Steps: Integration Tests

Once unit tests are stable, add integration tests using **Firebase Emulator**:

```bash
npm install -D @firebase/rules-unit-testing
```

This allows testing Firestore rules and multi-document transactions without real reads.

---

## Questions?

Refer to:
- [Vitest Docs](https://vitest.dev/)
- [Firebase Testing Guide](https://firebase.google.com/docs/firestore/solutions/testing)
- Local test files in `src/__tests__/`
