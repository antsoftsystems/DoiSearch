(function ($) {
    "use strict"; // Start of use strict
    $(document).ready(function () {
        if (document.getElementById('credit')) {
            document.getElementById("credit").innerHTML = "<p class='small' style='text-align:center'><a href='https://www.wcrodrigues.dev.br' target='_blank'><img src='https://www.wcrodrigues.dev.br/images/avatar_gpt_wcrodrigues.png' style='height:128px; border-radius:10px' alt='William Costa Rodrigues'/><br />Developer by: William Costa Rodrigues</small></a></p>";
            document.getElementsByClassName("credit").innerHTML = "<p class='small' style='text-align:center'><a href='https://www.wcrodrigues.dev.br' target='_blank'><img src='https://www.wcrodrigues.dev.br/images/avatar_gpt_wcrodrigues.png' style='height:128px; border-radius:10px' alt='William Costa Rodrigues'/><br />Developer by: William Costa Rodrigues</a></p>";
        }
    });
})(jQuery); // End of use strict