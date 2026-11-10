<?php
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$isLoggedIn = !empty($_SESSION['uid']);
?>
<footer class="foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="/">
        <img src="/img/logo.png" alt="vAdBlock Pro" width="28" height="28" style="display:block; object-fit:contain; border-radius:6px;">
        <span>vAdBlock <b>Pro</b></span>
      </a>
      <p>Banner reklamları, video reklamları, sinir bozucu pop-up'ları ve izleyicileri cihazınızda yerel olarak filtreleyen modern ve hafif Chrome eklentisi.</p>
    </div>
    <div class="foot-col">
      <span class="foot-label">Ürün & Özellikler</span>
      <a href="/#features">Özellikler</a>
      <a href="/#how">Nasıl Çalışır</a>
      <a href="/#sites">Desteklenen Platformlar</a>
      <a href="/#pricing">VIP Üyelik</a>
      <a href="/lave_adblock_ext.zip" download>Eklentiyi İndir (.ZIP)</a>
    </div>
    <div class="foot-col">
      <span class="foot-label">Bilgi & Kurumsal</span>
      <a href="/privacy">Gizlilik Politikası</a>
      <a href="/terms">Kullanım Koşulları</a>
      <a href="/contact">Destek & İletişim</a>
      <a href="/whats-new">Yenilikler & Güncellemeler</a>
    </div>
    <div class="foot-col">
      <span class="foot-label">Hesap</span>
      <?php if($isLoggedIn): ?>
        <a href="/account">Hesap Detayları</a>
        <a href="/account?tab=orders">Siparişlerim</a>
        <a href="/?logout=1">Güvenli Çıkış</a>
      <?php else: ?>
        <a href="/login">Giriş Yap</a>
        <a href="/register">Ücretsiz Kayıt Ol</a>
      <?php endif; ?>
    </div>
  </div>
  <div class="foot-legal wrap">&copy; 2026 vAdBlock Pro · Tüm hakları saklıdır. Google Chrome, Google LLC'nin tescilli ticari markasıdır.</div>
</footer>
