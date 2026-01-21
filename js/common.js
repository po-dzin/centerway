$(".openModal").click(function(e) {
  e.preventDefault();

  // 1) достаем атрибуцию
  let attrib = {};
  try { attrib = JSON.parse(localStorage.getItem('cw_attrib') || '{}'); } catch(_) {}

  // 2) шлем InitiateCheckout ДО ухода
  if (typeof fbq === 'function') {
    fbq('track', 'InitiateCheckout', {
      value: 350,
      currency: 'UAH',
      content_name: 'Short Reboot',
      ...attrib
    });
  }

  // 3) открываем оплату
  const payUrl = 'https://www.liqpay.ua/api/3/checkout?data=eyJ2ZXJzaW9uIjozLCJhY3Rpb24iOiJwYXkiLCJhbW91bnQiOiIzNTAiLCJjdXJyZW5jeSI6IlVBSCIsImRlc2NyaXB0aW9uIjoi0J7Qv9C70LDRgtCwINC60YPRgNGB0YMgU2hvcnQgUmVib290INCy0ZbQtCBDZW50ZXJ3YXkiLCJwdWJsaWNfa2V5Ijoic2FuZGJveF9pMjM2MjQ4NTk3OTciLCJsYW5ndWFnZSI6InVrIiwicmVzdWx0X3VybCI6Imh0dHBzOi8vcmVib290LmNlbnRlcndheS5uZXQudWEvdGhhbmtzIn0=&signature=w/oBFIjZX8EDf5+mn4yaiEPpe5A=';

  window.location.href = payUrl;
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
    var $topCta = $(".s1 .openModal");
    var $bottomCta = $(".s11 .openModal");
    function isInViewport($el) {
        if (!$el.length) {
            return false;
        }
        var rect = $el[0].getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function shouldShowMenu() {
        var isTablet = window.matchMedia("(min-width: 601px) and (max-width: 1023px)").matches;
        var firstScreenHeight = isTablet ? ($(".s1").outerHeight() || window.innerHeight) : window.innerHeight;
        var pastFirstScreen = window.scrollY > firstScreenHeight;
        var topVisible = isInViewport($topCta);
        var bottomVisible = isInViewport($bottomCta);
        return pastFirstScreen && !topVisible && !bottomVisible;
    }

    function updateMenu() {
        if (shouldShowMenu() && $menu.hasClass("default")) {
            $menu.removeClass("default").addClass("fixed");
        } else if (!shouldShowMenu() && $menu.hasClass("fixed")) {
            $menu.removeClass("fixed").addClass("default");
        }
    }

    $(window).on("scroll resize", updateMenu);
    updateMenu();
});

$(document).ready(function(){
    $(".reviews-carousel").each(function(){
        var $carousel = $(this);
        var $track = $carousel.find(".reviews-track");
        var $items = $track.find(".reviews-item");
        var scrollAmount = $items.first().outerWidth(true) || 320;

        $carousel.find(".carousel-btn.prev").on("click", function(){
            $track[0].scrollBy({ left: -scrollAmount, behavior: "smooth" });
        });

        $carousel.find(".carousel-btn.next").on("click", function(){
            $track[0].scrollBy({ left: scrollAmount, behavior: "smooth" });
        });
    });
});
$( ".showmore" ).click(function() {
    $(this).hide();
    $('.hidd').slideDown('slow');
});
