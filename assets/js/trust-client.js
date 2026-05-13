/**
 * Trust System API Client
 * Handles all API calls for provider trust scores and reviews
 */

class TrustClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a simple browser fingerprint for rate limiting
   */
  async getFingerprint() {
    if (this._fingerprint) return this._fingerprint;

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.platform
    ];

    const str = components.join('|');
    const hash = await this._hashString(str);
    this._fingerprint = hash;
    return hash;
  }

  /**
   * Hash a string using SHA-256
   */
  async _hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Make API request with error handling
   */
  async _request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`Trust API error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Get all trust scores
   */
  async getScores() {
    return this._request('/trust/scores');
  }

  /**
   * Get trust score for a specific provider
   */
  async getProviderScore(providerId) {
    return this._request(`/trust/scores/${providerId}`);
  }

  /**
   * Get provider ranking (sorted by trust score)
   */
  async getRanking() {
    return this._request('/trust/ranking');
  }

  /**
   * Get badges for a provider
   */
  async getBadges(providerId) {
    return this._request(`/trust/badges/${providerId}`);
  }

  /**
   * Get active warnings
   */
  async getWarnings() {
    return this._request('/trust/warnings');
  }

  /**
   * Get price accuracy data for a provider
   */
  async getAccuracy(providerId) {
    return this._request(`/trust/accuracy/${providerId}`);
  }

  /**
   * Get reviews for a provider
   */
  async getProviderReviews(providerId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', filters.page);
    if (filters.limit) params.set('limit', filters.limit);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.rating) params.set('rating', filters.rating);

    const queryString = params.toString();
    const endpoint = `/trust/reviews/${providerId}${queryString ? '?' + queryString : ''}`;
    return this._request(endpoint);
  }

  /**
   * Submit a new review
   */
  async submitReview(submission) {
    const fingerprint = await this.getFingerprint();

    return this._request('/trust/reviews', {
      method: 'POST',
      body: JSON.stringify({
        ...submission,
        userFingerprint: fingerprint
      })
    });
  }

  /**
   * Vote on a review (helpful or report)
   */
  async voteReview(reviewId, voteType) {
    const fingerprint = await this.getFingerprint();

    return this._request(`/trust/reviews/${reviewId}/vote`, {
      method: 'POST',
      body: JSON.stringify({
        fingerprint,
        voteType
      })
    });
  }

  /**
   * Get comparison data for multiple providers
   */
  async getComparison(providerIds) {
    const params = new URLSearchParams();
    params.set('providers', providerIds.join(','));
    return this._request(`/trust/comparison?${params.toString()}`);
  }
}

/**
 * Trust Page Controller
 * Handles UI interactions for the trust page
 */
class TrustPageController {
  constructor() {
    this.client = new TrustClient();
    this.currentProvider = null;
    this.selectedRating = 0;

    // Provider name mapping
    this.providerNames = {
      'tgju': 'TGJU',
      'taline': 'طلاین',
      'technogold': 'تکنوگلد',
      'melligold': 'ملی گلد',
      'digigold': 'دیجی گلد',
      'miligold': 'میلی گلد',
      'talasea': 'طلاسی',
      'persiantek': 'پرشین تک',
      'bankgold': 'بانک گلد',
      'gold24': 'گلد ۲۴',
      'zarino': 'زرینو',
      'goldiran': 'گلد ایران',
      'wallgold': 'وال‌گلد'
    };
  }

  /**
   * Initialize the page
   */
  async init() {
    this.bindEvents();
    await this.loadAll();

    // Auto-refresh every 5 minutes
    setInterval(() => this.loadAll(), 5 * 60 * 1000);
  }

  /**
   * Bind UI event handlers
   */
  bindEvents() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Modal close
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeReviewModal());
    }

    // Click outside modal to close
    const modal = document.getElementById('reviewModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeReviewModal();
      });
    }

    // Star rating
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setRating(parseInt(e.target.dataset.rating)));
    });

    // Review form submit
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', (e) => this.handleReviewSubmit(e));
    }
  }

  /**
   * Load all data
   */
  async loadAll() {
    try {
      await Promise.all([
        this.loadRanking(),
        this.loadWarnings(),
        this.loadSummaryStats()
      ]);
    } catch (error) {
      console.error('Failed to load trust data:', error);
      this.showError('خطا در بارگذاری اطلاعات');
    }
  }

  /**
   * Load and display ranking
   */
  async loadRanking() {
    const container = document.getElementById('rankingTable');
    if (!container) return;

    try {
      const data = await this.client.getRanking();
      const providers = data.providers || [];

      if (providers.length === 0) {
        container.innerHTML = '<p class="no-data">هنوز اطلاعاتی ثبت نشده است</p>';
        return;
      }

      const rows = providers.map((p, index) => {
        const trendIcon = this.getTrendIcon(p.trend);
        const badges = (p.badges || []).map(b => this.getBadgeHtml(b)).join('');

        return `
          <tr class="provider-row" data-provider="${p.providerId}">
            <td class="rank-cell">${index + 1}</td>
            <td class="provider-cell">
              <span class="provider-name">${this.getProviderName(p.providerId)}</span>
              <div class="badges-inline">${badges}</div>
            </td>
            <td class="score-cell">
              <span class="score-value ${this.getScoreClass(p.overallScore)}">${p.overallScore}</span>
              <span class="trend-icon">${trendIcon}</span>
            </td>
            <td class="rating-cell">
              ${this.getStarsHtml(p.reviewScore / 20)}
              <span class="review-count">(${p.reviewCount || 0})</span>
            </td>
            <td class="action-cell">
              <button class="btn-detail" onclick="trustPage.showProviderDetail('${p.providerId}')">جزئیات</button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <table class="ranking-table">
          <thead>
            <tr>
              <th>رتبه</th>
              <th>فروشنده</th>
              <th>امتیاز</th>
              <th>نظرات</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">خطا در بارگذاری رتبه‌بندی</p>';
    }
  }

  /**
   * Load warnings
   */
  async loadWarnings() {
    const container = document.getElementById('warningsContainer');
    if (!container) return;

    try {
      const data = await this.client.getWarnings();
      const warnings = data.warnings || [];

      if (warnings.length === 0) {
        container.innerHTML = '<p class="no-warnings">هیچ هشداری وجود ندارد</p>';
        return;
      }

      const items = warnings.map(w => `
        <div class="warning-item severity-${w.severity}">
          <div class="warning-icon">${this.getSeverityIcon(w.severity)}</div>
          <div class="warning-content">
            <span class="warning-provider">${this.getProviderName(w.providerId)}</span>
            <p class="warning-message">${w.messageFa || w.message}</p>
            <span class="warning-time">${this.formatTime(w.createdAt)}</span>
          </div>
        </div>
      `).join('');

      container.innerHTML = items;
    } catch (error) {
      container.innerHTML = '<p class="error">خطا در بارگذاری هشدارها</p>';
    }
  }

  /**
   * Load summary stats
   */
  async loadSummaryStats() {
    try {
      const data = await this.client.getRanking();
      const providers = data.providers || [];

      if (providers.length === 0) return;

      // Calculate stats
      const avgScore = Math.round(providers.reduce((sum, p) => sum + p.overallScore, 0) / providers.length);
      const topProvider = providers[0];
      const totalReviews = providers.reduce((sum, p) => sum + (p.reviewCount || 0), 0);
      const warningsCount = document.querySelectorAll('.warning-item').length;

      // Update UI
      const avgScoreEl = document.getElementById('avgScore');
      const topProviderEl = document.getElementById('topProvider');
      const totalReviewsEl = document.getElementById('totalReviews');
      const warningsCountEl = document.getElementById('warningsCount');

      if (avgScoreEl) avgScoreEl.textContent = avgScore;
      if (topProviderEl) topProviderEl.textContent = this.getProviderName(topProvider.providerId);
      if (totalReviewsEl) totalReviewsEl.textContent = totalReviews;
      if (warningsCountEl) warningsCountEl.textContent = warningsCount;
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  /**
   * Show provider detail panel
   */
  async showProviderDetail(providerId) {
    this.currentProvider = providerId;
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    panel.classList.add('active');

    try {
      const [scoreData, reviewsData] = await Promise.all([
        this.client.getProviderScore(providerId),
        this.client.getProviderReviews(providerId, { limit: 5 })
      ]);

      const score = scoreData.score || {};
      const reviews = reviewsData.reviews || [];

      panel.innerHTML = `
        <div class="detail-header">
          <h3>${this.getProviderName(providerId)}</h3>
          <button class="close-detail" onclick="trustPage.closeDetail()">×</button>
        </div>

        <div class="detail-score">
          <div class="score-circle ${this.getScoreClass(score.overallScore || 0)}">
            <span class="score-number">${score.overallScore || 0}</span>
          </div>
          <span class="score-label">امتیاز کلی</span>
        </div>

        <div class="score-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-label">دقت قیمت</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${score.priceAccuracyScore || 0}%"></div>
            </div>
            <span class="breakdown-value">${score.priceAccuracyScore || 0}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">آپتایم</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${score.uptimeScore || 0}%"></div>
            </div>
            <span class="breakdown-value">${score.uptimeScore || 0}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">نظرات</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${score.reviewScore || 0}%"></div>
            </div>
            <span class="breakdown-value">${score.reviewScore || 0}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">تازگی</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${score.freshnessScore || 0}%"></div>
            </div>
            <span class="breakdown-value">${score.freshnessScore || 0}</span>
          </div>
        </div>

        <div class="detail-badges">
          ${(score.badges || []).map(b => this.getBadgeHtml(b, true)).join('')}
        </div>

        <div class="detail-reviews">
          <div class="reviews-header">
            <h4>آخرین نظرات</h4>
            <button class="btn-review" onclick="trustPage.openReviewModal('${providerId}')">ثبت نظر</button>
          </div>
          ${reviews.length > 0 ? this.renderReviews(reviews) : '<p class="no-reviews">هنوز نظری ثبت نشده</p>'}
        </div>
      `;
    } catch (error) {
      panel.innerHTML = `
        <div class="detail-header">
          <h3>${this.getProviderName(providerId)}</h3>
          <button class="close-detail" onclick="trustPage.closeDetail()">×</button>
        </div>
        <p class="error">خطا در بارگذاری اطلاعات</p>
      `;
    }
  }

  /**
   * Close detail panel
   */
  closeDetail() {
    const panel = document.getElementById('detailPanel');
    if (panel) panel.classList.remove('active');
    this.currentProvider = null;
  }

  /**
   * Render reviews list
   */
  renderReviews(reviews) {
    return reviews.map(r => `
      <div class="review-item">
        <div class="review-header">
          ${this.getStarsHtml(r.rating)}
          <span class="review-date">${this.formatDate(r.createdAt)}</span>
        </div>
        ${r.title ? `<h5 class="review-title">${this.escapeHtml(r.title)}</h5>` : ''}
        ${r.content ? `<p class="review-content">${this.escapeHtml(r.content)}</p>` : ''}
        <div class="review-actions">
          <button class="btn-helpful" onclick="trustPage.voteReview('${r.id}', 'helpful')">
            مفید (${r.helpfulCount || 0})
          </button>
          <button class="btn-report" onclick="trustPage.voteReview('${r.id}', 'report')">
            گزارش
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Open review modal
   */
  openReviewModal(providerId) {
    this.currentProvider = providerId;
    this.selectedRating = 0;

    const modal = document.getElementById('reviewModal');
    const providerName = document.getElementById('reviewProviderName');
    const form = document.getElementById('reviewForm');

    if (providerName) providerName.textContent = this.getProviderName(providerId);
    if (form) form.reset();

    // Reset star rating UI
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (modal) modal.classList.add('active');
  }

  /**
   * Close review modal
   */
  closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.classList.remove('active');
    this.selectedRating = 0;
  }

  /**
   * Set star rating
   */
  setRating(rating) {
    this.selectedRating = rating;
    document.querySelectorAll('.star-btn').forEach(btn => {
      const btnRating = parseInt(btn.dataset.rating);
      btn.classList.toggle('active', btnRating <= rating);
    });
  }

  /**
   * Handle review form submit
   */
  async handleReviewSubmit(e) {
    e.preventDefault();

    if (!this.currentProvider) {
      this.showError('فروشنده انتخاب نشده');
      return;
    }

    if (this.selectedRating === 0) {
      this.showError('لطفا امتیاز را انتخاب کنید');
      return;
    }

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const submission = {
      providerId: this.currentProvider,
      rating: this.selectedRating,
      title: form.title?.value?.trim() || undefined,
      content: form.content?.value?.trim() || undefined,
      pros: form.pros?.value?.trim() || undefined,
      cons: form.cons?.value?.trim() || undefined
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'در حال ارسال...';

      const result = await this.client.submitReview(submission);

      if (result.success) {
        this.showSuccess('نظر شما با موفقیت ثبت شد');
        this.closeReviewModal();
        // Refresh provider detail if open
        if (this.currentProvider) {
          await this.showProviderDetail(this.currentProvider);
        }
        // Refresh ranking
        await this.loadRanking();
      } else {
        this.showError(result.errorFa || result.error || 'خطا در ثبت نظر');
      }
    } catch (error) {
      this.showError('خطا در ارسال نظر');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ثبت نظر';
    }
  }

  /**
   * Vote on a review
   */
  async voteReview(reviewId, voteType) {
    try {
      const result = await this.client.voteReview(reviewId, voteType);

      if (result.success) {
        this.showSuccess(voteType === 'helpful' ? 'رای شما ثبت شد' : 'گزارش شما ثبت شد');
        // Refresh detail panel
        if (this.currentProvider) {
          await this.showProviderDetail(this.currentProvider);
        }
      } else {
        this.showError(result.error || 'خطا در ثبت رای');
      }
    } catch (error) {
      this.showError('قبلا رای داده‌اید');
    }
  }

  /**
   * Switch tab
   */
  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
  }

  // Helper methods

  getProviderName(providerId) {
    return this.providerNames[providerId] || providerId;
  }

  getScoreClass(score) {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-poor';
  }

  getTrendIcon(trend) {
    switch (trend) {
      case 'improving': return '<span class="trend-up">▲</span>';
      case 'declining': return '<span class="trend-down">▼</span>';
      default: return '<span class="trend-stable">●</span>';
    }
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      default: return 'ℹ️';
    }
  }

  getBadgeHtml(badge, large = false) {
    const icons = {
      'verified': '✓',
      'best_accuracy': '🎯',
      'fast_updates': '⚡',
      'high_rated': '⭐',
      'reliable': '🛡️',
      'best_spread': '💰'
    };

    const labels = {
      'verified': 'تایید شده',
      'best_accuracy': 'دقیق‌ترین',
      'fast_updates': 'سریع‌ترین',
      'high_rated': 'محبوب',
      'reliable': 'قابل اعتماد',
      'best_spread': 'بهترین اسپرد'
    };

    const badgeType = typeof badge === 'string' ? badge : badge.badgeType;
    const icon = icons[badgeType] || '●';
    const label = labels[badgeType] || badgeType;
    const className = large ? 'badge badge-large' : 'badge';

    return `<span class="${className} badge-${badgeType}">${icon} ${label}</span>`;
  }

  getStarsHtml(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    let html = '';
    for (let i = 0; i < fullStars; i++) html += '<span class="star full">★</span>';
    if (halfStar) html += '<span class="star half">★</span>';
    for (let i = 0; i < emptyStars; i++) html += '<span class="star empty">☆</span>';

    return html;
  }

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'همین الان';
    if (diffMins < 60) return `${diffMins} دقیقه پیش`;
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    if (diffDays < 7) return `${diffDays} روز پیش`;

    return this.formatDate(dateStr);
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize on page load
let trustPage;
document.addEventListener('DOMContentLoaded', () => {
  trustPage = new TrustPageController();
  trustPage.init();
});
