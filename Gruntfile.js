module.exports = function (grunt) {
    grunt.initConfig({
        jshint: {
            jshintrc: '.jshintrc',
            files: ['Gruntfile.js', 'bin/*', 'lib/**/*.js', 'test/**/*.js', '!test/assets/**/*']
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
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-execute');

    grunt.registerTask('test', ['execute:assets', 'simplemocha:full']);
    grunt.registerTask('default', ['jshint', 'test']);
};
