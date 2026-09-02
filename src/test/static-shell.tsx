import { readFileSync } from "node:fs"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"

const indexMarkup = readFileSync("index.html", "utf8")

export function renderInStaticShell(element: ReactElement) {
  const shellDocument = new DOMParser().parseFromString(indexMarkup, "text/html")
  document.body.innerHTML = shellDocument.body.innerHTML
  const root = document.getElementById("root")

  if (root === null) {
    throw new Error("Static app shell root was not found")
  }

  return render(element, { baseElement: document.body, container: root })
}
