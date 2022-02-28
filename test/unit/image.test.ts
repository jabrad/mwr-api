import * as sinon from 'sinon';
import { assert, stub } from 'sinon';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { testCases, chainStub } from './test_helpers';

chai.use(chaiAsPromised);

import * as image from './image';
import * as sharp from '~seams/sharp';


function stubSharp(lastCallName?: string, value?: any) {
  return stub(sharp, 'default')
    .returns(chainStub(lastCallName, value));
}


function bmp500x200x3(): image.RawImgSpec {
  return {
    width   : 500,
    height  : 200,
    channels: 3,
  };
}

function bmp1000x600x3(): image.RawImgSpec {
  return {
    width   : 1000,
    height  : 600,
    channels: 3,
  };
}


describe('image', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('rotateRectangleVertex', () => {
    it('returns rotated point', () => {
      testCases<[image.Point, number], image.Point>([
        { args: [{ x: 0, y: 0 }, image.rad(45)], expected: { x: 0, y: 0 } },
        { args: [{ x: 200, y: 0 }, image.rad(45)], expected: { x: 141, y: 141 } },
        { args: [{ x: 200, y: 50 }, image.rad(45)], expected: { x: 106, y: 177 } },
        { args: [{ x: 0, y: 50 }, image.rad(45)], expected: { x: -35, y: 35 } },
      ], (testCase) => {
        const result = image.rotateRectangleVertex(...testCase.args);

        assert.match(result, testCase.expected);
      });
    });
  });

  describe('rotateRectangle', () => {
    it('rotates a rectangle by a given angle', () => {
      const result = image.rotateRectangle({ width: 300, height: 100 }, image.rad(30));

      assert.match(result, [
        { x: 0, y: 0 },
        { x: 259, y: 149 },
        { x: 209, y: 235 },
        { x: -49, y: 86 }]);
    });
  });

  describe('getAngularCropOffset', () => {
    describe('for I quadrant', () => {
      it('returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 100,
            left: 100,
          }, 45, bmp1000x600x3());

        assert.match(result, { top: 141, left: 424 });
      });
    });

    describe('for II quadrant', () => {
      it('returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 23,
            left: 7,
          }, 100, bmp1000x600x3());

        assert.match(result, { top: 107, left: 740 });
      });

      it('with 180[deg], returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 600 - 1,
            left: 1000 - 1,
          }, 180, bmp1000x600x3());

        assert.match(result, { top: 0, left: 0 });
      });
    });

    describe('for III quadrant', () => {
      it('returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 0,
            left: 0,
          }, -91, bmp1000x600x3());

        assert.match(result, { top: 1009, left: 17 });
      });

      it('with 270[deg], returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 0,
            left: 1000 - 1,
          }, 270, bmp1000x600x3());

        assert.match(result, { top: 0, left: 0 });
      });
    });

    describe('for IV quadrant', () => {
      it('returns offset', () => {
        const result = image.getAngularCropOffset(
          {
            top : 50,
            left: 50,
          }, -30, bmp1000x600x3());

        assert.match(result, { top: 518, left: 68 });
      });
    });
  });

  describe('angularCrop', () => {
    describe('with slight tilt', () => {
      it('returns a rawImg spec with requested dimensions', () => {
        stubSharp('raw', {});
        const result = image.angularCrop({
          angle : 10,
          top   : 100,
          left  : 100,
          width : 200,
          height: 100,
        }, bmp1000x600x3());

        assert.match(result, {
          rawImgSpec: {
            width   : 200,
            height  : 100,
            channels: 3,
          },
        });
      });
    });

    describe('with no tilt', () => {
      it('returns a rawImg spec with requested dimensions', () => {
        stubSharp('raw', {});
        const result = image.angularCrop({
          angle : 0,
          top   : 23,
          left  : 64,
          width : 123,
          height: 123,
        }, bmp1000x600x3());

        assert.match(result, {
          rawImgSpec: {
            width   : 123,
            height  : 123,
            channels: 3,
          },
        });
      });
    });
  });

  describe('thumbnail', () => {
    describe('with width', () => {
      it('returns a rawImg spec with thumbnail dimensions', () => {
        stubSharp();

        const result = image.thumbnail(
          { width: 200 },
          bmp1000x600x3());

        assert.match(result.rawImgSpec, { width: 200, height: 120, channels: 3 });
      });
    });

    describe('with height', () => {
      it('returns a rawImg spec with thumbnail dimensions', () => {
        stubSharp();

        const result = image.thumbnail(
          { height: 400 },
          bmp1000x600x3());

        assert.match(result.rawImgSpec, { width: 667, height: 400, channels: 3 });
      });
    });

    describe('with width and height', () => {
      it('returns a rawImg spec with thumbnail dimensions', () => {
        stubSharp();

        const result = image.thumbnail(
          { width: 200, height: 1000 },
          bmp1000x600x3());

        assert.match(result.rawImgSpec, { width: 200, height: 1000, channels: 3 });
      });
    });

    describe('with crop', () => {
      it('returns a rawImg spec with thumbnail dimensions', () => {
        stubSharp();

        const result = image.thumbnail(
          {
            crop : { top: 0, left: 20, width: 960, height: 600 },
            width: 200,
          },
          bmp1000x600x3());

        assert.match(result.rawImgSpec, { width: 200, height: 120, channels: 3 });
      });
    });
  });
});
