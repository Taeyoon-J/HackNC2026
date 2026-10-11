# SPE — Student Performance Exchange

**Discover Potential. Fund Achievement.**

SPE connects patrons with students whose potential has not yet been fully recognized. Students share their ambitions and academic progress; patrons discover people they believe in and participate through **sponsorship certificates**. Our vision combines foundation-funded scholarships, an interactive exchange, and ongoing relationships between students and their supporters.

Trading is part of the experience, but the purpose is to help people recognize potential early, remain involved, and turn that support into educational opportunity.

**Prototype status:** SPE runs with synthetic student records, virtual credits, and simulated market activity. Students A–E use the scholarship formulas described below, and fixed-supply sponsorship certificates retire at settlement without repayment to holders. Scholarship reserves and certificate backing are accounted for separately, with unused balances returned to the demo treasury. Real foundation funding commitments, monthly reporting, direct encouragement and mentorship, validated probability estimates, and production privacy controls remain planned work. The latest simulation covers Students A–E and can optionally record eligible trades in the Capital One Nessie sandbox.

## Inspiration

College tuition is expensive, and scholarship opportunities are limited. Many selection processes emphasize achievement that has already been demonstrated: strong cumulative grades, awards, leadership positions, and established academic prestige. Those signals matter, but they can leave less room for students whose growth is recent or whose potential has not yet been recognized.

Consider a student who has consistently earned a 3.9 GPA and another who has improved from a 2.5 to a 3.5. The first has an excellent record. The second has also shown something worth supporting: meaningful progress. We wanted to explore a scholarship experience that makes both stories visible.

We also wanted patrons to play a more active role in discovering students. Instead of leaving every selection decision to a university or scholarship committee, what if supporters could choose whose ambitions they wanted to follow? What if that relationship continued throughout the semester?

Prediction markets inspired our use of changing expectations and participant-driven prices. Fixed-income securities inspired structured issuance, a defined term, and explicit funding rules. We adapted those ideas around student sponsorship rather than conventional investment returns.

The result is SPE: a place where patrons can discover overlooked talent, students can communicate their progress, and foundations can connect scholarship funding with achievement and community support. A student who misses one GPA target should still have a story worth hearing.

## What it does

### Connects students, patrons, and a scholarship foundation

SPE brings three participants into one experience:

- **Students** submit academic information and personal narratives, establish goals through the approval process, and become discoverable through student profiles.
- **Patrons** explore those profiles, follow students they believe in, and buy or sell sponsorship certificates through an exchange interface.
- **The scholarship foundation** reviews applications, approves listing terms, administers scholarship funding, and oversees market operations.

The proposed foundation also supplies limited market-making liquidity. Its scholarship commitments and trading resources must be managed separately so that providing quotes does not undermine its ability to support students.

### Makes academic growth visible

A profile brings together academic context, activities, ambitions, and an approved semester GPA target. Patrons should be able to understand a student's direction, not simply compare a single number.

For course grades, the prototype calculates a credit-weighted GPA:

$$
G = \operatorname{round}\left(\frac{\sum_i g_i c_i}{\sum_i c_i},\,2\right)
$$

Here, \(g_i\) is the grade-point value for course \(i\), and \(c_i\) is its credit weight. Final academic results pass through an administrative review before scholarship calculations.

Our longer-term design adds monthly progress reports: student-approved summaries of coursework, projects, challenges, and milestones. These would help patrons follow a student's journey and build a relationship beyond the initial purchase. Private verification records and public summaries would be separated, with clear labels for self-reported and independently verified information. These reporting and privacy workflows are not yet complete.

### Gives sponsorship certificates a transparent starting price

Each student listing has a fixed certificate supply. The latest fixed-supply market setup allocates 100 sponsorship certificates: 70 for public circulation and 30 in an administrator reserve. The reserve is part of the issued supply, not an additional issuance. The initial offering price is:

$$
P_0 = \frac{F p}{N}
$$

Where:

- \(P_0\) is the initial price of one sponsorship certificate.
- \(F\) is the initial foundation scholarship allocation.
- \(p\) is the initial estimated probability of achieving the approved GPA target, with \(0 < p \leq 1\).
- \(N\) is the number of certificates issued.

For an illustrative allocation of $50,000, a probability of 70%, and 100 certificates:

$$
P_0 = \frac{50{,}000 \times 0.70}{100} = \$350
$$

This is an offering-price rule, not a guaranteed valuation. The prototype uses illustrative probabilities; we have not trained or validated an academic prediction model. The initial \(p\) stays fixed in the scholarship formulas and is not automatically replaced by a changing market price.

Once trading begins, orders determine secondary-market prices. A price can reflect willingness to support a student, available liquidity, and participants' expectations. It is not a validated measure of academic potential.

### Supports an ongoing exchange

Patrons can inspect the order book, submit buy and sell orders, review trades, and track certificate holdings in a portfolio. A patron may make a trading profit by selling to another buyer, but neither a buyer nor a favorable sale price is guaranteed.

Sponsorship certificates do not confer ownership of a student or dividends. In the current fixed-supply demo, certificates retire at settlement without a cash repayment to holders, whether the GPA goal is met or missed. Their purpose is participation in student sponsorship, with trading available during the listing's term.

A market maker can support participation by quoting both sides of the market. For example, a $345 bid and $355 ask create a $10 spread around a $350 reference price. Quotes remain subject to available funds and certificate inventory; they do not guarantee unlimited liquidity.

### Calculates scholarships for two academic outcomes

At the end of a listing's term, trading closes and the student's final GPA is verified. Our proposed scholarship formula recognizes both achievement and continued community support:

$$
S =
\begin{cases}
F\left(1+\dfrac{G_{\text{final}}-G_{\text{goal}}}{p}\right),
& G_{\text{final}} \geq G_{\text{goal}} \\
P_T N_T,
& G_{\text{final}} < G_{\text{goal}}
\end{cases}
$$

Here, \(S\) is the student's scholarship, \(G_{\text{final}}\) is the verified final GPA, and \(G_{\text{goal}}\) is the approved target. \(P_T\) is the final market price under the listing's closing-price rules, and \(N_T\) is the outstanding certificate supply at that time.

**When the student meets the target**, the scholarship starts at \(F\) and increases with performance above the goal. For a $50,000 allocation, a 3.50 goal, a 3.60 final GPA, and \(p=0.70\):

$$
S = 50{,}000\left(1+\frac{3.60-3.50}{0.70}\right)
\approx \$57{,}142.86
$$

**When the student misses the target**, the proposed award uses the final certificate price and outstanding supply. If the final price is $420 and 100 certificates remain outstanding:

$$
S = 420 \times 100 = \$42{,}000
$$

These are hypothetical examples, not scholarships already awarded. The prototype implements these two scholarship branches for Students A–E using each listing's own parameters. For example, Student A has an initial allocation of $48,000, 100 certificates, a fixed probability of 0.62, and a GPA target of 3.80, giving an opening price of $297.60. A missed target does not establish a lack of potential, and a high market price does not prove academic ability.

Under the proposal, the foundation funds the student's scholarship in either outcome. The certificate market's value is not automatically cash available to pay that award. Funding commitments, bonus limits, safeguards for small probability values, and reliable final-price rules therefore remain essential design work. Our broader ambition is to direct the additional value created around a student's progress toward educational support.

### Lets patrons test an active market with Nessie

An exchange is easier to understand when it is active. SPE's live simulation lets Trader A, Trader B, and Trader C participate across the five Students A–E markets. An administrator starts a **ten-minute session** from the simulation panel. During the session, patrons can submit or cancel their own orders and observe changes to quotes, trades, and portfolios.

The server attempts a match approximately once per second, subject to available quotes, virtual funds, and certificate inventory. When a match is unavailable, a simulated trader may place a new resting quote. These are real order-book operations within the prototype, rather than a chart animation.

**Capital One Nessie provides optional sandbox trade recording.** When both parties to a confirmed trade have mapped simulation accounts, SPE queues a corresponding buyer-to-seller transfer in Nessie. The simulation generates its own orders; it does not import banking history as a signal for student potential. All credits and transfers are simulated, and no real money moves.

## How we built it

### A full-stack application

The frontend uses **React 18, TypeScript, Vite 5, Tailwind CSS 4, and React Router**. **TanStack Query** manages server data, **Zustand** supports client state, and custom SVG charts display market history. We organized the interface around student applications, foundation administration, student discovery, trading, and portfolios.

The backend uses **Python, FastAPI, and Pydantic** for API routes and validation, with **SQLAlchemy 2 and SQLite** for local persistence. **WebSockets** carry live market updates to the browser. **HTTPX** connects to Nessie, while **asyncio** drives trading attempts and the optional transfer-recording queue. The project includes backend tests with **pytest** and frontend TypeScript checks.

### Shared trading and accounting rules

Orders pass through a central limit order book using price-time priority: better prices take precedence, followed by earlier orders at the same price. Trades execute at the resting order's price.

The engine checks available virtual funds and certificate ownership, reserves resources for open orders, and releases reservations when orders are canceled. Certificate inventory is finite, and self-trading is prevented. Double-entry ledger transactions track credit movements, certificate backing, and scholarship reserves; wallet and position records track order reservations.

These rules matter equally for human participants and simulated market makers. A simulation that ignored them would not demonstrate the experience that patrons actually use.

### From live orders to Nessie sandbox records

The latest integration connects an active exchange to a mock banking record. Trader A, Trader B, and Trader C act across Students A–E, choosing orders based on the current book, available balances, and owned certificates. Aggressive orders propose one or two certificates; passive quotes propose one to three, subject to inventory and funds. Nessie transaction amounts do not determine these quantities.

Orders use the same matching engine as patron orders. Once a trade completes, SPE records its cent-accurate cash movement in the local ledger. If Nessie recording is enabled and both buyer and seller have mapped simulation accounts, the server queues a corresponding sandbox transfer.

For a price \(P\) in dollars and a traded quantity \(q\), the trade's cash value is:

$$
C = Pq
$$

The configured Nessie integration records whole-dollar transfer amounts:

$$
N_{\text{recorded}} = \operatorname{round}(C)
$$

Here, \(N_{\text{recorded}}\) is a dollar amount, not the number of certificates. For example, two certificates trading at $297.60 produce:

$$
C = 297.60 \times 2 = \$595.20
\qquad
N_{\text{recorded}} = \$595
$$

SPE retains the full $595.20 in its local ledger. The rounded Nessie record is an external sandbox representation; it does not replace SPE's accounting or determine the student's scholarship.

The pipeline is:

**Simulated and patron orders → SPE matching engine → local trade and ledger → optional Nessie sandbox transfer**

#### Session behavior

The admin interface starts ten-minute sessions. The API supports durations from one to thirty minutes. A session targets approximately one matching attempt per second, but execution is not guaranteed on every attempt. Simulated and user orders share the same book, can match with one another, and affect subsequent trading opportunities.

Starting a session resets Trader A–C for the demonstration: their open orders are canceled, and existing certificate holdings are returned to the issuer with their recorded cost basis refunded in virtual credits. This reset can affect those accounts' holdings outside Students A–E, so patrons should use a separate demo account if they want to keep their portfolio independent of the automated traders.

Stopping ends the simulation task; it does **not** automatically cancel resting orders created by the simulated traders. Orders, trades, balances, and account mappings remain in the database. Runtime counters, the transfer queue, and the active session are held in memory and do not resume after a server restart.

#### Configuration and failure handling

Nessie recording requires both `NESSIE_API_KEY` and `NESSIE_BASE_URL`, supplied through the backend process environment or a `.env` file at the repository root. Credentials stay on the server and should remain outside version control. The backend creates a sandbox customer and checking account for each simulation participant when a mapping is missing.

Recording is optional and best-effort. Trading continues when Nessie is disabled or unavailable, and the admin panel reports queued, successful, and failed transfer records. Only trades between mapped simulation participants are recorded in Nessie; other trades still remain in SPE's local ledger. A failed external record does not undo a completed local trade. Neither the simulated market nor these banking records measures academic ability.

## Challenges we ran into

### Keeping the mission clear as the mechanics evolved

A purely binary prediction market can make a missed GPA target look like a complete failure. That conflicts with our belief that growth, effort, and potential deserve attention. Designing support for both academic outcomes helped clarify the mission. We also changed fixed-supply settlement so that certificates retire without a holder repayment, keeping the student scholarship separate from the opportunity to trade during the term.

### Creating meaningful activity before a community exists

An empty order book does little to explain an exchange. Creating useful simulated activity required finite inventory, cash constraints, usable quotes, and the same execution rules as user orders. We separated trading from optional Nessie recording so that a slow or unavailable sandbox service would not dictate whether a local trade could complete. That also made rounding differences and the status of each external record explicit.

### Balancing scholarship formulas and funding commitments

Small values of \(p\) can create large achievement bonuses. A price-based scholarship can also be sensitive to limited trading or an unusual final transaction. We identified the need to refine caps, reserves, approval standards, and closing-price methods before treating the proposed awards as reliable financial commitments.

### Making information useful without exposing students

Academic context helps patrons understand a student, but a combination of details can reveal more than intended. We designed around student-approved public narratives and separate verification information, while recognizing that the current demo is not a complete privacy system. Building trust requires more than anonymized names on profile cards.

## Accomplishments that we're proud of

We built a working local application that connects student profiles, administrative review, live order books, trade history, and patron portfolios. Those pieces let someone experience the idea instead of only reading about it.

We also built an admin-controlled, ten-minute simulation across Students A–E. It accepts user participation while Trader A–C interact with the same funds, inventory, and matching constraints as the rest of the exchange. Optional Nessie recording connects eligible completed trades to mock banking records, with visible recording status and a separate, cent-accurate local ledger.

Most importantly, we developed a clearer sponsorship concept: transparent initial pricing, scholarships that can recognize more than a single successful outcome, and an experience centered on discovering students. We are proud of the working prototype and the distinction we now make between demonstrated behavior and the next version of the model.

## What we learned

**A scholarship relationship is more than a transaction.** The exchange can create an entry point, but students' stories, progress, and ambitions give patrons a reason to stay involved. That is why reporting and meaningful interaction belong in the product's next stage.

**Initial pricing and liquidity are different problems.** A formula establishes a starting point. Trading also needs available counterparties, inventory, and usable quotes. The live simulation gives us a controlled environment for exploring those interactions, while optional Nessie recording demonstrates how trade activity can be represented in a banking sandbox.

**A simulation needs honest assumptions.** Simulated trading tests how an exchange behaves; it does not establish a student's academic ability. Nessie records eligible trade activity, rather than supplying a predictive signal. Clear labels, visible failures, and an explicit distinction between local accounting and external sandbox records make the demonstration easier to understand.

**Trust depends on the surrounding process.** Correct calculations alone cannot establish academic authenticity, fair probabilities, sustainable funding, or student privacy. Those require verification, clear commitments, careful testing, and feedback from the people the platform is intended to serve.

## What's next for SPE - Student Performance Exchange

The fixed-supply demo now retires certificates without holder repayment at maturity. Our next step is to define foundation funding obligations, scholarship caps, probability safeguards, and closing-price rules more precisely, then evaluate how the model supports students in practice.

We want to build monthly student updates, progress visualizations, encouragement, and opportunities for mentorship. These features would help patrons form bonds with students and recognize achievements beyond a GPA threshold.

For the simulation, we plan to test configurable scenarios such as low participation, increased buying interest, and sustained selling pressure across the student markets. We also want durable recording queues, clearer recovery from external API failures, and improved controls for resetting automated accounts. These changes would help us evaluate market-making behavior, recording reliability, and the clarity of the patron experience.

Longer term, we want to investigate probability estimation using appropriate academic data, with calibration and fairness evaluation before presenting any model as predictive. Stronger authentication, student-controlled disclosure, and separation of private records from public profiles are also priorities. Any real-money deployment would require a suitable operating model and specialist review.

Finally, we want to test the central idea with students, patrons, and scholarship administrators: does ongoing participation help people discover overlooked talent and build meaningful support? That question matters more to us than trading volume alone.

## Our Vision

A student's future should not be defined solely by past achievement or one missed target. We want SPE to help people recognize potential early, follow its development, and turn their belief into educational opportunity.

**SPE — Discover Potential. Fund Achievement.**
