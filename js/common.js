$(".openModal").click(function(e) {
  e.preventDefault();

  // 1) достаем атрибуцию
  let attrib = {};
  try { attrib = JSON.parse(localStorage.getItem('cw_attrib') || '{}'); } catch(_) {}

  // 2) шлем InitiateCheckout ДО ухода
  if (typeof fbq === 'function') {
    fbq('track', 'InitiateCheckout', {
      value: 3000,
      currency: 'UAH',
      content_name: 'IVEM',
      ...attrib
    });
  }

  // 3) открываем оплату
  const API_BASE = "https://centerway-backend.vercel.app"; // твой vercel backend
  const PRODUCT_CODE = "irem";

  const payUrl = `${API_BASE}/api/pay/start?product=${encodeURIComponent(PRODUCT_CODE)}`;
  window.location.href = payUrl;
});

$( ".openModal1" ).click(function(e) {
    e.preventDefault();
    $('#modal1').arcticmodal();
});
$( ".openModal2" ).click(function(e) {
    e.preventDefault();
    $('#modal2').arcticmodal();
});
$( ".openModal3" ).click(function(e) {
    e.preventDefault();
    $('#modal3').arcticmodal();
});
$( ".openModal4" ).click(function(e) {
    e.preventDefault();
    $('#modal4').arcticmodal();
});
$( ".openModal5" ).click(function(e) {
    e.preventDefault();
    $('#modal5').arcticmodal();
});
$( ".openModal6" ).click(function(e) {
    e.preventDefault();
    $('#modal6').arcticmodal();
});
$( ".openModal7" ).click(function(e) {
    e.preventDefault();
    $('#modal7').arcticmodal();
});
$( ".openModal8" ).click(function(e) {
    e.preventDefault();
    $('#modal8').arcticmodal();
});

function newDate() {
  var time = new Date();
  var date_now =  new Date();
  date_now.setDate(date_now.getDate() + 1);
  $(".date-block").text(date_now.toLocaleString('uk-ua', {
    day: 'numeric',
    month: 'long' 
  }));
}
setTimeout(newDate, 100);

var myDate = new Date();
function returnEndDate(d,h,m){
  myDate.setDate(myDate.getDate()+d);
  myDate.setHours(myDate.getHours()+h);
  myDate.setMinutes(myDate.getMinutes()+m);
  return myDate;
}
if($.cookie("time-timer1")){
  var dateEnd = $.cookie("time-timer1");
}else{
  var dateEnd = returnEndDate(0,3,0); 
  $.cookie("time-timer1", dateEnd, {expires: 7});
}
var date = new Date($.cookie("time-timer1"));
    $(".getting-started").countdown(date, function(event) {
  $(this).html(
  event.strftime(''
  +'<div class="hr"><div class="dial">%H</div>годин</div>'
  +'<div class="min"><div class="dial">%M</div>хвилин</div>'
  +'<div class="sec"><div class="dial">%S</div>секунд</div>'));
});

! function(i) {
  var o, n;
  i(".title_block").on("click", function() {
    o = i(this).parents(".accordion_item"), n = o.find(".info"),
      o.hasClass("active_block") ? (o.removeClass("active_block"),
        n.slideUp()) : (o.addClass("active_block"), n.stop(!0, !0).slideDown(),
        o.siblings(".active_block").removeClass("active_block").children(
          ".info").stop(!0, !0).slideUp())
  })
}(jQuery);

$(document).ready(function(){
    var $menu = $("#menu");
    $(window).scroll(function(){
        if ( $(this).scrollTop() > 100 && $menu.hasClass("default") ){
            $menu.removeClass("default").addClass("fixed");
        } else if($(this).scrollTop() <= 100 && $menu.hasClass("fixed")) {
            $menu.removeClass("fixed").addClass("default");
        }
    });//scroll
});

$( ".showmore" ).click(function() {
    $(this).hide();
    $('.hidd').slideDown('slow');
});

function initReviewsCarousel() {
    var carousels = document.querySelectorAll(".reviews-carousel");
    carousels.forEach(function(carousel) {
        var track = carousel.querySelector(".reviews-track");
        var prev = carousel.querySelector(".carousel-btn.prev");
        var next = carousel.querySelector(".carousel-btn.next");
        if (!track || !prev || !next) {
            return;
        }
        var scrollByAmount = function() {
            return Math.max(240, Math.floor(track.clientWidth * 0.8));
        };
        prev.addEventListener("click", function() {
            track.scrollBy({ left: -scrollByAmount(), behavior: "smooth" });
        });
        next.addEventListener("click", function() {
            track.scrollBy({ left: scrollByAmount(), behavior: "smooth" });
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReviewsCarousel);
} else {
    initReviewsCarousel();
}
