
function AppInfo() {

    //Exibe as informações do sistema
    let DateUpdate = new Date(2026, 10, 2);
    let start = new Date(2020, 1, 1);
    /*Deprecated 
    let now = new Date();
    let diff = DateUpdate - start;
    let oneDay = 1000 * 60 * 60 * 24;
    let day = Math.floor(diff / oneDay);
    */
    let version = "1.1"
    let titleApp = "<strong>AntSoft DS • Buscador de DOI's no CrossRef</strong>"
    let month = Math.floor(DateUpdate.getMonth() + 1);
    month = month.toString().padStart(2, '0')
    day = dayOfYear(DateUpdate);
    versao = "Versão: " + version + "." + day + "." + DateUpdate.getFullYear().toString().slice(-2) + month + " • Atualizado em: " + DateUpdate.toLocaleDateString("pt-BR");
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
    let includes = $('[data-include]')
    $.each(includes, function () {
        let file = $(this).data('include') + '.html'
        $(this).load(file);
        console.log('Incluindo: ' + file);
    })
})
const dayOfYear = (date) => {
    // Create a new Date object for the very beginning of the current year (Jan 1st, 00:00:00)
    const startOfYear = new Date(date.getFullYear(), 0, 0);

    // Calculate the difference in milliseconds
    const differenceInMilliseconds = date - startOfYear;

    // Convert milliseconds to days (1000ms * 60s * 60m * 24h)
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    // Calculate the day of the year and round down to the nearest integer
    return Math.floor(differenceInMilliseconds / millisecondsPerDay);
};
