import { useState } from "react";
import { api } from "../../api/client";
import type { Action, Market, OrderResult, OrderType } from "../../api/types";
import { useAction, usePortfolio } from "../../hooks/queries";
import { TRADABLE, usd } from "../../lib/format";

interface Props {
  market: Market;
  price: number;
  onPriceChange: (p: number) => void;
}

export function OrderPanel({ market, price, onPriceChange }: Props) {
  const contract = "YES";
  const [action, setAction] = useState<Action>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [quantity, setQuantity] = useState(10);
  const [result, setResult] = useState<OrderResult | null>(null);
  const { data: portfolio } = usePortfolio();
  const place = useAction(api.placeOrder);

  const isTrader = portfolio?.user.role === "TRADER";
  const tradable = TRADABLE.includes(market.status);
  const held = portfolio?.positions.find((p) => p.market_id === market.id && p.contract === contract);
  const sellable = held ? held.quantity - held.reserved_qty : 0;

  const pendingBuys = portfolio?.open_orders.filter((o) => o.market_id === market.id && o.action === "BUY").reduce((s, o) => s + o.remaining, 0) ?? 0;
  const buyCapacity = Math.max(0, market.total_supply - (held?.quantity ?? 0) - pendingBuys);

  const effPrice = orderType === "MARKET" ? (action === "BUY" ? 99 : 1) : price;
  const total = effPrice * quantity;
  const disabledReason = !isTrader
    ? "Only traders can place orders"
    : !tradable
      ? "Market is not open for trading"
      : action === "BUY" && quantity > buyCapacity
        ? `Only ${buyCapacity} shares available after your holdings and pending buys`
      : action === "SELL" && quantity > sellable
        ? `Only ${sellable} available to sell`
        : action === "BUY" && portfolio && total > portfolio.available_cents
          ? "Insufficient balance"
          : null;

  const submit = () => {
    setResult(null);
    place.mutate(
      { market_id: market.id, contract, action, order_type: orderType, price_cents: orderType === "LIMIT" ? price : null, quantity },
      { onSuccess: setResult },
    );
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex justify-between text-sm"><strong className="text-yes">YES shares</strong><span className="text-xs text-muted">{market.total_supply} issued</span></div>

      <Segmented
        value={action}
        onChange={setAction}
        options={[
          ["BUY", "Buy"],
          ["SELL", "Sell"],
        ]}
      />
      <div className="mt-2">
        <Segmented
          value={orderType}
          onChange={setOrderType}
          options={[
            ["LIMIT", "Limit"],
            ["MARKET", "Market"],
          ]}
          small
        />
      </div>

      <div className="mt-4 space-y-3">
        {orderType === "LIMIT" && (
          <Field label={`${contract} limit price (¢)`}>
            <div className="flex gap-1">
              <StepButton onClick={() => onPriceChange(Math.max(1, price - 1))}>−</StepButton>
              <input
                type="number"
                min={1}
                max={99}
                className="input num text-center"
                value={price}
                onChange={(e) => onPriceChange(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
              />
              <StepButton onClick={() => onPriceChange(Math.min(99, price + 1))}>+</StepButton>
            </div>
          </Field>
        )}
        <Field label="Quantity (shares)" hint={`${action === "SELL" ? sellable : buyCapacity} available`}>
          <input
            type="number"
            min={1}
            max={action === "SELL" ? sellable : buyCapacity}
            className="input num"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          />
        </Field>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-lg bg-sunken p-3 text-xs">
        {action === "BUY" ? (
          <>
            <Row label={orderType === "MARKET" ? "Max reserved" : "Est. cost"} value={usd(total)} />
            <Row label={`Payout if ${contract}`} value={usd(quantity * 100)} />
            {orderType === "LIMIT" && (
              <Row label="Profit if correct" value={usd(quantity * 100 - total)} accent="text-yes" />
            )}
            <Row label="Available" value={usd(portfolio?.available_cents)} muted />
          </>
        ) : (
          <>
            <Row label={orderType === "MARKET" ? "Min proceeds" : "Est. proceeds"} value={usd(total)} />
            <Row label="Holding" value={`${held?.quantity ?? 0} ${contract}`} muted />
          </>
        )}
      </dl>

      <button
        type="button"
        onClick={submit}
        disabled={!!disabledReason || place.isPending}
        className="btn mt-4 w-full bg-yes py-2.5 text-white hover:bg-yes/90"
      >
        {place.isPending ? "Placing…" : `${action === "BUY" ? "Buy" : "Sell"} ${quantity} ${contract}`}
      </button>
      {disabledReason && <p className="mt-2 text-center text-xs text-muted">{disabledReason}</p>}
      {place.error && <p className="mt-2 rounded bg-no-soft p-2 text-xs text-no">{place.error.message}</p>}
      {result && <OrderResultNote result={result} />}
    </div>
  );
}

function OrderResultNote({ result }: { result: OrderResult }) {
  const { order, filled_quantity, avg_price_cents, trades } = result;
  const types = [...new Set(trades.map((t) => t.trade_type))];
  return (
    <div className="mt-3 rounded-lg border border-line bg-sunken p-3 text-xs">
      <div className="font-medium text-ink">
        {filled_quantity > 0
          ? `Filled ${filled_quantity} · avg ${avg_price_cents}¢ · ${usd(result.total_cents)}`
          : "No fills"}
      </div>
      <div className="mt-1 text-muted">
        {order.status === "OPEN" || order.status === "PARTIAL"
          ? `${order.remaining} resting on the book`
          : order.status === "CANCELLED"
            ? `${order.remaining} unfilled, cancelled (market order)`
            : "Fully filled"}
        {types.length > 0 && ` · ${types.join(", ")}`}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  small?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-sunken p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md ${small ? "py-1 text-xs" : "py-1.5 text-sm"} font-medium transition ${
            value === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn border border-line bg-surface px-3 hover:bg-sunken">
      {children}
    </button>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`num ${accent ?? (muted ? "text-muted" : "text-ink")}`}>{value}</dd>
    </div>
  );
}
