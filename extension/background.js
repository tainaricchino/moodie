const API_ENDPOINT = "http://localhost:3000/api/save-reference";
const MENU_ID = "save-to-moodie";

function ensureMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Salvar no Moodie",
      contexts: ["image"],
    });
  });
}

chrome.runtime.onInstalled.addListener(ensureMenu);
ensureMenu();

function notify(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Moodie",
    message,
  });
}

async function resolvePageUrl(info) {
  if (info.pageUrl) return info.pageUrl;

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.url || "";
  } catch {
    return "";
  }
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;

  const pageUrl = await resolvePageUrl(info);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srcUrl: info.srcUrl,
        pageUrl,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      notify(payload.error || "Não foi possível salvar a referência.");
      return;
    }

    notify("Referência salva no acervo.");
  } catch {
    notify("A API local não respondeu. Confira se ela está rodando na porta 3000.");
  }
});
