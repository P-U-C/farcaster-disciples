import { encodeAbiParameters, encodeEventTopics } from "viem";
import { describe, expect, it } from "vitest";
import {
  classifyAccountOwnership,
  findSeaportSaleEvidence,
  ORDER_FULFILLED_EVENT,
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
        transactionHash: `0x${"aa".repeat(32)}`,
      },
    ];

    expect(replayOgTransfers(logs)).toEqual([
      expect.objectContaining({
        tokenId: 1,
        mintWalletStatus: "AT_MINT_WALLET",
      }),
      expect.objectContaining({
        tokenId: 2,
        mintWalletStatus: "MOVED_FROM_MINT_WALLET",
        currentOwner: "0x3333333333333333333333333333333333333333",
        transferTransactions: [`0x${"aa".repeat(32)}`],
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

    expect(replayOgTransfers(logs)[0].mintWalletStatus).toBe(
      "MOVED_FROM_MINT_WALLET",
    );
  });
});

describe("account-level ownership", () => {
  const mintWallet = "0x1111111111111111111111111111111111111111";
  const custodyAddress = "0x2222222222222222222222222222222222222222";
  const verifiedAddresses = [
    "0x3333333333333333333333333333333333333333",
    mintWallet.toUpperCase().replace("0X", "0x"),
  ];

  it("keeps an OG at HODL when it remains in the mint wallet", () => {
    expect(
      classifyAccountOwnership({
        mintWallet,
        currentOwner: mintWallet,
        custodyAddress,
        verifiedAddresses,
      }),
    ).toMatchObject({
      inAccount: true,
      ownershipBasis: "mint_wallet",
    });
  });

  it("keeps security transfers to custody or verified wallets at HODL", () => {
    for (const currentOwner of [custodyAddress, verifiedAddresses[0]]) {
      expect(
        classifyAccountOwnership({
          mintWallet,
          currentOwner,
          custodyAddress,
          verifiedAddresses,
        }),
      ).toMatchObject({
        inAccount: true,
        ownershipBasis: "connected_wallet",
      });
    }
  });

  it("uses SOLD only when the OG leaves the Farcaster account wallet set", () => {
    expect(
      classifyAccountOwnership({
        mintWallet,
        currentOwner: "0x4444444444444444444444444444444444444444",
        custodyAddress,
        verifiedAddresses,
      }),
    ).toMatchObject({
      inAccount: false,
      ownershipBasis: "external_wallet",
    });
  });

  it("deduplicates connected wallets case-insensitively", () => {
    const result = classifyAccountOwnership({
      mintWallet,
      currentOwner: mintWallet,
      custodyAddress,
      verifiedAddresses,
    });
    expect(result.accountWallets).toHaveLength(3);
  });
});

describe("Seaport sale evidence", () => {
  const collection = "0xe03ef4b9db1a47464de84fb476f9baf493b3e886";
  const seaport = "0x0000000000000068F116a894984e2DB1123eB395";
  const orderHash = `0x${"11".repeat(32)}`;
  const offerer = "0x1111111111111111111111111111111111111111";
  const zone = "0x2222222222222222222222222222222222222222";
  const recipient = "0x3333333333333333333333333333333333333333";

  function paidSaleReceipt(
    address = seaport,
    paymentAmount = 50_000_000_000_000_000n,
  ) {
    const offer = [
      {
        itemType: 2,
        token: collection,
        identifier: 469n,
        amount: 1n,
      },
    ];
    const consideration = [
      {
        itemType: 1,
        token: "0x4200000000000000000000000000000000000006",
        identifier: 0n,
        amount: paymentAmount,
        recipient: offerer,
      },
    ];
    return {
      transactionHash: `0x${"22".repeat(32)}`,
      logs: [
        {
          address,
          topics: encodeEventTopics({
            abi: [ORDER_FULFILLED_EVENT],
            eventName: "OrderFulfilled",
            args: { orderHash, offerer, zone },
          }),
          data: encodeAbiParameters(
            ORDER_FULFILLED_EVENT.inputs.filter((input) => !input.indexed),
            [orderHash, recipient, offer, consideration],
          ),
        },
      ],
    };
  }

  it("requires canonical Seaport payment evidence for this exact OG", () => {
    expect(findSeaportSaleEvidence(paidSaleReceipt(), collection, 469)).toMatchObject({
      marketplace: "Seaport",
      protocol: "SEAPORT",
      orderHash,
    });
    expect(findSeaportSaleEvidence(paidSaleReceipt(), collection, 470)).toBeNull();
    expect(
      findSeaportSaleEvidence(paidSaleReceipt(seaport, 0n), collection, 469),
    ).toBeNull();
  });

  it("rejects matching event data from a noncanonical contract", () => {
    const impostor = "0x4444444444444444444444444444444444444444";
    expect(
      findSeaportSaleEvidence(paidSaleReceipt(impostor), collection, 469),
    ).toBeNull();
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
