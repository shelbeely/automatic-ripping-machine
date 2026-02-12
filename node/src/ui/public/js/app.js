// ARM UI Client-Side JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Auto-refresh active jobs on home and activerips pages every 30 seconds
  if (window.location.pathname === '/' || window.location.pathname === '/activerips') {
    setInterval(function() {
      fetch('/api/jobs?status=active')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success || !data.jobs) return;
          var tbody = document.querySelector('.mdc-data-table__content');
          if (!tbody) return;
          if (data.jobs.length === 0) {
            tbody.innerHTML = '<tr class="mdc-data-table__row"><td class="mdc-data-table__cell" colspan="7">No active rips at this time.</td></tr>';
            return;
          }
          var html = '';
          data.jobs.forEach(function(job) {
            var chipClass = job.status === 'ripping' ? 'primary' : (job.status === 'transcoding' ? 'secondary' : 'success');
            html += '<tr class="mdc-data-table__row">';
            html += '<td class="mdc-data-table__cell"><a href="/jobdetail?job_id=' + job.job_id + '">' + job.job_id + '</a></td>';
            html += '<td class="mdc-data-table__cell">' + (job.title || 'Unknown') + '</td>';
            html += '<td class="mdc-data-table__cell">' + (job.disctype || '') + '</td>';
            html += '<td class="mdc-data-table__cell"><span class="status-chip ' + chipClass + '">' + (job.status || '') + '</span></td>';
            html += '<td class="mdc-data-table__cell">' + (job.progress || 'N/A') + '</td>';
            html += '<td class="mdc-data-table__cell">' + (job.start_time ? new Date(job.start_time).toLocaleString() : '') + '</td>';
            html += '<td class="mdc-data-table__cell"><a href="/jobdetail?job_id=' + job.job_id + '"><md-outlined-button>Details</md-outlined-button></a></td>';
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
