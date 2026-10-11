import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/layout/Header";
import { ROLE_HOME, useSession } from "../store/user";
import "./landing.css";

function Arrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const roles = [
  { label: "Patrons", title: "Choose whose potential you believe in.", text: "Discover students through their ambitions, academic growth, and personal stories. Follow the people you believe in and participate through sponsorship certificates.", detail: "Trading gains can be part of participation. The purpose is a lasting interest in a student’s journey, with monthly updates and opportunities for encouragement planned next.", steps: ["Discover a student’s story", "Participate through certificates", "Stay connected to their progress"] },
  { label: "Students", title: "Show the person behind the grades.", text: "Share your academic context, activities, and ambitions. Reviewed profiles help potential patrons understand where you are going and what support could make possible.", detail: "The proposed scholarship model recognizes achievement and continued community support. Missing a GPA target does not have to mean losing every opportunity.", steps: ["Tell your story", "Establish an approved goal", "Build toward your next milestone"] },
  { label: "Foundation", title: "Connect belief with dependable support.", text: "Review applications and academic records, approve listing terms, and oversee the exchange. The foundation is responsible for funding the proposed scholarships.", detail: "Scholarship commitments and trading liquidity need separate resources. Limited market-making quotes can support participation without promising a buyer for every order.", steps: ["Review and approve", "Oversee market participation", "Verify results and fund awards"] },
];

const stack = [
  ["01", "Interface", "React 18 + TypeScript", "Vite 5 serves the app. Tailwind CSS 4 and custom CSS shape the interface; React Router handles navigation."],
  ["02", "State & updates", "TanStack Query + Zustand", "Query caches server data. Zustand holds the demo session. Price and GPA charts use SVG. WebSocket events invalidate queries, then REST fetches fresh state."],
  ["03", "API & rules", "Python + FastAPI", "Pydantic validates inputs. The server owns order matching, verification, scholarship calculations, and the live trading simulation. Uvicorn runs the API."],
  ["04", "Storage", "SQLite + SQLAlchemy 2", "Orders, positions, verification records, ledger entries, and Nessie account mappings persist in SQLite. Simulation counters and its transfer queue live in memory."],
  ["05", "Simulation", "Live simulation + Nessie", "An asyncio task attempts trades across Students A–E. HTTPX optionally records eligible confirmed trades as Nessie sandbox transfers."],
  ["06", "Validation", "pytest + TypeScript", "Backend tests cover matching, accounting, verification, and simulation behavior. The frontend build runs TypeScript before Vite bundles the app."],
];

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

function ScholarshipExample() {
  const [gpa, setGpa] = useState(3.6);
  const [finalPrice, setFinalPrice] = useState(420);
  const goalMet = gpa >= 3.5;
  const scholarship = goalMet ? 50000 * (1 + (gpa - 3.5) / 0.7) : 100 * finalPrice;
  return <div className="lp-calculator">
    <div>
      <p className="lp-eyebrow">Explore the scholarship award</p>
      <h3>One student. Two possible outcomes.</h3>
      <p className="lp-calculator-note">Hypothetical example: F = $50,000, N = 100, G_goal = 3.50, and p = 0.70. These are the project description’s example values, not Student A’s market settings.</p>
      <label htmlFor="example-gpa">Final verified GPA <strong>{gpa.toFixed(2)}</strong></label>
      <input id="example-gpa" type="range" min="0" max="4" step="0.01" value={gpa} onChange={(e) => setGpa(Number(e.target.value))} />
      <label htmlFor="example-price">Final certificate price <strong>{money(finalPrice)}</strong></label>
      <input id="example-price" type="range" min="0.01" max="500" step="0.01" value={finalPrice} onChange={(e) => setFinalPrice(Number(e.target.value))} />
      <p className="lp-calculator-note">Final price affects the award only below the GPA goal. The price slider explores $0.01–$500; that range is an illustration, not a proposed market limit.</p>
    </div>
    <div className="lp-calculator-result" aria-live="polite">
      <span className="lp-model-tag">Scholarship model · virtual example</span>
      <span className="lp-small-label">Student scholarship · {goalMet ? "goal met" : "goal missed"}</span>
      <strong>{money(Math.round(scholarship * 100) / 100)}</strong>
      <code>{goalMet ? "50,000 × (1 + (" + gpa.toFixed(2) + " − 3.50) / 0.70)" : finalPrice.toFixed(2) + " × 100"}</code>
      <p>At exactly 3.50 GPA, the award is $50,000. Below the goal, a final price of $420 produces $42,000. The foundation funds the scholarship; changing these controls does not change the market.</p>
    </div>
  </div>;
}

function LocalSetup() {
  const [windows, setWindows] = useState(true);
  const backend = windows
    ? "cd backend\npython -m venv .venv\n.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000"
    : "cd backend\npython3 -m venv .venv\n.venv/bin/python -m pip install -r requirements.txt\n.venv/bin/python -m uvicorn app.main:app --reload --port 8000";
  return <section className="lp-container lp-section lp-setup" id="run-locally" aria-labelledby="setup-title">
    <div className="lp-role-header"><div><p className="lp-eyebrow">08 / Run this checkout</p><h2 id="setup-title">From the guide to the demo.</h2></div><div className="lp-role-buttons" role="group" aria-label="Operating system"><button type="button" aria-pressed={windows} onClick={() => setWindows(true)}>Windows</button><button type="button" aria-pressed={!windows} onClick={() => setWindows(false)}>macOS / Linux</button></div></div>
    <p className="lp-section-intro">With Python and Node.js installed, open two terminals at the repository root. This guide describes the local checkout, including its optional Nessie integration.</p>
    <div className="lp-code-grid"><div><h3>01 / Backend</h3><pre><code>{backend}</code></pre></div><div><h3>02 / Frontend</h3><pre><code>{"cd frontend\nnpm ci\nnpm run dev"}</code></pre><p>Open <code>localhost:5173</code>. Vite forwards <code>/api</code> and <code>/ws</code> to port 8000.</p></div></div>
    <details className="lp-technical-detail"><summary>Configure Nessie transfer recording <span aria-hidden="true">+</span></summary><div><p>Set <code>NESSIE_API_KEY</code> and <code>NESSIE_BASE_URL</code> in the backend process environment or the repository-root <code>.env</code> file. Keep credentials on the server and out of Git.</p><p>Choose the Admin demo account and open System to start the ten-minute simulation. Nessie recording is optional; local trading can run without it. Starting a session cancels Trader A–C orders and resets their certificate holdings, so use these demo accounts deliberately.</p></div></details>
    <details className="lp-technical-detail"><summary>Validation and prototype boundaries <span aria-hidden="true">+</span></summary><div><p>Run <code>python -m pytest -q</code> with the backend environment active. Run <code>npm run build</code> from the frontend directory for type checking and a production build.</p><p>All student records are synthetic and all credits are virtual. The local demo assumes a single backend worker and uses demonstration account authentication. Monthly reporting, patron messaging, and mentorship remain planned work. Stopping the simulation ends new attempts but leaves resting orders in the book; restarting the server does not resume a session.</p></div></details>
  </section>;
}

export function LandingPage() {
  const role = useSession((s) => s.role);
  const demoPath = role ? ROLE_HOME[role] : "/login";
  const [showProgress, setShowProgress] = useState(false);
  const [perspective, setPerspective] = useState(0);
  const selected = roles[perspective];

  return <div className="spe-landing">
    <a className="lp-skip" href="#main-content">Skip to content</a>
    <header className="lp-header lp-container">
      <Link className="lp-wordmark" to="/welcome" aria-label="SPE home"><Logo size="h-10 w-10" /><span>SPE<span className="lp-wordmark-caption">Student Performance Exchange</span></span></Link>
      <nav aria-label="Main navigation"><a href="#methods">Methods</a><a href="#model">Formulas</a><a href="#simulation">Nessie</a><Link className="lp-button lp-button-small" to={demoPath}>Open demo <Arrow /></Link></nav>
    </header>
    <main id="main-content">
      <section className="lp-hero lp-container" aria-labelledby="hero-title">
        <div className="lp-hero-copy"><p className="lp-eyebrow"><span className="lp-dot" /> Project guide · HackNC 2026</p><h1 id="hero-title">Discover potential.<br /><em>Fund achievement.</em></h1><p className="lp-intro">A scholarship exchange for talent that has yet to be recognized. Discover students, follow their growth, and participate through sponsorship certificates. Build a connection around who they can become.</p><div className="lp-hero-actions"><a className="lp-button" href="#overview">Explore the idea <Arrow /></a><a className="lp-text-link" href="#model">Read the model <span aria-hidden="true">↓</span></a></div><p className="lp-fineprint">The idea, the mathematics, and a live demo with optional Nessie records.</p></div>
        <div className="lp-market-scene"><span className="lp-orbit lp-orbit-one" aria-hidden="true" /><span className="lp-orbit lp-orbit-two" aria-hidden="true" /><div className="lp-scene-label"><span>A STUDENT WORTH GETTING TO KNOW</span><span aria-hidden="true">↗</span></div>
          <article className="lp-market-card" aria-label="Student A discovery preview"><div className="lp-market-heading"><span className="lp-avatar">A</span><div><h2>Student A</h2><p>Computer Science · UNC Chapel Hill</p></div><span className="lp-demo-tag">Demo profile</span></div><p className="lp-student-title">Building a future<br /><em>in education.</em></p><p className="lp-student-intro">Exploring programming, machine learning, and an education project.</p><div className="lp-student-interests"><span>Education</span><span>Technology</span><span>Learning by building</span></div>
            <div className="lp-story-toggle" role="group" aria-label="Get to know Student A"><button type="button" aria-pressed={!showProgress} onClick={() => setShowProgress(false)}>Their ambition</button><button type="button" aria-pressed={showProgress} onClick={() => setShowProgress(true)}>Their progress</button></div><div className="lp-student-story" aria-live="polite"><span className="lp-small-label">{showProgress ? "A snapshot of the journey" : "From Student A’s demo profile"}</span>{showProgress ? <p>Studying machine learning, databases, and algorithms, with seven hours each week dedicated to an education project.</p> : <blockquote>“A scholarship would help me dedicate more time to my education project.”</blockquote>}</div><Link className="lp-profile-link" to={role ? "/markets/STU001-GPA-2026F" : "/login"}>Get to know Student A <Arrow /></Link>
          </article><div className="lp-record-stamp"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="7" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-6a5 5 0 0 1 6 5v1" /></svg><span>Every connection starts somewhere.<small>See the person behind the progress.</small></span></div>
        </div>
      </section>

      <nav className="lp-guide-index lp-container" aria-label="Guide contents">
        <span>IN THIS GUIDE</span>
        <a href="#overview">01 · Inspiration</a><a href="#methods">02 · How it works</a>
        <a href="#model">03 · Formulas</a><a href="#simulation">04 · Nessie</a>
        <a href="#technology">05 · How we built it</a><a href="#lessons">06 · Lessons</a>
        <a href="#next">07 · What’s next</a><a href="#run-locally">08 · Run locally</a>
      </nav>

      <section className="lp-process lp-container lp-section" id="overview" aria-labelledby="overview-title">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">01 / Inspiration</p>
          <h2 id="overview-title">Achievement matters.<br /><em>So does becoming.</em></h2>
          <p>College is costly. Scholarship decisions often reward achievement that is already visible. We wanted to make room for the student whose growth is recent, whose ambition is clear, and whose potential has not yet been recognized.</p>
        </div>
        <div className="lp-mission-copy">
          <h3>A 3.9 tells a story. So does a 2.5 becoming a 3.5.</h3>
          <p>Consistent achievement deserves recognition. Meaningful improvement does, too. SPE lets patrons look beyond a ranking, discover students for themselves, and choose whose journey they want to follow.</p>
          <h3>A connection that continues through the semester.</h3>
          <p>Prediction markets inspired participant-driven prices; fixed-income securities inspired structured issuance and a defined term. We adapted those ideas around student sponsorship. Trading is part of the experience, while the purpose is lasting support.</p>
          <div className="lp-mission-rule">
            <span className="lp-small-label">Our proposed model</span>
            <strong>Patrons discover. Foundations fund. Students grow.</strong>
            <p>Sponsorship certificates connect participation with a student’s progress. Scholarship awards go to students. In the current fixed-supply markets, certificates retire at maturity without repayment to holders. The examples below explain the student award and the remaining funding-design questions.</p>
          </div>
        </div>
      </section>

      <section className="lp-perspectives" aria-labelledby="perspectives-title"><div className="lp-container lp-section"><div className="lp-role-header"><div><p className="lp-eyebrow">Who the system serves</p><h2 id="perspectives-title">A community around potential.</h2></div><div className="lp-role-buttons" role="group" aria-label="Choose a perspective">{roles.map((item, i) => <button key={item.label} type="button" aria-pressed={perspective === i} onClick={() => setPerspective(i)}>{item.label}</button>)}</div></div><div className="lp-role-content" aria-live="polite"><div><h3>{selected.title}</h3><p>{selected.text}</p><p className="lp-role-detail">{selected.detail}</p></div><ol className="lp-role-path">{selected.steps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}<Arrow /></li>)}</ol></div></div></section>

      <section className="lp-container lp-section" id="methods" aria-labelledby="methods-title">
        <div className="lp-doc-heading"><div><p className="lp-eyebrow">02 / What it does</p><h2 id="methods-title">From a student’s story<br />to sustained support.</h2></div><p>Students, patrons, and the foundation each have a role. The local prototype demonstrates discovery, review, trading, and virtual scholarship calculations.</p></div>
        <ol className="lp-method-list">
          <li><span>01</span><div><h3>Make growth visible</h3><p>Students submit their academic context, activities, and ambitions for review. Public profiles help patrons discover a person behind the numbers. Student-controlled disclosure and separate private verification records are priorities for a real deployment.</p><code>GPA = round(Σ(grade points × credits) / Σ(credits), 2)</code></div></li>
          <li><span>02</span><div><h3>Set clear terms for participation</h3><p>A listing has an approved GPA goal, scholarship allocation, initial probability, and fixed certificate supply. Standard new markets issue 100 sponsorship certificates, with 70 in the public float and 30 held in the administrator reserve. Probability values are illustrative; an academic prediction model has not been validated.</p></div></li>
          <li><span>03</span><div><h3>Let patrons participate in the exchange</h3><p>Patrons place buy and sell orders and follow their holdings in a portfolio. The engine matches by best price, then time, at the resting order’s price. Available funds and owned certificates constrain orders. Self-trading is prevented.</p><p>A market maker can offer a $345 bid and $355 ask around a $350 reference. Limited funds and inventory mean liquidity and trading gains are never guaranteed.</p></div></li>
          <li><span>04</span><div><h3>Keep the relationship growing</h3><p>Our planned monthly reports would share coursework, projects, milestones, and challenges throughout the semester. Student-approved updates and opportunities for encouragement would give patrons reasons to stay involved beyond their initial participation.</p></div></li>
          <li><span>05</span><div><h3>Recognize more than one outcome</h3><p>At the end of the term, the foundation verifies final results and calculates the scholarship. The proposal rewards meeting or exceeding a goal and also provides a market-price-based award when the goal is missed. The foundation is responsible for funding either award.</p></div></li>
        </ol>
      </section>

      <section className="lp-model-section" id="model" aria-labelledby="model-title">
        <div className="lp-container lp-section">
          <div className="lp-doc-heading"><div><p className="lp-eyebrow">03 / The mathematics</p><h2 id="model-title">Clear terms.<br />Two paths to a scholarship.</h2></div><p>These formulas explain the scholarship model used for Students A–E. All examples are hypothetical, use dollars, and are separate from any real funding commitment.</p></div>
          <dl className="lp-symbols">
            <div><dt>F</dt><dd>Initial scholarship allocation</dd></div><div><dt>N</dt><dd>Certificates issued</dd></div><div><dt>p</dt><dd>Fixed initial probability</dd></div><div><dt>G<sub>goal</sub></dt><dd>Approved GPA target</dd></div><div><dt>G<sub>final</sub></dt><dd>Verified final GPA</dd></div><div><dt>P<sub>T</sub></dt><dd>Final market price</dd></div>
          </dl>
          <div className="lp-formulas lp-formulas-pair">
            <article><span className="lp-small-label">Initial offering price</span><h3>P₀ = F × p / N</h3><p>$50,000 × 0.70 / 100 = <strong>$350</strong> per certificate. The rule sets a starting price; subsequent orders determine secondary-market prices.</p></article>
            <article><span className="lp-small-label">Reading the probability</span><h3>0 &lt; p ≤ 1</h3><p>The example uses <strong>p = 0.70</strong>. This illustrative input stays fixed in the scholarship calculation. A rising price does not establish a higher academic success probability.</p></article>
          </div>
          <div className="lp-scholarship-equation">
            <div><span className="lp-small-label">Student scholarship S</span><h3>Achievement and<br />continued belief.</h3></div>
            <div><p><code>S = F × (1 + (G<sub>final</sub> − G<sub>goal</sub>) / p)</code><span>when G<sub>final</sub> ≥ G<sub>goal</sub></span></p><p><code>S = P<sub>T</sub> × N<sub>T</sub></code><span>when G<sub>final</sub> &lt; G<sub>goal</sub></span></p><p className="lp-equation-note">N<sub>T</sub> is the number of outstanding certificates at maturity. With fixed supply in this example, N<sub>T</sub> = N = 100.</p></div>
          </div>
          <ScholarshipExample />
          <div className="lp-model-status"><span className="lp-model-tag">Current prototype</span><p>The current fixed-supply certificates retire without repayment to holders, regardless of the GPA outcome. The student scholarship is a separate award funded from its reserve. Unused reserve funds still return to the treasury; a broader excess-value allocation rule remains to be defined.</p></div>
          <details className="lp-technical-detail">
            <summary>Funding assumptions and the current implementation <span aria-hidden="true">+</span></summary>
            <div>
              <p><strong>Funding the award:</strong> market value is not automatically cash available for a scholarship. The foundation needs defined funding commitments, bonus limits, safeguards for small p values, and reliable closing-price rules. The additional value created around a student’s progress is intended to support their education.</p>
              <p><strong>Students A–E in the demo:</strong> the scholarship branches above are already implemented with each listing’s own parameters. Student A uses F = $48,000, N = 100, p = 0.62, and a 3.80 goal, giving an opening price of $297.60. The calculator above uses a separate hypothetical example.</p>
              <p><strong>Certificate retirement:</strong> fixed-supply certificates are retired at close with zero wallet redemption. The GPA result determines the student scholarship, not a repayment to patrons. Older non-fixed contract markets are a separate legacy implementation.</p>
              <p><strong>Reserves and closing price:</strong> scholarship and certificate backing are tracked separately. The engine uses the last executed price at approval, falling back to the quote midpoint or the available side. Money is stored in integer cents.</p>
              <p><strong>Other fixed-supply demo markets:</strong> some older listings use a different scholarship rule, F + 100P_T when the goal is met or F − 100P_T when missed, with a $1 certificate reference value. The proposed model on this page does not describe those legacy listings.</p>
            </div>
          </details>
        </div>
      </section>

      <section className="lp-container lp-section" id="simulation" aria-labelledby="simulation-title">
        <div className="lp-simulation">
          <div className="lp-sim-copy">
            <p className="lp-eyebrow">04 / Live trading &amp; Capital One Nessie</p>
            <h2 id="simulation-title">Five students.<br /><em>A market in motion.</em></h2>
            <p>Trader A, B, and C participate across Students A–E in a ten-minute simulation started by an admin. Orders use the live matching engine, so user participation can interact with simulated activity. Nessie can record eligible confirmed trades as sandbox transfers.</p>
            <Link className="lp-button lp-button-light" to={role === "ADMIN" ? "/admin/system" : demoPath}>{role === "ADMIN" ? "Open simulation controls" : "Explore the demo"} <Arrow /></Link>
            <p className="lp-sim-note">Admin → System · Virtual credits · Optional sandbox records</p>
          </div>
          <div className="lp-replay-visual" aria-label="Live trading and Nessie recording pipeline">
            <div className="lp-replay-title"><span className="lp-dot" /> Target: 1 trade attempt / second<span>10 MIN · A–E</span></div>
            <div className="lp-wave" aria-hidden="true">{[24,42,30,62,48,79,58,38,65,90,70,100,73,54,82,61,94,76,58,84,98,67,48,77,59,88,65,40].map((height, i) => <i key={i} style={{height: height + "%"}} />)}</div>
            <div className="lp-replay-line"><span>01</span><div>Place orders in SPE<small>Quotes, virtual funds, and certificate inventory set limits</small></div></div>
            <div className="lp-replay-line"><span>02</span><div>Match and confirm trades<small>Update prices, positions, orders, and portfolios</small></div></div>
            <div className="lp-replay-line"><span>03</span><div>Optionally record in Nessie<small>Mirror the cash leg between mapped sandbox accounts</small></div></div>
          </div>
        </div>
        <div className="lp-replay-notes">
          <div><h3>Executed trades determine the cash leg.</h3><code>C = P × q<br />Nessie record = round(C)</code><p>P is the executed price in dollars and q is the certificate quantity. Two certificates at $350 create a $700 cash leg. SPE keeps cent-accurate accounts; Nessie records whole-dollar amounts.</p></div>
          <div><h3>Participation shares one order book.</h3><p>One attempt per second is a target, not a guaranteed fill. User and simulated orders can match when prices, funds, and inventory allow. Starting resets Trader A–C holdings and cancels their orders. Stopping leaves resting orders in place.</p></div>
          <div><h3>Recording follows the trade.</h3><p>Nessie records only eligible trades between mapped simulation accounts. It does not supply historical signals or academic predictions. Local trades continue if recording is unavailable; transfer failures are shown in the admin panel.</p></div>
        </div>
      </section>

      <section className="lp-tech-section" id="technology" aria-labelledby="technology-title"><div className="lp-container lp-section"><div className="lp-doc-heading"><div><p className="lp-eyebrow">05 / How we built it</p><h2 id="technology-title">Built around a shared set of rules.</h2></div><p>A React interface connects student discovery, foundation review, and patron portfolios to a Python API. Human and simulated orders follow the same rules.</p></div>
        <div className="lp-architecture" aria-label="Architecture: browser connects through REST and WebSocket to FastAPI, which uses SQLAlchemy and SQLite"><div><span>EXPERIENCE</span><strong>React browser app</strong><small>Profiles · certificates · portfolios</small></div><span className="lp-architecture-arrow">REST / WebSocket →</span><div><span>RULES</span><strong>FastAPI server</strong><small>Verification · matching · simulation</small></div><span className="lp-architecture-arrow">SQLAlchemy →</span><div><span>RECORD</span><strong>SQLite database</strong><small>Orders · ledger · scholarships</small></div></div>
        <div className="lp-stack-list">{stack.map(([number, label, title, text]) => <article key={number}><span>{number} / {label}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </div></section>

      <section className="lp-container lp-section" id="lessons" aria-labelledby="lessons-title">
        <div className="lp-doc-heading"><div><p className="lp-eyebrow">06 / Challenges &amp; lessons</p><h2 id="lessons-title">The market is only<br />part of the work.</h2></div><p>Building SPE meant connecting a philanthropic purpose to concrete rules—and being clear about what those rules can demonstrate.</p></div>
        <div className="lp-stack-list">
          <article><span>01 / Mission</span><div><h3>One missed goal is not the whole story.</h3><p>A purely binary outcome can overlook growth and resilience. We developed two scholarship paths and a clearer sponsorship proposal. The current fixed-supply certificates retire without holder repayment. The student scholarship remains the focus of the two-outcome model.</p></div></article>
          <article><span>02 / Participation</span><div><h3>An opening price does not create liquidity.</h3><p>The live simulation makes activity visible before a community exists. Finite inventory, available funds, and shared order matching govern participation. Optional Nessie transfer records help demonstrate the cash movements behind eligible trades.</p></div></article>
          <article><span>03 / Trust</span><div><h3>Correct arithmetic needs a trustworthy process.</h3><p>Small probabilities can create large bonuses. A thin market can distort the final price. Funding commitments, academic verification, privacy, and responsible price rules need as much attention as the trading interface.</p></div></article>
        </div>
        <div className="lp-mission-rule lp-accomplishment"><span className="lp-small-label">What we are proud of</span><strong>A working experience, from student discovery to live participation.</strong><p>Profiles, administrative review, order books, trade history, and portfolios are connected in the local prototype. The admin-run simulation trades across Students A–E for ten minutes. User orders can interact with simulated activity through the same matching engine, while optional Nessie records reflect eligible confirmed trades.</p></div>
      </section>

      <section className="lp-perspectives" id="next" aria-labelledby="next-title"><div className="lp-container lp-section">
        <div className="lp-doc-heading"><div><p className="lp-eyebrow">07 / What’s next</p><h2 id="next-title">Build the relationship.<br /><em>Strengthen the foundation.</em></h2></div><p>The next version should help students feel seen and patrons stay involved. We want to test that value with students, supporters, and scholarship administrators.</p></div>
        <ol className="lp-method-list">
          <li><span>01</span><div><h3>Make scholarship commitments dependable</h3><p>Define foundation obligations, scholarship bonus caps, probability safeguards, and reliable closing-price rules around the implemented certificate-retirement model.</p></div></li>
          <li><span>02</span><div><h3>Make progress a shared experience</h3><p>Add monthly reports, student milestones, encouragement, and opportunities for mentorship. Let patrons recognize the work and growth beyond a single GPA threshold.</p></div></li>
          <li><span>03</span><div><h3>Test more students and market conditions</h3><p>Build on the current Students A–E simulation with low-participation, buying-interest, and selling-pressure scenarios. Improve transfer-recording reliability and evaluate the clarity of the patron experience.</p></div></li>
          <li><span>04</span><div><h3>Earn trust before expanding</h3><p>Strengthen authentication and student-controlled privacy. Evaluate any future probability model for calibration and fairness, and validate the educational value of the platform before considering real records or funds.</p></div></li>
        </ol>
      </div></section>
      <LocalSetup />
      <section className="lp-final lp-container"><p className="lp-eyebrow">From understanding to participation</p><h2>A future worth<br /><em>believing in.</em></h2><Link className="lp-button" to={demoPath}>Explore the demo <Arrow /></Link><p>Discover potential. Fund achievement. Start with a student’s story.</p></section>
    </main>
    <footer className="lp-footer lp-container"><Link className="lp-wordmark" to="/welcome"><Logo size="h-8 w-8" /><span>SPE</span></Link><p>Student Performance Exchange<br /><span>A guide to the mission and the current local prototype · HackNC 2026</span></p><a href="/SPE-project-description.md" download>Full project story ↓</a><a href="https://github.com/Taeyoon-J/HackNC2026" target="_blank" rel="noreferrer">Repository ↗</a><a href="#main-content">Back to top ↑</a></footer>
  </div>;
}
