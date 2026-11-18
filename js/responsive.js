/**
 * ROSALOPZManager - Vista de tarjetas en pantallas pequeñas
 * En celulares (≤ 768px) las tablas marcadas con [data-cards] (Nóminas e Inventario)
 * se muestran como tarjetas. Las tarjetas se arman leyendo los encabezados de la tabla,
 * así que siguen funcionando aunque se agreguen o quiten columnas.
 */
(function () {
  const BREAKPOINT = 768;
  const isMobile = () => window.innerWidth <= BREAKPOINT;

  function buildCards(table) {
    const wrapper = table.closest('.table-responsive') || table.parentNode;
    let container = document.getElementById(table.id + '-cards');
    if (!container) {
      container = document.createElement('div');
      container.id = table.id + '-cards';
      container.className = 'card-view';
      wrapper.parentNode.insertBefore(container, wrapper.nextSibling);
    }

    // Encabezados visibles (p. ej. "Acciones" puede estar oculta)
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => ({
      label: th.textContent.trim(),
      hidden: th.style.display === 'none',
    }));
    const lastIdx = headers.length - 1;
    const hasActions = /acciones/i.test(headers[lastIdx]?.label || '');

    container.innerHTML = '';
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.children);
      const card = document.createElement('div');
      card.className = 'card-item glass';

      // Fila de "sin datos" (una sola celda con colspan)
      if (cells.length === 1) {
        card.innerHTML = cells[0].innerHTML;
        container.appendChild(card);
        return;
      }

      // Las celdas se clonan (no se copian como texto) para conservar botones y su onclick
      const title = document.createElement('div');
      title.style.marginBottom = '8px';
      title.append(...Array.from(cells[0].childNodes).map(n => n.cloneNode(true)));
      card.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'card-row';
      cells.forEach((td, i) => {
        if (i === 0 || headers[i]?.hidden || (hasActions && i === lastIdx)) return;
        const kv = document.createElement('div');
        kv.className = 'card-kv';
        const label = document.createElement('div');
        label.style.cssText = 'font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px;';
        label.textContent = headers[i]?.label || '';
        const value = document.createElement('div');
        value.style.color = 'var(--text-primary)';
        value.append(...Array.from(td.childNodes).map(n => n.cloneNode(true)));
        kv.append(label, value);
        grid.appendChild(kv);
      });
      card.appendChild(grid);

      if (hasActions && cells[lastIdx]) {
        const actions = document.createElement('div');
        actions.style.marginTop = '10px';
        actions.append(...Array.from(cells[lastIdx].childNodes).map(n => n.cloneNode(true)));
        card.appendChild(actions);
      }
      container.appendChild(card);
    });
  }

  function update() {
    document.querySelectorAll('table[data-cards]').forEach(table => {
      const cards = document.getElementById(table.id + '-cards');
      if (isMobile()) buildCards(table);
      else if (cards) cards.remove();
    });
  }

  window.addEventListener('resize', () => {
    clearTimeout(window._respTimer);
    window._respTimer = setTimeout(update, 120);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // Re-armar las tarjetas cada vez que app.js vuelve a dibujar la tabla
    document.querySelectorAll('table[data-cards] tbody').forEach(tbody => {
      new MutationObserver(() => { if (isMobile()) buildCards(tbody.closest('table')); })
        .observe(tbody, { childList: true });
    });
    update();
  });
})();
