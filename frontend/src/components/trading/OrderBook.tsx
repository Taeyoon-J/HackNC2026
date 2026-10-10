import type { Contract, Level, OrderBook as Book } from "../../api/types";
import { qty } from "../../lib/format";

interface Props {
  book: Book | undefined;
  view: Contract;
  /** Called with a price in the viewed contract's terms. */
  onPick?: (price: number) => void;
}

/**
 * The engine keeps a single YES book. The NO view is derived: a YES ask at p is a NO bid
 * at 100-p and a YES bid at p is a NO ask at 100-p.
 */
export function OrderBook({ book, view, onPick }: Props) {
  const flip = (levels: Level[]) => levels.map((l) => ({ ...l, price: 100 - l.price }));
  const bids = (view === "YES" ? book?.bids : flip(book?.asks ?? [])) ?? [];
  const asks = (view === "YES" ? book?.asks : flip(book?.bids ?? [])) ?? [];
  const maxQty = Math.max(1, ...bids.map((l) => l.quantity), ...asks.map((l) => l.quantity));
  const spread = bids[0] && asks[0] ? asks[0].price - bids[0].price : null;

  return (
    <div className="card">
      <div className="card-title flex items-center justify-between border-b border-line px-4 py-3">
        <span>Order book · {view}</span>
        <span className="font-normal normal-case tracking-normal text-muted">Click a level to use its price</span>
      </div>
      <div className="grid grid-cols-2 px-4 py-2 text-[11px] text-muted">
        <span>Price</span>
        <span className="text-right">Qty</span>
      </div>
      <div className="flex flex-col-reverse">
        {asks.map((l) => (
          <Row key={`a${l.price}`} level={l} side="ask" maxQty={maxQty} onPick={onPick} />
        ))}
      </div>
      <div className="num border-y border-line bg-sunken px-4 py-1.5 text-center text-xs text-muted">
        {spread != null ? `Spread ${spread}¢` : "No quotes"}
      </div>
      <div>
        {bids.map((l) => (
          <Row key={`b${l.price}`} level={l} side="bid" maxQty={maxQty} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function Row({ level, side, maxQty, onPick }: { level: Level; side: "bid" | "ask"; maxQty: number; onPick?: (p: number) => void }) {
  const color = side === "bid" ? "text-yes" : "text-no";
  const bar = side === "bid" ? "bg-yes/10" : "bg-no/10";
  return (
    <button
      type="button"
      onClick={() => onPick?.(level.price)}
      className="relative grid w-full grid-cols-2 px-4 py-1 text-xs hover:bg-sunken"
    >
      <span className={`absolute inset-y-0 right-0 ${bar}`} style={{ width: `${(level.quantity / maxQty) * 100}%` }} />
      <span className={`num relative text-left font-medium ${color}`}>{level.price}¢</span>
      <span className="num relative text-right text-body">{qty(level.quantity)}</span>
    </button>
  );
}
