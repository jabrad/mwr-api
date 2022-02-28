import * as sinon from 'sinon';
import { assert } from 'sinon';

import * as json from './json';


describe('json', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('decodeBuffer', () => {
    it('decodes a base64 encoded buffer', () => {
      const result = json.decodeBufferBase64('somekey', {
        type: 'Base64Buffer',
        data: 'c29tZXZhbA==',
      });

      assert.match(result, Buffer.from('someval'));
    });

    it('works with JSON.parse()', () => {
      const jsonData = `{
        "someProp": {
          "type": "Base64Buffer",
          "data": "c29tZW90aGVydmFs"
        }
      }`;

      const result = JSON.parse(jsonData, json.decodeBufferBase64);

      assert.match(result, {
        someProp: Buffer.from('someotherval'),
      });
    });
  });

  describe('encodeBuffer', () => {
    it('encodes a JSONified buffer', () => {
      const result = json.encodeBufferBase64('key', Buffer.from('yetanother').toJSON());

      assert.match(result, {
        type: 'Base64Buffer',
        data: 'eWV0YW5vdGhlcg==',
      });
    });

    it('works with JSON.stringify()', () => {
      const result = JSON.stringify(
        { prop: Buffer.from('someval') },
        json.encodeBufferBase64,
      );

      assert.match(result, '{"prop":{"type":"Base64Buffer","data":"c29tZXZhbA=="}}');
    });
  });
});
