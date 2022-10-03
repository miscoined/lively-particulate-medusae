/*jshint node:true*/
'use strict';

// https://github.com/laurenhamel/grunt-dart-sass

// Compile Sass to CSS using dart-sass.

module.exports = function (config) {
  var files = [{
        expand: true,
        cwd : config.source + 'scss/',
        src: '*.scss',
        dest: '.temp/css/',
        ext: '.css'
      }];
  return {
    options: {
      includePaths: [
        config.source + 'lib'
      ]
    },
    build: {
      files : files,
      options : {
        outputStyle : 'compressed'
      }
    },
    develop: {
      files : files,
      options : {
        sourceComments : 'map'
      }
    }
  };
};
