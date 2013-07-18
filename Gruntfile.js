module.exports = function (grunt) {
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            files: ['Gruntfile.js', 'bin/*', 'lib/**/*.js', 'test/**/*.js', '!test/assets/**/*']
        },
        simplemocha: {
            options: {
                reporter: 'spec',
                timeout: '5000'
            },
            full: { src: ['test/test.js'] },
            short: {
                options: {
                    reporter: 'dot'
                },
                src: ['test/test.js']
            }
        },
        execute: {
            assets: {
                src: ['test/assets/downloader.js']
            }
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint', 'simplemocha:short']
        },
        shell: {
            cover: {
                command: 'node node_modules/istanbul/lib/cli.js cover --dir ./test/reports node_modules/mocha/bin/_mocha -- -R dot',
                options: {
                    stdout: true,
                    stderr: true
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-execute');

    grunt.registerTask('test', ['execute:assets', 'simplemocha:full']);
    grunt.registerTask('cover', 'shell:cover');
    grunt.registerTask('default', ['jshint', 'test']);
};
