// MIKOF VisuMax — лёгкие правки для формы и FAQ. Bootstrap-аккордеон обрабатывает Bootstrap-JS.

document.addEventListener('DOMContentLoaded', () => {

    // Поиск — переключатель видимости (как на mikof)
    const searchBtn = document.getElementById('search-btn');
    const searchField = document.getElementById('search-field');
    if (searchBtn && searchField) {
        searchBtn.addEventListener('click', () => searchField.classList.toggle('active'));
    }

    // Плавная прокрутка для якорей
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (href.length > 1 && document.querySelector(href)) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // FAQ-аккордеоном управляет Bootstrap через data-bs-toggle="collapse" и data-bs-parent

    // Карусель "Путь пациента по дням" (вместо видео в блоке SMILE Pro)
    const jTrack = document.getElementById('journeyTrack');
    if (jTrack) {
        const slides = Array.from(jTrack.children);
        const dotsWrap = document.getElementById('journeyDots');
        const prevBtn = document.querySelector('.journey__arrow--prev');
        const nextBtn = document.querySelector('.journey__arrow--next');
        const carousel = jTrack.closest('.journey');

        const dots = slides.map((_, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'journey__dot';
            b.setAttribute('aria-label', 'Слайд ' + (i + 1));
            b.addEventListener('click', () => goTo(i));
            if (dotsWrap) dotsWrap.appendChild(b);
            return b;
        });

        const step = () => (slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : jTrack.clientWidth);
        const index = () => Math.round(jTrack.scrollLeft / step());
        const goTo = (i) => {
            const n = Math.max(0, Math.min(slides.length - 1, i));
            jTrack.scrollTo({ left: n * step(), behavior: 'smooth' });
        };
        const sync = () => {
            const idx = index();
            dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        };

        jTrack.addEventListener('scroll', () => window.requestAnimationFrame(sync));
        if (prevBtn) prevBtn.addEventListener('click', () => goTo(index() - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(index() + 1));
        sync();

        // Автопрокрутка (с уважением к prefers-reduced-motion), пауза при наведении/касании
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let timer = null;
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const play = () => {
            if (reduce) return;
            stop();
            timer = setInterval(() => goTo((index() + 1) % slides.length), 5000);
        };
        if (carousel) {
            carousel.addEventListener('mouseenter', stop);
            carousel.addEventListener('mouseleave', play);
            carousel.addEventListener('touchstart', stop, { passive: true });
            carousel.addEventListener('focusin', stop);
        }
        play();
    }
});
