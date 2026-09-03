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

    /* --- dots, for the rails that asked for them --- */
    /* The dots sit AFTER the carousel, not inside it: `.car` is the positioning
       context for the two arrows, and a strip added to its height would push
       them off the middle of the pictures. */
    var after = car.nextElementSibling;
    var dotsBox = car.querySelector('[data-car-dots]') ||
      (after && after.matches && after.matches('[data-car-dots]') ? after : null);
    var dotButtons = [];
    function cards(){ return Array.prototype.slice.call(track.children); }
    /* How many places this track can actually stop at. Not the card count:
       a desktop rail shows two cards and a phone one, and the last card
       cannot be scrolled to the left edge — asking for that leaves the reader
       pressing a dot that moves nothing. */
    function stops(){
      var items = cards();
      if(!items.length) return 1;
      var visible = Math.max(1, Math.floor((track.clientWidth + 15) / step()));
      return Math.max(1, items.length - visible + 1);
    }
    var dotRow = null;
    function buildDots(){
      if(!dotsBox) return;
      var n = stops();
      if(n < 2) n = 0;
      if(n === dotButtons.length) return;
      dotsBox.textContent = '';
      dotButtons = [];
      dotRow = null;
      if(!n) return;
      dotRow = document.createElement('div');
      dotRow.className = 'car-dots__row';
      for(var i = 0; i < n; i++){
        dotRow.appendChild(makeDot(i, n));
      }
      dotsBox.appendChild(dotRow);
    }

    /* Slide the strip under its window.
       Fourteen screenshots would be fourteen dots, which is a ruler and not a
       control, so the window holds ten and the row moves beneath it. While the
       row fits it is simply centred; once it does not, the active dot is held
       in the middle and the row is clamped at both ends so the strip never
       pulls away from its own edge. */
    function placeRow(active){
      if(!dotRow || !dotButtons.length) return;
      var first = dotButtons[0].getBoundingClientRect();
      var size = first.width;
      var stride = dotButtons.length > 1
        ? dotButtons[1].getBoundingClientRect().left - first.left
        : size;
      var rowWidth = size + stride * (dotButtons.length - 1);
      var windowWidth = dotsBox.clientWidth;
      var x;
      if(rowWidth <= windowWidth){
        x = (windowWidth - rowWidth) / 2;
      }else{
        x = windowWidth / 2 - (active * stride + size / 2);
        x = Math.max(windowWidth - rowWidth, Math.min(0, x));
      }
      dotRow.style.transform = 'translateX(' + Math.round(x) + 'px)';
      /* A dot fades only where the row actually continues. Clamped hard against
         either end there is nothing further that way, and a shrunken dot would
         promise more of a strip that has run out. Never the active one either:
         at the ends the lit dot IS the one on the edge. */
      var overflowing = rowWidth > windowWidth + 1;
      var atStart = x >= -0.5;
      var atEnd = x <= windowWidth - rowWidth + 0.5;
      dotButtons.forEach(function(b, i){
        if(!overflowing){ b.classList.remove('is-edge'); return; }
        var centre = x + i * stride + size / 2;
        b.classList.toggle('is-edge', i !== active && (
          (!atStart && centre < stride) ||
          (!atEnd && centre > windowWidth - stride)
        ));
      });
    }
    function makeDot(index, total){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-dot';
      b.setAttribute('aria-label', 'Показати ' + (index + 1) + ' з ' + total);
      b.addEventListener('click', function(){
        var item = cards()[index];
        if(!item) return;
        glide(track, item.getBoundingClientRect().left - track.getBoundingClientRect().left, sync);
      });
      dotButtons.push(b);
      return b;
    }
    /* Which dot is lit: the card nearest the left edge, clamped to the last
       dot — past the final stop several cards share the same resting place. */
    function syncDots(){
      if(!dotButtons.length) return;
      var left = track.getBoundingClientRect().left;
      var nearest = 0, best = Infinity;
      cards().forEach(function(item, i){
        var d = Math.abs(item.getBoundingClientRect().left - left);
        if(d < best){ best = d; nearest = i; }
      });
      var active = Math.min(nearest, dotButtons.length - 1);
      dotButtons.forEach(function(b, i){
        var on = i === active;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-current', on ? 'true' : 'false');
      });
      placeRow(active);
    }

    function sync(){
      var max = track.scrollWidth - track.clientWidth - 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max;
      syncDots();
    }
    prev.addEventListener('click', function(){ glide(track, -step()*2, sync); });
    next.addEventListener('click', function(){ glide(track,  step()*2, sync); });
    track.addEventListener('scroll', sync, {passive:true});
    window.addEventListener('resize', function(){ buildDots(); sync(); });
    buildDots();
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
        /* The lightbox is 9:16 by default because this rail was built for
           vertical phone testimonials. A landscape video in that frame is two
           thick black bars and a stamp-sized picture, so a card that knows its
           shape says so. */
        var ytRatio = vid.getAttribute('data-video-ratio');
        if(ytRatio) node.style.aspectRatio = ytRatio.replace('/', ' / ');
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
