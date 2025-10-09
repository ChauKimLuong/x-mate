(function(){
  const cvs = document.getElementById('perfChart');
  const P = window.__chart || {labels:[], bar:[], line:[]};
  if(!cvs) return;

  new Chart(cvs, {
    type: 'bar',
    data: {
      labels: P.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Page Views',
          data: P.bar,
          backgroundColor: '#ff6a21',
          borderRadius: 6,
          maxBarThickness: 18
        },
        {
          type: 'line',
          label: 'Clicks',
          data: P.line,
          borderColor: '#20a26b',
          borderWidth: 3,
          pointRadius: 0,
          tension: .35,
          fill: false
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display:false } },
        y: { beginAtZero:true, ticks: { stepSize:10 } }
      }
    }
  });
})();
