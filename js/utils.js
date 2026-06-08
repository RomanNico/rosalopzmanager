/**
 * ROSALOPZManager - UI Utilities
 * Toast, Modal, formatting helpers
 */

/* ===========================
   TIME ZONE HELPERS (BOGOTA)
   =========================== */
const TimeHelper = {
  getBogotaNow: () => {
    const date = new Date();
    const options = {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach(p => map[p.type] = p.value);
    // Format: YYYY-MM-DDTHH:mm:ss.000Z
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.000Z`;
  },
  getBogotaToday: () => {
    return TimeHelper.getBogotaNow().split('T')[0];
  },
  getBogotaYear: () => {
    return parseInt(TimeHelper.getBogotaToday().split('-')[0]);
  }
};

/* ===========================
   TOAST NOTIFICATIONS
=========================== */
const Toast = (() => {
  let container;

  const getContainer = () => {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const show = (message, type = 'info', duration = 3500) => {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;
    c.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  };

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error', 4500),
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info'),
  };
})();

/* ===========================
   MODAL MANAGER
=========================== */
const Modal = (() => {
  const open = (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  const close = (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  const closeAll = () => {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  };

  const confirm = (message, title = '¿Estás seguro?') => {
    return new Promise((resolve) => {
      // Remove existing confirm modal
      const old = document.getElementById('confirm-modal-overlay');
      if (old) old.remove();

      const overlay = document.createElement('div');
      overlay.id = 'confirm-modal-overlay';
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title">⚠️ ${title}</h3>
            <button class="modal-close" id="confirm-modal-x">✕</button>
          </div>
          <p style="color: var(--text-secondary); margin-bottom: 8px;">${message}</p>
          <div class="modal-footer">
            <button class="btn btn-outline" id="confirm-cancel">Cancelar</button>
            <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(result);
      };

      document.getElementById('confirm-ok').onclick = () => cleanup(true);
      document.getElementById('confirm-cancel').onclick = () => cleanup(false);
      document.getElementById('confirm-modal-x').onclick = () => cleanup(false);
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
  };

  return { open, close, closeAll, confirm };
})();

/* ===========================
   FORMATTING HELPERS
=========================== */
const Fmt = {
  currency: (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val),

  date: (str) => {
    if (!str) return '-';
    const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  datetime: (str) => {
    if (!str) return '-';
    return new Date(str).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  rolBadge: (rol) => {
    const map = {
      administrador: '<span class="badge badge-primary">👑 Administrador</span>',
      jefe: '<span class="badge badge-secondary">🎯 Jefe</span>',
      empleado: '<span class="badge badge-info">👤 Empleado</span>',
    };
    return map[rol] || rol;
  },

  estadoNomina: (estado) => {
    const map = {
      pagada: '<span class="badge badge-success">✅ Pagada</span>',
      pendiente: '<span class="badge badge-warning">⏳ Pendiente</span>',
    };
    return map[estado] || estado;
  },

  estadoTarea: (estado) => {
    const map = {
      pendiente: '<span class="badge badge-warning">⏳ Pendiente</span>',
      en_progreso: '<span class="badge badge-info">🔄 En Progreso</span>',
      completada: '<span class="badge badge-success">✅ Completada</span>',
    };
    return map[estado] || estado;
  },

  prioridadBadge: (prio) => {
    const map = {
      alta: '<span class="badge badge-danger">🔥 Alta</span>',
      media: '<span class="badge badge-warning">📌 Media</span>',
      baja: '<span class="badge badge-info">🌱 Baja</span>',
    };
    return map[prio] || prio;
  },

  stockBadge: (cantidad, minimo) => {
    if (cantidad <= 0) return '<span class="badge badge-danger">Sin Stock</span>';
    if (cantidad <= minimo) return '<span class="badge badge-warning">Stock Bajo</span>';
    return '<span class="badge badge-success">Normal</span>';
  },

  avatarInitials: (nombre) => {
    if (!nombre) return '?';
    const parts = nombre.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : nombre.substring(0, 2).toUpperCase();
  },

  avatarColor: (id) => {
    const colors = [
      'linear-gradient(135deg, #4361ee, #3a0ca3)',
      'linear-gradient(135deg, #f8a80c, #e08b00)',
      'linear-gradient(135deg, #06d6a0, #05a87f)',
      'linear-gradient(135deg, #4cc9f0, #0096c7)',
      'linear-gradient(135deg, #ef233c, #c9182e)',
      'linear-gradient(135deg, #7b9ef8, #4361ee)',
    ];
    return colors[(id - 1) % colors.length];
  },

  initials: (nombre) => {
    if (!nombre) return '?';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  },
};

/* ===========================
   VALIDATORS
=========================== */
const Validate = {
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  required: (val) => val !== undefined && val !== null && String(val).trim() !== '',
  minLength: (val, min) => String(val).trim().length >= min,
  password: (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  },
};

/* ===========================
   CHART HELPERS (mini canvas)
=========================== */
const Charts = {
  drawDonut: (canvas, segments, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = Math.min(cx, cy) * 0.8;
    const innerR = r * 0.55;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = -Math.PI / 2;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return;
    segments.forEach(seg => {
      const angle = (seg.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + angle);
      ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      startAngle += angle;
    });
    // Center text
    if (opts.centerText) {
      ctx.fillStyle = opts.centerColor || '#f0f0ff';
      ctx.font = `bold ${opts.centerFontSize || 18}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.centerText, cx, cy - 8);
      if (opts.centerSub) {
        ctx.font = `${opts.subFontSize || 11}px Inter, sans-serif`;
        ctx.fillStyle = '#6060a0';
        ctx.fillText(opts.centerSub, cx, cy + 14);
      }
    }
  },

  drawBar: (canvas, data, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const pad = opts.pad || 24;
    const bw = opts.barWidth || 28;
    ctx.clearRect(0, 0, w, h);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    data.forEach((d, i) => {
      const x = pad + i * ((w - pad * 2) / data.length) + ((w - pad * 2) / data.length - bw) / 2;
      const barH = ((d.value / maxVal) * (h - pad * 2));
      const y = h - pad - barH;
      const grad = ctx.createLinearGradient(x, y, x, h - pad);
      grad.addColorStop(0, d.color || opts.color || '#4361ee');
      grad.addColorStop(1, d.color2 || opts.color2 || '#3a0ca3');
      ctx.beginPath();
      ctx.roundRect(x, y, bw, barH, 4);
      ctx.fillStyle = grad;
      ctx.fill();
      // Label
      ctx.fillStyle = '#6060a0';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + bw / 2, h - 4);
      // Value
      ctx.fillStyle = '#a0a0c0';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(d.value, x + bw / 2, y - 6);
    });
  },
};

/* ===========================
   PAGINATION
=========================== */
const Paginator = (items, pageSize = 8) => {
  let page = 1;
  const totalPages = () => Math.max(1, Math.ceil(items.length / pageSize));
  const getPage = () => items.slice((page - 1) * pageSize, page * pageSize);
  const next = () => { if (page < totalPages()) page++; };
  const prev = () => { if (page > 1) page--; };
  const goTo = (n) => { page = Math.max(1, Math.min(n, totalPages())); };
  const info = () => ({ page, total: totalPages(), count: items.length });
  return { getPage, next, prev, goTo, info };
};
