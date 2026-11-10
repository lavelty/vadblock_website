<?php
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$isLoggedIn = !empty($_SESSION['uid']);
$loggedUsername = $_SESSION['vab_username'] ?? '';
?>
<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="/" aria-label="vAdBlock Pro">
      <img src="/img/logo.png" alt="vAdBlock Pro" width="34" height="34" style="display:block; object-fit:contain; border-radius:8px;">
      <span>vAdBlock <b>Pro</b></span>
    </a>
    <nav class="nav-links" aria-label="Main">
      <a href="/#features">Features</a>
      <a href="/#sites">Supported sites</a>
      <a href="/#demo">Demo</a>
      <a href="/#how">How it works</a>
      <a href="/#pricing">Premium</a>
      <a href="/#faq">FAQ</a>
    </nav>
    <div style="display:flex; align-items:center; gap:12px;">
      <?php if ($isLoggedIn): ?>
        <a href="/account" class="btn btn-ghost" style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px; font-weight:700; color:#0F172A; text-decoration:none; background:rgba(37, 99, 235, 0.06); border:1px solid #E2E8F0; border-radius:999px; font-size:13.5px; white-space:nowrap;">
          <span style="width:22px; height:22px; border-radius:50%; background:#2563EB; color:#fff; display:grid; place-items:center; font-size:11px; font-weight:800;"><?= strtoupper(mb_substr($loggedUsername ?: 'U', 0, 1)) ?></span>
          <span>Hesabım</span>
        </a>
      <?php else: ?>
        <a href="/login" class="btn btn-ghost" style="padding:7px 16px; font-weight:700; color:#0F172A; text-decoration:none; font-size:14px; border:1px solid #E2E8F0; border-radius:999px; background:#fff; white-space:nowrap;">Giriş Yap</a>
      <?php endif; ?>
      <a href="/lave_adblock_ext.zip" download class="btn btn-primary btn-nav"><span class="btn-ico"><img src="/brand/favicon.svg" alt="" width="22" height="22"></span>Add to Chrome</a>
    </div>
  </div>
</header>
