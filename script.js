class StockPortfolio {
  constructor() {
    this.polygonApiKey = 'mXo1jhN7i4POCiteYUj1zTtHUn_pwWmw'; // Polygon API key
    this.finnhubApiKey = 'cuk6o19r01qgs4829bn0cuk6o19r01qgs4829bng';
    this.stocks = JSON.parse(localStorage.getItem('stocks') || '[]');
    this.chart = null;
    this.init();
    this.initChart();
    this.setupAutoRefresh();
    this.fetchTopStocks();
  }

  async fetchTopStocks() {
    try {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'TSLA', 'UNH', 'JPM'];
      const stockPromises = symbols.map(async symbol => {
        try {
          const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.finnhubApiKey}`);
          const data = await response.json();
          return { symbol, ...data };
        } catch (err) {
          console.error(`Error fetching ${symbol}:`, err);
          return null;
        }
      });

      const stocks = (await Promise.all(stockPromises)).filter(stock => stock !== null);
      if (stocks.length > 0) {
        this.renderTopStocks(stocks);
      } else {
        document.getElementById('topStocksList').innerHTML = '<div class="top-stock-item">No data available</div>';
      }
    } catch (error) {
      console.error('Error fetching top stocks:', error);
      document.getElementById('topStocksList').innerHTML = '<div class="top-stock-item">Failed to load top stocks</div>';
    }
  }

  renderTopStocks(topStocks) {
    const container = document.getElementById('topStocksList');
    container.innerHTML = topStocks.map(stock => `
      <div class="top-stock-item">
        <div>
          <span>${stock.symbol}</span>
          <span class="stock-price">$${stock.c.toFixed(2)}</span>
        </div>
        <span class="${stock.dp >= 0 ? 'positive' : 'negative'}">
          ${stock.dp.toFixed(2)}%
        </span>
      </div>
    `).join('');
  }

  setupAutoRefresh() {
    setInterval(() => this.refreshStockPrices(), 60000); // Refresh every minute
  }

  saveStocks() {
    localStorage.setItem('stocks', JSON.stringify(this.stocks));
  }

  initChart() {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Portfolio Value',
          data: [],
          borderColor: '#2962ff',
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#ffffff'
            }
          }
        },
        scales: {
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#ffffff'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#ffffff'
            }
          }
        }
      }
    });
  }

  init() {
    const addButton = document.getElementById('addStock');
    const searchInput = document.getElementById('stockSearch');
    const stockDetails = document.getElementById('stockDetails');
    const closeDetailsButton = stockDetails.querySelector('.close-button');

    addButton.addEventListener('click', () => this.addStock());
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addStock();
    });
    searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

    closeDetailsButton.addEventListener('click', () => this.hideStockDetails());
    this.renderStocks();
  }

  async addStock() {
    const searchInput = document.getElementById('stockSearch');
    const addButton = document.getElementById('addStock');
    const symbol = searchInput.value.toUpperCase().trim();
    const stocksList = document.getElementById('stocksList');
    this.checkAlerts();

    if (!symbol) {
      this.showError('Please enter a stock symbol');
      return;
    }

    stocksList.classList.add('loading');
    addButton.disabled = true;
    addButton.textContent = 'Loading...';

    try {
      const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${this.polygonApiKey}`);
      const data = await response.json();

      if (data.resultsCount > 0) {
        const stockInfo = data.results[0];
        const quantity = parseInt(document.getElementById('stockQuantity').value) || 1;
        const stock = {
          symbol,
          price: stockInfo.c,
          change: ((stockInfo.c - stockInfo.o) / stockInfo.o * 100).toFixed(2),
          volume: stockInfo.v,
          open: stockInfo.o,
          high: stockInfo.h,
          low: stockInfo.l,
          quantity: quantity,
          value: (stockInfo.c * quantity).toFixed(2),
          dailyGain: ((stockInfo.c - stockInfo.o) * quantity).toFixed(2)
        };

        this.stocks.push(stock);
        this.saveStocks();
        this.renderStocks();
        searchInput.value = '';
      } else {
        alert('Stock not found');
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
      this.showError('Failed to fetch stock data. Please try again.');
    } finally {
      addButton.disabled = false;
      addButton.textContent = 'Add';
      stocksList.classList.remove('loading');
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.search-bar').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }

  async fetchStockHistory(symbol) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?apiKey=${this.polygonApiKey}`
    );
    const data = await response.json();
    return data.results || [];
  }

  async updateChart(symbol) {
    const historicalData = await this.fetchStockHistory(symbol);
    const dates = historicalData.map(item => new Date(item.t).toLocaleDateString());
    const prices = historicalData.map(item => item.c);

    this.chart.data.labels = dates;
    this.chart.data.datasets[0].label = `${symbol} Price Trend`;
    this.chart.data.datasets[0].data = prices;
    this.chart.update();

    this.fetchStockNews(symbol);
  }

  async fetchStockNews(symbol) {
    try {
      const newsContainer = document.getElementById('newsContainer');
      newsContainer.innerHTML = '<p class="no-news">Loading news...</p>';

      const response = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=3&apiKey=${this.polygonApiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data) {
        throw new Error('No data received from API');
      }

      if (!data.results || !Array.isArray(data.results)) {
        newsContainer.innerHTML = '<p class="no-news">No news available for this stock</p>';
        return;
      }

      this.renderNews(data.results);
    } catch (error) {
      console.error('Error fetching news:', error.message || error);
      document.getElementById('newsContainer').innerHTML = 
        '<p class="no-news">Unable to load news at this time</p>';
    }
  }

  renderNews(news) {
    const newsContainer = document.getElementById('newsContainer');
    if (!Array.isArray(news) || news.length === 0) {
      newsContainer.innerHTML = '<p class="no-news">No recent news available</p>';
      return;
    }

    newsContainer.innerHTML = news.map(item => `
      <div class="news-item">
        <h4>${item.title || 'No Title'}</h4>
        <p>${item.description || 'No description available'}</p>
        ${item.article_url ? 
          `<a href="${item.article_url}" target="_blank" rel="noopener noreferrer">Read more</a>` : 
          ''}
      </div>
    `).join('');
  }

  showStockDetails(stock) {
    const detailsPanel = document.getElementById('stockDetails');
    const content = detailsPanel.querySelector('.details-content');

    content.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">Symbol</div>
        <div class="detail-value">${stock.symbol}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Current Price</div>
        <div class="detail-value">$${stock.price}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Change</div>
        <div class="detail-value ${stock.change >= 0 ? 'positive' : 'negative'}">${stock.change}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Volume</div>
        <div class="detail-value">${stock.volume.toLocaleString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Open</div>
        <div class="detail-value">$${stock.open}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">High</div>
        <div class="detail-value">$${stock.high}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Low</div>
        <div class="detail-value">$${stock.low}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Market Cap</div>
        <div class="detail-value">$${(stock.price * stock.volume).toLocaleString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Your Position</div>
        <div class="detail-value">$${stock.value} (${stock.quantity} shares)</div>
      </div>
      <div class="alert-section">
        <h4>Price Alerts</h4>
        <div class="alert-inputs">
          <input type="number" id="alertPrice" placeholder="Target Price" step="0.01">
          <select id="alertCondition">
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <button onclick="portfolio.setAlert('${stock.symbol}')">Set Alert</button>
        </div>
        <div id="activeAlerts-${stock.symbol}" class="active-alerts">
          ${this.renderActiveAlerts(stock.symbol)}
        </div>
      </div>
    `;

    detailsPanel.classList.remove('hidden');
  }

  setAlert(symbol) {
    const price = parseFloat(document.getElementById('alertPrice').value);
    const condition = document.getElementById('alertCondition').value;

    if (!price || isNaN(price)) {
      alert('Please enter a valid price');
      return;
    }

    const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}');
    if (!alerts[symbol]) alerts[symbol] = [];

    alerts[symbol].push({ price, condition });
    localStorage.setItem('priceAlerts', JSON.stringify(alerts));

    this.showStockDetails(this.stocks.find(s => s.symbol === symbol));
    this.checkAlerts();
  }

  renderActiveAlerts(symbol) {
    const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}')[symbol] || [];
    return alerts.map((alert, index) => `
      <div class="alert-item">
        ${alert.condition === 'above' ? '↑' : '↓'} $${alert.price}
        <button onclick="portfolio.removeAlert('${symbol}', ${index})">×</button>
      </div>
    `).join('');
  }

  removeAlert(symbol, index) {
    const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}');
    alerts[symbol].splice(index, 1);
    if (alerts[symbol].length === 0) delete alerts[symbol];
    localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    this.showStockDetails(this.stocks.find(s => s.symbol === symbol));
  }

  checkAlerts() {
    const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}');
    this.stocks.forEach(stock => {
      const stockAlerts = alerts[stock.symbol] || [];
      stockAlerts.forEach((alert, index) => {
        const triggered = alert.condition === 'above' 
          ? stock.price >= alert.price 
          : stock.price <= alert.price;

        if (triggered) {
          this.showNotification(stock.symbol, alert);
          this.removeAlert(stock.symbol, index);
        }
      });
    });
  }

  showNotification(symbol, alert) {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(`Price Alert: ${symbol}`, {
            body: `Price is now ${alert.condition} $${alert.price}`,
            icon: '/favicon.ico'
          });
        }
      });
    }
  }

  hideStockDetails() {
    document.getElementById('stockDetails').classList.add('hidden');
  }

  calculatePortfolioStats() {
    const totalValue = this.stocks.reduce((sum, stock) => sum + parseFloat(stock.value), 0).toFixed(2);
    const totalDailyGain = this.stocks.reduce((sum, stock) => sum + parseFloat(stock.dailyGain), 0).toFixed(2);
    const dailyPercentage = ((totalDailyGain / totalValue) * 100).toFixed(2);

    return { totalValue, totalDailyGain, dailyPercentage };
  }

  renderStocks() {
    const stocksList = document.getElementById('stocksList');
    const stats = this.calculatePortfolioStats();

    stocksList.innerHTML = `
      <div class="portfolio-stats">
        <div class="stat-item">
          <div class="stat-label">Total Value</div>
          <div class="stat-value">$${stats.totalValue}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Daily Gain/Loss</div>
          <div class="stat-value ${parseFloat(stats.totalDailyGain) >= 0 ? 'positive' : 'negative'}">
            $${stats.totalDailyGain} (${stats.dailyPercentage}%)
          </div>
        </div>
      </div>
      ${this.stocks.map(stock => `
      <div class="stock-item" onclick="portfolio.updateChart('${stock.symbol}')">
        <div>
          <strong>${stock.symbol}</strong>
          <small>(${stock.quantity} shares)</small>
        </div>
        <div>
          <div>$${stock.price} × ${stock.quantity} = $${stock.value}</div>
          <div class="${stock.change >= 0 ? 'positive' : 'negative'}">
            ${stock.change}% ($${stock.dailyGain})
          </div>
        </div>
        <button class="delete-button" onclick="portfolio.deleteStock('${stock.symbol}')">Delete</button>
      </div>
    `).join('')}`;
  }

  deleteStock(symbol) {
    this.stocks = this.stocks.filter(stock => stock.symbol !== symbol);
    this.saveStocks();
    this.renderStocks();
  }

  async refreshStockPrices() {
    for (let stock of this.stocks) {
      try {
        const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/${stock.symbol}/prev?apiKey=${this.polygonApiKey}`);
        const data = await response.json();
        if (data.resultsCount > 0) {
          const stockInfo = data.results[0];
          stock.price = stockInfo.c;
          stock.change = ((stockInfo.c - stockInfo.o) / stockInfo.o * 100).toFixed(2);
          stock.value = (stockInfo.c * stock.quantity).toFixed(2);
          stock.dailyGain = ((stockInfo.c - stockInfo.o) * stock.quantity).toFixed(2);
        }
      } catch (error) {
        console.error(`Error refreshing ${stock.symbol}:`, error);
      }
    }
    this.saveStocks();
    this.renderStocks();
  }

  async handleSearch(query) {
    const searchInput = document.getElementById('stockSearch');

    if (query.length < 2) {
      this.clearSuggestions();
      return;
    }

    try {
      const response = await fetch(`https://api.polygon.io/v3/reference/tickers?search=${query}&active=true&limit=5&apiKey=${this.polygonApiKey}`);
      const data = await response.json();
      this.showSuggestions(data.results || []);

      // Add blur event listener to handle clicking outside
      searchInput.addEventListener('blur', () => {
        // Small delay to allow click on suggestion to register
        setTimeout(() => this.clearSuggestions(), 200);
      });
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.clearSuggestions();
    }
  }

  showSuggestions(suggestions) {
    let suggestionsDiv = document.getElementById('suggestions');
    if (!suggestionsDiv) {
      suggestionsDiv = document.createElement('div');
      suggestionsDiv.id = 'suggestions';
      document.getElementById('stockSearch').parentNode.appendChild(suggestionsDiv);
    }

    if (suggestions.length === 0) {
      this.clearSuggestions();
      return;
    }

    suggestionsDiv.innerHTML = suggestions.map(stock => `
      <div class="suggestion-item" onclick="portfolio.selectSuggestion('${stock.ticker}')">
        <strong>${stock.ticker}</strong> - ${stock.name}
      </div>
    `).join('');
  }

  clearSuggestions() {
    const suggestionsDiv = document.getElementById('suggestions');
    if (suggestionsDiv) {
      suggestionsDiv.innerHTML = '';
    }
  }

  selectSuggestion(symbol) {
    document.getElementById('stockSearch').value = symbol;
    this.clearSuggestions();
    this.addStock();
  }
}

// Initialize portfolio
let portfolio;
document.addEventListener('DOMContentLoaded', () => {
  portfolio = new StockPortfolio();
  window.portfolio = portfolio;
});