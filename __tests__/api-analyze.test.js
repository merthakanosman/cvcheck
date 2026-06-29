import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.GROQ_API_KEY = 'test-groq-api-key';

const mockCreate = vi.fn();
const originalFetch = global.fetch;

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    constructor() {
      this.chat = { completions: { create: mockCreate } };
    }
  },
}));

let currentTestIp = 'test-ip-default';

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({
    get: (name) => name === 'x-forwarded-for' ? currentTestIp : null,
  }),
}));

const { POST } = await import('../app/api/analyze/route.js');

// Minimum valid cvText (>= 50 chars)
const VALID_CV = 'x'.repeat(55);
// Long enough to exceed CV_MAX (50,000 chars)
const HUGE_CV = 'x'.repeat(51_000);

let ipCounter = 0;
function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    currentTestIp = `test-ip-${++ipCounter}`;
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when cvText is missing', async () => {
    const res = await POST(makeRequest({ sector: 'yazilim' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when cvText is too short (< 50 chars)', async () => {
    const res = await POST(makeRequest({ cvText: 'kısa', sector: 'yazilim' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('CV metni çok kısa');
  });

  it('returns 400 when sector is missing', async () => {
    const res = await POST(makeRequest({ cvText: VALID_CV }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sektör');
  });

  it('returns 400 when sector is not in the valid list', async () => {
    const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'bilinmeyen' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Geçersiz sektör');
  });

  it('trims whitespace from cvText and sector before validation', async () => {
    const payload = { strengths: ['a'], weaknesses: ['b'], suggestions: ['c'], score: 70 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
    // Leading/trailing spaces should be stripped — padded VALID_CV with spaces still valid
    const res = await POST(makeRequest({ cvText: `  ${VALID_CV}  `, sector: '  yazilim  ' }));
    expect(res.status).toBe(200);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with parsed strengths/weaknesses/suggestions/score', async () => {
    const payload = {
      strengths: ['a', 'b', 'c'],
      weaknesses: ['x', 'y', 'z'],
      suggestions: ['p', 'q', 'r'],
      score: 82,
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'yazilim' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(82);
    expect(body.strengths).toHaveLength(3);
    expect(body.weaknesses).toHaveLength(3);
    expect(body.suggestions).toHaveLength(3);
  });

  it('accepts all six valid sectors', async () => {
    const payload = { strengths: ['a'], weaknesses: ['b'], suggestions: ['c'], score: 70 };
    for (const sector of ['yazilim', 'pazarlama', 'finans', 'tasarim', 'hukuk', 'diger']) {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      });
      currentTestIp = `sector-test-ip-${sector}`;
      const res = await POST(makeRequest({ cvText: VALID_CV, sector }));
      expect(res.status, `sector "${sector}" should be accepted`).toBe(200);
    }
  });

  it('truncates cvText longer than 50,000 chars without error', async () => {
    const payload = { strengths: ['a'], weaknesses: ['b'], suggestions: ['c'], score: 55 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
    const res = await POST(makeRequest({ cvText: HUGE_CV, sector: 'finans' }));
    expect(res.status).toBe(200);
  });

  it('falls back to Gemini when Groq fails and Gemini is configured', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
    const payload = {
      strengths: ['fallback strength'],
      weaknesses: ['fallback weakness'],
      suggestions: ['fallback suggestion'],
      score: 64,
    };
    mockCreate.mockRejectedValue(new Error('Groq rate limit exceeded'));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(payload) }] },
        }],
      }),
    });

    const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'yazilim' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(64);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ── Error paths ─────────────────────────────────────────────────────────────

  it('returns 500 when Groq response contains no JSON object', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Sorry, I cannot help with that.' } }],
    });
    const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'finans' }));
    expect(res.status).toBe(500);
  });

  it('returns 500 when Groq response has no choices array', async () => {
    mockCreate.mockResolvedValue({ choices: null });
    const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'hukuk' }));
    expect(res.status).toBe(500);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────────

  it('returns 429 after 5 requests from the same IP within one hour', async () => {
    currentTestIp = 'rate-limit-exhausted-ip';
    const payload = { strengths: ['a'], weaknesses: ['b'], suggestions: ['c'], score: 70 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ cvText: VALID_CV, sector: 'yazilim' }));
      expect(res.status).toBe(200);
    }

    const blocked = await POST(makeRequest({ cvText: VALID_CV, sector: 'yazilim' }));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toContain('Saatlik limit');
  });
});
