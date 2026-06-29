# Testing

**Framework:** Vitest v4 + @testing-library/react

## Run tests

```bash
npm test          # run all tests once
npx vitest        # interactive watch mode
```

## Test directory

`__tests__/` — all test files live here, mirroring the source structure.

## Layers

- **Unit/integration tests** — test API route handlers with mocked external dependencies (Groq SDK). Lives in `__tests__/`.

## Conventions

- File naming: `{feature}.test.js`
- Mock external deps (Groq, pdfjs) at the top of each file using `vi.mock()`
- Assertions should test real behaviour, not just that something is defined
- Use `beforeEach(() => mockFn.mockReset())` to keep tests isolated

## Expectations

- Write a test when fixing a bug (regression test)
- Write a test when adding a new API route or branch condition
- Never commit code that makes existing tests fail
