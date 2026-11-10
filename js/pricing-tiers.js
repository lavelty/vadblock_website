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
      month: 'pri_01m72kt6t1t2zh5fpatc1k9151',
      year: 'pri_01m72kt6zhmaqz9gak4xjkaskn'
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
      month: 'pri_01m72kt7regx9e77616tpxndvy',
      year: 'pri_01m72kt7y0pnm3cwatekxcmy2b'
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
      month: 'pri_01m72kt8a2nzw71ak548nhcqmg',
      year: 'pri_01m72kt8f8gdc3zqx8p4qrhkh2'
    },
    featured: false
  }
];

if (typeof window !== 'undefined') {
  window.PADDLE_TIERS = TIERS;
}
