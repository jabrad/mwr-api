#!/bin/bash

PROJECT_DIR=$PWD

CURRENT_ABS_PATH=`realpath $0`
CURRENT_ABS_DIR=${CURRENT_ABS_PATH%/*}
CURRENT_REL_DIR=`dirname $0`
CURRENT_DIR_NAME=${CURRENT_ABS_DIR##*/}

# Build workspace
BUILD_DIR=dist/lambda/lambda/layers/$CURRENT_DIR_NAME
# Build artifacts
DIST_DIR=dist/aws/layers/$CURRENT_DIR_NAME

mkdir -p $BUILD_DIR
mkdir -p $DIST_DIR

cp $CURRENT_REL_DIR/package.json -t $BUILD_DIR
cp package-lock.json -t $BUILD_DIR

cd $BUILD_DIR

npm ci

cd $PROJECT_DIR

mkdir $DIST_DIR/nodejs

# ln -srf $BUILD_DIR/node_modules -t $DIST_DIR/nodejs
mv $BUILD_DIR/node_modules/ $DIST_DIR/nodejs/
