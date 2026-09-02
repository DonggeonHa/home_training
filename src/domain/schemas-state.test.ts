import { describe, expect, it } from "vitest"
import { SetRecordSchema } from "./schemas"

describe("set record boundary schema", () => {
  it("parses set records by matching metric laterality", () => {
    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 2,
        loadKg: 10,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "perSide",
        left: 8,
        right: 8,
        rir: 2,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        left: 8,
        right: 8,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)
  })

  it("keeps normal logged RIR values bounded to integer zero through five", () => {
    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 0,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 5,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: -1,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 6,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 2.5,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)
  })
})
