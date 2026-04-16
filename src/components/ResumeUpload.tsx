"use client";
import { useState, useCallback } from "react";
import type { ResumeData } from "@/lib/types";

export default function ResumeUpload({
  onParsed,
}: {
  onParsed: (data: ResumeData) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const upload = useCallback(
    async (file: File) => {
      setLoading(true);
      setError("");
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/resume/parse", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        onParsed(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) upload(file);
      }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf,.txt";
        input.onchange = () => { if (input.files?.[0]) upload(input.files[0]); };
        input.click();
      }}
    >
      {loading ? (
        <div>
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-slate-500">Analyzing your resume with AI...</p>
        </div>
      ) : (
        <>
          <div className="text-4xl mb-3">📄</div>
          <p className="font-semibold text-slate-700">Drop your resume here</p>
          <p className="text-sm text-slate-400 mt-1">PDF or TXT — we'll extract and analyze it with AI</p>
        </>
      )}
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}
