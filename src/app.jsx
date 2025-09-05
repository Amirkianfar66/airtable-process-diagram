import React from "react";
import { createRoot } from "react-dom/client";
import PNIDCanvas from "./pnidCanvas.jsx";

const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");
const root = createRoot(document.getElementById("canvas-root"));

let currentPNID = { nodes: [], edges: [] };

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  const res = await fetch("/api/ai-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: text, context: currentPNID })
  });
  const data = await res.json();

  if (data.updatedPNID) {
    currentPNID = data.updatedPNID;
    root.render(<PNIDCanvas pnid={currentPNID} />);
  }
}

sendBtn.addEventListener("click", sendMessage);
