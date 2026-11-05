const API_ENDPOINT = "http://localhost:3000/api/save-reference";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-to-moodboard",
      title: "Salvar no Moodboard",
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "save-to-moodboard" || !info.srcUrl) {
    return;
  }

  return fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      srcUrl: info.srcUrl,
      pageUrl: info.pageUrl,
    }),
  });
});
