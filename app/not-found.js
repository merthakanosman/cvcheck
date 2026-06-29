import Link from "next/link";

const T = "#2dd4bf";

export default function NotFound() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#080c0c",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", padding: "24px" }}>
        <p style={{ fontSize: "72px", fontWeight: 800, color: T, lineHeight: 1, margin: "0 0 16px", letterSpacing: "-0.04em" }}>
          404
        </p>
        <p style={{ fontSize: "15px", color: "#4a6060", marginBottom: "32px" }}>
          Bu sayfa bulunamadı.
        </p>
        <Link href="/" style={{
          display: "inline-block",
          padding: "12px 28px",
          background: T,
          color: "#080c0c",
          fontWeight: 700,
          fontSize: "14px",
          borderRadius: "10px",
          textDecoration: "none",
        }}>
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
