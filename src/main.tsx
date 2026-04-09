import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// NOTE: The initial-loader is now removed by ProtectedLayout
// after auth state is resolved, NOT here.
// This prevents the flash between the HTML loader and React render.
