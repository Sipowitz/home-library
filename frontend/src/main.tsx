import React from "react";

import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";

import { AuthProvider } from "./context/AuthContext";

import { LocationProvider } from "./context/LocationContext";

import { CategoryProvider } from "./context/CategoryContext";

import { PreferencesProvider } from "./context/PreferencesContext";

import { ProviderSettingsProvider } from "./context/ProviderSettingsContext";

import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <ProviderSettingsProvider>
          <CategoryProvider>
            <LocationProvider>
              <App />

              <Toaster position="top-right" />
            </LocationProvider>
          </CategoryProvider>
        </ProviderSettingsProvider>
      </PreferencesProvider>
    </AuthProvider>
  </React.StrictMode>,
);
