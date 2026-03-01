
function AppInfo() {

    //Exibe as informações do sistema
    var DateUpdate = new Date(2026, 1, 28);
    var now = new Date();
    var start = new Date(2020, 1, 1);
    var diff = DateUpdate - start;
    var oneDay = 1000 * 60 * 60 * 24;
    var day = Math.floor(diff / oneDay);
    var titleApp = "<strong>AntSoft DS • Buscador de DOI's no CrossRef</strong>"
    versao = "Versão: 0.7." + day + "." + DateUpdate.getFullYear().toString().slice(-2) + ("0" + (DateUpdate.getMonth())).slice(-2) + " • Atualizado em: " + DateUpdate.toLocaleDateString("pt-BR");
    $("#version").html('<p class="text-center font-weight-bold">' + titleApp + '<br/>' + versao + '</p>');

};
$(function () {
    $(document).on('scroll', function () {

        if ($(window).scrollTop() > 100) {
            $('.scroll-top-wrapper').addClass('show');
        } else {
            $('.scroll-top-wrapper').removeClass('show');
        }
    });

    $('.scroll-top-wrapper').on('click', scrollToTop);
});

function scrollToTop() {
    verticalOffset = typeof (verticalOffset) != 'undefined' ? verticalOffset : 0;
    element = $('html');
    offset = element.offset();
    offsetTop = offset.top;
    $('html, body').animate({ scrollTop: offsetTop }, 500, 'linear');
}
$(function () {
    var includes = $('[data-include]')
    $.each(includes, function () {
        var file = $(this).data('include') + '.html'
        $(this).load(file);
        console.log('Incluindo: ' + file);
    })
})
