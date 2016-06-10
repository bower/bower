'use strict';

module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    // Project configuration.
    grunt.initConfig({

        jshint: {
            files: [
                'Gruntfile.js',
                'lib/**/*.js',
                'test/**/*.js',
                '!test/reports/**/*'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        simplemocha: {
            options: {
                reporter: 'spec'
            },
            full: { src: ['test/test.js'] },
            short: {
                options: {
                    reporter: 'dot'
                },
                src: ['test/test.js']
            },
            build: {
                options: {
                    reporter: 'tap'
                },
                src: ['test/test.js']
            }
        },

        exec: {
            cover: {
                command: 'STRICT_REQUIRE=1 node node_modules/istanbul/lib/cli.js cover --dir ./test/reports node_modules/mocha/bin/_mocha -- --timeout 30000 -R dot test/test.js'
            },
            coveralls: {
                command: 'node node_modules/.bin/coveralls < test/reports/lcov.info'
            }
        },


        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint', 'simplemocha:short']
        }

    });

    // Default task.
    grunt.registerTask('test', ['simplemocha:full']);
    grunt.registerTask('default', ['jshint', 'test']);
    grunt.registerTask('travis', ['jshint', 'exec:cover', 'exec:coveralls']);
};
