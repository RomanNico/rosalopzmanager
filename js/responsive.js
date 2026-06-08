// responsive.js
// Switches Inventario and Nominas tables to card views on small screens
(function(){
  const BREAKPOINT = 768;

  function tableToCards(tableSelector, cardContainerId, mapper) {
    const table = document.querySelector(tableSelector);
    if (!table) return null;

    let container = document.getElementById(cardContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = cardContainerId;
      container.className = 'card-view';
      table.parentNode.insertBefore(container, table.nextSibling);
    }

    // Build cards from table rows
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    container.innerHTML = '';
    rows.forEach(tr => {
      const card = document.createElement('div');
      card.className = 'card-item glass';
      const cardHtml = mapper(tr);
      card.innerHTML = cardHtml;
      container.appendChild(card);
    });

    return container;
  }

  function renderInventarioCards() {
    const mapper = (tr) => {
      const cols = tr.querySelectorAll('td');
      // expected columns: img, referencia, nombre, talla, color, existencia, acciones
      const img = cols[0] ? cols[0].innerHTML : '';
      const referencia = cols[1] ? cols[1].innerText : '';
      const nombre = cols[2] ? cols[2].innerText : '';
      const talla = cols[3] ? cols[3].innerText : '';
      const color = cols[4] ? cols[4].innerText : '';
      const existencia = cols[5] ? cols[5].innerText : '';
      const acciones = cols[6] ? cols[6].innerHTML : '';

      return `
        <div class="card-row">
          <div class="card-compact">${img}</div>
          <div style="flex:1">
            <h4>${referencia} — ${nombre}</h4>
            <div class="card-row">
              <div class="card-kv">Talla: <strong>${talla}</strong></div>
              <div class="card-kv">Color: <strong>${color}</strong></div>
              <div class="card-kv">Existencia: <strong>${existencia}</strong></div>
            </div>
          </div>
        </div>
        <div style="margin-top:8px">${acciones}</div>
      `;
    };
    tableToCards('#inventario-table', 'inventario-cards', mapper);
  }

  function renderNominasCards() {
    const mapper = (tr) => {
      const cols = tr.querySelectorAll('td');
      // expected columns: id, empleado, monto, fecha, medio, comprobante, acciones
      const empleado = cols[1] ? cols[1].innerText : '';
      const monto = cols[2] ? cols[2].innerText : '';
      const fecha = cols[3] ? cols[3].innerText : '';
      const medio = cols[4] ? cols[4].innerText : '';
      const comprobante = cols[5] ? cols[5].innerHTML : '';
      const acciones = cols[6] ? cols[6].innerHTML : '';

      return `
        <div class="card-row">
          <div style="flex:1">
            <h4>${empleado}</h4>
            <div class="card-row">
              <div class="card-kv">Monto: <strong>${monto}</strong></div>
              <div class="card-kv">Fecha: <strong>${fecha}</strong></div>
              <div class="card-kv">Medio: <strong>${medio}</strong></div>
            </div>
          </div>
          <div style="margin-left:8px">${comprobante}</div>
        </div>
        <div style="margin-top:8px">${acciones}</div>
      `;
    };
    tableToCards('#nominas-table', 'nominas-cards', mapper);
  }

  function updateViews() {
    const w = window.innerWidth;
    const invTable = document.querySelector('#inventario-table');
    const nomTable = document.querySelector('#nominas-table');

    if (w <= BREAKPOINT) {
      if (invTable) invTable.closest('.table-responsive')?.classList.add('hidden-on-mobile');
      if (nomTable) nomTable.closest('.table-responsive')?.classList.add('hidden-on-mobile');
      renderInventarioCards();
      renderNominasCards();
    } else {
      // remove card containers if present
      const invCards = document.getElementById('inventario-cards');
      if (invCards) invCards.remove();
      const nomCards = document.getElementById('nominas-cards');
      if (nomCards) nomCards.remove();
      if (invTable) invTable.closest('.table-responsive')?.classList.remove('hidden-on-mobile');
      if (nomTable) nomTable.closest('.table-responsive')?.classList.remove('hidden-on-mobile');
    }
  }

  window.addEventListener('resize', () => {
    // debounce
    clearTimeout(window._respTimer);
    window._respTimer = setTimeout(updateViews, 120);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to allow tables to render
    setTimeout(updateViews, 250);

    // Also observe table body changes to refresh cards
    const invTable = document.querySelector('#inventario-table');
    const nomTable = document.querySelector('#nominas-table');
    const obsConfig = { childList: true, subtree: true };
    if (invTable) {
      const b = invTable.querySelector('tbody');
      if (b) new MutationObserver(() => { if (window.innerWidth <= BREAKPOINT) renderInventarioCards(); }).observe(b, obsConfig);
    }
    if (nomTable) {
      const b2 = nomTable.querySelector('tbody');
      if (b2) new MutationObserver(() => { if (window.innerWidth <= BREAKPOINT) renderNominasCards(); }).observe(b2, obsConfig);
    }
  });
})();
