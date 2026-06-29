"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      background: "#080c0c",
      borderBottom: "1px solid rgba(45, 212, 191, 0.1)",
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 32px",
        height: "56px",
        display: "flex",
        alignItems: "center",
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#f0fdf4", letterSpacing: "-0.01em" }}>
            CVCheck
          </span>
        </Link>
      </div>
    </nav>
  );
}
