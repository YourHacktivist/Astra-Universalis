;(function () {
  var root = document.getElementById('astra-splash')
  if (!root) return
  var fill = root.querySelector('.as-fill')
  var cursor = root.querySelector('.as-cursor')
  var label = root.querySelector('.as-label')
  var pct = root.querySelector('.as-pct')
  var t0 = performance.now()
  var shown = 0
  var target = 0.14
  var finished = false

  var seed = 7
  function rnd() {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  var w = Math.max(window.innerWidth, 1600)
  var h = Math.max(window.innerHeight, 1000)
  var stars = []
  for (var i = 0; i < 110; i++) {
    var a = (0.12 + Math.pow(rnd(), 2.2) * 0.6).toFixed(2)
    var tint = rnd()
    var c = tint > 0.93 ? '236 201 138' : tint > 0.8 ? '170 192 236' : '236 235 230'
    var s = rnd() > 0.96 ? 1 : 0
    stars.push(Math.round(rnd() * w) + 'px ' + Math.round(rnd() * h) + 'px 0 ' + s + 'px rgb(' + c + ' / ' + a + ')')
  }
  root.querySelector('.as-stars').style.boxShadow = stars.join(',')

  function paint() {
    fill.style.transform = 'scaleX(' + shown.toFixed(4) + ')'
    cursor.style.left = (shown * 100).toFixed(2) + '%'
    pct.textContent = Math.round(shown * 100) + ' %'
  }
  var creep = setInterval(function () {
    var cap = Math.min(0.96, target + 0.1)
    var next = shown < target ? shown + (target - shown) * 0.35 : shown + (cap - shown) * 0.025
    if (Math.abs(next - shown) > 0.0005) {
      shown = next
      paint()
    }
  }, 140)

  function remove() {
    clearInterval(creep)
    root.classList.add('as-out')
    root.removeAttribute('aria-busy')
    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root)
    }, 700)
  }

  window.__astraSplash = {
    step: function (text, progress) {
      if (finished) return
      if (text) label.textContent = text
      if (progress > target) target = progress
    },
    done: function () {
      if (finished) return
      finished = true
      label.textContent = 'Prêt'
      shown = 1
      paint()
      var wait = Math.max(320, 1100 - (performance.now() - t0))
      setTimeout(remove, wait)
    },
  }
  setTimeout(function () {
    window.__astraSplash.done()
  }, 15000)
})()
