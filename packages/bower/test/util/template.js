var expect = require('expect.js');
var template = require('../../lib/util/template');
var fs = require('fs');

describe('template: util template methods for templates in lib/templates', function () {
    describe('.render() - Renders a handlebars template', function () {
        var testTemplateName = 'test-template.tpl';
        var testTemplatePath = __dirname + '/../../lib/templates/' + testTemplateName;
        beforeEach(function () {
            fs.writeFileSync(testTemplatePath, '{{foo}}');
            console.log();
        });
        it('.render() returns a compiled test-template template', function () {
            var compiledStr = template.render(
                testTemplateName,
                { foo: 'foo value' }
            );
            expect(compiledStr).to.be.equal(
                'foo value'
            );
        });
        it('.render() throws when a non existent template is provided', function () {
            expect(function () {
                template.render(
                    'test-template.not-present.tpl',
                    { foo: 'foo value' }
                );
            }).to.throwException();
        });
        afterEach(function () {
            fs.unlinkSync(testTemplatePath);
        });
    });

    describe('.exists() - Checks existence of a template', function () {
        var testTemplateName = 'test-template.tpl';
        var testTemplatePath = __dirname + '/../../lib/templates/' + testTemplateName;
        beforeEach(function () {
            fs.writeFileSync(testTemplatePath, '{{foo}}');
        });
        it('.exists() returns true for an existing template', function () {
            var templateExists = template.exists(testTemplateName);
            expect(templateExists).to.be.ok();
        });
        it('.exists() returns false for a non existing template', function () {
            var templateExists = template.exists('test-template.not-present.tpl');
            expect(templateExists).to.not.be.ok();
        });
        afterEach(function () {
            fs.unlinkSync(testTemplatePath);
        });
    });
});
