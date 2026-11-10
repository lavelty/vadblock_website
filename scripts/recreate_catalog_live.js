require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Paddle, Environment, LogLevel } = require('@paddle/paddle-node-sdk');

const liveApiKey = process.env.PADDLE_LIVE_API_KEY || process.env.PADDLE_API_KEY;

if (!liveApiKey || liveApiKey.startsWith('pdl_sdbx_')) {
  console.error('\n[HATA] Canlı (production) API anahtarı bulunamadı.');
  console.error('Lütfen https://vendors.paddle.com/authentication adresinden bir Canlı API Anahtarı oluşturup .env dosyasına ekleyin:');
  console.error('PADDLE_LIVE_API_KEY=pdl_live_apikey_...\n');
  process.exit(1);
}

const paddle = new Paddle(liveApiKey, {
  environment: Environment.production,
  logLevel: LogLevel.error
});

const sandboxCatalogPath = path.resolve(__dirname, '../paddle_catalog.json');
const sandboxCatalog = JSON.parse(fs.readFileSync(sandboxCatalogPath, 'utf8'));

async function recreateCatalog() {
  console.log('--- vAdBlock Canlı Katalog Oluşturma Başlatılıyor ---');
  const liveCatalogMapping = {
    environment: 'production',
    migrated_at: new Date().toISOString(),
    mapping: {},
    products: {}
  };

  for (const [key, plan] of Object.entries(sandboxCatalog.products)) {
    console.log(`\nOluşturuluyor: ${plan.name} (${key})...`);

    // 1. Create Product in Live
    const product = await paddle.products.create({
      name: plan.name,
      taxCategory: 'saas',
      description: key === 'starter'
        ? 'Ideal for individuals and light browsing.'
        : key === 'pro'
          ? 'For power users wanting full control, SponsorBlock & cloud sync.'
          : 'Full feature set for pro users across unlimited devices.'
    });

    console.log(`  ✓ Canlı Ürün ID: ${product.id}`);

    liveCatalogMapping.products[key] = {
      product_id: product.id,
      name: plan.name,
      prices: {}
    };

    // 2. Create Monthly & Annual Prices
    for (const [interval, pData] of Object.entries(plan.prices)) {
      const overrides = [];
      if (pData.overrides) {
        for (const [country, oData] of Object.entries(pData.overrides)) {
          overrides.push({
            countryCodes: [country],
            unitPrice: {
              amount: oData.amount,
              currencyCode: oData.currency
            }
          });
        }
      }

      const price = await paddle.prices.create({
        productId: product.id,
        description: `${plan.name} ${interval === 'monthly' ? 'Monthly' : 'Annual'} Subscription`,
        name: interval === 'monthly' ? 'Monthly' : 'Annual',
        billingCycle: {
          interval: pData.interval,
          frequency: 1
        },
        trialPeriod: {
          interval: 'day',
          frequency: 7
        },
        taxMode: 'location',
        unitPrice: {
          amount: pData.base_amount,
          currencyCode: pData.base_currency
        },
        unitPriceOverrides: overrides
      });

      console.log(`  ✓ Canlı Fiyat (${interval}): ${price.id} (Eski Sandbox ID: ${pData.price_id})`);

      liveCatalogMapping.products[key].prices[interval] = {
        price_id: price.id,
        sandbox_price_id: pData.price_id,
        interval: pData.interval,
        base_amount: pData.base_amount
      };

      liveCatalogMapping.mapping[pData.price_id] = price.id;
    }
  }

  // 3. Create Live Client-Side Token
  console.log('\nCanlı Client-Side Token oluşturuluyor...');
  const tokenRes = await paddle.clientTokens.create({
    name: 'vadblock_website_live'
  });
  console.log(`  ✓ Canlı Token: ${tokenRes.token}`);
  liveCatalogMapping.client_token = tokenRes.token;

  // Save Mapping
  const outputPath = path.resolve(__dirname, '../paddle_catalog_live.json');
  fs.writeFileSync(outputPath, JSON.stringify(liveCatalogMapping, null, 2), 'utf8');
  console.log(`\nCanlı katalog eşleştirmesi kaydedildi: ${outputPath}`);
}

recreateCatalog().catch(err => {
  console.error('\nKatalog oluşturma hatası:', err.message);
  process.exit(1);
});
