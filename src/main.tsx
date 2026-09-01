import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { HashRouter } from "react-router-dom"
import { App } from "./App"
import "./styles/tokens.css"

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1") {
  const reactDevToolSpecifiers = ["react-" + "grab", "react-" + "scan"] as const

  for (const specifier of reactDevToolSpecifiers) {
    void import(/* @vite-ignore */ specifier)
  }
}

const rootElement = document.getElementById("root")

if (rootElement === null) {
  throw new Error("Application root element was not found")
}

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
