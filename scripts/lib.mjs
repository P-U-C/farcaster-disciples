import { decodeEventLog, parseAbiItem } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const SEAPORT_CONTRACTS = new Set([
  "0x0000000000000068f116a894984e2db1123eb395",
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
]);

export const ORDER_FULFILLED_EVENT = parseAbiItem(
  "event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address recipient, (uint8 itemType, address token, uint256 identifier, uint256 amount)[] offer, (uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[] consideration)",
);

export function replayOgTransfers(logs) {
  const ordered = [...logs].sort(
    (a, b) =>
      Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) ||
      Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
  );
  const original = new Map();
  const current = new Map();
  const transferTransactions = new Map();

  for (const log of ordered) {
    const tokenId = Number(log.tokenId);
    if (log.from.toLowerCase() === ZERO_ADDRESS) {
      original.set(tokenId, log.to);
    } else if (typeof log.transactionHash === "string") {
      const hashes = transferTransactions.get(tokenId) ?? [];
      if (hashes.at(-1) !== log.transactionHash) hashes.push(log.transactionHash);
      transferTransactions.set(tokenId, hashes);
    }
    current.set(tokenId, log.to);
  }

  return [...original]
    .sort((a, b) => a[0] - b[0])
    .map(([tokenId, mintWallet]) => {
      const currentOwner = current.get(tokenId);
      if (!currentOwner) throw new Error(`Missing current owner for OG #${tokenId}`);
      return {
        tokenId,
        mintWallet,
        currentOwner,
        mintWalletStatus:
          currentOwner.toLowerCase() === mintWallet.toLowerCase()
            ? "AT_MINT_WALLET"
            : "MOVED_FROM_MINT_WALLET",
        transferTransactions: transferTransactions.get(tokenId) ?? [],
      };
    });
}

export function classifyAccountOwnership({
  mintWallet,
  currentOwner,
  custodyAddress,
  verifiedAddresses = [],
}) {
  const byAddress = new Map();

  for (const address of [mintWallet, custodyAddress, ...verifiedAddresses]) {
    if (typeof address !== "string" || !address.startsWith("0x")) continue;
    byAddress.set(address.toLowerCase(), address);
  }

  const currentKey = currentOwner.toLowerCase();
  const mintKey = mintWallet.toLowerCase();
  const ownershipBasis =
    currentKey === mintKey
      ? "mint_wallet"
      : byAddress.has(currentKey)
        ? "connected_wallet"
        : "external_wallet";

  return {
    inAccount: ownershipBasis !== "external_wallet",
    ownershipBasis,
    accountWallets: [...byAddress.values()],
  };
}

export function findSeaportSaleEvidence(receipt, collectionAddress, tokenId) {
  const collection = collectionAddress.toLowerCase();
  const identifier = BigInt(tokenId);

  for (const log of receipt.logs ?? []) {
    if (!SEAPORT_CONTRACTS.has(log.address.toLowerCase())) continue;

    try {
      const decoded = decodeEventLog({
        abi: [ORDER_FULFILLED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const { offer, consideration, orderHash } = decoded.args;
      const ogInOffer = hasNft(offer, collection, identifier);
      const ogInConsideration = hasNft(consideration, collection, identifier);
      const paidForOffer = ogInOffer && hasPayment(consideration);
      const paidForConsideration = ogInConsideration && hasPayment(offer);

      if (paidForOffer || paidForConsideration) {
        return {
          marketplace: "Seaport",
          protocol: "SEAPORT",
          transactionHash: receipt.transactionHash,
          contract: log.address,
          orderHash,
        };
      }
    } catch {
      // Ignore unrelated or malformed logs, even if they share a topic.
    }
  }

  return null;
}

function hasNft(items, collection, identifier) {
  return items.some(
    (item) =>
      [2, 4].includes(Number(item.itemType)) &&
      item.token.toLowerCase() === collection &&
      BigInt(item.identifier) === identifier,
  );
}

function hasPayment(items) {
  return items.some(
    (item) => [0, 1].includes(Number(item.itemType)) && BigInt(item.amount) > 0n,
  );
}

export function mergeIdentityCandidate(existing, candidate) {
  if (!existing) return candidate;
  if (existing.matchType === "custody") return existing;
  return candidate.matchType === "custody" ? candidate : existing;
}

export function parseProfile(messages, fid) {
  const fields = {};
  for (const message of messages) {
    const body = message?.data?.userDataBody;
    if (body?.type && typeof body.value === "string") fields[body.type] = body.value;
  }

  const username = fields.USER_DATA_TYPE_USERNAME ?? `fid-${fid}`;
  return {
    username,
    displayName: fields.USER_DATA_TYPE_DISPLAY ?? username,
    pfpUrl: fields.USER_DATA_TYPE_PFP ?? null,
  };
}

export function ethereumVerificationAddresses(messages) {
  return messages.flatMap((message) => {
    const body =
      message?.data?.verificationAddAddressBody ??
      message?.data?.verificationAddEthAddressBody;
    if (
      body?.protocol === "PROTOCOL_ETHEREUM" &&
      typeof body.address === "string" &&
      body.address.startsWith("0x")
    ) {
      return [body.address];
    }
    return [];
  });
}
