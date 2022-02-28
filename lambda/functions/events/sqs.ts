// This interface describes an "event source mapping" message format.
// NOTE: it's incomplete - specifically the attribute properties.
export interface Message {
  messageId: string;
  receiptHandle: string;
  md5OfBody: string;
  body: string;
}


export default interface Event {
  Records: Message[];
}
