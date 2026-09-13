import React from "react";

import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";

import { AuthProvider } from "./context/AuthContext";

import { LocationProvider } from "./context/LocationContext";

import { CategoryProvider } from "./context/CategoryContext";

import { PreferencesProvider } from "./context/PreferencesContext";
import { ThemeProvider } from "./context/ThemeContext";

import { ProviderSettingsProvider } from "./context/ProviderSettingsContext";

import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <ThemeProvider>
          <ProviderSettingsProvider>
            <CategoryProvider>
              <LocationProvider>
                <App />

                <Toaster
                  position="top-right"
                  toastOptions={{
                    style: {
                      background: "rgb(var(--color-surface-raised))",
                      border: "1px solid rgb(var(--color-border-strong))",
                      color: "rgb(var(--color-text-primary))",
                    },
                  }}
                />
              </LocationProvider>
            </CategoryProvider>
          </ProviderSettingsProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </AuthProvider>
  </React.StrictMode>,
);
