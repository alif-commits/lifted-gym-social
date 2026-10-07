import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canViewActivity, canViewProfile, canViewProfileContent, canViewSensitiveData } from "@/lib/privacy";

const rel = (p: Partial<{ isOwner: boolean; isFollower: boolean; blocked: boolean }> = {}) => ({ isOwner: false, isFollower: false, blocked: false, ...p });
const act = (p: Partial<{ status: string; visibility: string; authorStatus: string; authorIsPrivateAccount: boolean }> = {}) => ({ status: "PUBLISHED", visibility: "PUBLIC", authorStatus: "active", authorIsPrivateAccount: false, ...p });

describe("activity visibility", () => {
  it("public activities are visible to everyone", () => assert.equal(canViewActivity(act(), rel()), true));
  it("drafts are owner-only", () => {
    assert.equal(canViewActivity(act({ status: "DRAFT" }), rel({ isFollower: true })), false);
    assert.equal(canViewActivity(act({ status: "DRAFT" }), rel({ isOwner: true })), true);
  });
  it("followers-only requires a follow", () => {
    assert.equal(canViewActivity(act({ visibility: "FOLLOWERS" }), rel()), false);
    assert.equal(canViewActivity(act({ visibility: "FOLLOWERS" }), rel({ isFollower: true })), true);
  });
  it("only-me is owner-only", () => {
    assert.equal(canViewActivity(act({ visibility: "ONLY_ME" }), rel({ isFollower: true })), false);
    assert.equal(canViewActivity(act({ visibility: "ONLY_ME" }), rel({ isOwner: true })), true);
  });
  it("a private account hides even PUBLIC activities from non-followers", () => {
    assert.equal(canViewActivity(act({ authorIsPrivateAccount: true }), rel()), false);
    assert.equal(canViewActivity(act({ authorIsPrivateAccount: true }), rel({ isFollower: true })), true);
  });
  it("blocks hide everything, suspended authors are hidden", () => {
    assert.equal(canViewActivity(act(), rel({ blocked: true })), false);
    assert.equal(canViewActivity(act({ authorStatus: "suspended" }), rel()), false);
    assert.equal(canViewActivity(act({ authorStatus: "deleted" }), rel({ isOwner: true })), false);
  });
});

describe("profile and sensitive data", () => {
  it("profile header is visible unless blocked or inactive", () => {
    assert.equal(canViewProfile("active", rel()), true);
    assert.equal(canViewProfile("active", rel({ blocked: true })), false);
    assert.equal(canViewProfile("suspended", rel()), false);
  });
  it("private accounts expose content only to followers and the owner", () => {
    const author = { status: "active", isPrivateAccount: true };
    assert.equal(canViewProfileContent(author, rel()), false);
    assert.equal(canViewProfileContent(author, rel({ isFollower: true })), true);
    assert.equal(canViewProfileContent(author, rel({ isOwner: true })), true);
  });
  it("sensitive data defaults to owner-only", () => {
    assert.equal(canViewSensitiveData("ONLY_ME", rel({ isFollower: true })), false);
    assert.equal(canViewSensitiveData("FOLLOWERS", rel({ isFollower: true })), true);
    assert.equal(canViewSensitiveData("FOLLOWERS", rel()), false);
    assert.equal(canViewSensitiveData("PUBLIC", rel({ blocked: true })), false);
  });
});
