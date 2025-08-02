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
        editApiKeyBtn: document.getElementById('edit-api-key-btn'),
        langSelect: document.getElementById('lang-select'), // 新增語言選擇器
    };
    
    /**
     * 儲存所有可翻譯的字串。
     * @type {Object}
     */
    const translations = {
        'zh-Hant': {
            title: '即時股票圖表',
            language: '語言:',
            apiKeyLabel: 'API 金鑰:',
            apiKeyPlaceholder: '請輸入你的 Twelve Data API 金鑰',
            apiKeySaved: 'API 金鑰已儲存！',
            editButton: '編輯',
            apiRegisterLink: '註冊 Twelve Data API 金鑰',
            symbolLabel: '股票代號:',
            symbolPlaceholder: '例如: AAPL, TSLA',
            loadDataButton: '載入數據',
            intervalLabel: '時間間隔:',
            startDateLabel: '開始日期:',
            endDateLabel: '結束日期:',
            visualSettingsLabel: '視覺化設定:',
            upColorLabel: '上漲 K 線:',
            downColorLabel: '下跌 K 線:',
            loadingText: '正在載入數據...',
            zoomInButton: '放大 (+)',
            zoomOutButton: '縮小 (-)',
            resetZoomButton: '重設縮放 (R)',
            toggleThemeButton: '亮色模式',
            tooltipTime: '時間:',
            tooltipOpen: '開盤:',
            tooltipHigh: '最高:',
            tooltipLow: '最低:',
            tooltipClose: '收盤:',
            tooltipEvent: '事件:',
            tooltipEps: 'EPS:',
            tooltipSplit: '股票分割:',
            errorNoApiKey: '錯誤：請先輸入你的 API 金鑰！',
            errorInvalidApiKey: 'API 金鑰無效或已過期。請檢查金鑰。',
            errorNoSymbol: '錯誤：請輸入股票代號！',
            errorApi: '載入數據時發生錯誤：',
        },
        'en': {
            title: 'Real-time Stock Chart',
            language: 'Language:',
            apiKeyLabel: 'API Key:',
            apiKeyPlaceholder: 'Enter your Twelve Data API Key',
            apiKeySaved: 'API Key saved!',
            editButton: 'Edit',
            apiRegisterLink: 'Register for Twelve Data API Key',
            symbolLabel: 'Symbol:',
            symbolPlaceholder: 'e.g., AAPL, TSLA',
            loadDataButton: 'Load Data',
            intervalLabel: 'Interval:',
            startDateLabel: 'Start Date:',
            endDateLabel: 'End Date:',
            visualSettingsLabel: 'Visualization Settings:',
            upColorLabel: 'Up Color:',
            downColorLabel: 'Down Color:',
            loadingText: 'Loading data...',
            zoomInButton: 'Zoom In (+)',
            zoomOutButton: 'Zoom Out (-)',
            resetZoomButton: 'Reset Zoom (R)',
            toggleThemeButton: 'Light Mode',
            tooltipTime: 'Time:',
            tooltipOpen: 'Open:',
            tooltipHigh: 'High:',
            tooltipLow: 'Low:',
            tooltipClose: 'Close:',
            tooltipEvent: 'Event:',
            tooltipEps: 'EPS:',
            tooltipSplit: 'Stock Split:',
            errorNoApiKey: 'Error: Please enter your API key first!',
            errorInvalidApiKey: 'Invalid or expired API key. Please check your key.',
            errorNoSymbol: 'Error: Please enter a stock symbol!',
            errorApi: 'Error loading data:',
        }
    };
    
    /** @type {string} 當前選中的語言 */
    let currentLanguage = 'zh-Hant';

    // ... (其餘的變數、圖表初始化、setupPriceScales 函式等保持不變) ...
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


    // --- 輔助函式 - 語言切換 ---

    /**
     * 根據當前語言更新頁面上所有帶有 data-i18n 屬性的文字。
     */
    function setLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[currentLanguage][key]) {
                element.textContent = translations[currentLanguage][key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (translations[currentLanguage][key]) {
                element.placeholder = translations[currentLanguage][key];
            }
        });
        // 額外處理 theme toggle 按鈕的文字
        DOMElements.themeToggleBtn.textContent = translations[currentLanguage][isDarkMode ? 'toggleThemeButton' : 'toggleThemeButton'].replace('亮色模式', '暗色模式').replace('Light Mode', 'Dark Mode');
    }

    // --- API 服務模組 (無變動) ---

    const apiService = {
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
                 if (data.code === 401 || data.code === 402) {
                    throw new Error(translations[currentLanguage].errorInvalidApiKey);
                 }
                 throw new Error(`${translations[currentLanguage].errorApi}${data.message}`);
            }
            return data;
        },
        
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
        applyTheme: (isDark) => {
            document.body.classList.toggle('light-theme', !isDark);
            
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
            
            DOMElements.themeToggleBtn.textContent = translations[currentLanguage][isDark ? 'toggleThemeButton' : 'toggleThemeButton'].replace('亮色模式', '暗色模式').replace('Light Mode', 'Dark Mode');
        },

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

        showError: (message) => {
            DOMElements.errorMessageContainer.textContent = message;
            DOMElements.errorMessageContainer.style.display = 'block';
        },

        hideError: () => {
            DOMElements.errorMessageContainer.style.display = 'none';
        },

        showLoading: () => {
            DOMElements.chartContainer.classList.add('loading');
            DOMElements.loadingIndicator.style.display = 'block';
            DOMElements.loadingIndicator.innerHTML = `<div class="loader"></div><span>${translations[currentLanguage].loadingText}</span>`;
        },

        hideLoading: () => {
            DOMElements.chartContainer.classList.remove('loading');
            DOMElements.loadingIndicator.style.display = 'none';
        },

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

        toggleApiKeyInputState: (hasApiKey) => {
            DOMElements.apiKeyInput.style.display = hasApiKey ? 'none' : 'inline';
            DOMElements.apiKeyStatus.style.display = hasApiKey ? 'inline-flex' : 'none';
            if (!hasApiKey) {
                DOMElements.apiKeyInput.focus();
            }
        }
    };

    // --- 主程式邏輯 ---

    async function loadAllData(symbol, interval, startDate, endDate, apiKey) {
        uiHandler.hideError();
        uiHandler.hideLoading();
        DOMElements.autocompleteResults.style.display = 'none';

        if (!apiKey || apiKey.trim() === '') {
            uiHandler.showError(translations[currentLanguage].errorNoApiKey);
            uiHandler.toggleApiKeyInputState(false);
            return;
        }
        if (!symbol || symbol.trim() === '') {
            uiHandler.showError(translations[currentLanguage].errorNoSymbol);
            return;
        }

        uiHandler.showLoading();

        try {
            const timeSeriesData = await apiService.fetchTimeSeries(symbol, interval, startDate, endDate, apiKey);
            const { earningsData, splitsData } = await apiService.fetchEvents(symbol, startDate, endDate, apiKey);

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

            series.candle.setData(formattedCandleData);
            lastLoadedDataCount = formattedCandleData.length;
            series.volume.setData(formattedVolumeData);

            const markers = [];
            if (earningsData.status !== 'error' && earningsData.earnings_calendar) {
                earningsData.earnings_calendar.forEach(earning => markers.push({ time: earning.datetime.substring(0, 10), position: 'inBar', color: '#2962FF', shape: 'circle', text: `${translations[currentLanguage].tooltipEps} ${earning.eps_estimate || 'N/A'}` }));
            }
            if (splitsData.status !== 'error' && splitsData.splits_calendar) {
                splitsData.splits_calendar.forEach(split => markers.push({ time: split.datetime.substring(0, 10), position: 'inBar', color: '#FF6D00', shape: 'arrowUp', text: `${translations[currentLanguage].tooltipSplit} ${split.new_shares} for ${split.old_shares}` }));
            }
            markersData = markers;
            series.candle.setMarkers(markersData);
            
            localStorage.setItem('twelveDataApiKey', apiKey);
            localStorage.setItem('lastSymbol', symbol);
            
            uiHandler.toggleApiKeyInputState(true);

        } catch (error) {
            console.error('載入數據時發生錯誤:', error);
            uiHandler.showError(`${translations[currentLanguage].errorApi} ${error.message}`);
            uiHandler.toggleApiKeyInputState(false);
        } finally {
            uiHandler.hideLoading();
        }
    }
    
    // --- 助手函式 ---

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
            const defaultVisibleBars = 90;
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
                DOMElements.tooltipContainer.innerHTML = `<b>${translations[currentLanguage].tooltipTime}</b> ${marker.time}<br><b>${translations[currentLanguage].tooltipEvent}</b> ${marker.text}`;
            } else if (candleData) {
                DOMElements.tooltipContainer.innerHTML = `<b>${translations[currentLanguage].tooltipTime}</b> ${candleData.time}<br><b>${translations[currentLanguage].tooltipOpen}</b> ${candleData.open.toFixed(2)}<br><b>${translations[currentLanguage].tooltipHigh}</b> ${candleData.high.toFixed(2)}<br><b>${translations[currentLanguage].tooltipLow}</b> ${candleData.low.toFixed(2)}<br><b>${translations[currentLanguage].tooltipClose}</b> ${candleData.close.toFixed(2)}`;
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
        
        DOMElements.editApiKeyBtn.addEventListener('click', () => {
            uiHandler.toggleApiKeyInputState(false);
            DOMElements.apiKeyInput.value = '';
            localStorage.removeItem('twelveDataApiKey');
        });

        // 新增：語言選擇器的事件監聽器
        DOMElements.langSelect.addEventListener('change', (e) => {
            currentLanguage = e.target.value;
            localStorage.setItem('language', currentLanguage);
            setLanguage();
            // 由於 themeToggleBtn 的文字需要特別處理，所以這裡需要更新
            uiHandler.applyTheme(isDarkMode); 
        });
    }

    // --- 啟動函式 ---

    function initApp() {
        // 從 localStorage 載入語言設定，否則使用預設
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage && translations[savedLanguage]) {
            currentLanguage = savedLanguage;
            DOMElements.langSelect.value = savedLanguage;
        }
        setLanguage(); // 在啟動時設定一次語言

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
            uiHandler.applyTheme(isDarkMode);
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

        setupPriceScales();
        setupEventListeners();

        if (savedApiKey && savedSymbol) {
            loadAllData(DOMElements.symbolInput.value, currentInterval, '', '', savedApiKey);
        }
    }

    initApp();
});