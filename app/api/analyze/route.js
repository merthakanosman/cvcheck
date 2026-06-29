import Groq from "groq-sdk";
import { headers } from "next/headers";

const rateLimitMap = new Map(); // { ip: { count, resetTime } }
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function hasRedisRateLimit() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function checkRedisRateLimit(ip) {
  const key = `rate-limit:analyze:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, Math.ceil(WINDOW_MS / 1000), "NX"],
    ]),
  });

  if (!response.ok) {
    throw new Error("Rate limit store request failed");
  }

  const [countResult] = await response.json();
  return Number(countResult?.result ?? 0) <= LIMIT;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

async function isRateLimited(ip) {
  const allowed = hasRedisRateLimit()
    ? await checkRedisRateLimit(ip)
    : checkRateLimit(ip);
  return !allowed;
}

const SECTOR_LABELS = {
  yazilim: "Yazılım & Teknoloji",
  pazarlama: "Pazarlama",
  finans: "Finans & Muhasebe",
  tasarim: "Tasarım & Yaratıcı",
  hukuk: "Hukuk",
  diger: "Genel",
};

const CV_MIN = 50;
const CV_MAX = 50_000;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function parseAnalysis(text) {
  const data = JSON.parse(text);

  if (
    !Array.isArray(data.strengths) ||
    !Array.isArray(data.weaknesses) ||
    !Array.isArray(data.suggestions) ||
    typeof data.score !== "number"
  ) {
    throw new Error("Eksik veri yapısı");
  }

  return data;
}

async function analyzeWithGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return response.choices[0].message.content;
}

async function analyzeWithGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no content");
  }

  return text;
}

async function analyzeWithFallback(prompt) {
  const providers = [
    { name: "groq", enabled: Boolean(process.env.GROQ_API_KEY), run: analyzeWithGroq },
    { name: "gemini", enabled: Boolean(process.env.GEMINI_API_KEY), run: analyzeWithGemini },
  ].filter((provider) => provider.enabled);

  if (providers.length === 0) {
    throw new Error("No AI provider is configured");
  }

  const errors = [];
  for (const provider of providers) {
    try {
      return parseAnalysis(await provider.run(prompt));
    } catch (error) {
      errors.push(`${provider.name}: ${error?.message ?? error}`);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join(" | ")}`);
}

export async function POST(request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (await isRateLimited(ip)) {
      return Response.json(
        { error: "Saatlik limit aşıldı. Lütfen daha sonra tekrar deneyin." },
        { status: 429 }
      );
    }

    const { cvText: rawCvText, sector: rawSector } = await request.json();

    const sector = typeof rawSector === "string" ? rawSector.trim() : "";
    const cvText = typeof rawCvText === "string" ? rawCvText.trim() : "";

    if (!SECTOR_LABELS[sector]) {
      return Response.json({ error: "Geçersiz sektör seçimi." }, { status: 400 });
    }
    if (cvText.length < CV_MIN) {
      return Response.json({ error: "CV metni çok kısa veya okunamadı." }, { status: 400 });
    }

    const sectorLabel = SECTOR_LABELS[sector];
    const safeText = cvText.length > CV_MAX ? cvText.slice(0, CV_MAX) : cvText;

    const prompt = `Sen deneyimli bir kariyer danışmanısın. Aşağıdaki CV'yi "${sectorLabel}" sektörü için profesyonelce analiz et.

CV İçeriği:
${safeText.slice(0, 8000)}

Yalnızca aşağıdaki JSON formatında yanıt ver. Başka hiçbir şey ekleme:
{
  "strengths": ["madde 1", "madde 2", "madde 3"],
  "weaknesses": ["madde 1", "madde 2", "madde 3"],
  "suggestions": ["madde 1", "madde 2", "madde 3"],
  "score": 75
}

Kurallar:
- "strengths": ${sectorLabel} sektörü açısından CV'nin en güçlü 3 özelliği
- "weaknesses": Bu sektörde CV'de eksik olan veya zayıf kalan 3 kritik alan
- "suggestions": CV'yi bu sektör için güçlendirmek adına 3 pratik öneri
- "score": CV'nin bu sektöre uygunluğunu 0–100 arası tam sayı ile değerlendir`;

    const data = await analyzeWithFallback(prompt);

    return Response.json(data);
  } catch (err) {
    console.error("[/api/analyze]", err?.message ?? err);
    return Response.json({ error: "Analiz başarısız oldu." }, { status: 500 });
  }
}
