// Constants
const allowedUrl = "https://npo.nl/start/live";

// Event Listeners
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.startsWith(allowedUrl)) {
    chrome.tabs.sendMessage(tab.id, { message: "initiateMonitoring" });
  }
});

chrome.runtime.onMessage.addListener((req, sender) => {
  if (req.message === "translate") {
    translateSubtitle(sender.tab.id, req.payload);
  }
});

// Functions

const translateSubtitle = async (tabId, subtitle) => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=en&dt=t&q=${encodeURI(subtitle)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Connection": "keep-alive",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Access-Control-Allow-Origin": "*",
      },
    });

    if (response.status !== 200) {
      console.error(response.status);
      return;
    }

    const data = await response.json();
    const translatedText = data[0].map((item) => item[0]).join(" ");
    sendTranslatedSubtitle(tabId, translatedText);
  } catch (err) {
    console.error(err);
  }
};


const sendTranslatedSubtitle = (tabId, translatedText) => {
  chrome.tabs.sendMessage(tabId, {
    message: "translateFinished",
    payload: translatedText,
  });
};
