import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";

import { LocationProvider } from "./context/LocationContext";
import { AuthProvider } from "./context/AuthContext"; // ✅ NEW

// ✅ ADDED
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      {" "}
      {/* ✅ WRAP EVERYTHING */}
      <LocationProvider>
        <App />
        {/* ✅ ADDED */}
        <Toaster position="top-right" />
      </LocationProvider>
    </AuthProvider>
  </React.StrictMode>,
);
