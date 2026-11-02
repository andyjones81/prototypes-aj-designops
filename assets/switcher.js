/* Prototype switcher for pages that do not use assets/shell.js (the standalone COMPASS rules engine).
   Keep the list in step with GROUPS in shell.js. */
(function () {
  var ROOT = '../', CUR = 'rules-engine';
  var GROUPS = [
    { label: 'Enabling services', items: [['enabling-services', 'Service and enabling service management'], ['feedback-satisfaction', 'Feedback and satisfaction'], ['analytics-reporting', 'Analytics and central reporting'], ['assurance', 'Assurance'], ['admin', 'Admin console'], ['rules-engine', 'COMPASS work, rules and actions']] },
    { label: 'People capability', items: [['cbp', 'CBP assessment management'], ['skills', 'Skills and capability'], ['learning', 'Learning and development'], ['people-admin', 'People capability administration']] },
    { label: 'Platform tooling', items: [['prototype-manager', 'Prototype Manager']] }
  ];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = ROOT + 'assets/switcher.css'; document.head.appendChild(l);
  var html = '<div class="proto-switch"><details class="proto-switch__details"><summary class="proto-switch__summary">Switch prototype</summary><div class="proto-switch__panel"><a class="govuk-link" href="' + ROOT + '">All prototypes</a>' +
    GROUPS.map(function (g) {
      return '<p class="proto-switch__group">' + esc(g.label) + '</p><ul class="proto-switch__list">' + g.items.map(function (i) {
        var cur = i[0] === CUR; return '<li><a class="govuk-link' + (cur ? ' proto-switch__current' : '') + '" href="' + ROOT + i[0] + '/"' + (cur ? ' aria-current="page"' : '') + '>' + esc(i[1]) + '</a></li>';
      }).join('') + '</ul>';
    }).join('') + '</div></details></div>';
  var c = document.querySelector('.govuk-header__container'); if (c) c.insertAdjacentHTML('beforeend', html);
  document.addEventListener('click', function (e) { var d = document.querySelector('.proto-switch__details'); if (d && d.open && !d.contains(e.target)) d.open = false; });
  document.addEventListener('keydown', function (e) { var d = document.querySelector('.proto-switch__details'); if (e.key === 'Escape' && d && d.open) { d.open = false; d.querySelector('summary').focus(); } });
})();
