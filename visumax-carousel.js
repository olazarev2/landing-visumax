/* VisuMax — карусель «Путь пациента» как прогрессивное улучшение.
   Работает с разметкой без JS (точки-ссылки + scroll-snap): добавляет стрелки,
   активную точку, перетаскивание мышью и автопрокрутку. Если скрипт не загрузится —
   точки и свайп всё равно работают (graceful degradation).
   Раздаётся через jsDelivr (CSP mikof.md разрешает *.jsdelivr.net). */
(function () {
  function init() {
    var track = document.getElementById('journeyTrack');
    if (!track || track.dataset.vmInit) return;
    track.dataset.vmInit = '1';
    var journey = track.closest('.journey') || track.parentElement;
    var slides = Array.prototype.slice.call(track.querySelectorAll('.journey__slide'));
    var dots = Array.prototype.slice.call((journey || document).querySelectorAll('.journey__dots a.journey__dot'));
    if (slides.length < 2) return;

    var step = function () { return slides[1].offsetLeft - slides[0].offsetLeft || track.clientWidth; };
    var index = function () { return Math.round(track.scrollLeft / step()); };
    var goTo = function (i) {
      var n = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: n * step(), behavior: 'smooth' });
    };

    // стрелки (создаём динамически)
    function mkArrow(cls, label, txt) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'journey__arrow ' + cls;
      b.setAttribute('aria-label', label); b.textContent = txt;
      return b;
    }
    var prev = mkArrow('journey__arrow--prev', 'Предыдущий слайд', '‹');
    var next = mkArrow('journey__arrow--next', 'Следующий слайд', '›');
    prev.addEventListener('click', function () { goTo(index() - 1); });
    next.addEventListener('click', function () { goTo(index() + 1); });
    journey.appendChild(prev); journey.appendChild(next);

    // активная точка + перехват клика (без прыжка по hash)
    dots.forEach(function (d, i) { d.addEventListener('click', function (e) { e.preventDefault(); goTo(i); }); });
    var sync = function () { var idx = index(); dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); }); };
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); });
    sync();

    // перетаскивание мышью на десктопе
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('mousedown', function (e) { down = true; moved = false; sx = e.pageX; sl = track.scrollLeft; track.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', function () { down = false; track.style.cursor = ''; });
    track.addEventListener('mouseleave', function () { down = false; track.style.cursor = ''; });
    track.addEventListener('mousemove', function (e) { if (!down) return; e.preventDefault(); moved = true; track.scrollLeft = sl - (e.pageX - sx); });

    // автопрокрутка с уважением к prefers-reduced-motion и паузой при взаимодействии
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer = null;
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
    var play = function () { if (reduce) return; stop(); timer = setInterval(function () { goTo((index() + 1) % slides.length); }, 5000); };
    journey.addEventListener('mouseenter', stop);
    journey.addEventListener('mouseleave', play);
    journey.addEventListener('touchstart', stop, { passive: true });
    journey.addEventListener('focusin', stop);
    play();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
