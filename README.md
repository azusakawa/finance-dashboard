# 即時股票圖表應用程式

這是一個使用 Lightweight Charts 和 Twelve Data API 建立的網頁應用程式，旨在提供一個客製化的即時股票圖表顯示介面。使用者可以輸入股票代號、選擇時間間隔，並自訂圖表顏色，以視覺化方式分析股票市場數據。

## 功能特色

* **即時股票圖表**：使用 Lightweight Charts 函式庫繪製 K 線圖和成交量圖。
* **數據來源**：透過 Twelve Data API 獲取最新的股票數據。
* **客製化設定**：
    * 動態載入不同股票代號的數據。
    * 切換時間間隔：支援日（1D）、週（1W）、月（1M）。
    * 可自訂上漲和下跌 K 線的顏色。
    * 提供日期範圍查詢功能。
* **主題切換**：支援暗色與亮色兩種主題模式。
* **使用者介面優化**：
    * 響應式設計，適應不同螢幕大小。
    * 鼠標懸停時顯示詳細數據提示框。
    * 支援鍵盤快速鍵 (`+`, `-`, `r`) 進行縮放與重設。
    * 自動完成股票代號輸入功能。

## 如何開始

### 步驟 1: 取得 Twelve Data API 金鑰

要運行此應用程式，您需要一個 Twelve Data 的 API 金鑰。請按照以下步驟操作：

1.  前往 [Twelve Data 官方網站](https://twelvedata.com/register)。
2.  註冊一個免費帳號。
3.  登入後，您可以在儀表板上找到您的 API 金鑰。

### 步驟 2: 檔案配置

1.  將以下三個檔案放在同一個目錄中：
    * `index.html`
    * `style.css`
    * `script.js`
2.  開啟 `index.html`，並在 API 金鑰輸入框中貼上您在步驟 1 獲得的金鑰。

### 步驟 3: 運行專案

有兩種簡單的方式可以運行此專案：

* **直接開啟**：在您的檔案瀏覽器中找到 `index.html` 檔案，並用您喜歡的瀏覽器（如 Chrome, Firefox）直接開啟。
* **使用 Live Server (推薦)**：如果您是開發者，可以使用 VS Code 的 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 擴充功能。右鍵點擊 `index.html` 檔案，選擇 "Open with Live Server" 即可。

## 檔案說明

* **`index.html`**：專案的 HTML 結構檔案，定義了所有使用者介面元素，如輸入框、按鈕和圖表容器。
* **`style.css`**：負責所有視覺呈現的樣式檔案，採用 CSS 變數來實現主題化，使樣式管理更加模組化。
* **`script.js`**：專案的核心邏輯檔案，處理以下功能：
    * 圖表初始化與設定。
    * 呼叫 Twelve Data API 獲取數據。
    * 處理使用者互動（如按鈕點擊、輸入）。
    * 更新圖表數據與介面狀態。

## 技術棧

* **前端**：HTML, CSS, JavaScript
* **圖表函式庫**：[Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
* **數據 API**：[Twelve Data](https://twelvedata.com/)