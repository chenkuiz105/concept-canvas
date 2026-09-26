# 經緯（concept-canvas）— 給 Claude 的專案說明

- 一律用繁體中文回覆使用者；直接把事情做完再回報結果。
- 唯一的原始碼是 `artifact/concept-cards.html`（Claude artifact 頁面）。
- 改完後執行 `python3 scripts/build.py`，重新產生 GitHub Pages 用的 `docs/index.html`（`docs/claude-shim.js` 讓同一份程式在一般網頁上用 Anthropic API 金鑰與瀏覽器儲存運作）。

## 每次修改都必須三方同步更新

1. **本機／這個 repo**：修改 `artifact/concept-cards.html`，跑 `python3 scripts/build.py`，commit。
2. **Claude artifact**：把同一份檔案重新發布到 https://claude.ai/artifact/CwKHewAhR7HHy1KMeMes2Q （更新同一個網址，不要建立新的 artifact）。在無法發布 artifact 的環境（例如 claude.ai/code 雲端工作階段），要在回覆中明確告訴使用者：artifact 尚未更新，請回到能發布的 Claude 對話更新。
3. **GitHub**：push 到 `main`，確認 https://chenkuiz105.github.io/concept-canvas/ 已更新。

回報時逐一列出三處的更新結果。
