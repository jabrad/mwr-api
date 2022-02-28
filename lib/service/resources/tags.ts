export interface Tags {
  [tag: string]: number;
}


// The first character cannot be a visible special ASCII character
export const tagPattern = /^[^\x20-\x40\x5B-\x60\x7B-\x7E].{0,23}$/;


export const testTag = (tag: string): boolean =>
  tagPattern.test(tag);
