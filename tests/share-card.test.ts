import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBestSet, formatShareVolume } from "@/lib/share-card";
import { isAdminRole, isStaffRole } from "@/lib/constants";
import { jpegToPdf } from "@/server/share/pdf";

describe("staff roles", () => {
  it("treats admin and moderator as staff", () => {
    assert.equal(isStaffRole("admin"), true);
    assert.equal(isStaffRole("moderator"), true);
    assert.equal(isStaffRole("user"), false);
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("moderator"), false);
  });
});

describe("share card formatting", () => {
  it("formats a weighted best set in kg", () => {
    assert.equal(formatBestSet({ weight: 100, reps: 5, durationSeconds: null, distance: null }), "100 kg × 5");
  });
  it("formats volume compactly", () => {
    assert.equal(formatShareVolume(12500), "12.5k kg");
    assert.equal(formatShareVolume(840), "840 kg");
    assert.equal(formatShareVolume(null), "–");
  });
});

describe("jpegToPdf", () => {
  it("wraps JPEG bytes in a PDF", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = jpegToPdf(jpeg, 10, 20);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.match(pdf.toString("latin1"), /%%EOF/);
    assert.match(pdf.toString("latin1"), /\/DCTDecode/);
  });
});
