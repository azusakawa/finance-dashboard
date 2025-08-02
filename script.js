/**
 * @fileoverview 主程式碼，處理所有使用者互動、API 呼叫與圖表繪製邏輯。
 * @author Gemini
 */

document.addEventListener('DOMContentLoaded', function() {
    /**
     * DOM 元素快取，只在啟動時執行一次，避免重複查詢。
     * @type {Object<string, Element>}
     */
    const DOMElements = {
        chartContainer: document.getElementById('chart-container'),
        symbolInput: document.getElementById('symbol-input'),
        loadDataBtn: document.getElementById('load-data-btn'),
        intervalBtns: document.querySelectorAll('.interval-btn'),
        tooltipContainer: document.getElementById('tooltip-container'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        startDateInput: document.getElementById('start-date'),
        endDateInput: document.getElementById('end-date'),
        loadingIndicator: document.getElementById('loading-indicator'),
        apiKeyInput: document.getElementById('api-key-input'),
        apiKeyStatus: document.getElementById('api-key-status'),
        errorMessageContainer: document.getElementById('error-message'),
        controlGroups: document.querySelectorAll('.control-group'),
        autocompleteResults: document.getElementById('autocomplete-results'),
        zoomInBtn: document.getElementById('zoom-in-btn'),
        zoomOutBtn: document.getElementById('zoom-out-btn'),
        resetZoomBtn: document.getElementById('reset-zoom-btn'),
        upColorInput: document.getElementById('up-color'),
        downColorInput: document.getElementById('down-color'),
        editApiKeyBtn: document.getElementById('edit-api-key-btn'), // 新增編輯按鈕
    };

    /** @type {string} 當前選中的時間間隔 */
    let currentInterval = '1day';
    /** @type {boolean} 當前是否為暗色模式 */
    let isDarkMode = true;
    /** @type {number} 上次載入的數據點數量 */
    let lastLoadedDataCount = 0;
    /** @type {Array<Object>} 事件標記數據 */
    let markersData = [];
    /** @type {Array<Object>} 原始成交量數據，用於顏色更新 */
    let originalVolumeData = [];

    // --- 圖表初始化與設定 ---

    /** Lightweight Charts 圖表實例 */
    const chartInstance = LightweightCharts.createChart(DOMElements.chartContainer, {
        width: DOMElements.chartContainer.offsetWidth,
        height: DOMElements.chartContainer.offsetHeight,
        layout: {
            background: { type: 'solid', color: getComputedStyle(document.body).getPropertyValue('--control-group-bg') },
            textColor: getComputedStyle(document.body).getPropertyValue('--text-color'),
        },
        grid: {
            vertLines: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid-color') },
            horzLines: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid-color') },
        },
    });

    /** 圖表中的 K 線與成交量系列 */
    const series = {
        candle: chartInstance.addCandlestickSeries({
            upColor: DOMElements.upColorInput.value,
            downColor: DOMElements.downColorInput.value,
            borderDownColor: DOMElements.downColorInput.value,
            borderUpColor: DOMElements.upColorInput.value,
            wickDownColor: DOMElements.downColorInput.value,
            wickUpColor: DOMElements.upColorInput.value,
            priceScaleId: 'price-scale',
        }),
        volume: chartInstance.addHistogramSeries({
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume-scale',
            overlay: true,
            visible: true,
        }),
    };

    /**
     * 設定圖表的價格軸。
     * 將 K 線圖和成交量圖分別分配不同的空間比例。
     */
    function setupPriceScales() {
        chartInstance.priceScale('price-scale').applyOptions({
            scaleMargins: {
                top: 0.1,
                bottom: 0.2,
            },
        });
        chartInstance.priceScale('volume-scale').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
            visible: false,
            borderVisible: false,
        });
    }

    // --- API 服務模組 ---

    const apiService = {
        /**
         * 從 Twelve Data API 獲取時間序列數據 (K 線與成交量)。
         * @param {string} symbol - 股票代號。
         * @param {string} interval - 時間間隔 (e.g., '1day', '1week')。
         * @param {string} startDate - 開始日期 (格式 YYYY-MM-DD)。
         * @param {string} endDate - 結束日期 (格式 YYYY-MM-DD)。
         * @param {string} apiKey - Twelve Data API 金鑰。
         * @returns {Promise<Object>} API 回傳的數據。
         * @throws {Error} 當 API 呼叫失敗時。
         */
        fetchTimeSeries: async (symbol, interval, startDate, endDate, apiKey) => {
            let apiUrl;
            if (startDate && endDate) {
                apiUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&start_date=${startDate}&end_date=${endDate}&apikey=${apiKey}`;
            } else {
                const outputsize = 5 * 365;
                apiUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;
            }
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API 錯誤：${errorData.message || '無法取得 K 線數據。'}`);
            }
            const data = await response.json();
            if (data.status === 'error') {
                 // 針對 API 金鑰錯誤做更明確的處理
                 if (data.code === 401 || data.code === 402) {
                    throw new Error('API 金鑰無效或已過期。請檢查金鑰。');
                 }
                 throw new Error(`API 回應錯誤：${data.message}`);
            }
            return data;
        },
        
        /**
         * 從 Twelve Data API 獲取財報與股票分割事件數據。
         * @param {string} symbol - 股票代號。
         * @param {string} startDate - 開始日期。
         * @param {string} endDate - 結束日期。
         * @param {string} apiKey - Twelve Data API 金鑰。
         * @returns {Promise<Object>} 包含財報與股票分割數據的物件。
         */
        fetchEvents: async (symbol, startDate, endDate, apiKey) => {
            const [earningsResponse, splitsResponse] = await Promise.all([
                fetch(`https://api.twelvedata.com/earnings_calendar?symbol=${symbol}&start_date=${startDate || ''}&end_date=${endDate || ''}&apikey=${apiKey}`),
                fetch(`https://api.twelvedata.com/splits_calendar?symbol=${symbol}&start_date=${startDate || ''}&end_date=${endDate || ''}&apikey=${apiKey}`)
            ]);
            
            const [earningsData, splitsData] = await Promise.all([
                earningsResponse.json(),
                splitsResponse.json()
            ]);
            
            return { earningsData, splitsData };
        },

        /**
         * 獲取股票代號自動完成建議。
         * @param {string} query - 使用者輸入的查詢字串。
         * @param {string} apiKey - Twelve Data API 金鑰。
         * @returns {Promise<Object>} 包含建議清單的數據。
         * @throws {Error} 當 API 呼叫失敗時。
         */
        fetchAutocomplete: async (query, apiKey) => {
            const apiUrl = `https://api.twelvedata.com/symbol_search?symbol=${query}&outputsize=10&apikey=${apiKey}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('無法取得建議清單。');
            }
            return await response.json();
        }
    };

    // --- UI 處理模組 ---

    const uiHandler = {
        /**
         * 根據是否為暗色模式切換頁面主題。
         * @param {boolean} isDark - 是否為暗色模式。
         */
        applyTheme: (isDark) => {
            document.body.classList.toggle('light-theme', !isDark);
            
            // 由於 chartInstance 的顏色需要直接設定，這裡需要從 CSS 變數讀取
            chartInstance.applyOptions({
                layout: {
                    background: { type: 'solid', color: getComputedStyle(document.body).getPropertyValue('--control-group-bg') },
                    textColor: getComputedStyle(document.body).getPropertyValue('--text-color'),
                },
                grid: {
                    vertLines: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid-color') },
                    horzLines: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid-color') },
                },
            });
            DOMElements.themeToggleBtn.textContent = isDark ? '亮色模式' : '暗色模式';
        },

        /**
         * 根據顏色選擇器更新圖表的 K 線與成交量顏色。
         */
        updateChartColors: () => {
            const upColor = DOMElements.upColorInput.value;
            const downColor = DOMElements.downColorInput.value;
            series.candle.applyOptions({
                upColor: upColor,
                downColor: downColor,
                borderDownColor: downColor,
                borderUpColor: upColor,
                wickDownColor: downColor,
                wickUpColor: upColor,
            });
            if (originalVolumeData.length > 0) {
                const formattedVolumeData = originalVolumeData.map(item => ({
                    time: item.time,
                    value: item.value,
                    color: item.open > item.close ? downColor : upColor
                }));
                series.volume.setData(formattedVolumeData);
            }
            localStorage.setItem('upColor', upColor);
            localStorage.setItem('downColor', downColor);
        },

        /**
         * 顯示錯誤訊息。
         * @param {string} message - 要顯示的錯誤訊息。
         */
        showError: (message) => {
            DOMElements.errorMessageContainer.textContent = message;
            DOMElements.errorMessageContainer.style.display = 'block';
        },

        /**
         * 隱藏錯誤訊息。
         */
        hideError: () => {
            DOMElements.errorMessageContainer.style.display = 'none';
        },

        /**
         * 顯示載入指示器。
         */
        showLoading: () => {
            DOMElements.chartContainer.classList.add('loading');
            DOMElements.loadingIndicator.style.display = 'block';
            DOMElements.loadingIndicator.innerHTML = '<div class="loader"></div><span>正在載入數據...</span>';
        },

        /**
         * 隱藏載入指示器。
         */
        hideLoading: () => {
            DOMElements.chartContainer.classList.remove('loading');
            DOMElements.loadingIndicator.style.display = 'none';
        },

        /**
         * 在自動完成結果區塊顯示建議清單。
         * @param {Object} results - 包含建議數據的物件。
         */
        displayAutocompleteResults: (results) => {
            const { autocompleteResults, symbolInput, loadDataBtn } = DOMElements;
            autocompleteResults.innerHTML = '';
            if (results && results.data && results.data.length > 0) {
                results.data.forEach(item => {
                    const resultItem = document.createElement('div');
                    resultItem.textContent = `${item.symbol} - ${item.instrument_name}`;
                    resultItem.dataset.symbol = item.symbol;
                    resultItem.addEventListener('click', () => {
                        symbolInput.value = item.symbol;
                        autocompleteResults.style.display = 'none';
                        loadDataBtn.click();
                    });
                    autocompleteResults.appendChild(resultItem);
                });
                autocompleteResults.style.display = 'block';
            } else {
                autocompleteResults.style.display = 'none';
            }
        },

        /**
         * 根據是否有 API 金鑰切換輸入框和狀態訊息的顯示。
         * @param {boolean} hasApiKey - 是否已儲存 API 金鑰。
         */
        toggleApiKeyInputState: (hasApiKey) => {
            DOMElements.apiKeyInput.style.display = hasApiKey ? 'none' : 'inline';
            DOMElements.apiKeyStatus.style.display = hasApiKey ? 'inline-flex' : 'none';
            // 如果金鑰輸入框可見，自動聚焦
            if (!hasApiKey) {
                DOMElements.apiKeyInput.focus();
            }
        }
    };

    // --- 主程式邏輯 ---

    /**
     * 載入所有圖表數據，包括 K 線、成交量和事件標記。
     * @param {string} symbol - 股票代號。
     * @param {string} interval - 時間間隔。
     * @param {string} startDate - 開始日期。
     * @param {string} endDate - 結束日期。
     * @param {string} apiKey - API 金鑰。
     */
    async function loadAllData(symbol, interval, startDate, endDate, apiKey) {
        uiHandler.hideError();
        uiHandler.hideLoading();
        DOMElements.autocompleteResults.style.display = 'none';

        if (!apiKey || apiKey.trim() === '') {
            uiHandler.showError('錯誤：請先輸入你的 API 金鑰！');
            // 如果沒有金鑰，保持輸入框可見
            uiHandler.toggleApiKeyInputState(false);
            return;
        }
        if (!symbol || symbol.trim() === '') {
            uiHandler.showError('錯誤：請輸入股票代號！');
            return;
        }

        uiHandler.showLoading();

        try {
            const timeSeriesData = await apiService.fetchTimeSeries(symbol, interval, startDate, endDate, apiKey);
            const { earningsData, splitsData } = await apiService.fetchEvents(symbol, startDate, endDate, apiKey);

            // 格式化 K 線數據
            const formattedCandleData = timeSeriesData.values
                .map(item => ({
                    time: item.datetime,
                    open: parseFloat(item.open),
                    high: parseFloat(item.high),
                    low: parseFloat(item.low),
                    close: parseFloat(item.close),
                }))
                .filter(item => item.open !== null && item.high !== null && item.low !== null && item.close !== null)
                .reverse();

            // 格式化成交量數據
            originalVolumeData = timeSeriesData.values
                .map(item => ({
                    time: item.datetime,
                    value: parseFloat(item.volume),
                    open: parseFloat(item.open),
                    close: parseFloat(item.close)
                }))
                .filter(item => item.value !== null)
                .reverse();
            const upColor = DOMElements.upColorInput.value;
            const downColor = DOMElements.downColorInput.value;
            const formattedVolumeData = originalVolumeData.map(item => ({
                time: item.time,
                value: item.value,
                color: item.open > item.close ? downColor : upColor
            }));

            // 更新圖表系列
            series.candle.setData(formattedCandleData);
            lastLoadedDataCount = formattedCandleData.length;
            series.volume.setData(formattedVolumeData);

            // 處理事件標記
            const markers = [];
            if (earningsData.status !== 'error' && earningsData.earnings_calendar) {
                earningsData.earnings_calendar.forEach(earning => markers.push({ time: earning.datetime.substring(0, 10), position: 'inBar', color: '#2962FF', shape: 'circle', text: `EPS: ${earning.eps_estimate || 'N/A'}` }));
            }
            if (splitsData.status !== 'error' && splitsData.splits_calendar) {
                splitsData.splits_calendar.forEach(split => markers.push({ time: split.datetime.substring(0, 10), position: 'inBar', color: '#FF6D00', shape: 'arrowUp', text: `股票分割: ${split.new_shares} for ${split.old_shares}` }));
            }
            markersData = markers;
            series.candle.setMarkers(markersData);
            
            // 儲存狀態到 localStorage
            localStorage.setItem('twelveDataApiKey', apiKey);
            localStorage.setItem('lastSymbol', symbol);
            
            // 成功載入數據後，隱藏輸入框並顯示狀態
            uiHandler.toggleApiKeyInputState(true);

        } catch (error) {
            console.error('載入數據時發生錯誤:', error);
            uiHandler.showError(`載入數據時發生錯誤：${error.message}`);
            // 如果 API 呼叫失敗，顯示輸入框
            uiHandler.toggleApiKeyInputState(false);
        } finally {
            uiHandler.hideLoading();
        }
    }
    
    // --- 助手函式 ---

    /**
     * 函式去抖動 (debounce) 函式。
     * @param {Function} func - 要去抖動的函式。
     * @param {number} delay - 延遲時間（毫秒）。
     * @returns {Function} 去抖動後的函式。
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    const fetchAutocompleteDebounced = debounce(async (query) => {
        const apiKey = DOMElements.apiKeyInput.value.trim();
        if (query.length < 2 || !apiKey) {
            DOMElements.autocompleteResults.style.display = 'none';
            return;
        }
        try {
            const data = await apiService.fetchAutocomplete(query, apiKey);
            uiHandler.displayAutocompleteResults(data);
        } catch (error) {
            console.error('自動完成 API 錯誤:', error);
            DOMElements.autocompleteResults.style.display = 'none';
        }
    }, 300);

    // --- 事件監聽器設定 ---

    /**
     * 設定所有 DOM 元素的事件監聽器。
     */
    function setupEventListeners() {
        window.addEventListener('resize', () => {
            chartInstance.applyOptions({
                width: DOMElements.chartContainer.offsetWidth,
                height: DOMElements.chartContainer.offsetHeight,
            });
        });

        DOMElements.symbolInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                DOMElements.loadDataBtn.click();
            }
        });

        DOMElements.symbolInput.addEventListener('input', (e) => {
            fetchAutocompleteDebounced(e.target.value.trim());
        });

        document.addEventListener('click', (e) => {
            if (!DOMElements.symbolInput.contains(e.target) && !DOMElements.autocompleteResults.contains(e.target)) {
                DOMElements.autocompleteResults.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (document.activeElement === DOMElements.symbolInput || document.activeElement === DOMElements.apiKeyInput) {
                return;
            }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); DOMElements.zoomInBtn.click(); }
            else if (e.key === '-') { e.preventDefault(); DOMElements.zoomOutBtn.click(); }
            else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); DOMElements.resetZoomBtn.click(); }
        });

        DOMElements.loadDataBtn.addEventListener('click', () => {
            const symbol = DOMElements.symbolInput.value.trim();
            const startDate = DOMElements.startDateInput.value;
            const endDate = DOMElements.endDateInput.value;
            const apiKey = DOMElements.apiKeyInput.value.trim();
            loadAllData(symbol, currentInterval, startDate, endDate, apiKey);
        });

        DOMElements.intervalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOMElements.intervalBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentInterval = btn.dataset.interval;
                localStorage.setItem('chartInterval', currentInterval);
                DOMElements.startDateInput.value = '';
                DOMElements.endDateInput.value = '';
                const apiKey = DOMElements.apiKeyInput.value.trim();
                loadAllData(DOMElements.symbolInput.value.trim(), currentInterval, '', '', apiKey);
            });
        });

        DOMElements.zoomInBtn.addEventListener('click', () => {
            const timeScale = chartInstance.timeScale();
            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) {
                const fromTimestamp = new Date(visibleRange.from).getTime();
                const toTimestamp = new Date(visibleRange.to).getTime();
                const newFrom = fromTimestamp + (toTimestamp - fromTimestamp) * 0.1;
                const newTo = toTimestamp - (toTimestamp - fromTimestamp) * 0.1;
                timeScale.setVisibleRange({ from: new Date(newFrom).toISOString().substring(0, 10), to: new Date(newTo).toISOString().substring(0, 10) });
            }
        });

        DOMElements.zoomOutBtn.addEventListener('click', () => {
            const timeScale = chartInstance.timeScale();
            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) {
                const fromTimestamp = new Date(visibleRange.from).getTime();
                const toTimestamp = new Date(visibleRange.to).getTime();
                const newFrom = fromTimestamp - (toTimestamp - fromTimestamp) * 0.1;
                const newTo = toTimestamp + (toTimestamp - fromTimestamp) * 0.1;
                timeScale.setVisibleRange({ from: new Date(newFrom).toISOString().substring(0, 10), to: new Date(newTo).toISOString().substring(0, 10) });
            }
        });

        DOMElements.resetZoomBtn.addEventListener('click', () => {
            const defaultVisibleBars = 120;
            if (lastLoadedDataCount > 0) {
                const logicalRange = {
                    from: Math.max(0, lastLoadedDataCount - defaultVisibleBars),
                    to: lastLoadedDataCount,
                };
                chartInstance.timeScale().setVisibleLogicalRange(logicalRange);
            } else {
                chartInstance.timeScale().fitContent();
            }
        });

        chartInstance.subscribeCrosshairMove((param) => {
            const { point, time, seriesData } = param;
            if (!point || !time || !seriesData) {
                DOMElements.tooltipContainer.style.display = 'none';
                return;
            }
            const candleData = seriesData.get(series.candle);
            const marker = markersData.find(m => m.time === time);

            if (marker) {
                DOMElements.tooltipContainer.innerHTML = `<b>時間:</b> ${marker.time}<br><b>事件:</b> ${marker.text}`;
            } else if (candleData) {
                DOMElements.tooltipContainer.innerHTML = `<b>時間:</b> ${candleData.time}<br><b>開盤:</b> ${candleData.open.toFixed(2)}<br><b>最高:</b> ${candleData.high.toFixed(2)}<br><b>最低:</b> ${candleData.low.toFixed(2)}<br><b>收盤:</b> ${candleData.close.toFixed(2)}`;
            } else {
                DOMElements.tooltipContainer.style.display = 'none';
                return;
            }

            DOMElements.tooltipContainer.style.display = 'block';
            const x = point.x;
            DOMElements.tooltipContainer.style.left = `${x + 15}px`;
            if (x + DOMElements.tooltipContainer.offsetWidth + 15 > DOMElements.chartContainer.offsetWidth) {
                DOMElements.tooltipContainer.style.left = `${x - DOMElements.tooltipContainer.offsetWidth - 15}px`;
            }
        });

        DOMElements.themeToggleBtn.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            localStorage.setItem('isDarkMode', isDarkMode);
            uiHandler.applyTheme(isDarkMode);
        });

        DOMElements.upColorInput.addEventListener('input', uiHandler.updateChartColors);
        DOMElements.downColorInput.addEventListener('input', uiHandler.updateChartColors);
        
        // 新增：處理編輯 API 金鑰按鈕點擊事件
        DOMElements.editApiKeyBtn.addEventListener('click', () => {
            uiHandler.toggleApiKeyInputState(false);
            DOMElements.apiKeyInput.value = '';
            localStorage.removeItem('twelveDataApiKey');
        });
    }

    // --- 啟動函式 ---

    /**
     * 應用程式的初始化入口點。
     * 在 DOM 載入完成後執行。
     */
    function initApp() {
        // 從 localStorage 載入使用者設定
        const savedApiKey = localStorage.getItem('twelveDataApiKey');
        if (savedApiKey) {
            DOMElements.apiKeyInput.value = savedApiKey;
            uiHandler.toggleApiKeyInputState(true);
        } else {
            uiHandler.toggleApiKeyInputState(false);
        }

        const savedSymbol = localStorage.getItem('lastSymbol');
        if (savedSymbol) {
            DOMElements.symbolInput.value = savedSymbol;
        }

        const savedIsDarkMode = localStorage.getItem('isDarkMode');
        if (savedIsDarkMode !== null) {
            isDarkMode = (savedIsDarkMode === 'true');
            uiHandler.applyTheme(isDarkMode);
        } else {
            uiHandler.applyTheme(isDarkMode); // 首次載入時設定預設暗色模式
        }

        const savedInterval = localStorage.getItem('chartInterval');
        if (savedInterval) {
            currentInterval = savedInterval;
            DOMElements.intervalBtns.forEach(btn => {
                if (btn.dataset.interval === currentInterval) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } else {
            document.querySelector('.interval-btn[data-interval="1day"]').classList.add('active');
        }

        const savedUpColor = localStorage.getItem('upColor');
        const savedDownColor = localStorage.getItem('downColor');
        if (savedUpColor && savedDownColor) {
            DOMElements.upColorInput.value = savedUpColor;
            DOMElements.downColorInput.value = savedDownColor;
            uiHandler.updateChartColors();
        }

        // 設定圖表並註冊事件監聽器
        setupPriceScales();
        setupEventListeners();

        // 如果有儲存的 API 金鑰和股票代號，則自動載入數據
        if (savedApiKey && savedSymbol) {
            loadAllData(DOMElements.symbolInput.value, currentInterval, '', '', savedApiKey);
        }
    }

    // 啟動應用程式
    initApp();
});