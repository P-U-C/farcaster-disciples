import {
  ArrowDown,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Database,
  ExternalLink,
  GitFork,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContinuityIndex, OwnershipStatus, Person } from "./types";

type StatusFilter = "ALL" | OwnershipStatus;
type SortOrder = "OG_ASC" | "FID_ASC" | "NAME_ASC";

const REPO = "https://github.com/P-U-C/farcaster-disciples";
const PLEDGE = "https://farcaster.xyz/~/network-school";

const emptyIndex: ContinuityIndex = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  meta: {
    ogSupply: 938,
    ogHodl: 0,
    ogSold: 0,
    resolvedIdentities: 0,
    signedCount: 0,
    signedHodl: 0,
    signedSold: 0,
    identityScanMaxFid: 0,
    complete: false,
    note: "Loading the onchain census.",
  },
  contracts: {
    farcasterOg: {
      chain: "zora",
      address: "0xe03ef4b9db1a47464de84fb476f9baf493b3e886",
      deploymentBlock: 5_181_955,
    },
    networkSchoolVote: {
      chain: "base",
      address: "0x4ecfEd276c566AeB49Da1f3A888E8Dbb7263028D",
    },
    farcasterIdRegistry: {
      chain: "optimism",
      address: "0x00000000Fc6c5F01Fc30151999387Bb99A9f489b",
    },
  },
  people: [],
};

export function App() {
  const [index, setIndex] = useState<ContinuityIndex>(emptyIndex);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortOrder>("OG_ASC");
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/data/index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Index returned ${response.status}`);
        return response.json() as Promise<ContinuityIndex>;
      })
      .then(setIndex)
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setLoadError(true);
      });

    return () => controller.abort();
  }, []);

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return index.people
      .filter((person) => status === "ALL" || person.ownershipStatus === status)
      .filter((person) => {
        if (!needle) return true;
        return [
          person.username,
          person.displayName,
          String(person.fid),
          String(person.ogTokenId),
          person.mintWallet,
        ].some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "FID_ASC") return a.fid - b.fid;
        if (sort === "NAME_ASC") return a.username.localeCompare(b.username);
        return a.ogTokenId - b.ogTokenId;
      });
  }, [index.people, query, sort, status]);

  return (
    <div className="site-shell" id="top">
      <SiteHeader generatedAt={index.generatedAt} />

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                <span>ONCHAIN CENSUS</span>
                <i aria-hidden="true" />
                <span>FARCASTER × NETWORK STATE</span>
              </p>
              <h1 id="page-title">
                <span>The</span> Disciples
              </h1>
              <p className="dek">
                From the original 938 Farcaster recipients: the people who signed the Network
                School pledge, and whether they still hold.
              </p>
              <div className="hero-links">
                <a className="primary-action" href="#census">
                  Meet the disciples <ArrowDown size={17} />
                </a>
                <a href="#method">
                  Verify the method <ArrowUpRight size={16} />
                </a>
              </div>
            </div>

            <div className="hero-sigil" aria-label="The Disciples cohort seal">
              <div className="sigil-stage">
                <img src="/assets/disciples-mark.svg" alt="Three disciples gathered beneath a protocol arch" />
                <span className="seal-index" aria-hidden="true">
                  <b>III</b>
                  <i>THE ONCHAIN COHORT</i>
                </span>
              </div>
              <p>
                <span>ORIGIN</span>
                <b>→</b>
                <span>COMMITMENT</span>
              </p>
            </div>

            <figure className="culture-window">
              <img src="/assets/zoz-1304.jpg" alt="Detail from zoz.eth, Abraham First Works #1304" />
              <figcaption>
                <span>Z0Z SIGNAL</span>
                <b>FIRST WORKS #1304</b>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="scoreboard" aria-label="Census totals">
          <Stat value={index.meta.ogSupply} label="ORIGINAL RECIPIENTS" />
          <Stat value={index.meta.signedCount} label="PLEDGE SIGNERS FOUND" accent />
          <Stat value={index.meta.signedHodl} label="STILL HODLING" tone="green" />
          <Stat value={index.meta.signedSold} label="SOLD / MOVED" tone="red" />
          <div className="live-proof">
            <span className="live-dot" aria-hidden="true" />
            <div>
              <b>CHAIN READ</b>
              <small>{formatTimestamp(index.generatedAt)}</small>
            </div>
          </div>
        </section>

        <section className="census" id="census" aria-labelledby="census-title">
          <div className="section-intro">
            <div>
              <p className="section-kicker">01 / DISCIPLE LEDGER</p>
              <h2 id="census-title">Who answered the call?</h2>
            </div>
            <p>
              Every row links an original Zora mint recipient to a Farcaster FID and the
              corresponding pledge token on Base.
            </p>
          </div>

          {!index.meta.complete && (
            <div className="coverage-note" role="note">
              <CircleHelp size={18} />
              <p>
                <b>Confirmed minimum.</b> {index.meta.note} Current identity coverage is{" "}
                {index.meta.resolvedIdentities} of {index.meta.ogSupply} original recipients.
              </p>
            </div>
          )}

          {loadError && (
            <div className="error-note" role="alert">
              The live index could not be loaded. Refresh once or inspect the committed dataset.
            </div>
          )}

          <div className="controls">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search the census</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, FID, OG #, or wallet"
                type="search"
              />
            </label>

            <div className="segment" aria-label="Filter by ownership status">
              {(["ALL", "HODL", "SOLD"] as const).map((value) => (
                <button
                  className={status === value ? "active" : ""}
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                >
                  {value}
                  <span>
                    {value === "ALL"
                      ? index.meta.signedCount
                      : value === "HODL"
                        ? index.meta.signedHodl
                        : index.meta.signedSold}
                  </span>
                </button>
              ))}
            </div>

            <label className="sort-field">
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span className="sr-only">Sort census</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
                <option value="OG_ASC">OG number</option>
                <option value="FID_ASC">FID</option>
                <option value="NAME_ASC">Name</option>
              </select>
            </label>
          </div>

          <div className="ledger-heading" aria-hidden="true">
            <span>IDENTITY</span>
            <span>ORIGIN</span>
            <span>NOW</span>
            <span>PROOF</span>
          </div>

          <div className="ledger" aria-live="polite">
            {people.map((person) => (
              <PersonRow key={person.ogTokenId} person={person} onOpen={setSelected} />
            ))}
            {people.length === 0 && (
              <div className="empty-state">
                <Database size={24} />
                <p>No confirmed signer matches this view.</p>
                {(query || status !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setStatus("ALL");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="badge-key">
            <div><StatusBadge status="HODL" /> Original mint wallet still owns the OG.</div>
            <div><StatusBadge status="SOLD" /> OG moved from its original recipient.</div>
          </div>
        </section>

        <section className="method" id="method" aria-labelledby="method-title">
          <div className="method-art" aria-hidden="true">
            <span>938</span>
            <i />
            <span>{String(index.meta.signedCount).padStart(2, "0")}</span>
          </div>
          <div className="method-copy">
            <p className="section-kicker">02 / PROOF, NOT VIBES</p>
            <h2 id="method-title">Three public records.</h2>
            <ol>
              <li>
                <b>Origin</b>
                <span>Replay every Farcaster OG transfer on Zora and record each mint recipient.</span>
              </li>
              <li>
                <b>Identity</b>
                <span>Resolve custody and active verified-wallet links to a Farcaster FID.</span>
              </li>
              <li>
                <b>Commitment</b>
                <span>Confirm that FID owns the Network School VOTE token on Base.</span>
              </li>
            </ol>
            <div className="method-actions">
              <a href={REPO} target="_blank" rel="noreferrer">
                <GitFork size={17} /> Reproduce the index
              </a>
              <a href={PLEDGE} target="_blank" rel="noreferrer">
                Read the pledge <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-mark">
          <MergedMiniMark />
          <div>
            <b>THE DISCIPLES</b>
            <span>A P-U-C public ledger</span>
          </div>
        </div>
        <p>
          Disciples seal by P-U-C. Farcaster and Network State references are credited in{" "}
          <a href={`${REPO}/blob/main/THIRD_PARTY_ASSETS.md`} target="_blank" rel="noreferrer">
            the asset notes
          </a>.
          Zoz artwork detail used by its owner.
        </p>
        <a href={REPO} target="_blank" rel="noreferrer" aria-label="View source on GitHub">
          <GitFork size={19} />
        </a>
      </footer>

      {selected && <ProofDialog person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SiteHeader({ generatedAt }: { generatedAt: string }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="The Disciples home">
        <MergedMiniMark />
        <span>
          <b>THE DISCIPLES</b>
          <small>ONCHAIN LEDGER</small>
        </span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#census">Census</a>
        <a href="#method">Method</a>
      </nav>
      <div className="header-proof" title={`Indexed ${formatTimestamp(generatedAt)}`}>
        <ShieldCheck size={16} />
        <span>ONCHAIN</span>
      </div>
    </header>
  );
}

function MergedMiniMark() {
  return (
    <span className="mini-mark" aria-hidden="true">
      <img src="/assets/disciples-mark.svg" alt="" />
    </span>
  );
}

function Stat({
  value,
  label,
  accent = false,
  tone,
}: {
  value: number;
  label: string;
  accent?: boolean;
  tone?: "green" | "red";
}) {
  return (
    <div className={["stat", accent ? "accent" : "", tone ?? ""].filter(Boolean).join(" ")}>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function PersonRow({ person, onOpen }: { person: Person; onOpen: (person: Person) => void }) {
  return (
    <article className="person-row">
      <button
        className="person-main"
        type="button"
        onClick={() => onOpen(person)}
        aria-label={`Open proof for ${person.displayName}`}
      >
        <Avatar person={person} />
        <span className="identity">
          <b>{person.displayName}</b>
          <small>@{person.username} · FID {person.fid.toLocaleString()}</small>
        </span>
      </button>
      <div className="origin">
        <span>FARCASTER OG</span>
        <b>#{person.ogTokenId}</b>
      </div>
      <div className="current-state">
        <StatusBadge status={person.ownershipStatus} />
        <small>{person.ownershipStatus === "HODL" ? "at mint wallet" : "wallet changed"}</small>
      </div>
      <div className="proof-links">
        <a href={person.proofs.ogToken} target="_blank" rel="noreferrer" title="Open OG token proof">
          ZORA <ArrowUpRight size={14} />
        </a>
        <a href={person.proofs.pledgeToken} target="_blank" rel="noreferrer" title="Open pledge token proof">
          BASE <ArrowUpRight size={14} />
        </a>
      </div>
    </article>
  );
}

function Avatar({ person }: { person: Person }) {
  const [failed, setFailed] = useState(false);
  const label = person.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={`avatar seal-${person.fid % 4}`}>
      {person.pfpUrl && !failed ? (
        <img
          src={person.pfpUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <b>{label || person.ogTokenId}</b>
      )}
      <i aria-hidden="true" />
    </span>
  );
}

function StatusBadge({ status }: { status: OwnershipStatus }) {
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>
      {status === "HODL" ? <CheckCircle2 size={14} /> : <X size={14} />}
      {status}
    </span>
  );
}

function ProofDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="proof-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <p>DISCIPLE PROOF / OG #{person.ogTokenId}</p>
          <button ref={closeRef} type="button" onClick={onClose} title="Close proof">
            <X size={20} />
          </button>
        </header>
        <div className="dialog-person">
          <Avatar person={person} />
          <div>
            <h2 id="proof-title">{person.displayName}</h2>
            <p>@{person.username} · FID {person.fid.toLocaleString()}</p>
          </div>
          <StatusBadge status={person.ownershipStatus} />
        </div>
        <dl>
          <ProofItem label="Original mint wallet" value={person.mintWallet} />
          <ProofItem label="Current OG owner" value={person.currentOwner} />
          <ProofItem label="Identity link" value={`${person.matchType} · ${person.matchedAddress}`} />
          <ProofItem label="Pledge token owner" value={person.voteOwner} />
        </dl>
        <div className="dialog-links">
          <a href={person.proofs.farcasterProfile} target="_blank" rel="noreferrer">
            Farcaster profile <ArrowUpRight size={15} />
          </a>
          <a href={person.proofs.ogToken} target="_blank" rel="noreferrer">
            OG #{person.ogTokenId} <ArrowUpRight size={15} />
          </a>
          <a href={person.proofs.pledgeToken} target="_blank" rel="noreferrer">
            VOTE #{person.fid} <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
    </div>
  );
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{shorten(value)}</dd>
    </div>
  );
}

function shorten(value: string) {
  if (!value.startsWith("0x") || value.length < 20) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.valueOf() === 0) return "loading";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}
