// ARM UI Client-Side JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Auto-refresh active jobs page every 30 seconds
  if (window.location.pathname === '/' || window.location.pathname === '/activerips') {
    setInterval(function() {
      fetch('/api/jobs?status=active')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success && data.jobs) {
            console.log('Active jobs:', data.jobs.length);
          }
        })
        .catch(function(err) {
          console.error('Failed to fetch jobs:', err);
        });
    }, 30000);
  }
});
