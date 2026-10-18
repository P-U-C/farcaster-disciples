export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function replayOgTransfers(logs) {
  const ordered = [...logs].sort(
    (a, b) =>
      Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) ||
      Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
  );
  const original = new Map();
  const current = new Map();

  for (const log of ordered) {
    const tokenId = Number(log.tokenId);
    if (log.from.toLowerCase() === ZERO_ADDRESS) {
      original.set(tokenId, log.to);
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
        status:
          currentOwner.toLowerCase() === mintWallet.toLowerCase() ? "HODL" : "SOLD",
      };
    });
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
