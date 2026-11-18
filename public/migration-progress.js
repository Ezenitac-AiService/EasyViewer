// SPDX-License-Identifier: GPL-3.0-only
// Progress page for the one-time migration window (spec 003 US6). The native side pushes
// progress with `pagelightMigrationProgress(pairIndex, pairCount, filesDone, filesTotal)`.
// This window has no IPC capability and stores nothing.
;(function () {
  var bar = document.getElementById('bar')
  var track = bar && bar.parentElement
  var detail = document.getElementById('detail')
  window.pagelightMigrationProgress = function (pairIndex, pairCount, done, total) {
    var share = pairCount > 0 ? 1 / pairCount : 1
    var inPair = total > 0 ? done / total : 1
    var pct = Math.max(0, Math.min(100, Math.round((pairIndex * share + inPair * share) * 100)))
    if (bar) bar.style.width = pct + '%'
    if (track) track.setAttribute('aria-valuenow', String(pct))
    if (detail) detail.textContent = '파일 ' + done + ' / ' + total + ' 복사함 (' + pct + '%)'
  }
})()
