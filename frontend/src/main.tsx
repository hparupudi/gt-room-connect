import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth";
import { DatesProvider } from "./dates";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DatesProvider>
          <App />
        </DatesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
