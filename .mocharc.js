module.exports = {
  spec      : 'dist/lib/**/*.test.js',
  watchFiles: ['dist/lib/**/*.(json|js)'],
  require   : ['module-alias/register'],
};
