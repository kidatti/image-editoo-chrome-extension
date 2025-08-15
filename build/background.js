// Chrome拡張機能のバックグラウンドスクリプト
chrome.action.onClicked.addListener((tab) => {
    // 新しいタブでImage Editorを開く
    chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
    });
});