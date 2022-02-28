// @ts-nocheck

const path = require('path');
const util = require('util');
const finished = util.promisify(require('stream').finished);
const { spawn } = require('child_process');
const execFile = util.promisify(require('child_process').execFile);
const webpack = require('webpack');
const webpackStream = require('webpack-stream');
const { series, dest, parallel } = require('gulp');
const del = require('del');
const glob = require('fast-glob');


/**
 *
 * @param {string[]} globs
 */
function clean(...globs) {
  return function clean() {
    return del(globs);
  };
}


async function buildLayers() {
  const layerBuildScripts = glob.stream('lambda/layers/*/build.sh');

  for await (const buildScript of layerBuildScripts) {
    console.log(`\nBuilding '${path.dirname(buildScript).split('/').pop()}' layer`);

    await execFile(buildScript);
  }
}


function compileLambdas() {
  return spawn('npx', ['tsc', '-p', 'lambda/functions/'], { stdio: 'inherit' });
}


async function webpackLambdas() {
  const lambdaEntryFilePaths =
    glob.stream(['dist/lambda/lambda/functions/*.js']);

  for await (const filePath of lambdaEntryFilePaths) {
    const lambdaName = path.parse(filePath).name;

    console.log(`\nWebpacking '${lambdaName}' lambda`);

    await finished(webpackStream({
      entry: {
        index: `./${filePath}`,
      },
      target : 'node14',
      resolve: {
        alias: {
          '~seams': path.resolve(__dirname, 'dist/lambda/lib/seams'),
          'lib'   : path.resolve(__dirname, 'dist/lambda/lib'),
        },
      },
      externals: [
        'sharp',
        /^aws-sdk/,
      ],
      output: {
        filename     : '[name].js',
        libraryTarget: 'commonjs2',
      },
      mode: 'production',
    }, webpack)
      .pipe(dest(`dist/aws/lambda/${lambdaName}`)));
  }
}


exports.buildLayers =
  series(clean('dist/lambda/layers', 'dist/aws/layers'), buildLayers);

exports.buildLambda =
  series(clean('dist/lambda/functions', 'dist/aws/lambda'), compileLambdas, webpackLambdas);

exports.build = parallel(exports.buildLayers, exports.buildLambda);
