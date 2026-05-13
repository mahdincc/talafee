# Talafee - طلافی

<div align="center">

![Talafee Logo](assets/images/logo.svg)

**Gold Price Comparison Platform for Iranian Markets**

پلتفرم مقایسه قیمت طلا و سکه در ایران

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

[فارسی](#فارسی) | [English](#english)

</div>

---

## English

### Overview

Talafee is a comprehensive gold price comparison platform that aggregates real-time prices from 10+ Iranian gold trading platforms. Users can compare prices, set alerts, manage wallets, and connect their accounts from multiple platforms.

### Features

- **Real-time Price Comparison** - Compare gold prices across 10+ platforms
- **Price Alerts** - Get notified when prices hit your targets
- **Fast Buy** - One-click purchase from the lowest price provider
- **Target Price Orders** - Auto-buy when price reaches your target
- **Universal Payment** - Use your wallet on any e-commerce site
- **Connected Accounts** - Aggregate balances from multiple platforms
- **Wallet Management** - Deposit, withdraw, buy/sell gold
- **Admin Dashboard** - Manage users, prices, and system settings
- **Bilingual Support** - Full Persian (RTL) and English support
- **Dark Mode** - Eye-friendly dark theme

### Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Design System), Vanilla JavaScript
- **Icons**: Lucide Icons
- **Styling**: CSS Custom Properties (Design Tokens)
- **Build**: Static site (no build required)

### Project Structure

```
talafee/
├── index.html              # Main price comparison page
├── login.html              # Authentication page
├── user-panel.html         # User dashboard
├── admin-panel.html        # Admin dashboard
├── package.json            # Project configuration
├── assets/
│   ├── css/
│   │   ├── design-tokens.css
│   │   ├── components/     # Reusable component styles
│   │   └── pages/          # Page-specific styles
│   ├── js/
│   │   ├── utils/          # Helper functions
│   │   ├── components/     # Reusable components
│   │   └── pages/          # Page-specific scripts
│   ├── images/
│   │   └── providers/      # Provider logos
│   └── fonts/
├── config/
│   ├── app.json            # App configuration
│   ├── providers.json      # Provider configurations
│   └── tailwind.preset.js  # Tailwind preset (if used)
├── docs/
│   ├── AFFILIATE-SYSTEM.md # Affiliate system documentation
│   ├── UI-DESIGN-SPEC.md   # UI design specifications
│   └── talafee-theme.md    # Theme documentation
├── api/                    # API mock files
└── crawlers/               # Price crawler scripts
```

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/talafee/talafee-web.git
   cd talafee-web
   ```

2. **Install dependencies** (optional, for dev server)
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Or simply open `index.html` in your browser.

### Pages

| Page | Description |
|------|-------------|
| `index.html` | Main price comparison dashboard with Fast Buy feature |
| `login.html` | User authentication (login/register) |
| `user-panel.html` | User dashboard with wallet, alerts, connected accounts |
| `admin-panel.html` | Admin dashboard for platform management |

### Configuration

Edit `config/app.json` to customize:
- App settings
- Feature flags
- Language preferences
- Security settings

Edit `config/providers.json` to:
- Add/remove gold providers
- Configure affiliate parameters
- Set provider features

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## فارسی

### معرفی

طلافی یک پلتفرم جامع مقایسه قیمت طلا است که قیمت‌های لحظه‌ای را از بیش از ۱۰ پلتفرم معاملاتی طلا در ایران جمع‌آوری می‌کند. کاربران می‌توانند قیمت‌ها را مقایسه کنند، هشدار قیمت تنظیم کنند، کیف پول خود را مدیریت کنند و حساب‌های خود را از پلتفرم‌های مختلف متصل کنند.

### امکانات

- **مقایسه قیمت لحظه‌ای** - مقایسه قیمت طلا در بیش از ۱۰ پلتفرم
- **هشدار قیمت** - اطلاع‌رسانی هنگام رسیدن قیمت به هدف شما
- **خرید سریع** - خرید یک‌کلیکی از ارزان‌ترین پلتفرم
- **سفارش با قیمت هدف** - خرید خودکار هنگام رسیدن به قیمت هدف
- **پرداخت جهانی** - استفاده از کیف پول در هر فروشگاه اینترنتی
- **حساب‌های متصل** - جمع‌آوری موجودی از چندین پلتفرم
- **مدیریت کیف پول** - واریز، برداشت، خرید/فروش طلا
- **داشبورد مدیریت** - مدیریت کاربران، قیمت‌ها و تنظیمات
- **دوزبانه** - پشتیبانی کامل از فارسی (RTL) و انگلیسی
- **حالت تاریک** - تم تاریک برای راحتی چشم

### شروع کار

۱. **کلون کردن مخزن**
   ```bash
   git clone https://github.com/talafee/talafee-web.git
   cd talafee-web
   ```

۲. **نصب وابستگی‌ها** (اختیاری، برای سرور توسعه)
   ```bash
   npm install
   ```

۳. **اجرای سرور توسعه**
   ```bash
   npm run dev
   ```
   یا به سادگی فایل `index.html` را در مرورگر باز کنید.

### پلتفرم‌های پشتیبانی شده

| پلتفرم | وضعیت |
|--------|--------|
| طلاین (Taline) | ✅ فعال |
| تکنوگلد (Technogold) | ✅ فعال |
| زرگلد (ZarGold) | ✅ فعال |
| گلدایران (GoldIran) | ✅ فعال |
| طلامارکت (TalaMarket) | ✅ فعال |
| طلابازار (TalaBazar) | ✅ فعال |
| زراکسچنج (ZarExchange) | ✅ فعال |
| سکه آنلاین (SekkeOnline) | ✅ فعال |
| گلدپلاس (GoldPlus) | ✅ فعال |
| انس گلد (OnsGold) | ✅ فعال |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Website: [talafee.ir](https://talafee.ir)
- Email: support@talafee.ir

---

<div align="center">
  <sub>Built with ❤️ for the Iranian gold trading community</sub>
</div>
