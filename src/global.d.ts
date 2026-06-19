// React Native provides these globals at runtime
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  decode(input?: Uint8Array): string;
}

declare const crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};

declare function btoa(data: string): string;
declare function atob(data: string): string;

interface AbortSignal {
  timeout?: never;
}

declare namespace AbortSignal {
  function timeout(ms: number): AbortSignal;
}
