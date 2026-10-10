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
  username?: string;
  has_password?: boolean;
}

export interface StudentBrief {
  id: string;
  name: string;
  university: string;
  year: string;
  major: string;
  cumulative_gpa: number | null;
  introduction: string;
  pitch: string;
  verified: boolean;
  status: "ACTIVE" | "DELISTED";
}

export interface Scholarship {
  probability: number;
  promised_cents: number;
  status: "INITIAL" | "LOCKED" | "PAID" | "VOID";
  locked_at: string;
  paid_at: string | null;
}

export interface Market {
  id: string;
  total_supply: number;
  initial_scholarship_cents: number;
  final_price: number | null;
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
  student?: StudentBrief;
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
  student: StudentBrief;
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

export type DisclosureType = "GPA_HISTORY" | "COURSE_LOAD" | "ACTIVITY" | "APPLICATION" | "BIOGRAPHY";

export interface Disclosure {
  id: number;
  type: DisclosureType;
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

export interface MyStudent extends StudentBrief {
  user_id: string;
  wallet_cents: number;
  disclosures: Disclosure[];
  markets: Market[];
}

export interface AdminStudent extends StudentBrief {
  user_id: string;
  pending_disclosures: number;
  markets: { id: string; status: MarketStatus; threshold: number; term: string }[];
}

export interface DirectoryFilters {
  q: string;
  university: string;
  major: string;
  state: string;
  page: number;
}

export interface DirectoryPage<T> {
  items: T[];
  total: number;
  total_all: number;
  page: number;
  page_size: number;
  universities: string[];
  majors: string[];
  summary: { pledged_cents?: number; paid_cents?: number; needs_review?: number; delisted?: number };
}

export interface AdminStudentDetail extends AdminStudent {
  disclosures: Disclosure[];
}

export interface CourseRecord { code: string; name: string; credits: number; gpa?: number }
export type VerificationType = "UNIVERSITY" | "MAJOR" | "COURSE_LOAD" | "FINAL_GPA" | "BIOGRAPHY" | "ACTIVITY" | "APPLICATION";
export interface Verification {
  id: number;
  student: StudentBrief;
  type: VerificationType;
  payload: { value?: string; previous?: any; data?: any; term?: string; market_id?: string; courses?: CourseRecord[]; credits?: number; gpa?: number };
  evidence: string;
  evidence_file?: EvidenceFile | null;
  file_name: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
}
export interface EvidenceFile { name: string; content_type: string; data_base64: string }
export interface VerificationInput { type: VerificationType; payload: Verification["payload"]; evidence: string; evidence_file?: EvidenceFile | null }
export interface VerificationPage { items: Verification[]; total: number; page: number; page_size: number }
export interface Account { user_id: string; username: string; has_password: boolean }
export interface GpaAverage { term: string; gpa: number; students: number }
