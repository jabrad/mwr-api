export interface Identity {
  principalID: string;
}

// NOTE: This definition is incomplete
export interface V2dot1 {
  eventVersion: string;
  eventSource: 'aws:s3';
  awsRegion: string;
  eventTime: string;
  eventName: string;
  userIdentity: Identity;
  s3: {
    bucket: {
      name: string;
      ownerIdentity: Identity;
      arn: string
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      sequencer: string;
    };
  };
}

export default interface Event {
  Records: V2dot1[];
}


export const assertVersion = (version: unknown, requiredVersion: string) => {
  if (
    typeof version === 'string'
    && version
    && !isNaN(Number(version))
  ) {
    const [major, minor] = version.split('.');
    const [reqMajor, reqMinor] = requiredVersion.split('.');

    if (major !== reqMajor || minor < reqMinor)
      throw new Error(`Expected version ${requiredVersion}; got ${version}`);
  }
  else {
    throw new Error('Invalid version format');
  }
};
