const EMAIL_TEMPLATE_ID = "email-item-template";
const DOMAIN_TEMPLATE_ID = "domain-group-template";
const SERVICE_TEMPLATE_ID = "service-card-template";
const RESULT_TEMPLATE_ID = "result-item-template";

const DEMO_NAMES = [
  "alice",
  "bob",
  "carol",
  "dave",
  "ellen",
  "frank",
  "gina",
  "harry",
  "irene",
  "jack",
  "ken",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "paula",
  "quentin",
  "rachel",
  "sam",
  "tina",
];

const DEMO_DOMAINS = ["company.com", "sales.company.com", "gmail.com", "personal.co"];
const SERVICES = ["Mail", "Docs", "Drive", "Voice", "News", "Chat"];

const expandedDomains = new Set();
const assignments = new Map();
let demoEmails = [];

const qs = (root, selector) => root.querySelector(selector);
const getTemplate = (id) => {
  const tpl = document.getElementById(id);
  if (!tpl) throw new Error(`Template ${id} not found`);
  return tpl;
};

const cloneTemplate = (id) => getTemplate(id).content.firstElementChild.cloneNode(true);

const groupByDomain = (emails) => {
  const groups = new Map();
  emails.forEach((email) => {
    if (!groups.has(email.domain)) groups.set(email.domain, []);
    groups.get(email.domain).push(email);
  });
  return groups;
};

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createDemoEmails = () =>
  DEMO_NAMES.map((name, index) => {
    const domain = DEMO_DOMAINS[index % DEMO_DOMAINS.length];
    return {
      id: `email-${index + 1}`,
      name,
      email: `${name}@${domain}`,
      domain,
    };
  });

const initialiseAssignments = () => {
  assignments.clear();
  SERVICES.forEach((service) => assignments.set(service, null));
};

const renderDomainGroups = (container) => {
  const grouped = groupByDomain(demoEmails);
  const domains = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  container.innerHTML = "";

  domains.forEach((domain) => {
    const domainNode = cloneTemplate(DOMAIN_TEMPLATE_ID);
    const title = qs(domainNode, ".domain-title");
    const count = qs(domainNode, ".domain-count");
    const toggle = qs(domainNode, ".domain-toggle");
    const list = qs(domainNode, ".email-list");
    const header = qs(domainNode, ".domain-header");

    title.textContent = domain;
    count.textContent = `(${grouped.get(domain).length})`;

    const expanded = expandedDomains.has(domain);
    list.dataset.expanded = String(expanded);
    toggle.textContent = expanded ? "Hide" : "Show";

    const renderEmails = () => {
      list.innerHTML = "";
      grouped.get(domain).forEach((email) => {
        const node = cloneTemplate(EMAIL_TEMPLATE_ID);
        qs(node, ".email-item-name").textContent = email.name;
        qs(node, ".email-item-address").textContent = email.email;
        qs(node, ".email-item-domain").textContent = email.domain;
        node.addEventListener("dragstart", (event) => {
          const payload = JSON.stringify(email);
          event.dataTransfer?.setData("application/json", payload);
          event.dataTransfer?.setData("text/plain", payload);
        });
        list.appendChild(node);
      });
    };

    if (expanded) {
      renderEmails();
    }

    const toggleDomain = () => {
      if (expandedDomains.has(domain)) {
        expandedDomains.delete(domain);
      } else {
        expandedDomains.add(domain);
      }
      renderDomainGroups(container);
    };

    header.addEventListener("click", toggleDomain);
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleDomain();
    });

    container.appendChild(domainNode);
  });
};

const renderServiceCards = (container, { onOpenPalette }) => {
  container.innerHTML = "";
  SERVICES.forEach((service) => {
    const card = cloneTemplate(SERVICE_TEMPLATE_ID);
    const title = qs(card, "h3");
    const badge = qs(card, ".service-badge");
    const emailDisplay = qs(card, ".service-email");
    const button = qs(card, ".palette-button");

    title.textContent = service;
    const assigned = assignments.get(service);
    badge.dataset.assigned = String(Boolean(assigned));
    badge.textContent = assigned ? assigned.name : "—";
    emailDisplay.dataset.assigned = String(Boolean(assigned));
    emailDisplay.textContent = assigned ? assigned.email : "No email selected";

    button.addEventListener("click", () => onOpenPalette(service));

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.dataset.dropActive = "true";
    });

    card.addEventListener("dragleave", () => {
      card.dataset.dropActive = "false";
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.dataset.dropActive = "false";

      const payload =
        event.dataTransfer?.getData("application/json") ??
        event.dataTransfer?.getData("text/plain");
      if (!payload) return;

      try {
        const email = JSON.parse(payload);
        assignments.set(service, email);
        renderServiceCards(container, { onOpenPalette });
      } catch {
        // ignore invalid payloads
      }
    });

    container.appendChild(card);
  });
};

const createPaletteController = ({
  overlay,
  closeButton,
  serviceLabel,
  input,
  resultsGrid,
  emptyState,
  onSelect,
}) => {
  let activeService = null;
  let query = "";

  const renderResults = () => {
    const filtered = demoEmails
      .filter((email) => email.email.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 25);

    resultsGrid.innerHTML = "";
    if (!filtered.length) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    filtered.forEach((email) => {
      const node = cloneTemplate(RESULT_TEMPLATE_ID);
      qs(node, ".result-name").textContent = email.name;
      qs(node, ".result-email").textContent = email.email;
      qs(node, ".result-select").addEventListener("click", () => {
        if (!activeService) return;
        onSelect(activeService, email);
        hide();
      });
      resultsGrid.appendChild(node);
    });
  };

  const show = (service) => {
    activeService = service;
    query = "";
    serviceLabel.textContent = service;
    input.value = "";
    overlay.dataset.open = "true";
    overlay.hidden = false;
    renderResults();
    window.requestAnimationFrame(() => input.focus());
  };

  const hide = () => {
    activeService = null;
    query = "";
    input.value = "";
    resultsGrid.innerHTML = "";
    emptyState.hidden = true;
    overlay.dataset.open = "false";
    overlay.hidden = true;
  };

  closeButton.addEventListener("click", hide);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide();
  });
  input.addEventListener("input", (event) => {
    query = event.target.value;
    renderResults();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.dataset.open === "true") hide();
  });

  return { show, hide, renderResults };
};

const setupDashboard = () => {
  const root = document.querySelector("[data-assignment-root]");
  if (!root) return;

  const domainContainer = qs(root, "[data-domain-groups]");
  const servicesContainer = qs(root, "[data-services-grid]");
  const refreshButton = qs(root, "[data-refresh-demo]");
  const clearButton = qs(root, "[data-clear-assignments]");

  const overlay = document.querySelector("[data-palette-overlay]");
  const closeButton = overlay && qs(overlay, "[data-palette-close]");
  const serviceLabel = overlay && qs(overlay, "[data-palette-service]");
  const input = overlay && qs(overlay, "[data-palette-input]");
  const resultsGrid = overlay && qs(overlay, "[data-results-grid]");
  const emptyState = overlay && qs(overlay, "[data-palette-empty]");

  if (
    !domainContainer ||
    !servicesContainer ||
    !overlay ||
    !closeButton ||
    !serviceLabel ||
    !input ||
    !resultsGrid ||
    !emptyState
  ) {
    throw new Error("Dashboard markup is missing required elements.");
  }

  demoEmails = createDemoEmails();
  initialiseAssignments();

  const palette = createPaletteController({
    overlay,
    closeButton,
    serviceLabel,
    input,
    resultsGrid,
    emptyState,
    onSelect: (service, email) => {
      assignments.set(service, email);
      renderServiceCards(servicesContainer, { onOpenPalette: palette.show });
    },
  });

  const refreshEmails = () => {
    demoEmails = shuffle(demoEmails);
    expandedDomains.clear();
    renderDomainGroups(domainContainer);
    palette.renderResults();
  };

  const clearAssignments = () => {
    initialiseAssignments();
    renderServiceCards(servicesContainer, { onOpenPalette: palette.show });
  };

  renderDomainGroups(domainContainer);
  renderServiceCards(servicesContainer, { onOpenPalette: palette.show });

  refreshButton?.addEventListener("click", refreshEmails);
  clearButton?.addEventListener("click", clearAssignments);
};

document.addEventListener("DOMContentLoaded", setupDashboard);



