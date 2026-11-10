/**
 * Tier interface definition:
 * export interface Tier {
 *   name: 'Starter' | 'Pro' | 'Advanced'
 *   description: string
 *   features: string[]
 *   priceId: { month: string; year: string }
 *   badge?: string
 *   featured?: boolean
 * }
 */

export const TIERS = [
  {
    name: 'Starter',
    badge: '7 GÜN ÜCRETSİZ DENEME',
    description: 'Bireysel kullanım ve temel reklamsız gezinme için ideal başlangıç.',
    features: [
      'Tüm Reklam ve Pop-up Engelleme',
      'YouTube Video Reklam Filtresi',
      'VIP SponsorBlock Atlatma',
      'Standart Öncelikli Destek',
      '7 Günlük Ücretsiz Deneme'
    ],
    priceId: {
      month: 'pri_01m72gmcpvvddfk1x6j0jmfzn3',
      year: 'pri_01m72gmcx6erheqg2xwtge567q'
    },
    featured: false
  },
  {
    name: 'Pro',
    badge: '%17 TASARRUF · EN POPÜLER',
    description: 'En çok tercih edilen plan. Kesintisiz yüksek hız, bulut eşitleme ve 365 gün koruma.',
    features: [
      'Tüm Reklam ve Pop-up Engelleme',
      'YouTube Sponsor & Reklam Atlatma',
      'Bulut Beyaz Liste Senkronizasyonu',
      '7/24 Öncelikli Canlı Destek',
      'Özel VIP Üye Rozeti',
      '7 Günlük Ücretsiz Deneme'
    ],
    priceId: {
      month: 'pri_01m72gmdae8h84jzp8cv0g853x',
      year: 'pri_01m72gmdgfwevdsap0w0ab9yeh'
    },
    featured: true
  },
  {
    name: 'Advanced',
    badge: 'MAKSİMUM GÜÇ · 7 GÜN DENEME',
    description: 'Tüm cihazlarınız için sınırsız koruma, kurucu VIP ayrıcalıkları ve tam kontrol.',
    features: [
      'Sınırsız Tüm Cihazlarda Koruma',
      'VIP SponsorBlock Onay Muafiyeti',
      'Gelecek Tüm Güncellemelere Erken Erişim',
      'Kurucu VIP Rozeti ve 7/24 VIP Destek',
      'Gelişmiş Özel Kural Oluşturucu',
      '7 Günlük Ücretsiz Deneme'
    ],
    priceId: {
      month: 'pri_01m72gme9vjkveppzj7ky0zw65',
      year: 'pri_01m72gmefxcb2ybd6d1k9fr0y1'
    },
    featured: false
  }
];

if (typeof window !== 'undefined') {
  window.PADDLE_TIERS = TIERS;
}
