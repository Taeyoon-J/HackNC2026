export type Contract = "YES" | "NO";
export type Action = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type MarketStatus =
  | "DRAFT"
  | "PRICE_DISCOVERY"
  | "SCHOLARSHIP_LOCKED"
  | "TRADING"
  | "CLOSED"
  | "RESOLVED"
  | "SETTLED";

export interface User {
  id: string;
  role: "STUDENT" | "TRADER" | "ADMIN";
  display_name: string;
  available_cents: number;
  reserved_cents: number;
}

export interface StudentBrief {
  id: string;
  name: string;
  university: string;
  year: string;
  major: string;
  verified: boolean;
}

export interface Scholarship {
  probability: number;
  promised_cents: number;
  status: "LOCKED" | "PAID" | "VOID";
  locked_at: string;
  paid_at: string | null;
}

export interface Market {
  id: string;
  question: string;
  metric: string;
  term: string;
  threshold: number;
  deadline: string;
  status: MarketStatus;
  outcome: Contract | null;
  resolved_value: number | null;
  last_price: number | null;
  volume: number;
  student: StudentBrief;
  scholarship: Scholarship | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  vwap_24h: number | null;
  trades_24h: number;
  volume_24h: number;
  change_24h: number | null;
  minted_pairs?: number;
  collateral_cents?: number;
}

export interface Level {
  price: number;
  quantity: number;
  orders: number;
}

export interface OrderBook {
  bids: Level[];
  asks: Level[];
}

export type TradeType = "MINT" | "TRANSFER_YES" | "TRANSFER_NO" | "BURN";

export interface Trade {
  id: number;
  market_id: string;
  trade_type: TradeType;
  taker_side: "BID" | "ASK";
  yes_price: number;
  quantity: number;
  executed_at: string;
}

export interface HistoryPoint {
  t: number;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  market_id: string;
  user_id: string;
  contract: Contract;
  action: Action;
  order_type: OrderType;
  price_cents: number;
  book_side: "BID" | "ASK";
  yes_price_cents: number;
  quantity: number;
  remaining: number;
  filled: number;
  status: "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED";
  created_at: string;
}

export interface OrderResult {
  order: Order;
  trades: Trade[];
  filled_quantity: number;
  avg_price_cents: number | null;
  total_cents: number;
}

export interface PositionRow {
  market_id: string;
  question: string;
  market_status: MarketStatus;
  contract: Contract;
  quantity: number;
  reserved_qty: number;
  cost_basis_cents: number;
  avg_cost_cents: number;
  mark_cents: number | null;
  market_value_cents: number;
  unrealized_pnl_cents: number;
}

export interface SettlementRow {
  market_id: string;
  contract: Contract;
  quantity: number;
  payout_cents: number;
  created_at: string;
}

export interface Portfolio {
  user: { id: string; role: string; display_name: string };
  available_cents: number;
  reserved_cents: number;
  positions_value_cents: number;
  positions: PositionRow[];
  open_orders: Order[];
  settlements: SettlementRow[];
}

export interface Disclosure {
  id: number;
  type: "GPA_HISTORY" | "COURSE_LOAD" | "ACTIVITY" | "APPLICATION";
  title: string;
  data: any;
  verified_at: string | null;
}

export interface StudentProfile extends StudentBrief {
  disclosures: Disclosure[];
  markets: { id: string; question: string; status: MarketStatus }[];
}

export interface LockPreview {
  vwap_24h: number | null;
  trades_24h: number;
  volume_24h: number;
  sufficient: boolean;
  min_trades: number;
  min_volume: number;
  suggested_probability: number | null;
  suggested_cents: number | null;
}

export interface InvariantCheck {
  name: string;
  ok: boolean;
  detail: string;
}
