"use client";

import { useState, useCallback } from "react";

const T = "#2dd4bf";
const T08 = "rgba(45, 212, 191, 0.08)";
const T15 = "rgba(45, 212, 191, 0.15)";
const CARD = { background: "#0d1a1a", border: `1px solid ${T15}`, borderRadius: "16px" };
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 15;

const SECTORS = [
  { value: "yazilim", label: "Yazılım & Teknoloji" },
  { value: "pazarlama", label: "Pazarlama" },
  { value: "finans", label: "Finans & Muhasebe" },
  { value: "tasarim", label: "Tasarım & Yaratıcı" },
  { value: "hukuk", label: "Hukuk" },
  { value: "diger", label: "Diğer" },
];

const HOW_IT_WORKS = [
  "PDF CV'nizi yükleyin",
  "Hedef sektörünüzü seçin",
  "Güçlü yönler, eksikler ve önerileri görün",
];

async function readApiJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getAnalyzeErrorMessage(status, apiError) {
  if (status === 400) {
    return apiError || "CV veya sektör bilgisi eksik görünüyor. Lütfen bilgileri kontrol edip tekrar deneyin.";
  }

  if (status === 429) {
    return apiError || "Saatlik analiz limitine ulaştınız. Lütfen daha sonra tekrar deneyin.";
  }

  if (status >= 500) {
    return "Analiz servisi şu anda yanıt veremiyor. Lütfen birkaç dakika sonra tekrar deneyin.";
  }

  return apiError || "Analiz başarısız oldu. Lütfen tekrar deneyin.";
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={T} strokeWidth="4" />
      <path className="opacity-75" fill={T} d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function ScoreCard({ score }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : "#f87171";
  const label = score >= 80 ? "Mükemmel" : score >= 60 ? "İyi" : score >= 40 ? "Orta" : "Geliştirilmeli";
  return (
    <div style={{ ...CARD, padding: "32px 24px", textAlign: "center" }}>
      <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", color: "#4a6060", marginBottom: "12px" }}>
        GENEL SKOR
      </p>
      <p style={{ fontSize: "72px", fontWeight: 800, color, lineHeight: 1, fontFamily: "system-ui", letterSpacing: "-0.04em" }}>
        {score}
      </p>
      <p style={{ fontSize: "13px", color: "#2a4040", marginTop: "4px" }}>/&nbsp;100</p>
      <span style={{
        display: "inline-block", marginTop: "12px", fontSize: "11px", fontWeight: 600,
        padding: "4px 14px", borderRadius: "999px",
        color, border: `1px solid ${color}40`, background: `${color}12`,
      }}>
        {label}
      </span>
    </div>
  );
}

function ResultSection({ title, items, accent, icon }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px", borderColor: `${accent}25`, background: `${accent}06` }}>
      <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#f0fdf4", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: accent }}>{icon}</span>
        {title}
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: "13px", color: "#7a9e9e", lineHeight: "1.6", display: "flex", gap: "10px" }}>
            <span style={{ color: "#2a4040", flexShrink: 0, marginTop: "2px" }}>—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadFocused, setIsUploadFocused] = useState(false);
  const [fileName, setFileName] = useState("");
  const [cvText, setCvText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [sector, setSector] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const parsePdf = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Lütfen bir PDF dosyası yükleyin.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("PDF dosyası en fazla 5 MB olabilir.");
      return;
    }
    setIsParsing(true);
    setError("");
    setCvText("");
    setResult(null);
    setFileName(file.name);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (pdf.numPages > MAX_PAGES) {
        setError(`PDF en fazla ${MAX_PAGES} sayfa olabilir.`);
        setFileName("");
        return;
      }
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => it.str ?? "").join(" ") + "\n";
      }
      const trimmed = text.trim();
      if (trimmed.length < 100) {
        setError("PDF'den metin okunamadı. Lütfen metin içeren bir PDF yükleyin.");
        setFileName("");
        return;
      }
      setCvText(trimmed);
    } catch {
      setError("PDF okunurken hata oluştu.");
      setFileName("");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    parsePdf(e.dataTransfer.files[0]);
  }, [parsePdf]);

  const handleAnalyze = async () => {
    if (!cvText || !sector) return;
    setIsAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, sector }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        setError(getAnalyzeErrorMessage(res.status, data?.error));
        return;
      }
      setResult(data);
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#080c0c", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px" }}>

        {/* Title */}
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: "#f0fdf4", margin: "0 0 12px" }}>
          CV&apos;nizi{" "}
          <span style={{ color: T }}>Analiz Edin</span>
        </h1>
        <p style={{ fontSize: "14px", color: "#4a6060", marginBottom: "40px", lineHeight: "1.6" }}>
          PDF CV&apos;nizi yükleyin, sektörünüzü seçin, yapay zeka analiz etsin.
        </p>

        {/* Trust Info */}
        <section aria-label="CVCheck nasıl çalışır" style={{ display: "grid", gap: "12px", marginBottom: "24px" }}>
          <div style={{ ...CARD, padding: "18px 20px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#f0fdf4", margin: "0 0 12px" }}>
              Nasıl çalışır?
            </h2>
            <ol style={{ listStyle: "none", display: "grid", gap: "10px", padding: 0, margin: 0 }}>
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step} style={{ display: "flex", alignItems: "center", gap: "10px", color: "#7a9e9e", fontSize: "13px", lineHeight: "1.5" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "999px", background: T08, color: T, fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div style={{ ...CARD, padding: "16px 18px", borderColor: "rgba(45, 212, 191, 0.18)", background: "rgba(45, 212, 191, 0.05)" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9fc7c7", lineHeight: "1.6" }}>
              <strong style={{ color: "#f0fdf4" }}>Gizlilik:</strong> CV içeriğiniz yalnızca analiz sonucu üretmek için kullanılır; ekranda gösterilen değerlendirme dışında paylaşılmaz veya profil oluşturmak için kullanılmaz.
            </p>
          </div>

          <div style={{ ...CARD, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#f0fdf4" }}>
              Örnek çıktı
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "12px", alignItems: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "14px", border: `1px solid ${T15}`, background: T08, display: "flex", alignItems: "center", justifyContent: "center", color: T, fontSize: "24px", fontWeight: 800 }}>
                82
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#7a9e9e", lineHeight: "1.6" }}>
                Genel skor, güçlü yönler, eksikler ve CV&apos;nizi hedef sektöre göre iyileştirecek pratik öneriler.
              </p>
            </div>
          </div>
        </section>

        {/* Upload Zone */}
        <div style={{ marginBottom: "16px" }}>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: T, margin: "0 0 10px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "999px", background: T08, color: T, fontSize: "11px", letterSpacing: 0 }}>
              1
            </span>
            PDF YÜKLE
          </p>
          <label htmlFor="cv-upload" style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#f0fdf4", marginBottom: "6px" }}>
            CV PDF dosyası
          </label>
          <p id="cv-upload-help" style={{ fontSize: "12px", color: "#7a9e9e", margin: "0 0 10px", lineHeight: "1.5" }}>
            Yalnızca metin içeren PDF dosyaları desteklenir.
          </p>
          <label
            htmlFor="cv-upload"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            style={{
              position: "relative",
              display: "block",
              ...CARD,
              borderStyle: "dashed",
              borderWidth: "1.5px",
              borderColor: isUploadFocused ? T : isDragging ? T : fileName ? "#4ade8040" : T15,
              background: isDragging ? "rgba(45, 212, 191, 0.06)" : fileName ? "rgba(74, 222, 128, 0.04)" : "#0d1a1a",
              boxShadow: isUploadFocused ? `0 0 0 3px rgba(45,212,191,0.22)` : isDragging ? `0 0 32px rgba(45,212,191,0.15)` : "none",
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input id="cv-upload" type="file" accept="application/pdf,.pdf" aria-describedby="cv-upload-help"
            style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}
            onFocus={() => setIsUploadFocused(true)}
            onBlur={() => setIsUploadFocused(false)}
            onChange={(e) => parsePdf(e.target.files?.[0])}
          />
          {isParsing ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", color: "#4a6060" }}>
              <Spinner />
              <span style={{ fontSize: "13px" }}>PDF okunuyor...</span>
            </div>
          ) : fileName ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#4ade80", margin: 0 }}>{fileName}</p>
              <p style={{ fontSize: "12px", color: "#2a4040", margin: 0 }}>Tıklayarak değiştirebilirsiniz</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke={T} strokeWidth={1.5} style={{ opacity: 0.4 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#f0fdf4", margin: 0 }}>PDF CV&apos;nizi buraya sürükleyin</p>
              <p style={{ fontSize: "12px", color: "#2a4040", margin: 0 }}>veya tıklayarak seçin</p>
            </div>
          )}
          </label>
        </div>

        {/* Sector Select */}
        <div style={{ ...CARD, padding: "20px 24px", marginBottom: "16px", opacity: cvText ? 1 : 0.55 }}>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: cvText ? T : "#4a6060", margin: "0 0 12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "999px", background: cvText ? T08 : "rgba(74, 96, 96, 0.12)", color: cvText ? T : "#4a6060", fontSize: "11px", letterSpacing: 0 }}>
              2
            </span>
            SEKTÖR SEÇ
          </p>
          <label htmlFor="industry-select" style={{ display: "block", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "#d9fbf6", marginBottom: "6px" }}>
            HEDEF SEKTÖR
          </label>
          <p id="industry-select-help" style={{ margin: "0 0 10px", fontSize: "12px", color: cvText ? "#9fc7c7" : "#7a9e9e", lineHeight: "1.5" }}>
            CV&apos;nizin değerlendirileceği alanı seçin.
          </p>
          <select id="industry-select" value={sector} onChange={(e) => setSector(e.target.value)} disabled={!cvText} aria-describedby="industry-select-help"
            style={{
              width: "100%",
              background: cvText ? "#071313" : "#0a1414",
              border: `1.5px solid ${sector ? "rgba(45,212,191,0.45)" : cvText ? "rgba(159,199,199,0.32)" : "rgba(122,158,158,0.18)"}`,
              borderRadius: "10px",
              padding: "12px 40px 12px 14px",
              color: sector ? "#f0fdf4" : "#9fc7c7",
              fontSize: "14px",
              fontWeight: sector ? 600 : 500,
              outline: "none",
              cursor: cvText ? "pointer" : "not-allowed",
              boxShadow: cvText ? "inset 0 0 0 1px rgba(45,212,191,0.05)" : "none",
              appearance: "auto",
            }}>
            <option value="">{cvText ? "Sektör seçiniz..." : "Önce PDF yükleyin"}</option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {!cvText && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#7a9e9e", lineHeight: "1.5" }}>
              CV metni okunduktan sonra sektör seçimi aktif olur.
            </p>
          )}
        </div>

        {/* Analyze Button */}
        <div style={{ marginBottom: "20px", opacity: cvText && sector ? 1 : 0.65 }}>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: cvText && sector ? T : "#4a6060", margin: "0 0 12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "999px", background: cvText && sector ? T08 : "rgba(74, 96, 96, 0.12)", color: cvText && sector ? T : "#4a6060", fontSize: "11px", letterSpacing: 0 }}>
              3
            </span>
            CV ANALİZ ET
          </p>
          <button onClick={handleAnalyze} disabled={!cvText || !sector || isAnalyzing}
            style={{
              width: "100%", padding: "14px", borderRadius: "12px", border: "none",
              background: !cvText || !sector || isAnalyzing ? "#0d1a1a" : T,
              color: !cvText || !sector || isAnalyzing ? "#2a4040" : "#080c0c",
              fontWeight: 700, fontSize: "14px", cursor: !cvText || !sector || isAnalyzing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.2s ease",
              border: `1px solid ${!cvText || !sector || isAnalyzing ? T15 : "transparent"}`,
            }}>
            {isAnalyzing ? <><Spinner />Analiz ediliyor...</> : "Analiz Et"}
          </button>
          {!cvText && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#4a6060", lineHeight: "1.5" }}>
              Analiz için önce PDF yükleyin ve sektör seçin.
            </p>
          )}
          {cvText && !sector && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#4a6060", lineHeight: "1.5" }}>
              Analize başlamak için hedef sektörünüzü seçin.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "12px", padding: "12px 16px", fontSize: "13px", color: "#fca5a5", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <ScoreCard score={result.score} />
            <ResultSection title="Güçlü Yönler" items={result.strengths} accent="#4ade80" icon="✓" />
            <ResultSection title="Eksikler" items={result.weaknesses} accent="#f87171" icon="✕" />
            <ResultSection title="Öneriler" items={result.suggestions} accent={T} icon="→" />
          </div>
        )}

      </div>
    </main>
  );
}
