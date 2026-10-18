import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  createPublicClient,
  fallback,
  getAddress,
  http,
  parseAbi,
  parseAbiItem,
} from "viem";
import { base, optimism, zora } from "viem/chains";
import {
  ethereumVerificationAddresses,
  mergeIdentityCandidate,
  parseProfile,
  replayOgTransfers,
} from "./lib.mjs";

const ROOT = new URL("../", import.meta.url);
const CACHE_PATH = new URL("data/identity-cache.json", ROOT);
const OUTPUT_PATH = new URL("public/data/index.json", ROOT);
const DISCOVER = process.argv.includes("--discover");
const MAX_FID = Number(process.env.IDENTITY_SCAN_MAX_FID ?? 22_000);

const CONTRACTS = {
  og: {
    address: "0xe03ef4b9db1a47464de84fb476f9baf493b3e886",
    deploymentBlock: 5_181_955n,
  },
  vote: {
    address: "0x4ecfEd276c566AeB49Da1f3A888E8Dbb7263028D",
  },
  idRegistry: {
    address: "0x00000000Fc6c5F01Fc30151999387Bb99A9f489b",
  },
};

const zoraClient = createPublicClient({
  chain: zora,
  transport: fallback([
    http(process.env.ZORA_RPC_URL ?? "https://rpc.zora.energy", { timeout: 30_000 }),
    http("https://zora.drpc.org", { timeout: 30_000 }),
  ]),
});

const optimismClient = createPublicClient({
  chain: optimism,
  transport: fallback([
    http(process.env.OPTIMISM_RPC_URL ?? "https://mainnet.optimism.io", { timeout: 30_000 }),
    http("https://optimism.drpc.org", { timeout: 30_000 }),
  ]),
});

const baseClient = createPublicClient({
  chain: base,
  transport: fallback([
    http(process.env.BASE_RPC_URL ?? "https://base.gateway.tenderly.co", { timeout: 30_000 }),
    http("https://mainnet.base.org", { timeout: 30_000 }),
  ]),
});

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);
const idRegistryAbi = parseAbi([
  "function idOf(address owner) view returns (uint256)",
]);
const erc721Abi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

await mkdir(new URL("data/", ROOT), { recursive: true });
await mkdir(new URL("public/data/", ROOT), { recursive: true });

console.log("Reading Farcaster OG transfer history...");
const ogTokens = await fetchOgTokens();
const byToken = new Map(ogTokens.map((token) => [token.tokenId, token]));

let identityCache;
if (DISCOVER || !existsSync(CACHE_PATH)) {
  identityCache = await discoverIdentities(ogTokens);
  await writeFile(CACHE_PATH, `${JSON.stringify(identityCache, null, 2)}\n`);
  console.log(`Saved ${identityCache.entries.length} identity links.`);
} else {
  identityCache = JSON.parse(await readFile(CACHE_PATH, "utf8"));
}

const candidates = identityCache.entries.flatMap((entry) => {
  const token = byToken.get(entry.ogTokenId);
  if (!token) return [];
  return [{
    ...token,
    fid: entry.fid,
    matchType: entry.matchType,
    matchedAddress: entry.matchedAddress,
  }];
});

console.log(`Checking ${candidates.length} resolved identities against the pledge...`);
const voteResults = await baseClient.multicall({
  allowFailure: true,
  batchSize: 4_096,
  contracts: candidates.map((candidate) => ({
    address: CONTRACTS.vote.address,
    abi: erc721Abi,
    functionName: "ownerOf",
    args: [BigInt(candidate.fid)],
  })),
});

const signed = candidates.flatMap((candidate, index) => {
  const result = voteResults[index];
  return result.status === "success"
    ? [{ ...candidate, voteOwner: getAddress(result.result) }]
    : [];
});

console.log(`Enriching ${signed.length} signed identities...`);
const people = [];
for (const group of chunks(signed, 50)) {
  const enriched = await Promise.all(
    group.map(async (person) => {
      const profile = parseProfile(
        (await fetchHub(`/v1/userDataByFid?fid=${person.fid}`)).messages ?? [],
        person.fid,
      );
      const username = profile.username;
      return {
        fid: person.fid,
        username,
        displayName: profile.displayName,
        pfpUrl: safePfpUrl(profile.pfpUrl),
        ogTokenId: person.tokenId,
        mintWallet: getAddress(person.mintWallet),
        currentOwner: getAddress(person.currentOwner),
        ownershipStatus: person.status,
        matchedAddress: getAddress(person.matchedAddress),
        matchType: person.matchType,
        voteOwner: person.voteOwner,
        proofs: {
          ogToken: `https://opensea.io/assets/zora/${CONTRACTS.og.address}/${person.tokenId}`,
          pledgeToken: `https://basescan.org/nft/${CONTRACTS.vote.address}/${person.fid}`,
          farcasterProfile: username.startsWith("fid-")
            ? `https://farcaster.xyz/~/profiles/${person.fid}`
            : `https://farcaster.xyz/${encodeURIComponent(username)}`,
        },
      };
    }),
  );
  people.push(...enriched);
}

people.sort((a, b) => a.ogTokenId - b.ogTokenId);
const hodl = ogTokens.filter((token) => token.status === "HODL").length;
const signedHodl = people.filter((person) => person.ownershipStatus === "HODL").length;

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  meta: {
    ogSupply: ogTokens.length,
    ogHodl: hodl,
    ogSold: ogTokens.length - hodl,
    resolvedIdentities: candidates.length,
    signedCount: people.length,
    signedHodl,
    signedSold: people.length - signedHodl,
    identityScanMaxFid: identityCache.identityScanMaxFid,
    complete: false,
    note:
      "This is the confirmed set from current custody and active verified-wallet links. Removed historical wallet links can make the true overlap larger.",
  },
  contracts: {
    farcasterOg: {
      chain: "zora",
      address: CONTRACTS.og.address,
      deploymentBlock: Number(CONTRACTS.og.deploymentBlock),
    },
    networkSchoolVote: {
      chain: "base",
      address: CONTRACTS.vote.address,
    },
    farcasterIdRegistry: {
      chain: "optimism",
      address: CONTRACTS.idRegistry.address,
    },
  },
  people,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote ${people.length} signers: ${signedHodl} HODL, ${people.length - signedHodl} SOLD.`,
);

function safePfpUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return ["imagedelivery.net", "res.cloudinary.com"].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function fetchOgTokens() {
  const latest = await zoraClient.getBlockNumber();
  const logs = [];

  for (
    let fromBlock = CONTRACTS.og.deploymentBlock;
    fromBlock <= latest;
    fromBlock += 500_000n
  ) {
    const toBlock =
      fromBlock + 499_999n > latest ? latest : fromBlock + 499_999n;
    const page = await zoraClient.getLogs({
      address: CONTRACTS.og.address,
      event: transferEvent,
      fromBlock,
      toBlock,
    });
    logs.push(...page);
  }

  return replayOgTransfers(
    logs.map((log) => ({
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      from: log.args.from,
      to: log.args.to,
      tokenId: log.args.tokenId,
    })),
  );
}

async function discoverIdentities(tokens) {
  console.log(`Discovering identity links through FID ${MAX_FID}...`);
  const byWallet = new Map(
    tokens.map((token) => [token.mintWallet.toLowerCase(), token]),
  );
  const candidates = new Map();

  const custodyResults = await optimismClient.multicall({
    allowFailure: true,
    batchSize: 4_096,
    contracts: tokens.map((token) => ({
      address: CONTRACTS.idRegistry.address,
      abi: idRegistryAbi,
      functionName: "idOf",
      args: [token.mintWallet],
    })),
  });

  tokens.forEach((token, index) => {
    const result = custodyResults[index];
    if (result.status === "success" && result.result > 0n) {
      candidates.set(token.tokenId, {
        ogTokenId: token.tokenId,
        fid: Number(result.result),
        matchType: "custody",
        matchedAddress: token.mintWallet,
      });
    }
  });

  for (let start = 1; start <= MAX_FID; start += 100) {
    const fids = Array.from(
      { length: Math.min(100, MAX_FID - start + 1) },
      (_, index) => start + index,
    );
    const responses = await Promise.all(
      fids.map((fid) => fetchHub(`/v1/verificationsByFid?fid=${fid}`)),
    );

    responses.forEach((response, index) => {
      const fid = fids[index];
      for (const address of ethereumVerificationAddresses(response.messages ?? [])) {
        const token = byWallet.get(address.toLowerCase());
        if (!token) continue;
        const candidate = {
          ogTokenId: token.tokenId,
          fid,
          matchType: "verified",
          matchedAddress: address,
        };
        candidates.set(
          token.tokenId,
          mergeIdentityCandidate(candidates.get(token.tokenId), candidate),
        );
      }
    });

    if ((start - 1) % 2_000 === 0) {
      console.log(
        `  FID ${Math.min(start + 99, MAX_FID)}: ${candidates.size} OG identities`,
      );
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    identityScanMaxFid: MAX_FID,
    entries: [...candidates.values()].sort((a, b) => a.ogTokenId - b.ogTokenId),
  };
}

async function fetchHub(path, attempt = 0) {
  const hosts = [
    process.env.FARCASTER_HUB_URL,
    "https://haatz.quilibrium.com",
    "https://hypersnap.publicproof.org",
  ].filter(Boolean);

  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${path}`, {
        headers: { "user-agent": "P-U-C-continuity-index/0.1" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return await response.json();
    } catch {
      // Try the next public node.
    }
  }

  if (attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    return fetchHub(path, attempt + 1);
  }

  return { messages: [] };
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
