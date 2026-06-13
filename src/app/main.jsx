import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Self-hosted, woff2-only fonts (Amiri Arabic subsetted) — inlined into the
// single-file build so the app is fully self-contained, no Google Fonts / CDN.
import "../assets/fonts.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);
