import { afterEach, describe, expect, it, vi } from "vitest"
import { readBackupFileAsText } from "./backup-file"

function legacyFile() {
  const file = new File([""], "backup.json", { type: "application/json" })
  Object.defineProperty(file, "text", {
    configurable: true,
    value: undefined,
  })
  return file
}

describe("readBackupFileAsText", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns an empty string when legacy FileReader loads a non-text result", async () => {
    class ArrayBufferFileReader {
      error: DOMException | null = null
      result: string | ArrayBuffer | null = new ArrayBuffer(0)
      private readonly listeners = new Map<string, EventListenerOrEventListenerObject>()

      addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        this.listeners.set(type, listener)
      }

      readAsText(_file: File): void {
        const listener = this.listeners.get("load")
        const event = new Event("load")
        if (typeof listener === "function") {
          listener(event)
          return
        }
        listener?.handleEvent(event)
      }
    }

    vi.stubGlobal("FileReader", ArrayBufferFileReader)

    await expect(readBackupFileAsText(legacyFile())).resolves.toBe("")
  })
})
