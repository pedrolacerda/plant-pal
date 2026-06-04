import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const updateServiceWorker = registerSW({
	immediate: true,
	onNeedRefresh() {
		// Activate the newly installed SW and reload to ensure users get the latest bundle.
		updateServiceWorker(true);
	},
});

createRoot(document.getElementById("root")!).render(<App />);
