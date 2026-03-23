"use client";

import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    const res = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ input }),
    });

    const data = await res.json();
    setResult(data.result);
    setLoading(false);
  };

  return (
    <div style={{
      maxWidth: 800,
      margin: "50px auto",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>
        🎓 盐趣AI 留学顾问
      </h1>

      <p style={{ color: "#666", marginBottom: 30 }}>
        输入你的背景，获取个性化留学方案
      </p>

      <textarea
        style={{
          width: "100%",
          height: 120,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd",
          fontSize: 16
        }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="例如:我大三计算机, GPA 3.2, 想申请美国CS硕士..."
      />

      <button
        onClick={handleSubmit}
        style={{
          marginTop: 20,
          padding: "12px 20px",
          background: "#000",
          color: "#fff",
          borderRadius: 8,
          border: "none",
          cursor: "pointer"
        }}
      >
        {loading ? "生成中..." : "生成方案"}
      </button>

      {result && (
        <div style={{
          marginTop: 40,
          padding: 20,
          background: "#f7f7f7",
          borderRadius: 10,
          whiteSpace: "pre-wrap"
        }}>
          <h2>📋 留学方案</h2>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}