// content script for mail.google.com
// Heuristics to find signed-in email addresses and account indices (/u/N/ links)

// Improved detector: parses URL for /u/<N>/, scans DOM for emails and /u/ links,
// and observes DOM mutations to retry detection when Gmail injects markup asynchronously.

function parseIndexFromUrl(url) {
  try {
    const u = new URL(url);
    // check for /mail/u/<N>/ or /u/<N>/ in pathname
    let m = u.pathname.match(/\/mail\/u\/(\d+)\//);
    if (m) return Number(m[1]);
    m = u.pathname.match(/\/u\/(\d+)\//);
    if (m) return Number(m[1]);
  } catch (e) {}
  return null;
}

function scanForAccounts() {
  const found = [];

  // Try parsing index directly from current URL
  const urlIndex = parseIndexFromUrl(location.href);

  // Heuristic A: account button aria-label may contain email
  const acctBtn = document.querySelector('[aria-label*="@"]');
  if (acctBtn) {
    const label = acctBtn.getAttribute('aria-label') || acctBtn.textContent || '';
    const m = label.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (m) found.push({ email: m[1], index: urlIndex });
  }

  // Heuristic B: account switcher / account picker links that contain /u/<N>/
  document.querySelectorAll('a[href*="/u/"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/u\/(\d+)\//);
    if (m) {
      const idx = Number(m[1]);
      const text = a.textContent || '';
      const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      found.push({ email: emailMatch ? emailMatch[0] : null, index: idx, href });
    }
  });

  // Heuristic C: look for profile email text nodes (in case links don't contain email)
  const textNodes = Array.from(document.querySelectorAll('div,span')).slice(0, 200);
  for (const el of textNodes) {
    const txt = (el.textContent || '').trim();
    const m = txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) {
      found.push({ email: m[1], index: urlIndex });
    }
  }

  // Deduplicate by email, prefer items with explicit index
  const map = new Map();
  for (const item of found) {
    if (!item.email) continue;
    if (!map.has(item.email)) {
      map.set(item.email, item);
    } else {
      const exist = map.get(item.email);
      if ((exist.index == null) && (item.index != null)) map.set(item.email, item);
    }
  }

  return Array.from(map.values());
}

let lastSent = null;
function sendIfNew(results) {
  if (!results || !results.length) return;
  const key = JSON.stringify(results.map(r => ({ email: r.email, index: r.index })));
  if (key === lastSent) return;
  lastSent = key;
  chrome.runtime.sendMessage({ type: 'FOUND_EMAILS', payload: results });
}

// Run an initial scan, then observe for dynamic changes.
function startDetection() {
  try {
    const initial = scanForAccounts();
    sendIfNew(initial);

    const observer = new MutationObserver(() => {
      const res = scanForAccounts();
      if (res.length) sendIfNew(res);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Fallback: periodic scan for pages that update slowly
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      const res = scanForAccounts();
      if (res.length) sendIfNew(res);
      if (res.length || attempts > 10) clearInterval(id);
    }, 1000);
  } catch (e) {
    // ignore
  }
}

startDetection();



