import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Self-hosted woff2 fonts, inlined into the single-file build.
import "../assets/fonts.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
