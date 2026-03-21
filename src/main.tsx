import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Fallback: remove static loader if React renders a route that doesn't use LoadingSpinner
requestAnimationFrame(() => {
  const loader = document.getElementById("initial-loader");
  if (loader) {
    loader.classList.add("fade-out");
    setTimeout(() => loader.remove(), 220);
  }
});
