/* Finders Safaris — season year switch.
   The hero year selector swaps every price on the page between departure
   years. Figures live in window.FS_PRICING, written once per page, so
   updating a package's real 2027 rates means editing one block.

   Optional fields in that block:
     mult  - the figures are per person but the page shows a total (a family of 4 uses "mult":4)
     unit  - "couple" when the page prices a couple rather than a person
   A figure that is text ("On Request") is shown as it is. */
(function () {
  'use strict';
  var P = window.FS_PRICING;
  if (!P || !P.years) return;

  var cur = P.defaultYear || Object.keys(P.years)[0];
  var mult = P.mult > 1 ? P.mult : 1;
  var unit = P.unit || (mult > 1 ? 'total' : 'pp');
  var unitText = unit === 'total' ? 'total' : unit === 'couple' ? 'per couple' : 'pp';

  var fmt = function (n) { return (P.currency || '$') + n.toLocaleString('en-US'); };
  var money = function (n) { return typeof n === 'number' ? fmt(n * mult) : n; }; /* "On Request" etc. */
  var plain = function (n) { return typeof n === 'number' ? fmt(n) : n; };       /* single supplement is never multiplied */

  function render(year) {
    var y = P.years[year];
    if (!y) return;
    cur = year;

    /* headline rows in the price card */
    var rows = document.querySelectorAll('.price-card .price-row .value');
    if (rows[0]) rows[0].textContent = money(y.headline);
    if (rows[1] && y.single !== undefined) rows[1].textContent = plain(y.single);

    /* the season table and its heading */
    var head = document.querySelector('.season-pricing h4');
    if (head) head.textContent = year + ' Season Pricing';
    var sp = document.querySelectorAll('.season-pricing .season-price');
    for (var i = 0; i < sp.length; i++) {
      if (y.seasons && y.seasons[i] !== undefined) sp[i].textContent = money(y.seasons[i]);
    }

    /* the sticky bar */
    var from = y.from !== undefined ? y.from : y.headline;
    var fp = document.querySelector('.floatcard .fc-price');
    if (fp) fp.textContent = typeof from === 'number' ? 'from ' + money(from) + ' ' + unitText : 'Price on request';

    /* a family page also states its starting price in the facts table */
    document.querySelectorAll('td').forEach(function (td) {
      if (td.previousElementSibling && /^Price From$/i.test(td.previousElementSibling.textContent.trim())) {
        td.textContent = typeof from === 'number' ? money(from) + (mult > 1 ? ' total for a family of ' + mult : '') : 'Price on request';
      }
    });

    /* the hero selector's own label */
    var lbl = document.querySelector('.hero-year .hy-label');
    if (lbl) lbl.textContent = year;

    document.querySelectorAll('.hero-year .yeardrop a').forEach(function (a) {
      a.classList.toggle('is-current', a.dataset.year === year);
    });

    /* let anything else on the page know */
    document.dispatchEvent(new CustomEvent('fs:yearchange', { detail: { year: year } }));
  }

  /* wire the dropdown */
  var toggle = document.getElementById('yearToggle');
  if (toggle) {
    toggle.querySelectorAll('.yeardrop a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        render(a.dataset.year);
        toggle.classList.remove('open');
      });
    });
  }

  render(cur);
})();
