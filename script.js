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
        themeSelect: document.getElementById('theme-select'),
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
        toggleVolumeBtn: document.getElementById('toggle-volume-btn'),
        toggleMaBtn: document.getElementById('toggle-ma-btn'),
        editApiKeyBtn: document.getElementById('edit-api-key-btn')
    };

    // 狀態變數
    let currentInterval = '1day';
    let currentTheme = 'tradingview-theme';
    let lastLoadedDataCount = 0;
    let isVolumeVisible = false;
    let isMaVisible = false;

    // 圖表系列
    let chart, candleSeries, volumeSeries, maSeries;

    // 定義不同主題的顏色配置
    const THEME_CONFIGS = {
        'tradingview-theme': {
            layout: { background: { type: 'solid', color: '#0b0e14' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: 'rgba(60, 60, 60, 0.5)' }, horzLines: { color: 'rgba(60, 60, 60, 0.5)' } },
            crosshair: { mode: 0 }, // 0 = Normal, 1 = Magnet
            priceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true }
        },
        'light-theme': {
            layout: { background: { type: 'solid', color: '#f0f3fa' }, textColor: '#1c1e21' },
            grid: { vertLines: { color: 'rgba(215, 215, 215, 0.5)' }, horzLines: { color: 'rgba(215, 215, 215, 0.5)' } },
            crosshair: { mode: 0 },
            priceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true }
        },
        'modern-dark-theme': {
            layout: { background: { type: 'solid', color: '#121212' }, textColor: '#e0e0e0' },
            grid: { vertLines: { color: 'rgba(70, 70, 70, 0.5)' }, horzLines: { color: 'rgba(70, 70, 70, 0.5)' } },
            crosshair: { mode: 0 },
            priceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true }
        }
    };

    /**
     * UI 處理相關邏輯
     */
    const uiHandler = {
        /** 應用主題 */
        applyTheme: (themeName) => {
            const theme = THEME_CONFIGS[themeName];
            if (!theme) return;

            document.body.className = '';
            document.body.classList.add(themeName);
            
            // 更新圖表主題
            if (chart) {
                chart.applyOptions(theme);
                // 由於 volume series 的顏色獨立於主題，我們在切換主題時需要手動重設
                if (isVolumeVisible) {
                    uiHandler.updateVolumeSeriesColors(themeName);
                }
            }

            // 更新 localStorage
            localStorage.setItem('chartTheme', themeName);
        },

        /** 更新 K 線顏色 */
        updateChartColors: () => {
            if (candleSeries) {
                const upColor = DOMElements.upColorInput.value;
                const downColor = DOMElements.downColorInput.value;
                candleSeries.applyOptions({
                    upColor: upColor,
                    downColor: downColor,
                    borderUpColor: upColor,
                    borderDownColor: downColor,
                    wickUpColor: upColor,
                    wickDownColor: downColor,
                });
                localStorage.setItem('upColor', upColor);
                localStorage.setItem('downColor', downColor);
            }
        },

        /** 更新成交量顏色 */
        updateVolumeSeriesColors: (themeName) => {
            if (volumeSeries) {
                let upColor, downColor;
                if (themeName === 'light-theme') {
                    upColor = 'rgba(38, 166, 154, 0.4)';
                    downColor = 'rgba(239, 83, 80, 0.4)';
                } else {
                    upColor = 'rgba(38, 166, 154, 0.4)';
                    downColor = 'rgba(239, 83, 80, 0.4)';
                }
                volumeSeries.applyOptions({
                    upColor: upColor,
                    downColor: downColor
                });
            }
        },

        /** 顯示載入指示器 */
        showLoading: () => {
            DOMElements.loadingIndicator.style.display = 'flex';
            DOMElements.chartContainer.classList.add('loading');
        },

        /** 隱藏載入指示器 */
        hideLoading: () => {
            DOMElements.loadingIndicator.style.display = 'none';
            DOMElements.chartContainer.classList.remove('loading');
        },
        
        /** 顯示錯誤訊息 */
        showError: (message) => {
            DOMElements.errorMessageContainer.textContent = message;
            DOMElements.errorMessageContainer.style.display = 'block';
        },

        /** 隱藏錯誤訊息 */
        hideError: () => {
            DOMElements.errorMessageContainer.style.display = 'none';
        }
    };

    /**
     * API 處理相關邏輯
     */
    const apiHandler = {
        BASE_URL: 'https://api.twelvedata.com',
        API_KEY: '',

        fetchData: async (symbol, interval, startDate, endDate) => {
            const url = `${apiHandler.BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&apikey=${apiHandler.API_KEY}&outputsize=5000&start_date=${startDate}&end_date=${endDate}`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        },

        fetchAutocomplete: async (query) => {
            const url = `${apiHandler.BASE_URL}/symbol_search?symbol=${query}&apikey=${apiHandler.API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        },

        // 其他 API 函數...
    };

    /**
     * 圖表設定相關邏輯
     */
    const chartHandler = {
        initialize: () => {
            chart = LightweightCharts.createChart(DOMElements.chartContainer, {
                width: DOMElements.chartContainer.offsetWidth,
                height: DOMElements.chartContainer.offsetHeight,
                ...THEME_CONFIGS[currentTheme]
            });
            
            candleSeries = chart.addCandlestickSeries({
                upColor: DOMElements.upColorInput.value,
                downColor: DOMEElements.downColorInput.value,
                borderUpColor: DOMElements.upColorInput.value,
                borderDownColor: DOMElements.downColorInput.value,
                wickUpColor: DOMElements.upColorInput.value,
                wickDownColor: DOMElements.downColorInput.value,
            });

            volumeSeries = chart.addHistogramSeries({
                priceScaleId: '', // 綁定到左側價格軸
                overlay: true, // 疊加在主圖上
                lastValueVisible: false,
                priceLineVisible: false,
                pane: 1, // 將其放在第二個窗格中
            });
            volumeSeries.applyOptions({
                priceFormat: {
                    type: 'volume',
                },
                upColor: 'rgba(38, 166, 154, 0.4)',
                downColor: 'rgba(239, 83, 80, 0.4)',
            });
            volumeSeries.setData([]); // 預設為空，隱藏
            chart.priceScale('left').applyOptions({
                visible: false,
            });

            maSeries = chart.addLineSeries({
                color: '#ffc107',
                lineWidth: 2,
            });
            maSeries.setData([]);
        },

        updateData: (data) => {
            candleSeries.setData(data.map(item => ({
                time: item.datetime,
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                close: parseFloat(item.close)
            })));
            lastLoadedDataCount = data.length;
        },
        
        updateVolumeData: (data) => {
            const volumeData = data.map(item => ({
                time: item.datetime,
                value: parseFloat(item.volume),
                color: parseFloat(item.close) >= parseFloat(item.open) ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)'
            }));
            volumeSeries.setData(volumeData);
            if(isVolumeVisible) {
                chart.priceScale('left').applyOptions({ visible: true });
            }
        },

        updateMaData: (data) => {
            const maData = calculateMA(data, 20); // 計算 20 期移動平均線
            maSeries.setData(maData);
        },

        resizeChart: () => {
            if (chart) {
                chart.applyOptions({
                    width: DOMElements.chartContainer.offsetWidth,
                    height: DOMElements.chartContainer.offsetHeight
                });
            }
        },
    };

    /**
     * 輔助函數
     */
    const helpers = {
        formatDate: (dateString) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        calculateMA: (data, period) => {
            const maData = [];
            for (let i = period - 1; i < data.length; i++) {
                const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + parseFloat(curr.close), 0);
                maData.push({
                    time: data[i].datetime,
                    value: sum / period
                });
            }
            return maData;
        }
    };
    
    // --- 主要邏輯與事件監聽器 ---

    const loadAllData = async (symbol, interval, startDate, endDate) => {
        if (!apiHandler.API_KEY) {
            uiHandler.showError('請先輸入並儲存你的 Twelve Data API 金鑰！');
            return;
        }
        
        uiHandler.hideError();
        uiHandler.showLoading();
        
        try {
            const data = await apiHandler.fetchData(symbol, interval, startDate, endDate);
            
            if (data && data.status === 'ok' && data.values.length > 0) {
                chartHandler.updateData(data.values);
                chartHandler.updateVolumeData(data.values);
                chartHandler.updateMaData(data.values);
                localStorage.setItem('lastSymbol', symbol);
            } else {
                uiHandler.showError(`載入數據失敗：${data.message || '找不到數據'}`);
                // 清除舊數據
                candleSeries.setData([]);
                volumeSeries.setData([]);
                maSeries.setData([]);
            }
        } catch (error) {
            console.error('API 呼叫失敗:', error);
            uiHandler.showError('無法從 API 獲取數據，請檢查連線或 API 金鑰。');
        } finally {
            uiHandler.hideLoading();
        }
    };

    const setupEventListeners = () => {
        // ... (其他事件監聽器與舊版相同) ...

        // 主題選擇器事件監聽器
        DOMElements.themeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            uiHandler.applyTheme(selectedTheme);
        });

        // 按鈕點擊事件
        DOMElements.loadDataBtn.addEventListener('click', () => {
            const symbol = DOMElements.symbolInput.value.toUpperCase();
            if (symbol) {
                const startDate = DOMElements.startDateInput.value;
                const endDate = DOMElements.endDateInput.value;
                loadAllData(symbol, currentInterval, startDate, endDate);
            }
        });
        
        // 時間間隔按鈕
        DOMElements.intervalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOMElements.intervalBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentInterval = btn.dataset.interval;
                localStorage.setItem('chartInterval', currentInterval);
                const symbol = DOMElements.symbolInput.value.toUpperCase();
                if (symbol) {
                    const startDate = DOMElements.startDateInput.value;
                    const endDate = DOMElements.endDateInput.value;
                    loadAllData(symbol, currentInterval, startDate, endDate);
                }
            });
        });

        // 視覺化顏色選擇器
        DOMElements.upColorInput.addEventListener('change', uiHandler.updateChartColors);
        DOMElements.downColorInput.addEventListener('change', uiHandler.updateChartColors);

        // 放大縮小按鈕
        DOMElements.zoomInBtn.addEventListener('click', () => {
            const from = lastLoadedDataCount - 50 > 0 ? lastLoadedDataCount - 50 : 0;
            const to = lastLoadedDataCount;
            if (from < to) {
                chart.timeScale().setVisibleLogicalRange({ from, to });
            }
        });
        DOMElements.zoomOutBtn.addEventListener('click', () => {
            const from = 0;
            const to = lastLoadedDataCount;
            chart.timeScale().setVisibleLogicalRange({ from, to });
        });
        DOMElements.resetZoomBtn.addEventListener('click', () => {
            chart.timeScale().fitContent();
        });

        // 切換成交量
        DOMElements.toggleVolumeBtn.addEventListener('click', () => {
            isVolumeVisible = !isVolumeVisible;
            if (isVolumeVisible) {
                DOMElements.toggleVolumeBtn.classList.add('active');
                volumeSeries.setData(
                    // 重新整理數據，確保 volumeSeries 的顏色正確
                    candleSeries.data().map((d, i) => ({
                        time: d.time,
                        value: d.originalData.volume,
                        color: d.close >= d.open ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)'
                    }))
                );
                chart.priceScale('left').applyOptions({ visible: true });
            } else {
                DOMElements.toggleVolumeBtn.classList.remove('active');
                volumeSeries.setData([]);
                chart.priceScale('left').applyOptions({ visible: false });
            }
        });
        
        // 切換 MA
        DOMElements.toggleMaBtn.addEventListener('click', () => {
            isMaVisible = !isMaVisible;
            if (isMaVisible) {
                DOMElements.toggleMaBtn.classList.add('active');
                const maData = helpers.calculateMA(candleSeries.data().map(d => ({
                    datetime: d.time,
                    close: d.close
                })), 20);
                maSeries.setData(maData);
            } else {
                DOMElements.toggleMaBtn.classList.remove('active');
                maSeries.setData([]);
            }
        });

        // API 金鑰輸入
        DOMElements.apiKeyInput.addEventListener('input', () => {
            apiHandler.API_KEY = DOMElements.apiKeyInput.value.trim();
            localStorage.setItem('twelveDataApiKey', apiHandler.API_KEY);
            if (apiHandler.API_KEY) {
                DOMElements.apiKeyInput.style.display = 'none';
                DOMElements.apiKeyStatus.style.display = 'flex';
            }
        });

        DOMElements.editApiKeyBtn.addEventListener('click', () => {
            DOMElements.apiKeyInput.style.display = 'inline-block';
            DOMElements.apiKeyStatus.style.display = 'none';
            DOMElements.apiKeyInput.focus();
        });

        // 自動完成功能
        DOMElements.symbolInput.addEventListener('input', debounce(async () => {
            const query = DOMElements.symbolInput.value.trim();
            if (query.length > 1 && apiHandler.API_KEY) {
                try {
                    const data = await apiHandler.fetchAutocomplete(query);
                    if (data && data.status === 'ok' && data.data && data.data.length > 0) {
                        DOMElements.autocompleteResults.innerHTML = '';
                        data.data.forEach(item => {
                            const div = document.createElement('div');
                            div.textContent = `${item.symbol} - ${item.instrument_name}`;
                            div.addEventListener('click', () => {
                                DOMElements.symbolInput.value = item.symbol;
                                DOMElements.autocompleteResults.style.display = 'none';
                            });
                            DOMElements.autocompleteResults.appendChild(div);
                        });
                        DOMElements.autocompleteResults.style.display = 'block';
                    } else {
                        DOMElements.autocompleteResults.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Autocomplete API 呼叫失敗:', error);
                }
            } else {
                DOMElements.autocompleteResults.style.display = 'none';
            }
        }, 300));
        
        // 點擊頁面其他地方隱藏自動完成
        document.addEventListener('click', (e) => {
            if (!DOMElements.autocompleteResults.contains(e.target) && e.target !== DOMElements.symbolInput) {
                DOMElements.autocompleteResults.style.display = 'none';
            }
        });
        
        // 調整視窗大小
        window.addEventListener('resize', chartHandler.resizeChart);

        // 鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            if (e.key === '+') {
                DOMElements.zoomInBtn.click();
            } else if (e.key === '-') {
                DOMElements.zoomOutBtn.click();
            } else if (e.key.toLowerCase() === 'r') {
                DOMElements.resetZoomBtn.click();
            }
        });
    };

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // --- 頁面啟動 ---
    const savedApiKey = localStorage.getItem('twelveDataApiKey');
    if (savedApiKey) {
        apiHandler.API_KEY = savedApiKey;
        DOMElements.apiKeyInput.value = savedApiKey;
        DOMElements.apiKeyInput.style.display = 'none';
        DOMElements.apiKeyStatus.style.display = 'flex';
    } else {
        DOMElements.apiKeyStatus.style.display = 'none';
    }

    const savedSymbol = localStorage.getItem('lastSymbol');
    if (savedSymbol) {
        DOMElements.symbolInput.value = savedSymbol;
    }
    
    const savedTheme = localStorage.getItem('chartTheme');
    if (savedTheme) {
        currentTheme = savedTheme;
        DOMElements.themeSelect.value = savedTheme;
        uiHandler.applyTheme(currentTheme);
    } else {
        uiHandler.applyTheme(currentTheme); // 首次載入時設定預設主題
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
    }
    
    // 初始化圖表與事件
    chartHandler.initialize();
    setupEventListeners();

    // 如果有儲存的 API 金鑰和股票代號，則自動載入數據
    if (savedApiKey && savedSymbol) {
        // 設定預設日期範圍為今年
        const today = new Date();
        DOMElements.endDateInput.value = helpers.formatDate(today);
        const startOfThisYear = new Date(today.getFullYear(), 0, 1);
        DOMElements.startDateInput.value = helpers.formatDate(startOfThisYear);

        loadAllData(savedSymbol, currentInterval, DOMElements.startDateInput.value, DOMElements.endDateInput.value);
    }
});