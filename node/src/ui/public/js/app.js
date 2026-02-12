// ARM UI Client-Side JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Auto-refresh active jobs on home and activerips pages every 30 seconds
  if (window.location.pathname === '/' || window.location.pathname === '/activerips') {
    setInterval(function() {
      fetch('/api/jobs?status=active')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success || !data.jobs) return;
          var tbody = document.querySelector('table tbody');
          if (!tbody) return;
          if (data.jobs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No active rips at this time.</td></tr>';
            return;
          }
          var html = '';
          data.jobs.forEach(function(job) {
            var chipClass = job.status === 'ripping' ? 'primary' : (job.status === 'transcoding' ? 'secondary' : 'tertiary');
            html += '<tr>';
            html += '<td><a href="/jobdetail?job_id=' + job.job_id + '">' + job.job_id + '</a></td>';
            html += '<td>' + (job.title || 'Unknown') + '</td>';
            html += '<td>' + (job.disctype || '') + '</td>';
            html += '<td><span class="chip small ' + chipClass + '">' + (job.status || '') + '</span></td>';
            html += '<td>' + (job.progress || 'N/A') + '</td>';
            html += '<td>' + (job.start_time ? new Date(job.start_time).toLocaleString() : '') + '</td>';
            html += '<td><a href="/jobdetail?job_id=' + job.job_id + '" class="button small border">Details</a></td>';
            html += '</tr>';
          });
          tbody.innerHTML = html;
        })
        .catch(function(err) {
          console.error('Failed to fetch jobs:', err);
        });
    }, 30000);
  }
});
