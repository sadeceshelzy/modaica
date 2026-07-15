<!DOCTYPE html>
<html lang="tr">
<head>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#1a1f5e">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($page_title ?? 'MODAICA') ?></title>
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    rel="stylesheet">
  <?php if (!empty($page_css)): ?>
  <link rel="stylesheet" href="<?= htmlspecialchars($page_css) ?>">
  <?php endif; ?>
  <link rel="stylesheet" href="css/mobile.css">
  <script src="js/seo.js"></script>
  <?php if (!empty($seo_config)): ?>
  <script>SEO.init(<?= json_encode($seo_config, JSON_UNESCAPED_UNICODE) ?>);</script>
  <?php endif; ?>
</head>
