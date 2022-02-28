import * as crypto from 'crypto';


export const checkMd5 = (data: crypto.BinaryLike, hash: string): boolean => {
  const md5 = crypto.createHash('md5');

  md5.update(data);

  return hash === md5.digest().toString('hex');
};
