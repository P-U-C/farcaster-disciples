import { describe, expect, it } from "vitest";
import {
  ethereumVerificationAddresses,
  mergeIdentityCandidate,
  parseProfile,
  replayOgTransfers,
  ZERO_ADDRESS,
} from "../scripts/lib.mjs";

describe("replayOgTransfers", () => {
  it("classifies tokens from their original mint wallet", () => {
    const logs = [
      {
        blockNumber: 10n,
        logIndex: 0n,
        from: ZERO_ADDRESS,
        to: "0x1111111111111111111111111111111111111111",
        tokenId: 1n,
      },
      {
        blockNumber: 10n,
        logIndex: 1n,
        from: ZERO_ADDRESS,
        to: "0x2222222222222222222222222222222222222222",
        tokenId: 2n,
      },
      {
        blockNumber: 11n,
        logIndex: 0n,
        from: "0x2222222222222222222222222222222222222222",
        to: "0x3333333333333333333333333333333333333333",
        tokenId: 2n,
      },
    ];

    expect(replayOgTransfers(logs)).toEqual([
      expect.objectContaining({ tokenId: 1, status: "HODL" }),
      expect.objectContaining({
        tokenId: 2,
        status: "SOLD",
        currentOwner: "0x3333333333333333333333333333333333333333",
      }),
    ]);
  });

  it("sorts before replaying", () => {
    const logs = [
      {
        blockNumber: 12n,
        logIndex: 0n,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x3333333333333333333333333333333333333333",
        tokenId: 1n,
      },
      {
        blockNumber: 10n,
        logIndex: 0n,
        from: ZERO_ADDRESS,
        to: "0x1111111111111111111111111111111111111111",
        tokenId: 1n,
      },
    ];

    expect(replayOgTransfers(logs)[0].status).toBe("SOLD");
  });
});

describe("identity helpers", () => {
  it("prefers a custody proof over a verified-wallet proof", () => {
    const verified = { fid: 1, matchType: "verified" };
    const custody = { fid: 2, matchType: "custody" };
    expect(mergeIdentityCandidate(verified, custody)).toBe(custody);
    expect(mergeIdentityCandidate(custody, verified)).toBe(custody);
  });

  it("keeps only Ethereum verification addresses", () => {
    const messages = [
      {
        data: {
          verificationAddAddressBody: {
            protocol: "PROTOCOL_ETHEREUM",
            address: "0x1111111111111111111111111111111111111111",
          },
        },
      },
      {
        data: {
          verificationAddAddressBody: {
            protocol: "PROTOCOL_SOLANA",
            address: "abc",
          },
        },
      },
    ];
    expect(ethereumVerificationAddresses(messages)).toEqual([
      "0x1111111111111111111111111111111111111111",
    ]);
  });

  it("normalizes the current profile fields", () => {
    const messages = [
      { data: { userDataBody: { type: "USER_DATA_TYPE_USERNAME", value: "alice" } } },
      { data: { userDataBody: { type: "USER_DATA_TYPE_DISPLAY", value: "Alice" } } },
      { data: { userDataBody: { type: "USER_DATA_TYPE_PFP", value: "https://img.test/a.png" } } },
    ];
    expect(parseProfile(messages, 42)).toEqual({
      username: "alice",
      displayName: "Alice",
      pfpUrl: "https://img.test/a.png",
    });
  });
});
