export function assertNever(value: never): never {
  throw new Error(`Unexpected domain variant: ${JSON.stringify(value)}`)
}
