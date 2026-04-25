import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import "./copilot.css";
import { FloatingCopilot } from "./floating-copilot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FloatingCopilot />
  </StrictMode>,
);
