class StockPortfolio {
  constructor() {
    this.polygonApiKey = 'mXo1jhN7i4POCiteYUj1zTtHUn_pwWmw';
    this.finnhubApiKey = 'cuk6o19r01qgs4829bn0cuk6o19r01qgs4829bng';
    this.stocks = [];
    try {
      const savedStocks = localStorage.getItem('stocks');
      if (savedStocks) {
        this.stocks = JSON.parse(savedStocks);
      }
    } catch (e) {
      console.error('Error loading stocks:', e);
    }
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
    setInterval(() => this.refreshStockPrices(), 60000); 
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
    
    if (!symbol) {
      this.showError('Please enter a stock symbol');
      return;
    }

    try {
      stocksList.classList.add('loading');
      addButton.disabled = true;
      addButton.textContent = 'Loading...';

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
      this.renderStocks(); 
    }
  }

  showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.search-bar').appendChild(errorDiv);
    
    errorDiv.addEventListener('click', () => errorDiv.remove());
    setTimeout(() => errorDiv.remove(), 4000);
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

      await new Promise(resolve => setTimeout(resolve, 2000));

      const cachedNews = sessionStorage.getItem(`news_${symbol}`);
      if (cachedNews) {
        const { data, timestamp } = JSON.parse(cachedNews);
        // Use cached data if less than 5 minutes old
        if (Date.now() - timestamp < 300000) {
          this.renderNews(data);
          return;
        }
      }

      const response = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=3&apiKey=${this.polygonApiKey}`
      );

      if (response.status === 429) {
        newsContainer.innerHTML = '<p class="no-news">API rate limit reached. Please wait a few minutes before trying again.</p>';
        return;
      }

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
      sessionStorage.setItem(`news_${symbol}`, JSON.stringify({
        data: data.results,
        timestamp: Date.now()
      }));

      this.renderNews(data.results);
    } catch (error) {
      console.error('Error fetching news:', error.message || error);
      document.getElementById('newsContainer').innerHTML = 
        '<p class="no-news">Unable to load news at this time</p>';
    }
  }

  analyzeSentiment(text) {
    const positiveWords = ['up', 'rise', 'gain', 'profit', 'success', 'growth', 'positive', 'high', 'bull'];
    const negativeWords = ['down', 'fall', 'loss', 'decline', 'negative', 'low', 'bear', 'crash', 'fail'];
    
    text = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) score++;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) score--;
    });
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  renderNews(news) {
    const newsContainer = document.getElementById('newsContainer');
    if (!Array.isArray(news) || news.length === 0) {
      newsContainer.innerHTML = '<p class="no-news">No recent news available</p>';
      return;
    }

    const categories = ['all', 'positive', 'negative', 'neutral'];
    const filterHtml = `
      <div class="news-filter">
        ${categories.map(category => `
          <button class="filter-btn" data-category="${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</button>
        `).join('')}
      </div>
    `;

    const newsHtml = news.map(item => {
      const sentiment = this.analyzeSentiment(item.title + ' ' + (item.description || ''));
      return `
        <div class="news-item" data-sentiment="${sentiment}">
          <div class="news-header">
            <h4>${item.title || 'No Title'}</h4>
            <span class="sentiment-badge ${sentiment}">${sentiment}</span>
          </div>
          <p>${item.description || 'No description available'}</p>
          ${item.article_url ? 
            `<a href="${item.article_url}" target="_blank" rel="noopener noreferrer">Read more</a>` : 
            ''}
        </div>
      `;
    }).join('');

    newsContainer.innerHTML = filterHtml + newsHtml;
    const filterButtons = newsContainer.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        const newsItems = newsContainer.querySelectorAll('.news-item');
        
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        newsItems.forEach(item => {
          if (category === 'all' || item.dataset.sentiment === category) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
    newsContainer.querySelector('[data-category="all"]').classList.add('active');
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
    const totalValue = this.stocks.reduce((sum, stock) => sum + parseFloat(stock.value || 0), 0);
    const totalDailyGain = this.stocks.reduce((sum, stock) => sum + parseFloat(stock.dailyGain || 0), 0);
    const dailyPercentage = totalValue > 0 ? (totalDailyGain / totalValue * 100).toFixed(2) : '0.00';

    return {
      totalValue: totalValue.toFixed(2),
      totalDailyGain: totalDailyGain.toFixed(2),
      dailyPercentage
    };
  }
  renderStocks() {
    const stocksList = document.getElementById('stocksList');
    const stats = this.calculatePortfolioStats();
    const totalValue = stats.totalValue || '0.00';
    const totalDailyGain = stats.totalDailyGain || '0.00';
    const dailyPercentage = stats.dailyPercentage || '0.00';

    stocksList.innerHTML = `
      <div class="portfolio-stats">
        <div class="stat-item">
          <div class="stat-label">Total Value</div>
          <div class="stat-value">$${totalValue}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Daily Gain/Loss</div>
          <div class="stat-value ${parseFloat(totalDailyGain) >= 0 ? 'positive' : 'negative'}">
            $${totalDailyGain} (${dailyPercentage}%)
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
    try {
      const symbols = this.stocks.map(stock => stock.symbol).join(',');
      const response = await fetch(`https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/prev?symbols=${symbols}&apiKey=${this.polygonApiKey}`);
      const data = await response.json();

      if (data.results) {
        const stocksMap = new Map(data.results.map(result => [result.T, result]));
        
        this.stocks = this.stocks.map(stock => {
          const info = stocksMap.get(stock.symbol);
          if (!info) return stock;

          const price = parseFloat(info.c.toFixed(2));
          const change = parseFloat(((info.c - info.o) / info.o * 100).toFixed(2));
          
          return {
            ...stock,
            price,
            change,
            value: parseFloat((price * stock.quantity).toFixed(2)),
            dailyGain: parseFloat((change * stock.quantity / 100).toFixed(2))
          };
        });

        localStorage.setItem('stocks', JSON.stringify(this.stocks));
        this.renderStocks();
      }
    } catch (error) {
      console.error('Error refreshing stock prices:', error);
    }
  }

  async handleSearch(query) {
    const searchInput = document.getElementById('stockSearch');
    let suggestionsContainer = document.querySelector('.search-suggestions');
    
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'search-suggestions';
      searchInput.parentNode.appendChild(suggestionsContainer);
    }
    
    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      return;
    }
    
    try {
      const response = await fetch(`https://api.polygon.io/v3/reference/tickers?search=${query}&active=true&limit=5&apiKey=${this.polygonApiKey}`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.innerHTML = data.results.map(stock => `
          <div class="suggestion-item" data-symbol="${stock.ticker}">
            <div class="company-info">
              <strong>${stock.ticker}</strong>
              <span class="company-name">${stock.name}</span>
            </div>
            <span>${stock.market}</span>
          </div>
        `).join('');
        
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach(item => {
          item.addEventListener('click', () => {
            searchInput.value = item.dataset.symbol;
            suggestionsContainer.style.display = 'none';
          });
        });
      } else {
        suggestionsContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      suggestionsContainer.style.display = 'none';
    }
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
        suggestionsContainer.style.display = 'none';
      }
    });
  }
}

let portfolio;
document.addEventListener('DOMContentLoaded', () => {
  portfolio = new StockPortfolio();
  window.portfolio = portfolio;
});
