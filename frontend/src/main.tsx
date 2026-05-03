import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import { CategoryProvider } from "./context/CategoryContext";

import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CategoryProvider>
        <LocationProvider>
          <App />

          <Toaster position="top-right" />
        </LocationProvider>
      </CategoryProvider>
    </AuthProvider>
  </React.StrictMode>,
);
