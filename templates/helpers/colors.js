require('colors');

var templateColors = [
    'yellow',
    'green',
    'cyan',
    'red',
    'white',
    'magenta'
];

function colors(Handlebars) {
    templateColors.forEach(function (color) {
        Handlebars.registerHelper(color, function (context) {
            return context.fn(this)[color];
        });
    });
}

module.exports = colors;
