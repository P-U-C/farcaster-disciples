export type OwnershipStatus = "HODL" | "SOLD" | "MOVED";
export type OwnershipBasis = "mint_wallet" | "connected_wallet" | "external_wallet";
export type MatchType = "custody" | "verified";

export interface MarketplaceEvidence {
  marketplace: "Seaport";
  protocol: "SEAPORT";
  transactionHash: string;
  contract: string;
  orderHash: string;
  proofUrl: string;
}

export interface Person {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
  ogTokenId: number;
  mintWallet: string;
  currentOwner: string;
  custodyAddress: string;
  accountWallets: string[];
  ownershipStatus: OwnershipStatus;
  ownershipBasis: OwnershipBasis;
  marketplaceEvidence: MarketplaceEvidence | null;
  matchedAddress: string;
  matchType: MatchType;
  voteOwner: string;
  proofs: {
    ogToken: string;
    pledgeToken: string;
    farcasterProfile: string;
  };
}

export interface ContinuityIndex {
  schemaVersion: 3;
  generatedAt: string;
  meta: {
    ogSupply: number;
    ogAtMintWallet: number;
    ogMovedFromMintWallet: number;
    resolvedIdentities: number;
    signedCount: number;
    signedHodl: number;
    signedSold: number;
    signedMoved: number;
    identityScanMaxFid: number;
    complete: boolean;
    note: string;
  };
  contracts: {
    farcasterOg: { chain: "zora"; address: string; deploymentBlock: number };
    networkSchoolVote: { chain: "base"; address: string };
    farcasterIdRegistry: { chain: "optimism"; address: string };
  };
  people: Person[];
}
