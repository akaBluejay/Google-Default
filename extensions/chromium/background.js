// background service worker
// Responsibilities:
// - receive detected accounts from content script
// - store accounts in chrome.storage.local
// - manage defaultAccount selection
// - create/update a declarativeNetRequest dynamic rule to redirect gmail.com -> mail.google.com/u/<index>/

const RULE_ID = 1001;

async function getStorage(key) {
  return new Promise(resolve => chrome.storage.local.get(key, resolve));
}

async function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'FOUND_EMAILS') {
    handleFoundEmails(msg.payload);
  }
});

async function handleFoundEmails(found) {
  const data = await getStorage(['accounts']);
  const accounts = data.accounts || {};
  let changed = false;
  for (const a of found) {
    if (!a.email) continue;
    if (!accounts[a.email]) {
      accounts[a.email] = { index: a.index ?? null, href: a.href ?? null, seenAt: Date.now() };
      changed = true;
    } else {
      // update index if present and changed
      if (a.index != null && accounts[a.email].index !== a.index) {
        accounts[a.email].index = a.index;
        accounts[a.email].seenAt = Date.now();
        changed = true;
      }
    }
  }
  if (changed) {
    await setStorage({ accounts });
    const lastEmail = Object.keys(accounts).slice(-1)[0];
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'New Gmail account detected',
      message: lastEmail || 'New account detected'
    });
  }
}

// Listen for messages from popup to set default account
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SET_DEFAULT') {
    (async () => {
      await setDefaultAccount(msg.payload);
      sendResponse({ ok: true });
    })();
    return true; // will respond asynchronously
  }
  if (msg?.type === 'GET_ACCOUNTS') {
    (async () => {
      const data = await getStorage(['accounts', 'defaultAccount']);
      sendResponse({ accounts: data.accounts || {}, defaultAccount: data.defaultAccount });
    })();
    return true;
  }
});

async function setDefaultAccount(index) {
  await setStorage({ defaultAccount: index });
  await updateRedirectRule(index);
}

async function updateRedirectRule(index) {
  // remove previous rule if any
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });
  } catch (e) {
    // ignore
  }

  // If no index is set or the index is 0, do not add redirect rules
  if (index == null || index === 0) return;

  // Single rule: redirect root gmail.com (and google.com variants) to the selected inbox
  const rule = {
    id: RULE_ID,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { url: `https://mail.google.com/mail/u/${index}/#inbox` }
    },
    condition: {
      // will only match:
      // http(s)://www.gmail.com/
      // http(s)://mail.google.com/
      // will not match:
      // http(s)://www.gmail.com/foo
      // http(s)://mail.google.com/foo
      regexFilter: '^https?://(www\\.gmail\\.com|mail\\.google\\.com)/?$',
      resourceTypes: ['main_frame']
    }
  };

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    console.log('dNR rule updated', { ruleId: RULE_ID, index });
  } catch (err) {
    console.error('Failed to update dNR rule', err);
  }
}

// On install, ensure there is no leftover rule; then re-create if defaultAccount exists
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });
  } catch (e) {
    console.error('Failed to remove old dNR rule on install', e);
  }
  const data = await getStorage(['defaultAccount']);
  if (data.defaultAccount != null) await updateRedirectRule(data.defaultAccount);
});


