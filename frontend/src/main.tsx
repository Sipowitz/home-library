import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";

import { LocationProvider } from "./context/LocationContext";

// ✅ ADDED
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocationProvider>
      <App />
      {/* ✅ ADDED */}
      <Toaster position="top-right" />
    </LocationProvider>
  </React.StrictMode>,
);
