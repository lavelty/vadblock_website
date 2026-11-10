(function () {
  // Fail loudly if Paddle environment or client-side token is not set
  const config = window.PADDLE_ENV_CONFIG;
  if (!config || !config.environment || !config.clientToken) {
    const errorMsg = 'Paddle Configuration Error: environment and clientToken are required. Never run against undefined environment!';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const TIERS = window.PADDLE_TIERS || [];
  let currentCycle = 'month'; // 'month' | 'year'
  const cachedPrices = {}; // priceId -> formattedTotal from Paddle
  let paddleReady = false;

  function initPaddle() {
    if (typeof Paddle === 'undefined') return;

    // Only set sandbox if explicitly in sandbox mode; production is Paddle.js default
    if (config.environment === 'sandbox') {
      Paddle.Environment.set('sandbox');
    }

    const initOptions = {
      token: config.clientToken,
      eventCallback: function (data) {
        if (data.name === 'checkout.completed') {
          const successUrl = new URL('welcome.html', window.location.href).href;
          window.location.href = successUrl;
        }
      }
    };

    // Paddle Retain: pass signed-in customer's Paddle customer ID (prefixed with ctm_)
    try {
      const stored = localStorage.getItem('vadblock_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        const ctmId = parsed.paddleCustomerId || parsed.customerId;
        if (ctmId && typeof ctmId === 'string' && ctmId.startsWith('ctm_')) {
          initOptions.pwCustomer = { id: ctmId };
        }
      }
    } catch (e) {}

    Paddle.Initialize(initOptions);
    paddleReady = true;
    fetchPricePreviews();
  }

  // Detect country code from meta tag or header if rendered server-side
  // If unknown sentinel ('OTHERS') or absent, do NOT pass countryCode so Paddle auto-detects from IP
  function getDetectedCountry() {
    const metaTag = document.querySelector('meta[name="user-country"]');
    const country = metaTag ? metaTag.getAttribute('content')?.trim().toUpperCase() : null;
    if (country && country !== 'OTHERS' && country.length === 2) {
      return country;
    }
    return null;
  }

  function fetchPricePreviews() {
    if (!paddleReady || typeof Paddle === 'undefined' || !TIERS.length) return;

    const items = TIERS.flatMap(tier => [
      { priceId: tier.priceId.month, quantity: 1 },
      { priceId: tier.priceId.year, quantity: 1 }
    ]);

    const params = { items };
    const countryCode = getDetectedCountry();
    if (countryCode) {
      params.address = { countryCode };
    }

    Paddle.PricePreview(params)
      .then(response => {
        const lineItems = response?.data?.details?.lineItems || [];
        lineItems.forEach(item => {
          if (item?.price?.id && item?.formattedTotals?.total) {
            // Display only Paddle formattedTotals.total directly — no frontend math or rounding
            cachedPrices[item.price.id] = item.formattedTotals.total;
          }
        });
        renderPrices();
      })
      .catch(err => {
        console.error('Paddle PricePreview failed:', err);
      });
  }

  function renderPrices() {
    TIERS.forEach(tier => {
      const priceElement = document.querySelector(`[data-tier-price="${tier.name}"]`);
      const intervalElement = document.querySelector(`[data-tier-interval="${tier.name}"]`);
      if (!priceElement) return;

      const activePriceId = tier.priceId[currentCycle];
      const formattedTotal = cachedPrices[activePriceId];

      if (formattedTotal) {
        priceElement.textContent = formattedTotal;
      }
      if (intervalElement) {
        intervalElement.textContent = currentCycle === 'month' ? '/ ay' : '/ yıl';
      }
    });
  }

  function openCheckout(tierName) {
    if (!paddleReady || typeof Paddle === 'undefined') {
      alert('Ödeme sistemi yükleniyor, lütfen birkaç saniye sonra tekrar deneyin.');
      return;
    }

    const tier = TIERS.find(t => t.name === tierName);
    if (!tier) return;

    const selectedPriceId = tier.priceId[currentCycle];
    const successUrl = new URL('welcome.html', window.location.href).href;

    // Prefill customer email if signed in
    let customerEmail = undefined;
    try {
      const stored = localStorage.getItem('vadblock_user') || localStorage.getItem('user_email');
      if (stored) {
        const parsed = JSON.parse(stored);
        customerEmail = parsed.email || (stored.includes('@') ? stored : undefined);
      }
    } catch (e) {
      const stored = localStorage.getItem('user_email');
      if (stored && stored.includes('@')) customerEmail = stored;
    }

    const checkoutOptions = {
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: successUrl
      },
      items: [
        {
          priceId: selectedPriceId,
          quantity: 1
        }
      ]
    };

    if (customerEmail) {
      checkoutOptions.customer = { email: customerEmail };
    }

    Paddle.Checkout.open(checkoutOptions);
  }

  // Set up DOM interactions
  function initDOM() {
    // Billing cycle toggle listeners
    const monthlyBtn = document.getElementById('pricing-billing-monthly');
    const yearlyBtn = document.getElementById('pricing-billing-yearly');

    if (monthlyBtn && yearlyBtn) {
      monthlyBtn.addEventListener('click', () => {
        if (currentCycle === 'month') return;
        currentCycle = 'month';
        monthlyBtn.classList.add('active');
        yearlyBtn.classList.remove('active');
        renderPrices();
      });

      yearlyBtn.addEventListener('click', () => {
        if (currentCycle === 'year') return;
        currentCycle = 'year';
        yearlyBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
        renderPrices();
      });
    }

    // Subscribe buttons
    document.querySelectorAll('[data-subscribe-tier]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tierName = btn.getAttribute('data-subscribe-tier');
        openCheckout(tierName);
      });
    });

    // Initial render
    renderPrices();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOM);
  } else {
    initDOM();
  }

  // Initialize Paddle.js
  if (typeof Paddle !== 'undefined') {
    initPaddle();
  } else {
    window.addEventListener('load', () => {
      if (typeof Paddle !== 'undefined') {
        initPaddle();
      } else {
        console.error('Paddle.js failed to load from CDN.');
      }
    });
  }
})();
