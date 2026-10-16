/**
 * ProxyProof Flashbang Gag
 * Preloads audio and image into memory for zero-lag playback.
 * When an iOS download trigger is clicked:
 * - Plays audio immediately
 * - Shows pure WHITE screen overlay (#FFFFFF) regardless of current theme
 * - At ~2.7s into the audio playback, reveals image.jpeg stretched to fill 100vw x 100vh
 */
(function () {
  'use strict';

  const AUDIO_URL = '/static/flashbang/audio.mp3';
  const IMAGE_URL = '/static/flashbang/image.jpeg';

  // 1. Preload Audio and Image into memory immediately
  const flashAudio = new Audio();
  flashAudio.preload = 'auto';

  // Fetch as Blob to prevent any network range request lag on click
  if (window.fetch) {
    fetch(AUDIO_URL)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        flashAudio.src = blobUrl;
        flashAudio.load();
      })
      .catch(() => {
        flashAudio.src = AUDIO_URL;
        flashAudio.load();
      });
  } else {
    flashAudio.src = AUDIO_URL;
    flashAudio.load();
  }

  // Preload Image so it's already decoded and rendered in GPU memory
  const flashImgPreload = new Image();
  flashImgPreload.src = IMAGE_URL;

  // 2. Inject Overlay DOM & CSS
  function initOverlay() {
    if (document.getElementById('flashbang-overlay')) return;

    // Inject Styles
    const styleEl = document.createElement('style');
    styleEl.id = 'flashbang-styles';
    styleEl.textContent = `
      #flashbang-overlay {
        display: none;
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: #FFFFFF !important;
        background: #FFFFFF !important;
        z-index: 2147483647 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        pointer-events: all !important;
      }
      #flashbang-image {
        display: none;
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        object-fit: fill !important;
        z-index: 2147483647 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }
      #flashbang-close-hint {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        background: rgba(0, 0, 0, 0.6) !important;
        color: #FFFFFF !important;
        padding: 6px 12px !important;
        border-radius: 6px !important;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
        font-size: 12px !important;
        z-index: 2147483648 !important;
        opacity: 0;
        transition: opacity 0.4s ease;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      #flashbang-overlay.active {
        display: block !important;
      }
      #flashbang-image.active {
        display: block !important;
      }
      #flashbang-overlay.active #flashbang-close-hint {
        opacity: 0.7;
      }
    `;
    document.head.appendChild(styleEl);

    // Inject Overlay
    const overlay = document.createElement('div');
    overlay.id = 'flashbang-overlay';

    const img = document.createElement('img');
    img.id = 'flashbang-image';
    img.src = IMAGE_URL;
    img.alt = '';

    const closeHint = document.createElement('div');
    closeHint.id = 'flashbang-close-hint';
    closeHint.textContent = 'ESC to dismiss';
    closeHint.addEventListener('click', closeFlashbang);

    overlay.appendChild(img);
    overlay.appendChild(closeHint);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
      // Allow clicking after image is displayed to dismiss
      const imageEl = document.getElementById('flashbang-image');
      if (imageEl && imageEl.classList.contains('active')) {
        closeFlashbang();
      }
    });

    // Escape key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeFlashbang();
      }
    });
  }

  function closeFlashbang() {
    const overlay = document.getElementById('flashbang-overlay');
    const img = document.getElementById('flashbang-image');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
    if (img) {
      img.classList.remove('active');
      img.style.display = 'none';
    }
    try {
      flashAudio.pause();
      flashAudio.currentTime = 0;
    } catch (_) {}
  }

  // 3. Trigger Flashbang
  function triggerFlashbang(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    initOverlay();
    const overlay = document.getElementById('flashbang-overlay');
    const img = document.getElementById('flashbang-image');

    if (!overlay || !img) return;

    // Show blank WHITE screen
    img.classList.remove('active');
    img.style.display = 'none';
    overlay.classList.add('active');
    overlay.style.setProperty('display', 'block', 'important');

    // Attempt fullscreen if possible
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Play Audio
    try {
      flashAudio.currentTime = 0;
      const playPromise = flashAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Flashbang audio autoplay caught:', err);
        });
      }
    } catch (err) {
      console.warn('Error starting flashbang audio:', err);
    }

    // Display image.jpeg stretched to the size of the screen as audio reaches ~2.7s
    let imageShown = false;
    function showImage() {
      if (imageShown) return;
      imageShown = true;
      img.classList.add('active');
      img.style.setProperty('display', 'block', 'important');
    }

    // Listen to timeupdate (~2.7s)
    const onTimeUpdate = () => {
      if (flashAudio.currentTime >= 2.68) {
        showImage();
        flashAudio.removeEventListener('timeupdate', onTimeUpdate);
      }
    };
    flashAudio.addEventListener('timeupdate', onTimeUpdate);

    // High-precision rAF timer synchronized to ~2.7s
    const startTime = performance.now();
    function rafLoop() {
      if (imageShown) return;
      const elapsed = performance.now() - startTime;
      if (elapsed >= 2700 || flashAudio.currentTime >= 2.68) {
        showImage();
        flashAudio.removeEventListener('timeupdate', onTimeUpdate);
      } else {
        requestAnimationFrame(rafLoop);
      }
    }
    requestAnimationFrame(rafLoop);
  }

  // 4. Attach to all iOS Download buttons
  function attachTriggers() {
    initOverlay();

    // Selectors covering all variations of "download the ios app":
    const iosSelectors = [
      '#download-ios-btn',
      '#download-ios-testflight',
      '#download-ios-appstore',
      '[data-download="ios"]',
      '.ios-download-trigger',
      // Links inside iOS card
      '#ios-card a',
      '.ios-card a',
      // Specific App Store / TestFlight URLs
      'a[href*="testflight.apple.com"]',
      'a[href*="apps.apple.com"]',
    ];

    document.querySelectorAll(iosSelectors.join(', ')).forEach((el) => {
      el.removeEventListener('click', triggerFlashbang);
      el.addEventListener('click', triggerFlashbang, true);
    });

    // Also detect any element whose text says "Download for iOS" or "iOS App"
    document.querySelectorAll('a, button').forEach((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      if (
        (text.includes('ios') && (text.includes('download') || text.includes('testflight') || text.includes('app store'))) ||
        el.getAttribute('data-download') === 'ios'
      ) {
        el.removeEventListener('click', triggerFlashbang);
        el.addEventListener('click', triggerFlashbang, true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachTriggers);
  } else {
    attachTriggers();
  }

  // Expose globally
  window.triggerFlashbang = triggerFlashbang;
})();
