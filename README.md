# The Disciples

<img src="public/assets/disciples-mark.svg" alt="The Disciples cohort seal" width="128">

A public, reproducible ledger of original [Farcaster OG](https://opensea.io/collection/farcaster-og-1) recipients who signed the [Network School Farcaster pledge](https://farcaster.xyz/~/network-school), with a live **HODL**, **SOLD**, or **MOVED** status for each original NFT.

**Live site:** https://disciples.permanentupperclass.com

## What the badges mean

- **HODL** — the OG is held by the original mint wallet, the FID's current custody wallet, or any active verified Ethereum wallet on that Farcaster account.
- **SOLD** — the OG left that wallet set in a transaction containing token-level payment evidence from a canonical Seaport contract.
- **MOVED** — the OG is outside that wallet set, but no supported marketplace settlement proves a sale.

A security transfer between wallets connected to the same Farcaster account remains HODL. An unlinked transfer is MOVED rather than SOLD unless the transaction itself proves a paid Seaport settlement.

## Reproduce it

```bash
npm ci
npm run index:discover
npm run verify
npm run dev
```

Open http://localhost:4174.

A normal refresh reuses the committed identity cache and only rereads chain state:

```bash
npm run index
```

## Method

1. Replay every ERC-721 transfer from the Farcaster OG contract on Zora. The first transfer from the zero address identifies the original recipient; the latest transfer identifies the current owner.
2. Resolve original recipient wallets to FIDs using the Farcaster IdRegistry on Optimism and active Ethereum verification messages from public Farcaster nodes.
3. Build each matched FID's current wallet set from its mint wallet, Optimism custody wallet, and active verified Ethereum wallets.
4. Classify the OG as HODL when its current owner remains in that set.
5. For OGs outside the set, inspect their transfer receipts. Require a canonical Seaport `OrderFulfilled` event containing the exact OG contract/token and a nonzero native or ERC-20 payment before assigning SOLD; otherwise assign MOVED.
6. Call `ownerOf(fid)` on the Network School `VOTE` contract on Base. A successful call proves that FID signed.
7. Read public Farcaster profile messages for the matched FIDs.

The generated dataset is committed at [`public/data/index.json`](public/data/index.json). Identity links are cached separately at [`data/identity-cache.json`](data/identity-cache.json) so routine refreshes do not rescan the social graph.

## Coverage

The dashboard reports a **confirmed minimum**, not an exhaustive historical claim. Removed verification messages and wallets no longer linked to a Farcaster account can hide a valid original-recipient relationship. SOLD currently recognizes canonical Seaport 1.5 and 1.6 settlements; unsupported marketplaces remain MOVED rather than being guessed as sales. The site states this limitation next to the census.

The weekly discovery job scans the FID range occupied by the original cohort. Daily jobs refresh OG ownership, pledge ownership, and public profile data.

## Contracts

| Record | Chain | Address |
| --- | --- | --- |
| Farcaster OG | Zora | `0xe03ef4b9db1a47464de84fb476f9baf493b3e886` |
| Network School VOTE | Base | `0x4ecfEd276c566AeB49Da1f3A888E8Dbb7263028D` |
| Farcaster IdRegistry | Optimism | `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` |

## Automation

GitHub Actions refreshes and deploys the index daily. Sundays perform the broader identity discovery pass. All RPC and node URLs can be overridden with environment variables documented in the indexer source.

## License and marks

Code is MIT licensed. Bundled visual assets have separate terms described in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).
