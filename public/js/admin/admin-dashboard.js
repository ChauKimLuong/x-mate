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
      scales: {
        x: { grid: { display:false } },
        y: { beginAtZero:true, ticks:{ stepSize:10 } }
      }
    }
  });
})();
