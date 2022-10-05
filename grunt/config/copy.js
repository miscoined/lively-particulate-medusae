/*jshint node:true*/
'use strict';

// https://github.com/gruntjs/grunt-contrib-copy

// Copy files and folders.

module.exports = function (config) {
  return {
    build: {
      files: [
        {
          expand: true,
          src: ['**'],
          dest: config.deploy + 'static/lib/three',
          cwd: 'node_modules/three'
        },
        {
          expand: true,
          src: [
            config.source + '.htaccess',
            config.source + 'img/{,*/}*.{jpg,jpeg,png,webp,gif,ico}',
            config.source + 'audio/{,*/}*.{mp3,ogg,wav}',
            config.source + 'fonts/*',
            './LivelyProperties.json'
          ],
          dest: config.deploy
        }
      ]
    },
    develop: {
      expand: true,
      src: [
        config.source + 'scss/**/*.scss',
        config.source + 'lib/**/*.js',
      ],
      dest: config.deploy
    }
  };
};
