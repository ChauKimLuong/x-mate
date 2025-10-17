(function(){
  const cvs = document.getElementById('perfChart');
  const P = window.__chart || { labels: [], views: [], added: [], completed: [] };
  if(!cvs) return;

  new Chart(cvs, {
    type: 'bar',
    data: {
      labels: P.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Product Views',
          data: P.views,
          backgroundColor: '#ff6a21',
          borderRadius: 6,
          maxBarThickness: 16
        },
        {
          type: 'line',
          label: 'Added to Cart',
          data: P.added,
          borderColor: '#20a26b',
          borderWidth: 3,
          pointRadius: 3,
          tension: .4,
          fill: false
        },
        {
          type: 'line',
          label: 'Completed Orders',
          data: P.completed,
          borderColor: '#2563eb',
          borderWidth: 3,
          pointRadius: 3,
          tension: .4,
          fill: false
        }
      ]
    },
    options: {
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: { x: { grid: { display:false } }, y: { beginAtZero:true, ticks:{ stepSize:10 } } }
    }
  });
})();

// Extra charts
(function(){
  if (typeof Chart === 'undefined') return;

  // Orders by Status (last 30 days)
  const el1 = document.getElementById('revenueLineChart');
  if (el1 && window.__revenueDaily) {
    const O = window.__revenueDaily;
    new Chart(el1, {
      type: 'line',
      data: {
        labels: O.labels,
        datasets: [{ label: 'Revenue (VND)', data: O.values, borderColor: '#ff6a21', backgroundColor: 'rgba(255,106,33,0.12)', tension:.35, pointRadius: 0, fill:true }] }, options: {
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { x: { grid: { display:false } }, y: { beginAtZero: true } }
      }
    });
  }

  // Revenue by Category
  const el2 = document.getElementById('categoryBarChart');
  if (el2 && window.__catRevenue) {
    const C = window.__catRevenue;
    new Chart(el2, {
      type: 'bar',
      data: {
        labels: C.labels,
        datasets: [{ label: 'Revenue (VND)', data: C.values, backgroundColor: '#e6612a', borderColor: '#e6612a', borderWidth: 1, borderRadius: 8, maxBarThickness: 26 }] }, options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx)=> (ctx.raw||0).toLocaleString('vi-VN')+'đ' } } },
        scales: { x:{ grid:{display:false} }, y:{ beginAtZero:true, ticks:{ callback:(v)=> Number(v).toLocaleString('vi-VN')+'đ' } } }
      }
    });
  }

  // Top Products (qty)
  const el3 = document.getElementById('topProductsBarChart');
  if (el3 && window.__topProducts) {
    const T = window.__topProducts;
    new Chart(el3, {
      type: 'bar',
      data: { labels: T.labels, datasets: [{ label: 'Qty', data: T.values, backgroundColor: '#ff6a21', borderRadius: 8, maxBarThickness: 26 }] }, options: { indexAxis: 'y', plugins: { legend: { display:false } }, scales: { x: { beginAtZero:true } } }
    });
  }
})();





