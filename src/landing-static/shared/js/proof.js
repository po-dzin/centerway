/* Social-proof carousels + lightbox for the landing network.
   - [data-car]           carousel root; child .car-track scrolls, .car-nav buttons step it
   - .shot-card           screenshot testimonial; click → enlarged in lightbox
   - .vid-card[data-video] video testimonial; click → plays in lightbox ("on request")
     data-video accepts a YouTube/Shorts URL or a direct video file URL. */
(function(){
  'use strict';

  /* --- carousel arrows --- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* rAF glide: native smooth scrollBy is unreliable on snap containers
     (the snap resolver can cancel it back to the start), so animate manually. */
  function glide(track, dx, done){
    if(reduceMotion){ track.scrollLeft += dx; if(done) done(); return; }
    var from = track.scrollLeft;
    var to = Math.max(0, Math.min(from + dx, track.scrollWidth - track.clientWidth));
    var t0 = null, dur = 360, started = false;
    var snap = track.style.scrollSnapType;
    track.style.scrollSnapType = 'none';
    function finish(){ track.style.scrollSnapType = snap; if(done) done(); }
    function frame(ts){
      started = true;
      if(t0 === null) t0 = ts;
      var k = Math.min((ts - t0) / dur, 1);
      k = 1 - Math.pow(1 - k, 3); /* ease-out cubic */
      track.scrollLeft = from + (to - from) * k;
      if(k < 1){ requestAnimationFrame(frame); }
      else { finish(); }
    }
    requestAnimationFrame(frame);
    /* rAF is suspended in hidden/occluded documents — jump instantly then */
    setTimeout(function(){ if(!started){ track.scrollLeft = to; finish(); } }, 120);
  }

  document.querySelectorAll('[data-car]').forEach(function(car){
    var track = car.querySelector('.car-track');
    if(!track) return;
    var prev = car.querySelector('.car-nav.prev');
    var next = car.querySelector('.car-nav.next');
    if(!prev || !next) return;
    function step(){
      var item = track.firstElementChild;
      return item ? item.getBoundingClientRect().width + 15 : 280;
    }
    function sync(){
      var max = track.scrollWidth - track.clientWidth - 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function(){ glide(track, -step()*2, sync); });
    next.addEventListener('click', function(){ glide(track,  step()*2, sync); });
    track.addEventListener('scroll', sync, {passive:true});
    window.addEventListener('resize', sync);
    sync();
  });

  /* --- lightbox --- */
  var box = null;
  function ensureBox(){
    if(box) return box;
    box = document.createElement('div');
    box.className = 'cw-lightbox';
    box.hidden = true;
    box.innerHTML = '<div class="cw-lightbox__scrim" data-lb-close></div>' +
      '<div class="cw-lightbox__body"><button type="button" class="cw-lightbox__x" data-lb-close aria-label="Закрити">×</button></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function(e){
      if(e.target.closest('[data-lb-close]')) close();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !box.hidden) close();
    });
    return box;
  }
  function open(node){
    var b = ensureBox();
    var body = b.querySelector('.cw-lightbox__body');
    body.querySelectorAll('img,video,iframe').forEach(function(n){ n.remove(); });
    body.appendChild(node);
    b.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    b.querySelector('.cw-lightbox__x').focus();
  }
  function close(){
    if(!box) return;
    box.hidden = true;
    box.querySelectorAll('video,iframe').forEach(function(n){ n.remove(); });
    document.documentElement.style.overflow = '';
  }

  function youtubeId(url){
    var m = url.match(/(?:youtu\.be\/|shorts\/|watch\?v=|embed\/)([\w-]{6,})/);
    return m ? m[1] : null;
  }

  document.addEventListener('click', function(e){
    var shot = e.target.closest('.shot-card');
    if(shot){
      var img = shot.querySelector('img');
      if(img){
        var big = new Image();
        big.src = img.currentSrc || img.src;
        big.alt = img.alt || '';
        open(big);
      }
      return;
    }
    var vid = e.target.closest('.vid-card[data-video]');
    if(vid){
      var url = vid.getAttribute('data-video');
      var yt = youtubeId(url);
      var node;
      if(yt){
        node = document.createElement('iframe');
        node.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0';
        node.allow = 'autoplay; encrypted-media; picture-in-picture';
        node.allowFullscreen = true;
      }else{
        node = document.createElement('video');
        node.src = url;
        node.controls = true;
        node.autoplay = true;
        node.playsInline = true;
      }
      open(node);
    }
  });
})();
