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
});
