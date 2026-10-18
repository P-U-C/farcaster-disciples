export type OwnershipStatus = "HODL" | "SOLD";
export type MatchType = "custody" | "verified";

export interface Person {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
  ogTokenId: number;
  mintWallet: string;
  currentOwner: string;
  ownershipStatus: OwnershipStatus;
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
  schemaVersion: 1;
  generatedAt: string;
  meta: {
    ogSupply: number;
    ogHodl: number;
    ogSold: number;
    resolvedIdentities: number;
    signedCount: number;
    signedHodl: number;
    signedSold: number;
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
