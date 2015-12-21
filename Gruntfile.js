'use strict';
module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            files: [
                'Gruntfile.js',
                'bin/*',
                'lib/**/*.js',
                'test/**/*.js',
                '!test/assets/**/*',
                '!test/reports/**/*',
                '!test/tmp/**/*'
            ]
        },
        jscs: {
            options: {
                config: '.jscsrc',
                fix: true
            },
            files: [
                'Gruntfile.js',
                'bin/*',
                'lib/**/*.js',
                'test/**/*.js',
                '!test/assets/**/*',
                '!test/reports/**/*',
                '!test/tmp/**/*'
            ]
        },
        simplemocha: {
            options: {
                reporter: 'spec',
                timeout: '15000'
            },
            full: {
                src: ['test/test.js']
            },
            short: {
                options: {
                    reporter: 'dot'
                },
                src: ['test/test.js']
            }
        },
        exec: {
            assets: {
                command: 'node test/packages.js && node test/packages-svn.js'
            },
            'assets-force': {
                command: 'node test/packages.js --force && node test/packages-svn.js --force'
            },
            cover: {
                command: 'node node_modules/istanbul/lib/cli.js cover --dir ./test/reports node_modules/mocha/bin/_mocha -- --timeout 30000 -R dot test/test.js'
            },
            coveralls: {
                command: 'npm run coveralls < test/reports/lcov.info'
            }
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint', 'simplemocha:short']
        }
    });

    grunt.registerTask('assets', ['exec:assets-force']);
    grunt.registerTask('test', ['jscs', 'jshint', 'exec:assets', 'simplemocha:full']);
    grunt.registerTask('cover', 'exec:cover');
    grunt.registerTask('travis', ['jshint', 'exec:assets', 'exec:cover', 'exec:coveralls']);
    grunt.registerTask('default', 'test');
};
