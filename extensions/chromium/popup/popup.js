const listEl = document.querySelector("[data-email-list]");
const emptyStateEl = document.querySelector("[data-empty-state]");
const addEmailForm = document.querySelector("[data-add-email-form]");
const addEmailInput = document.querySelector("[data-add-email-input]");
const addEmailIndexInput = document.querySelector("[data-add-email-index]");
const clearDefaultBtn = document.querySelector("[data-clear-default]");
const clearEmailsBtn = document.querySelector("[data-clear-emails]");
const refreshBtn = document.querySelector("[data-refresh]");
const openDashboardBtn = document.querySelector("[data-open-dashboard]");
const template = document.getElementById("email-item-template");

let accountsState = {};
let defaultAccountIndex = null;

const DASHBOARD_PATH = "dashboard/dashboard.html";

const getAvatarContent = (email) => {
  if (!email) return "•";
  const namePart = email.split("@")[0];
  return namePart.charAt(0).toUpperCase();
};

const toEmailEntries = (accounts) =>
  Object.entries(accounts).map(([email, meta]) => ({
    email,
    index: typeof meta.index === "number" ? meta.index : null,
    seenAt: meta.seenAt ?? 0,
  }));

const renderList = () => {
  listEl.innerHTML = "";
  const entries = toEmailEntries(accountsState).sort((a, b) => b.seenAt - a.seenAt);

  if (!entries.length) {
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  entries.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const avatar = node.querySelector(".email-item__avatar");
    const emailText = node.querySelector(".email-item__email");
    const indexText = node.querySelector(".email-item__index");
    const setDefaultBtn = node.querySelector("[data-set-default]");
    const deleteBtn = node.querySelector("[data-delete-email]");

    avatar.textContent = getAvatarContent(entry.email);
    emailText.textContent = entry.email;
    indexText.textContent =
      entry.index != null ? `Index ${entry.index}` : "No index captured";

    const isDefault = entry.index != null && entry.index === defaultAccountIndex;
    node.classList.toggle("is-default", isDefault);
    if (isDefault) {
      setDefaultBtn.textContent = "Default";
      setDefaultBtn.disabled = true;
    } else if (entry.index == null) {
      setDefaultBtn.textContent = "No index";
      setDefaultBtn.disabled = true;
    } else {
      setDefaultBtn.textContent = "Set default";
      setDefaultBtn.disabled = false;
    }

    setDefaultBtn.addEventListener("click", () => {
      if (entry.index == null) return;
      chrome.runtime.sendMessage({ type: "SET_DEFAULT", payload: entry.index }, () => {
        defaultAccountIndex = entry.index;
        renderList();
      });
    });

    deleteBtn.addEventListener("click", async () => {
      const data = await chrome.storage.local.get(["accounts"]);
      const accounts = data.accounts || {};
      delete accounts[entry.email];
      await chrome.storage.local.set({ accounts });
      if (entry.index === defaultAccountIndex) {
        await chrome.runtime.sendMessage({ type: "SET_DEFAULT", payload: null });
        defaultAccountIndex = null;
      }
      await loadState();
    });

    listEl.appendChild(node);
  });
};

const loadState = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_ACCOUNTS" }, (resp) => {
      accountsState = (resp && resp.accounts) || {};
      defaultAccountIndex = resp && typeof resp.defaultAccount === "number"
        ? resp.defaultAccount
        : null;
      renderList();
      resolve();
    });
  });

const addEmailManually = async (email, indexValue) => {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;

  const index = indexValue === "" ? null : Number(indexValue);
  const data = await chrome.storage.local.get(["accounts"]);
  const accounts = data.accounts || {};

  accounts[trimmed] = {
    ...(accounts[trimmed] || {}),
    index: Number.isFinite(index) ? index : null,
    seenAt: Date.now(),
    manual: true,
  };

  await chrome.storage.local.set({ accounts });
  await loadState();
};

const clearDefault = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_DEFAULT", payload: null }, () => {
      defaultAccountIndex = null;
      renderList();
      resolve();
    });
  });

const clearEmails = async () => {
  await chrome.storage.local.remove("accounts");
  accountsState = {};
  if (defaultAccountIndex != null) {
    await clearDefault();
  } else {
    renderList();
  }
};

const resolveDashboardUrl = () => {
  if (!openDashboardBtn) return null;
  const attr = openDashboardBtn.dataset.dashboardUrl;
  if (!attr) return null;
  if (/^https?:\/\//i.test(attr)) {
    return attr;
  }
  return chrome.runtime.getURL(attr);
};

const openDashboard = () => {
  const url = resolveDashboardUrl();
  if (!url) return;
  chrome.tabs.create({ url });
};

addEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = addEmailInput.value;
  const indexValue = addEmailIndexInput.value;
  await addEmailManually(email, indexValue);
  addEmailInput.value = "";
  addEmailIndexInput.value = "";
});

clearDefaultBtn.addEventListener("click", () => {
  clearDefault();
});

clearEmailsBtn.addEventListener("click", () => {
  clearEmails();
});

refreshBtn.addEventListener("click", () => {
  loadState();
});

openDashboardBtn?.addEventListener("click", openDashboard);

document.addEventListener("DOMContentLoaded", () => {
  loadState();
});
