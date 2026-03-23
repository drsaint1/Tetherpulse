export const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TetherPulse Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0e17; color: #e2e8f0; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%); padding: 2rem; border-bottom: 1px solid #1e293b; }
  .header h1 { font-size: 1.8rem; font-weight: 700; }
  .header h1 span { color: #22d3ee; }
  .header .subtitle { color: #64748b; margin-top: 0.3rem; }
  .header .features { display: flex; gap: 1rem; margin-top: 0.8rem; flex-wrap: wrap; }
  .header .feature-tag { background: #1e293b; color: #94a3b8; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }
  .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.2rem; margin-top: 1.5rem; }
  .card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; transition: border-color 0.2s; }
  .card:hover { border-color: #334155; }
  .card h3 { color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.8rem; }
  .stat { font-size: 2rem; font-weight: 700; color: #f1f5f9; }
  .stat-sm { font-size: 1.4rem; }
  .stat-label { color: #64748b; font-size: 0.8rem; margin-top: 0.2rem; }
  .health-bar { display: flex; gap: 3px; margin: 1rem 0; }
  .health-segment { width: 100%; height: 8px; border-radius: 4px; background: #1e293b; }
  .health-segment.filled { background: #22d3ee; }
  .summary { color: #94a3b8; font-style: italic; line-height: 1.5; margin-top: 0.5rem; font-size: 0.9rem; }
  .user-list { list-style: none; }
  .user-list li { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1e293b; font-size: 0.9rem; }
  .user-list li:last-child { border-bottom: none; }
  .user-name { color: #22d3ee; font-weight: 500; }
  .user-stat { color: #94a3b8; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .badge-green { background: #064e3b; color: #34d399; }
  .badge-yellow { background: #451a03; color: #fbbf24; }
  .badge-red { background: #450a0a; color: #f87171; }
  .badge-blue { background: #0c2d48; color: #38bdf8; }
  .hero-stat { text-align: center; padding: 2rem 1rem; }
  .hero-stat .stat { font-size: 3.5rem; background: linear-gradient(135deg, #22d3ee, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .yield-card { border-color: #1a3a2a; }
  .yield-card .stat { color: #34d399; }
  .pool-card { border-color: #2a1a3a; }
  .pool-card .stat { color: #c084fc; }
  .refresh-note { text-align: center; color: #475569; font-size: 0.8rem; margin-top: 2rem; padding-bottom: 2rem; }
  .loading { text-align: center; padding: 3rem; color: #64748b; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .loading { animation: pulse 2s infinite; }
  .section-title { color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2rem; margin-bottom: -0.5rem; }
</style>
</head>
<body>
<div class="header">
  <div class="container">
    <h1><span>Tether</span>Pulse</h1>
    <p class="subtitle">AI-Powered Community Health Agent</p>
    <div class="features">
      <span class="feature-tag">AI Tip Detection</span>
      <span class="feature-tag">Multi-Chain</span>
      <span class="feature-tag">Aave V3 Yield</span>
      <span class="feature-tag">Bounty Pools</span>
      <span class="feature-tag">Streaks & Badges</span>
      <span class="feature-tag">XAU&#x20ae; Gold Tips</span>
    </div>
  </div>
</div>
<div class="container">
  <div id="app" class="loading">Loading community pulse...</div>
</div>
<script>
async function loadPulse() {
  try {
    const res = await fetch('/api/pulse');
    const { data } = await res.json();
    renderDashboard(data);
  } catch (e) {
    document.getElementById('app').innerHTML = '<p>Failed to load data. Is the bot running?</p>';
  }
}

function renderDashboard(d) {
  const healthColor = d.healthScore >= 60 ? 'green' : d.healthScore >= 30 ? 'yellow' : 'red';
  const healthLabel = d.healthScore >= 60 ? 'Thriving' : d.healthScore >= 30 ? 'Growing' : 'Getting Started';

  document.getElementById('app').innerHTML = \`
    <div class="grid">
      <div class="card hero-stat" style="grid-column: 1 / -1;">
        <h3>Community Health Score</h3>
        <div class="stat">\${d.healthScore}</div>
        <div class="health-bar">
          \${Array.from({length: 10}, (_, i) =>
            '<div class="health-segment ' + (i < d.healthScore/10 ? 'filled' : '') + '"></div>'
          ).join('')}
        </div>
        <span class="badge badge-\${healthColor}">\${healthLabel}</span>
        <p class="summary">\${d.summary}</p>
      </div>
    </div>

    <p class="section-title">Tipping Activity</p>
    <div class="grid">
      <div class="card">
        <h3>Tips (24h)</h3>
        <div class="stat">\${d.tipCount24h}</div>
        <div class="stat-label">$\${d.totalVolume24h.toFixed(2)} volume</div>
      </div>

      <div class="card">
        <h3>Tips (7 Days)</h3>
        <div class="stat">\${d.tipCount7d}</div>
        <div class="stat-label">$\${d.totalVolume7d.toFixed(2)} volume</div>
      </div>

      <div class="card">
        <h3>Active Users</h3>
        <div class="stat">\${d.activeUsers24h}</div>
        <div class="stat-label">\${d.totalUsers} total registered</div>
      </div>

      <div class="card">
        <h3>Unique Tippers (24h)</h3>
        <div class="stat">\${d.uniqueTippers24h}</div>
        <div class="stat-label">\${d.uniqueReceivers24h} unique receivers</div>
      </div>
    </div>

    <p class="section-title">DeFi & Bounties</p>
    <div class="grid">
      <div class="card yield-card">
        <h3>Aave V3 Yield</h3>
        <div class="stat stat-sm">$\${(d.yieldTotalDeposited || 0).toFixed(2)}</div>
        <div class="stat-label">\${d.yieldDepositors || 0} users earning ~4-5% APY</div>
        <div class="stat-label" style="margin-top:0.5rem;">Idle USDT auto-earns via Aave V3</div>
      </div>

      <div class="card pool-card">
        <h3>Active Bounties</h3>
        <div class="stat stat-sm">\${d.activePools || 0}</div>
        <div class="stat-label">$\${(d.totalPooled || 0).toFixed(2)} total pooled</div>
        <div class="stat-label" style="margin-top:0.5rem;">Crowdfunded community rewards</div>
      </div>
    </div>

    <p class="section-title">Leaderboards</p>
    <div class="grid">
      <div class="card">
        <h3>Top Contributors</h3>
        \${d.topContributors.length ? '<ul class="user-list">' + d.topContributors.map(c =>
          '<li><span class="user-name">@' + c.username + '</span><span class="user-stat">Score: ' + c.score + '</span></li>'
        ).join('') + '</ul>' : '<p class="stat-label">No contributions scored yet</p>'}
      </div>

      <div class="card">
        <h3>Most Generous</h3>
        \${d.topTippers.length ? '<ul class="user-list">' + d.topTippers.map(t =>
          '<li><span class="user-name">@' + t.username + '</span><span class="user-stat">$' + t.amount.toFixed(2) + ' (' + t.count + ')</span></li>'
        ).join('') + '</ul>' : '<p class="stat-label">No tips yet</p>'}
      </div>

      <div class="card">
        <h3>Most Appreciated</h3>
        \${d.topReceivers.length ? '<ul class="user-list">' + d.topReceivers.map(r =>
          '<li><span class="user-name">@' + r.username + '</span><span class="user-stat">$' + r.amount.toFixed(2) + ' (' + r.count + ')</span></li>'
        ).join('') + '</ul>' : '<p class="stat-label">No tips received yet</p>'}
      </div>
    </div>
    <p class="refresh-note">Auto-refreshes every 30 seconds | Powered by Tether WDK + Google Gemini + Aave V3</p>
  \`;
}

loadPulse();
setInterval(loadPulse, 30000);
</script>
</body>
</html>`;
