/* Social-proof carousels + lightbox for the landing network.
   - [data-car]           carousel root; child .car-track scrolls, .car-nav buttons step it
   - .shot-card           screenshot testimonial; click → enlarged in lightbox
   - .vid-card[data-video] video testimonial; click → plays in lightbox ("on request")
     data-video accepts a YouTube/Shorts URL, a Facebook video URL, or a direct
     video file URL. Optional data-video-ratio ("9/16", "16/9") sizes the frame;
     it only matters for Facebook, whose plugin needs pixel dimensions. */
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

  /* Facebook is embeddable, but not the way YouTube is.
     YouTube takes a fluid iframe and works out its own size; the Facebook video
     plugin renders at a WIDTH GIVEN IN PIXELS in the URL, so the frame has to
     be measured before it is built — which is fine here, because the lightbox
     builds it at click time and knows the viewport. */
  function facebookVideo(url){
    return /^https?:\/\/(?:www\.|web\.|m\.)?facebook\.com\/[^\s]+\/videos\/|^https?:\/\/fb\.watch\//i.test(url)
      ? url
      : null;
  }

  /* The box the plugin gets: as wide as the lightbox allows, then shortened if
     the resulting height would run off the screen. Mirrors the CSS box in
     landing.css (`min(94vw,520px)`, 92vh) so the two cannot drift. */
  function frameBox(ratio){
    var parts = String(ratio || '9/16').split('/');
    var rw = parseFloat(parts[0]) || 9;
    var rh = parseFloat(parts[1]) || 16;
    var w = Math.min(520, Math.round(window.innerWidth * 0.94) - 40);
    var h = Math.round(w * rh / rw);
    var maxH = Math.round(window.innerHeight * 0.92) - 40;
    if(h > maxH){ h = maxH; w = Math.round(h * rw / rh); }
    return { w: Math.max(200, w), h: Math.max(200, h) };
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
      var fb = yt ? null : facebookVideo(url);
      var node;
      if(yt){
        node = document.createElement('iframe');
        node.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0';
        node.allow = 'autoplay; encrypted-media; picture-in-picture';
        node.allowFullscreen = true;
      }else if(fb){
        /* No autoplay, deliberately. Facebook's plugin will only autoplay
           MUTED, and a muted testimonial is a person moving their lips — worse
           than one play button. The visitor presses play and hears it. */
        var box = frameBox(vid.getAttribute('data-video-ratio'));
        node = document.createElement('iframe');
        node.src = 'https://www.facebook.com/plugins/video.php?href=' +
          encodeURIComponent(fb) + '&show_text=false&width=' + box.w;
        node.width = box.w;
        node.height = box.h;
        /* The pixel box beats the CSS 9/16 rule: the plugin was asked for this
           exact width and will not reflow inside a taller frame. */
        node.style.width = box.w + 'px';
        node.style.height = box.h + 'px';
        node.style.aspectRatio = 'auto';
        node.scrolling = 'no';
        node.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
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
