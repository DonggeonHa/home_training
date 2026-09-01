import type { DownloadPort, StoragePort } from "./ports"

export class MemoryDownloadPort implements DownloadPort {
  downloads: readonly { readonly fileName: string; readonly content: string }[] = []

  downloadJson(fileName: string, content: string): void {
    this.downloads = [...this.downloads, { fileName, content }]
  }
}

export class FailingDownloadPort implements DownloadPort {
  downloadJson(_fileName: string, _content: string): void {
    throw new DOMException("download blocked", "SecurityError")
  }
}

export class MemoryStoragePort implements StoragePort {
  readonly values = new Map<string, string>()
  writeError: DOMException | null = null

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.writeError !== null) {
      throw this.writeError
    }
    this.values.set(key, value)
  }
}
