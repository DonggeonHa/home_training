export function readBackupFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "")
    })
    reader.addEventListener("error", () => {
      reject(reader.error ?? new DOMException("file read failed", "InvalidStateError"))
    })
    reader.readAsText(file)
  })
}
