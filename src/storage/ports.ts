export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ClockPort {
  nowMs(): number
}

export interface DownloadPort {
  downloadJson(fileName: string, content: string): void
}

export class BrowserLocalStoragePort implements StoragePort {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key)
  }

  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value)
  }
}

export class BrowserClockPort implements ClockPort {
  nowMs(): number {
    return Date.now()
  }
}

export class BrowserDownloadPort implements DownloadPort {
  downloadJson(fileName: string, content: string): void {
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }
}
