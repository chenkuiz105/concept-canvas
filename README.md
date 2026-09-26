# 經緯（Concept Canvas）

把任何資料（講義、共筆、PDF、PPTX、DOCX、筆記照片）交給 AI 代理，拆解成**上下級分明、圖文並茂**的知識小卡，排在一張 Heptabase 式的無限畫布上。

名字取自「經緯」：**經**是由上而下的縱線——大概念到小概念的上下級樹狀結構；**緯**是橫向的線——串起不同分支之間的邏輯關聯。

## 它會做什麼

AI 代理依序執行：

1. **讀取資料**：PDF（含掃描頁）、PPTX（含講者備註與投影片內嵌圖）、DOCX、TXT/MD/HTML、圖片。
2. **辨識圖片**：找出資料中的解剖圖、流程圖、圖表等並自動裁切，判斷清晰度；掃描頁與照片會轉錄文字。
3. **列出所有知識點並建立架構**：由上而下排列：主題 → 大概念 → 分類 → 小概念 → 細節。平行的概念一律是同一張父卡底下左右並列的兄弟，不會串成上下級。
4. **撰寫小卡**：條列短句、中英對照、比較表格、摺疊的詳細機制、色塊（🔴 警告禁忌 · 🔵 重點 · 🟢 臨床應用 · 🟡 提示）、流程與圖片。
5. **完整性核對**：逐一比對知識點，遺漏的自動補成新卡。
6. **圖片**：① 從你的資料擷取 → ② 需要真實影像時提供網路搜尋（Google 圖片、Wikimedia），由你上傳 → ③ AI 繪製示意圖。
7. **串接關聯**：只連跨分支的邏輯關係（上下級由樹狀線表示）。
8. **排版並儲存**。

另外可以：選取任一卡片「AI 往下拆解」、追問 AI、貼上圖片、拖曳建立關聯、匯出 Notion 筆記＋編號圖片 ZIP。

## 兩個版本

| | Claude artifact 版 | 獨立網站版（GitHub Pages） |
|---|---|---|
| 檔案 | [`artifact/concept-cards.html`](artifact/concept-cards.html) | [`docs/index.html`](docs/index.html) + [`docs/claude-shim.js`](docs/claude-shim.js) |
| AI | 使用你的 Claude 帳號 | 使用你自己的 Anthropic API 金鑰（依用量計費） |
| 畫布與圖片儲存 | Claude 雲端，只有你看得到 | 這個瀏覽器的 IndexedDB（可在「API 設定」備份／還原） |

兩個版本是同一份程式。`docs/claude-shim.js` 在一般網頁上提供與 Claude artifact 相同的 `window.claude.use(...)` 介面，AI 呼叫使用官方 [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk)。

### 使用獨立網站版

1. 到 [console.anthropic.com](https://console.anthropic.com/) 建立 API 金鑰。
2. 打開網站，按右上角 **API 設定** 貼上金鑰，選擇模型（預設 Claude Opus 5）。
3. 按左側 **＋ AI 新畫布**，上傳資料。

> **關於金鑰安全**：金鑰只存在你這個瀏覽器的 localStorage，請求直接從瀏覽器送到 `api.anthropic.com`，不經過其他伺服器，也不會進到這個 repo。但任何能在你的瀏覽器執行程式的東西（例如惡意擴充功能）都可能讀到它，所以建議為這個網站建立一把專用金鑰，並在 Console 設定用量上限。不要把金鑰寫進程式碼或 commit。

### 部署到 GitHub Pages

Repo 的 **Settings → Pages → Build and deployment**：Source 選 *Deploy from a branch*，Branch 選 `main`、資料夾 `/docs`。幾分鐘後網站會出現在 `https://<你的帳號>.github.io/<repo 名稱>/`。

## 修改程式

> 規則：每次修改都要同時更新三個地方——本機專案、Claude artifact（重新發布到同一個網址）、GitHub（push 後 Pages 自動更新）。詳見 [CLAUDE.md](CLAUDE.md)。

`artifact/concept-cards.html` 是唯一的原始碼。修改後執行：

```bash
python3 scripts/build.py
```

重新產生 `docs/index.html`。要更新 Claude 裡的 artifact，把同一個檔案重新發佈即可。

## 限制

- 每張畫布約可處理 1.4 萬中文字（約 44 KB）的文字；更長的資料請拆成多張畫布。
- 網頁無法自動從網路下載圖片（瀏覽器的跨站限制），所以「網路圖片」這一步會提供搜尋連結，由你找到後上傳或貼上。
- AI 裁切資料圖片時是以目視判斷位置，偶爾會不準，可用「上傳替換」換成自己的圖。
- 長篇資料每個大概念各跑一次 AI，整體可能需要數分鐘；進度會顯示在左下角。
